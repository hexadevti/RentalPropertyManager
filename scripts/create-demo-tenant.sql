-- ============================================================
-- RPM — Demo Tenant Seed (English)
-- ============================================================
-- Run from the Supabase SQL Editor. NOT a numbered migration.
-- Idempotent: safe to run multiple times (uses ON CONFLICT).
-- ============================================================

DO $$
DECLARE
  v_tenant  uuid := 'aaaaaaaa-0000-4000-a000-000000000001'::uuid;
  v_p1 uuid := 'bbbbbbbb-0000-4000-a000-000000000001'::uuid;
  v_p2 uuid := 'bbbbbbbb-0000-4000-a000-000000000002'::uuid;
  v_p3 uuid := 'bbbbbbbb-0000-4000-a000-000000000003'::uuid;
  v_p4 uuid := 'bbbbbbbb-0000-4000-a000-000000000004'::uuid;
  v_p5 uuid := 'bbbbbbbb-0000-4000-a000-000000000005'::uuid;
  v_o1 uuid := 'cccccccc-0000-4000-a000-000000000001'::uuid;
  v_o2 uuid := 'cccccccc-0000-4000-a000-000000000002'::uuid;
  v_o3 uuid := 'cccccccc-0000-4000-a000-000000000003'::uuid;
  v_g1 uuid := 'dddddddd-0000-4000-a000-000000000001'::uuid;
  v_g2 uuid := 'dddddddd-0000-4000-a000-000000000002'::uuid;
  v_g3 uuid := 'dddddddd-0000-4000-a000-000000000003'::uuid;
  v_g4 uuid := 'dddddddd-0000-4000-a000-000000000004'::uuid;
  v_g5 uuid := 'dddddddd-0000-4000-a000-000000000005'::uuid;
  v_c1 uuid := 'eeeeeeee-0000-4000-a000-000000000001'::uuid;
  v_c2 uuid := 'eeeeeeee-0000-4000-a000-000000000002'::uuid;
  v_c3 uuid := 'eeeeeeee-0000-4000-a000-000000000003'::uuid;
  v_c4 uuid := 'eeeeeeee-0000-4000-a000-000000000004'::uuid;
  v_c5 uuid := 'eeeeeeee-0000-4000-a000-000000000005'::uuid;
  v_c6 uuid := 'eeeeeeee-0000-4000-a000-000000000006'::uuid;
  v_sp1 uuid := 'ffffffff-0000-4000-a000-000000000001'::uuid;
  v_sp2 uuid := 'ffffffff-0000-4000-a000-000000000002'::uuid;
  v_i1 uuid := '11111111-0000-4000-a000-000000000001'::uuid;
  v_i2 uuid := '11111111-0000-4000-a000-000000000002'::uuid;
  v_i3 uuid := '11111111-0000-4000-a000-000000000003'::uuid;

BEGIN

-- ══════════════════════════════════════════════════════════
-- 1. TENANT
-- ══════════════════════════════════════════════════════════
INSERT INTO public.tenants (id, name, created_at)
VALUES (v_tenant, 'Demo', now() - interval '180 days')
ON CONFLICT (id) DO UPDATE SET name = excluded.name;

-- Enterprise plan — removes user/property limits for demo data
INSERT INTO public.tenant_usage_plans (tenant_id, plan_code, notes)
VALUES (v_tenant, 'enterprise', 'Demo tenant — enterprise plan for showcase')
ON CONFLICT (tenant_id) DO UPDATE SET plan_code = 'enterprise';

-- ══════════════════════════════════════════════════════════
-- 2. USER PROFILES
-- ══════════════════════════════════════════════════════════
INSERT INTO public.user_profiles
  (id, tenant_id, github_login, role, status, email, avatar_url, phone, created_at, updated_at)
