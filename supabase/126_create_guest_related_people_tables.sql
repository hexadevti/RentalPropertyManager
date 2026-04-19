create table if not exists public.guest_sponsors (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  guest_id text not null,
  name text not null,
  email text not null default '',
  phone text not null default '',
  documents jsonb not null default '[]'::jsonb,
  address text,
  nationality text,
  marital_status text,
  profession text,
  date_of_birth text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, id),
  constraint guest_sponsors_guest_fkey
    foreign key (tenant_id, guest_id) references public.guests(tenant_id, id) on delete cascade,
  constraint guest_sponsors_documents_is_array check (jsonb_typeof(documents) = 'array')
);

create table if not exists public.guest_dependents (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  guest_id text not null,
  name text not null,
  email text not null default '',
  phone text not null default '',
  documents jsonb not null default '[]'::jsonb,
  address text,
  nationality text,
  marital_status text,
  profession text,
  date_of_birth text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, id),
  constraint guest_dependents_guest_fkey
    foreign key (tenant_id, guest_id) references public.guests(tenant_id, id) on delete cascade,
  constraint guest_dependents_documents_is_array check (jsonb_typeof(documents) = 'array')
);

create index if not exists idx_guest_sponsors_tenant_id on public.guest_sponsors(tenant_id);
create index if not exists idx_guest_sponsors_guest_id on public.guest_sponsors(tenant_id, guest_id);
create index if not exists idx_guest_dependents_tenant_id on public.guest_dependents(tenant_id);
create index if not exists idx_guest_dependents_guest_id on public.guest_dependents(tenant_id, guest_id);

drop trigger if exists guest_sponsors_set_updated_at on public.guest_sponsors;
create trigger guest_sponsors_set_updated_at
before update on public.guest_sponsors
for each row execute function public.set_updated_at();

drop trigger if exists guest_dependents_set_updated_at on public.guest_dependents;
create trigger guest_dependents_set_updated_at
before update on public.guest_dependents
for each row execute function public.set_updated_at();

alter table public.guest_sponsors enable row level security;
alter table public.guest_dependents enable row level security;

drop policy if exists guest_sponsors_all on public.guest_sponsors;
create policy guest_sponsors_all on public.guest_sponsors
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists guest_dependents_all on public.guest_dependents;
create policy guest_dependents_all on public.guest_dependents
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());