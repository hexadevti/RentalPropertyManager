alter table public.owners
  add column if not exists document_type text,
  add column if not exists nationality text,
  add column if not exists marital_status text,
  add column if not exists profession text;
