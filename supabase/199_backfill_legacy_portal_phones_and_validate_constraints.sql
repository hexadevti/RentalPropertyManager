-- Backfill legacy portal rows with missing phone and validate constraints.

-- 1) Try to recover portal user phones from booking requests by tenant/email.
update public.portal_users pu
set
  phone = src.guest_phone,
  updated_at = timezone('utc', now())
from (
  select distinct on (br.tenant_id, lower(br.guest_email))
    br.tenant_id,
    lower(br.guest_email) as guest_email_key,
    btrim(br.guest_phone) as guest_phone
  from public.booking_requests br
  where length(btrim(coalesce(br.guest_phone, ''))) > 0
  order by br.tenant_id, lower(br.guest_email), br.created_at desc
) src
where pu.tenant_id = src.tenant_id
  and lower(pu.email) = src.guest_email_key
  and length(btrim(coalesce(pu.phone, ''))) = 0;

-- 2) Try to recover booking request phones from linked portal users.
update public.booking_requests br
set
  guest_phone = btrim(pu.phone),
  updated_at = timezone('utc', now())
from public.portal_users pu
where br.portal_user_id = pu.id
  and br.tenant_id = pu.tenant_id
  and length(btrim(coalesce(br.guest_phone, ''))) = 0
  and length(btrim(coalesce(pu.phone, ''))) > 0;

-- 3) Fallback for remaining legacy rows with no reliable source.
update public.portal_users
set
  phone = 'LEGACY-PHONE-REQUIRED',
  updated_at = timezone('utc', now())
where length(btrim(coalesce(phone, ''))) = 0;

update public.booking_requests
set
  guest_phone = 'LEGACY-PHONE-REQUIRED',
  updated_at = timezone('utc', now())
where length(btrim(coalesce(guest_phone, ''))) = 0;

-- 4) Validate constraints after cleanup.
alter table public.portal_users validate constraint portal_users_phone_required;
alter table public.booking_requests validate constraint booking_requests_guest_phone_required;
