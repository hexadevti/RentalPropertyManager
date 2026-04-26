-- Migration 211: support monthly rental requests in portal booking requests

alter table public.booking_requests
  add column if not exists request_type text,
  add column if not exists estimated_move_in date,
  add column if not exists desired_months integer,
  add column if not exists broker_contact_requested boolean not null default false;

update public.booking_requests
set request_type = 'short-term'
where request_type is null;

alter table public.booking_requests
  alter column request_type set default 'short-term',
  alter column request_type set not null;

alter table public.booking_requests
  drop constraint if exists booking_requests_request_type_check;

alter table public.booking_requests
  add constraint booking_requests_request_type_check
  check (request_type in ('short-term', 'monthly'));

alter table public.booking_requests
  alter column check_in drop not null,
  alter column check_out drop not null;

alter table public.booking_requests
  drop constraint if exists booking_requests_dates_check;

alter table public.booking_requests
  add constraint booking_requests_dates_check
  check (
    (
      request_type = 'short-term'
      and check_in is not null
      and check_out is not null
      and check_out > check_in
    )
    or (
      request_type = 'monthly'
      and estimated_move_in is not null
    )
  );

alter table public.booking_requests
  drop constraint if exists booking_requests_desired_months_positive;

alter table public.booking_requests
  add constraint booking_requests_desired_months_positive
  check (desired_months is null or desired_months > 0);

create index if not exists idx_booking_requests_tenant_request_type_status
  on public.booking_requests(tenant_id, request_type, status, created_at desc);

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

  -- Monthly requests are approved as lead follow-up, without auto contract generation.
  if v_booking.request_type = 'monthly' then
    update public.booking_requests
    set
      status = 'approved',
      admin_notes = p_admin_notes,
      updated_at = timezone('utc', now())
    where id = v_booking.id;

    return true;
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

drop function if exists public.fetch_guest_bookings(uuid, text);

create or replace function public.fetch_guest_bookings(
  p_tenant_id uuid,
  p_guest_email text
)
returns table (
  id                      uuid,
  property_id             uuid,
  property_name           text,
  cover_file_path         text,
  guest_name              text,
  request_type            text,
  check_in                date,
  check_out               date,
  estimated_move_in       date,
  desired_months          int,
  broker_contact_requested boolean,
  guests_count            int,
  notes                   text,
  status                  text,
  admin_notes             text,
  created_at              timestamptz,
  updated_at              timestamptz
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
    photo.file_path::text as cover_file_path,
    br.guest_name::text,
    br.request_type::text,
    br.check_in::date,
    br.check_out::date,
    br.estimated_move_in::date,
    br.desired_months::int,
    br.broker_contact_requested::boolean,
    br.guests_count::int,
    br.notes::text,
    br.status::text,
    br.admin_notes::text,
    br.created_at::timestamptz,
    br.updated_at::timestamptz
  from public.booking_requests br
  left join public.properties p on p.id = br.property_id
  left join lateral (
    select pp.file_path
    from public.property_photos pp
    where pp.tenant_id = br.tenant_id
      and pp.property_id = br.property_id
    order by pp.is_cover desc, pp.sort_order asc, pp.id asc
    limit 1
  ) photo on true
  where br.tenant_id = p_tenant_id
    and lower(trim(br.guest_email)) = lower(trim(p_guest_email))
  order by br.created_at desc;
$$;

grant execute on function public.fetch_guest_bookings(uuid, text) to anon, authenticated;
