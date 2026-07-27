-- pgTAP: el cliente no puede auto-editar los campos caché de Octanos/nivel;
-- el servidor (contexto service_role, auth.uid() NULL) sí puede.
-- Run with: supabase test db
-- change: edit-profile

BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;

SELECT plan(4);

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('f0000000-0c7a-0000-0000-000000000001'::uuid, 'oct-a@motociudad.test',
   'x', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, display_name, total_octanos, current_level) VALUES
  ('f0000000-0c7a-0000-0000-000000000001'::uuid, 'oct_a', 'Oct A', 0, 1)
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
-- Como cliente autenticado (auth.uid() = su id)
-- ============================================================
SELECT tests.set_auth_user('f0000000-0c7a-0000-0000-000000000001'::uuid);

SELECT throws_ok(
  $$ UPDATE public.users SET total_octanos = 99999
     WHERE id = 'f0000000-0c7a-0000-0000-000000000001'::uuid $$,
  '42501', NULL,
  'cliente NO puede subir su total_octanos'
);

SELECT throws_ok(
  $$ UPDATE public.users SET current_level = 10
     WHERE id = 'f0000000-0c7a-0000-0000-000000000001'::uuid $$,
  '42501', NULL,
  'cliente NO puede cambiar su current_level'
);

-- Editar el perfil (nick/ciudad/avatar) sí está permitido para el propio usuario.
SELECT lives_ok(
  $$ UPDATE public.users SET username = 'oct_a2', city_primary = 'Madrid, España'
     WHERE id = 'f0000000-0c7a-0000-0000-000000000001'::uuid $$,
  'cliente SÍ puede editar nick y ciudad de su propia fila'
);

-- ============================================================
-- Como servidor (sin auth.uid(): contexto service_role)
-- ============================================================
RESET ROLE; SELECT set_config('request.jwt.claims', '{}', true);
SELECT lives_ok(
  $$ UPDATE public.users SET total_octanos = 150, current_level = 2
     WHERE id = 'f0000000-0c7a-0000-0000-000000000001'::uuid $$,
  'el servidor (auth.uid() NULL) SÍ puede actualizar el caché de Octanos'
);

-- Limpieza
DELETE FROM public.users WHERE id::text LIKE 'f0000000-0c7a%';
DELETE FROM auth.users WHERE id::text LIKE 'f0000000-0c7a%';
DROP FUNCTION IF EXISTS tests.set_auth_user(UUID);

SELECT * FROM finish();
ROLLBACK;
