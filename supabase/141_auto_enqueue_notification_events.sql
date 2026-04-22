-- Auto-enqueue notification deliveries from core business events.
-- Events covered:
-- - appointment-items
-- - contract-created
-- - contract-expiration
-- - contract-payment-day
-- - task-due
-- - inspection
-- - bug

create index if not exists idx_notification_deliveries_event_key
  on public.notification_deliveries (tenant_id, rule_id, channel, ((payload->>'eventKey')));

create or replace function public.notification_parse_date_text(p_value text)
returns date
language plpgsql
immutable
as $$
declare
  v_date date;
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;

  if p_value ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      v_date := p_value::date;
      return v_date;
    exception when others then
      return null;
    end;
  end if;

  return null;
end;
$$;

create or replace function public.notification_date_to_utc_ts(p_date date, p_hour integer default 9)
returns timestamptz
language sql
immutable
as $$
  select
    case
      when p_date is null then null
      else make_timestamptz(
        extract(year from p_date)::int,
        extract(month from p_date)::int,
        extract(day from p_date)::int,
        greatest(0, least(23, coalesce(p_hour, 9))),
        0,
        0,
        'UTC'
      )
    end;
$$;

create or replace function public.notification_appointment_due_at(p_date_text text, p_time_text text)
returns timestamptz
language plpgsql
immutable
as $$
declare
  v_date date;
  v_hour integer := 9;
  v_minute integer := 0;
begin
  v_date := public.notification_parse_date_text(p_date_text);
  if v_date is null then
    return null;
  end if;

  if p_time_text is not null and p_time_text ~ '^\d{2}:\d{2}$' then
    v_hour := greatest(0, least(23, split_part(p_time_text, ':', 1)::int));
    v_minute := greatest(0, least(59, split_part(p_time_text, ':', 2)::int));
  end if;

  return make_timestamptz(
    extract(year from v_date)::int,
    extract(month from v_date)::int,
    extract(day from v_date)::int,
    v_hour,
    v_minute,
    0,
    'UTC'
  );
end;
$$;

create or replace function public.notification_next_contract_payment_at(
  p_start_date_text text,
  p_end_date_text text,
  p_payment_due_day integer
)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_start date;
  v_end date;
  v_cursor date;
  v_month_start date;
  v_month_end date;
  v_candidate date;
  v_clamped_day integer;
begin
  v_start := public.notification_parse_date_text(p_start_date_text);
  v_end := public.notification_parse_date_text(p_end_date_text);

  if v_start is null or v_end is null or p_payment_due_day is null then
    return null;
  end if;

  if v_end < v_start then
    return null;
  end if;

  v_cursor := greatest(current_date, v_start);

  while v_cursor <= v_end loop
    v_month_start := date_trunc('month', v_cursor)::date;
    v_month_end := (v_month_start + interval '1 month - 1 day')::date;
    v_clamped_day := least(greatest(1, p_payment_due_day), extract(day from v_month_end)::int);
    v_candidate := make_date(extract(year from v_month_start)::int, extract(month from v_month_start)::int, v_clamped_day);

    if v_candidate >= v_cursor and v_candidate >= v_start and v_candidate <= v_end then
      return public.notification_date_to_utc_ts(v_candidate, 9);
    end if;

    v_cursor := (v_month_start + interval '1 month')::date;
  end loop;

  return null;
