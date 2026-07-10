-- Migration: 20260103000001_process_verification_rpc
-- Función SQL atómica que ejecuta la inserción de verificación en una transacción.
-- Llamada exclusivamente desde la Edge Function validate-verification vía RPC.
-- No debe ser accesible como RPC para 'authenticated' (solo service_role).

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
SECURITY DEFINER  -- ejecuta con los permisos del dueño (service_role)
SET search_path = public
AS $$
DECLARE
  v_photo_id          UUID;
  v_verification_id   UUID;
  v_parking_status    parking_status;
  v_new_status        parking_status;
BEGIN
  -- 1. Obtener estado actual del parking (para determinar new_status)
  SELECT status INTO v_parking_status
    FROM public.parkings
   WHERE id = p_parking_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARKING_NOT_FOUND: parking % no existe', p_parking_id;
  END IF;

  -- 2. Insertar foto de verificación
  INSERT INTO public.parking_photos (
    parking_id,
    uploaded_by,
    storage_path,
    thumbnail_path,
    is_primary,
    is_verification,
    width,
    height,
    size_bytes
  ) VALUES (
    p_parking_id,
    p_user_id,
    p_storage_path,
    p_thumbnail_path,
    FALSE,
    TRUE,  -- es foto de verificación
    p_photo_width,
    p_photo_height,
    p_photo_size_bytes
  )
  RETURNING id INTO v_photo_id;

  -- 3. Insertar verificación
  -- El trigger trg_parking_verifications_count actualizará el contador del parking
  INSERT INTO public.parking_verifications (
    parking_id,
    verified_by,
    photo_id,
    user_location,
    distance_meters,
    is_first_verifier
  ) VALUES (
    p_parking_id,
    p_user_id,
    v_photo_id,
    ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography,
    p_distance_meters,
    p_is_first_verifier
  )
  RETURNING id INTO v_verification_id;

  -- 4. Insertar evento de Octanos: verify_parking (+25)
  INSERT INTO public.octano_events (
    user_id,
    action_type,
    points,
    reference_id,
    reference_type,
    status,
    confirmed_at
  ) VALUES (
    p_user_id,
    'verify_parking',
    25,
    p_parking_id,
    'parking',
    'confirmed',
    now()
  );

  -- 5. Si es primer verificador: bonus octano_event first_verifier (+15)
  IF p_is_first_verifier THEN
    INSERT INTO public.octano_events (
      user_id,
      action_type,
      points,
      reference_id,
      reference_type,
      status,
      confirmed_at
    ) VALUES (
      p_user_id,
      'first_verifier',
      15,
      p_parking_id,
      'parking',
      'confirmed',
      now()
    );
  END IF;

  -- 6. Actualizar parking: last_verified_at y status si era pending
  -- (el trigger trg_parking_verifications_count ya actualizó verifications_count y status,
  --  pero actualizamos last_verified_at explícitamente por si el trigger falla)
  UPDATE public.parkings
     SET last_verified_at = now(),
         updated_at = now()
   WHERE id = p_parking_id;

  -- Determinar el nuevo estado (el trigger ya pudo haberlo cambiado a verified)
  SELECT status INTO v_new_status
    FROM public.parkings
   WHERE id = p_parking_id;

  -- 7. Retornar IDs generados para que la Edge Function los devuelva al cliente
  RETURN jsonb_build_object(
    'photo_id',         v_photo_id,
    'verification_id',  v_verification_id,
    'new_status',       v_new_status::text
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Violación de UNIQUE (parking_id, verified_by): race condition detectada
    RAISE EXCEPTION 'ALREADY_VERIFIED: usuario % ya verificó el parking %', p_user_id, p_parking_id;
  WHEN OTHERS THEN
    RAISE; -- Re-propagar otros errores
END;
$$;

-- Comentario descriptivo
COMMENT ON FUNCTION public.process_parking_verification IS
  'Función atómica de verificación de parking. Solo invocada desde Edge Function validate-verification. SECURITY DEFINER.';

-- IMPORTANTE: NO hacer GRANT a 'authenticated' ni 'anon'.
-- La Edge Function usa service_role_key que bypasea RLS y puede llamar cualquier función.
-- Revocamos permisos explícitamente para otros roles:
REVOKE EXECUTE ON FUNCTION public.process_parking_verification(
  UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC,
  TEXT, TEXT, INTEGER, INTEGER, INTEGER, BOOLEAN
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.process_parking_verification(
  UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC,
  TEXT, TEXT, INTEGER, INTEGER, INTEGER, BOOLEAN
) FROM authenticated;
