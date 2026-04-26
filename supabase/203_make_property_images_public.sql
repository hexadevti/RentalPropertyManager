-- Migration 203: make property images publicly accessible for portal visitors

insert into storage.buckets (id, name, public, file_size_limit)
values ('property-images', 'property-images', true, 10485760)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit;

-- Keep explicit read policy for anon/authenticated roles as defense in depth.
drop policy if exists portal_property_images_public_read on storage.objects;
create policy portal_property_images_public_read on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'property-images'
    and exists (
      select 1
      from public.tenants t
      where t.id::text = (storage.foldername(name))[1]
        and t.portal_enabled = true
    )
  );
