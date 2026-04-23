create or replace function public.delete_tenant(
  p_tenant_id uuid,
  p_confirmation_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_auth_id uuid;
  v_target_exists boolean;
  v_target_name text;
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

  select
    exists(select 1 from public.tenants where id = p_tenant_id),
    (select name from public.tenants where id = p_tenant_id)
  into v_target_exists, v_target_name;

  if not v_target_exists then
    return jsonb_build_object('error', 'Tenant not found');
  end if;

  if trim(coalesce(p_confirmation_name, '')) <> trim(coalesce(v_target_name, '')) then
    return jsonb_build_object('error', 'Tenant name confirmation does not match');
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

revoke all on function public.delete_tenant(uuid, text) from public;
grant execute on function public.delete_tenant(uuid, text) to authenticated;
