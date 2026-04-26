-- Fix: SMS and WhatsApp notifications were using email as recipient_destination.
-- The function now resolves the correct destination per channel:
--   email    → user's email address
--   sms      → user's phone (skipped if null/empty)
--   whatsapp → user's phone (skipped if null/empty)

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
      -- Email destination: always the email address
      coalesce(nullif(up.email, ''), up.github_login) as email_destination,
      -- Phone destination: the phone field (may be null)
      nullif(trim(coalesce(up.phone, '')), '') as phone_destination,
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
      -- Resolve destination by channel: email → email_destination, sms/whatsapp → phone_destination
      case channel_item.channel_value
        when 'email'     then rr.email_destination
        when 'sms'       then rr.phone_destination
        when 'whatsapp'  then rr.phone_destination
        else null
      end as recipient_destination,
      rr.days_before,
      channel_item.channel_value as channel,
      case channel_item.channel_value
        when 'email'     then rr.email_template_id
        when 'sms'       then rr.sms_template_id
        when 'whatsapp'  then rr.whatsapp_template_id
        else null
      end as template_id
    from resolved_recipients rr
    cross join lateral jsonb_array_elements_text(coalesce(rr.channels, '[]'::jsonb)) channel_item(channel_value)
    where channel_item.channel_value in ('email', 'sms', 'whatsapp')
      -- Only include rows where the resolved destination is not null/empty
      and case channel_item.channel_value
            when 'email'    then rr.email_destination
            when 'sms'      then rr.phone_destination
            when 'whatsapp' then rr.phone_destination
            else null
          end is not null
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
