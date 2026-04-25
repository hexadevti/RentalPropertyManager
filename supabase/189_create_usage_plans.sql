create table if not exists public.usage_plans (
  code text primary key,
  name text not null,
  description text,
  price_monthly_brl numeric(10,2),
  max_properties integer,
  max_users integer,
  allowed_access_roles text[] not null default '{}',
  feature_highlights text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint usage_plans_max_properties_check check (max_properties is null or max_properties > 0),
  constraint usage_plans_max_users_check check (max_users is null or max_users > 0)
);

create table if not exists public.tenant_usage_plans (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  plan_code text not null references public.usage_plans(code) on delete restrict,
  custom_max_properties integer,
  custom_max_users integer,
  starts_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tenant_usage_plans_custom_max_properties_check check (custom_max_properties is null or custom_max_properties > 0),
  constraint tenant_usage_plans_custom_max_users_check check (custom_max_users is null or custom_max_users > 0)
);

create index if not exists idx_tenant_usage_plans_plan_code
  on public.tenant_usage_plans(plan_code);

create or replace function public.set_usage_plan_updated_at()
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

drop trigger if exists usage_plans_set_updated_at on public.usage_plans;
create trigger usage_plans_set_updated_at
before update on public.usage_plans
for each row
execute function public.set_usage_plan_updated_at();

drop trigger if exists tenant_usage_plans_set_updated_at on public.tenant_usage_plans;
create trigger tenant_usage_plans_set_updated_at
before update on public.tenant_usage_plans
for each row
execute function public.set_usage_plan_updated_at();

