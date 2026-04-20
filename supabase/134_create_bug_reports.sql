create table if not exists public.bug_reports (
  id text primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  reporter_auth_user_id uuid,
  reporter_login text not null,
  reporter_email text,
  screen text not null,
  screen_label text not null,
  record_id text,
  record_label text,
  description text not null,
  status text not null default 'open'
    check (status in ('open', 'in-review', 'resolved', 'dismissed')),
  resolution_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bug_report_attachments (
  id text primary key,
  bug_report_id text not null references public.bug_reports(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default timezone('utc', now())
);

insert into storage.buckets (id, name, public, file_size_limit)
values ('bug-docs', 'bug-docs', false, 10485760)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create index if not exists idx_bug_reports_tenant_id
  on public.bug_reports(tenant_id);

create index if not exists idx_bug_reports_status
  on public.bug_reports(status);

create index if not exists idx_bug_reports_created_at
  on public.bug_reports(created_at desc);

create index if not exists idx_bug_report_attachments_report_id
  on public.bug_report_attachments(bug_report_id);

alter table public.bug_reports enable row level security;
alter table public.bug_report_attachments enable row level security;

drop policy if exists bug_reports_select on public.bug_reports;
create policy bug_reports_select on public.bug_reports
  for select to authenticated
  using (
    public.is_current_user_platform_admin()
    or tenant_id = public.get_current_user_tenant_id()
  );

drop policy if exists bug_reports_insert on public.bug_reports;
create policy bug_reports_insert on public.bug_reports
  for insert to authenticated
  with check (
    tenant_id = public.get_current_user_tenant_id()
    or public.is_current_user_platform_admin()
  );

drop policy if exists bug_reports_update on public.bug_reports;
create policy bug_reports_update on public.bug_reports
  for update to authenticated
  using (public.is_current_user_platform_admin())
  with check (public.is_current_user_platform_admin());

drop policy if exists bug_report_attachments_select on public.bug_report_attachments;
create policy bug_report_attachments_select on public.bug_report_attachments
  for select to authenticated
  using (
    public.is_current_user_platform_admin()
    or exists (
      select 1
      from public.bug_reports br
      where br.id = bug_report_attachments.bug_report_id
        and br.tenant_id = public.get_current_user_tenant_id()
    )
  );

drop policy if exists bug_report_attachments_insert on public.bug_report_attachments;
create policy bug_report_attachments_insert on public.bug_report_attachments
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.bug_reports br
      where br.id = bug_report_attachments.bug_report_id
        and (
          br.tenant_id = public.get_current_user_tenant_id()
          or public.is_current_user_platform_admin()
        )
    )
  );

drop policy if exists bug_docs_storage_select on storage.objects;
create policy bug_docs_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bug-docs'
    and (
      public.is_current_user_platform_admin()
      or (storage.foldername(name))[1] = public.get_current_user_tenant_id()::text
    )
  );

drop policy if exists bug_docs_storage_insert on storage.objects;
create policy bug_docs_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bug-docs'
    and (
      public.is_current_user_platform_admin()
      or (storage.foldername(name))[1] = public.get_current_user_tenant_id()::text
    )
  );

drop policy if exists bug_docs_storage_update on storage.objects;
create policy bug_docs_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'bug-docs'
    and public.is_current_user_platform_admin()
  )
  with check (
    bucket_id = 'bug-docs'
    and public.is_current_user_platform_admin()
  );

drop policy if exists bug_docs_storage_delete on storage.objects;
create policy bug_docs_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bug-docs'
    and public.is_current_user_platform_admin()
  );
