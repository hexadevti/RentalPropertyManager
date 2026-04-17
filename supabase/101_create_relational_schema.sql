create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  github_login text not null unique,
  role text not null check (role in ('admin', 'guest')),
  status text not null check (status in ('pending', 'approved', 'rejected')),
  email text not null,
  avatar_url text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_profiles
    where auth_user_id = auth.uid()
      and role = 'admin'
      and status = 'approved'
  );
$$;

create table if not exists public.user_settings (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (auth_user_id, key)
);

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create table if not exists public.owners (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  email text not null,
  phone text not null,
  document text not null,
  address text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (auth_user_id, id)
);

create table if not exists public.properties (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  type text not null check (type in ('room', 'apartment', 'house')),
  capacity integer not null,
  price_per_night numeric(12,2) not null default 0,
  price_per_month numeric(12,2) not null default 0,
  status text not null check (status in ('available', 'occupied', 'maintenance')),
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (auth_user_id, id)
);

create table if not exists public.property_owners (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  property_id text not null,
  owner_id text not null,
  primary key (auth_user_id, property_id, owner_id),
  foreign key (auth_user_id, property_id) references public.properties(auth_user_id, id) on delete cascade,
  foreign key (auth_user_id, owner_id) references public.owners(auth_user_id, id) on delete cascade
);

create table if not exists public.guests (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  email text not null,
  phone text not null,
  document text not null,
  address text,
  nationality text,
  date_of_birth text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (auth_user_id, id)
);

create table if not exists public.contracts (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  guest_id text not null,
  rental_type text not null check (rental_type in ('short-term', 'monthly')),
  start_date text not null,
  end_date text not null,
  payment_due_day integer not null,
  monthly_amount numeric(12,2) not null default 0,
  status text not null check (status in ('active', 'expired', 'cancelled')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (auth_user_id, id),
  foreign key (auth_user_id, guest_id) references public.guests(auth_user_id, id) on delete cascade
);

create table if not exists public.contract_properties (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  contract_id text not null,
  property_id text not null,
  primary key (auth_user_id, contract_id, property_id),
  foreign key (auth_user_id, contract_id) references public.contracts(auth_user_id, id) on delete cascade,
  foreign key (auth_user_id, property_id) references public.properties(auth_user_id, id) on delete cascade
);

create table if not exists public.service_providers (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  service text not null,
  contact text not null,
  email text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (auth_user_id, id)
);

create table if not exists public.transactions (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null,
  category text not null,
  description text not null,
  date text not null,
  property_id text,
  contract_id text,
  service_provider_id text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (auth_user_id, id),
  foreign key (auth_user_id, property_id) references public.properties(auth_user_id, id) on delete cascade,
  foreign key (auth_user_id, contract_id) references public.contracts(auth_user_id, id) on delete cascade,
  foreign key (auth_user_id, service_provider_id) references public.service_providers(auth_user_id, id) on delete cascade
);

create table if not exists public.tasks (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  description text not null,
  due_date text not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  status text not null check (status in ('pending', 'in-progress', 'completed')),
  assignee text,
  property_id text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (auth_user_id, id),
  foreign key (auth_user_id, property_id) references public.properties(auth_user_id, id) on delete cascade
);

create table if not exists public.appointments (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  description text,
  date text not null,
  time text not null,
  status text not null check (status in ('scheduled', 'completed', 'cancelled')),
  service_provider_id text,
  contract_id text,
  guest_id text,
  property_id text,
  notes text,
  completion_notes text,
  completed_at text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (auth_user_id, id),
  foreign key (auth_user_id, service_provider_id) references public.service_providers(auth_user_id, id) on delete cascade,
  foreign key (auth_user_id, contract_id) references public.contracts(auth_user_id, id) on delete cascade,
  foreign key (auth_user_id, guest_id) references public.guests(auth_user_id, id) on delete cascade,
  foreign key (auth_user_id, property_id) references public.properties(auth_user_id, id) on delete cascade
);

create table if not exists public.contract_templates (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  type text not null check (type in ('monthly', 'short-term')),
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (auth_user_id, id)
);

drop trigger if exists contract_templates_set_updated_at on public.contract_templates;
create trigger contract_templates_set_updated_at
before update on public.contract_templates
for each row execute function public.set_updated_at();

create table if not exists public.documents (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  category text not null check (category in ('contract', 'receipt', 'insurance', 'tax', 'other')),
  notes text,
  property_id text,
  upload_date text not null,
  primary key (auth_user_id, id),
  foreign key (auth_user_id, property_id) references public.properties(auth_user_id, id) on delete cascade
);

create index if not exists idx_owners_auth_user_id on public.owners(auth_user_id);
create index if not exists idx_properties_auth_user_id on public.properties(auth_user_id);
create index if not exists idx_guests_auth_user_id on public.guests(auth_user_id);
create index if not exists idx_contracts_auth_user_id on public.contracts(auth_user_id);
create index if not exists idx_transactions_auth_user_id on public.transactions(auth_user_id);
create index if not exists idx_tasks_auth_user_id on public.tasks(auth_user_id);
create index if not exists idx_appointments_auth_user_id on public.appointments(auth_user_id);
create index if not exists idx_templates_auth_user_id on public.contract_templates(auth_user_id);
create index if not exists idx_documents_auth_user_id on public.documents(auth_user_id);

alter table public.user_profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.owners enable row level security;
alter table public.properties enable row level security;
alter table public.property_owners enable row level security;
alter table public.guests enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_properties enable row level security;
alter table public.service_providers enable row level security;
alter table public.transactions enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.contract_templates enable row level security;
alter table public.documents enable row level security;

drop policy if exists user_profiles_select on public.user_profiles;
drop policy if exists user_profiles_insert on public.user_profiles;
drop policy if exists user_profiles_update on public.user_profiles;
drop policy if exists user_profiles_delete on public.user_profiles;

create policy user_profiles_select on public.user_profiles
for select to authenticated
using (auth_user_id = auth.uid() or public.is_current_user_admin());

create policy user_profiles_insert on public.user_profiles
for insert to authenticated
with check (auth_user_id = auth.uid() or public.is_current_user_admin() or auth_user_id is null);

create policy user_profiles_update on public.user_profiles
for update to authenticated
using (auth_user_id = auth.uid() or public.is_current_user_admin())
with check (auth_user_id = auth.uid() or public.is_current_user_admin() or auth_user_id is null);

create policy user_profiles_delete on public.user_profiles
for delete to authenticated
using (public.is_current_user_admin());

drop policy if exists user_settings_all on public.user_settings;
create policy user_settings_all on public.user_settings
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists owners_all on public.owners;
create policy owners_all on public.owners
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists properties_all on public.properties;
create policy properties_all on public.properties
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists property_owners_all on public.property_owners;
create policy property_owners_all on public.property_owners
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists guests_all on public.guests;
create policy guests_all on public.guests
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists contracts_all on public.contracts;
create policy contracts_all on public.contracts
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists contract_properties_all on public.contract_properties;
create policy contract_properties_all on public.contract_properties
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists service_providers_all on public.service_providers;
create policy service_providers_all on public.service_providers
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists transactions_all on public.transactions;
create policy transactions_all on public.transactions
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists appointments_all on public.appointments;
create policy appointments_all on public.appointments
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists contract_templates_all on public.contract_templates;
create policy contract_templates_all on public.contract_templates
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists documents_all on public.documents;
create policy documents_all on public.documents
for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
