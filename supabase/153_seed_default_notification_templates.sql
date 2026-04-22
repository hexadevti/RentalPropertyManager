-- Seed reusable default notification templates for existing and future tenants.

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
      (
        'default-email-task-created',
        'Task created - Email',
        'email',
        'tasks',
        'html',
        'HTML email sent when an open task is created.',
        'New task: {{task.title}}',
        $html$<p>A new task was created in the system.</p>
<p><strong>Task:</strong> {{task.title}}</p>
<p><strong>Due date:</strong> {{task.dueDate}}</p>
<p><strong>Priority:</strong> {{task.priority}}</p>
<p><strong>Property:</strong> {{property.name}}</p>
<p><strong>Description:</strong><br />{{task.description}}</p>$html$
      ),
      (
        'default-sms-task-created',
        'Task created - SMS',
        'sms',
        'tasks',
        'text',
        'Plain-text SMS sent when an open task is created.',
        null,
        $text$New task created
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}
Property: {{property.name}}$text$
      ),
      (
        'default-whatsapp-task-created',
        'Task created - WhatsApp',
        'whatsapp',
        'tasks',
        'text',
        'Plain-text WhatsApp message sent when an open task is created.',
        null,
        $text$New task created
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}
Property: {{property.name}}
Description: {{task.description}}$text$
      ),
      (
        'default-email-task-due-tomorrow',
        'Task due tomorrow - Email',
        'email',
        'tasks',
        'html',
        'HTML email sent one day before an open task is due.',
        'Task due tomorrow: {{task.title}}',
        $html$<p>This task is due tomorrow.</p>
<p><strong>Task:</strong> {{task.title}}</p>
<p><strong>Due date:</strong> {{task.dueDate}}</p>
<p><strong>Priority:</strong> {{task.priority}}</p>
<p><strong>Property:</strong> {{property.name}}</p>$html$
      ),
      (
        'default-sms-task-due-tomorrow',
        'Task due tomorrow - SMS',
        'sms',
        'tasks',
        'text',
        'Plain-text SMS sent one day before an open task is due.',
        null,
        $text$Task due tomorrow
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}$text$
      ),
      (
        'default-whatsapp-task-due-tomorrow',
        'Task due tomorrow - WhatsApp',
        'whatsapp',
        'tasks',
        'text',
        'Plain-text WhatsApp message sent one day before an open task is due.',
        null,
        $text$Task due tomorrow
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}
Property: {{property.name}}$text$
      ),
      (
        'default-email-task-due-today',
        'Task due today - Email',
        'email',
        'tasks',
        'html',
        'HTML email sent when an open task is due today.',
        'Task due today: {{task.title}}',
        $html$<p>This task is due today.</p>
<p><strong>Task:</strong> {{task.title}}</p>
<p><strong>Due date:</strong> {{task.dueDate}}</p>
<p><strong>Priority:</strong> {{task.priority}}</p>
<p><strong>Property:</strong> {{property.name}}</p>$html$
      ),
      (
        'default-sms-task-due-today',
        'Task due today - SMS',
        'sms',
        'tasks',
        'text',
        'Plain-text SMS sent when an open task is due today.',
        null,
        $text$Task due today
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}$text$
      ),
      (
        'default-whatsapp-task-due-today',
        'Task due today - WhatsApp',
        'whatsapp',
        'tasks',
        'text',
        'Plain-text WhatsApp message sent when an open task is due today.',
        null,
        $text$Task due today
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}
Property: {{property.name}}$text$
      ),
      (
        'default-email-task-overdue-open',
        'Task overdue - Email',
        'email',
        'tasks',
        'html',
        'HTML email sent when an open task becomes overdue.',
        'Overdue task: {{task.title}}',
        $html$<p>This open task is overdue.</p>
<p><strong>Task:</strong> {{task.title}}</p>
<p><strong>Due date:</strong> {{task.dueDate}}</p>
<p><strong>Priority:</strong> {{task.priority}}</p>
<p><strong>Property:</strong> {{property.name}}</p>
<p><strong>Description:</strong><br />{{task.description}}</p>$html$
      ),
      (
        'default-sms-task-overdue-open',
        'Task overdue - SMS',
        'sms',
        'tasks',
        'text',
        'Plain-text SMS sent when an open task becomes overdue.',
        null,
        $text$Overdue task
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}$text$
      ),
      (
        'default-whatsapp-task-overdue-open',
        'Task overdue - WhatsApp',
        'whatsapp',
        'tasks',
        'text',
        'Plain-text WhatsApp message sent when an open task becomes overdue.',
        null,
        $text$Overdue task
Task: {{task.title}}
Due date: {{task.dueDate}}
Priority: {{task.priority}}
Property: {{property.name}}
Description: {{task.description}}$text$
      ),
      (
        'default-email-task-resolved',
        'Task resolved - Email',
        'email',
        'tasks',
        'html',
        'HTML email sent when a task is resolved.',
        'Task resolved: {{task.title}}',
        $html$<p>A task was marked as resolved.</p>
<p><strong>Task:</strong> {{task.title}}</p>
<p><strong>Due date:</strong> {{task.dueDate}}</p>
<p><strong>Status:</strong> {{task.status}}</p>
<p><strong>Property:</strong> {{property.name}}</p>$html$
      ),
      (
        'default-sms-task-resolved',
        'Task resolved - SMS',
        'sms',
        'tasks',
        'text',
        'Plain-text SMS sent when a task is resolved.',
        null,
        $text$Task resolved
Task: {{task.title}}
Status: {{task.status}}
Property: {{property.name}}$text$
      ),
      (
        'default-whatsapp-task-resolved',
        'Task resolved - WhatsApp',
        'whatsapp',
        'tasks',
        'text',
        'Plain-text WhatsApp message sent when a task is resolved.',
        null,
        $text$Task resolved
Task: {{task.title}}
Status: {{task.status}}
Property: {{property.name}}$text$
      ),
      (
        'default-email-user-created',
        'User created - Email',
        'email',
        'user-access',
        'html',
        'HTML email sent when a new system user profile is created.',
        'New user: {{user.githubLogin}}',
        $html$<p>A new user profile was created.</p>
<p><strong>Login:</strong> {{user.githubLogin}}</p>
<p><strong>Email:</strong> {{user.email}}</p>
<p><strong>Role:</strong> {{group.role}}</p>
<p><strong>Access status:</strong> {{access.status}}</p>$html$
      ),
      (
        'default-sms-user-created',
        'User created - SMS',
        'sms',
        'user-access',
        'text',
        'Plain-text SMS sent when a new system user profile is created.',
        null,
        $text$New user created
Login: {{user.githubLogin}}
Email: {{user.email}}
Role: {{group.role}}
Access status: {{access.status}}$text$
      ),
      (
        'default-whatsapp-user-created',
        'User created - WhatsApp',
        'whatsapp',
        'user-access',
        'text',
        'Plain-text WhatsApp message sent when a new system user profile is created.',
        null,
        $text$New user created
Login: {{user.githubLogin}}
Email: {{user.email}}
Role: {{group.role}}
Access status: {{access.status}}$text$
      ),
      (
        'default-email-user-role-changed',
        'User role changed - Email',
        'email',
        'user-access',
        'html',
        'HTML email sent when a user changes role/group.',
        'User role changed: {{user.githubLogin}}',
        $html$<p>A user role was updated.</p>
<p><strong>Login:</strong> {{user.githubLogin}}</p>
<p><strong>Previous role:</strong> {{changes.previousRole}}</p>
<p><strong>Current role:</strong> {{changes.currentRole}}</p>
<p><strong>Current access status:</strong> {{access.status}}</p>$html$
      ),
      (
        'default-sms-user-role-changed',
        'User role changed - SMS',
        'sms',
        'user-access',
        'text',
        'Plain-text SMS sent when a user changes role/group.',
        null,
        $text$User role changed
Login: {{user.githubLogin}}
Previous role: {{changes.previousRole}}
Current role: {{changes.currentRole}}$text$
      ),
      (
        'default-whatsapp-user-role-changed',
        'User role changed - WhatsApp',
        'whatsapp',
        'user-access',
        'text',
        'Plain-text WhatsApp message sent when a user changes role/group.',
        null,
        $text$User role changed
Login: {{user.githubLogin}}
Previous role: {{changes.previousRole}}
Current role: {{changes.currentRole}}$text$
      ),
      (
        'default-email-user-access-approved',
        'User access approved - Email',
        'email',
        'user-access',
        'html',
        'HTML email sent when a user access request is approved.',
        'Access approved: {{user.githubLogin}}',
        $html$<p>User access was approved.</p>
<p><strong>Login:</strong> {{user.githubLogin}}</p>
<p><strong>Email:</strong> {{user.email}}</p>
<p><strong>Role:</strong> {{group.role}}</p>
<p><strong>Status:</strong> {{access.status}}</p>$html$
      ),
      (
        'default-sms-user-access-approved',
        'User access approved - SMS',
        'sms',
        'user-access',
        'text',
        'Plain-text SMS sent when a user access request is approved.',
        null,
        $text$User access approved
Login: {{user.githubLogin}}
Role: {{group.role}}
Status: {{access.status}}$text$
      ),
      (
        'default-whatsapp-user-access-approved',
        'User access approved - WhatsApp',
        'whatsapp',
        'user-access',
        'text',
        'Plain-text WhatsApp message sent when a user access request is approved.',
        null,
        $text$User access approved
Login: {{user.githubLogin}}
Role: {{group.role}}
Status: {{access.status}}$text$
      ),
      (
        'default-email-user-access-rejected',
        'User access rejected - Email',
        'email',
        'user-access',
        'html',
        'HTML email sent when a user access request is rejected.',
        'Access rejected: {{user.githubLogin}}',
        $html$<p>User access was rejected.</p>
<p><strong>Login:</strong> {{user.githubLogin}}</p>
<p><strong>Email:</strong> {{user.email}}</p>
<p><strong>Role:</strong> {{group.role}}</p>
<p><strong>Status:</strong> {{access.status}}</p>$html$
      ),
      (
        'default-sms-user-access-rejected',
        'User access rejected - SMS',
        'sms',
        'user-access',
        'text',
        'Plain-text SMS sent when a user access request is rejected.',
        null,
        $text$User access rejected
Login: {{user.githubLogin}}
Role: {{group.role}}
Status: {{access.status}}$text$
      ),
      (
        'default-whatsapp-user-access-rejected',
        'User access rejected - WhatsApp',
        'whatsapp',
        'user-access',
        'text',
        'Plain-text WhatsApp message sent when a user access request is rejected.',
        null,
        $text$User access rejected
Login: {{user.githubLogin}}
Role: {{group.role}}
Status: {{access.status}}$text$
      )
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

revoke all on function public.seed_default_notification_templates(uuid) from public;
grant execute on function public.seed_default_notification_templates(uuid) to service_role;

create or replace function public.seed_default_notification_templates_on_tenant_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_notification_templates(new.id);
  return new;
end;
$$;

drop trigger if exists trg_seed_default_notification_templates on public.tenants;
create trigger trg_seed_default_notification_templates
after insert on public.tenants
for each row
execute function public.seed_default_notification_templates_on_tenant_insert();

select public.seed_default_notification_templates(id)
from public.tenants;
