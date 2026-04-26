-- Migration 209: allow tenant admin to delete booking requests in admin portal

drop policy if exists booking_requests_admin_delete on public.booking_requests;
create policy booking_requests_admin_delete on public.booking_requests
  for delete to authenticated
  using (tenant_id = public.get_current_user_tenant_id());
