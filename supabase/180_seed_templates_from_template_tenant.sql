-- Seed default contract templates, notification templates, and notification rules
-- by copying from a template tenant (38d4033b-e5ee-4956-89b6-5721455aaa54).
-- This allows new tenants to start with the same structure as the template.

create or replace function public.seed_templates_from_template_tenant(p_new_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_tenant_id uuid := '38d4033b-e5ee-4956-89b6-5721455aaa54'::uuid;
  v_inserted integer := 0;
  v_now timestamptz := timezone('utc', now());
begin
  if p_new_tenant_id is null then
    return 0;
  end if;

  -- Seed contract templates from template tenant
  insert into public.contract_templates (
    tenant_id,
    id,
    name,
    type,
    content,
    language,
    translation_group_id,
    created_at,
    updated_at
  )
  select
    p_new_tenant_id,
    template_row.id,
    template_row.name,
    template_row.type,
    template_row.content,
    template_row.language,
    template_row.translation_group_id,
    v_now,
    v_now
  from public.contract_templates template_row
  where template_row.tenant_id = v_template_tenant_id
  on conflict (tenant_id, id) do nothing;

  get diagnostics v_inserted = row_count;

  -- Seed notification templates from template tenant
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
    p_new_tenant_id,
    template_row.id,
    template_row.name,
    template_row.channel,
    template_row.event_type,
    template_row.content_type,
    template_row.description,
    template_row.subject,
    template_row.content,
    v_now,
    v_now
  from public.notification_templates template_row
  where template_row.tenant_id = v_template_tenant_id
  on conflict (tenant_id, id) do nothing;

  -- Seed notification rules from template tenant
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
    days_before,
    is_active,
    created_at,
    updated_at
  )
  select
    p_new_tenant_id,
    rules_row.id,
    rules_row.name,
    rules_row.trigger,
    rules_row.event_type,
    rules_row.channels,
    rules_row.email_template_id,
    rules_row.sms_template_id,
    rules_row.whatsapp_template_id,
    rules_row.recipient_roles,
    rules_row.recipient_user_ids,
    rules_row.days_before,
    rules_row.is_active,
    v_now,
    v_now
  from public.notification_rules rules_row
  where rules_row.tenant_id = v_template_tenant_id
  on conflict (tenant_id, id) do nothing;

  return v_inserted;
end;
$$;

revoke all on function public.seed_templates_from_template_tenant(uuid) from public;
grant execute on function public.seed_templates_from_template_tenant(uuid) to service_role;

-- Update the existing trigger to also call the new seed function
create or replace function public.seed_default_notification_catalog_on_tenant_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_notification_templates(new.id);
  perform public.seed_default_notification_rules(new.id);
  perform public.seed_templates_from_template_tenant(new.id);
  return new;
end;
$$;

-- Re-execute the seed for existing tenants (excluding the template tenant itself)
select public.seed_templates_from_template_tenant(id)
from public.tenants
where id != '38d4033b-e5ee-4956-89b6-5721455aaa54'::uuid;
