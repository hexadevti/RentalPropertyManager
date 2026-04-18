-- Fix two related bugs:
--
-- Bug 1: Pre-invited users (auth_user_id IS NULL) cannot find their own profile
--        on first login because the SELECT RLS policy does not allow pending/unauthenticated
--        users to see profiles where auth_user_id IS NULL. They fall through to "New user"
--        and create a separate tenant instead of joining the invited one.
--
-- Bug 2: recoverTenantAdminAccess frontend logic uses the caller's RLS context,
--        which hides other tenant members from pending users. This causes every pending
--        user to auto-promote themselves to admin even when another admin already exists.
--
-- Fix 1: Extend the user_profiles SELECT policy to allow seeing own pre-invited profile.
-- Fix 2: Provide a SECURITY DEFINER RPC that bypasses RLS for the bootstrap check.

-- ============================================================
-- Fix 1: Allow pre-invited users to find their own profile
-- ============================================================

drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or tenant_id = public.get_current_user_tenant_id()
    or (auth_user_id is null and lower(email) = lower(public.get_current_user_email()))
    or public.is_current_user_platform_admin()
  );

-- ============================================================
-- Fix 2: Atomic server-side tenant admin bootstrap
-- ============================================================

-- This function is called on first login to promote the very first user in a tenant
-- to admin/approved when no approved admin exists yet.
-- SECURITY DEFINER bypasses RLS so we see the real tenant state.
-- pg_advisory_xact_lock prevents two simultaneous logins from both getting promoted.

create or replace function public.bootstrap_tenant_admin(p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_auth_user_id uuid;
  v_approved_count integer;
begin
  -- Resolve profile ownership
  select tenant_id, auth_user_id
  into v_tenant_id, v_auth_user_id
  from public.user_profiles
  where id = p_profile_id;

  if v_tenant_id is null then
    return false;
  end if;

  -- Caller must own this profile
  if v_auth_user_id is distinct from auth.uid() then
    return false;
  end if;

  -- Advisory lock scoped to this tenant prevents concurrent bootstraps
  perform pg_advisory_xact_lock(
    ('x' || left(md5(v_tenant_id::text), 16))::bit(64)::bigint
  );

  -- Re-check (inside lock) whether an approved admin already exists
  select count(*)
  into v_approved_count
  from public.user_profiles
  where tenant_id = v_tenant_id
    and role = 'admin'
    and status = 'approved';

  if v_approved_count > 0 then
    -- Another admin exists; do NOT auto-promote
    return false;
  end if;

  -- No approved admin exists yet — promote this user
  update public.user_profiles
  set role = 'admin',
      status = 'approved',
      updated_at = timezone('utc', now())
  where id = p_profile_id
    and auth_user_id = auth.uid();

  return true;
end;
$$;

revoke all on function public.bootstrap_tenant_admin(uuid) from public;
grant execute on function public.bootstrap_tenant_admin(uuid) to authenticated;
