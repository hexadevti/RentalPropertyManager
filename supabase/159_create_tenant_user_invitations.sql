create table if not exists public.tenant_user_invitations (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invited_profile_id uuid references public.user_profiles(id) on delete set null,
  invited_by_auth_user_id uuid references auth.users(id) on delete set null,
  claimed_auth_user_id uuid references auth.users(id) on delete set null,
  email text not null,
  login text,
  role text not null check (role in ('admin', 'guest')),
  message text,
  invitation_token text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  sent_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days'),
  delivery_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_tenant_user_invitations_tenant_status
  on public.tenant_user_invitations(tenant_id, status, created_at desc);

create index if not exists idx_tenant_user_invitations_email
  on public.tenant_user_invitations(tenant_id, email);

drop trigger if exists tenant_user_invitations_set_updated_at on public.tenant_user_invitations;
create trigger tenant_user_invitations_set_updated_at
before update on public.tenant_user_invitations
for each row execute function public.set_updated_at();

alter table public.tenant_user_invitations enable row level security;

drop policy if exists tenant_user_invitations_select on public.tenant_user_invitations;
create policy tenant_user_invitations_select on public.tenant_user_invitations
  for select to authenticated
  using (
    public.is_current_user_platform_admin()
    or (
      tenant_id = public.get_current_user_tenant_id()
      and public.is_current_user_admin()
    )
  );

drop policy if exists tenant_user_invitations_insert on public.tenant_user_invitations;
create policy tenant_user_invitations_insert on public.tenant_user_invitations
  for insert to authenticated
  with check (
    public.is_current_user_platform_admin()
    or (
      tenant_id = public.get_current_user_tenant_id()
      and public.is_current_user_admin()
    )
  );

drop policy if exists tenant_user_invitations_update on public.tenant_user_invitations;
create policy tenant_user_invitations_update on public.tenant_user_invitations
  for update to authenticated
  using (
    public.is_current_user_platform_admin()
    or (
      tenant_id = public.get_current_user_tenant_id()
      and public.is_current_user_admin()
    )
  )
  with check (
    public.is_current_user_platform_admin()
    or (
      tenant_id = public.get_current_user_tenant_id()
      and public.is_current_user_admin()
    )
  );

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invited_id uuid;
  v_tenant_id uuid;
  v_email text;
  v_org_name text;
  v_avatar_url text;
  v_login_base text;
  v_login text;
  v_suffix integer := 0;
begin
  v_email := lower(coalesce(new.email, ''));

  if v_email = '' then
    return new;
  end if;

  select id
    into v_invited_id
  from public.user_profiles
  where auth_user_id is null
    and lower(email) = v_email
  order by created_at asc
  limit 1;

  if v_invited_id is not null then
    update public.user_profiles
    set auth_user_id = new.id,
        github_login = coalesce(
          nullif(regexp_replace(lower(coalesce(
            new.raw_user_meta_data->>'user_name',
            new.raw_user_meta_data->>'preferred_username',
            new.raw_user_meta_data->>'full_name',
            split_part(v_email, '@', 1)
          )), '[^a-z0-9._-]', '', 'g'), ''),
          github_login
        ),
        updated_at = timezone('utc', now())
    where id = v_invited_id;

    update public.tenant_user_invitations
    set status = 'accepted',
        login = (
          select github_login
          from public.user_profiles
          where id = v_invited_id
        ),
        accepted_at = timezone('utc', now()),
        claimed_auth_user_id = new.id,
        updated_at = timezone('utc', now())
    where invited_profile_id = v_invited_id
      and status = 'pending';

    return new;
  end if;

  v_org_name := nullif(trim(coalesce(new.raw_user_meta_data->>'org_name', '')), '');

  if v_org_name is null then
    v_org_name := split_part(v_email, '@', 1) || '''s Organization';
  end if;

  insert into public.tenants (name)
  values (v_org_name)
  returning id into v_tenant_id;

  v_login_base := nullif(trim(coalesce(
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'preferred_username',
    new.raw_user_meta_data->>'full_name',
    split_part(v_email, '@', 1)
  )), '');

  if v_login_base is null then
    v_login_base := 'user-' || left(new.id::text, 8);
  end if;

  v_login_base := regexp_replace(lower(v_login_base), '[^a-z0-9._-]', '', 'g');

  if v_login_base = '' then
    v_login_base := 'user-' || left(new.id::text, 8);
  end if;

  v_login := v_login_base;
  while exists (select 1 from public.user_profiles where github_login = v_login) loop
    v_suffix := v_suffix + 1;
    v_login := v_login_base || '-' || v_suffix::text;
  end loop;

  v_avatar_url := coalesce(
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    nullif(new.raw_user_meta_data->>'picture', ''),
    'https://ui-avatars.com/api/?name=' || replace(v_login, ' ', '+')
  );

  insert into public.user_profiles (
    auth_user_id,
    tenant_id,
    github_login,
    role,
    status,
    email,
    avatar_url,
    created_at,
    updated_at
  )
  values (
    new.id,
    v_tenant_id,
    v_login,
    'guest',
    'pending',
    v_email,
    v_avatar_url,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;
