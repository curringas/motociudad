-- pgTAP tests for parkings RLS policies
-- Run with: supabase test db
-- Framework: pgTAP (https://pgtap.org/)
-- Nota: la lectura de parkings es pública desde 20260705000001_rls_public_parkings
-- (policies parkings_read / parkings_read_anon). admin-panel añadió
-- parkings_update_admin y parkings_update_contributor_own → 6 policies en total.

BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;

SELECT plan(14);

-- ============================================================
-- Setup: usuarios y datos de prueba
-- ============================================================

-- Usuario A: el proponente
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  'f0000000-a15a-0000-0000-000000000001'::uuid,
  'rls-owner@motociudad.test', 'not-a-real-hash',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Usuario B: otro usuario autenticado
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  'f0000000-a15a-0000-0000-000000000002'::uuid,
  'rls-other@motociudad.test', 'not-a-real-hash',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, display_name) VALUES
  ('f0000000-a15a-0000-0000-000000000001'::uuid, 'rls_owner', 'RLS Owner'),
  ('f0000000-a15a-0000-0000-000000000002'::uuid, 'rls_other', 'RLS Other')
ON CONFLICT (id) DO NOTHING;

-- Parking VERIFICADO del usuario A
INSERT INTO public.parkings (
  id, proposed_by, name, type, status, location, city
) VALUES (
  'e0000000-a15a-0001-0000-000000000001'::uuid,
  'f0000000-a15a-0000-0000-000000000001'::uuid,
  'Test RLS Parking Verificado',
  'public', 'verified',
  ST_SetSRID(ST_MakePoint(-3.70, 40.42), 4326)::geography,
  'Madrid'
) ON CONFLICT (id) DO NOTHING;

-- Parking PENDIENTE del usuario A
INSERT INTO public.parkings (
  id, proposed_by, name, type, status, location, city
) VALUES (
  'e0000000-a15a-0001-0000-000000000002'::uuid,
  'f0000000-a15a-0000-0000-000000000001'::uuid,
  'Test RLS Parking Pendiente',
  'public', 'pending',
  ST_SetSRID(ST_MakePoint(-3.71, 40.42), 4326)::geography,
  'Madrid'
) ON CONFLICT (id) DO NOTHING;

-- Parking RECHAZADO del usuario A (ni verificado ni propio visible a otros)
INSERT INTO public.parkings (
  id, proposed_by, name, type, status, location, city
) VALUES (
  'e0000000-a15a-0001-0000-000000000003'::uuid,
  'f0000000-a15a-0000-0000-000000000001'::uuid,
  'Test RLS Parking Rechazado',
  'public', 'rejected',
  ST_SetSRID(ST_MakePoint(-3.72, 40.42), 4326)::geography,
  'Madrid'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Helper: set_auth_user simula auth.uid() (ejecutable por authenticated).
-- Para volver a postgres (limpieza/metadatos) se usa RESET ROLE en el test.
-- ============================================================
GRANT USAGE ON SCHEMA tests TO authenticated, anon;

CREATE OR REPLACE FUNCTION tests.set_auth_user(user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_id::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('role', 'authenticated', true);
END;
$$;
GRANT EXECUTE ON FUNCTION tests.set_auth_user(UUID) TO authenticated, anon;

-- ============================================================
-- TEST 1 (parkings_read_verified): Usuario B puede leer el parking VERIFICADO de A
-- ============================================================
SELECT tests.set_auth_user('f0000000-a15a-0000-0000-000000000002'::uuid);

SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.parkings
    WHERE id = 'e0000000-a15a-0001-0000-000000000001'::uuid
  ),
  1,
  'POLICY parkings_read_verified: usuario B puede leer parking verificado de A'
);

-- ============================================================
-- TEST 2 (parkings_read): lectura pública — B SÍ ve el parking PENDIENTE de A
-- ============================================================
SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.parkings
    WHERE id = 'e0000000-a15a-0001-0000-000000000002'::uuid
  ),
  1,
  'POLICY parkings_read: lectura pública, B ve parking pendiente de A (comunidad lo verifica)'
);

-- ============================================================
-- TEST 3 (parkings_read): lectura pública — B SÍ ve el parking RECHAZADO de A (no borrado)
-- ============================================================
SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.parkings
    WHERE id = 'e0000000-a15a-0001-0000-000000000003'::uuid
  ),
  1,
  'POLICY parkings_read: lectura pública, B ve parking rechazado (no eliminado) de A'
);

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- TEST 4 (parkings_read_own): Usuario A puede leer SUS parkings en cualquier estado
-- ============================================================
SELECT tests.set_auth_user('f0000000-a15a-0000-0000-000000000001'::uuid);

SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.parkings
    WHERE proposed_by = 'f0000000-a15a-0000-0000-000000000001'::uuid
      AND status IN ('pending', 'rejected', 'verified')
  ),
  3,
  'POLICY parkings_read_own: usuario A puede leer todos sus parkings (verified + pending + rejected)'
);

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- TEST 5 (parkings_insert): Usuario A puede insertar un parking con status='pending'
-- ============================================================
SELECT tests.set_auth_user('f0000000-a15a-0000-0000-000000000001'::uuid);

SELECT lives_ok(
  $$
    INSERT INTO public.parkings (
      id, proposed_by, name, type, status, location, city
    ) VALUES (
      'e0000000-a15a-0001-0000-000000000010'::uuid,
      'f0000000-a15a-0000-0000-000000000001'::uuid,
      'Test RLS Insert OK',
      'public', 'pending',
      ST_SetSRID(ST_MakePoint(-3.73, 40.42), 4326)::geography,
      'Madrid'
    )
  $$,
  'POLICY parkings_insert: usuario A puede insertar parking pendiente propio'
);

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- TEST 6 (parkings_insert RECHAZO): usuario A NO puede insertar con proposed_by de B
-- ============================================================
SELECT tests.set_auth_user('f0000000-a15a-0000-0000-000000000001'::uuid);

