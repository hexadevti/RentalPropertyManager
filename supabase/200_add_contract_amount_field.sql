-- Add persisted contract amount field.
-- For short-term contracts, backfill from days * daily property rate.

alter table public.contracts
  add column if not exists contract_amount numeric(12,2);

-- Backfill non short-term with monthly amount when missing.
update public.contracts
set contract_amount = coalesce(monthly_amount, 0)
where contract_amount is null
  and rental_type <> 'short-term';

-- Backfill short-term contracts from reservation days and linked properties daily rate.
with short_term_amounts as (
  select
    c.tenant_id,
    c.id,
    greatest((c.end_date::date - c.start_date::date), 0)::numeric as nights,
    coalesce(sum(p.price_per_night), 0)::numeric as daily_rate
  from public.contracts c
  left join public.contract_properties cp
    on cp.tenant_id = c.tenant_id
   and cp.contract_id = c.id
  left join public.properties p
    on p.tenant_id = cp.tenant_id
   and p.id = cp.property_id
  where c.rental_type = 'short-term'
  group by c.tenant_id, c.id, c.start_date, c.end_date
)
update public.contracts c
set contract_amount = sta.nights * sta.daily_rate
from short_term_amounts sta
where c.tenant_id = sta.tenant_id
  and c.id = sta.id
  and c.contract_amount is null;

update public.contracts
set contract_amount = 0
where contract_amount is null;

alter table public.contracts
  alter column contract_amount set default 0,
  alter column contract_amount set not null;

-- Keep transactional approval RPC aligned with the new field.
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
  v_daily_rate numeric(12,2);
  v_nights integer;
  v_contract_amount numeric(12,2);
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

  select c.id
  into v_existing_contract_id
  from public.contracts c
  where c.booking_request_id = v_booking.id
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

    select coalesce(p.price_per_night, 0)
    into v_daily_rate
    from public.properties p
    where p.tenant_id = v_booking.tenant_id
      and p.id = v_booking.property_id
    limit 1;

    v_nights := greatest((v_booking.check_out - v_booking.check_in), 0);
    v_contract_amount := coalesce(v_daily_rate, 0) * v_nights;

    insert into public.contracts (
      tenant_id,
      id,
      guest_id,
      booking_request_id,
      rental_type,
      start_date,
      end_date,
      payment_due_day,
      monthly_amount,
      contract_amount,
      status,
      notes,
      created_at
    )
    values (
      v_booking.tenant_id,
      v_new_contract_id,
      v_guest_id,
      v_booking.id,
      'short-term',
      v_booking.check_in::text,
      v_booking.check_out::text,
      1,
      0,
      v_contract_amount,
      case
        when current_date between v_booking.check_in and v_booking.check_out then 'active'
        else 'expired'
      end,
      v_booking.notes,
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
