-- Prevent moving the currently authenticated user's own profile to another tenant.
-- Keeps session consistent and avoids self-lockout/zombie states.

create or replace function public.enforce_platform_admin_for_tenant_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.tenant_id is distinct from new.tenant_id then
    if old.auth_user_id = auth.uid() then
      raise exception 'You cannot move your own user to another tenant.'
        using errcode = '42501';
    end if;

    if not public.is_current_user_platform_admin() then
      raise exception 'Only platform admins can move users between tenants.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
