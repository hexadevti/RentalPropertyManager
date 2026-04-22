-- Add structured task assignees and allow task notification rules
-- to deliver directly to the selected assignee contact.

alter table public.tasks
  add column if not exists assignee_type text,
  add column if not exists assignee_id text;

alter table public.tasks
  drop constraint if exists tasks_assignee_type_check;

alter table public.tasks
  add constraint tasks_assignee_type_check
  check (assignee_type is null or assignee_type in ('owner', 'guest', 'service-provider'));

alter table public.tasks
  drop constraint if exists tasks_assignee_reference_check;

alter table public.tasks
  add constraint tasks_assignee_reference_check
  check (
    (assignee_type is null and assignee_id is null)
    or (assignee_type is not null and assignee_id is not null)
  );

create index if not exists idx_tasks_tenant_assignee_reference
  on public.tasks(tenant_id, assignee_type, assignee_id);

alter table public.notification_rules
  add column if not exists send_to_task_assignee boolean not null default false;

create or replace function public.enqueue_notification_deliveries_for_event(
  p_tenant_id uuid,
  p_event_trigger text,
  p_event_key text,
  p_event_at timestamptz,
  p_payload jsonb default '{}'::jsonb,
  p_default_subject text default null,
  p_default_message text default ''
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  if p_tenant_id is null or p_event_trigger is null or p_event_key is null then
    return 0;
  end if;

  with matching_rules as (
    select
      nr.tenant_id,
      nr.id as rule_id,
      nr.channels,
      nr.email_template_id,
      nr.sms_template_id,
      nr.whatsapp_template_id,
      nr.recipient_roles,
      nr.recipient_user_ids,
      nr.send_to_task_assignee,
      coalesce(nr.days_before, 0) as days_before
    from public.notification_rules nr
    where nr.tenant_id = p_tenant_id
      and nr.is_active = true
      and nr.trigger = p_event_trigger
  ),
  resolved_user_recipients as (
    select distinct
      r.tenant_id,
      r.rule_id,
      up.auth_user_id as recipient_user_id,
      up.github_login as recipient_login,
      nullif(up.email, '') as recipient_email,
      null::text as recipient_phone,
      r.channels,
      r.email_template_id,
      r.sms_template_id,
      r.whatsapp_template_id,
      r.days_before
    from matching_rules r
    join public.user_profiles up
      on up.tenant_id = r.tenant_id
     and up.status = 'approved'
    where (
      exists (
        select 1
        from jsonb_array_elements_text(coalesce(r.recipient_roles, '[]'::jsonb)) role_item(role_value)
        where role_item.role_value = up.role
      )
      or (
        up.auth_user_id is not null
        and exists (
          select 1
          from jsonb_array_elements_text(coalesce(r.recipient_user_ids, '[]'::jsonb)) user_item(user_value)
          where user_item.user_value = up.auth_user_id::text
        )
      )
    )
  ),
  resolved_task_assignee_recipients as (
    select distinct
      r.tenant_id,
      r.rule_id,
      null::uuid as recipient_user_id,
      coalesce(nullif(p_payload #>> '{task,assignee,name}', ''), nullif(p_payload #>> '{task,assigneeName}', '')) as recipient_login,
      nullif(p_payload #>> '{task,assignee,email}', '') as recipient_email,
      nullif(p_payload #>> '{task,assignee,phone}', '') as recipient_phone,
      r.channels,
      r.email_template_id,
      r.sms_template_id,
      r.whatsapp_template_id,
      r.days_before
    from matching_rules r
    where r.send_to_task_assignee = true
      and (
        nullif(p_payload #>> '{task,assignee,email}', '') is not null
        or nullif(p_payload #>> '{task,assignee,phone}', '') is not null
      )
  ),
  resolved_recipients as (
    select * from resolved_user_recipients
    union all
    select * from resolved_task_assignee_recipients
  ),
  expanded_channels as (
    select
      rr.tenant_id,
      rr.rule_id,
      rr.recipient_user_id,
      rr.recipient_login,
      case
        when channel_item.channel_value = 'email' then rr.recipient_email
        when channel_item.channel_value in ('sms', 'whatsapp') then rr.recipient_phone
        else null
      end as recipient_destination,
      rr.days_before,
      channel_item.channel_value as channel,
      case channel_item.channel_value
        when 'email' then rr.email_template_id
        when 'sms' then rr.sms_template_id
        when 'whatsapp' then rr.whatsapp_template_id
        else null
      end as template_id
    from resolved_recipients rr
    cross join lateral jsonb_array_elements_text(coalesce(rr.channels, '[]'::jsonb)) channel_item(channel_value)
    where channel_item.channel_value in ('email', 'sms', 'whatsapp')
  ),
  message_source as (
    select
      ec.tenant_id,
      ec.rule_id,
      ec.recipient_user_id,
      ec.recipient_login,
      ec.recipient_destination,
      ec.channel,
      ec.template_id,
      ec.days_before,
      nt.subject as template_subject,
      nt.content as template_content,
      nt.content_type as template_content_type
    from expanded_channels ec
    left join public.notification_templates nt
      on nt.tenant_id = ec.tenant_id
     and nt.id = ec.template_id
    where nullif(ec.recipient_destination, '') is not null
  )
  insert into public.notification_deliveries (
    tenant_id,
    rule_id,
    template_id,
    channel,
    recipient_user_id,
    recipient_login,
    recipient_destination,
    subject,
    message_body,
    content_type,
    payload,
    next_attempt_at
  )
  select
    ms.tenant_id,
    ms.rule_id,
    ms.template_id,
    ms.channel,
    ms.recipient_user_id,
    ms.recipient_login,
    ms.recipient_destination,
    case
      when ms.channel = 'email' then coalesce(nullif(ms.template_subject, ''), p_default_subject, initcap(replace(p_event_trigger, '-', ' ')))
      else null
    end as subject,
    coalesce(nullif(ms.template_content, ''), p_default_message, initcap(replace(p_event_trigger, '-', ' '))) as message_body,
    coalesce(nullif(ms.template_content_type, ''), case when ms.channel = 'email' then 'html' else 'text' end) as content_type,
    coalesce(p_payload, '{}'::jsonb)
      || jsonb_build_object(
        'trigger', p_event_trigger,
        'eventKey', p_event_key
      ) as payload,
    greatest(
      timezone('utc', now()),
      coalesce(p_event_at, timezone('utc', now())) - make_interval(days => greatest(0, ms.days_before))
    ) as next_attempt_at
  from message_source ms
  where not exists (
    select 1
    from public.notification_deliveries d
    where d.tenant_id = ms.tenant_id
      and d.rule_id = ms.rule_id
      and d.channel = ms.channel
      and lower(coalesce(d.recipient_destination, '')) = lower(coalesce(ms.recipient_destination, ''))
      and d.payload->>'eventKey' = p_event_key
      and d.status in ('pending', 'processing', 'sent')
  );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.enqueue_notification_deliveries_for_event(uuid, text, text, timestamptz, jsonb, text, text) from public;
grant execute on function public.enqueue_notification_deliveries_for_event(uuid, text, text, timestamptz, jsonb, text, text) to authenticated;
grant execute on function public.enqueue_notification_deliveries_for_event(uuid, text, text, timestamptz, jsonb, text, text) to service_role;

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
  v_assignee jsonb := null;
  v_payload jsonb;
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

  if new.assignee_type is not null and new.assignee_id is not null then
    if new.assignee_type = 'owner' then
      select jsonb_build_object(
        'id', owner_row.id,
        'type', 'owner',
        'name', owner_row.name,
        'email', nullif(owner_row.email, ''),
        'phone', nullif(owner_row.phone, '')
      )
      into v_assignee
      from public.owners owner_row
      where owner_row.tenant_id = new.tenant_id
        and owner_row.id = new.assignee_id
      limit 1;
    elsif new.assignee_type = 'guest' then
      select jsonb_build_object(
        'id', guest_row.id,
        'type', 'guest',
        'name', guest_row.name,
        'email', nullif(guest_row.email, ''),
        'phone', nullif(guest_row.phone, '')
      )
      into v_assignee
      from public.guests guest_row
      where guest_row.tenant_id = new.tenant_id
        and guest_row.id = new.assignee_id
      limit 1;
    elsif new.assignee_type = 'service-provider' then
      select jsonb_build_object(
        'id', service_provider_row.id,
        'type', 'service-provider',
        'name', service_provider_row.name,
        'email', nullif(service_provider_row.email, ''),
        'phone', nullif(service_provider_row.contact, '')
      )
      into v_assignee
      from public.service_providers service_provider_row
      where service_provider_row.tenant_id = new.tenant_id
        and service_provider_row.id = new.assignee_id
      limit 1;
    end if;
  end if;

  if v_assignee is null and new.assignee is not null then
    v_assignee := jsonb_build_object(
      'id', new.assignee_id,
      'type', new.assignee_type,
      'name', new.assignee,
      'email', null,
      'phone', null
    );
  end if;

  v_payload := jsonb_build_object(
    'entity', 'task',
    'task', jsonb_build_object(
      'id', new.id,
      'title', new.title,
      'description', new.description,
      'dueDate', new.due_date,
      'priority', new.priority,
      'status', new.status,
      'assignee', v_assignee,
      'assigneeName', new.assignee,
      'assigneeType', new.assignee_type,
      'assigneeId', new.assignee_id,
      'propertyId', new.property_id,
      'createdAt', new.created_at,
      'updatedAt', new.updated_at
    ),
    'property', coalesce(v_property, '{}'::jsonb)
  );

  if tg_op = 'INSERT' and not v_is_completed then
    v_event_key := format('task-created:%s:%s', new.id, coalesce(new.created_at::text, timezone('utc', now())::text));

    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'task-created',
      v_event_key,
      timezone('utc', now()),
      v_payload || jsonb_build_object('condition', 'task-created'),
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
      v_payload || jsonb_build_object('condition', 'task-resolved'),
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
      v_payload || jsonb_build_object('condition', 'task-due-tomorrow'),
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
      v_payload || jsonb_build_object('condition', 'task-due-today'),
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
      v_payload || jsonb_build_object('condition', 'task-overdue-open'),
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
