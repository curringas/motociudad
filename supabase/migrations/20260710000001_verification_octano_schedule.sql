-- Migration: 20260710000001_verification_octano_schedule
-- Ajusta process_parking_verification al baremo de gamificacion.md §2.2 (regla 6):
--   * Octanos del verificador según el orden: 1ª = +40 (verify_parking 25 + first_verifier 15),
--     2ª = +25, 3ª = +10.
--   * Tope de 3 verificaciones por parking (defensa en profundidad; la Edge Function
--     también lo bloquea antes con VERIFICATION_LIMIT_REACHED).
--   * En la 1ª verificación: los +50 pendientes de propose_parking del proponente pasan a
--     'confirmed' y se le añade un bonus +30 (parking_verified_bonus).

CREATE OR REPLACE FUNCTION public.process_parking_verification(
  p_parking_id       UUID,
  p_user_id          UUID,
  p_user_lat         DOUBLE PRECISION,
  p_user_lng         DOUBLE PRECISION,
  p_distance_meters  NUMERIC,
  p_storage_path     TEXT,
  p_thumbnail_path   TEXT DEFAULT NULL,
  p_photo_width      INTEGER DEFAULT NULL,
  p_photo_height     INTEGER DEFAULT NULL,
  p_photo_size_bytes INTEGER DEFAULT NULL,
  p_is_first_verifier BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_photo_id        UUID;
  v_verification_id UUID;
  v_order           INTEGER;   -- verificaciones existentes ANTES de esta (0 = primera)
  v_proposer        UUID;
  v_verify_points   INTEGER;
  v_octanos_earned  INTEGER;
  v_new_status      parking_status;
BEGIN
  -- 1. Estado actual: orden (contador previo) y proponente
  SELECT verifications_count, proposed_by
    INTO v_order, v_proposer
    FROM public.parkings
   WHERE id = p_parking_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARKING_NOT_FOUND: parking % no existe', p_parking_id;
  END IF;

  -- Tope de 3 verificaciones (defensa; la Edge Function ya lo bloquea antes)
  IF v_order >= 3 THEN
    RAISE EXCEPTION 'VERIFICATION_LIMIT_REACHED: parking % ya tiene 3 verificaciones', p_parking_id;
  END IF;

  -- 2. Insertar foto de verificación
  INSERT INTO public.parking_photos (
    parking_id, uploaded_by, storage_path, thumbnail_path,
    is_primary, is_verification, width, height, size_bytes
  ) VALUES (
    p_parking_id, p_user_id, p_storage_path, p_thumbnail_path,
    FALSE, TRUE, p_photo_width, p_photo_height, p_photo_size_bytes
  )
  RETURNING id INTO v_photo_id;

  -- 3. Insertar verificación (el trigger trg_parking_verifications_count incrementa
  --    verifications_count y hace el flip pending -> verified en la 1ª)
  INSERT INTO public.parking_verifications (
    parking_id, verified_by, photo_id, user_location, distance_meters, is_first_verifier
  ) VALUES (
    p_parking_id, p_user_id, v_photo_id,
    ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography,
    p_distance_meters, (v_order = 0)
  )
  RETURNING id INTO v_verification_id;

  -- 4. Octanos del verificador según el orden: 1ª=40 (25+15), 2ª=25, 3ª=10
  v_verify_points := CASE v_order WHEN 0 THEN 25 WHEN 1 THEN 25 WHEN 2 THEN 10 ELSE 0 END;

  INSERT INTO public.octano_events (
    user_id, action_type, points, reference_id, reference_type, status, confirmed_at
  ) VALUES (
    p_user_id, 'verify_parking', v_verify_points, p_parking_id, 'parking', 'confirmed', now()
  );

  IF v_order = 0 THEN
    INSERT INTO public.octano_events (
      user_id, action_type, points, reference_id, reference_type, status, confirmed_at
    ) VALUES (
      p_user_id, 'first_verifier', 15, p_parking_id, 'parking', 'confirmed', now()
    );
  END IF;

  v_octanos_earned := CASE v_order WHEN 0 THEN 40 WHEN 1 THEN 25 WHEN 2 THEN 10 ELSE 0 END;

  -- 5. En la 1ª verificación: confirmar los +50 pendientes del proponente y bonus +30
  IF v_order = 0 THEN
    UPDATE public.octano_events
       SET status = 'confirmed', confirmed_at = now(), updated_at = now()
     WHERE reference_id = p_parking_id
       AND action_type = 'propose_parking'
       AND status = 'pending';

    -- Bonus +30 "tu parking queda verificado" (idempotente: solo si no existe ya)
    INSERT INTO public.octano_events (
      user_id, action_type, points, reference_id, reference_type, status, confirmed_at
    )
    SELECT v_proposer, 'parking_verified_bonus', 30, p_parking_id, 'parking', 'confirmed', now()
    WHERE v_proposer IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.octano_events
         WHERE reference_id = p_parking_id
           AND action_type = 'parking_verified_bonus'
      );
  END IF;

  -- 6. Refrescar last_verified_at
  UPDATE public.parkings
     SET last_verified_at = now(), updated_at = now()
   WHERE id = p_parking_id;

  SELECT status INTO v_new_status
    FROM public.parkings
   WHERE id = p_parking_id;

  -- 7. Retornar datos para la Edge Function
  RETURN jsonb_build_object(
    'photo_id',           v_photo_id,
    'verification_id',    v_verification_id,
    'new_status',         v_new_status::text,
    'octanos_earned',     v_octanos_earned,
    'verification_order', v_order + 1
  );
END;
$$;
