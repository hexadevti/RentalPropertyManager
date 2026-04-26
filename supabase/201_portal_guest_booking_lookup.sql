-- Migration 201: RPCs for unauthenticated guest booking lookup and self-cancellation
-- Guests who booked without an account can look up and cancel their pending bookings by email.

-- ─── 1. Fetch guest bookings by email ────────────────────────────────────────

create or replace function public.fetch_guest_bookings(
  p_tenant_id uuid,
  p_guest_email text
)
returns table (
  id            uuid,
  property_id   uuid,
  property_name text,
  guest_name    text,
  check_in      date,
  check_out     date,
  guests_count  int,
  notes         text,
  status        text,
  admin_notes   text,
  created_at    timestamptz,
  updated_at    timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    br.id::uuid,
    br.property_id::uuid,
    p.name::text as property_name,
    br.guest_name::text,
    br.check_in::date,
    br.check_out::date,
    br.guests_count::int,
    br.notes::text,
    br.status::text,
    br.admin_notes::text,
    br.created_at::timestamptz,
    br.updated_at::timestamptz
  from public.booking_requests br
  left join public.properties p on p.id = br.property_id
  where br.tenant_id = p_tenant_id
    and lower(trim(br.guest_email)) = lower(trim(p_guest_email))
  order by br.created_at desc;
$$;

-- ─── 2. Cancel a pending booking by email ────────────────────────────────────

create or replace function public.cancel_booking_by_email(
  p_booking_id  uuid,
  p_guest_email text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status::text
  into   v_status
  from   public.booking_requests
  where  id = p_booking_id
    and  lower(trim(guest_email)) = lower(trim(p_guest_email));

  if not found then
    return false;
  end if;

  -- Only allow cancelling pending bookings
  if v_status != 'pending' then
    return false;
  end if;

  update public.booking_requests
  set    status     = 'cancelled',
         updated_at = now()
  where  id = p_booking_id
    and  lower(trim(guest_email)) = lower(trim(p_guest_email));

  return true;
end;
$$;

-- ─── 3. Grant execute to anon + authenticated ─────────────────────────────────

grant execute on function public.fetch_guest_bookings(uuid, text)   to anon, authenticated;
grant execute on function public.cancel_booking_by_email(uuid, text) to anon, authenticated;
