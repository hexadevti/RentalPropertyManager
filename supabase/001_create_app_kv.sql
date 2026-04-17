-- Run this script in Supabase SQL Editor.

create table if not exists public.app_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_app_kv_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists app_kv_set_updated_at on public.app_kv;

create trigger app_kv_set_updated_at
before update on public.app_kv
for each row
execute function public.set_app_kv_updated_at();

alter table public.app_kv enable row level security;

drop policy if exists "app_kv_select_all" on public.app_kv;
drop policy if exists "app_kv_insert_all" on public.app_kv;
drop policy if exists "app_kv_update_all" on public.app_kv;
drop policy if exists "app_kv_delete_all" on public.app_kv;

create policy "app_kv_select_all"
on public.app_kv
for select
to anon, authenticated
using (true);

create policy "app_kv_insert_all"
on public.app_kv
for insert
to anon, authenticated
with check (true);

create policy "app_kv_update_all"
on public.app_kv
for update
to anon, authenticated
using (true)
with check (true);

create policy "app_kv_delete_all"
on public.app_kv
for delete
to anon, authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.app_kv to anon, authenticated;
