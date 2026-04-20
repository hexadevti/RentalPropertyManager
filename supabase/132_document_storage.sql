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
