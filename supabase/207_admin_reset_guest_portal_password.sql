-- Migration 207: allow admin to reset portal password for a specific guest

create or replace function public.portal_admin_reset_guest_password(
  p_tenant_id uuid,
  p_guest_id text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer;
begin
  if p_tenant_id is null or p_guest_id is null then
    return false;
  end if;

  if p_tenant_id <> public.get_current_user_tenant_id() then
    return false;
  end if;

  if length(coalesce(p_new_password, '')) < 8 then
    raise exception 'A senha deve ter pelo menos 8 caracteres';
  end if;
  if coalesce(p_new_password, '') !~ '[A-Za-z]' or coalesce(p_new_password, '') !~ '[0-9]' then
    raise exception 'A senha deve conter pelo menos uma letra e um numero';
  end if;

  update public.guests g
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf'))
  where g.tenant_id = p_tenant_id
    and g.id = p_guest_id;

  get diagnostics v_updated_count = row_count;
  return v_updated_count > 0;
end;
$$;

grant execute on function public.portal_admin_reset_guest_password(uuid, text, text) to authenticated;
