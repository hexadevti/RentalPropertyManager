update public.user_profiles
set
  status = 'blocked',
  updated_at = timezone('utc', now())
where status = 'rejected';

alter table public.user_profiles
  drop constraint if exists user_profiles_status_check;

alter table public.user_profiles
  add constraint user_profiles_status_check
  check (status in ('pending', 'approved', 'blocked'));

create or replace function public.notify_on_user_profiles_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now                timestamptz := timezone('utc', now());
  v_previous_role      text        := '';
  v_current_role       text        := coalesce(new.role, '');
  v_previous_status    text        := '';
  v_current_status     text        := coalesce(new.status, '');
  v_previous_tenant_id uuid        := null;
  v_payload            jsonb;
  v_event_key          text;
begin
  if tg_op = 'UPDATE' then
    v_previous_role := coalesce(old.role, '');
    v_previous_status := coalesce(old.status, '');
    v_previous_tenant_id := old.tenant_id;
  end if;

  if tg_op = 'INSERT' and new.github_login like 'invited-%' then
    return new;
  end if;

  v_payload := jsonb_build_object(
    'entity', 'user-access',
    'user', jsonb_build_object(
      'githubLogin', new.github_login,
      'email', new.email,
      'role', new.role,
      'status', new.status,
      'tenantId', new.tenant_id
    ),
    'tenant', jsonb_build_object(
      'id', new.tenant_id
    ),
    'notificationRecipient', jsonb_build_object(
      'login', coalesce(nullif(new.github_login, ''), new.email),
      'name', coalesce(nullif(new.github_login, ''), new.email),
      'email', new.email,
      'authUserId', new.auth_user_id
    ),
    'access', jsonb_build_object(
      'status', new.status,
      'isApproved', new.status = 'approved',
      'isPending', new.status = 'pending',
      'isBlocked', new.status = 'blocked',
      'isRejected', false
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
    elsif new.status = 'blocked' then
      v_event_key := format('user-access-rejected:%s:%s', new.id, coalesce(new.created_at::text, v_now::text));

      perform public.enqueue_notification_deliveries_for_event(
        new.tenant_id,
        'user-access-rejected',
        v_event_key,
        v_now,
        v_payload || jsonb_build_object('condition', 'user-access-rejected'),
        'User access blocked',
        coalesce(new.github_login, 'User') || ' access was blocked.'
      );
    end if;

  elsif tg_op = 'UPDATE' then
    if old.role is distinct from new.role then
      v_event_key := format('user-role-changed:%s:%s:%s', new.id, old.role, new.role);

      perform public.enqueue_notification_deliveries_for_event(
        new.tenant_id,
        'user-role-changed',
        v_event_key,
        v_now,
        v_payload || jsonb_build_object('condition', 'user-role-changed'),
        'User role changed',
        coalesce(new.github_login, 'User') || ' role changed from ' || old.role || ' to ' || new.role || '.'
      );
    end if;

    if old.status is distinct from new.status then
      if new.status = 'approved' then
        v_event_key := format('user-access-approved:%s:%s:%s', new.id, old.status, new.status);

        perform public.enqueue_notification_deliveries_for_event(
          new.tenant_id,
          'user-access-approved',
          v_event_key,
          v_now,
          v_payload || jsonb_build_object('condition', 'user-access-approved'),
          'User access approved',
          coalesce(new.github_login, 'User') || ' now has approved access.'
        );
      elsif new.status = 'blocked' then
        v_event_key := format('user-access-rejected:%s:%s:%s', new.id, old.status, new.status);

        perform public.enqueue_notification_deliveries_for_event(
          new.tenant_id,
          'user-access-rejected',
          v_event_key,
          v_now,
          v_payload || jsonb_build_object('condition', 'user-access-rejected'),
          'User access blocked',
          coalesce(new.github_login, 'User') || ' access was blocked.'
        );
      end if;
    end if;
  end if;

  return new;
exception
  when others then
    raise warning 'notify_on_user_profiles_change failed for profile % (tenant %): %', new.id, new.tenant_id, sqlerrm;
    return new;
end;
$$;

update public.notification_templates
set
  name = regexp_replace(name, 'rejected', 'blocked', 'gi'),
  description = regexp_replace(coalesce(description, ''), 'rejected', 'blocked', 'gi'),
  subject = regexp_replace(coalesce(subject, ''), 'rejected', 'blocked', 'gi'),
  content = regexp_replace(content, 'rejected', 'blocked', 'gi'),
  updated_at = timezone('utc', now())
where id in (
  'default-email-user-access-rejected',
  'default-sms-user-access-rejected',
  'default-whatsapp-user-access-rejected'
);
