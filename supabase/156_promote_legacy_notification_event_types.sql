-- Promote legacy notification domains into first-class event types and
-- standardize their payload structure for template variables.

alter table public.notification_rules
  drop constraint if exists notification_rules_event_type_check;

alter table public.notification_rules
  add constraint notification_rules_event_type_check
  check (event_type is null or event_type in (
    'appointments',
    'contracts',
    'tasks',
    'inspections',
    'bugs',
    'user-access'
  ));

alter table public.notification_templates
  drop constraint if exists notification_templates_event_type_check;

alter table public.notification_templates
  add constraint notification_templates_event_type_check
  check (event_type in (
    'general',
    'appointments',
    'contracts',
    'tasks',
    'inspections',
    'bugs',
    'user-access'
  ));

update public.notification_rules
set event_type = case
  when trigger = 'appointment-items' then 'appointments'
  when trigger in ('contract-created', 'contract-expiration', 'contract-payment-day') then 'contracts'
  when trigger in ('task-created', 'task-due-tomorrow', 'task-due-today', 'task-overdue-open', 'task-resolved') then 'tasks'
  when trigger = 'inspection' then 'inspections'
  when trigger = 'bug' then 'bugs'
  when trigger in ('user-created', 'user-role-changed', 'user-access-approved', 'user-access-rejected') then 'user-access'
  else event_type
end
where trigger in (
  'appointment-items',
  'contract-created',
  'contract-expiration',
  'contract-payment-day',
  'task-created',
  'task-due-tomorrow',
  'task-due-today',
  'task-overdue-open',
  'task-resolved',
  'inspection',
  'bug',
  'user-created',
  'user-role-changed',
  'user-access-approved',
  'user-access-rejected'
);

create or replace function public.notify_on_appointments_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due_at timestamptz;
  v_event_key text;
  v_payload jsonb;
begin
  if new.status <> 'scheduled' then
    return new;
  end if;

  v_due_at := public.notification_appointment_due_at(new.date, new.time);
  v_event_key := format('appointment:%s:%s:%s:%s', new.id, coalesce(new.date, ''), coalesce(new.time, ''), new.status);
  v_payload := jsonb_build_object(
    'entity', 'appointment',
    'appointment', jsonb_build_object(
      'id', new.id,
      'title', new.title,
      'description', new.description,
      'date', new.date,
      'time', new.time,
      'status', new.status,
      'serviceProviderId', new.service_provider_id,
      'contractId', new.contract_id,
      'guestId', new.guest_id,
      'propertyId', new.property_id,
      'notes', new.notes,
      'completionNotes', new.completion_notes,
      'completedAt', new.completed_at
    ),
    'appointmentId', new.id,
    'title', new.title,
    'description', new.description,
    'date', new.date,
    'time', new.time,
    'status', new.status,
    'serviceProviderId', new.service_provider_id,
    'contractId', new.contract_id,
    'guestId', new.guest_id,
    'propertyId', new.property_id
  );

  perform public.enqueue_notification_deliveries_for_event(
    new.tenant_id,
    'appointment-items',
    v_event_key,
    v_due_at,
    v_payload,
    'Appointment reminder',
    coalesce(new.title, 'Appointment') || ' - ' || coalesce(new.date, '') || ' ' || coalesce(new.time, '')
  );

  return new;
end;
$$;

create or replace function public.notify_on_contracts_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expiration_at timestamptz;
  v_payment_at timestamptz;
  v_event_key text;
  v_payload jsonb;
