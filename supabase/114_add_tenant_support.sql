-- ============================================================
-- 114_add_tenant_support.sql
-- Adds multi-tenant architecture: tenants table, tenant_id
-- replaces auth_user_id as the data partition key.
-- ============================================================

-- 1. Create tenants table
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.tenants enable row level security;

-- 2. Add tenant_id to user_profiles
alter table public.user_profiles
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

-- 3. Migrate existing user_profiles: one tenant per user
do $$
declare
  rec record;
  new_tenant_id uuid;
begin
  for rec in
    select id, coalesce(nullif(email, ''), github_login) as label
    from public.user_profiles
    where tenant_id is null
  loop
    insert into public.tenants (name)
    values (rec.label || '''s Organization')
    returning id into new_tenant_id;

    update public.user_profiles
    set tenant_id = new_tenant_id
    where id = rec.id;
  end loop;
end $$;

alter table public.user_profiles
  alter column tenant_id set not null;

-- 4. Helper: get current user's tenant
create or replace function public.get_current_user_tenant_id()
returns uuid
language sql
stable
as $$
  select tenant_id
  from public.user_profiles
  where auth_user_id = auth.uid()
    and status = 'approved'
  limit 1;
$$;

-- 5. Drop all FK constraints from tables that will be restructured
do $$
declare
  r record;
begin
  for r in
    select tc.constraint_name, tc.table_name
    from information_schema.table_constraints tc
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and tc.table_name in (
        'owners', 'properties', 'property_owners', 'property_furniture',
        'guests', 'contracts', 'contract_properties', 'service_providers',
        'transactions', 'tasks', 'appointments', 'contract_templates', 'documents'
      )
  loop
    execute format('alter table public.%I drop constraint %I', r.table_name, r.constraint_name);
  end loop;
end $$;

-- 6. Add tenant_id to all data tables
alter table public.owners          add column if not exists tenant_id uuid;
alter table public.properties      add column if not exists tenant_id uuid;
alter table public.property_owners add column if not exists tenant_id uuid;
alter table public.property_furniture add column if not exists tenant_id uuid;
alter table public.guests          add column if not exists tenant_id uuid;
alter table public.contracts       add column if not exists tenant_id uuid;
alter table public.contract_properties add column if not exists tenant_id uuid;
alter table public.service_providers add column if not exists tenant_id uuid;
alter table public.transactions    add column if not exists tenant_id uuid;
alter table public.tasks           add column if not exists tenant_id uuid;
alter table public.appointments    add column if not exists tenant_id uuid;
alter table public.contract_templates add column if not exists tenant_id uuid;
alter table public.documents       add column if not exists tenant_id uuid;

-- 7. Populate tenant_id from user_profiles mapping
update public.owners o
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = o.auth_user_id;

update public.properties p
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = p.auth_user_id;

update public.property_owners po
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = po.auth_user_id;

update public.property_furniture pf
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = pf.auth_user_id;

update public.guests g
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = g.auth_user_id;

update public.contracts c
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = c.auth_user_id;

update public.contract_properties cp
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = cp.auth_user_id;

update public.service_providers sp
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = sp.auth_user_id;

update public.transactions t
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = t.auth_user_id;

update public.tasks t
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = t.auth_user_id;

update public.appointments a
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = a.auth_user_id;

update public.contract_templates ct
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = ct.auth_user_id;

update public.documents d
  set tenant_id = up.tenant_id
  from public.user_profiles up
  where up.auth_user_id = d.auth_user_id;

-- 8. Delete any orphaned rows (no matching tenant)
delete from public.documents          where tenant_id is null;
delete from public.appointments       where tenant_id is null;
delete from public.tasks              where tenant_id is null;
delete from public.transactions       where tenant_id is null;
delete from public.contract_properties where tenant_id is null;
delete from public.contract_templates where tenant_id is null;
delete from public.contracts          where tenant_id is null;
delete from public.property_furniture where tenant_id is null;
delete from public.property_owners    where tenant_id is null;
delete from public.service_providers  where tenant_id is null;
delete from public.guests             where tenant_id is null;
delete from public.properties         where tenant_id is null;
delete from public.owners             where tenant_id is null;

-- 9. Make tenant_id NOT NULL
alter table public.owners              alter column tenant_id set not null;
alter table public.properties          alter column tenant_id set not null;
alter table public.property_owners     alter column tenant_id set not null;
alter table public.property_furniture  alter column tenant_id set not null;
alter table public.guests              alter column tenant_id set not null;
alter table public.contracts           alter column tenant_id set not null;
alter table public.contract_properties alter column tenant_id set not null;
alter table public.service_providers   alter column tenant_id set not null;
alter table public.transactions        alter column tenant_id set not null;
alter table public.tasks               alter column tenant_id set not null;
alter table public.appointments        alter column tenant_id set not null;
alter table public.contract_templates  alter column tenant_id set not null;
alter table public.documents           alter column tenant_id set not null;

-- 10. Drop old PKs
alter table public.owners              drop constraint if exists owners_pkey;
alter table public.properties          drop constraint if exists properties_pkey;
alter table public.property_owners     drop constraint if exists property_owners_pkey;
alter table public.property_furniture  drop constraint if exists property_furniture_pkey;
alter table public.guests              drop constraint if exists guests_pkey;
alter table public.contracts           drop constraint if exists contracts_pkey;
alter table public.contract_properties drop constraint if exists contract_properties_pkey;
alter table public.service_providers   drop constraint if exists service_providers_pkey;
alter table public.transactions        drop constraint if exists transactions_pkey;
alter table public.tasks               drop constraint if exists tasks_pkey;
alter table public.appointments        drop constraint if exists appointments_pkey;
alter table public.contract_templates  drop constraint if exists contract_templates_pkey;
alter table public.documents           drop constraint if exists documents_pkey;

-- 11a. Drop old RLS policies that reference auth_user_id (must happen before column drop)
drop policy if exists owners_all on public.owners;
drop policy if exists properties_all on public.properties;
drop policy if exists property_owners_all on public.property_owners;
drop policy if exists property_furniture_all on public.property_furniture;
drop policy if exists guests_all on public.guests;
drop policy if exists contracts_all on public.contracts;
drop policy if exists contract_properties_all on public.contract_properties;
drop policy if exists service_providers_all on public.service_providers;
drop policy if exists transactions_all on public.transactions;
drop policy if exists tasks_all on public.tasks;
drop policy if exists appointments_all on public.appointments;
drop policy if exists contract_templates_all on public.contract_templates;
drop policy if exists documents_all on public.documents;

-- 11b. Drop auth_user_id from data tables (no longer the partition key)
alter table public.owners              drop column if exists auth_user_id;
alter table public.properties          drop column if exists auth_user_id;
alter table public.property_owners     drop column if exists auth_user_id;
alter table public.property_furniture  drop column if exists auth_user_id;
alter table public.guests              drop column if exists auth_user_id;
alter table public.contracts           drop column if exists auth_user_id;
alter table public.contract_properties drop column if exists auth_user_id;
alter table public.service_providers   drop column if exists auth_user_id;
alter table public.transactions        drop column if exists auth_user_id;
alter table public.tasks               drop column if exists auth_user_id;
alter table public.appointments        drop column if exists auth_user_id;
alter table public.contract_templates  drop column if exists auth_user_id;
alter table public.documents           drop column if exists auth_user_id;

-- 12. Add new PKs with tenant_id
alter table public.owners              add primary key (tenant_id, id);
alter table public.properties          add primary key (tenant_id, id);
alter table public.property_owners     add primary key (tenant_id, property_id, owner_id);
alter table public.property_furniture  add primary key (tenant_id, property_id, item_order);
alter table public.guests              add primary key (tenant_id, id);
alter table public.contracts           add primary key (tenant_id, id);
alter table public.contract_properties add primary key (tenant_id, contract_id, property_id);
alter table public.service_providers   add primary key (tenant_id, id);
alter table public.transactions        add primary key (tenant_id, id);
alter table public.tasks               add primary key (tenant_id, id);
alter table public.appointments        add primary key (tenant_id, id);
alter table public.contract_templates  add primary key (tenant_id, id);
alter table public.documents           add primary key (tenant_id, id);

-- 13. Recreate FK constraints using tenant_id
alter table public.owners
  add constraint owners_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.properties
  add constraint properties_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.property_owners
  add constraint property_owners_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  add constraint property_owners_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade,
  add constraint property_owners_owner_fkey
    foreign key (tenant_id, owner_id) references public.owners(tenant_id, id) on delete cascade;

alter table public.property_furniture
  add constraint property_furniture_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  add constraint property_furniture_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade;

alter table public.guests
  add constraint guests_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.contracts
  add constraint contracts_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  add constraint contracts_guest_fkey
    foreign key (tenant_id, guest_id) references public.guests(tenant_id, id) on delete cascade;

alter table public.contract_properties
  add constraint contract_properties_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  add constraint contract_properties_contract_fkey
    foreign key (tenant_id, contract_id) references public.contracts(tenant_id, id) on delete cascade,
  add constraint contract_properties_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade;

alter table public.service_providers
  add constraint service_providers_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.transactions
  add constraint transactions_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  add constraint transactions_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade,
  add constraint transactions_contract_fkey
    foreign key (tenant_id, contract_id) references public.contracts(tenant_id, id) on delete cascade,
  add constraint transactions_service_provider_fkey
    foreign key (tenant_id, service_provider_id) references public.service_providers(tenant_id, id) on delete cascade;

alter table public.tasks
  add constraint tasks_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  add constraint tasks_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade;

alter table public.appointments
  add constraint appointments_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  add constraint appointments_service_provider_fkey
    foreign key (tenant_id, service_provider_id) references public.service_providers(tenant_id, id) on delete cascade,
  add constraint appointments_contract_fkey
    foreign key (tenant_id, contract_id) references public.contracts(tenant_id, id) on delete cascade,
  add constraint appointments_guest_fkey
    foreign key (tenant_id, guest_id) references public.guests(tenant_id, id) on delete cascade,
  add constraint appointments_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade;

alter table public.contract_templates
  add constraint contract_templates_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.documents
  add constraint documents_tenant_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  add constraint documents_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade;

-- 14. Update indexes
drop index if exists idx_owners_auth_user_id;
drop index if exists idx_properties_auth_user_id;
drop index if exists idx_property_furniture_auth_user_id;
drop index if exists idx_guests_auth_user_id;
drop index if exists idx_contracts_auth_user_id;
drop index if exists idx_transactions_auth_user_id;
drop index if exists idx_tasks_auth_user_id;
drop index if exists idx_appointments_auth_user_id;
drop index if exists idx_templates_auth_user_id;
drop index if exists idx_documents_auth_user_id;

create index if not exists idx_owners_tenant_id           on public.owners(tenant_id);
create index if not exists idx_properties_tenant_id       on public.properties(tenant_id);
create index if not exists idx_guests_tenant_id           on public.guests(tenant_id);
create index if not exists idx_contracts_tenant_id        on public.contracts(tenant_id);
create index if not exists idx_transactions_tenant_id     on public.transactions(tenant_id);
create index if not exists idx_tasks_tenant_id            on public.tasks(tenant_id);
create index if not exists idx_appointments_tenant_id     on public.appointments(tenant_id);
create index if not exists idx_templates_tenant_id        on public.contract_templates(tenant_id);
create index if not exists idx_documents_tenant_id        on public.documents(tenant_id);
create index if not exists idx_user_profiles_tenant_id    on public.user_profiles(tenant_id);

-- 15. Tenants RLS policies
create policy tenants_select on public.tenants
  for select to authenticated
  using (id = public.get_current_user_tenant_id());

create policy tenants_insert on public.tenants
  for insert to authenticated
  with check (true);

create policy tenants_update on public.tenants
  for update to authenticated
  using (id = public.get_current_user_tenant_id() and public.is_current_user_admin());

-- 16. Update user_profiles RLS to be tenant-scoped
drop policy if exists user_profiles_select on public.user_profiles;
drop policy if exists user_profiles_insert on public.user_profiles;
drop policy if exists user_profiles_update on public.user_profiles;
drop policy if exists user_profiles_delete on public.user_profiles;

create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or tenant_id = public.get_current_user_tenant_id()
  );

create policy user_profiles_insert on public.user_profiles
  for insert to authenticated
  with check (
    auth_user_id = auth.uid()
    or (auth_user_id is null and tenant_id = public.get_current_user_tenant_id())
  );

create policy user_profiles_update on public.user_profiles
  for update to authenticated
  using (
    auth_user_id = auth.uid()
    or tenant_id = public.get_current_user_tenant_id()
    or (auth_user_id is null and email = (select email from auth.users where id = auth.uid()))
  )
  with check (
    auth_user_id = auth.uid()
    or tenant_id = public.get_current_user_tenant_id()
    or auth_user_id is null
  );

create policy user_profiles_delete on public.user_profiles
  for delete to authenticated
  using (
    tenant_id = public.get_current_user_tenant_id()
    and public.is_current_user_admin()
  );

-- 17. Update data table RLS to use tenant_id
drop policy if exists owners_all on public.owners;
create policy owners_all on public.owners
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists properties_all on public.properties;
create policy properties_all on public.properties
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists property_owners_all on public.property_owners;
create policy property_owners_all on public.property_owners
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists property_furniture_all on public.property_furniture;
create policy property_furniture_all on public.property_furniture
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists guests_all on public.guests;
create policy guests_all on public.guests
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists contracts_all on public.contracts;
create policy contracts_all on public.contracts
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists contract_properties_all on public.contract_properties;
create policy contract_properties_all on public.contract_properties
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists service_providers_all on public.service_providers;
create policy service_providers_all on public.service_providers
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists transactions_all on public.transactions;
create policy transactions_all on public.transactions
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists appointments_all on public.appointments;
create policy appointments_all on public.appointments
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists contract_templates_all on public.contract_templates;
create policy contract_templates_all on public.contract_templates
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists documents_all on public.documents;
create policy documents_all on public.documents
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.tenants to authenticated;
