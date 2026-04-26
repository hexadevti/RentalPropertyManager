-- Add access role for portal booking requests.
-- Without this role in access_roles, inserts into access_profile_roles
-- for "portal-bookings" fail with FK violation.

insert into public.access_roles (id, name, description)
values (
  'portal-bookings',
  'Portal bookings',
  'Access to guest portal booking requests management'
)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description;

-- Grant write access to system-administrator profile in all existing tenants.
insert into public.access_profile_roles (
  tenant_id,
  access_profile_id,
  access_role_id,
  access_level,
  created_at,
  updated_at
)
select
  ap.tenant_id,
  'system-administrator',
  'portal-bookings',
  'write',
  timezone('utc', now()),
  timezone('utc', now())
from public.access_profiles ap
where ap.id = 'system-administrator'
on conflict (tenant_id, access_profile_id, access_role_id) do update
set
  access_level = excluded.access_level,
  updated_at = timezone('utc', now());
