-- Fix RLS permission error: avoid direct auth.users access inside user_profiles policy.

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
