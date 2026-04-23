-- Two issues caused duplicate notification deliveries:
--
-- 1. resolved_recipients used UNION ALL across three CTEs. When the same email
--    matched both resolved_user_recipients (via recipient_roles) AND
--    resolved_event_recipients (via send_to_event_recipient), two deliveries
--    were inserted for the same rule + channel + destination.
--
-- 2. The eventKey for user-password-reset included new Date().toISOString()
--    (millisecond precision), making every call unique and bypassing the
--    existing dedup check. Fixed in the edge function (slice to minute precision).
--
-- Fix: wrap the three-way UNION ALL in a subquery and apply DISTINCT ON
-- (rule_id, channel-destination) so each recipient can only appear once per rule.

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
      nr.send_to_event_recipient,
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
  resolved_event_recipients as (
    select distinct
      r.tenant_id,
      r.rule_id,
      case
        when coalesce(p_payload #>> '{notificationRecipient,authUserId}', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (p_payload #>> '{notificationRecipient,authUserId}')::uuid
        else null::uuid
      end as recipient_user_id,
      coalesce(
        nullif(p_payload #>> '{notificationRecipient,login}', ''),
        nullif(p_payload #>> '{notificationRecipient,name}', ''),
        nullif(p_payload #>> '{user,githubLogin}', '')
      ) as recipient_login,
      nullif(p_payload #>> '{notificationRecipient,email}', '') as recipient_email,
      nullif(p_payload #>> '{notificationRecipient,phone}', '') as recipient_phone,
      r.channels,
      r.email_template_id,
      r.sms_template_id,
      r.whatsapp_template_id,
      r.days_before
    from matching_rules r
    where r.send_to_event_recipient = true
      and (
        nullif(p_payload #>> '{notificationRecipient,email}', '') is not null
        or nullif(p_payload #>> '{notificationRecipient,phone}', '') is not null
      )
  ),
  -- Merge all recipient sources and deduplicate so the same email/phone is
  -- only enqueued once per rule, even if it appears in multiple CTEs above.
  resolved_recipients as (
    select distinct on (rule_id, lower(coalesce(recipient_email, '')), lower(coalesce(recipient_phone, '')))
      *
    from (
      select * from resolved_user_recipients
      union all
      select * from resolved_task_assignee_recipients
      union all
      select * from resolved_event_recipients
    ) all_recipients
    order by rule_id,
             lower(coalesce(recipient_email, '')),
             lower(coalesce(recipient_phone, ''))
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
