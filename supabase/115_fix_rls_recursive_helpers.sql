-- Fix recursive RLS evaluation on user_profiles helper functions.
-- Symptoms: stack depth limit exceeded (code 54001) on user_profiles/tenants queries.

create or replace function public.get_current_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.user_profiles
  where auth_user_id = auth.uid()
    and status = 'approved'
  limit 1;
$$;

revoke all on function public.get_current_user_tenant_id() from public;
grant execute on function public.get_current_user_tenant_id() to authenticated;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where auth_user_id = auth.uid()
      and role = 'admin'
      and status = 'approved'
  );
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;
