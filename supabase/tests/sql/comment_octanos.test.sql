-- pgTAP tests for comment Octano crediting (RPCs)
-- Run with: supabase test db
-- change: add-parking-comments
-- Covers: escalera +10/+5, elegibilidad, cap, useful_comment idempotente,
--         acumulación (+15), soft-delete sin clawback, errores.

BEGIN;

SELECT plan(32);

-- ============================================================
-- Setup: usuarios y parkings
-- ============================================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
SELECT ('d0000000-a15a-0000-0000-00000000000' || n)::uuid,
       'd-user-' || n || '@motociudad.test', 'x', now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
       'authenticated', 'authenticated'
FROM generate_series(1, 9) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, display_name)
SELECT ('d0000000-a15a-0000-0000-00000000000' || n)::uuid,
       'd_user_' || n, 'D User ' || n
FROM generate_series(1, 9) AS n
ON CONFLICT (id) DO NOTHING;

-- Parkings A, A2, B (verified, propuestos por P=user1); ARCH (archived)
INSERT INTO public.parkings (id, proposed_by, name, type, status, location, city) VALUES
  ('d0000000-a15a-0001-0000-000000000001'::uuid, 'd0000000-a15a-0000-0000-000000000001'::uuid,
   'Parking A', 'public', 'verified', ST_SetSRID(ST_MakePoint(-3.70, 40.42), 4326)::geography, 'Madrid'),
  ('d0000000-a15a-0001-0000-000000000002'::uuid, 'd0000000-a15a-0000-0000-000000000001'::uuid,
   'Parking A2', 'public', 'verified', ST_SetSRID(ST_MakePoint(-3.71, 40.42), 4326)::geography, 'Madrid'),
  ('d0000000-a15a-0001-0000-000000000003'::uuid, 'd0000000-a15a-0000-0000-000000000001'::uuid,
   'Parking B', 'public', 'verified', ST_SetSRID(ST_MakePoint(-3.72, 40.42), 4326)::geography, 'Madrid'),
  ('d0000000-a15a-0001-0000-000000000004'::uuid, 'd0000000-a15a-0000-0000-000000000001'::uuid,
   'Parking ARCH', 'public', 'archived', ST_SetSRID(ST_MakePoint(-3.73, 40.42), 4326)::geography, 'Madrid')
ON CONFLICT (id) DO NOTHING;

-- V (user2) es verificador de A -> inelegible
INSERT INTO public.parking_verifications (parking_id, verified_by)
VALUES ('d0000000-a15a-0001-0000-000000000001'::uuid, 'd0000000-a15a-0000-0000-000000000002'::uuid)
ON CONFLICT DO NOTHING;

-- CAP (user9): 200 Octanos confirmados en las últimas 24h -> cap alcanzado
INSERT INTO public.octano_events (user_id, action_type, points, reference_type, status, confirmed_at)
VALUES ('d0000000-a15a-0000-0000-000000000009'::uuid, 'propose_parking', 200, 'none', 'confirmed', now());

-- ============================================================
-- Ejecutar la escalera en Parking A y guardar resultados
-- ============================================================
CREATE TEMP TABLE res (label text, j jsonb);
INSERT INTO res VALUES ('P',  public.process_comment('d0000000-a15a-0001-0000-000000000001'::uuid, 'd0000000-a15a-0000-0000-000000000001'::uuid, 'comentario del proponente'));
INSERT INTO res VALUES ('V',  public.process_comment('d0000000-a15a-0001-0000-000000000001'::uuid, 'd0000000-a15a-0000-0000-000000000002'::uuid, 'comentario del verificador'));
INSERT INTO res VALUES ('E1', public.process_comment('d0000000-a15a-0001-0000-000000000001'::uuid, 'd0000000-a15a-0000-0000-000000000003'::uuid, 'primer comentario externo'));
INSERT INTO res VALUES ('E2', public.process_comment('d0000000-a15a-0001-0000-000000000001'::uuid, 'd0000000-a15a-0000-0000-000000000004'::uuid, 'segundo comentario externo'));
INSERT INTO res VALUES ('E3', public.process_comment('d0000000-a15a-0001-0000-000000000001'::uuid, 'd0000000-a15a-0000-0000-000000000005'::uuid, 'tercer comentario externo'));

SELECT is((SELECT j->>'eligible' FROM res WHERE label='P'), 'false', 'Proponente NO es elegible');
SELECT is((SELECT j->>'octanos_earned' FROM res WHERE label='P'), '0', 'Proponente no cobra Octanos');
SELECT is((SELECT j->>'octanos_earned' FROM res WHERE label='V'), '0', 'Verificador no cobra Octanos');
SELECT is((SELECT j->>'action_type' FROM res WHERE label='E1'), 'first_comment', '1er externo -> first_comment');
SELECT is((SELECT j->>'octanos_earned' FROM res WHERE label='E1'), '10', '1er externo -> +10');
SELECT is((SELECT j->>'action_type' FROM res WHERE label='E2'), 'second_comment', '2º externo -> second_comment');
SELECT is((SELECT j->>'octanos_earned' FROM res WHERE label='E2'), '5', '2º externo -> +5');
SELECT is((SELECT j->>'octanos_earned' FROM res WHERE label='E3'), '0', '3er externo -> 0 (escalera llena)');

