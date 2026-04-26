alter table public.contract_templates
  add column if not exists language text;

update public.contract_templates
set language = 'pt'
where language is null or btrim(language) = '';

alter table public.contract_templates
  alter column language set not null;

alter table public.contract_templates
  drop constraint if exists contract_templates_language_check;

alter table public.contract_templates
  add constraint contract_templates_language_check
  check (language in ('pt', 'en'));

alter table public.contract_templates
  add column if not exists translation_group_id text;

update public.contract_templates
set translation_group_id = id
where translation_group_id is null or btrim(translation_group_id) = '';

alter table public.contract_templates
  alter column translation_group_id set not null;

create index if not exists idx_contract_templates_tenant_language
  on public.contract_templates(tenant_id, language);

create index if not exists idx_contract_templates_translation_group
  on public.contract_templates(tenant_id, translation_group_id);

alter table public.notification_templates
  add column if not exists language text;

update public.notification_templates
set language = 'pt'
where language is null or btrim(language) = '';

alter table public.notification_templates
  alter column language set not null;

alter table public.notification_templates
  drop constraint if exists notification_templates_language_check;

alter table public.notification_templates
  add constraint notification_templates_language_check
  check (language in ('pt', 'en'));

alter table public.notification_templates
  add column if not exists translation_group_id text;

update public.notification_templates
set translation_group_id = id
where translation_group_id is null or btrim(translation_group_id) = '';

alter table public.notification_templates
  alter column translation_group_id set not null;

create index if not exists idx_notification_templates_tenant_language
  on public.notification_templates(tenant_id, language);

create index if not exists idx_notification_templates_translation_group
  on public.notification_templates(tenant_id, translation_group_id);
