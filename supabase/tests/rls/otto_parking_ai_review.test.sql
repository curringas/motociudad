-- pgTAP tests for Otto AI-review visibility + verification gating
-- Run with: supabase test db
-- OpenSpec: changes/otto-parking-verification · spec otto-parking-verification / nearby-parkings / verify-parking
-- Cubre: el público solo ve parkings ai_review_status='approved'; el proponente
-- ve los suyos flagged/rejected; y una verificación contra un parking no aprobado
-- es rechazada por el trigger trg_verification_requires_ai_approved.

BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;

SELECT plan(6);

-- ============================================================
-- Setup: usuarios (auth.users → trigger crea public.users)
-- ============================================================
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('f0000000-0770-0000-0000-000000000001'::uuid, 'otto-owner@motociudad.test',
   'x', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('f0000000-0770-0000-0000-000000000002'::uuid, 'otto-other@motociudad.test',
   'x', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Parkings del proponente (owner), uno por veredicto de Otto.
INSERT INTO public.parkings (id, proposed_by, name, type, status, ai_review_status, location, city)
VALUES
  ('a0000000-0770-0000-0000-0000000000a1'::uuid, 'f0000000-0770-0000-0000-000000000001'::uuid,
   'Otto approved', 'public', 'pending', 'approved',
   ST_SetSRID(ST_MakePoint(-3.70, 40.41), 4326)::geography, 'Madrid'),
  ('a0000000-0770-0000-0000-0000000000a2'::uuid, 'f0000000-0770-0000-0000-000000000001'::uuid,
   'Otto flagged', 'public', 'pending', 'flagged',
   ST_SetSRID(ST_MakePoint(-3.70, 40.41), 4326)::geography, 'Madrid'),
  ('a0000000-0770-0000-0000-0000000000a3'::uuid, 'f0000000-0770-0000-0000-000000000001'::uuid,
   'Otto rejected', 'public', 'pending', 'rejected',
   ST_SetSRID(ST_MakePoint(-3.70, 40.41), 4326)::geography, 'Madrid');

-- ============================================================
-- Otro usuario (B): solo debe ver el parking approved
-- ============================================================
SELECT tests.set_auth_user('f0000000-0770-0000-0000-000000000002'::uuid);

SELECT is(
  (SELECT count(*)::int FROM public.parkings WHERE id = 'a0000000-0770-0000-0000-0000000000a1'::uuid),
  1, 'Otro usuario VE un parking approved');

SELECT is(
  (SELECT count(*)::int FROM public.parkings WHERE id = 'a0000000-0770-0000-0000-0000000000a2'::uuid),
  0, 'Otro usuario NO ve un parking flagged');

SELECT is(
  (SELECT count(*)::int FROM public.parkings WHERE id = 'a0000000-0770-0000-0000-0000000000a3'::uuid),
  0, 'Otro usuario NO ve un parking rejected');

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- El proponente (A): ve los suyos aunque estén flagged/rejected
-- ============================================================
SELECT tests.set_auth_user('f0000000-0770-0000-0000-000000000001'::uuid);

SELECT is(
  (SELECT count(*)::int FROM public.parkings WHERE id = 'a0000000-0770-0000-0000-0000000000a2'::uuid),
  1, 'El proponente VE su propio parking flagged');

SELECT is(
  (SELECT count(*)::int FROM public.parkings WHERE id = 'a0000000-0770-0000-0000-0000000000a3'::uuid),
  1, 'El proponente VE su propio parking rejected');

RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);

-- ============================================================
-- Trigger: no se puede verificar un parking no aprobado
-- ============================================================
SELECT throws_ok(
  $$ INSERT INTO public.parking_verifications (parking_id, verified_by)
     VALUES ('a0000000-0770-0000-0000-0000000000a2'::uuid,
             'f0000000-0770-0000-0000-000000000002'::uuid) $$,
  '23514',  -- check_violation
  NULL,
  'Verificar un parking flagged es rechazado por el trigger'
);

SELECT * FROM finish();
ROLLBACK;
