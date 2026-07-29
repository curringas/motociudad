-- Migration: 20260729000001_system_user_motociudad
-- change: import-osm-parkings
-- Crea (idempotente) el usuario de sistema @motociudad: autor (proposed_by) de
-- los parkings sembrados desde OpenStreetMap y uploader de sus fotos.
-- ranking_visible=false para que no compita en el ranking. UUID fijo
-- determinista compartido con scripts/osm-import/constants.ts (SYSTEM_USER_ID).
-- modelo-datos.md §5.2

-- auth.users primero (FK de public.users). Contraseña ficticia: cuenta de
-- sistema sin login. Mismo patrón que supabase/seed.sql.
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  'd1000000-0000-0000-0000-000000000001'::uuid,
  'sistema@motociudad.app',
  '$2a$10$SYSTEM.USER.NO.LOGIN.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  now(), now(), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"display_name": "MotoCiudad"}'::jsonb,
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- public.users: el trigger handle_new_user pudo crear la fila con un username
-- autogenerado; forzamos los valores canónicos del usuario de sistema.
INSERT INTO public.users (id, username, display_name, ranking_visible)
VALUES (
  'd1000000-0000-0000-0000-000000000001'::uuid,
  'motociudad', 'MotoCiudad', false
)
ON CONFLICT (id) DO UPDATE SET
  username        = EXCLUDED.username,
  display_name    = EXCLUDED.display_name,
  ranking_visible = EXCLUDED.ranking_visible;

COMMENT ON TABLE public.users IS
  'Perfiles públicos. Incluye el usuario de sistema @motociudad (autor del seeding OSM). change: import-osm-parkings';
