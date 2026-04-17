-- Replace this UUID with the auth.users.id that should own imported business data.
-- This script is idempotent and can be re-run.

create temporary table if not exists tmp_migration_params (
  auth_user_id uuid not null
) on commit drop;

truncate table tmp_migration_params;
insert into tmp_migration_params (auth_user_id)
values ('98fbbba8-7da5-4b38-bb68-cf1fa8cbbf59'::uuid);

insert into public.user_settings (auth_user_id, key, value)
select p.auth_user_id, kv.key, kv.value
from tmp_migration_params p
join public.app_kv kv on kv.key in ('app-language', 'app-currency')
on conflict (auth_user_id, key)
do update set value = excluded.value;

insert into public.owners (auth_user_id, id, name, email, phone, document, address, notes, created_at)
select
  p.auth_user_id,
  item->>'id',
  item->>'name',
  item->>'email',
  item->>'phone',
  item->>'document',
  item->>'address',
  item->>'notes',
  coalesce((item->>'createdAt')::timestamptz, timezone('utc', now()))
from tmp_migration_params p
join public.app_kv kv on kv.key = 'owners'
cross join lateral jsonb_array_elements(kv.value) as item
on conflict (auth_user_id, id) do update set
  name = excluded.name,
  email = excluded.email,
  phone = excluded.phone,
  document = excluded.document,
  address = excluded.address,
  notes = excluded.notes;

insert into public.properties (auth_user_id, id, name, type, capacity, price_per_night, price_per_month, status, description, created_at)
select
  p.auth_user_id,
  item->>'id',
  item->>'name',
  item->>'type',
  coalesce((item->>'capacity')::integer, 0),
  coalesce((item->>'pricePerNight')::numeric, 0),
  coalesce((item->>'pricePerMonth')::numeric, 0),
  item->>'status',
  coalesce(item->>'description', ''),
  coalesce((item->>'createdAt')::timestamptz, timezone('utc', now()))
from tmp_migration_params p
join public.app_kv kv on kv.key = 'properties'
cross join lateral jsonb_array_elements(kv.value) as item
on conflict (auth_user_id, id) do update set
  name = excluded.name,
  type = excluded.type,
  capacity = excluded.capacity,
  price_per_night = excluded.price_per_night,
  price_per_month = excluded.price_per_month,
  status = excluded.status,
  description = excluded.description;

insert into public.property_owners (auth_user_id, property_id, owner_id)
select
  p.auth_user_id,
  item->>'id',
  owner_id.value #>> '{}'
from tmp_migration_params p
join public.app_kv kv on kv.key = 'properties'
cross join lateral jsonb_array_elements(kv.value) as item
cross join lateral jsonb_array_elements(coalesce(item->'ownerIds', '[]'::jsonb)) as owner_id(value)
on conflict do nothing;

insert into public.guests (auth_user_id, id, name, email, phone, document, address, nationality, date_of_birth, notes, created_at)
select
  p.auth_user_id,
  item->>'id',
  item->>'name',
  item->>'email',
  item->>'phone',
  item->>'document',
  item->>'address',
  item->>'nationality',
  item->>'dateOfBirth',
  item->>'notes',
  coalesce((item->>'createdAt')::timestamptz, timezone('utc', now()))
from tmp_migration_params p
join public.app_kv kv on kv.key = 'guests'
cross join lateral jsonb_array_elements(kv.value) as item
on conflict (auth_user_id, id) do update set
  name = excluded.name,
  email = excluded.email,
  phone = excluded.phone,
  document = excluded.document,
  address = excluded.address,
  nationality = excluded.nationality,
  date_of_birth = excluded.date_of_birth,
  notes = excluded.notes;

insert into public.contracts (auth_user_id, id, guest_id, rental_type, start_date, end_date, payment_due_day, monthly_amount, status, notes, created_at)
select
  p.auth_user_id,
  item->>'id',
  item->>'guestId',
  item->>'rentalType',
  item->>'startDate',
  item->>'endDate',
  coalesce((item->>'paymentDueDay')::integer, 1),
  coalesce((item->>'monthlyAmount')::numeric, 0),
  item->>'status',
  item->>'notes',
  coalesce((item->>'createdAt')::timestamptz, timezone('utc', now()))
from tmp_migration_params p
join public.app_kv kv on kv.key = 'contracts'
cross join lateral jsonb_array_elements(kv.value) as item
on conflict (auth_user_id, id) do update set
  guest_id = excluded.guest_id,
  rental_type = excluded.rental_type,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  payment_due_day = excluded.payment_due_day,
  monthly_amount = excluded.monthly_amount,
  status = excluded.status,
  notes = excluded.notes;

insert into public.contract_properties (auth_user_id, contract_id, property_id)
select
  p.auth_user_id,
  item->>'id',
  property_id.value #>> '{}'
from tmp_migration_params p
join public.app_kv kv on kv.key = 'contracts'
cross join lateral jsonb_array_elements(kv.value) as item
cross join lateral jsonb_array_elements(coalesce(item->'propertyIds', '[]'::jsonb)) as property_id(value)
on conflict do nothing;

insert into public.service_providers (auth_user_id, id, name, service, contact, email)
select
  p.auth_user_id,
  item->>'id',
  item->>'name',
  coalesce(nullif(item->>'service', ''), 'General'),
  coalesce(
    nullif(item->>'contact', ''),
    nullif(item->>'phone', ''),
    nullif(item->>'email', ''),
    'Sem contato'
  ),
  nullif(item->>'email', '')
