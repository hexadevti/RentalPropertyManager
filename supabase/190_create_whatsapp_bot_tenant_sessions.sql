-- Persist selected tenant for WhatsApp bot when a user has access to multiple tenants.
create table if not exists public.whatsapp_bot_tenant_sessions (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (auth_user_id, phone)
);

create index if not exists idx_whatsapp_bot_tenant_sessions_tenant
  on public.whatsapp_bot_tenant_sessions(tenant_id);

-- Service-role only access from Edge Functions.
alter table public.whatsapp_bot_tenant_sessions disable row level security;
