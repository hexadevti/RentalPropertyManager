-- Strengthen idempotency for portal booking approvals:
-- store the originating booking request id on contracts with uniqueness.

alter table public.contracts
  add column if not exists booking_request_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contracts_booking_request_fkey'
      and conrelid = 'public.contracts'::regclass
  ) then
    alter table public.contracts
      add constraint contracts_booking_request_fkey
      foreign key (booking_request_id)
      references public.booking_requests(id)
      on delete set null;
  end if;
end;
$$;

create unique index if not exists contracts_booking_request_id_uidx
  on public.contracts (booking_request_id)
  where booking_request_id is not null;

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
