-- seed.sql — Datos de desarrollo para MotoCiudad
-- NO ejecutar en producción.
-- Incluye: user_levels (catálogo), usuarios de prueba y 5 parkings reales en Madrid.
-- Coordenadas WGS84 verificadas en OpenStreetMap.

-- ============================================================
-- NOTA: user_levels ya se inserta en la migración 20260101000003
-- Este seed añade usuarios de prueba y parkings de ejemplo.
-- ============================================================

-- ============================================================
-- 1. Usuarios de prueba (usar UUIDs fijos para reproducibilidad)
-- ============================================================

-- IMPORTANTE: en local, auth.users se crea vía supabase auth admin.
-- Para seed de desarrollo, insertamos directamente usando service_role.
-- En CI/CD se puede usar `supabase auth admin create-user`.

-- Insertar en auth.users primero (necesario para la FK en public.users)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  (
    'a1000000-0000-0000-0000-000000000001'::uuid,
    'pipiolo@motociudad.dev',
    '$2a$10$PW.DEV.SEED.HASH.NOT.REAL.aaaaaaaaaaaaaaaaaaaaaaaaaaa',
    now(), now(), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"display_name": "Miguel Rueda"}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'a1000000-0000-0000-0000-000000000002'::uuid,
    'rodador@motociudad.dev',
    '$2a$10$PW.DEV.SEED.HASH.NOT.REAL.bbbbbbbbbbbbbbbbbbbbbbbbbbb',
    now(), now(), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"display_name": "Sara Motriz"}'::jsonb,
    'authenticated', 'authenticated'
  ),
  (
    'a1000000-0000-0000-0000-000000000003'::uuid,
    'cartografo@motociudad.dev',
    '$2a$10$PW.DEV.SEED.HASH.NOT.REAL.ccccccccccccccccccccccccccc',
    now(), now(), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"display_name": "Juan Cartógrafo"}'::jsonb,
    'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

-- public.users (trigger handle_new_user lo crea, pero aquí lo ajustamos para el seed)
INSERT INTO public.users (
  id, username, display_name, city_primary, current_level,
  total_octanos, octanos_this_month, bike_model
) VALUES
  (
    'a1000000-0000-0000-0000-000000000001'::uuid,
    'miguelrueda', 'Miguel Rueda', 'Madrid', 1,
    45, 45, 'Honda CB500F'
  ),
  (
    'a1000000-0000-0000-0000-000000000002'::uuid,
    'saramotriz', 'Sara Motriz', 'Madrid', 2,
    350, 120, 'Yamaha MT-07'
  ),
  (
    'a1000000-0000-0000-0000-000000000003'::uuid,
    'juancartografo', 'Juan Cartógrafo', 'Madrid', 4,
    2100, 480, 'Kawasaki Z900'
  )
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  current_level = EXCLUDED.current_level,
  total_octanos = EXCLUDED.total_octanos,
  octanos_this_month = EXCLUDED.octanos_this_month;

-- ============================================================
-- 2. Parkings de prueba en Madrid (coordenadas reales)
-- ============================================================

