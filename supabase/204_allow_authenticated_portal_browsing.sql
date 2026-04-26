-- Migration 204: allow authenticated users to browse tenant portal pages
-- Fixes conflict when an admin session is active and user opens portal routes.

-- Tenants: authenticated users can read portal-enabled tenants (slug lookup)
drop policy if exists tenants_authenticated_portal_select on public.tenants;
create policy tenants_authenticated_portal_select on public.tenants
  for select to authenticated
  using (portal_enabled = true);

-- Properties: authenticated users can browse properties of portal-enabled tenants
drop policy if exists properties_authenticated_portal_select on public.properties;
create policy properties_authenticated_portal_select on public.properties
  for select to authenticated
  using (
    exists (
      select 1 from public.tenants t
      where t.id = properties.tenant_id
        and t.portal_enabled = true
    )
  );

-- Property photos: authenticated users can view photos of portal-enabled tenants
drop policy if exists property_photos_authenticated_portal_select on public.property_photos;
create policy property_photos_authenticated_portal_select on public.property_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.tenants t
      where t.id = property_photos.tenant_id
        and t.portal_enabled = true
    )
  );

-- Property furniture: authenticated users can view furniture of portal-enabled tenants
drop policy if exists property_furniture_authenticated_portal_select on public.property_furniture;
create policy property_furniture_authenticated_portal_select on public.property_furniture
  for select to authenticated
  using (
    exists (
      select 1 from public.tenants t
      where t.id = property_furniture.tenant_id
        and t.portal_enabled = true
    )
  );
