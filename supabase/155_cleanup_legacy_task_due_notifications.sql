-- Remove legacy task-due notification trigger and migrate old rules
-- to the granular task due triggers used by the current catalog.

with migrated_legacy_rules as (
  insert into public.notification_rules (
    tenant_id,
    id,
    name,
    trigger,
    event_type,
    channels,
    email_template_id,
    sms_template_id,
    whatsapp_template_id,
    recipient_roles,
    recipient_user_ids,
    days_before,
    is_active,
    created_at,
    updated_at
  )
  select
    legacy_rule.tenant_id,
    format('migrated:%s:%s', legacy_rule.id, granular_trigger.trigger),
    legacy_rule.name,
    granular_trigger.trigger,
    'tasks',
    legacy_rule.channels,
    legacy_rule.email_template_id,
    legacy_rule.sms_template_id,
    legacy_rule.whatsapp_template_id,
    legacy_rule.recipient_roles,
    legacy_rule.recipient_user_ids,
    granular_trigger.days_before,
    legacy_rule.is_active,
    legacy_rule.created_at,
    timezone('utc', now())
  from public.notification_rules legacy_rule
  cross join (
    values
      ('task-due-tomorrow', 1),
      ('task-due-today', 0),
      ('task-overdue-open', 0)
  ) as granular_trigger(trigger, days_before)
  where legacy_rule.trigger = 'task-due'
    and not exists (
      select 1
      from public.notification_rules existing_rule
      where existing_rule.tenant_id = legacy_rule.tenant_id
        and existing_rule.name = legacy_rule.name
        and existing_rule.trigger = granular_trigger.trigger
    )
  on conflict (tenant_id, id) do nothing
  returning tenant_id
)
select count(*) from migrated_legacy_rules;

update public.notification_rules
set event_type = case
  when trigger in ('task-created', 'task-due-tomorrow', 'task-due-today', 'task-overdue-open', 'task-resolved') then 'tasks'
  when trigger in ('user-created', 'user-role-changed', 'user-access-approved', 'user-access-rejected') then 'user-access'
  else event_type
end
where trigger in (
  'task-created',
  'task-due-tomorrow',
  'task-due-today',
  'task-overdue-open',
  'task-resolved',
  'user-created',
  'user-role-changed',
  'user-access-approved',
  'user-access-rejected'
);

delete from public.notification_rules
where trigger = 'task-due';

alter table public.notification_rules
  drop constraint if exists notification_rules_trigger_check;

alter table public.notification_rules
  add constraint notification_rules_trigger_check
  check (trigger in (
    'appointment-items',
    'contract-expiration',
    'contract-payment-day',
    'task-created',
    'task-due-tomorrow',
    'task-due-today',
    'task-overdue-open',
    'task-resolved',
    'contract-created',
    'inspection',
    'bug',
    'user-created',
    'user-role-changed',
    'user-access-approved',
    'user-access-rejected'
  ));
