-- Enforce that only platform admins can move a user profile across tenants.
-- Applies regardless of frontend checks.

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

drop trigger if exists trg_user_profiles_restrict_tenant_move on public.user_profiles;
create trigger trg_user_profiles_restrict_tenant_move
before update on public.user_profiles
for each row
execute function public.enforce_platform_admin_for_tenant_move();