SELECT throws_ok(
  $$
    INSERT INTO public.parkings (
      id, proposed_by, name, type, status, location, city
    ) VALUES (
      'e0000000-a15a-0001-0000-000000000011'::uuid,
      'f0000000-a15a-0000-0000-000000000002'::uuid,  -- proposed_by de B
      'Test RLS Insert Rechazo proposed_by',
      'public', 'pending',
      ST_SetSRID(ST_MakePoint(-3.74, 40.42), 4326)::geography,
      'Madrid'
    )
  $$,
  '42501',
  NULL,
  'POLICY parkings_insert RECHAZO: A no puede insertar con proposed_by de B'
);

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- TEST 7 (parkings_insert RECHAZO): usuario A NO puede insertar con status='verified'
-- ============================================================
SELECT tests.set_auth_user('f0000000-a15a-0000-0000-000000000001'::uuid);

SELECT throws_ok(
  $$
    INSERT INTO public.parkings (
      id, proposed_by, name, type, status, location, city
    ) VALUES (
      'e0000000-a15a-0001-0000-000000000012'::uuid,
      'f0000000-a15a-0000-0000-000000000001'::uuid,
      'Test RLS Insert Status Verified Rechazo',
      'public', 'verified',  -- status no permitido
      ST_SetSRID(ST_MakePoint(-3.75, 40.42), 4326)::geography,
      'Madrid'
    )
  $$,
  '42501',
  NULL,
  'POLICY parkings_insert RECHAZO: no se puede insertar con status verificado'
);

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- TEST 8 (parkings_update_own_pending): A puede actualizar su propio parking pendiente
-- ============================================================
SELECT tests.set_auth_user('f0000000-a15a-0000-0000-000000000001'::uuid);

SELECT lives_ok(
  $$
    UPDATE public.parkings
    SET notes = 'Actualizado en test RLS'
    WHERE id = 'e0000000-a15a-0001-0000-000000000002'::uuid  -- pendiente de A
  $$,
  'POLICY parkings_update_own_pending: A puede actualizar su parking pendiente'
);

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- TEST 9 (parkings_update_own_pending RECHAZO): A NO puede actualizar un parking verificado
-- ============================================================
SELECT tests.set_auth_user('f0000000-a15a-0000-0000-000000000001'::uuid);

-- UPDATE que no afecta filas porque la policy USING falla silenciosamente
WITH updated AS (
  UPDATE public.parkings
  SET notes = 'Intento actualizar verificado'
  WHERE id = 'e0000000-a15a-0001-0000-000000000001'::uuid  -- verificado
  RETURNING id
)
SELECT is(
  (SELECT COUNT(*)::integer FROM updated),
  0,
  'POLICY parkings_update_own_pending RECHAZO: A no puede actualizar parking verificado propio'
);

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- TEST 10 (parkings_update_own_pending RECHAZO): B NO puede actualizar parkings de A
-- ============================================================
SELECT tests.set_auth_user('f0000000-a15a-0000-0000-000000000002'::uuid);

WITH updated AS (
  UPDATE public.parkings
  SET notes = 'Intento actualizar pendiente de A como B'
  WHERE id = 'e0000000-a15a-0001-0000-000000000002'::uuid  -- pendiente de A
  RETURNING id
)
SELECT is(
  (SELECT COUNT(*)::integer FROM updated),
  0,
  'POLICY parkings_update_own_pending RECHAZO: B no puede actualizar parkings de A'
);

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- TEST 11: RLS habilitada en la tabla parkings
-- ============================================================
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'parkings' AND relnamespace = 'public'::regnamespace),
  'RLS está habilitada en la tabla public.parkings'
);

-- ============================================================
-- TEST 12: Existen exactamente 7 policies en parkings (tras admin-panel)
-- ============================================================
SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parkings'
  ),
  7,
  'La tabla parkings tiene exactamente 7 políticas RLS'
);

-- ============================================================
-- TEST 13: Los nombres de las policies son los esperados
-- ============================================================
SELECT ok(
  (
    SELECT COUNT(*) = 7
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'parkings'
      AND policyname IN (
        'parkings_read',
        'parkings_read_anon',
        'parkings_read_admin',
        'parkings_insert',
        'parkings_update_own_pending',
        'parkings_update_admin',
        'parkings_update_contributor_own'
      )
  ),
  'Las 7 políticas RLS tienen los nombres correctos'
);

-- ============================================================
-- TEST 14: Anon puede leer el parking verificado (lectura pública anon)
-- ============================================================
SET LOCAL role TO anon;

SELECT is(
  (
    SELECT COUNT(*)::integer FROM public.parkings
    WHERE id = 'e0000000-a15a-0001-0000-000000000001'::uuid
  ),
  1,
  'POLICY parkings_read_anon: anon puede leer parkings no eliminados'
);

RESET role;

-- Limpieza
DELETE FROM public.parkings WHERE id::text LIKE 'e0000000-a15a%';
DELETE FROM public.users WHERE id::text LIKE 'f0000000-a15a%';
DELETE FROM auth.users WHERE id::text LIKE 'f0000000-a15a%';

DROP FUNCTION IF EXISTS tests.set_auth_user(UUID);

SELECT * FROM finish();

ROLLBACK;
