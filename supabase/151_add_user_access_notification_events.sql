-- Add notification event type support and user access notification events.

alter table public.notification_rules
  add column if not exists event_type text;

alter table public.notification_rules
  drop constraint if exists notification_rules_event_type_check;

alter table public.notification_rules
  add constraint notification_rules_event_type_check
  check (event_type is null or event_type in ('tasks', 'user-access'));

update public.notification_rules
set event_type = case
  when trigger in ('task-due', 'task-created', 'task-due-tomorrow', 'task-due-today', 'task-overdue-open', 'task-resolved') then 'tasks'
  when trigger in ('user-created', 'user-role-changed', 'user-access-approved', 'user-access-rejected') then 'user-access'
  else event_type
end
where event_type is null;

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
    'task-resolved',
    'contract-created',
    'inspection',
    'bug',
    'user-created',
    'user-role-changed',
    'user-access-approved',
    'user-access-rejected'
  ));

create or replace function public.notify_on_user_profiles_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_key text;
  v_payload jsonb;
  v_now timestamptz := timezone('utc', now());
  v_previous_role text;
  v_current_role text;
  v_previous_status text;
  v_current_status text;
  v_previous_tenant_id uuid;
begin
  v_previous_role := case when tg_op = 'UPDATE' then coalesce(old.role, '') else '' end;
  v_current_role := coalesce(new.role, '');
  v_previous_status := case when tg_op = 'UPDATE' then coalesce(old.status, '') else '' end;
  v_current_status := coalesce(new.status, '');
  v_previous_tenant_id := case when tg_op = 'UPDATE' then old.tenant_id else null end;

  v_payload := jsonb_build_object(
    'entity', 'user-profile',
    'user', jsonb_build_object(
      'id', new.id,
      'authUserId', new.auth_user_id,
      'githubLogin', new.github_login,
      'email', new.email,
      'avatarUrl', new.avatar_url,
      'role', new.role,
      'status', new.status,
      'tenantId', new.tenant_id,
      'createdAt', new.created_at,
      'updatedAt', new.updated_at
    ),
    'group', jsonb_build_object(
      'role', new.role,
      'label', initcap(new.role)
    ),
    'access', jsonb_build_object(
      'status', new.status,
      'isApproved', new.status = 'approved',
      'isPending', new.status = 'pending',
      'isRejected', new.status = 'rejected'
    ),
    'changes', jsonb_build_object(
      'previousRole', nullif(v_previous_role, ''),
      'currentRole', nullif(v_current_role, ''),
      'previousStatus', nullif(v_previous_status, ''),
      'currentStatus', nullif(v_current_status, ''),
      'previousTenantId', v_previous_tenant_id,
      'currentTenantId', new.tenant_id
    )
  );

  if tg_op = 'INSERT' then
    v_event_key := format('user-created:%s:%s', new.id, coalesce(new.created_at::text, v_now::text));

    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'user-created',
      v_event_key,
      v_now,
      v_payload || jsonb_build_object('condition', 'user-created'),
      'New system user',
      coalesce(new.github_login, 'User') || ' was created.'
    );

    if new.status = 'approved' then
      v_event_key := format('user-access-approved:%s:%s', new.id, coalesce(new.created_at::text, v_now::text));

      perform public.enqueue_notification_deliveries_for_event(
        new.tenant_id,
        'user-access-approved',
        v_event_key,
        v_now,
        v_payload || jsonb_build_object('condition', 'user-access-approved'),
        'User access approved',
        coalesce(new.github_login, 'User') || ' now has approved access.'
      );
    elsif new.status = 'rejected' then
      v_event_key := format('user-access-rejected:%s:%s', new.id, coalesce(new.created_at::text, v_now::text));

      perform public.enqueue_notification_deliveries_for_event(
        new.tenant_id,
        'user-access-rejected',
        v_event_key,
        v_now,
        v_payload || jsonb_build_object('condition', 'user-access-rejected'),
        'User access rejected',
        coalesce(new.github_login, 'User') || ' had access rejected.'
      );
    end if;

    return new;
  end if;

  if v_previous_role is distinct from v_current_role then
    v_event_key := format(
      'user-role-changed:%s:%s:%s:%s',
      new.id,
      v_previous_role,
      v_current_role,
      coalesce(new.updated_at::text, v_now::text)
    );

    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'user-role-changed',
      v_event_key,
      v_now,
      v_payload || jsonb_build_object('condition', 'user-role-changed'),
      'User profile group changed',
      coalesce(new.github_login, 'User') || ' changed role from ' || coalesce(nullif(v_previous_role, ''), '-') || ' to ' || coalesce(nullif(v_current_role, ''), '-') || '.'
    );
  end if;

  if v_previous_status is distinct from v_current_status and v_current_status = 'approved' then
    v_event_key := format(
      'user-access-approved:%s:%s:%s',
      new.id,
      v_previous_status,
      coalesce(new.updated_at::text, v_now::text)
    );

    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'user-access-approved',
      v_event_key,
      v_now,
      v_payload || jsonb_build_object('condition', 'user-access-approved'),
      'User access approved',
      coalesce(new.github_login, 'User') || ' now has approved access.'
    );
  end if;

  if v_previous_status is distinct from v_current_status and v_current_status = 'rejected' then
    v_event_key := format(
      'user-access-rejected:%s:%s:%s',
      new.id,
      v_previous_status,
      coalesce(new.updated_at::text, v_now::text)
    );

    perform public.enqueue_notification_deliveries_for_event(
      new.tenant_id,
      'user-access-rejected',
      v_event_key,
      v_now,
      v_payload || jsonb_build_object('condition', 'user-access-rejected'),
      'User access rejected',
      coalesce(new.github_login, 'User') || ' had access rejected.'
    );
  end if;

  return new;
exception when others then
  raise warning 'notify_on_user_profiles_change failed for profile % (tenant %): %', new.id, new.tenant_id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_user_profiles_change on public.user_profiles;
create trigger trg_notify_user_profiles_change
after insert or update on public.user_profiles
for each row
execute function public.notify_on_user_profiles_change();
