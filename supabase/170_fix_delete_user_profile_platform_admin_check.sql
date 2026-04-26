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
  v_caller_auth_id uuid;
  v_caller_role text;
  v_target_auth_id uuid;
begin
  v_caller_auth_id := auth.uid();
  if v_caller_auth_id is null then
    return jsonb_build_object('error', 'Unauthorized');
  end if;

  if not public.is_current_user_platform_admin() then
    select role into v_caller_role
    from public.user_profiles
    where tenant_id = p_tenant_id
      and auth_user_id = v_caller_auth_id;

    if v_caller_role is distinct from 'admin' then
      return jsonb_build_object('error', 'Forbidden');
    end if;
  end if;

  select auth_user_id into v_target_auth_id
  from public.user_profiles
  where id = p_profile_id
    and tenant_id = p_tenant_id;

  if not found then
    return jsonb_build_object('error', 'User profile not found');
  end if;

  if v_target_auth_id = v_caller_auth_id then
    return jsonb_build_object('error', 'Cannot delete your own account');
  end if;

  delete from public.user_profiles
  where id = p_profile_id
    and tenant_id = p_tenant_id;

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

create or replace function public.delete_tenant(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_auth_id uuid;
  v_target_exists boolean;
  v_has_own_account boolean;
  v_auth_user_ids uuid[];
begin
  v_caller_auth_id := auth.uid();
  if v_caller_auth_id is null then
    return jsonb_build_object('error', 'Unauthorized');
  end if;

  if not public.is_current_user_platform_admin() then
    return jsonb_build_object('error', 'Forbidden');
  end if;

  select exists(
    select 1
    from public.tenants
    where id = p_tenant_id
  ) into v_target_exists;

  if not v_target_exists then
    return jsonb_build_object('error', 'Tenant not found');
  end if;

  select exists(
    select 1
    from public.user_profiles
    where tenant_id = p_tenant_id
      and auth_user_id = v_caller_auth_id
  ) into v_has_own_account;

  if v_has_own_account then
    return jsonb_build_object('error', 'Cannot delete a tenant that contains your own account');
  end if;

  select array_agg(auth_user_id)
  into v_auth_user_ids
  from public.user_profiles
  where tenant_id = p_tenant_id
    and auth_user_id is not null;

  if coalesce(array_length(v_auth_user_ids, 1), 0) > 0 then
    delete from auth.users
    where id = any(v_auth_user_ids);
  end if;

  delete from public.tenants
  where id = p_tenant_id;

  return jsonb_build_object(
    'success', true,
    'deletedAuthUsers', coalesce(array_length(v_auth_user_ids, 1), 0)
  );
end;
$$;

revoke all on function public.delete_tenant(uuid) from public;
grant execute on function public.delete_tenant(uuid) to authenticated;
