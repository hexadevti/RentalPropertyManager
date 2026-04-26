-- Migration 202: include property cover file path in guest booking lookup

drop function if exists public.fetch_guest_bookings(uuid, text);

create or replace function public.fetch_guest_bookings(
  p_tenant_id uuid,
  p_guest_email text
)
returns table (
  id              uuid,
  property_id     uuid,
  property_name   text,
  cover_file_path text,
  guest_name      text,
  check_in        date,
  check_out       date,
  guests_count    int,
  notes           text,
  status          text,
  admin_notes     text,
  created_at      timestamptz,
  updated_at      timestamptz
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