insert into public.usage_plans (
  code,
  name,
  description,
  price_monthly_brl,
  max_properties,
  max_users,
  allowed_access_roles,
  feature_highlights,
  is_active
)
values
  (
    'starter',
    'Starter',
    'For small operators with up to 3 properties.',
    0,
    3,
    1,
    array['properties','owners','finances','guests','contracts','documents']::text[],
    array[
      'Up to 3 properties',
      '1 user',
      'Contracts and guests',
      'Basic financial control',
      'General documents',
      'Email support'
    ]::text[],
    true
  ),
  (
    'professional',
    'Professional',
    'For operators with multiple properties and automation needs.',
    79,
    null,
    5,
    array[
      'properties','owners','finances','calendar','tasks','reports','guests','contracts','documents',
      'ai-assistant','inspections','templates','notifications','providers','appointments'
    ]::text[],
    array[
      'Unlimited properties',
      'Up to 5 users',
      'AI assistant',
      'WhatsApp bot',
      'iCal sync',
      'CSV import',
      'Contract templates',
      'Automatic notifications',
      'Digital inspections',
      'Priority support'
    ]::text[],
    true
  ),
  (
    'enterprise',
    'Enterprise',
    'For advanced operation with dedicated support.',
    null,
    null,
    null,
    array[
      'tenant','properties','owners','finances','calendar','tasks','reports','guests','contracts','documents',
      'ai-assistant','inspections','templates','notifications','providers','appointments',
      'users-permissions','access-profiles','audit-logs'
    ]::text[],
    array[
      'Everything in Professional',
      'Unlimited users',
      'Multiple tenants',
      'Integration API',
      'Audit and monitoring',
      'Dedicated onboarding',
      'SLA',
      'Dedicated account manager'
    ]::text[],
    true
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  price_monthly_brl = excluded.price_monthly_brl,
  max_properties = excluded.max_properties,
  max_users = excluded.max_users,
  allowed_access_roles = excluded.allowed_access_roles,
  feature_highlights = excluded.feature_highlights,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

insert into public.tenant_usage_plans (tenant_id, plan_code)
select t.id, 'enterprise'
from public.tenants t
where not exists (
  select 1
  from public.tenant_usage_plans tup
  where tup.tenant_id = t.id
);

create or replace function public.assign_default_usage_plan_to_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_usage_plans (tenant_id, plan_code)
  values (new.id, 'starter')
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists tenants_assign_default_usage_plan on public.tenants;
create trigger tenants_assign_default_usage_plan
after insert on public.tenants
for each row
execute function public.assign_default_usage_plan_to_tenant();

alter table public.usage_plans enable row level security;
alter table public.tenant_usage_plans enable row level security;

drop policy if exists usage_plans_select_authenticated on public.usage_plans;
create policy usage_plans_select_authenticated on public.usage_plans
  for select to authenticated
  using (true);

drop policy if exists usage_plans_manage_platform_admin on public.usage_plans;
create policy usage_plans_manage_platform_admin on public.usage_plans
  for all to authenticated
  using (public.is_current_user_platform_admin())
  with check (public.is_current_user_platform_admin());

drop policy if exists tenant_usage_plans_select_scoped on public.tenant_usage_plans;
create policy tenant_usage_plans_select_scoped on public.tenant_usage_plans
  for select to authenticated
  using (
    public.is_current_user_platform_admin()
    or tenant_id = public.get_current_user_tenant_id()
  );

drop policy if exists tenant_usage_plans_manage_platform_admin on public.tenant_usage_plans;
create policy tenant_usage_plans_manage_platform_admin on public.tenant_usage_plans
  for all to authenticated
  using (public.is_current_user_platform_admin())
  with check (public.is_current_user_platform_admin());

create or replace function public.get_effective_tenant_usage_plan(p_tenant_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_is_platform_admin boolean;
  v_payload jsonb;
begin
  v_is_platform_admin := public.is_current_user_platform_admin();
  v_tenant_id := coalesce(p_tenant_id, public.get_current_user_tenant_id());

  if v_tenant_id is null then
    return null;
  end if;

  if not v_is_platform_admin and v_tenant_id <> public.get_current_user_tenant_id() then
    raise exception 'Not allowed to read usage plan for another tenant.';
  end if;

  select jsonb_build_object(
    'tenantId', v_tenant_id,
    'planCode', up.code,
    'planName', up.name,
    'description', up.description,
    'priceMonthlyBrl', up.price_monthly_brl,
    'maxProperties', coalesce(tup.custom_max_properties, up.max_properties),
    'maxUsers', coalesce(tup.custom_max_users, up.max_users),
    'allowedAccessRoleIds', up.allowed_access_roles,
    'featureHighlights', up.feature_highlights,
    'startsAt', tup.starts_at,
    'endsAt', tup.ends_at,
    'notes', tup.notes,
    'isCustom', (tup.custom_max_properties is not null or tup.custom_max_users is not null)
  )
  into v_payload
  from public.tenant_usage_plans tup
  join public.usage_plans up
    on up.code = tup.plan_code
  where tup.tenant_id = v_tenant_id
  limit 1;

  if v_payload is not null then
    return v_payload;
  end if;

  select jsonb_build_object(
    'tenantId', v_tenant_id,
    'planCode', up.code,
    'planName', up.name,
    'description', up.description,
    'priceMonthlyBrl', up.price_monthly_brl,
    'maxProperties', up.max_properties,
    'maxUsers', up.max_users,
    'allowedAccessRoleIds', up.allowed_access_roles,
    'featureHighlights', up.feature_highlights,
    'startsAt', null,
    'endsAt', null,
    'notes', null,
    'isCustom', false
  )
  into v_payload
  from public.usage_plans up
  where up.code = 'starter'
  limit 1;

  return v_payload;
end;
$$;

grant execute on function public.get_effective_tenant_usage_plan(uuid) to authenticated;

drop trigger if exists enforce_properties_plan_limits_insert on public.properties;
drop trigger if exists enforce_user_profiles_plan_limits_insert on public.user_profiles;

create or replace function public.enforce_property_limit_from_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_properties integer;
  v_count integer;
begin
  select coalesce(tup.custom_max_properties, up.max_properties)
    into v_max_properties
  from public.tenant_usage_plans tup
  join public.usage_plans up on up.code = tup.plan_code
  where tup.tenant_id = new.tenant_id
  limit 1;

  if v_max_properties is null then
    return new;
  end if;

  select count(*)
    into v_count
  from public.properties p
  where p.tenant_id = new.tenant_id;

  if v_count >= v_max_properties then
    raise exception 'Property limit reached for current tenant plan (%).', v_max_properties;
  end if;

  return new;
end;
$$;

create trigger enforce_properties_plan_limits_insert
before insert on public.properties
for each row
execute function public.enforce_property_limit_from_plan();

create or replace function public.enforce_user_limit_from_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_users integer;
  v_count integer;
begin
  select coalesce(tup.custom_max_users, up.max_users)
    into v_max_users
  from public.tenant_usage_plans tup
  join public.usage_plans up on up.code = tup.plan_code
  where tup.tenant_id = new.tenant_id
  limit 1;

  if v_max_users is null then
    return new;
  end if;

  select count(*)
    into v_count
  from public.user_profiles upf
  where upf.tenant_id = new.tenant_id
    and upf.status <> 'blocked';

  if v_count >= v_max_users then
    raise exception 'User limit reached for current tenant plan (%).', v_max_users;
  end if;

  return new;
end;
$$;

create trigger enforce_user_profiles_plan_limits_insert
before insert on public.user_profiles
for each row
execute function public.enforce_user_limit_from_plan();
