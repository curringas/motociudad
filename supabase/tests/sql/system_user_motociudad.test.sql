-- pgTAP: usuario de sistema @motociudad (autor del seeding OSM).
-- Run with: supabase test db
-- change: import-osm-parkings

BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;

SELECT plan(4);

-- ============================================================
-- T1: el usuario de sistema existe en public.users
-- ============================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = 'd1000000-0000-0000-0000-000000000001'::uuid
  ),
  'existe el usuario de sistema @motociudad en public.users'
);

-- ============================================================
-- T2: valores canónicos (username/display_name)
-- ============================================================
SELECT is(
  (SELECT username || '|' || display_name FROM public.users
     WHERE id = 'd1000000-0000-0000-0000-000000000001'::uuid),
  'motociudad|MotoCiudad',
  'username="motociudad" y display_name="MotoCiudad"'
);

-- ============================================================
-- T3: no aparece en el ranking (ranking_visible = false)
-- ============================================================
SELECT is(
  (SELECT ranking_visible FROM public.users
     WHERE id = 'd1000000-0000-0000-0000-000000000001'::uuid),
  false,
  'ranking_visible = false (no compite en el ranking)'
);

-- ============================================================
-- T4: la inserción es idempotente (re-aplicar la migración no rompe)
-- ============================================================
SELECT lives_ok(
  $$ INSERT INTO public.users (id, username, display_name, ranking_visible)
     VALUES ('d1000000-0000-0000-0000-000000000001'::uuid, 'motociudad', 'MotoCiudad', false)
     ON CONFLICT (id) DO UPDATE SET
       username = EXCLUDED.username,
       display_name = EXCLUDED.display_name,
       ranking_visible = EXCLUDED.ranking_visible $$,
  're-insertar el usuario de sistema es idempotente (ON CONFLICT DO UPDATE)'
);

SELECT * FROM finish();
ROLLBACK;
