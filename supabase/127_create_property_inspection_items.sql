create table if not exists public.property_inspection_items (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id text not null,
  item_order integer not null,
  item_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, property_id, item_order),
  constraint property_inspection_items_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade,
  constraint property_inspection_items_item_order_positive check (item_order > 0)
);

create index if not exists idx_property_inspection_items_tenant_id
  on public.property_inspection_items(tenant_id);

create index if not exists idx_property_inspection_items_property_id
  on public.property_inspection_items(tenant_id, property_id);

alter table public.property_inspection_items enable row level security;

drop policy if exists property_inspection_items_all on public.property_inspection_items;
create policy property_inspection_items_all on public.property_inspection_items
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());