VALUES
  ('22222222-0000-4000-a000-000000000001'::uuid, v_tenant, 'admin.demo', 'admin', 'approved',
   'admin@demo.rpm', 'https://ui-avatars.com/api/?name=Admin+Demo&background=4f46e5&color=fff',
   '+12125551001', now() - interval '180 days', now()),
  ('22222222-0000-4000-a000-000000000002'::uuid, v_tenant, 'laura.demo', 'admin', 'approved',
   'laura@demo.rpm', 'https://ui-avatars.com/api/?name=Laura+Silva&background=7c3aed&color=fff',
   '+12125551002', now() - interval '150 days', now()),
  ('22222222-0000-4000-a000-000000000003'::uuid, v_tenant, 'mark.demo', 'admin', 'approved',
   'mark@demo.rpm', 'https://ui-avatars.com/api/?name=Mark+Costa&background=0ea5e9&color=fff',
   '+12125551003', now() - interval '120 days', now()),
  ('22222222-0000-4000-a000-000000000004'::uuid, v_tenant, 'tenant.a', 'guest', 'approved',
   'tenant.a@demo.rpm', 'https://ui-avatars.com/api/?name=Tenant+A&background=10b981&color=fff',
   null, now() - interval '90 days', now()),
  ('22222222-0000-4000-a000-000000000005'::uuid, v_tenant, 'tenant.b', 'guest', 'pending',
   'tenant.b@demo.rpm', 'https://ui-avatars.com/api/?name=Tenant+B&background=f59e0b&color=fff',
   null, now() - interval '5 days', now())
ON CONFLICT (id) DO UPDATE SET email = excluded.email, phone = excluded.phone;

-- ══════════════════════════════════════════════════════════
-- 3. OWNERS
-- ══════════════════════════════════════════════════════════
INSERT INTO public.owners
  (id, tenant_id, name, email, phone, document, nationality, marital_status, profession, address, created_at)
VALUES
  (v_o1, v_tenant, 'John Carter Mendes', 'john.mendes@email.com', '+12125550001',
   '[{"type":"SSN","number":"123-45-6789"}]', 'American', 'Married', 'Civil Engineer',
   '345 Palm Ave, Miami, FL', now() - interval '170 days'),
  (v_o2, v_tenant, 'Mary Edwards Santos', 'mary.santos@email.com', '+12125550002',
   '[{"type":"SSN","number":"987-65-4321"}]', 'American', 'Divorced', 'Physician',
   '1200 Ocean Drive, Apt 801, Miami Beach, FL', now() - interval '160 days'),
  (v_o3, v_tenant, 'Silva Investments LLC', 'contact@silva-investments.com', '+12125550003',
   '[{"type":"EIN","number":"12-3456789"}]', 'American', null, 'Real Estate Investment',
   '3064 Brickell Ave, Miami, FL', now() - interval '150 days')
ON CONFLICT (tenant_id, id) DO UPDATE SET name = excluded.name, email = excluded.email;

-- ══════════════════════════════════════════════════════════
-- 4. PROPERTIES
-- ══════════════════════════════════════════════════════════
INSERT INTO public.properties
  (id, tenant_id, name, type, capacity, price_per_night, price_per_month,
   address, city, conservation_state, description, created_at)
VALUES
  (v_p1, v_tenant, 'Ocean View Apt 201', 'apartment', 4, 320.00, 3200.00,
   '201 Beachfront Ave, Apt 501', 'Miami Beach', 'Excellent',
   '2-bedroom apartment with stunning ocean views. Fully furnished, air-conditioned throughout, gourmet balcony. Perfect for short-term stays or monthly rentals.',
   now() - interval '170 days'),
  (v_p2, v_tenant, 'Lakes House — Gardens', 'house', 8, 580.00, 5500.00,
   '87 Maple Lane', 'Coral Gables', 'Very Good',
   '3-bedroom house in a gated community with pool, barbecue area and 3-car garage. Close to Fairchild Tropical Garden.',
   now() - interval '165 days'),
  (v_p3, v_tenant, 'Central Studio 305', 'room', 2, 150.00, 1800.00,
   '305 Brickell Ave, Apt 3', 'Miami', 'Good',
   'Compact and well-located studio in the heart of Miami. Furnished, open-plan kitchen. Great option for professionals.',
   now() - interval '160 days'),
  (v_p4, v_tenant, 'Industrial Loft — Wynwood', 'apartment', 3, 250.00, 2800.00,
   '78 NW 2nd Ave, Apt 12', 'Miami', 'Excellent',
   'Modern loft with double-height ceilings in Miami''s arts district. Contemporary décor, balcony and parking. Close to galleries and restaurants.',
   now() - interval '155 days'),
  (v_p5, v_tenant, 'Panoramic Penthouse — Brickell', 'apartment', 6, 850.00, 9500.00,
   '500 Brickell Key Dr, PH 01', 'Miami', 'Excellent',
   'Duplex penthouse with 360° views of the bay and city skyline. 3 en-suite bedrooms, private pool, jacuzzi and sauna. Ultra-premium standard.',
   now() - interval '150 days')
