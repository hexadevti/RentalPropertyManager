-- ============================================================
-- 194_create_tenant_portal.sql
-- Public guest portal for professional+ tenants.
-- Features:
--   - slug column on tenants (URL-safe, unique)
--   - portal_enabled flag on tenants
--   - portal_users table (tenant-scoped guests, separate from admin user_profiles)
--   - booking_requests table
--   - Anon RLS for portal browsing + image access
--   - RPC for availability checking (SECURITY DEFINER)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Add slug and portal_enabled to tenants
-- ─────────────────────────────────────────────
alter table public.tenants
  add column if not exists slug text unique,
  add column if not exists portal_enabled boolean not null default false;

-- Helper: generate a URL-safe slug from a text string
create or replace function public.generate_slug_from_text(input_text text)
returns text
language plpgsql
as $$
declare
  slug text;
begin
  slug := lower(input_text);
  slug := translate(slug,
    'àáâãäåçèéêëìíîïñòóôõöùúûüý',
    'aaaaaaceeeeiiinoooooouuuuy');
  slug := regexp_replace(slug, '[^a-z0-9]+', '-', 'g');
  slug := trim(both '-' from slug);
  return left(coalesce(nullif(slug, ''), 'tenant'), 60);
end;
$$;

-- Backfill slugs for existing tenants
do $$
declare
  rec record;
  base_slug text;
  candidate text;
  counter int;
begin
  for rec in
    select id, name from public.tenants where slug is null
  loop
    base_slug := public.generate_slug_from_text(rec.name);
    candidate := base_slug;
    counter := 0;
    while exists (select 1 from public.tenants where slug = candidate) loop
      counter := counter + 1;
      candidate := base_slug || '-' || counter;
    end loop;
    update public.tenants set slug = candidate where id = rec.id;
  end loop;
end;
$$;

alter table public.tenants
  alter column slug set not null;

-- ─────────────────────────────────────────────
-- 2. portal_users — tenant-scoped guest accounts
--    Separate from admin user_profiles
-- ─────────────────────────────────────────────
create table if not exists public.portal_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  status text not null default 'active' check (status in ('active', 'blocked')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(tenant_id, email)
);

drop trigger if exists portal_users_set_updated_at on public.portal_users;
create trigger portal_users_set_updated_at
  before update on public.portal_users
  for each row execute function public.set_updated_at();

alter table public.portal_users enable row level security;

-- Portal users can register on a portal-enabled tenant
drop policy if exists portal_users_insert on public.portal_users;
create policy portal_users_insert on public.portal_users
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.tenants t
      where t.id = portal_users.tenant_id
        and t.portal_enabled = true
    )
  );

-- Portal users can see their own record; tenant admins can see all for their tenant
drop policy if exists portal_users_select on public.portal_users;
create policy portal_users_select on public.portal_users
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or tenant_id = public.get_current_user_tenant_id()
  );

-- Portal users can update their own profile
drop policy if exists portal_users_update on public.portal_users;
create policy portal_users_update on public.portal_users
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Tenant admins can update portal user status (block/unblock)
drop policy if exists portal_users_admin_update on public.portal_users;
create policy portal_users_admin_update on public.portal_users
  for update to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

-- ─────────────────────────────────────────────
-- 3. booking_requests
-- ─────────────────────────────────────────────
create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id text not null,
  portal_user_id uuid references public.portal_users(id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  check_in date not null,
  check_out date not null,
  guests_count integer not null default 1 check (guests_count >= 1),
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  admin_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint booking_requests_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade,
  constraint booking_requests_dates_check check (check_out > check_in)
);

create index if not exists idx_booking_requests_tenant
  on public.booking_requests(tenant_id, status, created_at desc);

create index if not exists idx_booking_requests_property
  on public.booking_requests(tenant_id, property_id);

drop trigger if exists booking_requests_set_updated_at on public.booking_requests;
create trigger booking_requests_set_updated_at
  before update on public.booking_requests
  for each row execute function public.set_updated_at();

