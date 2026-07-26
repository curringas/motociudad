-- pgTAP tests for deferred-Octanos moderation RPCs
-- Run with: supabase test db
-- change: ai-comment-moderation
-- Covers: process_comment con estado; pending_review no acredita ni consume puesto;
--         moderate_comment aprueba (acredita en su momento) y rechaza (no acredita);
--         re-moderar algo no-pendiente falla.

BEGIN;

SELECT plan(12);

-- ============================================================
-- Setup: proponente (P=user1, inelegible) + externos elegibles E1..E3
-- ============================================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
SELECT ('e0000000-a15a-0000-0000-00000000000' || n)::uuid,
       'e-user-' || n || '@motociudad.test', 'x', now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
       'authenticated', 'authenticated'
FROM generate_series(1, 4) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, display_name)
SELECT ('e0000000-a15a-0000-0000-00000000000' || n)::uuid,
       'e_user_' || n, 'E User ' || n
FROM generate_series(1, 4) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.parkings (id, proposed_by, name, type, status, location, city)
VALUES ('e0000000-a15a-0001-0000-000000000001'::uuid, 'e0000000-a15a-0000-0000-000000000001'::uuid,
   'Parking Mod', 'public', 'verified', ST_SetSRID(ST_MakePoint(-3.70, 40.42), 4326)::geography, 'Madrid')
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE res (label text, j jsonb);

-- E1 (user2) publica APROBADO -> first_comment +10
INSERT INTO res VALUES ('E1',
  public.process_comment('e0000000-a15a-0001-0000-000000000001'::uuid,
    'e0000000-a15a-0000-0000-000000000002'::uuid, 'primer externo', 'approved'));

-- E2 (user3) publica PENDIENTE -> 0, no consume puesto todavía
INSERT INTO res VALUES ('E2',
  public.process_comment('e0000000-a15a-0001-0000-000000000001'::uuid,
    'e0000000-a15a-0000-0000-000000000003'::uuid, 'segundo externo', 'pending_review'));

-- E3 (user4) publica PENDIENTE -> 0
INSERT INTO res VALUES ('E3',
  public.process_comment('e0000000-a15a-0001-0000-000000000001'::uuid,
    'e0000000-a15a-0000-0000-000000000004'::uuid, 'tercer externo', 'pending_review'));

-- ── Asserts de inserción/estado ──
SELECT is((SELECT j->>'action_type' FROM res WHERE label='E1'), 'first_comment', 'E1 approved -> first_comment');
SELECT is((SELECT j->>'octanos_earned' FROM res WHERE label='E1'), '10', 'E1 approved -> +10');
SELECT is((SELECT j->>'moderation_status' FROM res WHERE label='E1'), 'approved', 'E1 queda approved');

SELECT is((SELECT j->>'octanos_earned' FROM res WHERE label='E2'), '0', 'E2 pending_review -> 0 Octanos');
SELECT is((SELECT j->>'moderation_status' FROM res WHERE label='E2'), 'pending_review', 'E2 queda pending_review');

-- El pendiente NO consumió puesto: solo hay 1 evento de posición (el de E1)
SELECT is(
  (SELECT COUNT(*)::integer FROM public.octano_events
    WHERE reference_id = 'e0000000-a15a-0001-0000-000000000001'::uuid
      AND action_type IN ('first_comment','second_comment')),
  1, 'pending_review no consume puesto en la escalera');

-- ── Admin aprueba E2 -> acredita AHORA el segundo puesto (+5) ──
SELECT is(
  (public.moderate_comment((SELECT id FROM public.comments WHERE body='segundo externo'), 'approved')->>'octanos_earned'),
  '5', 'aprobar E2 acredita +5 (second_comment) en su momento');

SELECT is(
  (SELECT COUNT(*)::integer FROM public.octano_events
    WHERE reference_id = 'e0000000-a15a-0001-0000-000000000001'::uuid
      AND action_type IN ('first_comment','second_comment')),
  2, 'tras aprobar E2 hay 2 puestos de escalera');

-- ── Admin rechaza E3 -> rejected, sin Octanos ──
SELECT is(
  (public.moderate_comment((SELECT id FROM public.comments WHERE body='tercer externo'), 'rejected')->>'octanos_earned'),
  '0', 'rechazar E3 no acredita Octanos');

SELECT is(
  (SELECT moderation_status::text FROM public.comments WHERE body='tercer externo'),
  'rejected', 'E3 queda rejected');

-- ── Re-moderar algo ya aprobado falla ──
SELECT throws_ok(
  format($$ SELECT public.moderate_comment(%L::uuid, 'approved') $$,
    (SELECT id FROM public.comments WHERE body='primer externo')),
  'P0001', NULL,
  'moderate_comment sobre un comentario no pendiente falla (NOT_PENDING)');

-- ── Estado inválido rechazado ──
SELECT throws_ok(
  format($$ SELECT public.moderate_comment(%L::uuid, 'pending_review') $$,
    (SELECT id FROM public.comments WHERE body='primer externo')),
  'P0001', NULL,
  'moderate_comment con estado no {approved,rejected} falla');

-- Limpieza
DELETE FROM public.octano_events WHERE reference_id::text LIKE 'e0000000-a15a%';
DELETE FROM public.comments WHERE parking_id::text LIKE 'e0000000-a15a%';
DELETE FROM public.parkings WHERE id::text LIKE 'e0000000-a15a%';
DELETE FROM public.users WHERE id::text LIKE 'e0000000-a15a%';
DELETE FROM auth.users WHERE id::text LIKE 'e0000000-a15a%';

SELECT * FROM finish();
ROLLBACK;
