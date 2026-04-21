-- AI usage log: one row per assistant query, tracks token consumption and estimated cost per tenant
create table if not exists public.ai_usage_logs (
  id            text         not null,
  tenant_id     uuid         not null references public.tenants(id) on delete cascade,
  auth_user_id  uuid,
  user_login    text         not null default '',
  model         text         not null default '',
  question_chars int         not null default 0,
  input_tokens  int          not null default 0,
  output_tokens int          not null default 0,
  total_tokens  int          not null default 0,
  estimated_cost_usd numeric(12, 8) not null default 0,
  created_at    timestamptz  not null default timezone('utc', now()),
  primary key (tenant_id, id)
);

create index if not exists idx_ai_usage_logs_tenant_id
  on public.ai_usage_logs(tenant_id);

create index if not exists idx_ai_usage_logs_created_at
  on public.ai_usage_logs(tenant_id, created_at desc);

alter table public.ai_usage_logs enable row level security;

-- Tenant admins: own tenant only
drop policy if exists ai_usage_logs_select on public.ai_usage_logs;
create policy ai_usage_logs_select on public.ai_usage_logs
  for select to authenticated
  using (tenant_id = public.get_current_user_tenant_id());

-- Platform admins: all tenants (policies are OR-ed)
drop policy if exists ai_usage_logs_platform_admin_select on public.ai_usage_logs;
create policy ai_usage_logs_platform_admin_select on public.ai_usage_logs
  for select to authenticated
  using (
    exists (
      select 1 from public.platform_admins
      where auth_user_id = auth.uid()
    )
  );

-- Aggregated view per tenant (used by platform admin)
create or replace view public.ai_usage_by_tenant as
  select
    tenant_id,
    count(*)                          as total_queries,
    sum(input_tokens)                 as total_input_tokens,
    sum(output_tokens)                as total_output_tokens,
    sum(total_tokens)                 as total_tokens,
    sum(estimated_cost_usd)           as total_cost_usd,
    max(created_at)                   as last_query_at
  from public.ai_usage_logs
  group by tenant_id;
