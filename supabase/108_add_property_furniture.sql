create table if not exists public.property_furniture (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  property_id text not null,
  item_order integer not null,
  item_name text not null,
  primary key (auth_user_id, property_id, item_order),
  foreign key (auth_user_id, property_id) references public.properties(auth_user_id, id) on delete cascade,
  constraint property_furniture_item_order_positive check (item_order > 0)
);

create index if not exists idx_property_furniture_auth_user_id on public.property_furniture(auth_user_id);

alter table public.property_furniture enable row level security;

drop policy if exists property_furniture_all on public.property_furniture;
create policy property_furniture_all on public.property_furniture
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());
