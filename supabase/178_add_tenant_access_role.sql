insert into public.access_roles (id, name, description)
values ('tenant', 'Tenant', 'Access to tenant management')
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description;

insert into public.access_profile_roles (
  tenant_id,
  access_profile_id,
  access_role_id,
  access_level,
  created_at,
  updated_at
)
select
  apr.tenant_id,
  apr.access_profile_id,
  'tenant',
  apr.access_level,
  timezone('utc', now()),
  timezone('utc', now())
from public.access_profile_roles apr
where apr.access_role_id = 'users-permissions'
on conflict (tenant_id, access_profile_id, access_role_id) do update
set
  access_level = excluded.access_level,
  updated_at = timezone('utc', now());
