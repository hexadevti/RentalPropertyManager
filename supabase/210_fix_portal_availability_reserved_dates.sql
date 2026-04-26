-- Fix portal availability to block already reserved dates reliably.
-- Root causes addressed:
-- 1) Availability checking only active contracts misses future contracts marked incorrectly.
-- 2) Portal approval RPC could mark future contracts as expired.

create or replace function public.check_portal_property_availability(
  p_tenant_id uuid,
  p_property_id text,
  p_check_in date,
  p_check_out date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Tenant must have portal enabled
    exists (
      select 1
      from public.tenants t
      where t.id = p_tenant_id
        and t.portal_enabled = true
    )
    -- Basic date guard
    and p_check_out > p_check_in
    -- No overlapping non-cancelled contract for this property
    and not exists (
      select 1
      from public.contract_properties cp
      join public.contracts c
        on c.tenant_id = cp.tenant_id
       and c.id = cp.contract_id
      where cp.tenant_id = p_tenant_id
        and cp.property_id = p_property_id
        and c.status <> 'cancelled'
        and c.start_date::date <= p_check_out
        and c.end_date::date >= p_check_in
    )
    -- No overlapping approved booking request for this property
    and not exists (
      select 1
      from public.booking_requests br
      where br.tenant_id = p_tenant_id
        and br.property_id = p_property_id
        and br.status = 'approved'
        and br.check_in <= p_check_out
        and br.check_out >= p_check_in
    );
$$;

grant execute on function public.check_portal_property_availability(uuid, text, date, date)
  to anon, authenticated;

create or replace function public.approve_booking_request_and_create_contract(
  p_booking_request_id uuid,
  p_admin_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.booking_requests%rowtype;
  v_current_tenant_id uuid;
  v_guest_id text;
  v_existing_contract_id text;
  v_new_contract_id text;
  v_marker text;
  v_contract_notes text;
begin
  v_current_tenant_id := public.get_current_user_tenant_id();
  if v_current_tenant_id is null then
    raise exception 'Tenant context not found for current user.';
  end if;

  select *
  into v_booking
  from public.booking_requests
  where id = p_booking_request_id
  for update;

  if not found then
    raise exception 'Booking request not found.';
  end if;

  if v_booking.tenant_id <> v_current_tenant_id then
    raise exception 'You can only approve booking requests from the active tenant.';
  end if;

  if v_booking.status in ('rejected', 'cancelled') then
    raise exception 'Cannot approve a booking request in status %.', v_booking.status;
  end if;

  v_marker := format('portal-booking-request:%s', v_booking.id);

  select c.id
  into v_existing_contract_id
  from public.contracts c
  where c.tenant_id = v_booking.tenant_id
    and c.notes ilike ('%' || v_marker || '%')
  limit 1;

  if v_existing_contract_id is null then
    select g.id
    into v_guest_id
    from public.guests g
    where g.tenant_id = v_booking.tenant_id
      and lower(g.email) = lower(v_booking.guest_email)
    order by g.created_at asc
    limit 1;

    if v_guest_id is null then
      v_guest_id := 'portal-guest-' || gen_random_uuid()::text;

      insert into public.guests (
        tenant_id,
        id,
        name,
        email,
        phone,
        document,
        created_at
      )
      values (
        v_booking.tenant_id,
        v_guest_id,
        v_booking.guest_name,
        v_booking.guest_email,
        coalesce(v_booking.guest_phone, ''),
        '[]',
        timezone('utc', now())
      );
    end if;

    v_new_contract_id := 'portal-' || gen_random_uuid()::text;
    v_contract_notes := case
      when coalesce(btrim(v_booking.notes), '') = '' then '[' || v_marker || ']'
      else btrim(v_booking.notes) || E'\n\n[' || v_marker || ']'
    end;

    insert into public.contracts (
      tenant_id,
      id,
      guest_id,
      rental_type,
      start_date,
      end_date,
      payment_due_day,
      monthly_amount,
      status,
      notes,
      created_at
    )
    values (
      v_booking.tenant_id,
      v_new_contract_id,
      v_guest_id,
      'short-term',
      v_booking.check_in::text,
      v_booking.check_out::text,
      1,
      0,
      case
        when v_booking.check_out < current_date then 'expired'
        else 'active'
      end,
      v_contract_notes,
      timezone('utc', now())
    );

    insert into public.contract_properties (
      tenant_id,
      contract_id,
      property_id
    )
    values (
      v_booking.tenant_id,
      v_new_contract_id,
      v_booking.property_id
    )
    on conflict (tenant_id, contract_id, property_id) do nothing;
  end if;

  update public.booking_requests
  set
    status = 'approved',
    admin_notes = p_admin_notes,
    updated_at = timezone('utc', now())
  where id = v_booking.id;

  return true;
end;
$$;

grant execute on function public.approve_booking_request_and_create_contract(uuid, text)
to authenticated;

-- Backfill: future/current portal-created contracts that were incorrectly marked as expired.
update public.contracts c
set status = 'active'
where c.status = 'expired'
  and c.end_date::date >= current_date
  and c.notes ilike '%portal-booking-request:%';
