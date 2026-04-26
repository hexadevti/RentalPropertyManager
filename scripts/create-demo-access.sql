-- ============================================================
-- RPM — Demo User & Access Profile
-- ============================================================
-- Run AFTER create-demo-tenant.sql.
-- Run from the Supabase SQL Editor (service role required).
--
-- Creates:
--   1 Supabase auth user   (demo@rpm.app / Demo@2026!)
--   1 access profile       (Demo — Somente Leitura)
--   access_profile_roles   (read on every module)
--   1 user_profile         (linked to demo tenant + access profile)
-- ============================================================

DO $$
DECLARE
  v_tenant      uuid := 'aaaaaaaa-0000-4000-a000-000000000001'::uuid;
  v_auth_user   uuid := '33333333-0000-4000-a000-000000000001'::uuid;
  v_access_prof uuid := '44444444-0000-4000-a000-000000000001'::uuid;

  v_demo_email    text := 'demo@rpm.app';
  v_demo_password text := 'Demo@2026!';

  v_role text;
BEGIN

-- ══════════════════════════════════════════════════════════
-- 1. AUTH USER (demo@rpm.app)
-- ══════════════════════════════════════════════════════════
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
VALUES (
  v_auth_user,
  '00000000-0000-0000-0000-000000000000'::uuid,
  v_demo_email,
  crypt(v_demo_password, gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Demo RPM","name":"Demo RPM"}'::jsonb,
  false
)
ON CONFLICT (id) DO UPDATE
  SET encrypted_password = crypt(v_demo_password, gen_salt('bf')),
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
      updated_at = now();

-- Also ensure email is in auth.identities
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at
)
VALUES (
  v_auth_user,
  v_auth_user,
  jsonb_build_object('sub', v_auth_user::text, 'email', v_demo_email),
  'email',
  v_demo_email,
  now(), now(), now()
)
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- 2. ACCESS PROFILE — Demo (Somente Leitura)
-- ══════════════════════════════════════════════════════════
INSERT INTO public.access_profiles
  (id, tenant_id, name, description, is_system, created_at, updated_at)
VALUES
  (v_access_prof, v_tenant,
   'Demo — Read Only',
   'Demo access profile. Read-only access to all system modules.',
   true, now(), now())
ON CONFLICT (tenant_id, id) DO UPDATE
  SET name = excluded.name, updated_at = now();

-- ── Access profile roles (read on every module) ──────────
DELETE FROM public.access_profile_roles
  WHERE tenant_id = v_tenant AND access_profile_id = v_access_prof::text;

INSERT INTO public.access_profile_roles
  (tenant_id, access_profile_id, access_role_id, access_level, created_at, updated_at)
SELECT
  v_tenant,
  v_access_prof::text,
  role_id,
  'read',
  now(), now()
FROM unnest(ARRAY[
  'tenant', 'properties', 'owners', 'finances', 'calendar', 'tasks', 'reports',
  'guests', 'contracts', 'documents', 'ai-assistant', 'inspections', 'templates',
  'notifications', 'providers', 'appointments', 'users-permissions',
  'access-profiles', 'audit-logs'
]::text[]) AS role_id;

-- ══════════════════════════════════════════════════════════
-- 3. USER PROFILE (demo user → demo tenant)
-- ══════════════════════════════════════════════════════════
-- Remove any stale profile (e.g. from a previous app sign-up in another tenant)
DELETE FROM public.user_profiles WHERE auth_user_id = v_auth_user;

INSERT INTO public.user_profiles
  (id, tenant_id, auth_user_id, github_login, role, status,
   email, avatar_url, access_profile_id, created_at, updated_at)
VALUES
  ('55555555-0000-4000-a000-000000000001'::uuid,
   v_tenant,
   v_auth_user,
   'demo',
   'admin',     -- admin role so all screens are accessible via access profile
   'approved',
   v_demo_email,
   'https://ui-avatars.com/api/?name=Demo+RPM&background=4f46e5&color=fff&bold=true',
   v_access_prof::text,
   now(), now())
ON CONFLICT (auth_user_id) DO NOTHING;

RAISE NOTICE '';
RAISE NOTICE '✅ Demo user ready!';
RAISE NOTICE '   Email   : %', v_demo_email;
RAISE NOTICE '   Password: %', v_demo_password;
RAISE NOTICE '   Tenant  : Imobiliária Exemplo';
RAISE NOTICE '   Access  : Read-only on all modules';
RAISE NOTICE '';
RAISE NOTICE '   Add the "Demo" button in Login.tsx to auto-fill credentials.';

END;
$$;
