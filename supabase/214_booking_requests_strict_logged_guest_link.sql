-- Migration 214: enforce logged-guest linkage for portal booking requests list/cancel.

alter table public.booking_requests
  add column if not exists guest_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_requests_guest_id_fkey'
      and conrelid = 'public.booking_requests'::regclass
  ) then
    alter table public.booking_requests
      add constraint booking_requests_guest_id_fkey
      foreign key (tenant_id, guest_id)
      references public.guests(tenant_id, id)
      on delete set null;
  end if;
end;
$$;

-- Backfill guest_id for legacy rows by tenant + guest_email.
update public.booking_requests br
set guest_id = src.guest_id
from (
  select distinct on (g.tenant_id, lower(g.email))
    g.tenant_id,
    lower(g.email) as email_key,
    g.id as guest_id
  from public.guests g
  order by g.tenant_id, lower(g.email), g.created_at asc
) src
where br.tenant_id = src.tenant_id
  and lower(br.guest_email) = src.email_key
  and br.guest_id is null;

create index if not exists idx_booking_requests_tenant_guest_id_created
  on public.booking_requests(tenant_id, guest_id, created_at desc);

-- Strict lookup: only requests linked to the logged guest id.
create or replace function public.fetch_logged_guest_bookings(
  p_tenant_id uuid,
  p_guest_id text
)
returns table (
  id                       uuid,
  property_id              uuid,
  property_name            text,
  cover_file_path          text,
  guest_name               text,
  request_type             text,
  check_in                 date,
  check_out                date,
  estimated_move_in        date,
  desired_months           int,
  broker_contact_requested boolean,
  guests_count             int,
  notes                    text,
  status                   text,
  admin_notes              text,
  created_at               timestamptz,
  updated_at               timestamptz
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
    and br.guest_id = p_guest_id
  order by br.created_at desc;
$$;

-- Strict cancel: only the logged guest can cancel own pending request.
create or replace function public.cancel_booking_for_logged_guest(
  p_tenant_id uuid,
  p_guest_id text,
  p_booking_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select br.status::text
  into v_status
  from public.booking_requests br
  where br.id = p_booking_id
    and br.tenant_id = p_tenant_id
    and br.guest_id = p_guest_id;

  if not found then
    return false;
  end if;

  if v_status <> 'pending' then
    return false;
  end if;

  update public.booking_requests
  set status = 'cancelled',
      updated_at = timezone('utc', now())
  where id = p_booking_id
    and tenant_id = p_tenant_id
    and guest_id = p_guest_id;

  return true;
end;
$$;

grant execute on function public.fetch_logged_guest_bookings(uuid, text) to anon, authenticated;
grant execute on function public.cancel_booking_for_logged_guest(uuid, text, uuid) to anon, authenticated;
