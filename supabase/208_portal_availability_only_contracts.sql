-- Migration 208: portal availability should consider only active contracts

create or replace function public.check_portal_property_availability(
  p_tenant_id uuid,
  p_property_id text,
  p_check_in date,
  p_check_out date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Tenant must have portal enabled
    exists (
      select 1
      from public.tenants t
      where t.id = p_tenant_id
        and t.portal_enabled = true
    )
    -- No overlapping active contract
    and not exists (
      select 1
      from public.contract_properties cp
      join public.contracts c
        on c.tenant_id = cp.tenant_id
       and c.id = cp.contract_id
      where cp.tenant_id = p_tenant_id
        and cp.property_id = p_property_id
        and c.status = 'active'
        and c.start_date::date <= p_check_out
        and c.end_date::date >= p_check_in
    );
$$;

grant execute on function public.check_portal_property_availability(uuid, text, date, date)
  to anon, authenticated;
