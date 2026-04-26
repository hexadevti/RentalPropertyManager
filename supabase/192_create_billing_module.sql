create table if not exists public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  provider text not null,
  provider_customer_id text,
  provider_subscription_id text,
  subscription_status text,
  active_plan_code text references public.usage_plans(code) on delete set null,
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_accounts_provider_check check (char_length(trim(provider)) > 0)
);

create unique index if not exists billing_accounts_provider_subscription_uidx
  on public.billing_accounts(provider, provider_subscription_id)
  where provider_subscription_id is not null;

create table if not exists public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  provider_session_id text not null,
  requested_plan_code text not null references public.usage_plans(code) on delete restrict,
  initiated_by_auth_user_id uuid,
  checkout_url text,
  status text not null default 'created',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint billing_checkout_sessions_provider_check check (char_length(trim(provider)) > 0),
  constraint billing_checkout_sessions_status_check check (status in ('created', 'completed', 'expired', 'failed'))
);

create unique index if not exists billing_checkout_sessions_provider_session_uidx
  on public.billing_checkout_sessions(provider, provider_session_id);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint billing_webhook_events_provider_check check (char_length(trim(provider)) > 0)
);

create unique index if not exists billing_webhook_events_provider_event_uidx
  on public.billing_webhook_events(provider, provider_event_id);

drop trigger if exists billing_accounts_set_updated_at on public.billing_accounts;
create trigger billing_accounts_set_updated_at
before update on public.billing_accounts
for each row
execute function public.set_updated_at();

drop trigger if exists billing_checkout_sessions_set_updated_at on public.billing_checkout_sessions;
create trigger billing_checkout_sessions_set_updated_at
before update on public.billing_checkout_sessions
for each row
execute function public.set_updated_at();

alter table public.billing_accounts enable row level security;
alter table public.billing_checkout_sessions enable row level security;
alter table public.billing_webhook_events enable row level security;

drop policy if exists billing_accounts_select_scoped on public.billing_accounts;
create policy billing_accounts_select_scoped on public.billing_accounts
  for select to authenticated
  using (
    public.is_current_user_platform_admin()
    or tenant_id = public.get_current_user_tenant_id()
  );

drop policy if exists billing_accounts_manage_platform_admin on public.billing_accounts;
create policy billing_accounts_manage_platform_admin on public.billing_accounts
  for all to authenticated
  using (public.is_current_user_platform_admin())
  with check (public.is_current_user_platform_admin());

drop policy if exists billing_checkout_sessions_select_scoped on public.billing_checkout_sessions;
create policy billing_checkout_sessions_select_scoped on public.billing_checkout_sessions
  for select to authenticated
  using (
    public.is_current_user_platform_admin()
    or tenant_id = public.get_current_user_tenant_id()
  );

drop policy if exists billing_checkout_sessions_manage_platform_admin on public.billing_checkout_sessions;
create policy billing_checkout_sessions_manage_platform_admin on public.billing_checkout_sessions
  for all to authenticated
  using (public.is_current_user_platform_admin())
  with check (public.is_current_user_platform_admin());

drop policy if exists billing_webhook_events_select_platform_admin on public.billing_webhook_events;
create policy billing_webhook_events_select_platform_admin on public.billing_webhook_events
  for select to authenticated
  using (public.is_current_user_platform_admin());

grant select on public.billing_accounts to authenticated;
grant select on public.billing_checkout_sessions to authenticated;
grant select on public.billing_webhook_events to authenticated;
