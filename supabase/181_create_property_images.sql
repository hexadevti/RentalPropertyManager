create table if not exists public.property_photos (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  property_id text not null,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, id),
  constraint property_photos_property_fkey
    foreign key (tenant_id, property_id) references public.properties(tenant_id, id) on delete cascade
);

create index if not exists idx_property_photos_property
  on public.property_photos(tenant_id, property_id, sort_order, created_at);

create unique index if not exists idx_property_photos_cover_unique
  on public.property_photos(tenant_id, property_id)
  where is_cover;

insert into storage.buckets (id, name, public, file_size_limit)
values ('property-images', 'property-images', false, 10485760)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

alter table public.property_photos enable row level security;

drop policy if exists property_photos_all on public.property_photos;
create policy property_photos_all on public.property_photos
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists property_images_storage_select on storage.objects;
create policy property_images_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = public.get_current_user_tenant_id()::text
  );

drop policy if exists property_images_storage_insert on storage.objects;
create policy property_images_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = public.get_current_user_tenant_id()::text
  );

drop policy if exists property_images_storage_update on storage.objects;
create policy property_images_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = public.get_current_user_tenant_id()::text
  )
  with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = public.get_current_user_tenant_id()::text
  );

drop policy if exists property_images_storage_delete on storage.objects;
create policy property_images_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = public.get_current_user_tenant_id()::text
  );
