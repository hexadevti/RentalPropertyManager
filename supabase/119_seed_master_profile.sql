-- Seed a master profile (platform admin) with cross-tenant access.
-- Requires migration 118_enable_platform_admin_multi_tenant_management.sql.

create table if not exists public.platform_admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_current_user_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where auth_user_id = auth.uid()
  );
$$;

revoke all on function public.is_current_user_platform_admin() from public;
grant execute on function public.is_current_user_platform_admin() to authenticated;

do $$
declare
  v_master_email text := 'lucianobf@uol.com.br';
  v_auth_user_id uuid;
begin
  select id
    into v_auth_user_id
  from auth.users
  where lower(email) = lower(v_master_email)
  order by created_at asc
  limit 1;

  if v_auth_user_id is null then
    raise notice 'Master user not found in auth.users for email %', v_master_email;
    return;
  end if;

  insert into public.platform_admins (auth_user_id)
  values (v_auth_user_id)
  on conflict (auth_user_id) do nothing;

  -- Keep tenant-scoped profile usable in the UI (admin + approved).
  update public.user_profiles
  set role = 'admin',
      status = 'approved',
      updated_at = timezone('utc', now())
  where auth_user_id = v_auth_user_id;
end;
$$;
