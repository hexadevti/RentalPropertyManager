update public.notification_templates
set
  language = 'en',
  translation_group_id = coalesce(nullif(translation_group_id, ''), id),
  updated_at = timezone('utc', now())
where id like 'default-%'
  and (
    language is distinct from 'en'
    or translation_group_id is null
    or btrim(translation_group_id) = ''
  );

create or replace function public.set_notification_template_language_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.translation_group_id is null or btrim(new.translation_group_id) = '' then
    new.translation_group_id := new.id;
  end if;

  if new.language is null or btrim(new.language) = '' then
    if new.id like 'default-%' then
      new.language := 'en';
    else
      new.language := 'pt';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists notification_templates_set_language_defaults on public.notification_templates;
create trigger notification_templates_set_language_defaults
before insert or update on public.notification_templates
for each row
execute function public.set_notification_template_language_defaults();

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
    language,
    translation_group_id,
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
    'en',
    template_defaults.id,
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
