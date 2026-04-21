-- Remove the status column from properties — availability is derived from active contracts
alter table public.properties drop column if exists status;
