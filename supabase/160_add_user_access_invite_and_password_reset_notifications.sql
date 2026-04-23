alter table public.notification_rules
  add column if not exists send_to_event_recipient boolean not null default false;

update public.notification_rules
set event_type = 'user-access'
where trigger in ('user-access-invite', 'user-password-reset')
  and coalesce(event_type, '') <> 'user-access';

alter table public.notification_rules
  drop constraint if exists notification_rules_trigger_check;

alter table public.notification_rules
  add constraint notification_rules_trigger_check
  check (trigger in (
    'appointment-items',
    'contract-expiration',
    'contract-payment-day',
    'task-created',
    'task-due-tomorrow',
    'task-due-today',
    'task-overdue-open',
    'task-resolved',
    'contract-created',
    'inspection',
    'bug',
    'user-created',
    'user-role-changed',
    'user-access-approved',
    'user-access-invite',
    'user-password-reset',
    'user-access-rejected'
  ));

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
  resolved_recipients as (
    select * from resolved_user_recipients
    union all
    select * from resolved_task_assignee_recipients
    union all
    select * from resolved_event_recipients
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

create or replace function public.seed_additional_user_access_notification_templates(p_tenant_id uuid)
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
        'default-email-user-access-invite',
        'User access invite - Email',
        'email',
        'user-access',
        'html',
        'HTML email sent when a tenant user is invited.',
        'Invitation to {{tenant.name}}',
        $html$<p>You have been invited to access <strong>{{tenant.name}}</strong>.</p>
<p><strong>Email:</strong> {{user.email}}</p>
<p><strong>Role:</strong> {{invite.role}}</p>
<p><strong>Invited by:</strong> {{inviter.login}}</p>
<p><strong>Message:</strong><br />{{invite.message}}</p>
<p><a href="{{invite.acceptUrl}}">Accept invitation</a></p>
<p><strong>Expires at:</strong> {{invite.expiresAt}}</p>$html$
      ),
      (
        'default-email-user-password-reset',
        'User password reset - Email',
        'email',
        'user-access',
        'html',
        'HTML email sent when a tenant user receives a password reset link.',
        'Create a new password for {{tenant.name}}',
        $html$<p>A password reset was requested for your access to <strong>{{tenant.name}}</strong>.</p>
<p><strong>User:</strong> {{user.githubLogin}}</p>
<p><strong>Email:</strong> {{user.email}}</p>
<p><strong>Requested by:</strong> {{inviter.login}}</p>
<p><strong>Message:</strong><br />{{passwordReset.message}}</p>
<p><a href="{{passwordReset.resetUrl}}">Create a new password</a></p>$html$
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

create or replace function public.seed_additional_user_access_notification_rules(p_tenant_id uuid)
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

  perform public.seed_additional_user_access_notification_templates(p_tenant_id);

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
    send_to_event_recipient,
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
    '[]'::jsonb,
    '[]'::jsonb,
    true,
    null,
    true,
    v_now,
    v_now
  from (
    values
      ('user-access:self-service:user-access-invite', 'User access self-service notifications', 'user-access-invite', 'user-access', 'default-email-user-access-invite'),
      ('user-access:self-service:user-password-reset', 'User access self-service notifications', 'user-password-reset', 'user-access', 'default-email-user-password-reset')
  ) as rule_defaults(
    id,
    name,
    trigger,
    event_type,
    email_template_id
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

create or replace function public.seed_default_notification_catalog_on_tenant_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_notification_templates(new.id);
  perform public.seed_default_notification_rules(new.id);
  perform public.seed_additional_user_access_notification_templates(new.id);
  perform public.seed_additional_user_access_notification_rules(new.id);
  return new;
end;
$$;

select public.seed_additional_user_access_notification_templates(id)
from public.tenants;

select public.seed_additional_user_access_notification_rules(id)
from public.tenants;