ON CONFLICT (tenant_id, id) DO UPDATE SET name = excluded.name;

-- ── Property owners ─────────────────────────────────────
DELETE FROM public.property_owners WHERE tenant_id = v_tenant;
INSERT INTO public.property_owners (tenant_id, property_id, owner_id) VALUES
  (v_tenant, v_p1, v_o1), (v_tenant, v_p1, v_o2),
  (v_tenant, v_p2, v_o1),
  (v_tenant, v_p3, v_o3),
  (v_tenant, v_p4, v_o3),
  (v_tenant, v_p5, v_o2);

-- ── Environments ────────────────────────────────────────
DELETE FROM public.property_environments WHERE tenant_id = v_tenant;
INSERT INTO public.property_environments (tenant_id, property_id, environment_order, environment_name) VALUES
  (v_tenant,v_p1,1,'Living Room'),(v_tenant,v_p1,2,'Kitchen'),(v_tenant,v_p1,3,'Master Bedroom'),
  (v_tenant,v_p1,4,'Bedroom 2'),(v_tenant,v_p1,5,'Bathroom'),(v_tenant,v_p1,6,'Balcony'),
  (v_tenant,v_p2,1,'Living Room'),(v_tenant,v_p2,2,'Kitchen'),(v_tenant,v_p2,3,'Master Suite'),
  (v_tenant,v_p2,4,'Bedroom 2'),(v_tenant,v_p2,5,'Bedroom 3'),(v_tenant,v_p2,6,'Guest Bathroom'),
  (v_tenant,v_p2,7,'Outdoor Kitchen'),(v_tenant,v_p2,8,'Garage'),
  (v_tenant,v_p3,1,'Main Area'),(v_tenant,v_p3,2,'Bathroom'),
  (v_tenant,v_p4,1,'Common Area'),(v_tenant,v_p4,2,'Mezzanine'),(v_tenant,v_p4,3,'Bathroom'),
  (v_tenant,v_p5,1,'Living Room'),(v_tenant,v_p5,2,'Gourmet Kitchen'),(v_tenant,v_p5,3,'Suite 1'),
  (v_tenant,v_p5,4,'Suite 2'),(v_tenant,v_p5,5,'Suite 3'),(v_tenant,v_p5,6,'Pool'),
  (v_tenant,v_p5,7,'Rooftop Terrace');

-- ── Furniture ───────────────────────────────────────────
DELETE FROM public.property_furniture WHERE tenant_id = v_tenant;
INSERT INTO public.property_furniture (tenant_id, property_id, item_order, item_name) VALUES
  (v_tenant,v_p1,1,'3-seater sofa'),(v_tenant,v_p1,2,'55" Smart TV'),(v_tenant,v_p1,3,'Queen bed'),
  (v_tenant,v_p1,4,'6-door wardrobe'),(v_tenant,v_p1,5,'4-seat dining table'),
  (v_tenant,v_p2,1,'King bed'),(v_tenant,v_p2,2,'65" Smart TV'),(v_tenant,v_p2,3,'Pool table'),
  (v_tenant,v_p2,4,'Built-in BBQ grill'),(v_tenant,v_p2,5,'Pool furniture set'),
  (v_tenant,v_p3,1,'Single bed'),(v_tenant,v_p3,2,'Work desk'),(v_tenant,v_p3,3,'32" TV'),
  (v_tenant,v_p4,1,'Sectional sofa'),(v_tenant,v_p4,2,'Standing desk'),(v_tenant,v_p4,3,'Queen bed'),
  (v_tenant,v_p5,1,'King bed — master suite'),(v_tenant,v_p5,2,'Jacuzzi'),(v_tenant,v_p5,3,'Home theater');

