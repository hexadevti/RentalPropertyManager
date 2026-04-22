-- Task notification conditions and master header/footer templates.

-- 1) Expand supported triggers in notification rules.
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
    'contract-created',
    'inspection',
    'bug'
  ));

-- 2) Tenant-scoped master template per channel.
create table if not exists public.notification_master_templates (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  header_content text not null default '',
  footer_content text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, channel)
);

drop trigger if exists notification_master_templates_set_updated_at on public.notification_master_templates;
create trigger notification_master_templates_set_updated_at
before update on public.notification_master_templates
for each row execute function public.set_updated_at();

alter table public.notification_master_templates enable row level security;

drop policy if exists notification_master_templates_all on public.notification_master_templates;
create policy notification_master_templates_all on public.notification_master_templates
  for all to authenticated
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

-- 3) Replace tasks trigger function with condition-aware enqueue.
create or replace function public.notify_on_tasks_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due_date date;
  v_due_at timestamptz;
  v_event_key text;
  v_now_date date := timezone('utc', now())::date;
  v_property jsonb := null;
begin
  if new.status = 'completed' then
    return new;
  end if;

  v_due_date := public.notification_parse_date_text(new.due_date);
  v_due_at := public.notification_date_to_utc_ts(v_due_date, 9);

  if new.property_id is not null then
    select jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'type', p.type,
      'status', p.status,
      'address', p.address,
      'city', p.city
    )
    into v_property
    from public.properties p
    where p.tenant_id = new.tenant_id
      and p.id = new.property_id
    limit 1;
  end if;

  if tg_op = 'INSERT' then
    v_event_key := format('task-created:%s:%s', new.id, coalesce(new.created_at::text, timezone('utc', now())::text));

    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'task-created',
      v_event_key,
      timezone('utc', now()),
      jsonb_build_object(
        'entity', 'task',
        'condition', 'task-created',
        'task', jsonb_build_object(
          'id', new.id,
          'title', new.title,
          'description', new.description,
          'dueDate', new.due_date,
          'priority', new.priority,
          'status', new.status,
          'assignee', new.assignee,
          'propertyId', new.property_id
        ),
        'property', coalesce(v_property, '{}'::jsonb)
      ),
      'New task',
      coalesce(new.title, 'Task') || ' - created'
    );
  end if;

  if v_due_date = (v_now_date + 1) then
    v_event_key := format('task-due-tomorrow:%s:%s:%s', new.id, coalesce(new.due_date, ''), new.status);

    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'task-due-tomorrow',
      v_event_key,
      v_due_at,
      jsonb_build_object(
        'entity', 'task',
        'condition', 'task-due-tomorrow',
        'task', jsonb_build_object(
          'id', new.id,
          'title', new.title,
          'description', new.description,
          'dueDate', new.due_date,
          'priority', new.priority,
          'status', new.status,
          'assignee', new.assignee,
          'propertyId', new.property_id
        ),
        'property', coalesce(v_property, '{}'::jsonb)
      ),
      'Task due tomorrow',
      coalesce(new.title, 'Task') || ' - due tomorrow'
    );
  end if;

  if v_due_date = v_now_date then
    v_event_key := format('task-due-today:%s:%s:%s', new.id, coalesce(new.due_date, ''), new.status);

    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'task-due-today',
      v_event_key,
      v_due_at,
      jsonb_build_object(
        'entity', 'task',
        'condition', 'task-due-today',
        'task', jsonb_build_object(
          'id', new.id,
          'title', new.title,
          'description', new.description,
          'dueDate', new.due_date,
          'priority', new.priority,
          'status', new.status,
          'assignee', new.assignee,
          'propertyId', new.property_id
        ),
        'property', coalesce(v_property, '{}'::jsonb)
      ),
      'Task due today',
      coalesce(new.title, 'Task') || ' - due today'
    );
  end if;

  if v_due_date is not null and v_due_date < v_now_date then
    v_event_key := format('task-overdue-open:%s:%s:%s', new.id, coalesce(new.due_date, ''), new.status);

    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'task-overdue-open',
      v_event_key,
      timezone('utc', now()),
      jsonb_build_object(
        'entity', 'task',
        'condition', 'task-overdue-open',
        'task', jsonb_build_object(
          'id', new.id,
          'title', new.title,
          'description', new.description,
          'dueDate', new.due_date,
          'priority', new.priority,
          'status', new.status,
          'assignee', new.assignee,
          'propertyId', new.property_id
        ),
        'property', coalesce(v_property, '{}'::jsonb)
      ),
      'Task overdue',
      coalesce(new.title, 'Task') || ' - overdue'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_tasks_change on public.tasks;
create trigger trg_notify_tasks_change
after insert or update on public.tasks
for each row
execute function public.notify_on_tasks_change();
