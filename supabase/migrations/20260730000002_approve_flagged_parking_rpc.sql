-- Migration: 20260730000002_approve_flagged_parking_rpc
-- RPC para que un admin apruebe un parking que Otto marcó 'flagged': lo publica
-- (ai_review_status='approved', parking_status sigue 'pending') y otorga los +50
-- Octanos pendientes al proponente, de forma IDEMPOTENTE (no re-otorga).
-- Solo invocable desde la Edge Function admin-approve-parking (service_role).
-- OpenSpec: changes/otto-parking-verification · spec admin-parking-management / propose-parking (D4/D7)

CREATE OR REPLACE FUNCTION public.approve_flagged_parking(p_parking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposer     UUID;
  v_ai           parking_ai_review_status;
  v_octanos      INTEGER := 0;
  v_already      BOOLEAN;
BEGIN
  SELECT proposed_by, ai_review_status
    INTO v_proposer, v_ai
  FROM public.parkings
  WHERE id = p_parking_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_proposer IS NULL THEN
    RAISE EXCEPTION 'PARKING_NOT_FOUND';
  END IF;

  IF v_ai IS DISTINCT FROM 'flagged' THEN
    RAISE EXCEPTION 'NOT_FLAGGED';
  END IF;

  -- Publicar: aprobado por IA; la verificación comunitaria sigue su curso (pending).
  UPDATE public.parkings
     SET ai_review_status = 'approved',
         ai_reviewed_at    = now()
   WHERE id = p_parking_id;

  -- Otorgar +50 pendientes solo si aún no se otorgaron (idempotencia).
  SELECT EXISTS (
    SELECT 1 FROM public.octano_events
    WHERE reference_id = p_parking_id
      AND reference_type = 'parking'
      AND action_type = 'propose_parking'
  ) INTO v_already;

  IF NOT v_already THEN
    INSERT INTO public.octano_events (
      user_id, action_type, points, reference_id, reference_type, status
    ) VALUES (
      v_proposer, 'propose_parking', 50, p_parking_id, 'parking', 'pending'
    );
    v_octanos := 50;
  END IF;

  RETURN jsonb_build_object('octanos_earned', v_octanos);
END;
$$;

COMMENT ON FUNCTION public.approve_flagged_parking(UUID) IS
  'Aprueba un parking flagged por Otto: lo publica y otorga +50 Octanos pendientes (idempotente). Solo desde Edge Function admin-approve-parking. SECURITY DEFINER.';

-- Solo service_role (Edge Function) puede ejecutarlo; nunca clientes.
REVOKE EXECUTE ON FUNCTION public.approve_flagged_parking(UUID) FROM PUBLIC, authenticated, anon;
