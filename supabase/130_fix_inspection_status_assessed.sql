-- Replace the old status check constraint to use 'assessed' instead of 'completed'
alter table public.inspections
  drop constraint if exists inspections_status_check;

alter table public.inspections
  add constraint inspections_status_check
    check (status in ('draft', 'in-progress', 'assessed'));

-- Migrate any existing rows that were saved as 'completed' to 'assessed'
update public.inspections set status = 'assessed' where status = 'completed';
