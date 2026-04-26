-- Chat history for the WhatsApp bot — one row per message (user or assistant)
-- Keyed by (tenant_id, phone) so each user gets their own conversation thread.
create table if not exists public.whatsapp_chat_history (
  id         uuid        not null default gen_random_uuid(),
  tenant_id  uuid        not null references public.tenants(id) on delete cascade,
  phone      text        not null,   -- digits only, e.g. "5511999990000"
  role       text        not null check (role in ('user', 'assistant')),
  content    text        not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (id)
);

create index if not exists idx_whatsapp_chat_history_lookup
  on public.whatsapp_chat_history(tenant_id, phone, created_at desc);

-- No RLS needed — this table is only accessed by service_role (Edge Function).
-- Enabling RLS with no policies would block all access, so we leave it off.
