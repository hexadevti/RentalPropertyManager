-- Allow authenticated users to claim/update invited profile rows where auth_user_id is null.
-- This prevents 403 on upsert(on_conflict=github_login) when a pre-created row exists.

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update on public.user_profiles
for update to authenticated
using (
  auth_user_id = auth.uid()
  or auth_user_id is null
  or public.is_current_user_admin()
)
with check (
  auth_user_id = auth.uid()
  or auth_user_id is null
  or public.is_current_user_admin()
);