SELECT is(
  (SELECT COUNT(*)::integer FROM public.octano_events
    WHERE user_id='d0000000-a15a-0000-0000-000000000003'::uuid
      AND action_type='first_comment'
      AND reference_id='d0000000-a15a-0001-0000-000000000001'::uuid),
  1, 'Existe octano_event first_comment de E1 en A');

SELECT is(
  (SELECT octanos_awarded FROM public.comments WHERE id=(SELECT (j->>'comment_id')::uuid FROM res WHERE label='E1')),
  TRUE, 'El comentario de E1 queda marcado octanos_awarded');

-- ============================================================
-- Parking B: mismo autor no cobra ambos puestos
-- ============================================================
INSERT INTO res VALUES ('B_E1a', public.process_comment('d0000000-a15a-0001-0000-000000000003'::uuid, 'd0000000-a15a-0000-0000-000000000003'::uuid, 'E1 primero en B'));
INSERT INTO res VALUES ('B_E1b', public.process_comment('d0000000-a15a-0001-0000-000000000003'::uuid, 'd0000000-a15a-0000-0000-000000000003'::uuid, 'E1 otra vez en B'));
INSERT INTO res VALUES ('B_E2',  public.process_comment('d0000000-a15a-0001-0000-000000000003'::uuid, 'd0000000-a15a-0000-0000-000000000004'::uuid, 'E2 en B'));

SELECT is((SELECT j->>'octanos_earned' FROM res WHERE label='B_E1a'), '10', 'B: E1 1er comentario -> +10');
SELECT is((SELECT j->>'octanos_earned' FROM res WHERE label='B_E1b'), '0', 'B: mismo autor no cobra el 2º puesto');
SELECT is((SELECT j->>'octanos_earned' FROM res WHERE label='B_E2'), '5', 'B: 2º puesto va a otro autor (E2) -> +5');

-- ============================================================
-- Cap diario: comentario se publica pero sin Octanos
-- ============================================================
INSERT INTO res VALUES ('CAP', public.process_comment('d0000000-a15a-0001-0000-000000000002'::uuid, 'd0000000-a15a-0000-0000-000000000009'::uuid, 'comentario con cap alcanzado'));

SELECT is((SELECT j->>'eligible' FROM res WHERE label='CAP'), 'true', 'CAP: usuario es elegible');
SELECT is((SELECT j->>'cap_reached' FROM res WHERE label='CAP'), 'true', 'CAP: cap alcanzado detectado');
SELECT is((SELECT j->>'octanos_earned' FROM res WHERE label='CAP'), '0', 'CAP: no se acreditan Octanos');
SELECT is(
  (SELECT COUNT(*)::integer FROM public.comments
    WHERE parking_id='d0000000-a15a-0001-0000-000000000002'::uuid AND deleted_at IS NULL),
  1, 'CAP: el comentario se publica igualmente');

-- ============================================================
-- Votos + useful_comment (sobre el comentario de E1 en A)
-- ============================================================
CREATE TEMP TABLE vres (label text, j jsonb);
INSERT INTO vres VALUES ('x', public.process_comment_vote((SELECT (j->>'comment_id')::uuid FROM res WHERE label='E1'), 'd0000000-a15a-0000-0000-000000000006'::uuid, 1::smallint));
INSERT INTO vres VALUES ('y', public.process_comment_vote((SELECT (j->>'comment_id')::uuid FROM res WHERE label='E1'), 'd0000000-a15a-0000-0000-000000000007'::uuid, 1::smallint));
INSERT INTO vres VALUES ('z', public.process_comment_vote((SELECT (j->>'comment_id')::uuid FROM res WHERE label='E1'), 'd0000000-a15a-0000-0000-000000000008'::uuid, 1::smallint));

SELECT is((SELECT j->>'octanos_earned' FROM vres WHERE label='x'), '0', 'Voto 1: net 1, sin bonus');
SELECT is((SELECT j->>'octanos_earned' FROM vres WHERE label='y'), '5', 'Voto 2: cruza ≥2 neto -> +5 useful_comment');
SELECT is((SELECT j->>'net_score'      FROM vres WHERE label='y'), '2', 'Voto 2: net_score = 2');
SELECT is((SELECT j->>'octanos_earned' FROM vres WHERE label='z'), '0', 'Voto 3: bonus idempotente, no repite');

SELECT is(
  (SELECT COUNT(*)::integer FROM public.octano_events
    WHERE action_type='useful_comment'
      AND reference_id=(SELECT (j->>'comment_id')::uuid FROM res WHERE label='E1')),
  1, 'Solo un useful_comment por comentario (idempotente)');