begin
  v_payload := jsonb_build_object(
    'entity', 'contract',
    'contract', jsonb_build_object(
      'id', new.id,
      'guestId', new.guest_id,
      'status', new.status,
      'rentalType', new.rental_type,
      'startDate', new.start_date,
      'endDate', new.end_date,
      'closeDate', new.close_date,
      'paymentDueDay', new.payment_due_day,
      'monthlyAmount', new.monthly_amount,
      'specialPaymentCondition', new.special_payment_condition,
      'notes', new.notes,
      'templateId', new.template_id,
      'createdAt', new.created_at
    ),
    'contractId', new.id,
    'guestId', new.guest_id,
    'status', new.status,
    'rentalType', new.rental_type,
    'startDate', new.start_date,
    'endDate', new.end_date,
    'closeDate', new.close_date,
    'paymentDueDay', new.payment_due_day,
    'monthlyAmount', new.monthly_amount,
    'specialPaymentCondition', new.special_payment_condition,
    'notes', new.notes,
    'templateId', new.template_id
  );

  if tg_op = 'INSERT' then
    v_event_key := format('contract-created:%s:%s', new.id, coalesce(new.created_at::text, timezone('utc', now())::text));
    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'contract-created',
      v_event_key,
      timezone('utc', now()),
      v_payload,
      'New contract created',
      'A new contract has been created.'
    );
  end if;

  if new.status = 'active' then
    v_expiration_at := public.notification_date_to_utc_ts(public.notification_parse_date_text(new.end_date), 9);
    v_event_key := format('contract-expiration:%s:%s:%s', new.id, coalesce(new.end_date, ''), new.status);
    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'contract-expiration',
      v_event_key,
      v_expiration_at,
      v_payload,
      'Contract expiration',
      'Contract is approaching expiration.'
    );

    v_payment_at := public.notification_next_contract_payment_at(new.start_date, new.end_date, new.payment_due_day);
    v_event_key := format(
      'contract-payment-day:%s:%s:%s:%s:%s',
      new.id,
      coalesce(new.start_date, ''),
      coalesce(new.end_date, ''),
      coalesce(new.payment_due_day::text, ''),
      coalesce((v_payment_at::date)::text, '')
    );
    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'contract-payment-day',
      v_event_key,
      v_payment_at,
      v_payload,
      'Contract payment day',
      'Contract payment due date is approaching.'
    );
  end if;

  return new;
end;
$$;

create or replace function public.notify_on_inspections_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_key text;
  v_due_at timestamptz;
  v_payload jsonb;
begin
  v_due_at := public.notification_date_to_utc_ts(new.scheduled_date, 9);
  v_event_key := format('inspection:%s:%s:%s', new.id, coalesce(new.scheduled_date::text, ''), new.status);
  v_payload := jsonb_build_object(
    'entity', 'inspection',
    'inspection', jsonb_build_object(
      'id', new.id,
      'propertyId', new.property_id,
      'contractId', new.contract_id,
      'parentInspectionId', new.parent_inspection_id,
      'title', new.title,
      'type', new.type,
      'status', new.status,
      'inspectorName', new.inspector_name,
      'scheduledDate', new.scheduled_date,
      'completedDate', new.completed_date,
      'summary', new.summary
    ),
    'inspectionId', new.id,
    'propertyId', new.property_id,
    'contractId', new.contract_id,
    'parentInspectionId', new.parent_inspection_id,
    'title', new.title,
    'type', new.type,
    'status', new.status,
    'inspectorName', new.inspector_name,
    'scheduledDate', new.scheduled_date,
    'completedDate', new.completed_date,
    'summary', new.summary
  );

  perform public.enqueue_notification_deliveries_for_event(
    new.tenant_id,
    'inspection',
    v_event_key,
    v_due_at,
    v_payload,
    'Inspection update',
    coalesce(new.title, 'Inspection') || ' - ' || coalesce(new.scheduled_date::text, '')
  );

  return new;
end;
$$;

create or replace function public.notify_on_bug_reports_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_event_key text;
  v_payload jsonb;
begin
  v_tenant_id := new.tenant_id;
  if v_tenant_id is null then
    return new;
  end if;

  v_event_key := format('bug:%s:%s', new.id, coalesce(new.created_at::text, timezone('utc', now())::text));
  v_payload := jsonb_build_object(
    'entity', 'bug',
    'bug', jsonb_build_object(
      'id', new.id,
      'screen', new.screen,
      'screenLabel', new.screen_label,
      'recordId', new.record_id,
      'recordLabel', new.record_label,
      'status', new.status,
      'reporterLogin', new.reporter_login,
      'reporterEmail', new.reporter_email,
      'description', new.description,
      'createdAt', new.created_at,
      'updatedAt', new.updated_at
    ),
    'bugReportId', new.id,
    'screen', new.screen,
    'screenLabel', new.screen_label,
    'recordId', new.record_id,
    'recordLabel', new.record_label,
    'status', new.status,
    'reporterLogin', new.reporter_login,
    'reporterEmail', new.reporter_email,
    'description', new.description
  );

  perform public.enqueue_notification_deliveries_for_event(
    v_tenant_id,
    'bug',
    v_event_key,
    timezone('utc', now()),
    v_payload,
    'New bug report',
    'A new bug report has been submitted.'
  );

  return new;
end;
$$;

