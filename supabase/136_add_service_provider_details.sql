alter table public.service_providers
  add column if not exists document text,
  add column if not exists address text,
  add column if not exists notes text;
