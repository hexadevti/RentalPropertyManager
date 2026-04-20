-- Inspection header: one record per vistoria, always linked to a property and a contract
create table if not exists public.inspections (
  id text not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id text not null,
  contract_id text not null,
  title text not null,
  type text not null check (type in ('check-in', 'check-out', 'maintenance', 'periodic')),
  status text not null default 'draft' check (status in ('draft', 'in-progress', 'completed')),
  inspector_name text not null,
  scheduled_date date not null,
  completed_date date,
  summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, id),
  constraint inspections_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete restrict
);

create index if not exists idx_inspections_tenant_id
  on public.inspections(tenant_id);

create index if not exists idx_inspections_property_id
  on public.inspections(tenant_id, property_id);

create index if not exists idx_inspections_contract_id
  on public.inspections(tenant_id, contract_id);

alter table public.inspections enable row level security;

drop policy if exists inspections_all on public.inspections;
create policy inspections_all on public.inspections
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

-- Inspection entries: one row per (environment, item) cell in the matrix
-- environment_order and item_order preserve the display sequence
create table if not exists public.inspection_entries (
  id text not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  inspection_id text not null,
  environment_name text not null,
  environment_order integer not null check (environment_order > 0),
  item_name text not null,
  item_order integer not null check (item_order > 0),
  condition text not null default 'good'
    check (condition in ('excellent', 'good', 'attention', 'damaged', 'na')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, inspection_id, environment_order, item_order),
  constraint inspection_entries_inspection_fkey
    foreign key (tenant_id, inspection_id) references public.inspections(tenant_id, id) on delete cascade
);

create index if not exists idx_inspection_entries_tenant_id
  on public.inspection_entries(tenant_id);

create index if not exists idx_inspection_entries_inspection_id
  on public.inspection_entries(tenant_id, inspection_id);

alter table public.inspection_entries enable row level security;

drop policy if exists inspection_entries_all on public.inspection_entries;
create policy inspection_entries_all on public.inspection_entries
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());
