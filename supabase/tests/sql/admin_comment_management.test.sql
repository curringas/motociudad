-- pgTAP tests for admin comment management RPCs
-- Run with: supabase test db
-- change: admin-comments-management
-- Covers: admin_delete_comments (hard delete + retirada de Octanos, libera puesto,
--         recalcula caché) y admin_list_comments (guard admin, filtros, paginación).

BEGIN;

SELECT plan(13);

-- ============================================================
-- Setup: proponente P(user1), externo E1(user2), admin A(user3)
-- ============================================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
SELECT ('f0000000-a15a-0000-0000-00000000000' || n)::uuid,
       'f-user-' || n || '@motociudad.test', 'x', now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
       'authenticated', 'authenticated'
FROM generate_series(1, 3) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, display_name, role) VALUES
  ('f0000000-a15a-0000-0000-000000000001'::uuid, 'f_prop', 'F Prop', 'user'),
  ('f0000000-a15a-0000-0000-000000000002'::uuid, 'f_ext',  'F Ext',  'user'),
  ('f0000000-a15a-0000-0000-000000000003'::uuid, 'f_admin','F Admin','admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.parkings (id, proposed_by, name, type, status, location, city) VALUES
  ('f0000000-a15a-0001-0000-000000000001'::uuid, 'f0000000-a15a-0000-0000-000000000001'::uuid,
   'Parking Centro Sol', 'public', 'verified', ST_SetSRID(ST_MakePoint(-3.70, 40.42), 4326)::geography, 'Madrid'),
  ('f0000000-a15a-0001-0000-000000000002'::uuid, 'f0000000-a15a-0000-0000-000000000001'::uuid,
   'Parking Ruzafa', 'public', 'verified', ST_SetSRID(ST_MakePoint(-0.37, 39.46), 4326)::geography, 'Valencia')
ON CONFLICT (id) DO NOTHING;

-- E1 publica un comentario APROBADO en el parking de Madrid -> first_comment +10
SELECT public.process_comment(
  'f0000000-a15a-0001-0000-000000000001'::uuid,
  'f0000000-a15a-0000-0000-000000000002'::uuid,
  'Sitio amplio y bien iluminado para la moto', 'approved');

-- Un pendiente (E1) en Valencia
SELECT public.process_comment(
  'f0000000-a15a-0001-0000-000000000002'::uuid,
  'f0000000-a15a-0000-0000-000000000002'::uuid,
  'No estoy seguro de este sitio', 'pending_review');

-- ============================================================
-- Estado inicial: E1 tiene 10 Octanos (cache) y hay 1 evento de posición
-- ============================================================
SELECT is((SELECT total_octanos FROM public.users WHERE id='f0000000-a15a-0000-0000-000000000002'::uuid),
  10, 'E1 tiene 10 Octanos tras el comentario aprobado');
SELECT is((SELECT count(*)::int FROM public.octano_events
    WHERE reference_id='f0000000-a15a-0001-0000-000000000001'::uuid
      AND action_type IN ('first_comment','second_comment')),
  1, 'hay 1 puesto de escalera ocupado en el parking');

-- ============================================================
-- admin_delete_comments: borra el aprobado + retira Octanos
-- ============================================================
SELECT lives_ok($$ SELECT public.admin_delete_comments(
  ARRAY[(SELECT id FROM public.comments WHERE body='Sitio amplio y bien iluminado para la moto')]) $$,
  'admin_delete_comments se ejecuta');

SELECT is((SELECT count(*)::int FROM public.comments WHERE body='Sitio amplio y bien iluminado para la moto'),
  0, 'el comentario aprobado se borró (hard delete)');
SELECT is((SELECT total_octanos FROM public.users WHERE id='f0000000-a15a-0000-0000-000000000002'::uuid),
  0, 'los Octanos de E1 se retiraron (cache = 0)');
SELECT is((SELECT count(*)::int FROM public.octano_events
    WHERE reference_id='f0000000-a15a-0001-0000-000000000001'::uuid
      AND action_type IN ('first_comment','second_comment')),
  0, 'el puesto de escalera quedó libre');

-- ============================================================
-- admin_list_comments: guard de admin + filtros
-- ============================================================
-- No admin -> FORBIDDEN
SELECT set_config('request.jwt.claims',
  json_build_object('sub','f0000000-a15a-0000-0000-000000000002','role','authenticated')::text, true);
SELECT throws_ok($$ SELECT public.admin_list_comments('all', NULL, NULL, 25, 0) $$,
  'P0001', NULL, 'admin_list_comments deniega a no-admin');

-- Admin
SELECT set_config('request.jwt.claims',
  json_build_object('sub','f0000000-a15a-0000-0000-000000000003','role','authenticated')::text, true);

SELECT is(
  (public.admin_list_comments('pending_review', NULL, NULL, 25, 0)->>'total')::int,
  1, 'admin ve 1 pendiente (el de Valencia)');
SELECT is(
  (public.admin_list_comments('all', 'Valencia', NULL, 25, 0)->>'total')::int,
  1, 'filtro por ciudad Valencia devuelve 1');
SELECT is(
  (public.admin_list_comments('all', 'Madrid', NULL, 25, 0)->>'total')::int,
  0, 'en Madrid no queda ninguno tras el borrado');
SELECT is(
  (public.admin_list_comments('all', NULL, 'seguro', 25, 0)->>'total')::int,
  1, 'búsqueda por texto encuentra el pendiente');
SELECT is(
  jsonb_array_length((public.admin_list_comments('all', NULL, NULL, 1, 0))->'rows'),
  1, 'la paginación respeta el límite');

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- Limpieza
DELETE FROM public.octano_events WHERE user_id::text LIKE 'f0000000-a15a%';
DELETE FROM public.comments WHERE parking_id::text LIKE 'f0000000-a15a%';
DELETE FROM public.parkings WHERE id::text LIKE 'f0000000-a15a%';
DELETE FROM public.users WHERE id::text LIKE 'f0000000-a15a%';
DELETE FROM auth.users WHERE id::text LIKE 'f0000000-a15a%';

SELECT * FROM finish();
ROLLBACK;
