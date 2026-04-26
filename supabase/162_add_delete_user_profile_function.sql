create or replace function public.delete_user_profile(
  p_profile_id uuid,
  p_tenant_id  uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_auth_id  uuid;
  v_caller_role     text;
  v_target_auth_id  uuid;
begin
  -- who is calling?
  v_caller_auth_id := auth.uid();
  if v_caller_auth_id is null then
    return jsonb_build_object('error', 'Unauthorized');
  end if;

  -- check caller is admin of this tenant
  if not public.is_current_user_platform_admin() then
    select role into v_caller_role
    from public.user_profiles
    where tenant_id     = p_tenant_id
      and auth_user_id  = v_caller_auth_id;

    if v_caller_role is distinct from 'admin' then
      return jsonb_build_object('error', 'Forbidden');
    end if;
  end if;

  -- fetch target profile
  select auth_user_id into v_target_auth_id
  from public.user_profiles
  where id        = p_profile_id
    and tenant_id = p_tenant_id;

  if not found then
    return jsonb_build_object('error', 'User profile not found');
  end if;

  -- prevent self-deletion
  if v_target_auth_id = v_caller_auth_id then
    return jsonb_build_object('error', 'Cannot delete your own account');
  end if;

  -- delete the profile row
  delete from public.user_profiles
  where id        = p_profile_id
    and tenant_id = p_tenant_id;

  -- delete from auth.users if the profile had an auth user
  if v_target_auth_id is not null then
    delete from auth.users where id = v_target_auth_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'deletedAuthUser', v_target_auth_id is not null
  );
end;
$$;

revoke all on function public.delete_user_profile(uuid, uuid) from public;
grant execute on function public.delete_user_profile(uuid, uuid) to authenticated;
