create table if not exists public.mobile_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by_auth_user_id uuid not null,
  token_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled', 'consumed', 'expired')),
  origin text,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  completed_at timestamptz,
  consumed_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.mobile_capture_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mobile_capture_sessions(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  file_path text not null,
  mime_type text not null,
  file_size bigint not null,
  capture_index integer not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_mobile_capture_items_unique_index
  on public.mobile_capture_items(session_id, capture_index);

create index if not exists idx_mobile_capture_sessions_owner
  on public.mobile_capture_sessions(created_by_auth_user_id, created_at desc);

create index if not exists idx_mobile_capture_sessions_expiry
  on public.mobile_capture_sessions(expires_at);

create index if not exists idx_mobile_capture_items_session
  on public.mobile_capture_items(session_id, created_at asc);

alter table public.mobile_capture_sessions enable row level security;
alter table public.mobile_capture_items enable row level security;

drop policy if exists mobile_capture_sessions_no_direct_access on public.mobile_capture_sessions;
create policy mobile_capture_sessions_no_direct_access on public.mobile_capture_sessions
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists mobile_capture_items_no_direct_access on public.mobile_capture_items;
create policy mobile_capture_items_no_direct_access on public.mobile_capture_items
  for all to authenticated
  using (false)
  with check (false);

insert into storage.buckets (id, name, public, file_size_limit)
values ('mobile-temp-captures', 'mobile-temp-captures', false, 10485760)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;
