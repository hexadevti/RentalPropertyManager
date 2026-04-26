-- Migration 205: guest-based portal authentication (separate from admin auth.users)

create extension if not exists pgcrypto;

alter table public.guests
  add column if not exists password_hash text;

-- Register portal guest account in guests table.
create or replace function public.portal_guest_sign_up(
  p_tenant_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_password text
)
returns table (
  id text,
  tenant_id uuid,
  name text,
  email text,
  phone text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guests%rowtype;
  v_email text;
  v_phone text;
  v_name text;
begin
  v_email := lower(trim(coalesce(p_email, '')));
  v_phone := trim(coalesce(p_phone, ''));
  v_name := trim(coalesce(p_name, ''));

  if v_name = '' then
    raise exception 'Nome é obrigatório';
  end if;
  if v_email = '' then
    raise exception 'E-mail é obrigatório';
  end if;
  if v_phone = '' then
    raise exception 'Telefone é obrigatório';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'A senha deve ter pelo menos 6 caracteres';
  end if;

  if not exists (
    select 1 from public.tenants t
    where t.id = p_tenant_id
      and t.portal_enabled = true
  ) then
    raise exception 'Portal não disponível para este tenant';
  end if;

  select *
  into v_guest
  from public.guests g
  where g.tenant_id = p_tenant_id
    and lower(g.email) = v_email
  order by g.created_at asc
  limit 1;

  if found then
    if coalesce(v_guest.password_hash, '') <> '' then
      raise exception 'Já existe cadastro para este e-mail';
    end if;

    update public.guests
    set name = v_name,
        phone = v_phone,
        password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
    where tenant_id = v_guest.tenant_id
      and id = v_guest.id
    returning * into v_guest;
  else
    insert into public.guests (
      tenant_id,
      id,
      name,
      email,
      phone,
      document,
      password_hash
    )
    values (
      p_tenant_id,
      gen_random_uuid()::text,
      v_name,
      v_email,
      v_phone,
      'PORTAL-AUTO',
      extensions.crypt(p_password, extensions.gen_salt('bf'))
    )
    returning * into v_guest;
  end if;

  return query
  select
    v_guest.id,
    v_guest.tenant_id,
    v_guest.name,
    v_guest.email,
    v_guest.phone,
    v_guest.created_at;
end;
$$;

-- Sign in guest account using guests.email + guests.password_hash.
create or replace function public.portal_guest_sign_in(
  p_tenant_id uuid,
  p_email text,
  p_password text
)
returns table (
  id text,
  tenant_id uuid,
  name text,
  email text,
  phone text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    g.id,
    g.tenant_id,
    g.name,
    g.email,
    g.phone,
    g.created_at
  from public.guests g
  where g.tenant_id = p_tenant_id
    and lower(g.email) = lower(trim(p_email))
    and coalesce(g.password_hash, '') <> ''
    and extensions.crypt(p_password, g.password_hash) = g.password_hash
  order by g.created_at asc
  limit 1;
$$;

grant execute on function public.portal_guest_sign_up(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.portal_guest_sign_in(uuid, text, text) to anon, authenticated;
