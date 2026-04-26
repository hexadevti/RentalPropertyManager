create or replace function public.seed_default_notification_rules(p_tenant_id uuid)
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

  perform public.seed_default_notification_templates(p_tenant_id);

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
    p_tenant_id,
    rule_defaults.id,
    rule_defaults.name,
    rule_defaults.trigger,
    rule_defaults.event_type,
    '["email"]'::jsonb,
    rule_defaults.email_template_id,
    null,
    null,
    '["admin"]'::jsonb,
    '[]'::jsonb,
    rule_defaults.days_before,
    rule_defaults.event_type = 'user-access',
    v_now,
    v_now
  from (
    values
      ('appointments:default-admin-flow:appointment-items', 'Appointment notifications', 'appointment-items', 'appointments', 'default-email-appointment-items', 0),
      ('contracts:default-admin-flow:contract-created', 'Contract notifications', 'contract-created', 'contracts', 'default-email-contract-created', null),
      ('contracts:default-admin-flow:contract-expiration', 'Contract notifications', 'contract-expiration', 'contracts', 'default-email-contract-expiration', 0),
      ('contracts:default-admin-flow:contract-payment-day', 'Contract notifications', 'contract-payment-day', 'contracts', 'default-email-contract-payment-day', 0),
      ('tasks:default-admin-flow:task-created', 'Task notifications', 'task-created', 'tasks', 'default-email-task-created', null),
      ('tasks:default-admin-flow:task-due-tomorrow', 'Task notifications', 'task-due-tomorrow', 'tasks', 'default-email-task-due-tomorrow', 1),
      ('tasks:default-admin-flow:task-due-today', 'Task notifications', 'task-due-today', 'tasks', 'default-email-task-due-today', 0),
      ('tasks:default-admin-flow:task-overdue-open', 'Task notifications', 'task-overdue-open', 'tasks', 'default-email-task-overdue-open', 0),
      ('tasks:default-admin-flow:task-resolved', 'Task notifications', 'task-resolved', 'tasks', 'default-email-task-resolved', null),
      ('inspections:default-admin-flow:inspection', 'Inspection notifications', 'inspection', 'inspections', 'default-email-inspection', 0),
      ('bugs:default-admin-flow:bug', 'Bug report notifications', 'bug', 'bugs', 'default-email-bug', null),
      ('user-access:default-admin-flow:user-created', 'User access notifications', 'user-created', 'user-access', 'default-email-user-created', null),
      ('user-access:default-admin-flow:user-role-changed', 'User access notifications', 'user-role-changed', 'user-access', 'default-email-user-role-changed', null),
      ('user-access:default-admin-flow:user-access-approved', 'User access notifications', 'user-access-approved', 'user-access', 'default-email-user-access-approved', null),
      ('user-access:default-admin-flow:user-access-rejected', 'User access notifications', 'user-access-rejected', 'user-access', 'default-email-user-access-rejected', null)
  ) as rule_defaults(
    id,
    name,
    trigger,
    event_type,
    email_template_id,
    days_before
  )
  where exists (
    select 1
    from public.tenants tenant_row
    where tenant_row.id = p_tenant_id
  )
  and exists (
    select 1
    from public.notification_templates template_row
    where template_row.tenant_id = p_tenant_id
      and template_row.id = rule_defaults.email_template_id
  )
  on conflict (tenant_id, id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