alter table public.booking_requests enable row level security;

-- Anyone can submit a booking request on a portal-enabled tenant
drop policy if exists booking_requests_insert on public.booking_requests;
create policy booking_requests_insert on public.booking_requests
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.tenants t
      where t.id = booking_requests.tenant_id
        and t.portal_enabled = true
    )
  );

-- Portal users see their own; tenant admins see all
drop policy if exists booking_requests_select on public.booking_requests;
create policy booking_requests_select on public.booking_requests
  for select to authenticated
  using (
    (
      portal_user_id is not null
      and exists (
        select 1 from public.portal_users pu
        where pu.id = booking_requests.portal_user_id
          and pu.auth_user_id = auth.uid()
      )
    )
    or tenant_id = public.get_current_user_tenant_id()
  );

-- Tenant admins can update status/admin_notes
drop policy if exists booking_requests_admin_update on public.booking_requests;
create policy booking_requests_admin_update on public.booking_requests
  for update to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

-- ─────────────────────────────────────────────
-- 4. Anon read access for portal browsing
-- ─────────────────────────────────────────────

-- Tenants: anon can read portal-enabled tenants (for slug lookup)
drop policy if exists tenants_anon_portal_select on public.tenants;
create policy tenants_anon_portal_select on public.tenants
  for select to anon
  using (portal_enabled = true);

-- Properties: anon can browse properties of portal-enabled tenants
drop policy if exists properties_anon_portal_select on public.properties;
create policy properties_anon_portal_select on public.properties
  for select to anon
  using (
    exists (
      select 1 from public.tenants t
      where t.id = properties.tenant_id
        and t.portal_enabled = true
    )
  );

-- Property photos: anon can view photos of portal-enabled tenants
drop policy if exists property_photos_anon_portal_select on public.property_photos;
create policy property_photos_anon_portal_select on public.property_photos
  for select to anon
  using (
    exists (
      select 1 from public.tenants t
      where t.id = property_photos.tenant_id
        and t.portal_enabled = true
    )
  );

-- Property furniture: anon can view for portal
drop policy if exists property_furniture_anon_portal_select on public.property_furniture;
create policy property_furniture_anon_portal_select on public.property_furniture
  for select to anon
  using (
    exists (
      select 1 from public.tenants t
      where t.id = property_furniture.tenant_id
        and t.portal_enabled = true
    )
  );

-- ─────────────────────────────────────────────
-- 5. Storage: anon read for portal property images
-- ─────────────────────────────────────────────
drop policy if exists portal_property_images_anon_read on storage.objects;
create policy portal_property_images_anon_read on storage.objects
  for select to anon
  using (
    bucket_id = 'property-images'
    and exists (
      select 1 from public.tenants t
      where t.id::text = (storage.foldername(name))[1]
        and t.portal_enabled = true
    )
  );

-- ─────────────────────────────────────────────
-- 6. RPC: check availability (SECURITY DEFINER to read contracts as anon)
-- ─────────────────────────────────────────────
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
    exists (select 1 from public.tenants t where t.id = p_tenant_id and t.portal_enabled = true)
    -- No overlapping active contract
    and not exists (
      select 1
      from public.contract_properties cp
      join public.contracts c on (c.tenant_id = cp.tenant_id and c.id = cp.contract_id)
      where cp.tenant_id = p_tenant_id
        and cp.property_id = p_property_id
        and c.status = 'active'
        and c.start_date::date <= p_check_out
        and c.end_date::date >= p_check_in
    )
    -- No overlapping approved booking request
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

-- ─────────────────────────────────────────────
-- 7. Add portal-bookings to usage_plans allowed roles
-- ─────────────────────────────────────────────
update public.usage_plans
set allowed_access_roles = array_append(allowed_access_roles, 'portal-bookings')
where code in ('professional', 'enterprise')
  and not ('portal-bookings' = any(allowed_access_roles));
