-- pgTAP: unicidad case-insensitive del nick + CHECK de formato.
-- Run with: supabase test db
-- change: edit-profile

BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;

SELECT plan(5);

-- ============================================================
-- Setup: dos usuarios base
-- ============================================================
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('d0000000-1234-0000-0000-000000000001'::uuid, 'nick-a@motociudad.test',
   'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   'authenticated', 'authenticated'),
  ('d0000000-1234-0000-0000-000000000002'::uuid, 'nick-b@motociudad.test',
   'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, display_name) VALUES
  ('d0000000-1234-0000-0000-000000000001'::uuid, 'Curro', 'Curro'),
  ('d0000000-1234-0000-0000-000000000002'::uuid, 'otro_nick', 'Otro')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- T1: el índice único LOWER(username) existe
-- ============================================================
SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'users_username_lower_key'),
  'existe el índice único users_username_lower_key'
);

-- ============================================================
-- T2: otro usuario no puede tomar el mismo nick con otra capitalización
-- ============================================================
SELECT throws_ok(
  $$ UPDATE public.users SET username = 'curro'
     WHERE id = 'd0000000-1234-0000-0000-000000000002'::uuid $$,
  '23505', NULL,
  'nick duplicado case-insensitive ("curro" vs "Curro") es rechazado'
);

-- ============================================================
-- T3: el propio usuario puede reguardar su nick (misma fila)
-- ============================================================
SELECT lives_ok(
  $$ UPDATE public.users SET username = 'Curro'
     WHERE id = 'd0000000-1234-0000-0000-000000000001'::uuid $$,
  'el usuario puede reguardar su propio nick sin colisión'
);

-- ============================================================
-- T4: nick fuera de formato (demasiado corto) es rechazado
-- ============================================================
SELECT throws_ok(
  $$ UPDATE public.users SET username = 'ab'
     WHERE id = 'd0000000-1234-0000-0000-000000000002'::uuid $$,
  '23514', NULL,
  'nick de menos de 3 caracteres viola el CHECK de formato'
);

-- ============================================================
-- T5: nick con caracteres no permitidos es rechazado
-- ============================================================
SELECT throws_ok(
  $$ UPDATE public.users SET username = 'con espacio'
     WHERE id = 'd0000000-1234-0000-0000-000000000002'::uuid $$,
  '23514', NULL,
  'nick con espacio/caracteres no permitidos viola el CHECK de formato'
);

-- Limpieza
DELETE FROM public.users WHERE id::text LIKE 'd0000000-1234%';
DELETE FROM auth.users WHERE id::text LIKE 'd0000000-1234%';

SELECT * FROM finish();
ROLLBACK;
