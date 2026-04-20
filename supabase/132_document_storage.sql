create table if not exists public.documents (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  name text not null,
  category text not null check (category in ('contract', 'receipt', 'insurance', 'tax', 'other')),
  notes text,
  property_id text,
  relation_type text not null default 'general'
    check (relation_type in ('general', 'property', 'contract', 'guest', 'owner')),
  relation_id text,
  file_name text,
  file_path text,
  file_size bigint,
  mime_type text,
  upload_date text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, id),
  constraint documents_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade
);

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

alter table public.documents
  add column if not exists relation_type text not null default 'general'
    check (relation_type in ('general', 'property', 'contract', 'guest', 'owner')),
  add column if not exists relation_id text,
  add column if not exists file_name text,
  add column if not exists file_path text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text;

update public.documents
set relation_type = 'property',
    relation_id = property_id
where property_id is not null
  and (relation_type = 'general' or relation_id is null);

create index if not exists idx_documents_relation
  on public.documents(tenant_id, relation_type, relation_id);

create index if not exists idx_documents_file_path
  on public.documents(tenant_id, file_path);

create index if not exists idx_documents_tenant_id
  on public.documents(tenant_id);

create index if not exists idx_documents_property_id
  on public.documents(tenant_id, property_id);

alter table public.documents enable row level security;

drop policy if exists documents_all on public.documents;
create policy documents_all on public.documents
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists documents_storage_select on storage.objects;
create policy documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.get_current_user_tenant_id()::text
  );

drop policy if exists documents_storage_insert on storage.objects;
create policy documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.get_current_user_tenant_id()::text
  );

drop policy if exists documents_storage_update on storage.objects;
create policy documents_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.get_current_user_tenant_id()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.get_current_user_tenant_id()::text
  );

drop policy if exists documents_storage_delete on storage.objects;
create policy documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.get_current_user_tenant_id()::text
  );
