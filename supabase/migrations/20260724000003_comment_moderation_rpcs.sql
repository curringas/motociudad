-- Migration: 20260724000003_comment_moderation_rpcs
-- Defers Octano crediting to the moment a comment becomes 'approved'.
-- OpenSpec: changes/ai-comment-moderation · spec parking-comments (D3), comment-moderation (D8)
--
--   process_comment now inserts with a moderation_status and credits the ladder
--   ONLY when the comment is approved on insert (the 'allow' path).
--   moderate_comment lets an admin (via Edge Function, service_role) approve or
--   reject a pending_review comment; approval evaluates the ladder AT THAT MOMENT
--   among approved comments and credits the next available slot if eligible.
--
-- Ladder/cap/eligibility logic is shared by both paths via credit_comment_position.

-- ============================================================
-- Helper: eligibility + daily cap + position ladder (first/second) with race
-- guards. Marks comments.octanos_awarded = TRUE when a position bonus is paid.
-- Returns the crediting outcome. Internal; Edge Functions never call it directly.
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_comment_position(
  p_parking_id UUID,
  p_user_id    UUID,
  p_comment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_proposer      UUID;
  v_is_eligible   BOOLEAN := FALSE;
  v_awarded       UUID[];
  v_awarded_count INTEGER := 0;
  v_action        octano_action;
  v_points        INTEGER := 0;
  v_event_id      UUID;
  v_cap_reached   BOOLEAN;
BEGIN
  SELECT proposed_by INTO v_proposer
    FROM public.parkings WHERE id = p_parking_id AND deleted_at IS NULL;

  -- Eligibility: author is neither the proposer nor a verifier (snapshot now).
  v_is_eligible := (p_user_id <> v_proposer)
    AND NOT EXISTS (
      SELECT 1 FROM public.parking_verifications
       WHERE parking_id = p_parking_id AND verified_by = p_user_id
    );

  v_cap_reached := public.confirmed_octanos_last_24h(p_user_id) >= 200;

  IF v_is_eligible AND NOT v_cap_reached THEN
    SELECT array_agg(DISTINCT user_id) INTO v_awarded
      FROM public.octano_events
     WHERE reference_id = p_parking_id
       AND action_type IN ('first_comment', 'second_comment');

    v_awarded_count := COALESCE(array_length(v_awarded, 1), 0);

    IF v_awarded IS NULL OR NOT (p_user_id = ANY (v_awarded)) THEN
      IF v_awarded_count = 0 THEN
        v_action := 'first_comment';  v_points := 10;
      ELSIF v_awarded_count = 1 THEN
        v_action := 'second_comment'; v_points := 5;
      END IF;
    END IF;

    IF v_action IS NOT NULL THEN
      INSERT INTO public.octano_events (
        user_id, action_type, points, reference_id, reference_type, status, confirmed_at, metadata
      ) VALUES (
        p_user_id, v_action, v_points, p_parking_id, 'parking', 'confirmed', now(),
        jsonb_build_object('comment_id', p_comment_id)
      )
      ON CONFLICT (reference_id, action_type)
        WHERE action_type IN ('first_comment', 'second_comment')
      DO NOTHING
      RETURNING id INTO v_event_id;

      -- Lost the race for 'first_comment'? Try the second slot.
      IF v_event_id IS NULL AND v_action = 'first_comment' THEN
        v_action := 'second_comment'; v_points := 5;
        INSERT INTO public.octano_events (
          user_id, action_type, points, reference_id, reference_type, status, confirmed_at, metadata
        ) VALUES (
          p_user_id, v_action, v_points, p_parking_id, 'parking', 'confirmed', now(),
          jsonb_build_object('comment_id', p_comment_id)
        )
        ON CONFLICT (reference_id, action_type)
          WHERE action_type IN ('first_comment', 'second_comment')
        DO NOTHING
        RETURNING id INTO v_event_id;
      END IF;

      IF v_event_id IS NULL THEN
        v_action := NULL; v_points := 0;  -- both slots taken concurrently
      ELSE
        UPDATE public.comments SET octanos_awarded = TRUE WHERE id = p_comment_id;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'octanos_earned', v_points,
    'action_type',    v_action,
    'eligible',       v_is_eligible,
    'cap_reached',    v_cap_reached
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_comment_position(UUID, UUID, UUID) FROM PUBLIC, authenticated, anon;

COMMENT ON FUNCTION public.credit_comment_position IS
  'Acredita la escalera de posición (+10/+5) de un comentario elegible bajo el cap diario. Compartido por process_comment (allow) y moderate_comment (aprobación admin). SECURITY DEFINER.';

-- ============================================================
-- process_comment: insert with a moderation status; credit only when approved.
-- Replaces the previous 3-arg version (which always credited on insert).
-- ============================================================
DROP FUNCTION IF EXISTS public.process_comment(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.process_comment(
  p_parking_id        UUID,
  p_user_id           UUID,
  p_body              TEXT,
  p_moderation_status comment_moderation_status DEFAULT 'approved'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status     parking_status;
  v_comment_id UUID;
  v_credit     JSONB := jsonb_build_object('octanos_earned', 0, 'action_type', NULL, 'eligible', FALSE, 'cap_reached', FALSE);
BEGIN
  -- 1. Parking must exist and be commentable (pending or verified).
  SELECT status INTO v_status
    FROM public.parkings WHERE id = p_parking_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARKING_NOT_FOUND: parking % no existe', p_parking_id;
  END IF;

  IF v_status IN ('archived', 'rejected') THEN
    RAISE EXCEPTION 'PARKING_ARCHIVED: parking % no admite comentarios', p_parking_id;
  END IF;

  -- 2. Insert the comment with the resolved moderation status.
  INSERT INTO public.comments (parking_id, author_id, body, moderation_status)
  VALUES (p_parking_id, p_user_id, p_body, p_moderation_status)
  RETURNING id INTO v_comment_id;

  -- 3. Credit the ladder only when the comment is publicly visible (approved).
  --    pending_review comments defer crediting until an admin approves them.
  IF p_moderation_status = 'approved' THEN
    v_credit := public.credit_comment_position(p_parking_id, p_user_id, v_comment_id);
  END IF;

  RETURN jsonb_build_object(
    'comment_id',        v_comment_id,
    'moderation_status', p_moderation_status,
    'octanos_earned',    (v_credit->>'octanos_earned')::integer,
    'action_type',       v_credit->>'action_type',
    'eligible',          (v_credit->>'eligible')::boolean,
    'cap_reached',       (v_credit->>'cap_reached')::boolean
  );
END;
$$;

COMMENT ON FUNCTION public.process_comment IS
  'Inserta comentario con moderation_status y acredita la escalera solo si approved. Solo desde Edge Function post-comment. SECURITY DEFINER.';

REVOKE EXECUTE ON FUNCTION public.process_comment(UUID, UUID, TEXT, comment_moderation_status) FROM PUBLIC, authenticated, anon;

-- ============================================================
-- moderate_comment: admin approves or rejects a pending_review comment.
-- Called ONLY from the admin Edge Function (service_role); the admin gate lives
-- in the Edge Function. Approval evaluates the ladder among approved comments now.
-- ============================================================
CREATE OR REPLACE FUNCTION public.moderate_comment(
  p_comment_id UUID,
  p_new_status comment_moderation_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_parking_id UUID;
  v_author     UUID;
  v_current    comment_moderation_status;
  v_deleted    TIMESTAMPTZ;
  v_credit     JSONB := jsonb_build_object('octanos_earned', 0, 'action_type', NULL, 'eligible', FALSE, 'cap_reached', FALSE);
BEGIN
  IF p_new_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_STATUS: solo se puede aprobar o rechazar';
  END IF;

  SELECT parking_id, author_id, moderation_status, deleted_at
    INTO v_parking_id, v_author, v_current, v_deleted
    FROM public.comments WHERE id = p_comment_id;

  IF NOT FOUND OR v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'COMMENT_NOT_FOUND: comentario % no disponible', p_comment_id;
  END IF;

  IF v_current <> 'pending_review' THEN
    RAISE EXCEPTION 'NOT_PENDING: el comentario no está pendiente de revisión';
  END IF;

  UPDATE public.comments SET moderation_status = p_new_status WHERE id = p_comment_id;

  -- On approval, credit the ladder at this moment (among approved comments).
  IF p_new_status = 'approved' THEN
    v_credit := public.credit_comment_position(v_parking_id, v_author, p_comment_id);
  END IF;

  RETURN jsonb_build_object(
    'comment_id',        p_comment_id,
    'moderation_status', p_new_status,
    'octanos_earned',    (v_credit->>'octanos_earned')::integer,
    'action_type',       v_credit->>'action_type'
  );
END;
$$;

COMMENT ON FUNCTION public.moderate_comment IS
  'Aprueba/rechaza un comentario pending_review; al aprobar evalúa y acredita la escalera. Solo desde Edge Function admin-moderate-comment. SECURITY DEFINER.';

REVOKE EXECUTE ON FUNCTION public.moderate_comment(UUID, comment_moderation_status) FROM PUBLIC, authenticated, anon;
