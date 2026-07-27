-- pgTAP: bucket `avatars` y policies de Storage.
-- Run with: supabase test db
-- change: edit-profile

BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;

SELECT plan(6);

-- ============================================================
-- Setup: dos usuarios
-- ============================================================
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('e0000000-a7a7-0000-0000-000000000001'::uuid, 'av-a@motociudad.test',
   'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   'authenticated', 'authenticated'),
  ('e0000000-a7a7-0000-0000-000000000002'::uuid, 'av-b@motociudad.test',
   'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   'authenticated', 'authenticated')
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
-- T1: el bucket avatars existe, es público y limita MIME + tamaño
-- ============================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'avatars' AND public = true
      AND file_size_limit = 2097152
      AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']
  ),
  'bucket avatars público, 2 MB, MIME de imagen'
);

-- ============================================================
-- T2: existen las 4 policies del bucket
-- ============================================================
SELECT is(
  (SELECT COUNT(*)::integer FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN ('avatars_public_read','avatars_insert_own','avatars_update_own','avatars_delete_own')),
  4, 'existen las 4 policies de avatars en storage.objects'
);

-- ============================================================
-- T3–T4: escritura en carpeta propia vs ajena
-- ============================================================
SELECT tests.set_auth_user('e0000000-a7a7-0000-0000-000000000001'::uuid);

SELECT lives_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner)
     VALUES ('avatars', 'e0000000-a7a7-0000-0000-000000000001/avatar.jpg',
             'e0000000-a7a7-0000-0000-000000000001'::uuid) $$,
  'usuario puede subir avatar en su propia carpeta'
);

SELECT throws_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner)
     VALUES ('avatars', 'e0000000-a7a7-0000-0000-000000000002/avatar.jpg',
             'e0000000-a7a7-0000-0000-000000000001'::uuid) $$,
  '42501', NULL,
  'usuario NO puede subir avatar en la carpeta de otro'
);

-- ============================================================
-- T5: lectura pública (anon)
-- ============================================================
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL role TO anon;
SELECT is(
  (SELECT COUNT(*)::integer FROM storage.objects
    WHERE bucket_id = 'avatars'
      AND name = 'e0000000-a7a7-0000-0000-000000000001/avatar.jpg'),
  1, 'anon puede leer el avatar público'
);
RESET role;

-- ============================================================
-- T6: RLS habilitada en storage.objects
-- ============================================================
SELECT ok(
  (SELECT relrowsecurity FROM pg_class
    WHERE relname = 'objects' AND relnamespace = 'storage'::regnamespace),
  'RLS habilitada en storage.objects'
);

-- Limpieza
DELETE FROM storage.objects WHERE name LIKE 'e0000000-a7a7-%';
DELETE FROM auth.users WHERE id::text LIKE 'e0000000-a7a7%';
DROP FUNCTION IF EXISTS tests.set_auth_user(UUID);

SELECT * FROM finish();
ROLLBACK;
