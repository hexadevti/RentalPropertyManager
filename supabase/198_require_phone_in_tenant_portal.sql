-- Require phone in tenant portal registration and booking requests.
-- Added as NOT VALID to avoid breaking legacy rows while enforcing new writes.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'portal_users_phone_required'
      and conrelid = 'public.portal_users'::regclass
  ) then
    alter table public.portal_users
      add constraint portal_users_phone_required
      check (length(btrim(coalesce(phone, ''))) > 0)
      not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_requests_guest_phone_required'
      and conrelid = 'public.booking_requests'::regclass
  ) then
    alter table public.booking_requests
      add constraint booking_requests_guest_phone_required
      check (length(btrim(coalesce(guest_phone, ''))) > 0)
      not valid;
  end if;
end;
$$;