SELECT is(
  (SELECT upvotes_count FROM public.comments WHERE id=(SELECT (j->>'comment_id')::uuid FROM res WHERE label='E1')),
  3, 'upvotes_count cacheado = 3');

-- Acumulación: first_comment (+10) + useful_comment (+5) = 15 sobre el mismo comentario de E1 en A
SELECT is(
  (SELECT COALESCE(SUM(points),0)::integer FROM public.octano_events
    WHERE user_id='d0000000-a15a-0000-0000-000000000003'::uuid
      AND (
        (action_type='first_comment'  AND reference_id='d0000000-a15a-0001-0000-000000000001'::uuid)
        OR (action_type='useful_comment' AND reference_id=(SELECT (j->>'comment_id')::uuid FROM res WHERE label='E1'))
      )),
  15, 'Acumulación posición + calidad = +15');

-- Auto-voto prohibido
SELECT throws_ok(
  format($$ SELECT public.process_comment_vote(%L::uuid, 'd0000000-a15a-0000-0000-000000000003'::uuid, 1::smallint) $$,
         (SELECT (j->>'comment_id')::uuid FROM res WHERE label='E1')),
  'P0001', NULL, 'No se puede votar el propio comentario');

-- ============================================================
-- Soft-delete + no clawback
-- ============================================================
SELECT throws_ok(
  format($$ SELECT public.soft_delete_comment(%L::uuid, 'd0000000-a15a-0000-0000-000000000004'::uuid) $$,
         (SELECT (j->>'comment_id')::uuid FROM res WHERE label='E1')),
  'P0001', NULL, 'Solo el autor puede borrar su comentario');

SELECT is(
  (SELECT public.soft_delete_comment((SELECT (j->>'comment_id')::uuid FROM res WHERE label='E1'),
     'd0000000-a15a-0000-0000-000000000003'::uuid)->>'deleted'),
  'true', 'El autor puede soft-borrar su comentario');

SELECT is(
  (SELECT COUNT(*)::integer FROM public.octano_events
    WHERE user_id='d0000000-a15a-0000-0000-000000000003'::uuid
      AND action_type='first_comment'
      AND reference_id='d0000000-a15a-0001-0000-000000000001'::uuid),
  1, 'Sin clawback: el evento first_comment persiste tras el soft-delete');

SELECT throws_ok(
  format($$ SELECT public.process_comment_vote(%L::uuid, 'd0000000-a15a-0000-0000-000000000006'::uuid, 1::smallint) $$,
         (SELECT (j->>'comment_id')::uuid FROM res WHERE label='E1')),
  'P0001', NULL, 'No se puede votar un comentario borrado');

-- No clawback tras verificar después: E1 verifica A, su first_comment sigue vivo
INSERT INTO public.parking_verifications (parking_id, verified_by)
VALUES ('d0000000-a15a-0001-0000-000000000001'::uuid, 'd0000000-a15a-0000-0000-000000000003'::uuid)
ON CONFLICT DO NOTHING;

SELECT is(
  (SELECT COUNT(*)::integer FROM public.octano_events
    WHERE user_id='d0000000-a15a-0000-0000-000000000003'::uuid
      AND action_type='first_comment'
      AND reference_id='d0000000-a15a-0001-0000-000000000001'::uuid),
  1, 'Sin clawback: E1 conserva +10 aunque verifique A después');

-- ============================================================
-- Errores de parking
-- ============================================================
SELECT throws_ok(
  $$ SELECT public.process_comment('d0000000-ffff-ffff-ffff-ffffffffffff'::uuid, 'd0000000-a15a-0000-0000-000000000003'::uuid, 'x') $$,
  'P0001', NULL, 'PARKING_NOT_FOUND en parking inexistente');

SELECT throws_ok(
  $$ SELECT public.process_comment('d0000000-a15a-0001-0000-000000000004'::uuid, 'd0000000-a15a-0000-0000-000000000003'::uuid, 'x') $$,
  'P0001', NULL, 'PARKING_ARCHIVED en parking archivado');

-- Limpieza
DELETE FROM public.octano_events WHERE reference_id::text LIKE 'd0000000-a15a%'
   OR user_id::text LIKE 'd0000000-a15a%'
   OR reference_id IN (SELECT id FROM public.comments WHERE parking_id::text LIKE 'd0000000-a15a%');
DELETE FROM public.comment_votes WHERE comment_id IN (SELECT id FROM public.comments WHERE parking_id::text LIKE 'd0000000-a15a%');
DELETE FROM public.comments WHERE parking_id::text LIKE 'd0000000-a15a%';
DELETE FROM public.parking_verifications WHERE parking_id::text LIKE 'd0000000-a15a%';
DELETE FROM public.parkings WHERE id::text LIKE 'd0000000-a15a%';
DELETE FROM public.users WHERE id::text LIKE 'd0000000-a15a%';
DELETE FROM auth.users WHERE id::text LIKE 'd0000000-a15a%';

SELECT * FROM finish();
ROLLBACK;
