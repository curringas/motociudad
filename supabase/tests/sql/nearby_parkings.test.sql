-- pgTAP tests for nearby_parkings function
-- Run with: supabase test db
-- Framework: pgTAP (https://pgtap.org/)

BEGIN;

SELECT plan(12);

-- ============================================================
-- Setup: datos de prueba específicos para estos tests
-- Usamos IDs distintos de los del seed.sql para evitar conflictos
-- ============================================================

-- Usuario de prueba para los tests
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  'f0000000-test-0000-0000-000000000001'::uuid,
  'test-nearby@motociudad.test',
  'not-a-real-hash', now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, 'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, display_name) VALUES (
  'f0000000-test-0000-0000-000000000001'::uuid,
  'test_nearby_user', 'Test Nearby User'
) ON CONFLICT (id) DO NOTHING;

-- Parkings de prueba
-- P_CLOSE: 50m al norte de la Puerta del Sol (40.4167, -3.7033)
INSERT INTO public.parkings (
  id, proposed_by, name, type, status, location, city
) VALUES (
  'e0000000-test-0001-0000-000000000001'::uuid,
  'f0000000-test-0000-0000-000000000001'::uuid,
  'Test Parking Cercano Verificado',
  'public', 'verified',
  ST_SetSRID(ST_MakePoint(-3.7033, 40.4172), 4326)::geography,
  'Madrid'
) ON CONFLICT (id) DO NOTHING;

-- P_FAR: 3000m al norte (fuera del radio por defecto de 2000m)
INSERT INTO public.parkings (
  id, proposed_by, name, type, status, location, city
) VALUES (
  'e0000000-test-0001-0000-000000000002'::uuid,
  'f0000000-test-0000-0000-000000000001'::uuid,
  'Test Parking Lejano Verificado',
  'public', 'verified',
  ST_SetSRID(ST_MakePoint(-3.7033, 40.4437), 4326)::geography,
  'Madrid'
) ON CONFLICT (id) DO NOTHING;

-- P_PRIVATE: 100m al sur, tipo private
INSERT INTO public.parkings (
  id, proposed_by, name, type, status, location, city
) VALUES (
  'e0000000-test-0001-0000-000000000003'::uuid,
  'f0000000-test-0000-0000-000000000001'::uuid,
  'Test Parking Privado Verificado',
  'private', 'verified',
  ST_SetSRID(ST_MakePoint(-3.7033, 40.4158), 4326)::geography,
  'Madrid'
) ON CONFLICT (id) DO NOTHING;

-- P_PENDING: 200m al este, estado pending
INSERT INTO public.parkings (
  id, proposed_by, name, type, status, location, city
) VALUES (
  'e0000000-test-0001-0000-000000000004'::uuid,
  'f0000000-test-0000-0000-000000000001'::uuid,
  'Test Parking Pendiente',
  'public', 'pending',
  ST_SetSRID(ST_MakePoint(-3.6996, 40.4167), 4326)::geography,
  'Madrid'
) ON CONFLICT (id) DO NOTHING;

-- P_DELETED: 100m al oeste, borrado suave
INSERT INTO public.parkings (
  id, proposed_by, name, type, status, location, city, deleted_at
) VALUES (
  'e0000000-test-0001-0000-000000000005'::uuid,
  'f0000000-test-0000-0000-000000000001'::uuid,
  'Test Parking Borrado',
  'public', 'verified',
  ST_SetSRID(ST_MakePoint(-3.7069, 40.4167), 4326)::geography,
  'Madrid',
  now()
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TEST 1: Función existe y es ejecutable
-- ============================================================
SELECT has_function(
  'public',
  'nearby_parkings',
  ARRAY['double precision', 'double precision', 'integer', 'parking_type', 'boolean', 'integer'],
  'nearby_parkings function exists with correct signature'
);

-- ============================================================
-- TEST 2: Filtro de distancia — solo devuelve parkings dentro del radio
-- ============================================================
SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.nearby_parkings(
      40.4167, -3.7033,  -- centro: Puerta del Sol
      2000,              -- radio: 2000m
      NULL,              -- sin filtro de tipo
      FALSE,             -- incluir no verificados
      100
    )
    WHERE id = 'e0000000-test-0001-0000-000000000002'::uuid  -- el lejano (3000m)
  ),
  0,
  'Parking a 3000m no aparece con radio de 2000m'
);

