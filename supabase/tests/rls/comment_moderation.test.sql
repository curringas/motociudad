-- pgTAP tests for comment moderation_status visibility (RLS) + approved-only count
-- Run with: supabase test db
-- change: ai-comment-moderation
-- Rule: público solo approved; autor ve sus pending_review; admin ve todo; rejected oculto a no-admin.

BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;

SELECT plan(10);

-- ============================================================
-- Setup: owner (author), other (public reader), admin
-- ============================================================
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('d0000000-a15a-0000-0000-000000000001'::uuid, 'd-author@motociudad.test',
   'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   'authenticated', 'authenticated'),
  ('d0000000-a15a-0000-0000-000000000002'::uuid, 'd-other@motociudad.test',
   'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   'authenticated', 'authenticated'),
  ('d0000000-a15a-0000-0000-000000000003'::uuid, 'd-admin@motociudad.test',
   'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, display_name, role) VALUES
  ('d0000000-a15a-0000-0000-000000000001'::uuid, 'd_author', 'D Author', 'user'),
  ('d0000000-a15a-0000-0000-000000000002'::uuid, 'd_other', 'D Other', 'user'),
  ('d0000000-a15a-0000-0000-000000000003'::uuid, 'd_admin', 'D Admin', 'admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.parkings (id, proposed_by, name, type, status, location, city)
VALUES (
  'd0000000-a15a-0001-0000-000000000001'::uuid,
  'd0000000-a15a-0000-0000-000000000002'::uuid,
  'Moderation Test Parking', 'public', 'verified',
  ST_SetSRID(ST_MakePoint(-3.70, 40.42), 4326)::geography, 'Madrid'
) ON CONFLICT (id) DO NOTHING;

-- approved / pending_review / rejected comments, all authored by d_author
INSERT INTO public.comments (id, parking_id, author_id, body, moderation_status) VALUES
  ('d0000000-a15a-0002-0000-000000000001'::uuid,
   'd0000000-a15a-0001-0000-000000000001'::uuid,
   'd0000000-a15a-0000-0000-000000000001'::uuid, 'Aprobado', 'approved'),
  ('d0000000-a15a-0002-0000-000000000002'::uuid,
   'd0000000-a15a-0001-0000-000000000001'::uuid,
   'd0000000-a15a-0000-0000-000000000001'::uuid, 'Pendiente', 'pending_review'),
  ('d0000000-a15a-0002-0000-000000000003'::uuid,
   'd0000000-a15a-0001-0000-000000000001'::uuid,
   'd0000000-a15a-0000-0000-000000000001'::uuid, 'Rechazado', 'rejected')
ON CONFLICT (id) DO NOTHING;

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
-- Public reader (other authenticated, not author, not admin)
-- ============================================================
SELECT tests.set_auth_user('d0000000-a15a-0000-0000-000000000002'::uuid);

SELECT is(
  (SELECT COUNT(*)::integer FROM public.comments
    WHERE id = 'd0000000-a15a-0002-0000-000000000001'::uuid),
  1, 'público ve el comentario approved');

SELECT is(
  (SELECT COUNT(*)::integer FROM public.comments
    WHERE id = 'd0000000-a15a-0002-0000-000000000002'::uuid),
  0, 'público NO ve el pending_review de otro');

SELECT is(
  (SELECT COUNT(*)::integer FROM public.comments
    WHERE id = 'd0000000-a15a-0002-0000-000000000003'::uuid),
  0, 'público NO ve el rejected de otro');

-- ============================================================
-- Author sees own approved + own pending_review, but NOT own rejected
-- ============================================================
SELECT tests.set_auth_user('d0000000-a15a-0000-0000-000000000001'::uuid);

SELECT is(
  (SELECT COUNT(*)::integer FROM public.comments
    WHERE id = 'd0000000-a15a-0002-0000-000000000002'::uuid),
  1, 'autor ve su propio pending_review');

SELECT is(
  (SELECT COUNT(*)::integer FROM public.comments
    WHERE id = 'd0000000-a15a-0002-0000-000000000003'::uuid),
  0, 'autor NO ve su propio rejected');

-- ============================================================
-- Admin sees pending_review and rejected
-- ============================================================
SELECT tests.set_auth_user('d0000000-a15a-0000-0000-000000000003'::uuid);

SELECT is(
  (SELECT COUNT(*)::integer FROM public.comments
    WHERE id = 'd0000000-a15a-0002-0000-000000000002'::uuid),
  1, 'admin ve el pending_review');

SELECT is(
  (SELECT COUNT(*)::integer FROM public.comments
    WHERE id = 'd0000000-a15a-0002-0000-000000000003'::uuid),
  1, 'admin ve el rejected');

-- ============================================================
-- anon sees only approved
-- ============================================================
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL role TO anon;
SELECT is(
  (SELECT COUNT(*)::integer FROM public.comments
    WHERE parking_id = 'd0000000-a15a-0001-0000-000000000001'::uuid),
  1, 'anon ve solo 1 (el approved) de los 3 comentarios');
RESET role;

-- ============================================================
-- parkings_with_stats.comments_count cuenta solo approved
-- ============================================================
SELECT is(
  (SELECT comments_count::integer FROM public.parkings_with_stats
    WHERE id = 'd0000000-a15a-0001-0000-000000000001'::uuid),
  1, 'comments_count refleja solo el approved');

-- ============================================================
-- Nº de policies de comments sigue siendo 2 (read, read_anon)
-- ============================================================
SELECT is(
  (SELECT COUNT(*)::integer FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comments'),
  2, 'comments mantiene 2 policies (read, read_anon)');

-- Limpieza
DELETE FROM public.comments WHERE id::text LIKE 'd0000000-a15a%';
DELETE FROM public.parkings WHERE id::text LIKE 'd0000000-a15a%';
DELETE FROM public.users WHERE id::text LIKE 'd0000000-a15a%';
DELETE FROM auth.users WHERE id::text LIKE 'd0000000-a15a%';
DROP FUNCTION IF EXISTS tests.set_auth_user(UUID);

SELECT * FROM finish();
ROLLBACK;
