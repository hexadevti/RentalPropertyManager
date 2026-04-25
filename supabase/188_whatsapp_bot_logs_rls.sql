-- Ensure whatsapp_bot_logs exists (idempotent)
create table if not exists public.whatsapp_bot_logs (
  id          uuid        not null default gen_random_uuid(),
  phone       text        not null,
  tenant_id   uuid,
  user_login  text,
  incoming    text        not null,
  response    text        not null,
  status      text        not null check (status in ('success','not_found','blocked','pending','command','error')),
  created_at  timestamptz not null default timezone('utc', now()),
  primary key (id)
);

create index if not exists idx_whatsapp_bot_logs_phone  on public.whatsapp_bot_logs(phone, created_at desc);
create index if not exists idx_whatsapp_bot_logs_status on public.whatsapp_bot_logs(status, created_at desc);

-- Disable RLS so service_role (Edge Function) and authenticated (admin UI) can both access it.
-- Platform admin access is controlled at the app level (route guard).
alter table public.whatsapp_bot_logs disable row level security;

-- Same for whatsapp_chat_history
alter table public.whatsapp_chat_history disable row level security;
