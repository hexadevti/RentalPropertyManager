-- Fix FK behavior for notification_deliveries composite references.
-- Previous constraints used ON DELETE SET NULL on (tenant_id, rule_id/template_id),
-- which attempts to null tenant_id too and violates notification_deliveries.tenant_id NOT NULL.

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_rule_fkey;

alter table public.notification_deliveries
  add constraint notification_deliveries_rule_fkey
  foreign key (tenant_id, rule_id)
  references public.notification_rules(tenant_id, id)
  on delete set null (rule_id);

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_template_fkey;

alter table public.notification_deliveries
  add constraint notification_deliveries_template_fkey
  foreign key (tenant_id, template_id)
  references public.notification_templates(tenant_id, id)
  on delete set null (template_id);
