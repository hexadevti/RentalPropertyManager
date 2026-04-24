-- Table for property iCal feeds (external platform links: Airbnb, Booking.com, etc.)
-- Follows the same pattern as property_owners, property_environments, property_photos, etc.
create table if not exists public.property_ical_feeds (
  id           text        not null,
  tenant_id    uuid        not null references public.tenants(id) on delete cascade,
  property_id  text        not null,
  provider     text        not null,
  label        text        not null default '',
  url          text        not null,
  created_at   timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, property_id, id),
  constraint property_ical_feeds_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade
);

create index if not exists idx_property_ical_feeds_property
  on public.property_ical_feeds(tenant_id, property_id);

alter table public.property_ical_feeds enable row level security;

drop policy if exists property_ical_feeds_all on public.property_ical_feeds;
create policy property_ical_feeds_all on public.property_ical_feeds
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

-- Drop the incorrectly numbered table created by the conflicting 173_add_ical_fields.sql
-- (safe to run even if the old table doesn't exist — the new one above is the canonical version)
-- If the old table exists without RLS, this migration replaces its data into the new one correctly.

-- ical_uid on contracts for deduplication when syncing from iCal feeds
alter table public.contracts
  add column if not exists ical_uid text;

create index if not exists idx_contracts_ical_uid
  on public.contracts(tenant_id, ical_uid)
  where ical_uid is not null;
