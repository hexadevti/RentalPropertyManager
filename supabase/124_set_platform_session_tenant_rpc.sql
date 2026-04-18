-- Robust API for platform admin tenant switching in session context.
-- SECURITY DEFINER avoids RLS/policy edge cases on platform_admin_session_tenants.

create or replace function public.set_platform_session_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tenant_id is null then
    raise exception 'Tenant id is required' using errcode = '22004';
  end if;

  if not public.is_current_user_platform_admin() then
    raise exception 'Only platform admins can change session tenant.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'Target tenant does not exist.' using errcode = '23503';
  end if;

  insert into public.platform_admin_session_tenants (auth_user_id, tenant_id, updated_at)
  values (auth.uid(), p_tenant_id, timezone('utc', now()))
  on conflict (auth_user_id)
  do update set
    tenant_id = excluded.tenant_id,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.set_platform_session_tenant(uuid) from public;
grant execute on function public.set_platform_session_tenant(uuid) to authenticated;
