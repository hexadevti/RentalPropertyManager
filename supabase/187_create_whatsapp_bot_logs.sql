-- Log of every WhatsApp bot interaction — success or failure.
-- Unlike whatsapp_chat_history (only approved users), this captures everything.
create table if not exists public.whatsapp_bot_logs (
  id          uuid        not null default gen_random_uuid(),
  phone       text        not null,
  tenant_id   uuid,                             -- null when user not found
  user_login  text,                             -- null when user not found
  incoming    text        not null,             -- the message the user sent
  response    text        not null,             -- what the bot replied
  status      text        not null check (status in (
                'success',    -- normal AI response
                'not_found',  -- phone not registered
                'blocked',    -- user is blocked
                'pending',    -- user awaiting approval
                'command',    -- /ajuda, /limpar etc.
                'error'       -- unexpected error
              )),
  created_at  timestamptz not null default timezone('utc', now()),
  primary key (id)
);

create index if not exists idx_whatsapp_bot_logs_phone
  on public.whatsapp_bot_logs(phone, created_at desc);

create index if not exists idx_whatsapp_bot_logs_status
  on public.whatsapp_bot_logs(status, created_at desc);
