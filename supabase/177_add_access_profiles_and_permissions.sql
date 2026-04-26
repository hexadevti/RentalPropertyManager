create table if not exists public.access_roles (
  id text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.access_profiles (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, id)
);

create table if not exists public.access_profile_roles (
  tenant_id uuid not null,
  access_profile_id text not null,
  access_role_id text not null references public.access_roles(id) on delete cascade,
  access_level text not null default 'read',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, access_profile_id, access_role_id),
  constraint access_profile_roles_level_check check (access_level in ('read', 'write')),
  constraint access_profile_roles_profile_fk
    foreign key (tenant_id, access_profile_id)
    references public.access_profiles(tenant_id, id)
    on delete cascade
);

alter table public.user_profiles
  add column if not exists access_profile_id text;

alter table public.user_profiles
  drop constraint if exists user_profiles_access_profile_fk;

alter table public.user_profiles
  add constraint user_profiles_access_profile_fk
  foreign key (tenant_id, access_profile_id)
  references public.access_profiles(tenant_id, id)
  on delete set null;

create index if not exists idx_access_profiles_tenant_id
  on public.access_profiles(tenant_id);

create index if not exists idx_access_profile_roles_tenant_id
  on public.access_profile_roles(tenant_id);

create index if not exists idx_user_profiles_access_profile_id
  on public.user_profiles(tenant_id, access_profile_id);

alter table public.access_profiles enable row level security;
alter table public.access_profile_roles enable row level security;
alter table public.access_roles enable row level security;

drop policy if exists access_roles_select_authenticated on public.access_roles;
create policy access_roles_select_authenticated on public.access_roles
  for select
  to authenticated
  using (true);

drop policy if exists access_profiles_select_tenant on public.access_profiles;
create policy access_profiles_select_tenant on public.access_profiles
  for select
  to authenticated
  using (
    public.is_current_user_platform_admin()
    or exists (
      select 1
      from public.user_profiles up
      where up.tenant_id = access_profiles.tenant_id
        and up.auth_user_id = auth.uid()
    )
  );

drop policy if exists access_profiles_manage_admin on public.access_profiles;
create policy access_profiles_manage_admin on public.access_profiles
  for all
  to authenticated
  using (
    public.is_current_user_platform_admin()
    or exists (
      select 1
      from public.user_profiles up
      where up.tenant_id = access_profiles.tenant_id
        and up.auth_user_id = auth.uid()
        and up.role = 'admin'
        and up.status = 'approved'
    )
  )
  with check (
    public.is_current_user_platform_admin()
    or exists (
      select 1
      from public.user_profiles up
      where up.tenant_id = access_profiles.tenant_id
        and up.auth_user_id = auth.uid()
        and up.role = 'admin'
        and up.status = 'approved'
    )
  );

drop policy if exists access_profile_roles_select_tenant on public.access_profile_roles;
create policy access_profile_roles_select_tenant on public.access_profile_roles
  for select
  to authenticated
  using (
    public.is_current_user_platform_admin()
    or exists (
      select 1
      from public.user_profiles up
      where up.tenant_id = access_profile_roles.tenant_id
        and up.auth_user_id = auth.uid()
    )
  );

drop policy if exists access_profile_roles_manage_admin on public.access_profile_roles;
create policy access_profile_roles_manage_admin on public.access_profile_roles
  for all
  to authenticated
  using (
    public.is_current_user_platform_admin()
    or exists (
      select 1
      from public.user_profiles up
      where up.tenant_id = access_profile_roles.tenant_id
        and up.auth_user_id = auth.uid()
        and up.role = 'admin'
        and up.status = 'approved'
    )
  )
  with check (
    public.is_current_user_platform_admin()
    or exists (
      select 1
      from public.user_profiles up
      where up.tenant_id = access_profile_roles.tenant_id
        and up.auth_user_id = auth.uid()
        and up.role = 'admin'
        and up.status = 'approved'
    )
  );

create or replace function public.set_access_profile_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists access_profiles_set_updated_at on public.access_profiles;
create trigger access_profiles_set_updated_at
before update on public.access_profiles
for each row
execute function public.set_access_profile_updated_at();

drop trigger if exists access_profile_roles_set_updated_at on public.access_profile_roles;
create trigger access_profile_roles_set_updated_at
before update on public.access_profile_roles
for each row
execute function public.set_access_profile_updated_at();

