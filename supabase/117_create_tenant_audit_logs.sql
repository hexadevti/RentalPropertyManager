-- Audit trail for admin operations (users, permissions, tenant settings).

create table if not exists public.tenant_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  actor_login text,
  target_login text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_tenant_audit_logs_tenant_created
  on public.tenant_audit_logs(tenant_id, created_at desc);

alter table public.tenant_audit_logs enable row level security;

drop policy if exists tenant_audit_logs_select on public.tenant_audit_logs;
drop policy if exists tenant_audit_logs_insert on public.tenant_audit_logs;

create policy tenant_audit_logs_select on public.tenant_audit_logs
  for select to authenticated
  using (tenant_id = public.get_current_user_tenant_id());

create policy tenant_audit_logs_insert on public.tenant_audit_logs
  for insert to authenticated
  with check (
    tenant_id = public.get_current_user_tenant_id()
    and public.is_current_user_admin()
  );
