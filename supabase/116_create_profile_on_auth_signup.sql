-- Auto-provision tenant + user profile when a new auth user signs up.
-- This guarantees website signups are reflected in public.user_profiles.

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

  -- Safety guard: if email is missing, skip provisioning.
  if v_email = '' then
    return new;
  end if;

  -- 1) If there is an invited profile row, claim it for this auth user.
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
        updated_at = timezone('utc', now())
    where id = v_invited_id;

    return new;
  end if;

  -- 2) Create a dedicated tenant for self-signup users.
  v_org_name := nullif(trim(coalesce(new.raw_user_meta_data->>'org_name', '')), '');

  if v_org_name is null then
    v_org_name := split_part(v_email, '@', 1) || '''s Organization';
  end if;

  insert into public.tenants (name)
  values (v_org_name)
  returning id into v_tenant_id;

  -- 3) Create a unique login value from metadata/email.
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

  -- 4) First profile in a self-created tenant is admin + approved.
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
    'admin',
    'approved',
    v_email,
    v_avatar_url,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();
