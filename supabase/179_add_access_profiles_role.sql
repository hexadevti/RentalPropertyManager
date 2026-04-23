-- Add dedicated access-profiles role so the Access Profiles screen
-- can be permissioned independently from users-permissions.

insert into public.access_roles (id, name, description)
values ('access-profiles', 'Access Profiles', 'Access to access profile management')
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description;

-- Grant write access to system-administrator for the new role
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
  'access-profiles',
  'write',
  timezone('utc', now()),
  timezone('utc', now())
from public.access_profiles ap
where ap.id = 'system-administrator'
on conflict (tenant_id, access_profile_id, access_role_id) do update
set
  access_level = excluded.access_level,
  updated_at = timezone('utc', now());

-- Update seed_default_access_profiles to include the new role for system-administrator
-- (system-administrator already receives write on all roles via the loop in 177,
--  so no additional seed logic is required here since access_roles now includes this entry)
