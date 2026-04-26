alter table public.usage_plans
  add column if not exists max_ai_tokens integer;

alter table public.usage_plans
  add column if not exists ai_enabled boolean not null default true;

alter table public.usage_plans
  drop constraint if exists usage_plans_max_ai_tokens_check;

alter table public.usage_plans
  add constraint usage_plans_max_ai_tokens_check
  check (max_ai_tokens is null or max_ai_tokens > 0);

alter table public.tenant_usage_plans
  add column if not exists custom_max_ai_tokens integer;

alter table public.tenant_usage_plans
  drop constraint if exists tenant_usage_plans_custom_max_ai_tokens_check;

alter table public.tenant_usage_plans
  add constraint tenant_usage_plans_custom_max_ai_tokens_check
  check (custom_max_ai_tokens is null or custom_max_ai_tokens > 0);

update public.usage_plans
set max_ai_tokens = 500000,
  ai_enabled = false,
    updated_at = timezone('utc', now())
where code = 'starter';

update public.usage_plans
set max_ai_tokens = 2000000,
  ai_enabled = true,
    updated_at = timezone('utc', now())
where code = 'professional';

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
    'maxAiTokens', coalesce(tup.custom_max_ai_tokens, up.max_ai_tokens),
    'aiEnabled', up.ai_enabled,
    'allowedAccessRoleIds', up.allowed_access_roles,
    'featureHighlights', up.feature_highlights,
    'startsAt', tup.starts_at,
    'endsAt', tup.ends_at,
    'notes', tup.notes,
    'isCustom', (tup.custom_max_properties is not null or tup.custom_max_users is not null or tup.custom_max_ai_tokens is not null)
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
    'maxAiTokens', up.max_ai_tokens,
    'aiEnabled', up.ai_enabled,
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