create or replace function public.seed_default_notification_templates(p_tenant_id uuid)
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

  insert into public.notification_templates (
    tenant_id,
    id,
    name,
    channel,
    event_type,
    content_type,
    description,
    subject,
    content,
    created_at,
    updated_at
  )
  select
    p_tenant_id,
    template_defaults.id,
    template_defaults.name,
    template_defaults.channel,
    template_defaults.event_type,
    template_defaults.content_type,
    template_defaults.description,
    template_defaults.subject,
    template_defaults.content,
    v_now,
    v_now
  from (
    values
      ('default-email-appointment-items', 'Appointment reminder - Email', 'email', 'appointments', 'html', 'HTML email sent for scheduled appointments.', 'Appointment reminder: {{appointment.title}}', $html$<p>You have a scheduled appointment.</p>
<p><strong>Title:</strong> {{appointment.title}}</p>
<p><strong>Date:</strong> {{appointment.date}}</p>
<p><strong>Time:</strong> {{appointment.time}}</p>
<p><strong>Status:</strong> {{appointment.status}}</p>$html$),
      ('default-sms-appointment-items', 'Appointment reminder - SMS', 'sms', 'appointments', 'text', 'Plain-text SMS sent for scheduled appointments.', null, $text$Appointment reminder
Title: {{appointment.title}}
Date: {{appointment.date}}
Time: {{appointment.time}}
Status: {{appointment.status}}$text$),
      ('default-whatsapp-appointment-items', 'Appointment reminder - WhatsApp', 'whatsapp', 'appointments', 'text', 'Plain-text WhatsApp message sent for scheduled appointments.', null, $text$Appointment reminder
Title: {{appointment.title}}
Date: {{appointment.date}}
Time: {{appointment.time}}
Status: {{appointment.status}}$text$),

      ('default-email-contract-created', 'Contract created - Email', 'email', 'contracts', 'html', 'HTML email sent when a contract is created.', 'New contract: {{contract.id}}', $html$<p>A new contract was created.</p>
<p><strong>Contract:</strong> {{contract.id}}</p>
<p><strong>Status:</strong> {{contract.status}}</p>
<p><strong>Start date:</strong> {{contract.startDate}}</p>
<p><strong>End date:</strong> {{contract.endDate}}</p>$html$),
      ('default-sms-contract-created', 'Contract created - SMS', 'sms', 'contracts', 'text', 'Plain-text SMS sent when a contract is created.', null, $text$New contract created
Contract: {{contract.id}}
Status: {{contract.status}}
Start date: {{contract.startDate}}
End date: {{contract.endDate}}$text$),
      ('default-whatsapp-contract-created', 'Contract created - WhatsApp', 'whatsapp', 'contracts', 'text', 'Plain-text WhatsApp message sent when a contract is created.', null, $text$New contract created
Contract: {{contract.id}}
Status: {{contract.status}}
Start date: {{contract.startDate}}
End date: {{contract.endDate}}$text$),

      ('default-email-contract-expiration', 'Contract expiration - Email', 'email', 'contracts', 'html', 'HTML email sent when a contract is approaching expiration.', 'Contract expiring: {{contract.id}}', $html$<p>A contract is approaching expiration.</p>
<p><strong>Contract:</strong> {{contract.id}}</p>
<p><strong>End date:</strong> {{contract.endDate}}</p>
<p><strong>Status:</strong> {{contract.status}}</p>$html$),
      ('default-sms-contract-expiration', 'Contract expiration - SMS', 'sms', 'contracts', 'text', 'Plain-text SMS sent when a contract is approaching expiration.', null, $text$Contract approaching expiration
Contract: {{contract.id}}
End date: {{contract.endDate}}
Status: {{contract.status}}$text$),
      ('default-whatsapp-contract-expiration', 'Contract expiration - WhatsApp', 'whatsapp', 'contracts', 'text', 'Plain-text WhatsApp message sent when a contract is approaching expiration.', null, $text$Contract approaching expiration
Contract: {{contract.id}}
End date: {{contract.endDate}}
Status: {{contract.status}}$text$),

      ('default-email-contract-payment-day', 'Contract payment day - Email', 'email', 'contracts', 'html', 'HTML email sent when a contract payment day is approaching.', 'Payment day: {{contract.id}}', $html$<p>A contract payment day is approaching.</p>
<p><strong>Contract:</strong> {{contract.id}}</p>
<p><strong>Payment due day:</strong> {{contract.paymentDueDay}}</p>
<p><strong>Monthly amount:</strong> {{contract.monthlyAmount}}</p>$html$),
      ('default-sms-contract-payment-day', 'Contract payment day - SMS', 'sms', 'contracts', 'text', 'Plain-text SMS sent when a contract payment day is approaching.', null, $text$Contract payment day
Contract: {{contract.id}}
Payment due day: {{contract.paymentDueDay}}
Monthly amount: {{contract.monthlyAmount}}$text$),
      ('default-whatsapp-contract-payment-day', 'Contract payment day - WhatsApp', 'whatsapp', 'contracts', 'text', 'Plain-text WhatsApp message sent when a contract payment day is approaching.', null, $text$Contract payment day
Contract: {{contract.id}}
Payment due day: {{contract.paymentDueDay}}
Monthly amount: {{contract.monthlyAmount}}$text$),

      ('default-email-task-created', 'Task created - Email', 'email', 'tasks', 'html', 'HTML email sent when an open task is created.', 'New task: {{task.title}}', $html$<p>A new task was created in the system.</p>
<p><strong>Task:</strong> {{task.title}}</p>
<p><strong>Due date:</strong> {{task.dueDate}}</p>
<p><strong>Priority:</strong> {{task.priority}}</p>
<p><strong>Property:</strong> {{property.name}}</p>
<p><strong>Description:</strong><br />{{task.description}}</p>$html$),
      ('default-sms-task-created', 'Task created - SMS', 'sms', 'tasks', 'text', 'Plain-text SMS sent when an open task is created.', null, $text$New task created
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}
Property: {{property.name}}$text$),
      ('default-whatsapp-task-created', 'Task created - WhatsApp', 'whatsapp', 'tasks', 'text', 'Plain-text WhatsApp message sent when an open task is created.', null, $text$New task created
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}
Property: {{property.name}}
Description: {{task.description}}$text$),

      ('default-email-task-due-tomorrow', 'Task due tomorrow - Email', 'email', 'tasks', 'html', 'HTML email sent one day before an open task is due.', 'Task due tomorrow: {{task.title}}', $html$<p>This task is due tomorrow.</p>
<p><strong>Task:</strong> {{task.title}}</p>
<p><strong>Due date:</strong> {{task.dueDate}}</p>
<p><strong>Priority:</strong> {{task.priority}}</p>
<p><strong>Property:</strong> {{property.name}}</p>$html$),
      ('default-sms-task-due-tomorrow', 'Task due tomorrow - SMS', 'sms', 'tasks', 'text', 'Plain-text SMS sent one day before an open task is due.', null, $text$Task due tomorrow
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}$text$),
      ('default-whatsapp-task-due-tomorrow', 'Task due tomorrow - WhatsApp', 'whatsapp', 'tasks', 'text', 'Plain-text WhatsApp message sent one day before an open task is due.', null, $text$Task due tomorrow
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}
Property: {{property.name}}$text$),

      ('default-email-task-due-today', 'Task due today - Email', 'email', 'tasks', 'html', 'HTML email sent when an open task is due today.', 'Task due today: {{task.title}}', $html$<p>This task is due today.</p>
<p><strong>Task:</strong> {{task.title}}</p>
<p><strong>Due date:</strong> {{task.dueDate}}</p>
<p><strong>Priority:</strong> {{task.priority}}</p>
<p><strong>Property:</strong> {{property.name}}</p>$html$),
      ('default-sms-task-due-today', 'Task due today - SMS', 'sms', 'tasks', 'text', 'Plain-text SMS sent when an open task is due today.', null, $text$Task due today
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}$text$),
      ('default-whatsapp-task-due-today', 'Task due today - WhatsApp', 'whatsapp', 'tasks', 'text', 'Plain-text WhatsApp message sent when an open task is due today.', null, $text$Task due today
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}
Property: {{property.name}}$text$),

      ('default-email-task-overdue-open', 'Task overdue - Email', 'email', 'tasks', 'html', 'HTML email sent when an open task becomes overdue.', 'Overdue task: {{task.title}}', $html$<p>This open task is overdue.</p>
<p><strong>Task:</strong> {{task.title}}</p>
<p><strong>Due date:</strong> {{task.dueDate}}</p>
<p><strong>Priority:</strong> {{task.priority}}</p>
<p><strong>Property:</strong> {{property.name}}</p>
<p><strong>Description:</strong><br />{{task.description}}</p>$html$),
      ('default-sms-task-overdue-open', 'Task overdue - SMS', 'sms', 'tasks', 'text', 'Plain-text SMS sent when an open task becomes overdue.', null, $text$Overdue task
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}$text$),
      ('default-whatsapp-task-overdue-open', 'Task overdue - WhatsApp', 'whatsapp', 'tasks', 'text', 'Plain-text WhatsApp message sent when an open task becomes overdue.', null, $text$Overdue task
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}
Property: {{property.name}}
Description: {{task.description}}$text$),

      ('default-email-task-resolved', 'Task resolved - Email', 'email', 'tasks', 'html', 'HTML email sent when a task is resolved.', 'Task resolved: {{task.title}}', $html$<p>A task was marked as resolved.</p>
<p><strong>Task:</strong> {{task.title}}</p>
<p><strong>Due date:</strong> {{task.dueDate}}</p>
<p><strong>Status:</strong> {{task.status}}</p>
<p><strong>Property:</strong> {{property.name}}</p>$html$),
      ('default-sms-task-resolved', 'Task resolved - SMS', 'sms', 'tasks', 'text', 'Plain-text SMS sent when a task is resolved.', null, $text$Task resolved
Task: {{task.title}}
Status: {{task.status}}
Property: {{property.name}}$text$),
      ('default-whatsapp-task-resolved', 'Task resolved - WhatsApp', 'whatsapp', 'tasks', 'text', 'Plain-text WhatsApp message sent when a task is resolved.', null, $text$Task resolved
Task: {{task.title}}
Status: {{task.status}}
Property: {{property.name}}$text$),

      ('default-email-inspection', 'Inspection update - Email', 'email', 'inspections', 'html', 'HTML email sent when an inspection changes.', 'Inspection update: {{inspection.title}}', $html$<p>An inspection was updated.</p>
<p><strong>Title:</strong> {{inspection.title}}</p>
<p><strong>Scheduled date:</strong> {{inspection.scheduledDate}}</p>
<p><strong>Status:</strong> {{inspection.status}}</p>
<p><strong>Inspector:</strong> {{inspection.inspectorName}}</p>$html$),
      ('default-sms-inspection', 'Inspection update - SMS', 'sms', 'inspections', 'text', 'Plain-text SMS sent when an inspection changes.', null, $text$Inspection update
Title: {{inspection.title}}
Scheduled date: {{inspection.scheduledDate}}
Status: {{inspection.status}}
Inspector: {{inspection.inspectorName}}$text$),
      ('default-whatsapp-inspection', 'Inspection update - WhatsApp', 'whatsapp', 'inspections', 'text', 'Plain-text WhatsApp message sent when an inspection changes.', null, $text$Inspection update
Title: {{inspection.title}}
Scheduled date: {{inspection.scheduledDate}}
Status: {{inspection.status}}
Inspector: {{inspection.inspectorName}}$text$),

      ('default-email-bug', 'Bug report - Email', 'email', 'bugs', 'html', 'HTML email sent when a bug report is created.', 'Bug report: {{bug.screenLabel}}', $html$<p>A new bug report was submitted.</p>
<p><strong>Screen:</strong> {{bug.screenLabel}}</p>
<p><strong>Status:</strong> {{bug.status}}</p>
<p><strong>Reporter:</strong> {{bug.reporterLogin}}</p>
<p><strong>Record:</strong> {{bug.recordLabel}}</p>$html$),
      ('default-sms-bug', 'Bug report - SMS', 'sms', 'bugs', 'text', 'Plain-text SMS sent when a bug report is created.', null, $text$New bug report
Screen: {{bug.screenLabel}}
Status: {{bug.status}}
Reporter: {{bug.reporterLogin}}
Record: {{bug.recordLabel}}$text$),
      ('default-whatsapp-bug', 'Bug report - WhatsApp', 'whatsapp', 'bugs', 'text', 'Plain-text WhatsApp message sent when a bug report is created.', null, $text$New bug report
Screen: {{bug.screenLabel}}
Status: {{bug.status}}
Reporter: {{bug.reporterLogin}}
Record: {{bug.recordLabel}}$text$),

      ('default-email-user-created', 'User created - Email', 'email', 'user-access', 'html', 'HTML email sent when a new system user profile is created.', 'New user: {{user.githubLogin}}', $html$<p>A new user profile was created.</p>
<p><strong>Login:</strong> {{user.githubLogin}}</p>
<p><strong>Email:</strong> {{user.email}}</p>
<p><strong>Role:</strong> {{group.role}}</p>
<p><strong>Access status:</strong> {{access.status}}</p>$html$),
      ('default-sms-user-created', 'User created - SMS', 'sms', 'user-access', 'text', 'Plain-text SMS sent when a new system user profile is created.', null, $text$New user created
Login: {{user.githubLogin}}
Email: {{user.email}}
Role: {{group.role}}
Access status: {{access.status}}$text$),
      ('default-whatsapp-user-created', 'User created - WhatsApp', 'whatsapp', 'user-access', 'text', 'Plain-text WhatsApp message sent when a new system user profile is created.', null, $text$New user created
Login: {{user.githubLogin}}
Email: {{user.email}}
Role: {{group.role}}
Access status: {{access.status}}$text$),

      ('default-email-user-role-changed', 'User role changed - Email', 'email', 'user-access', 'html', 'HTML email sent when a user changes role/group.', 'User role changed: {{user.githubLogin}}', $html$<p>A user role was updated.</p>
<p><strong>Login:</strong> {{user.githubLogin}}</p>
<p><strong>Previous role:</strong> {{changes.previousRole}}</p>
<p><strong>Current role:</strong> {{changes.currentRole}}</p>
<p><strong>Current access status:</strong> {{access.status}}</p>$html$),
      ('default-sms-user-role-changed', 'User role changed - SMS', 'sms', 'user-access', 'text', 'Plain-text SMS sent when a user changes role/group.', null, $text$User role changed
Login: {{user.githubLogin}}
Previous role: {{changes.previousRole}}
Current role: {{changes.currentRole}}$text$),
      ('default-whatsapp-user-role-changed', 'User role changed - WhatsApp', 'whatsapp', 'user-access', 'text', 'Plain-text WhatsApp message sent when a user changes role/group.', null, $text$User role changed
Login: {{user.githubLogin}}
Previous role: {{changes.previousRole}}
Current role: {{changes.currentRole}}$text$),

      ('default-email-user-access-approved', 'User access approved - Email', 'email', 'user-access', 'html', 'HTML email sent when a user access request is approved.', 'Access approved: {{user.githubLogin}}', $html$<p>User access was approved.</p>
<p><strong>Login:</strong> {{user.githubLogin}}</p>
<p><strong>Email:</strong> {{user.email}}</p>
<p><strong>Role:</strong> {{group.role}}</p>
<p><strong>Status:</strong> {{access.status}}</p>$html$),
      ('default-sms-user-access-approved', 'User access approved - SMS', 'sms', 'user-access', 'text', 'Plain-text SMS sent when a user access request is approved.', null, $text$User access approved
Login: {{user.githubLogin}}
Role: {{group.role}}
Status: {{access.status}}$text$),
      ('default-whatsapp-user-access-approved', 'User access approved - WhatsApp', 'whatsapp', 'user-access', 'text', 'Plain-text WhatsApp message sent when a user access request is approved.', null, $text$User access approved
Login: {{user.githubLogin}}
Role: {{group.role}}
Status: {{access.status}}$text$),

      ('default-email-user-access-rejected', 'User access rejected - Email', 'email', 'user-access', 'html', 'HTML email sent when a user access request is rejected.', 'Access rejected: {{user.githubLogin}}', $html$<p>User access was rejected.</p>
<p><strong>Login:</strong> {{user.githubLogin}}</p>
<p><strong>Email:</strong> {{user.email}}</p>
<p><strong>Role:</strong> {{group.role}}</p>
<p><strong>Status:</strong> {{access.status}}</p>$html$),
      ('default-sms-user-access-rejected', 'User access rejected - SMS', 'sms', 'user-access', 'text', 'Plain-text SMS sent when a user access request is rejected.', null, $text$User access rejected
Login: {{user.githubLogin}}
Role: {{group.role}}
Status: {{access.status}}$text$),
      ('default-whatsapp-user-access-rejected', 'User access rejected - WhatsApp', 'whatsapp', 'user-access', 'text', 'Plain-text WhatsApp message sent when a user access request is rejected.', null, $text$User access rejected
Login: {{user.githubLogin}}
Role: {{group.role}}
Status: {{access.status}}$text$)
  ) as template_defaults(
    id,
    name,
    channel,
    event_type,
    content_type,
    description,
    subject,
    content
  )
  where exists (
    select 1
    from public.tenants tenant_row
    where tenant_row.id = p_tenant_id
  )
  on conflict (tenant_id, id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

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
    true,
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

select public.seed_default_notification_templates(id)
from public.tenants;

select public.seed_default_notification_rules(id)
from public.tenants;