-- ── Inspection items ────────────────────────────────────
DELETE FROM public.property_inspection_items WHERE tenant_id = v_tenant;
INSERT INTO public.property_inspection_items (tenant_id, property_id, item_order, item_name) VALUES
  (v_tenant,v_p1,1,'Air conditioning'),(v_tenant,v_p1,2,'Faucet'),(v_tenant,v_p1,3,'Shower'),
  (v_tenant,v_p1,4,'Windows'),(v_tenant,v_p1,5,'Electrical outlets'),(v_tenant,v_p1,6,'Door lock'),
  (v_tenant,v_p2,1,'Electronic gate'),(v_tenant,v_p2,2,'Pool'),(v_tenant,v_p2,3,'Water heater'),
  (v_tenant,v_p2,4,'Intercom'),(v_tenant,v_p2,5,'Security alarm'),
  (v_tenant,v_p3,1,'Smart lock'),(v_tenant,v_p3,2,'Shower'),(v_tenant,v_p3,3,'Air conditioning'),
  (v_tenant,v_p4,1,'Split AC unit'),(v_tenant,v_p4,2,'Gate'),(v_tenant,v_p4,3,'Elevator'),
  (v_tenant,v_p5,1,'Sound system'),(v_tenant,v_p5,2,'Pool'),(v_tenant,v_p5,3,'Jacuzzi'),
  (v_tenant,v_p5,4,'Sauna'),(v_tenant,v_p5,5,'Home automation system');

-- ══════════════════════════════════════════════════════════
-- 5. GUESTS
-- ══════════════════════════════════════════════════════════
INSERT INTO public.guests
  (id, tenant_id, name, email, phone, document, nationality, marital_status, profession, address, date_of_birth, created_at)
VALUES
  (v_g1, v_tenant, 'Charles Edward Oliver', 'charles.oliver@email.com', '+12125557001',
   '[{"type":"ID","number":"DL-111-222-333"}]', 'American', 'Single', 'Software Developer',
   '900 Brickell Bay Dr, Miami', '1990-03-15', now() - interval '120 days'),
  (v_g2, v_tenant, 'Anne Paula Lima', 'anne.lima@email.com', '+12125557002',
   '[{"type":"Passport","number":"555666777"},{"type":"ID","number":"FL-12345678"}]',
   'American', 'Married', 'Architect', '200 Vizcaya Ave, Coral Gables', '1985-07-22', now() - interval '100 days'),
  (v_g3, v_tenant, 'Robert Ferreira Neto', 'robert.ferreira@email.com', '+12125557003',
   '[{"type":"ID","number":"NY-999888777"}]', 'American', 'Divorced', 'Attorney',
   '1000 Collins Ave, Apt 32, Miami Beach', '1978-11-08', now() - interval '90 days'),
  (v_g4, v_tenant, 'Fernanda Costa Rodrigues', 'fernanda.costa@email.com', '+12125557004',
   '[{"type":"Passport","number":"AB123456"},{"type":"ID","number":"FL-44433221"}]',
   'American', 'Single', 'Physician', '500 Lincoln Road, Miami Beach', '1992-05-30', now() - interval '60 days'),
  (v_g5, v_tenant, 'Edward Santos Almeida', 'edward.santos@email.com', '+13055557005',
   '[{"type":"ID","number":"FL-222111000"}]', 'American', 'Married', 'Business Owner',
   '3000 Biscayne Blvd, Miami', '1975-09-12', now() - interval '45 days')
ON CONFLICT (tenant_id, id) DO UPDATE SET email = excluded.email;

-- ══════════════════════════════════════════════════════════
-- 6. CONTRACTS
-- ══════════════════════════════════════════════════════════
INSERT INTO public.contracts
  (id, tenant_id, guest_id, rental_type, start_date, end_date, payment_due_day,
   monthly_amount, status, notes, created_at)
VALUES
  (v_c1, v_tenant, v_g1, 'monthly',    '2025-09-01', '2026-08-31',  5,  3200.00, 'active',
   'Monthly lease. Tenant is very careful with the property.', now() - interval '120 days'),
  (v_c2, v_tenant, v_g2, 'monthly',    '2025-10-01', '2026-09-30', 10,  5500.00, 'active',
   'Tenant is an artist and may make minor decorative changes with prior written approval.', now() - interval '100 days'),
  (v_c3, v_tenant, v_g3, 'monthly',    '2024-06-01', '2025-05-31',  5,  1800.00, 'expired',
   'Contract ended. Exit inspection completed with no outstanding issues.', now() - interval '300 days'),
  (v_c4, v_tenant, v_g4, 'short-term', '2025-12-20', '2026-01-05',  1,  8500.00, 'active',
   'Summer vacation stay. Full payment received in advance via bank transfer.', now() - interval '60 days'),
  (v_c5, v_tenant, v_g5, 'monthly',    '2025-11-01', '2026-10-31', 15,  2800.00, 'active',
   'Corporate relocation. Monthly invoice reimbursed by tenant''s employer.', now() - interval '45 days'),
  (v_c6, v_tenant, v_g3, 'short-term', '2024-01-10', '2024-01-20',  1,  2800.00, 'cancelled',
   'Cancelled by tenant before move-in. Cancellation fee applied as per contract terms.', now() - interval '400 days')