INSERT INTO public.parkings (
  id, proposed_by, name, type, status, location, address, city, district,
  capacity, features, notes, verifications_count, last_verified_at
) VALUES

  -- P1: Parking público Puerta del Sol (verificado)
  (
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'a1000000-0000-0000-0000-000000000002'::uuid,
    'Motos Puerta del Sol - Calle Correo',
    'public',
    'verified',
    ST_SetSRID(ST_MakePoint(-3.70325, 40.41668), 4326)::geography,
    'Calle del Correo, 4, 28012 Madrid',
    'Madrid',
    'Centro',
    12,
    '{"covered": false, "cameras": false, "anchors": false, "lit": true, "free": true, "h24": true, "battery_layout": true}'::jsonb,
    'Zona habitual para motos en el centro. Suele estar llena entre semana.',
    3,
    now() - INTERVAL '2 days'
  ),

  -- P2: Parking en Malasaña (verificado)
  (
    'b1000000-0000-0000-0000-000000000002'::uuid,
    'a1000000-0000-0000-0000-000000000003'::uuid,
    'Zona Motos Calle San Vicente Ferrer',
    'public',
    'verified',
    ST_SetSRID(ST_MakePoint(-3.70652, 40.42401), 4326)::geography,
    'Calle de San Vicente Ferrer, 28, 28004 Madrid',
    'Madrid',
    'Malasaña',
    8,
    '{"covered": false, "cameras": false, "anchors": false, "lit": true, "free": true, "h24": true, "battery_layout": false}'::jsonb,
    'Buena zona en el barrio. Pocas motos habitualmente por las mañanas.',
    1,
    now() - INTERVAL '5 days'
  ),

  -- P3: Garaje privado en Chamberí (verificado)
  (
    'b1000000-0000-0000-0000-000000000003'::uuid,
    'a1000000-0000-0000-0000-000000000003'::uuid,
    'Garaje Privado Comunidad Alonso Martínez',
    'private',
    'verified',
    ST_SetSRID(ST_MakePoint(-3.69897, 40.42798), 4326)::geography,
    'Calle de Génova, 5, 28004 Madrid',
    'Madrid',
    'Almagro',
    4,
    '{"covered": true, "cameras": true, "anchors": true, "lit": true, "free": false, "h24": true, "battery_layout": false}'::jsonb,
    'Garaje de comunidad. Preguntar al portero. ~80€/mes. Solo motos.',
    2,
    now() - INTERVAL '10 days'
  ),

  -- P4: Zona en Lavapiés (pendiente de verificación)
  (
    'b1000000-0000-0000-0000-000000000004'::uuid,
    'a1000000-0000-0000-0000-000000000001'::uuid,
    'Plaza Lavapiés - Motos junto a escaleras',
    'public',
    'pending',
    ST_SetSRID(ST_MakePoint(-3.70277, 40.40887), 4326)::geography,
    'Plaza de Lavapiés, s/n, 28012 Madrid',
    'Madrid',
    'Lavapiés',
    6,
    '{"covered": false, "cameras": false, "anchors": false, "lit": true, "free": true, "h24": true, "battery_layout": false}'::jsonb,
    'He visto motos aparcadas aquí varias semanas. Necesita verificación.',
    0,
    NULL
  ),

  -- P5: Parking cubierto en Retiro (verificado)
  (
    'b1000000-0000-0000-0000-000000000005'::uuid,
    'a1000000-0000-0000-0000-000000000002'::uuid,
    'Aparcamiento Motos Paseo del Retiro',
    'public',
    'verified',
    ST_SetSRID(ST_MakePoint(-3.68256, 40.41439), 4326)::geography,
    'Paseo del Retiro, 1, 28009 Madrid',
    'Madrid',
    'Retiro',
    20,
    '{"covered": false, "cameras": true, "anchors": false, "lit": true, "free": true, "h24": true, "battery_layout": true}'::jsonb,
    'Gran zona de aparcamiento junto al parque. Cámaras del ayuntamiento visibles.',
    5,
    now() - INTERVAL '1 day'
  )

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Algunas verificaciones de ejemplo
-- ============================================================

INSERT INTO public.parking_verifications (
  id, parking_id, verified_by, user_location, distance_meters, is_first_verifier, created_at
) VALUES
  (
    'c1000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,  -- Puerta del Sol
    'a1000000-0000-0000-0000-000000000003'::uuid,  -- Juan Cartógrafo
    ST_SetSRID(ST_MakePoint(-3.70330, 40.41670), 4326)::geography,
    8.5,
    TRUE,
    now() - INTERVAL '3 days'
  ),
  (
    'c1000000-0000-0000-0000-000000000002'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,  -- Puerta del Sol
    'a1000000-0000-0000-0000-000000000002'::uuid,  -- Sara Motriz
    ST_SetSRID(ST_MakePoint(-3.70320, 40.41665), 4326)::geography,
    12.1,
    FALSE,
    now() - INTERVAL '2 days'
  ),
  (
    'c1000000-0000-0000-0000-000000000003'::uuid,
    'b1000000-0000-0000-0000-000000000005'::uuid,  -- Retiro
    'a1000000-0000-0000-0000-000000000003'::uuid,  -- Juan Cartógrafo
    ST_SetSRID(ST_MakePoint(-3.68260, 40.41440), 4326)::geography,
    5.2,
    TRUE,
    now() - INTERVAL '2 days'
  )
ON CONFLICT (parking_id, verified_by) DO NOTHING;

-- ============================================================
-- 4. Algunos eventos de Octanos de ejemplo
-- ============================================================

INSERT INTO public.octano_events (
  id, user_id, action_type, points, reference_id, reference_type,
  status, confirmed_at
) VALUES
  (
    'd1000000-0000-0000-0000-000000000001'::uuid,
    'a1000000-0000-0000-0000-000000000003'::uuid,
    'verify_parking', 25,
    'b1000000-0000-0000-0000-000000000001'::uuid, 'parking',
    'confirmed', now() - INTERVAL '3 days'
  ),
  (
    'd1000000-0000-0000-0000-000000000002'::uuid,
    'a1000000-0000-0000-0000-000000000003'::uuid,
    'first_verifier', 15,
    'b1000000-0000-0000-0000-000000000001'::uuid, 'parking',
    'confirmed', now() - INTERVAL '3 days'
  ),
  (
    'd1000000-0000-0000-0000-000000000003'::uuid,
    'a1000000-0000-0000-0000-000000000002'::uuid,
    'verify_parking', 25,
    'b1000000-0000-0000-0000-000000000001'::uuid, 'parking',
    'confirmed', now() - INTERVAL '2 days'
  ),
  (
    'd1000000-0000-0000-0000-000000000004'::uuid,
    'a1000000-0000-0000-0000-000000000001'::uuid,
    'propose_parking', 50,
    'b1000000-0000-0000-0000-000000000004'::uuid, 'parking',
    'pending', NULL
  )
ON CONFLICT (id) DO NOTHING;
