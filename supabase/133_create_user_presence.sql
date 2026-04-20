create table if not exists public.user_presence (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id text not null,
  auth_user_id uuid,
  user_login text not null,
  user_email text,
  avatar_url text,
  current_tab text not null,
  current_tab_label text not null,
  activity text not null,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, session_id)
);

create index if not exists idx_user_presence_tenant_seen
  on public.user_presence(tenant_id, last_seen_at desc);

create index if not exists idx_user_presence_auth_user_id
  on public.user_presence(auth_user_id);

alter table public.user_presence enable row level security;

drop policy if exists user_presence_all on public.user_presence;
create policy user_presence_all on public.user_presence
  for all to authenticated
  using (
    tenant_id = public.get_current_user_tenant_id()
    or public.is_current_user_platform_admin()
  )
  with check (
    tenant_id = public.get_current_user_tenant_id()
    or public.is_current_user_platform_admin()
  );