ON CONFLICT (tenant_id, id) DO UPDATE SET status = excluded.status;

-- ── Contract-property links ──────────────────────────────
DELETE FROM public.contract_properties WHERE tenant_id = v_tenant;
INSERT INTO public.contract_properties (tenant_id, contract_id, property_id) VALUES
  (v_tenant, v_c1, v_p1),
  (v_tenant, v_c2, v_p2),
  (v_tenant, v_c3, v_p3),
  (v_tenant, v_c4, v_p5),
  (v_tenant, v_c4, v_p1),
  (v_tenant, v_c5, v_p4),
  (v_tenant, v_c6, v_p3);

-- ══════════════════════════════════════════════════════════
-- 7. SERVICE PROVIDERS
-- ══════════════════════════════════════════════════════════
INSERT INTO public.service_providers
  (id, tenant_id, name, service, contact, email, document, address, notes, created_at)
VALUES
  (v_sp1, v_tenant, 'Paul''s Plumbing & Co', 'Plumbing & Pipe Repair', '+13055560001',
   'paul@paulsplumbing.com', 'LIC-123456',
   '15 Plumber St, Miami', '⭐⭐⭐⭐⭐ Excellent professional, punctual and fair pricing. Available for emergencies.',
   now() - interval '150 days'),
  (v_sp2, v_tenant, 'Safe Electrical — Mark', 'Electrical Installations', '+13055560002',
   'mark@safeelectrical.com', 'LIC-987654',
   '220 Electric Ave, Miami', '⭐⭐⭐⭐ Good quality, occasionally slow to return calls. Fully licensed.',
   now() - interval '130 days')
ON CONFLICT (tenant_id, id) DO UPDATE SET name = excluded.name;

-- ══════════════════════════════════════════════════════════
-- 8. TRANSACTIONS (25 records)
-- ══════════════════════════════════════════════════════════
DELETE FROM public.transactions WHERE tenant_id = v_tenant;
INSERT INTO public.transactions
  (id, tenant_id, type, amount, category, description, date, property_id, contract_id, created_at)
