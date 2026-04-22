create table if not exists public.notification_templates (
  id text not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  subject text,
  content text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, id)
);

drop trigger if exists notification_templates_set_updated_at on public.notification_templates;
create trigger notification_templates_set_updated_at
before update on public.notification_templates
for each row execute function public.set_updated_at();

create table if not exists public.notification_rules (
  id text not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  trigger text not null check (trigger in (
    'appointment-items',
    'contract-expiration',
    'contract-payment-day',
    'task-due',
    'contract-created',
    'inspection',
    'bug'
  )),
  channels jsonb not null default '[]'::jsonb,
  email_template_id text,
  sms_template_id text,
  whatsapp_template_id text,
  recipient_roles jsonb not null default '[]'::jsonb,
  recipient_user_ids jsonb not null default '[]'::jsonb,
  days_before integer,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notification_rules_channels_json_array check (jsonb_typeof(channels) = 'array'),
  constraint notification_rules_recipient_roles_json_array check (jsonb_typeof(recipient_roles) = 'array'),
  constraint notification_rules_recipient_user_ids_json_array check (jsonb_typeof(recipient_user_ids) = 'array'),
  constraint notification_rules_days_before_non_negative check (days_before is null or days_before >= 0),
  primary key (tenant_id, id)
);

alter table public.notification_rules
  drop constraint if exists notification_rules_email_template_fkey;
alter table public.notification_rules
  add constraint notification_rules_email_template_fkey
  foreign key (tenant_id, email_template_id)
  references public.notification_templates(tenant_id, id)
  on delete set null;

alter table public.notification_rules
  drop constraint if exists notification_rules_sms_template_fkey;
alter table public.notification_rules
  add constraint notification_rules_sms_template_fkey
  foreign key (tenant_id, sms_template_id)
  references public.notification_templates(tenant_id, id)
  on delete set null;

alter table public.notification_rules
  drop constraint if exists notification_rules_whatsapp_template_fkey;
alter table public.notification_rules
  add constraint notification_rules_whatsapp_template_fkey
  foreign key (tenant_id, whatsapp_template_id)
  references public.notification_templates(tenant_id, id)
  on delete set null;

drop trigger if exists notification_rules_set_updated_at on public.notification_rules;
create trigger notification_rules_set_updated_at
before update on public.notification_rules
for each row execute function public.set_updated_at();

create index if not exists idx_notification_templates_tenant_id
  on public.notification_templates(tenant_id);

create index if not exists idx_notification_rules_tenant_id
  on public.notification_rules(tenant_id);

create index if not exists idx_notification_rules_active_trigger
  on public.notification_rules(tenant_id, is_active, trigger);

alter table public.notification_templates enable row level security;
alter table public.notification_rules enable row level security;

drop policy if exists notification_templates_all on public.notification_templates;
create policy notification_templates_all on public.notification_templates
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

drop policy if exists notification_rules_all on public.notification_rules;
create policy notification_rules_all on public.notification_rules
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());