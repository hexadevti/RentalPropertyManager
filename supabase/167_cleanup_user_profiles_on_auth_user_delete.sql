-- Ensure that deleting a Supabase auth user also removes the linked
-- public.user_profiles rows, so no orphan profile remains behind.

create or replace function public.handle_auth_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from public.user_profiles
  where auth_user_id = old.id;

  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
after delete on auth.users
for each row execute function public.handle_auth_user_deleted();
