-- Add parent_inspection_id to link check-out / periodic / maintenance to their check-in
alter table public.inspections
  add column if not exists parent_inspection_id text;

-- Optional FK — soft reference so deleting a check-in doesn't cascade-block
-- (no on delete restrict, just informational)
alter table public.inspections
  add constraint inspections_parent_fkey
    foreign key (tenant_id, parent_inspection_id)
    references public.inspections(tenant_id, id)
    on delete set null
    not valid;

alter table public.inspections
  validate constraint inspections_parent_fkey;

create index if not exists idx_inspections_parent_id
  on public.inspections(tenant_id, parent_inspection_id);
