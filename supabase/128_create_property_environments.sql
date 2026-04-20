create table if not exists public.property_environments (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id text not null,
  environment_order integer not null,
  environment_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, property_id, environment_order),
  constraint property_environments_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade,
  constraint property_environments_order_positive check (environment_order > 0)
);

create index if not exists idx_property_environments_tenant_id
  on public.property_environments(tenant_id);

create index if not exists idx_property_environments_property_id
  on public.property_environments(tenant_id, property_id);

alter table public.property_environments enable row level security;

drop policy if exists property_environments_all on public.property_environments;
create policy property_environments_all on public.property_environments
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());
