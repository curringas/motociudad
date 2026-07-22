-- pgTAP tests for comments + comment_votes RLS policies
-- Run with: supabase test db
-- change: add-parking-comments
-- Rule: lectura pública; escritura (crear/votar/borrar) SOLO vía Edge Function.

BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;

SELECT plan(13);

-- ============================================================
-- Setup
-- ============================================================
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('c0000000-a15a-0000-0000-000000000001'::uuid, 'c-owner@motociudad.test',
   'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   'authenticated', 'authenticated'),
  ('c0000000-a15a-0000-0000-000000000002'::uuid, 'c-other@motociudad.test',
   'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, display_name) VALUES
  ('c0000000-a15a-0000-0000-000000000001'::uuid, 'c_owner', 'C Owner'),
  ('c0000000-a15a-0000-0000-000000000002'::uuid, 'c_other', 'C Other')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.parkings (id, proposed_by, name, type, status, location, city)
VALUES (
  'c0000000-a15a-0001-0000-000000000001'::uuid,
  'c0000000-a15a-0000-0000-000000000001'::uuid,
  'Test Comments Parking', 'public', 'verified',
  ST_SetSRID(ST_MakePoint(-3.70, 40.42), 4326)::geography, 'Madrid'
) ON CONFLICT (id) DO NOTHING;

-- Comentario visible + comentario borrado (seed como postgres, bypass RLS)
INSERT INTO public.comments (id, parking_id, author_id, body) VALUES
  ('c0000000-a15a-0002-0000-000000000001'::uuid,
   'c0000000-a15a-0001-0000-000000000001'::uuid,
   'c0000000-a15a-0000-0000-000000000001'::uuid, 'Comentario visible'),
  ('c0000000-a15a-0002-0000-000000000002'::uuid,
   'c0000000-a15a-0001-0000-000000000001'::uuid,
   'c0000000-a15a-0000-0000-000000000001'::uuid, 'Comentario borrado')
ON CONFLICT (id) DO NOTHING;
UPDATE public.comments SET deleted_at = now()
  WHERE id = 'c0000000-a15a-0002-0000-000000000002'::uuid;

INSERT INTO public.comment_votes (comment_id, user_id, value) VALUES
  ('c0000000-a15a-0002-0000-000000000001'::uuid,
   'c0000000-a15a-0000-0000-000000000002'::uuid, 1)
ON CONFLICT DO NOTHING;

-- Helper para simular auth.uid()
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
-- T1–T2: RLS habilitada
-- ============================================================
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'comments' AND relnamespace = 'public'::regnamespace),
  'RLS habilitada en public.comments'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'comment_votes' AND relnamespace = 'public'::regnamespace),
  'RLS habilitada en public.comment_votes'
);

-- ============================================================
-- T3–T4: lectura authenticated (no-borrados sí, borrados no)
-- ============================================================
SELECT tests.set_auth_user('c0000000-a15a-0000-0000-000000000002'::uuid);

SELECT is(
  (SELECT COUNT(*)::integer FROM public.comments
    WHERE id = 'c0000000-a15a-0002-0000-000000000001'::uuid),
  1, 'comments_read: authenticated ve comentario no borrado');

SELECT is(
  (SELECT COUNT(*)::integer FROM public.comments
    WHERE id = 'c0000000-a15a-0002-0000-000000000002'::uuid),
  0, 'comments_read: authenticated NO ve comentario borrado');

-- ============================================================
-- T6–T9: authenticated no puede escribir comments ni octano_events
-- ============================================================
SELECT throws_ok(
  $$ INSERT INTO public.comments (parking_id, author_id, body)
     VALUES ('c0000000-a15a-0001-0000-000000000001'::uuid,
             'c0000000-a15a-0000-0000-000000000002'::uuid, 'hack') $$,
  '42501', NULL,
  'comments: authenticated NO puede INSERT (escritura solo vía Edge)');

SELECT throws_ok(
  $$ UPDATE public.comments SET body = 'edit'
     WHERE id = 'c0000000-a15a-0002-0000-000000000001'::uuid $$,
  '42501', NULL,
  'comments: authenticated NO puede UPDATE');

SELECT throws_ok(
  $$ DELETE FROM public.comments
     WHERE id = 'c0000000-a15a-0002-0000-000000000001'::uuid $$,
  '42501', NULL,
  'comments: authenticated NO puede DELETE');

SELECT throws_ok(
  $$ INSERT INTO public.octano_events (user_id, action_type, points, reference_id, reference_type, status)
     VALUES ('c0000000-a15a-0000-0000-000000000002'::uuid, 'first_comment', 10,
             'c0000000-a15a-0001-0000-000000000001'::uuid, 'parking', 'confirmed') $$,
  '42501', NULL,
  'octano_events: cliente NO puede insertar evento de comentario (regla #1)');

-- ============================================================
-- T10–T11: comment_votes lectura pública, sin escritura de cliente
-- ============================================================
SELECT is(
  (SELECT COUNT(*)::integer FROM public.comment_votes
    WHERE comment_id = 'c0000000-a15a-0002-0000-000000000001'::uuid),
  1, 'comment_votes_read: authenticated ve el voto');

SELECT throws_ok(
  $$ INSERT INTO public.comment_votes (comment_id, user_id, value)
     VALUES ('c0000000-a15a-0002-0000-000000000001'::uuid,
             'c0000000-a15a-0000-0000-000000000002'::uuid, 1) $$,
  '42501', NULL,
  'comment_votes: authenticated NO puede votar directamente (solo vía Edge)');

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- T5: lectura anon
-- ============================================================
SET LOCAL role TO anon;
SELECT is(
  (SELECT COUNT(*)::integer FROM public.comments
    WHERE id = 'c0000000-a15a-0002-0000-000000000001'::uuid),
  1, 'comments_read_anon: anon ve comentario no borrado');
RESET role;

-- ============================================================
-- T12–T13: número de policies
-- ============================================================
SELECT is(
  (SELECT COUNT(*)::integer FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comments'),
  2, 'comments tiene 2 policies (read, read_anon)');

SELECT is(
  (SELECT COUNT(*)::integer FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comment_votes'),
  2, 'comment_votes tiene 2 policies (read, read_anon)');

-- Limpieza
DELETE FROM public.comment_votes WHERE comment_id::text LIKE 'c0000000-a15a%';
DELETE FROM public.comments WHERE id::text LIKE 'c0000000-a15a%';
DELETE FROM public.parkings WHERE id::text LIKE 'c0000000-a15a%';
DELETE FROM public.users WHERE id::text LIKE 'c0000000-a15a%';
DELETE FROM auth.users WHERE id::text LIKE 'c0000000-a15a%';
DROP FUNCTION IF EXISTS tests.set_auth_user(UUID);

SELECT * FROM finish();
ROLLBACK;
