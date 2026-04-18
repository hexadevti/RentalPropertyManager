-- Persist platform admin active tenant context and make RLS respect that context.

create table if not exists public.platform_admin_session_tenants (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.platform_admin_session_tenants enable row level security;

drop policy if exists platform_admin_session_tenants_select_own on public.platform_admin_session_tenants;
drop policy if exists platform_admin_session_tenants_insert_own on public.platform_admin_session_tenants;
drop policy if exists platform_admin_session_tenants_update_own on public.platform_admin_session_tenants;
drop policy if exists platform_admin_session_tenants_delete_own on public.platform_admin_session_tenants;

create policy platform_admin_session_tenants_select_own on public.platform_admin_session_tenants
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy platform_admin_session_tenants_insert_own on public.platform_admin_session_tenants
  for insert to authenticated
  with check (auth_user_id = auth.uid() and public.is_current_user_platform_admin());

create policy platform_admin_session_tenants_update_own on public.platform_admin_session_tenants
  for update to authenticated
  using (auth_user_id = auth.uid() and public.is_current_user_platform_admin())
  with check (auth_user_id = auth.uid() and public.is_current_user_platform_admin());

create policy platform_admin_session_tenants_delete_own on public.platform_admin_session_tenants
  for delete to authenticated
  using (auth_user_id = auth.uid() and public.is_current_user_platform_admin());

create or replace function public.get_current_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.tenant_id
      from public.platform_admin_session_tenants s
      where s.auth_user_id = auth.uid()
        and public.is_current_user_platform_admin()
      limit 1
    ),
    (
      select p.tenant_id
      from public.user_profiles p
      where p.auth_user_id = auth.uid()
        and p.status = 'approved'
      limit 1
    )
  );
$$;

revoke all on function public.get_current_user_tenant_id() from public;
grant execute on function public.get_current_user_tenant_id() to authenticated;
