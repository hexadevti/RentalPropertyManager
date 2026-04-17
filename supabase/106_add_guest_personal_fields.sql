alter table public.guests
  add column if not exists document_type text,
  add column if not exists marital_status text,
  add column if not exists profession text;
