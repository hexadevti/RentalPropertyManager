-- Approves a portal booking request and creates guest + contract atomically.
-- This prevents partial state when one of the writes fails.

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
        when current_date between v_booking.check_in and v_booking.check_out then 'active'
        else 'expired'
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
