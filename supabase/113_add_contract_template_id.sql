-- Add template_id column to contracts table
alter table public.contracts
add column template_id text;