end;
$$;

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
      coalesce(nr.days_before, 0) as days_before
    from public.notification_rules nr
    where nr.tenant_id = p_tenant_id
      and nr.is_active = true
      and nr.trigger = p_event_trigger
  ),
  resolved_recipients as (
    select distinct
      r.tenant_id,
      r.rule_id,
      up.auth_user_id as recipient_user_id,
      up.github_login as recipient_login,
      coalesce(nullif(up.email, ''), up.github_login) as recipient_destination,
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
  expanded_channels as (
    select
      rr.tenant_id,
      rr.rule_id,
      rr.recipient_user_id,
      rr.recipient_login,
      rr.recipient_destination,
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
      and rr.recipient_destination is not null
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
      nt.content as template_content
    from expanded_channels ec
    left join public.notification_templates nt
      on nt.tenant_id = ec.tenant_id
     and nt.id = ec.template_id
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
      and coalesce(d.recipient_user_id::text, '') = coalesce(ms.recipient_user_id::text, '')
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

create or replace function public.notify_on_appointments_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due_at timestamptz;
  v_event_key text;
begin
  if new.status <> 'scheduled' then
    return new;
  end if;

  v_due_at := public.notification_appointment_due_at(new.date, new.time);
  v_event_key := format('appointment:%s:%s:%s:%s', new.id, coalesce(new.date, ''), coalesce(new.time, ''), new.status);

  perform public.enqueue_notification_deliveries_for_event(
    new.tenant_id,
    'appointment-items',
    v_event_key,
    v_due_at,
    jsonb_build_object(
      'entity', 'appointment',
      'appointmentId', new.id,
      'title', new.title,
      'date', new.date,
      'time', new.time,
      'status', new.status
    ),
    'Appointment reminder',
    coalesce(new.title, 'Appointment') || ' - ' || coalesce(new.date, '') || ' ' || coalesce(new.time, '')
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_appointments_change on public.appointments;
create trigger trg_notify_appointments_change
after insert or update on public.appointments
for each row
execute function public.notify_on_appointments_change();

create or replace function public.notify_on_tasks_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due_at timestamptz;
  v_event_key text;
begin
  if new.status = 'completed' then
    return new;
  end if;

  v_due_at := public.notification_date_to_utc_ts(public.notification_parse_date_text(new.due_date), 9);
  v_event_key := format('task:%s:%s:%s', new.id, coalesce(new.due_date, ''), new.status);

  perform public.enqueue_notification_deliveries_for_event(
    new.tenant_id,
    'task-due',
    v_event_key,
    v_due_at,
    jsonb_build_object(
      'entity', 'task',
      'taskId', new.id,
      'title', new.title,
      'dueDate', new.due_date,
      'priority', new.priority,
      'status', new.status
    ),
    'Task due',
    coalesce(new.title, 'Task') || ' - due ' || coalesce(new.due_date, '')
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_tasks_change on public.tasks;
create trigger trg_notify_tasks_change
after insert or update on public.tasks
for each row
execute function public.notify_on_tasks_change();

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
begin
  if tg_op = 'INSERT' then
    v_event_key := format('contract-created:%s:%s', new.id, coalesce(new.created_at::text, timezone('utc', now())::text));
    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'contract-created',
      v_event_key,
      timezone('utc', now()),
      jsonb_build_object(
        'entity', 'contract',
        'contractId', new.id,
        'guestId', new.guest_id,
        'status', new.status,
        'startDate', new.start_date,
        'endDate', new.end_date,
        'paymentDueDay', new.payment_due_day
      ),
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
      jsonb_build_object(
        'entity', 'contract',
        'contractId', new.id,
        'guestId', new.guest_id,
        'status', new.status,
        'endDate', new.end_date
      ),
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
      jsonb_build_object(
        'entity', 'contract',
        'contractId', new.id,
        'guestId', new.guest_id,
        'status', new.status,
        'startDate', new.start_date,
        'endDate', new.end_date,
        'paymentDueDay', new.payment_due_day,
        'monthlyAmount', new.monthly_amount
      ),
      'Contract payment day',
      'Contract payment due date is approaching.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_contracts_change on public.contracts;
create trigger trg_notify_contracts_change
after insert or update on public.contracts
for each row
execute function public.notify_on_contracts_change();

create or replace function public.notify_on_inspections_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_key text;
  v_due_at timestamptz;
begin
  v_due_at := public.notification_date_to_utc_ts(new.scheduled_date, 9);
  v_event_key := format('inspection:%s:%s:%s', new.id, coalesce(new.scheduled_date::text, ''), new.status);

  perform public.enqueue_notification_deliveries_for_event(
    new.tenant_id,
    'inspection',
    v_event_key,
    v_due_at,
    jsonb_build_object(
      'entity', 'inspection',
      'inspectionId', new.id,
      'propertyId', new.property_id,
      'contractId', new.contract_id,
      'title', new.title,
      'type', new.type,
      'status', new.status,
      'scheduledDate', new.scheduled_date
    ),
    'Inspection update',
    coalesce(new.title, 'Inspection') || ' - ' || coalesce(new.scheduled_date::text, '')
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_inspections_change on public.inspections;
create trigger trg_notify_inspections_change
after insert or update on public.inspections
for each row
execute function public.notify_on_inspections_change();

create or replace function public.notify_on_bug_reports_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_event_key text;
begin
  v_tenant_id := new.tenant_id;
  if v_tenant_id is null then
    return new;
  end if;

  v_event_key := format('bug:%s:%s', new.id, coalesce(new.created_at::text, timezone('utc', now())::text));

  perform public.enqueue_notification_deliveries_for_event(
    v_tenant_id,
    'bug',
    v_event_key,
    timezone('utc', now()),
    jsonb_build_object(
      'entity', 'bug',
      'bugReportId', new.id,
      'screen', new.screen,
      'screenLabel', new.screen_label,
      'recordId', new.record_id,
      'recordLabel', new.record_label,
      'status', new.status,
      'reporterLogin', new.reporter_login
    ),
    'New bug report',
    'A new bug report has been submitted.'
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_bug_reports_insert on public.bug_reports;
create trigger trg_notify_bug_reports_insert
after insert on public.bug_reports
for each row
execute function public.notify_on_bug_reports_insert();
