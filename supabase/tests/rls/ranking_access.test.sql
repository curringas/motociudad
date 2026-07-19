-- pgTAP tests para el acceso y la privacidad del ranking de Octanos.
-- Run with: supabase test db
-- Framework: pgTAP (https://pgtap.org/)
--
-- Cubre:
--  * GRANT SELECT a `authenticated` sobre mv_ranking_global / mv_ranking_by_city
--  * `anon` NO puede leer el ranking (requiere sesión)
--  * Los usuarios con ranking_visible = FALSE o flagged_for_review = TRUE
--    quedan excluidos de ambas materialized views
--  * mv_ranking_by_city recalcula posiciones por ciudad (PARTITION BY city_primary)
--
-- Nota: se usa REFRESH (no CONCURRENTLY) porque el test corre dentro de una
-- transacción (BEGIN/ROLLBACK) y CONCURRENTLY no está permitido en transacción.

BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;

SELECT plan(9);

-- ============================================================
-- Setup: usuarios de prueba
-- ============================================================
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('f0000000-c17a-0000-0000-000000000001'::uuid, 'rank-a@motociudad.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('f0000000-c17a-0000-0000-000000000002'::uuid, 'rank-b@motociudad.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('f0000000-c17a-0000-0000-000000000003'::uuid, 'rank-c@motociudad.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('f0000000-c17a-0000-0000-000000000004'::uuid, 'rank-d@motociudad.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('f0000000-c17a-0000-0000-000000000005'::uuid, 'rank-e@motociudad.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- A y B: visibles en ZZRankTest; C: oculto (ranking_visible = FALSE); D: flagged;
-- E: visible en ZZRankTest2. Se usan ciudades de prueba únicas (no Madrid/Sevilla)
-- para que las posiciones sean deterministas e independientes del seed.
-- Nota: el trigger handle_new_user ya crea la fila en public.users al insertar en
-- auth.users (con defaults: ranking_visible=TRUE, city_primary=NULL). Por eso se usa
-- DO UPDATE (no DO NOTHING): hay que fijar explícitamente los campos que testeamos.
INSERT INTO public.users (
  id, username, display_name, city_primary, total_octanos, octanos_this_month,
  ranking_visible, flagged_for_review
) VALUES
  ('f0000000-c17a-0000-0000-000000000001'::uuid, 'rank_a', 'Rank A', 'ZZRankTest',  100, 40, TRUE,  FALSE),
  ('f0000000-c17a-0000-0000-000000000002'::uuid, 'rank_b', 'Rank B', 'ZZRankTest',   50, 10, TRUE,  FALSE),
  ('f0000000-c17a-0000-0000-000000000003'::uuid, 'rank_c', 'Rank C', 'ZZRankTest',  999, 99, FALSE, FALSE),
  ('f0000000-c17a-0000-0000-000000000004'::uuid, 'rank_d', 'Rank D', 'ZZRankTest',  888, 88, TRUE,  TRUE),
  ('f0000000-c17a-0000-0000-000000000005'::uuid, 'rank_e', 'Rank E', 'ZZRankTest2',  30,  5, TRUE,  FALSE)
ON CONFLICT (id) DO UPDATE SET
  username           = EXCLUDED.username,
  display_name       = EXCLUDED.display_name,
  city_primary       = EXCLUDED.city_primary,
  total_octanos      = EXCLUDED.total_octanos,
  octanos_this_month = EXCLUDED.octanos_this_month,
  ranking_visible    = EXCLUDED.ranking_visible,
  flagged_for_review = EXCLUDED.flagged_for_review;

-- Reconstruir las materialized views con los datos de prueba.
REFRESH MATERIALIZED VIEW public.mv_ranking_global;
REFRESH MATERIALIZED VIEW public.mv_ranking_by_city;

-- ============================================================
-- Acceso: authenticated SÍ puede leer; anon NO
-- ============================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'f0000000-c17a-0000-0000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  'SELECT count(*) FROM public.mv_ranking_global',
  'GRANT: authenticated puede leer mv_ranking_global'
);
SELECT lives_ok(
  'SELECT count(*) FROM public.mv_ranking_by_city',
  'GRANT: authenticated puede leer mv_ranking_by_city'
);

RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok(
  'SELECT count(*) FROM public.mv_ranking_global',
  '42501', NULL,
  'anon NO puede leer mv_ranking_global (permission denied)'
);
SELECT throws_ok(
  'SELECT count(*) FROM public.mv_ranking_by_city',
  '42501', NULL,
  'anon NO puede leer mv_ranking_by_city (permission denied)'
);
RESET ROLE;

-- ============================================================
-- Privacidad: ocultos y flagged quedan excluidos
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.mv_ranking_global
     WHERE id = 'f0000000-c17a-0000-0000-000000000003'::uuid),
  0,
  'PRIVACIDAD: usuario con ranking_visible = FALSE no aparece en el ranking global'
);
SELECT is(
  (SELECT count(*)::int FROM public.mv_ranking_global
     WHERE id = 'f0000000-c17a-0000-0000-000000000004'::uuid),
  0,
  'PRIVACIDAD: usuario flagged_for_review no aparece en el ranking global'
);
SELECT is(
  (SELECT count(*)::int FROM public.mv_ranking_by_city
     WHERE id = 'f0000000-c17a-0000-0000-000000000003'::uuid),
  0,
  'PRIVACIDAD: usuario oculto tampoco aparece en el ranking por ciudad'
);

-- ============================================================
-- Partición por ciudad: posiciones relativas a cada ciudad
-- ============================================================
SELECT is(
  (SELECT rank_total::int FROM public.mv_ranking_by_city
     WHERE id = 'f0000000-c17a-0000-0000-000000000002'::uuid),
  2,
  'CIUDAD: en ZZRankTest, Rank B (50 octanos) queda 2º por detrás de Rank A (100)'
);
SELECT is(
  (SELECT rank_total::int FROM public.mv_ranking_by_city
     WHERE id = 'f0000000-c17a-0000-0000-000000000005'::uuid),
  1,
  'CIUDAD: en ZZRankTest2, Rank E es 1º de su ciudad (posición independiente de ZZRankTest)'
);

-- ============================================================
-- Limpieza
-- ============================================================
DELETE FROM public.users WHERE id::text LIKE 'f0000000-c17a%';
DELETE FROM auth.users  WHERE id::text LIKE 'f0000000-c17a%';

SELECT * FROM finish();

ROLLBACK;
