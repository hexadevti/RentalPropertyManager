-- Add updated_at column to tasks table.
-- notify_on_tasks_change() references new.updated_at for the task-resolved event key.
-- Without this column, PL/pgSQL raises a runtime error that is swallowed by the
-- EXCEPTION WHEN OTHERS handler, silently preventing task-resolved notifications.

-- 1. Add the column (default to created_at so existing rows get a sensible value)
alter table public.tasks
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- Backfill existing rows to match created_at
update public.tasks
  set updated_at = created_at
  where updated_at = timezone('utc', now());

-- 2. Helper function to auto-set updated_at before any UPDATE
create or replace function public.set_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- 3. BEFORE UPDATE trigger on tasks (fires before notify_on_tasks_change AFTER trigger)
drop trigger if exists trg_tasks_set_updated_at on public.tasks;
create trigger trg_tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_tasks_updated_at();
