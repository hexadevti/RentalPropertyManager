-- ============================================================
-- Diagnostic: why task-created is not producing notification_deliveries rows
-- Run each section separately in Supabase SQL Editor (no substitutions needed)
-- ============================================================

-- ── SECTION 1 ── Check trigger function is installed ─────────────────────────
select
  routine_name,
  routine_type,
  security_type,
  routine_definition is not null as has_body
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'notify_on_tasks_change';

-- ── SECTION 2 ── Check triggers attached to tasks table (all triggers) ───────
select
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table = 'tasks'
order by trigger_name, event_manipulation;

-- ── SECTION 3 ── Latest tasks (to pick a tenant_id / task_id) ────────────────
select tenant_id, id as task_id, title, status, due_date, created_at
from public.tasks
order by created_at desc
limit 10;

-- ── SECTION 4 ── Active task-created rules (all tenants) ─────────────────────
select
  nr.tenant_id,
  nr.id as rule_id,
  nr.name,
  nr.trigger,
  nr.is_active,
  nr.channels,
  nr.email_template_id,
  nr.sms_template_id,
  nr.whatsapp_template_id,
  nr.recipient_roles,
  nr.recipient_user_ids
from public.notification_rules nr
where nr.trigger = 'task-created'
order by nr.tenant_id, nr.updated_at desc;

-- ── SECTION 5 ── Resolved recipients for all active task-created rules ────────
-- (mirrors the exact join inside enqueue_notification_deliveries_for_event)
with matching_rules as (
  select
    nr.tenant_id,
    nr.id as rule_id,
    nr.recipient_roles,
    nr.recipient_user_ids
  from public.notification_rules nr
  where nr.is_active = true
    and nr.trigger = 'task-created'
)
select distinct
  r.rule_id,
  r.tenant_id,
  up.auth_user_id,
  up.github_login,
  up.email,
  up.role,
  up.status
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
order by r.rule_id, up.github_login;

-- ── SECTION 6 ── All user_profiles for tenants that have task-created rules ───
-- (if no rows in section 5 but rules exist, check status/role here)
select
  up.tenant_id,
  up.auth_user_id,
  up.github_login,
  up.email,
  up.role,
  up.status
from public.user_profiles up
where up.tenant_id in (
  select distinct tenant_id from public.notification_rules where trigger = 'task-created'
)
order by up.tenant_id, up.status;

-- ── SECTION 7 ── Templates for task-created rules ────────────────────────────
select
  nr.tenant_id,
  nr.id as rule_id,
  nr.channels,
  nr.email_template_id,
  te.id is not null as email_template_exists,
  te.name as email_template_name,
  nr.sms_template_id,
  ts.id is not null as sms_template_exists,
  nr.whatsapp_template_id,
  tw.id is not null as whatsapp_template_exists
from public.notification_rules nr
left join public.notification_templates te on te.tenant_id = nr.tenant_id and te.id = nr.email_template_id
left join public.notification_templates ts on ts.tenant_id = nr.tenant_id and ts.id = nr.sms_template_id
left join public.notification_templates tw on tw.tenant_id = nr.tenant_id and tw.id = nr.whatsapp_template_id
where nr.trigger = 'task-created'
  and nr.is_active = true;

-- ── SECTION 8 ── Existing delivery rows for task-created (read-only) ─────────
select
  d.tenant_id,
  d.created_at,
  d.status,
  d.channel,
  d.recipient_login,
  d.recipient_destination,
  d.rule_id,
  d.payload->>'trigger' as trigger,
  d.payload->>'eventKey' as event_key,
  d.last_error
from public.notification_deliveries d
where d.payload->>'trigger' = 'task-created'
order by d.created_at desc
limit 30;

-- ── SECTION 8B ── Latest deliveries without trigger filter (read-only) ───────
select
  d.tenant_id,
  d.created_at,
  d.status,
  d.channel,
  d.recipient_login,
  d.recipient_destination,
  d.rule_id,
  d.payload->>'trigger' as trigger,
  d.payload->>'eventKey' as event_key,
  d.last_error
from public.notification_deliveries d
order by d.created_at desc
limit 30;

-- ── SECTION 9 ── Force-enqueue test using first active rule / first task ──────
-- Returns a row with tenant_id, task_id and inserted_count directly
select
  nr.tenant_id,
  t.id::text as task_id,
  public.enqueue_notification_deliveries_for_event(
    nr.tenant_id,
    'task-created',
    format('manual-debug:%s:%s', t.id, timezone('utc', now())::text),
    timezone('utc', now()),
    jsonb_build_object(
      'entity', 'task',
      'condition', 'task-created',
      'task', jsonb_build_object('id', t.id, 'title', coalesce(t.title, 'Debug Task'))
    ),
    'New task',
    coalesce(t.title, 'Debug Task') || ' - created'
  ) as inserted_count
from public.notification_rules nr
join public.tasks t on t.tenant_id = nr.tenant_id
where nr.trigger = 'task-created'
  and nr.is_active = true
order by t.created_at desc
limit 1;