insert into public.access_roles (id, name, description)
values
  ('properties', 'Properties', 'Access to properties management'),
  ('owners', 'Owners', 'Access to owners management'),
  ('finances', 'Finances', 'Access to finances management'),
  ('calendar', 'Calendar', 'Access to calendar'),
  ('tasks', 'Tasks', 'Access to tasks management'),
  ('reports', 'Reports', 'Access to reports'),
  ('guests', 'Guests', 'Access to guests management'),
  ('contracts', 'Contracts', 'Access to contracts'),
  ('documents', 'Documents', 'Access to documents'),
  ('ai-assistant', 'AI Assistant', 'Access to AI assistant'),
  ('inspections', 'Inspections', 'Access to inspections'),
  ('templates', 'Templates', 'Access to contract templates'),
  ('notifications', 'Notifications', 'Access to notification rules and templates'),
  ('providers', 'Service providers', 'Access to service providers'),
  ('appointments', 'Appointments', 'Access to appointments'),
  ('users-permissions', 'Users & Permissions', 'Access to users and permissions'),
  ('audit-logs', 'Audit logs', 'Access to audit logs')
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description;

create or replace function public.seed_default_access_profiles(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_now timestamptz := timezone('utc', now());
begin
  if p_tenant_id is null then
    return 0;
  end if;

  insert into public.access_profiles (
    tenant_id,
    id,
    name,
    description,
    is_system,
    created_at,
    updated_at
  )
  values
    (p_tenant_id, 'system-administrator', 'Administrador', 'Acesso completo ao sistema.', true, v_now, v_now),
    (p_tenant_id, 'system-guest', 'Hospede', 'Acesso operacional padrao para usuarios convidados.', true, v_now, v_now),
    (p_tenant_id, 'system-operator', 'Operador', 'Acesso somente leitura a propriedades.', true, v_now, v_now)
  on conflict (tenant_id, id) do update
  set
    name = excluded.name,
    description = excluded.description,
    is_system = excluded.is_system,
    updated_at = timezone('utc', now());

  get diagnostics v_inserted = row_count;

  insert into public.access_profile_roles (
    tenant_id,
    access_profile_id,
    access_role_id,
    access_level,
    created_at,
    updated_at
  )
  select
    p_tenant_id,
    'system-administrator',
    role_row.id,
    'write',
    v_now,
    v_now
  from public.access_roles role_row
  on conflict (tenant_id, access_profile_id, access_role_id) do update
  set
    access_level = excluded.access_level,
    updated_at = timezone('utc', now());

  insert into public.access_profile_roles (
    tenant_id,
    access_profile_id,
    access_role_id,
    access_level,
    created_at,
    updated_at
  )
  values
    (p_tenant_id, 'system-guest', 'calendar', 'write', v_now, v_now),
    (p_tenant_id, 'system-guest', 'contracts', 'write', v_now, v_now),
    (p_tenant_id, 'system-guest', 'appointments', 'write', v_now, v_now),
    (p_tenant_id, 'system-operator', 'properties', 'read', v_now, v_now)
  on conflict (tenant_id, access_profile_id, access_role_id) do update
  set
    access_level = excluded.access_level,
    updated_at = timezone('utc', now());

  return v_inserted;
end;
$$;

create or replace function public.assign_default_access_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.access_profile_id is null or btrim(new.access_profile_id) = '' then
    if new.role = 'admin' then
      new.access_profile_id := 'system-administrator';
    else
      new.access_profile_id := 'system-guest';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assign_default_access_profile on public.user_profiles;
create trigger trg_assign_default_access_profile
before insert or update on public.user_profiles
for each row
execute function public.assign_default_access_profile();

create or replace function public.seed_default_access_profiles_on_tenant_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_access_profiles(new.id);
  return new;
end;
$$;

drop trigger if exists trg_seed_default_access_profiles on public.tenants;
create trigger trg_seed_default_access_profiles
after insert on public.tenants
for each row
execute function public.seed_default_access_profiles_on_tenant_insert();

select public.seed_default_access_profiles(id)
from public.tenants;

update public.user_profiles
set
  access_profile_id = case
    when role = 'admin' then 'system-administrator'
    else 'system-guest'
  end,
  updated_at = timezone('utc', now())
where access_profile_id is null or btrim(access_profile_id) = '';

create or replace function public.current_user_access_level(
  p_tenant_id uuid,
  p_access_role_id text
)
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when public.is_current_user_platform_admin() then 'write'
    else coalesce((
      select apr.access_level
      from public.user_profiles up
      join public.access_profile_roles apr
        on apr.tenant_id = up.tenant_id
       and apr.access_profile_id = up.access_profile_id
      where up.tenant_id = p_tenant_id
        and up.auth_user_id = auth.uid()
        and apr.access_role_id = p_access_role_id
      limit 1
    ), 'none')
  end;
$$;

revoke all on function public.current_user_access_level(uuid, text) from public;
grant execute on function public.current_user_access_level(uuid, text) to authenticated;
