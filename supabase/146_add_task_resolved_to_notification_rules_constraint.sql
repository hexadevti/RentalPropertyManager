-- Add 'task-resolved' to the notification_rules trigger check constraint.
-- Without this, saving a rule with task-resolved condition fails at the DB level,
-- which also blocks saving any other condition in the same upsert batch.

alter table public.notification_rules
  drop constraint if exists notification_rules_trigger_check;

alter table public.notification_rules
  add constraint notification_rules_trigger_check
  check (trigger in (
    'appointment-items',
    'contract-expiration',
    'contract-payment-day',
    'task-due',
    'task-created',
    'task-due-tomorrow',
    'task-due-today',
    'task-overdue-open',
    'task-resolved',
    'contract-created',
    'inspection',
    'bug'
  ));
