-- Enables secure cross-tenant management for platform admins.
-- Platform admins can view/switch tenants and manage user profiles across tenants.

create table if not exists public.platform_admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.platform_admins enable row level security;

drop policy if exists platform_admins_self_select on public.platform_admins;
create policy platform_admins_self_select on public.platform_admins
  for select to authenticated
  using (auth_user_id = auth.uid());

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

create or replace function public.get_current_user_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select email
  from auth.users
  where id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_current_user_email() from public;
grant execute on function public.get_current_user_email() to authenticated;

-- Tenants policies

drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select to authenticated
  using (
    id = public.get_current_user_tenant_id()
    or public.is_current_user_platform_admin()
  );

drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants
  for update to authenticated
  using (
    (id = public.get_current_user_tenant_id() and public.is_current_user_admin())
    or public.is_current_user_platform_admin()
  )
  with check (
    (id = public.get_current_user_tenant_id() and public.is_current_user_admin())
    or public.is_current_user_platform_admin()
  );

-- user_profiles policies

drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or tenant_id = public.get_current_user_tenant_id()
    or public.is_current_user_platform_admin()
  );

drop policy if exists user_profiles_insert on public.user_profiles;
create policy user_profiles_insert on public.user_profiles
  for insert to authenticated
  with check (
    auth_user_id = auth.uid()
    or (auth_user_id is null and tenant_id = public.get_current_user_tenant_id())
    or public.is_current_user_platform_admin()
  );

drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update on public.user_profiles
  for update to authenticated
  using (
    auth_user_id = auth.uid()
    or tenant_id = public.get_current_user_tenant_id()
    or (auth_user_id is null and lower(email) = lower(public.get_current_user_email()))
    or public.is_current_user_platform_admin()
  )
  with check (
    auth_user_id = auth.uid()
    or tenant_id = public.get_current_user_tenant_id()
    or auth_user_id is null
    or public.is_current_user_platform_admin()
  );

drop policy if exists user_profiles_delete on public.user_profiles;
create policy user_profiles_delete on public.user_profiles
  for delete to authenticated
  using (
    (tenant_id = public.get_current_user_tenant_id() and public.is_current_user_admin())
    or public.is_current_user_platform_admin()
  );