-- ============================================================
-- TEST 3: El parking cercano SÍ aparece dentro del radio
-- ============================================================
SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.nearby_parkings(40.4167, -3.7033, 2000, NULL, FALSE, 100)
    WHERE id = 'e0000000-test-0001-0000-000000000001'::uuid
  ),
  1,
  'Parking cercano (~55m) aparece con radio de 2000m'
);

-- ============================================================
-- TEST 4: Filtro de tipo — solo devuelve 'public'
-- ============================================================
SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.nearby_parkings(40.4167, -3.7033, 2000, 'public'::parking_type, FALSE, 100)
    WHERE id = 'e0000000-test-0001-0000-000000000003'::uuid  -- el privado
  ),
  0,
  'Filtro type=public excluye parkings privados'
);

-- ============================================================
-- TEST 5: Filtro de tipo — devuelve 'private' cuando se filtra por private
-- ============================================================
SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.nearby_parkings(40.4167, -3.7033, 2000, 'private'::parking_type, FALSE, 100)
    WHERE id = 'e0000000-test-0001-0000-000000000003'::uuid
  ),
  1,
  'Filtro type=private incluye el parking privado cercano'
);

-- ============================================================
-- TEST 6: only_verified=TRUE excluye parkings pending
-- ============================================================
SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.nearby_parkings(40.4167, -3.7033, 2000, NULL, TRUE, 100)
    WHERE id = 'e0000000-test-0001-0000-000000000004'::uuid  -- el pending
  ),
  0,
  'only_verified=TRUE excluye parkings en estado pending'
);

-- ============================================================
-- TEST 7: only_verified=FALSE incluye parkings pending
-- ============================================================
SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.nearby_parkings(40.4167, -3.7033, 2000, NULL, FALSE, 100)
    WHERE id = 'e0000000-test-0001-0000-000000000004'::uuid
  ),
  1,
  'only_verified=FALSE incluye parkings en estado pending'
);

-- ============================================================
-- TEST 8: Parkings con deleted_at nunca aparecen
-- ============================================================
SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.nearby_parkings(40.4167, -3.7033, 2000, NULL, FALSE, 100)
    WHERE id = 'e0000000-test-0001-0000-000000000005'::uuid  -- el borrado
  ),
  0,
  'Parkings con deleted_at no aparecen aunque estén dentro del radio'
);

-- ============================================================
-- TEST 9: Orden por distancia — el más cercano primero
-- ============================================================
SELECT ok(
  (
    SELECT (
      SELECT distance_meters FROM public.nearby_parkings(40.4167, -3.7033, 2000, NULL, FALSE, 100)
      WHERE id = 'e0000000-test-0001-0000-000000000001'::uuid
    ) < (
      SELECT distance_meters FROM public.nearby_parkings(40.4167, -3.7033, 2000, NULL, FALSE, 100)
      WHERE id = 'e0000000-test-0001-0000-000000000004'::uuid
    )
  ),
  'Resultados ordenados por distancia ascendente'
);

-- ============================================================
-- TEST 10: El campo distance_meters se calcula correctamente
-- (P_CLOSE está ~55m al norte del punto de búsqueda)
-- ============================================================
SELECT ok(
  (
    SELECT distance_meters < 200 AND distance_meters > 0
    FROM public.nearby_parkings(40.4167, -3.7033, 2000, NULL, FALSE, 100)
    WHERE id = 'e0000000-test-0001-0000-000000000001'::uuid
  ),
  'distance_meters para parking cercano es un valor razonable (<200m)'
);

-- ============================================================
-- TEST 11: LIMIT respetado
-- ============================================================
SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.nearby_parkings(40.4167, -3.7033, 50000, NULL, FALSE, 1)
  ),
  1,
  'LIMIT 1 devuelve exactamente 1 resultado'
);

-- ============================================================
-- TEST 12: Radio 0 no devuelve resultados
-- ============================================================
SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.nearby_parkings(40.4167, -3.7033, 0, NULL, FALSE, 100)
  ),
  0,
  'Radio 0 no devuelve ningún parking'
);

-- Limpiar datos de prueba
DELETE FROM public.parkings WHERE id LIKE 'e0000000-test-0001%';
DELETE FROM public.users WHERE id = 'f0000000-test-0000-0000-000000000001'::uuid;
DELETE FROM auth.users WHERE id = 'f0000000-test-0000-0000-000000000001'::uuid;

SELECT * FROM finish();

ROLLBACK;
