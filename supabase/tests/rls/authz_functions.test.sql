-- pgTAP tests for authorization primitives: is_admin() / can_manage_parkings()
-- Run with: supabase test db
-- Framework: pgTAP (https://pgtap.org/)
-- OpenSpec: changes/admin-panel · tarea 1.4 · spec user-roles

BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;

SELECT plan(11);

-- ============================================================
-- Setup: usuarios con cada combinación de rol/suspensión
-- (UUIDs válidos: solo dígitos hexadecimales)
-- El trigger handle_new_user autocrea public.users al insertar en auth.users,
-- por eso el ON CONFLICT hace DO UPDATE para fijar role/suspended.
-- ============================================================
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('aaaa0001-0000-0000-0000-000000000001'::uuid, 'authz-admin@motociudad.test',       'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('aaaa0001-0000-0000-0000-000000000002'::uuid, 'authz-admin-susp@motociudad.test',  'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('aaaa0001-0000-0000-0000-000000000003'::uuid, 'authz-contrib@motociudad.test',     'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('aaaa0001-0000-0000-0000-000000000004'::uuid, 'authz-contrib-susp@motociudad.test','x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('aaaa0001-0000-0000-0000-000000000005'::uuid, 'authz-user@motociudad.test',        'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, display_name, role, suspended) VALUES
  ('aaaa0001-0000-0000-0000-000000000001'::uuid, 'authz_admin',        'Authz Admin',            'admin',       false),
  ('aaaa0001-0000-0000-0000-000000000002'::uuid, 'authz_admin_susp',   'Authz Admin Suspended',  'admin',       true),
  ('aaaa0001-0000-0000-0000-000000000003'::uuid, 'authz_contrib',      'Authz Contributor',      'contributor', false),
  ('aaaa0001-0000-0000-0000-000000000004'::uuid, 'authz_contrib_susp', 'Authz Contrib Suspended','contributor', true),
  ('aaaa0001-0000-0000-0000-000000000005'::uuid, 'authz_user',         'Authz User',             'user',        false)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, suspended = EXCLUDED.suspended;

-- Helper para simular auth.uid(); ejecutable por authenticated (llamadas
-- consecutivas sin reset). El cambio de rol vía set_config persiste en la
-- transacción; para volver a postgres (limpieza) se usa RESET ROLE en el test.
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
-- is_admin() / can_manage_parkings()
-- ============================================================
SELECT tests.set_auth_user('aaaa0001-0000-0000-0000-000000000001'::uuid);
SELECT ok(public.is_admin(),               'is_admin: admin activo → true');
SELECT ok(public.can_manage_parkings(),    'can_manage_parkings: admin activo → true');

SELECT tests.set_auth_user('aaaa0001-0000-0000-0000-000000000002'::uuid);
SELECT ok(NOT public.is_admin(),            'is_admin: admin suspendido → false');
SELECT ok(NOT public.can_manage_parkings(), 'can_manage_parkings: admin suspendido → false');

SELECT tests.set_auth_user('aaaa0001-0000-0000-0000-000000000003'::uuid);
SELECT ok(NOT public.is_admin(),            'is_admin: contributor activo → false');
SELECT ok(public.can_manage_parkings(),     'can_manage_parkings: contributor activo → true');

SELECT tests.set_auth_user('aaaa0001-0000-0000-0000-000000000004'::uuid);
SELECT ok(NOT public.can_manage_parkings(), 'can_manage_parkings: contributor suspendido → false');

SELECT tests.set_auth_user('aaaa0001-0000-0000-0000-000000000005'::uuid);
SELECT ok(NOT public.is_admin(),            'is_admin: user → false');
SELECT ok(NOT public.can_manage_parkings(), 'can_manage_parkings: user → false');

-- ============================================================
-- is_suspended()
-- ============================================================
SELECT tests.set_auth_user('aaaa0001-0000-0000-0000-000000000005'::uuid);
SELECT ok(NOT public.is_suspended(),        'is_suspended: user activo → false');

SELECT tests.set_auth_user('aaaa0001-0000-0000-0000-000000000004'::uuid);
SELECT ok(public.is_suspended(),            'is_suspended: contributor suspendido → true');

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- Limpieza
DELETE FROM public.users WHERE id::text LIKE 'aaaa0001-%';
DELETE FROM auth.users   WHERE id::text LIKE 'aaaa0001-%';
DROP FUNCTION IF EXISTS tests.set_auth_user(UUID);

SELECT * FROM finish();

ROLLBACK;
