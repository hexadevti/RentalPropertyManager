-- Fix recursion/stack overflow in user_profiles RLS policies.
-- The policy helper reads from user_profiles itself, so it must run as
-- SECURITY DEFINER to avoid recursive RLS evaluation.

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