VALUES
  (gen_random_uuid(), v_tenant, 'income', 3200.00, 'Rent',        'Rent Oct/25 — Ocean View Apt 201',             '2025-10-05', v_p1, v_c1, now() - interval '75 days'),
  (gen_random_uuid(), v_tenant, 'income', 3200.00, 'Rent',        'Rent Nov/25 — Ocean View Apt 201',             '2025-11-05', v_p1, v_c1, now() - interval '45 days'),
  (gen_random_uuid(), v_tenant, 'income', 3200.00, 'Rent',        'Rent Dec/25 — Ocean View Apt 201',             '2025-12-05', v_p1, v_c1, now() - interval '15 days'),
  (gen_random_uuid(), v_tenant, 'income', 5500.00, 'Rent',        'Rent Oct/25 — Lakes House Gardens',            '2025-10-10', v_p2, v_c2, now() - interval '72 days'),
  (gen_random_uuid(), v_tenant, 'income', 5500.00, 'Rent',        'Rent Nov/25 — Lakes House Gardens',            '2025-11-10', v_p2, v_c2, now() - interval '42 days'),
  (gen_random_uuid(), v_tenant, 'income', 5500.00, 'Rent',        'Rent Dec/25 — Lakes House Gardens',            '2025-12-10', v_p2, v_c2, now() - interval '12 days'),
  (gen_random_uuid(), v_tenant, 'income', 2800.00, 'Rent',        'Rent Nov/25 — Industrial Loft Wynwood',        '2025-11-15', v_p4, v_c5, now() - interval '37 days'),
  (gen_random_uuid(), v_tenant, 'income', 2800.00, 'Rent',        'Rent Dec/25 — Industrial Loft Wynwood',        '2025-12-15', v_p4, v_c5, now() - interval '7 days'),
  (gen_random_uuid(), v_tenant, 'income', 8500.00, 'Rent',        'Summer stay — Panoramic Penthouse (prepaid)',   '2025-12-20', v_p5, v_c4, now() - interval '10 days'),
  (gen_random_uuid(), v_tenant, 'income',  350.00, 'Fee',         'Management fee Dec/25',                        '2025-12-31', null, null,  now() - interval '1 day'),
  (gen_random_uuid(), v_tenant, 'income',  800.00, 'Penalty',     'Early termination fee — Robert (contract c6)', '2024-01-10', v_p3, v_c6, now() - interval '400 days'),
  (gen_random_uuid(), v_tenant, 'expense',  450.00, 'Maintenance', 'Faucet and pipe repair — Ocean View Apt',     '2025-11-20', v_p1, null, now() - interval '32 days'),
  (gen_random_uuid(), v_tenant, 'expense',  280.00, 'Maintenance', 'Outlet and breaker replacement — Lakes House','2025-10-25', v_p2, null, now() - interval '67 days'),
  (gen_random_uuid(), v_tenant, 'expense', 1200.00, 'Property Tax','Property tax installment 10/12 — Penthouse',  '2025-10-20', v_p5, null, now() - interval '72 days'),
  (gen_random_uuid(), v_tenant, 'expense',  890.00, 'HOA',         'HOA fee Oct — Lakes House Gardens',           '2025-10-05', v_p2, null, now() - interval '77 days'),
  (gen_random_uuid(), v_tenant, 'expense',  890.00, 'HOA',         'HOA fee Nov — Lakes House Gardens',           '2025-11-05', v_p2, null, now() - interval '47 days'),
  (gen_random_uuid(), v_tenant, 'expense',  890.00, 'HOA',         'HOA fee Dec — Lakes House Gardens',           '2025-12-05', v_p2, null, now() - interval '17 days'),
  (gen_random_uuid(), v_tenant, 'expense',  320.00, 'HOA',         'HOA fee Oct — Ocean View Apt',                '2025-10-05', v_p1, null, now() - interval '77 days'),
  (gen_random_uuid(), v_tenant, 'expense',  320.00, 'HOA',         'HOA fee Nov — Ocean View Apt',                '2025-11-05', v_p1, null, now() - interval '47 days'),
  (gen_random_uuid(), v_tenant, 'expense', 2500.00, 'Insurance',   'Annual property insurance — Penthouse',       '2025-09-15', v_p5, null, now() - interval '107 days'),
  (gen_random_uuid(), v_tenant, 'expense',  150.00, 'Cleaning',    'Post-stay deep clean — Penthouse Brickell',   '2025-12-22', v_p5, null, now() - interval '8 days'),
  (gen_random_uuid(), v_tenant, 'expense',  380.00, 'Painting',    'Touch-up painting living room — Central Studio','2025-10-30', v_p3, null, now() - interval '62 days'),
  (gen_random_uuid(), v_tenant, 'expense',  120.00, 'Maintenance', 'AC service and filter replacement — Wynwood Loft','2025-11-10', v_p4, null, now() - interval '42 days'),
  (gen_random_uuid(), v_tenant, 'expense',  650.00, 'Commission',  'Brokerage commission November',               '2025-11-30', null, null, now() - interval '22 days'),
  (gen_random_uuid(), v_tenant, 'expense',  200.00, 'Other',       'Cleaning supplies and general upkeep',        '2025-12-10', null, null, now() - interval '12 days');

-- ══════════════════════════════════════════════════════════
-- 9. TASKS
-- ══════════════════════════════════════════════════════════
DELETE FROM public.tasks WHERE tenant_id = v_tenant;
INSERT INTO public.tasks
  (id, tenant_id, title, description, due_date, priority, status, assignee, property_id, created_at, updated_at)
