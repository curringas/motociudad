-- pgTAP: un cliente anónimo puede leer parking_verifications (lista de
-- verificadores en la web pública). change: edit-profile
-- Run with: supabase test db

BEGIN;

SELECT plan(2);

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('a1000000-3e21-0000-0000-000000000001'::uuid, 'ver-a@motociudad.test',
   'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, display_name) VALUES
  ('a1000000-3e21-0000-0000-000000000001'::uuid, 'ver_a', 'Ver A')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.parkings (id, proposed_by, name, type, status, location, city)
VALUES (
  'a1000000-3e21-0001-0000-000000000001'::uuid,
  'a1000000-3e21-0000-0000-000000000001'::uuid,
  'Verif Parking', 'public', 'verified',
  ST_SetSRID(ST_MakePoint(-3.70, 40.42), 4326)::geography, 'Madrid'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.parking_verifications (id, parking_id, verified_by)
VALUES (
  'a1000000-3e21-0002-0000-000000000001'::uuid,
  'a1000000-3e21-0001-0000-000000000001'::uuid,
  'a1000000-3e21-0000-0000-000000000001'::uuid
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- T1: existe la policy anon
-- ============================================================
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parking_verifications'
      AND policyname = 'parking_verifications_read_anon'),
  'existe la policy parking_verifications_read_anon'
);

-- ============================================================
-- T2: anon puede leer la verificación
-- ============================================================
SET LOCAL role TO anon;
SELECT is(
  (SELECT COUNT(*)::integer FROM public.parking_verifications
    WHERE id = 'a1000000-3e21-0002-0000-000000000001'::uuid),
  1, 'anon puede leer parking_verifications'
);
RESET role;

-- Limpieza
DELETE FROM public.parking_verifications WHERE id::text LIKE 'a1000000-3e21%';
DELETE FROM public.parkings WHERE id::text LIKE 'a1000000-3e21%';
DELETE FROM public.users WHERE id::text LIKE 'a1000000-3e21%';
DELETE FROM auth.users WHERE id::text LIKE 'a1000000-3e21%';

SELECT * FROM finish();
ROLLBACK;
