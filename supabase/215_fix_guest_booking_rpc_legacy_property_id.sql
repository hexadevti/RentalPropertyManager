-- Migration 215: fix guest booking RPCs for legacy non-UUID property_id values.
-- Some historical rows use text IDs; UUID casts break listing for logged guests.

drop function if exists public.fetch_logged_guest_bookings(uuid, text);

create or replace function public.fetch_logged_guest_bookings(
  p_tenant_id uuid,
  p_guest_id text
)
returns table (
  id                       uuid,
  property_id              text,
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
    br.id,
    br.property_id,
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
  left join public.properties p
    on p.tenant_id = br.tenant_id
   and p.id = br.property_id
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

drop function if exists public.fetch_guest_bookings(uuid, text);
drop function if exists public.fetch_guest_bookings(uuid, text, text);

create or replace function public.fetch_guest_bookings(
  p_tenant_id uuid,
  p_guest_email text,
  p_guest_phone text default null
)
returns table (
  id                       uuid,
  property_id              text,
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
  with normalized_input as (
    select
      lower(trim(coalesce(p_guest_email, ''))) as email_key,
      trim(coalesce(p_guest_phone, '')) as phone_key
  )
  select
    br.id,
    br.property_id,
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
  left join public.properties p
    on p.tenant_id = br.tenant_id
   and p.id = br.property_id
  left join lateral (
    select pp.file_path
    from public.property_photos pp
    where pp.tenant_id = br.tenant_id
      and pp.property_id = br.property_id
    order by pp.is_cover desc, pp.sort_order asc, pp.id asc
    limit 1
  ) photo on true
  cross join normalized_input ni
  where br.tenant_id = p_tenant_id
    and (
      lower(trim(br.guest_email)) = ni.email_key
      or (
        ni.phone_key <> ''
        and trim(coalesce(br.guest_phone, '')) = ni.phone_key
      )
    )
  order by br.created_at desc;
$$;

create or replace function public.fetch_guest_bookings(
  p_tenant_id uuid,
  p_guest_email text
)
returns table (
  id                       uuid,
  property_id              text,
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
  select *
  from public.fetch_guest_bookings(p_tenant_id, p_guest_email, null);
$$;

grant execute on function public.fetch_logged_guest_bookings(uuid, text) to anon, authenticated;
grant execute on function public.fetch_guest_bookings(uuid, text) to anon, authenticated;
grant execute on function public.fetch_guest_bookings(uuid, text, text) to anon, authenticated;