from tmp_migration_params p
join public.app_kv kv on kv.key = 'service-providers'
cross join lateral jsonb_array_elements(kv.value) as item
on conflict (auth_user_id, id) do update set
  name = excluded.name,
  service = excluded.service,
  contact = excluded.contact,
  email = excluded.email;

insert into public.transactions (auth_user_id, id, type, amount, category, description, date, property_id, contract_id, service_provider_id, created_at)
select
  p.auth_user_id,
  item->>'id',
  item->>'type',
  coalesce((item->>'amount')::numeric, 0),
  item->>'category',
  item->>'description',
  item->>'date',
  item->>'propertyId',
  item->>'contractId',
  item->>'serviceProviderId',
  coalesce((item->>'createdAt')::timestamptz, timezone('utc', now()))
from tmp_migration_params p
join public.app_kv kv on kv.key = 'transactions'
cross join lateral jsonb_array_elements(kv.value) as item
on conflict (auth_user_id, id) do update set
  type = excluded.type,
  amount = excluded.amount,
  category = excluded.category,
  description = excluded.description,
  date = excluded.date,
  property_id = excluded.property_id,
  contract_id = excluded.contract_id,
  service_provider_id = excluded.service_provider_id;

insert into public.tasks (auth_user_id, id, title, description, due_date, priority, status, assignee, property_id, created_at)
select
  p.auth_user_id,
  item->>'id',
  item->>'title',
  item->>'description',
  item->>'dueDate',
  item->>'priority',
  item->>'status',
  item->>'assignee',
  item->>'propertyId',
  coalesce((item->>'createdAt')::timestamptz, timezone('utc', now()))
from tmp_migration_params p
join public.app_kv kv on kv.key = 'tasks'
cross join lateral jsonb_array_elements(kv.value) as item
on conflict (auth_user_id, id) do update set
  title = excluded.title,
  description = excluded.description,
  due_date = excluded.due_date,
  priority = excluded.priority,
  status = excluded.status,
  assignee = excluded.assignee,
  property_id = excluded.property_id;

insert into public.appointments (auth_user_id, id, title, description, date, time, status, service_provider_id, contract_id, guest_id, property_id, notes, completion_notes, completed_at, created_at)
select
  p.auth_user_id,
  item->>'id',
  item->>'title',
  item->>'description',
  item->>'date',
  item->>'time',
  item->>'status',
  item->>'serviceProviderId',
  item->>'contractId',
  item->>'guestId',
  item->>'propertyId',
  item->>'notes',
  item->>'completionNotes',
  item->>'completedAt',
  coalesce((item->>'createdAt')::timestamptz, timezone('utc', now()))
from tmp_migration_params p
join public.app_kv kv on kv.key = 'appointments'
cross join lateral jsonb_array_elements(kv.value) as item
on conflict (auth_user_id, id) do update set
  title = excluded.title,
  description = excluded.description,
  date = excluded.date,
  time = excluded.time,
  status = excluded.status,
  service_provider_id = excluded.service_provider_id,
  contract_id = excluded.contract_id,
  guest_id = excluded.guest_id,
  property_id = excluded.property_id,
  notes = excluded.notes,
  completion_notes = excluded.completion_notes,
  completed_at = excluded.completed_at;

insert into public.contract_templates (auth_user_id, id, name, type, content, created_at, updated_at)
select
  p.auth_user_id,
  item->>'id',
  item->>'name',
  item->>'type',
  item->>'content',
  coalesce((item->>'createdAt')::timestamptz, timezone('utc', now())),
  coalesce((item->>'updatedAt')::timestamptz, timezone('utc', now()))
from tmp_migration_params p
join public.app_kv kv on kv.key = 'contract-templates'
cross join lateral jsonb_array_elements(kv.value) as item
on conflict (auth_user_id, id) do update set
  name = excluded.name,
  type = excluded.type,
  content = excluded.content,
  updated_at = excluded.updated_at;

insert into public.documents (auth_user_id, id, name, category, notes, property_id, upload_date)
select
  p.auth_user_id,
  item->>'id',
  item->>'name',
  item->>'category',
  item->>'notes',
  item->>'propertyId',
  item->>'uploadDate'
from tmp_migration_params p
join public.app_kv kv on kv.key = 'documents'
cross join lateral jsonb_array_elements(kv.value) as item
on conflict (auth_user_id, id) do update set
  name = excluded.name,
  category = excluded.category,
  notes = excluded.notes,
  property_id = excluded.property_id,
  upload_date = excluded.upload_date;

insert into public.user_profiles (github_login, role, status, email, avatar_url, created_at, updated_at)
select
  item->>'githubLogin',
  item->>'role',
  item->>'status',
  item->>'email',
  item->>'avatarUrl',
  coalesce((item->>'createdAt')::timestamptz, timezone('utc', now())),
  coalesce((item->>'updatedAt')::timestamptz, timezone('utc', now()))
from public.app_kv kv
cross join lateral jsonb_array_elements(kv.value) as item
where kv.key = 'user-profiles'
on conflict (github_login) do update set
  role = excluded.role,
  status = excluded.status,
  email = excluded.email,
  avatar_url = excluded.avatar_url,
  updated_at = excluded.updated_at;