VALUES
  (gen_random_uuid(), v_tenant,
   'Move-in inspection — Anne Lima (Lakes House)',
   'Conduct detailed inspection before handing over keys. Check pool, BBQ area and all rooms.',
   '2025-10-05', 'high', 'completed', 'Mark Costa', v_p2, now() - interval '95 days', now() - interval '94 days'),
  (gen_random_uuid(), v_tenant,
   'Investigate bathroom leak — Ocean View Apt 201',
   'Tenant Charles reported moisture on bathroom ceiling near the shower. Check whether source is from upstairs unit.',
   '2026-01-20', 'high', 'in-progress', 'Paul (Plumbing)', v_p1, now() - interval '10 days', now() - interval '8 days'),
  (gen_random_uuid(), v_tenant,
   'Renew lease — Charles Oliver (Ocean View Apt)',
   'Lease expires Aug/26. Begin renewal negotiation with CPI adjustment. Contact tenant in March.',
   '2026-03-01', 'medium', 'pending', 'Laura Silva', v_p1, now() - interval '30 days', now() - interval '30 days'),
  (gen_random_uuid(), v_tenant,
   'Exterior painting — Lakes House Gardens',
   'Schedule facade and perimeter wall repainting. Obtain quotes from at least 3 contractors.',
   '2026-02-15', 'low', 'pending', 'Admin Demo', v_p2, now() - interval '20 days', now() - interval '20 days'),
  (gen_random_uuid(), v_tenant,
   'Install security cameras — Wynwood Loft',
   'Install 2 outdoor cameras (entrance and garage). Verify compatibility with existing automation system.',
   '2026-01-30', 'medium', 'pending', 'Mark Costa', v_p4, now() - interval '15 days', now() - interval '15 days'),
  (gen_random_uuid(), v_tenant,
   'Pre-occupancy cleaning — Panoramic Penthouse',
   'Full deep clean before Fernanda Costa''s move-in on Dec 20. Include pool and jacuzzi.',
   '2025-12-19', 'high', 'completed', 'Laura Silva', v_p5, now() - interval '11 days', now() - interval '9 days');

-- ══════════════════════════════════════════════════════════
-- 10. APPOINTMENTS
-- ══════════════════════════════════════════════════════════
DELETE FROM public.appointments WHERE tenant_id = v_tenant;
INSERT INTO public.appointments
  (id, tenant_id, title, description, date, time, status,
   service_provider_id, contract_id, guest_id, property_id,
   notes, completion_notes, completed_at, created_at)
VALUES
  (gen_random_uuid(), v_tenant,
   'Technical visit — Bathroom leak (Ocean View Apt)',
   'Paul (Plumbing) will inspect the bathroom moisture issue. Tenant Charles will be present.',
   '2026-01-18', '09:00', 'scheduled',
   v_sp1, v_c1, v_g1, v_p1, null, null, null, now() - interval '8 days'),
  (gen_random_uuid(), v_tenant,
   'Key handover — Fernanda Costa (Penthouse)',
   'Deliver keys and walk new tenant through the property. Demonstrate all systems and home automation.',
   '2025-12-20', '15:00', 'completed',
   null, v_c4, v_g4, v_p5,
   'Bring 2 sets of keys + garage remote.',
   'Keys delivered without issues. Tenant was thrilled with the property. Minor adjustment to the sound system was needed.',
   now() - interval '9 days', now() - interval '11 days'),
  (gen_random_uuid(), v_tenant,
   'Preventive electrical check — Lakes House Gardens',
   'Mark (Safe Electrical) will inspect the breaker panel and outdoor outlets.',
   '2026-01-25', '10:00', 'scheduled',
   v_sp2, null, null, v_p2, 'Request signed technical report at the end.', null, null, now() - interval '5 days'),
  (gen_random_uuid(), v_tenant,
   'Owner meeting — Portfolio review',
   'Meeting with John Mendes and Mary Santos to review rental rates and plan for 2026.',
   '2026-01-30', '14:00', 'scheduled',
   null, null, null, null, 'Bring 2025 financial report and market analysis.', null, null, now() - interval '3 days');

-- ══════════════════════════════════════════════════════════
-- 11. INSPECTIONS
-- ══════════════════════════════════════════════════════════
DELETE FROM public.inspections WHERE tenant_id = v_tenant;
INSERT INTO public.inspections
  (id, tenant_id, title, property_id, contract_id, type, status,
   inspector_name, scheduled_date, completed_date, summary, created_at, updated_at)
