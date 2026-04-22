-- Prevent false "task-created" notifications for tasks that are already completed
-- at INSERT time (e.g. resync/upsert scenarios).

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
  v_was_completed boolean := coalesce(old.status, '') = 'completed';
  v_is_completed boolean := coalesce(new.status, '') = 'completed';
begin
  v_due_date := public.notification_parse_date_text(new.due_date);
  v_due_at := public.notification_date_to_utc_ts(v_due_date, 9);

  if new.property_id is not null then
    select jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'type', p.type,
      'address', p.address,
      'city', p.city
    )
    into v_property
    from public.properties p
    where p.tenant_id = new.tenant_id
      and p.id = new.property_id
    limit 1;
  end if;

  -- Only emit task-created for truly open tasks inserted for the first time.
  if tg_op = 'INSERT' and not v_is_completed then
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

  if tg_op = 'UPDATE' and not v_was_completed and v_is_completed then
    v_event_key := format('task-resolved:%s:%s', new.id, coalesce(new.updated_at::text, timezone('utc', now())::text));

    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'task-resolved',
      v_event_key,
      timezone('utc', now()),
      jsonb_build_object(
        'entity', 'task',
        'condition', 'task-resolved',
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
      'Task resolved',
      coalesce(new.title, 'Task') || ' - resolved'
    );
  end if;

  if v_is_completed then
    return new;
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
exception when others then
  raise warning 'notify_on_tasks_change failed for task % (tenant %): %', new.id, new.tenant_id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_tasks_change on public.tasks;
create trigger trg_notify_tasks_change
after insert or update on public.tasks
for each row
execute function public.notify_on_tasks_change();
