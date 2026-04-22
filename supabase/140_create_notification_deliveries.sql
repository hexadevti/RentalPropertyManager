create table if not exists public.notification_deliveries (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rule_id text,
  template_id text,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  recipient_user_id uuid,
  recipient_login text,
  recipient_destination text not null,
  subject text,
  message_body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  provider text,
  provider_message_id text,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_attempt_at timestamptz not null default timezone('utc', now()),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notification_deliveries_payload_json_object check (jsonb_typeof(payload) = 'object'),
  constraint notification_deliveries_attempts_non_negative check (attempts >= 0),
  constraint notification_deliveries_max_attempts_positive check (max_attempts > 0),
  primary key (id)
);

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_rule_fkey;
alter table public.notification_deliveries
  add constraint notification_deliveries_rule_fkey
  foreign key (tenant_id, rule_id)
  references public.notification_rules(tenant_id, id)
  on delete set null;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_template_fkey;
alter table public.notification_deliveries
  add constraint notification_deliveries_template_fkey
  foreign key (tenant_id, template_id)
  references public.notification_templates(tenant_id, id)
  on delete set null;

drop trigger if exists notification_deliveries_set_updated_at on public.notification_deliveries;
create trigger notification_deliveries_set_updated_at
before update on public.notification_deliveries
for each row execute function public.set_updated_at();

create index if not exists idx_notification_deliveries_tenant_status_next_attempt
  on public.notification_deliveries(tenant_id, status, next_attempt_at);

create index if not exists idx_notification_deliveries_tenant_created_at
  on public.notification_deliveries(tenant_id, created_at desc);

create index if not exists idx_notification_deliveries_rule
  on public.notification_deliveries(tenant_id, rule_id);

alter table public.notification_deliveries enable row level security;

drop policy if exists notification_deliveries_all on public.notification_deliveries;
create policy notification_deliveries_all on public.notification_deliveries
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

create or replace view public.notification_delivery_stats as
  select
    tenant_id,
    channel,
    status,
    count(*) as total,
    max(created_at) as last_created_at,
    max(sent_at) as last_sent_at
  from public.notification_deliveries
  group by tenant_id, channel, status;