VALUES
  (v_i1, v_tenant, 'Move-in Inspection — Anne Lima (Lakes House)',
   v_p2, v_c2, 'check-in', 'assessed', 'Laura Silva',
   '2025-10-04', '2025-10-04',
   'Property handed over in excellent condition. Pool clean, garden trimmed. Minor wall marks photographed and documented.',
   now() - interval '94 days', now() - interval '94 days'),
  (v_i2, v_tenant, 'Move-in Inspection — Charles Oliver (Ocean View Apt)',
   v_p1, v_c1, 'check-in', 'assessed', 'Admin Demo',
   '2025-09-01', '2025-09-01',
   'Apartment in great condition. AC serviced. All outlets functioning properly.',
   now() - interval '120 days', now() - interval '120 days'),
  (v_i3, v_tenant, 'Periodic Inspection — Wynwood Loft',
   v_p4, v_c5, 'periodic', 'in-progress', 'Mark Costa',
   '2025-12-28', null,
   'In progress. Verify elevator operation and home automation system.',
   now() - interval '3 days', now() - interval '2 days');

DELETE FROM public.inspection_entries WHERE tenant_id = v_tenant;
INSERT INTO public.inspection_entries
  (id, tenant_id, inspection_id, environment_name, environment_order, item_name, item_order, condition, notes)
VALUES
  (gen_random_uuid(), v_tenant, v_i1, 'Living Room', 1, 'Floor', 1, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i1, 'Living Room', 1, 'Walls', 2, 'good', 'Small mark behind sofa — photographed'),
  (gen_random_uuid(), v_tenant, v_i1, 'Living Room', 1, 'Windows', 3, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i1, 'Kitchen', 2, 'Faucet', 1, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i1, 'Kitchen', 2, 'Stove', 2, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i1, 'Kitchen', 2, 'Refrigerator', 3, 'good', 'Door seal slightly worn'),
  (gen_random_uuid(), v_tenant, v_i1, 'Master Suite', 3, 'Floor', 1, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i1, 'Master Suite', 3, 'Air conditioning', 2, 'excellent', 'Serviced Sep/25'),
  (gen_random_uuid(), v_tenant, v_i1, 'Outdoor Kitchen', 7, 'BBQ grill', 1, 'good', 'Surface rust on grate'),
  (gen_random_uuid(), v_tenant, v_i1, 'Outdoor Kitchen', 7, 'Outdoor sink', 2, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i2, 'Living Room', 1, 'Floor', 1, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i2, 'Living Room', 1, 'Air conditioning', 2, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i2, 'Master Bedroom', 3, 'Bed frame', 1, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i2, 'Master Bedroom', 3, 'Wardrobe', 2, 'good', 'One sliding door slightly stiff'),
  (gen_random_uuid(), v_tenant, v_i2, 'Bathroom', 5, 'Faucet', 1, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i2, 'Bathroom', 5, 'Shower', 2, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i2, 'Balcony', 6, 'Floor', 1, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i3, 'Common Area', 1, 'Floor', 1, 'good', null),
  (gen_random_uuid(), v_tenant, v_i3, 'Common Area', 1, 'Split AC unit', 2, 'attention', 'Filter needs cleaning'),
  (gen_random_uuid(), v_tenant, v_i3, 'Mezzanine', 2, 'Stairs', 1, 'excellent', null),
  (gen_random_uuid(), v_tenant, v_i3, 'Mezzanine', 2, 'Safety railing', 2, 'good', null);

-- ══════════════════════════════════════════════════════════
-- 12. NOTIFICATION RULES
-- ══════════════════════════════════════════════════════════
DELETE FROM public.notification_rules WHERE tenant_id = v_tenant;
INSERT INTO public.notification_rules
  (id, tenant_id, name, trigger, event_type, channels, recipient_roles, is_active, days_before, created_at, updated_at)
VALUES
  (gen_random_uuid(), v_tenant, 'Lease expiring in 30 days alert',
   'contract-expiration', 'contracts', '["email"]'::jsonb, '["admin"]'::jsonb, true, 30, now(), now()),
  (gen_random_uuid(), v_tenant, 'New task created notification',
   'task-created', 'tasks', '["email"]'::jsonb, '["admin"]'::jsonb, true, null, now(), now());

RAISE NOTICE '✅ Demo tenant created successfully!';
RAISE NOTICE '   Tenant: Demo (ID: %)', v_tenant;
RAISE NOTICE '   5 properties, 3 owners, 5 guests, 6 contracts';
RAISE NOTICE '   25 transactions, 6 tasks, 4 appointments, 3 inspections';
RAISE NOTICE '   Next: run create-demo-access.sql to create the demo login user.';

END;
$$;
