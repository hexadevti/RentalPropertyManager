create table if not exists public.contact_messages (
  id text primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  sender_auth_user_id uuid,
  sender_login text not null,
  sender_email text,
  subject text not null,
  description text not null,
  current_url text,
  status text not null default 'open'
    check (status in ('open', 'in-review', 'answered', 'archived')),
  admin_notes text,
  email_sent_at timestamptz,
  delivery_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_contact_messages_tenant_id
  on public.contact_messages(tenant_id);

create index if not exists idx_contact_messages_status
  on public.contact_messages(status);

create index if not exists idx_contact_messages_created_at
  on public.contact_messages(created_at desc);

drop trigger if exists contact_messages_set_updated_at on public.contact_messages;
create trigger contact_messages_set_updated_at
before update on public.contact_messages
for each row execute function public.set_updated_at();

alter table public.contact_messages enable row level security;

drop policy if exists contact_messages_select on public.contact_messages;
create policy contact_messages_select on public.contact_messages
  for select to authenticated
  using (
    public.is_current_user_platform_admin()
  );

drop policy if exists contact_messages_update on public.contact_messages;
create policy contact_messages_update on public.contact_messages
  for update to authenticated
  using (
    public.is_current_user_platform_admin()
  )
  with check (
    public.is_current_user_platform_admin()
  );
