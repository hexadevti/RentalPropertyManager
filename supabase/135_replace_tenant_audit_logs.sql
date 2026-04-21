create table if not exists public.app_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  actor_login text,
  entity text not null,
  action text not null check (action in ('login', 'logout', 'create', 'update', 'delete')),
  record_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_audit_logs_tenant_created
  on public.app_audit_logs(tenant_id, created_at desc);

create index if not exists idx_app_audit_logs_actor_created
  on public.app_audit_logs(actor_auth_user_id, created_at desc);

create index if not exists idx_app_audit_logs_entity_action
  on public.app_audit_logs(entity, action);

alter table public.app_audit_logs enable row level security;

drop policy if exists app_audit_logs_select on public.app_audit_logs;
create policy app_audit_logs_select on public.app_audit_logs
  for select to authenticated
  using (
    public.is_current_user_platform_admin()
    or tenant_id = public.get_current_user_tenant_id()
  );

drop policy if exists app_audit_logs_insert on public.app_audit_logs;
create policy app_audit_logs_insert on public.app_audit_logs
  for insert to authenticated
  with check (
    public.is_current_user_platform_admin()
    or tenant_id = public.get_current_user_tenant_id()
  );

drop table if exists public.tenant_audit_logs;
