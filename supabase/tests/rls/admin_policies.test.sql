-- pgTAP tests for admin-panel RLS policies and status/delete guards.
-- Run with: supabase test db
-- Framework: pgTAP (https://pgtap.org/)
-- OpenSpec: changes/admin-panel · tarea 2.5 · specs admin-parking-management / user-roles

BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;

SELECT plan(14);

-- ============================================================
-- Setup: usuarios con distintos roles (UUIDs válidos: solo hex)
-- El trigger handle_new_user autocrea public.users al insertar en auth.users,
-- por eso el ON CONFLICT hace DO UPDATE para fijar role/suspended.
-- ============================================================
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('bbbb0001-0000-0000-0000-000000000001'::uuid, 'ap-admin@motociudad.test',        'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('bbbb0001-0000-0000-0000-000000000002'::uuid, 'ap-contrib-owner@motociudad.test','x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('bbbb0001-0000-0000-0000-000000000003'::uuid, 'ap-contrib-other@motociudad.test','x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('bbbb0001-0000-0000-0000-000000000004'::uuid, 'ap-user@motociudad.test',         'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('bbbb0001-0000-0000-0000-000000000005'::uuid, 'ap-contrib-susp@motociudad.test', 'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, display_name, role, suspended) VALUES
  ('bbbb0001-0000-0000-0000-000000000001'::uuid, 'ap_admin',         'AP Admin',            'admin',       false),
  ('bbbb0001-0000-0000-0000-000000000002'::uuid, 'ap_contrib_owner', 'AP Contrib Owner',    'contributor', false),
  ('bbbb0001-0000-0000-0000-000000000003'::uuid, 'ap_contrib_other', 'AP Contrib Other',    'contributor', false),
  ('bbbb0001-0000-0000-0000-000000000004'::uuid, 'ap_user',          'AP User',             'user',        false),
  ('bbbb0001-0000-0000-0000-000000000005'::uuid, 'ap_contrib_susp',  'AP Contrib Suspended','contributor', true)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, suspended = EXCLUDED.suspended;

-- Parkings (proposed_by = owner C1, salvo el del suspendido)
INSERT INTO public.parkings (id, proposed_by, name, type, status, location, city) VALUES
  ('bbbb0002-0000-0000-0000-000000000001'::uuid, 'bbbb0001-0000-0000-0000-000000000002'::uuid, 'P adminedit',  'public', 'pending',  ST_SetSRID(ST_MakePoint(-3.70, 40.42), 4326)::geography, 'Madrid'),
  ('bbbb0002-0000-0000-0000-000000000002'::uuid, 'bbbb0001-0000-0000-0000-000000000002'::uuid, 'P adminstat',  'public', 'pending',  ST_SetSRID(ST_MakePoint(-3.71, 40.42), 4326)::geography, 'Madrid'),
  ('bbbb0002-0000-0000-0000-000000000003'::uuid, 'bbbb0001-0000-0000-0000-000000000002'::uuid, 'P cstat',      'public', 'pending',  ST_SetSRID(ST_MakePoint(-3.72, 40.42), 4326)::geography, 'Madrid'),
  ('bbbb0002-0000-0000-0000-000000000004'::uuid, 'bbbb0001-0000-0000-0000-000000000002'::uuid, 'P own',        'public', 'verified', ST_SetSRID(ST_MakePoint(-3.73, 40.42), 4326)::geography, 'Madrid'),
  ('bbbb0002-0000-0000-0000-000000000005'::uuid, 'bbbb0001-0000-0000-0000-000000000002'::uuid, 'P other',      'public', 'pending',  ST_SetSRID(ST_MakePoint(-3.74, 40.42), 4326)::geography, 'Madrid'),
  ('bbbb0002-0000-0000-0000-000000000006'::uuid, 'bbbb0001-0000-0000-0000-000000000002'::uuid, 'P del',        'public', 'verified', ST_SetSRID(ST_MakePoint(-3.75, 40.42), 4326)::geography, 'Madrid'),
  ('bbbb0002-0000-0000-0000-000000000007'::uuid, 'bbbb0001-0000-0000-0000-000000000002'::uuid, 'P cdel',       'public', 'verified', ST_SetSRID(ST_MakePoint(-3.76, 40.42), 4326)::geography, 'Madrid'),
  ('bbbb0002-0000-0000-0000-000000000008'::uuid, 'bbbb0001-0000-0000-0000-000000000005'::uuid, 'P suspedit',   'public', 'pending',  ST_SetSRID(ST_MakePoint(-3.77, 40.42), 4326)::geography, 'Madrid')
ON CONFLICT (id) DO NOTHING;

-- Helpers auth.uid(); ejecutable por authenticated. El cambio de rol persiste
-- en la transacción; para volver a postgres (limpieza) se usa RESET ROLE.
GRANT USAGE ON SCHEMA tests TO authenticated, anon;

CREATE OR REPLACE FUNCTION tests.set_auth_user(user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;
GRANT EXECUTE ON FUNCTION tests.set_auth_user(UUID) TO authenticated, anon;

-- ============================================================
-- Edición de parkings
-- ============================================================

-- TEST 1: admin edita cualquier parking (parkings_update_admin)
SELECT tests.set_auth_user('bbbb0001-0000-0000-0000-000000000001'::uuid);
SELECT lives_ok(
  $$ UPDATE public.parkings SET notes = 'editado por admin' WHERE id = 'bbbb0002-0000-0000-0000-000000000001'::uuid $$,
  'parkings_update_admin: admin edita un parking de otro'
);

-- TEST 2: admin cambia status (trigger permite admin)
SELECT lives_ok(
  $$ UPDATE public.parkings SET status = 'verified' WHERE id = 'bbbb0002-0000-0000-0000-000000000002'::uuid $$,
  'status guard: admin verifica un parking (status → verified)'
);
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- TEST 3: contributor NO puede cambiar status (trigger rechaza, ERRCODE 42501)
SELECT tests.set_auth_user('bbbb0001-0000-0000-0000-000000000002'::uuid);
SELECT throws_ok(
  $$ UPDATE public.parkings SET status = 'verified' WHERE id = 'bbbb0002-0000-0000-0000-000000000003'::uuid $$,
  '42501',
  NULL,
  'status guard: contributor NO puede cambiar el status de su parking'
);

-- TEST 4: contributor edita su propio parking (incluso verificado) → parkings_update_contributor_own
SELECT lives_ok(
  $$ UPDATE public.parkings SET notes = 'editado por dueño contributor' WHERE id = 'bbbb0002-0000-0000-0000-000000000004'::uuid $$,
  'parkings_update_contributor_own: contributor edita su propio parking verificado'
);
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- TEST 5: contributor NO edita parkings ajenos (0 filas)
SELECT tests.set_auth_user('bbbb0001-0000-0000-0000-000000000003'::uuid);
WITH u AS (UPDATE public.parkings SET notes = 'intento ajeno' WHERE id = 'bbbb0002-0000-0000-0000-000000000005'::uuid RETURNING id)
SELECT is(
  (SELECT COUNT(*)::integer FROM u),
  0,
  'parkings_update_contributor_own RECHAZO: contributor no edita parking ajeno'
);
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- TEST 6: admin borra/archiva (deleted_at) — trigger permite admin
SELECT tests.set_auth_user('bbbb0001-0000-0000-0000-000000000001'::uuid);
SELECT lives_ok(
  $$ UPDATE public.parkings SET deleted_at = now() WHERE id = 'bbbb0002-0000-0000-0000-000000000006'::uuid $$,
  'delete guard: admin puede borrar/archivar (deleted_at)'
);
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- TEST 7: contributor NO puede borrar (trigger rechaza, 42501)
SELECT tests.set_auth_user('bbbb0001-0000-0000-0000-000000000002'::uuid);
SELECT throws_ok(
  $$ UPDATE public.parkings SET deleted_at = now() WHERE id = 'bbbb0002-0000-0000-0000-000000000007'::uuid $$,
  '42501',
  NULL,
  'delete guard: contributor NO puede borrar su parking'
);
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- TEST 8: contributor suspendido NO edita ni siquiera lo suyo (0 filas)
SELECT tests.set_auth_user('bbbb0001-0000-0000-0000-000000000005'::uuid);
WITH u AS (UPDATE public.parkings SET notes = 'suspendido intenta' WHERE id = 'bbbb0002-0000-0000-0000-000000000008'::uuid RETURNING id)
SELECT is(
  (SELECT COUNT(*)::integer FROM u),
  0,
  'suspensión: contributor suspendido no puede editar su propio parking'
);
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- TEST 9: user (rol user) NO puede editar ningún parking (0 filas)
SELECT tests.set_auth_user('bbbb0001-0000-0000-0000-000000000004'::uuid);
WITH u AS (UPDATE public.parkings SET notes = 'user intenta' WHERE id = 'bbbb0002-0000-0000-0000-000000000001'::uuid RETURNING id)
SELECT is(
  (SELECT COUNT(*)::integer FROM u),
  0,
  'rol user: no puede editar parkings desde el panel'
);
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- Gestión de fotos
-- ============================================================

-- TEST 10: admin añade foto a un parking ajeno (parking_photos_insert_admin)
SELECT tests.set_auth_user('bbbb0001-0000-0000-0000-000000000001'::uuid);
SELECT lives_ok(
  $$ INSERT INTO public.parking_photos (parking_id, uploaded_by, storage_path, is_verification)
     VALUES ('bbbb0002-0000-0000-0000-000000000004'::uuid, 'bbbb0001-0000-0000-0000-000000000001'::uuid,
             'parkings-photos/bbbb0002-0000-0000-0000-000000000004/admin.webp', false) $$,
  'parking_photos_insert_admin: admin añade foto a parking ajeno'
);
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- TEST 11: contributor NO añade foto a parking ajeno pendiente (RLS 42501)
SELECT tests.set_auth_user('bbbb0001-0000-0000-0000-000000000003'::uuid);
SELECT throws_ok(
  $$ INSERT INTO public.parking_photos (parking_id, uploaded_by, storage_path, is_verification)
     VALUES ('bbbb0002-0000-0000-0000-000000000005'::uuid, 'bbbb0001-0000-0000-0000-000000000003'::uuid,
             'parkings-photos/bbbb0002-0000-0000-0000-000000000005/other.webp', false) $$,
  '42501',
  NULL,
  'parking_photos RECHAZO: contributor no añade foto a parking ajeno pendiente'
);
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- TEST 12: contributor suspendido NO añade foto ni a lo suyo (RLS 42501)
SELECT tests.set_auth_user('bbbb0001-0000-0000-0000-000000000005'::uuid);
SELECT throws_ok(
  $$ INSERT INTO public.parking_photos (parking_id, uploaded_by, storage_path, is_verification)
     VALUES ('bbbb0002-0000-0000-0000-000000000008'::uuid, 'bbbb0001-0000-0000-0000-000000000005'::uuid,
             'parkings-photos/bbbb0002-0000-0000-0000-000000000008/susp.webp', false) $$,
  '42501',
  NULL,
  'suspensión: contributor suspendido no puede añadir fotos'
);
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- Metadatos de policies
-- ============================================================

-- TEST 13: parkings tiene 7 policies (3 read [+admin] + insert + update_own_pending + update_admin + update_contributor_own)
SELECT is(
  (SELECT COUNT(*)::integer FROM pg_policies WHERE schemaname = 'public' AND tablename = 'parkings'),
  7,
  'parkings tiene 7 policies RLS tras admin-panel'
);

-- TEST 14: parking_photos tiene 6 policies (2 read + insert + insert_admin + update_admin + delete_admin)
SELECT is(
  (SELECT COUNT(*)::integer FROM pg_policies WHERE schemaname = 'public' AND tablename = 'parking_photos'),
  6,
  'parking_photos tiene 6 policies RLS tras admin-panel'
);

-- Limpieza
DELETE FROM public.parking_photos WHERE parking_id::text LIKE 'bbbb0002-%';
DELETE FROM public.parkings       WHERE id::text LIKE 'bbbb0002-%';
DELETE FROM public.users          WHERE id::text LIKE 'bbbb0001-%';
DELETE FROM auth.users            WHERE id::text LIKE 'bbbb0001-%';
DROP FUNCTION IF EXISTS tests.set_auth_user(UUID);

SELECT * FROM finish();

ROLLBACK;
