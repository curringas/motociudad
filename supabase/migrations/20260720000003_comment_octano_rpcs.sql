-- Migration: 20260720000003_comment_octano_rpcs
-- Atomic crediting logic for comments. Invoked ONLY from Edge Functions via RPC.
-- gamificacion.md §2.1–2.2 + change add-parking-comments design.md (D2, D4, D5).
--
-- Reference-id convention for octano_events:
--   first_comment / second_comment -> reference_id = parking_id (position is per-parking),
--                                       comment_id stored in metadata.
--   useful_comment                  -> reference_id = comment_id (quality is per-comment).

-- ============================================================
-- Race guards (design D4): at most one position bonus per (parking, position),
-- and at most one useful_comment per comment.
-- ============================================================
CREATE UNIQUE INDEX idx_octano_comment_position
  ON public.octano_events (reference_id, action_type)
  WHERE action_type IN ('first_comment', 'second_comment');

CREATE UNIQUE INDEX idx_octano_useful_comment
  ON public.octano_events (reference_id, action_type)
  WHERE action_type = 'useful_comment';

-- ============================================================
-- Helper: rolling 24h confirmed Octanos (mirrors validate-verification cap).
-- gamificacion.md §2.2 regla 1 — cap de 200/día.
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirmed_octanos_last_24h(in_user_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(points), 0)::integer
  FROM public.octano_events
  WHERE user_id = in_user_id
    AND status = 'confirmed'
    AND created_at >= now() - INTERVAL '24 hours';
$$;

REVOKE EXECUTE ON FUNCTION public.confirmed_octanos_last_24h(UUID) FROM PUBLIC, authenticated, anon;

-- ============================================================
-- process_comment: inserts a comment and, if eligible + under the daily cap,
-- credits the position bonus (+10 first / +5 second). Atomic.
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_comment(
  p_parking_id UUID,
  p_user_id    UUID,
  p_body       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status         parking_status;
  v_proposer       UUID;
  v_comment_id     UUID;
  v_is_eligible    BOOLEAN := FALSE;
  v_awarded        UUID[];
  v_awarded_count  INTEGER := 0;
  v_action         octano_action;
  v_points         INTEGER := 0;
  v_event_id       UUID;
  v_cap_reached    BOOLEAN;
BEGIN
  -- 1. Parking must exist and be commentable (pending or verified).
  SELECT status, proposed_by INTO v_status, v_proposer
    FROM public.parkings
   WHERE id = p_parking_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARKING_NOT_FOUND: parking % no existe', p_parking_id;
  END IF;

  IF v_status IN ('archived', 'rejected') THEN
    RAISE EXCEPTION 'PARKING_ARCHIVED: parking % no admite comentarios', p_parking_id;
  END IF;

  -- 2. Insert the comment (body length enforced by CHECK constraint).
  INSERT INTO public.comments (parking_id, author_id, body)
  VALUES (p_parking_id, p_user_id, p_body)
  RETURNING id INTO v_comment_id;

  -- 3. Eligibility: author must be neither the proposer nor a verifier (snapshot now).
  v_is_eligible := (p_user_id <> v_proposer)
    AND NOT EXISTS (
      SELECT 1 FROM public.parking_verifications
       WHERE parking_id = p_parking_id AND verified_by = p_user_id
    );

  v_cap_reached := public.confirmed_octanos_last_24h(p_user_id) >= 200;

  IF v_is_eligible AND NOT v_cap_reached THEN
    -- Distinct authors already awarded a position bonus for this parking.
    SELECT array_agg(DISTINCT user_id) INTO v_awarded
      FROM public.octano_events
     WHERE reference_id = p_parking_id
       AND action_type IN ('first_comment', 'second_comment');

    v_awarded_count := COALESCE(array_length(v_awarded, 1), 0);

    -- Author cannot take a second slot on the same parking.
    IF v_awarded IS NULL OR NOT (p_user_id = ANY (v_awarded)) THEN
      IF v_awarded_count = 0 THEN
        v_action := 'first_comment';  v_points := 10;
      ELSIF v_awarded_count = 1 THEN
        v_action := 'second_comment'; v_points := 5;
      END IF;
    END IF;

    IF v_action IS NOT NULL THEN
      -- Insert the position event; the partial unique index guards concurrent races.
      INSERT INTO public.octano_events (
        user_id, action_type, points, reference_id, reference_type, status, confirmed_at, metadata
      ) VALUES (
        p_user_id, v_action, v_points, p_parking_id, 'parking', 'confirmed', now(),
        jsonb_build_object('comment_id', v_comment_id)
      )
      ON CONFLICT (reference_id, action_type)
        WHERE action_type IN ('first_comment', 'second_comment')
      DO NOTHING
      RETURNING id INTO v_event_id;

      -- Lost the race for 'first_comment'? Try the second slot (design D4).
      IF v_event_id IS NULL AND v_action = 'first_comment' THEN
        v_action := 'second_comment'; v_points := 5;
        INSERT INTO public.octano_events (
          user_id, action_type, points, reference_id, reference_type, status, confirmed_at, metadata
        ) VALUES (
          p_user_id, v_action, v_points, p_parking_id, 'parking', 'confirmed', now(),
          jsonb_build_object('comment_id', v_comment_id)
        )
        ON CONFLICT (reference_id, action_type)
          WHERE action_type IN ('first_comment', 'second_comment')
        DO NOTHING
        RETURNING id INTO v_event_id;
      END IF;

      IF v_event_id IS NULL THEN
        v_action := NULL; v_points := 0;  -- both slots taken concurrently
      ELSE
        UPDATE public.comments SET octanos_awarded = TRUE WHERE id = v_comment_id;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'comment_id',     v_comment_id,
    'octanos_earned', v_points,
    'action_type',    v_action,
    'eligible',       v_is_eligible,
    'cap_reached',    v_cap_reached
  );
END;
$$;

COMMENT ON FUNCTION public.process_comment IS
  'Inserta comentario + acredita escalera (+10/+5) atómicamente. Solo desde Edge Function post-comment. SECURITY DEFINER.';

REVOKE EXECUTE ON FUNCTION public.process_comment(UUID, UUID, TEXT) FROM PUBLIC, authenticated, anon;

-- ============================================================
-- process_comment_vote: records a vote and, when the comment first reaches
-- >= 2 net upvotes, credits useful_comment (+5) to the AUTHOR (cap applies to
-- the author). Idempotent via the partial unique index. Atomic.
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_comment_vote(
  p_comment_id UUID,
  p_user_id    UUID,
  p_value      SMALLINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_author        UUID;
  v_deleted       TIMESTAMPTZ;
  v_upvotes       INTEGER;
  v_net           INTEGER;
  v_event_id      UUID;
  v_octanos       INTEGER := 0;
BEGIN
  -- 1. Comment must exist and not be soft-deleted.
  SELECT author_id, deleted_at INTO v_author, v_deleted
    FROM public.comments WHERE id = p_comment_id;

  IF NOT FOUND OR v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'COMMENT_NOT_FOUND: comentario % no disponible', p_comment_id;
  END IF;

  -- 2. No self-vote.
  IF v_author = p_user_id THEN
    RAISE EXCEPTION 'SELF_VOTE_FORBIDDEN: no puedes votar tu propio comentario';
  END IF;

  -- 3. Upsert the vote.
  INSERT INTO public.comment_votes (comment_id, user_id, value)
  VALUES (p_comment_id, p_user_id, p_value)
  ON CONFLICT (comment_id, user_id)
  DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  -- 4. Recompute caches: upvotes (value=1) and net score.
  SELECT
    COUNT(*) FILTER (WHERE value = 1)::integer,
    COALESCE(SUM(value), 0)::integer
  INTO v_upvotes, v_net
  FROM public.comment_votes WHERE comment_id = p_comment_id;

  UPDATE public.comments SET upvotes_count = v_upvotes WHERE id = p_comment_id;

  -- 5. Quality bonus: first time net >= 2, credit +5 to the author (cap applies to author).
  IF v_net >= 2 AND public.confirmed_octanos_last_24h(v_author) < 200 THEN
    INSERT INTO public.octano_events (
      user_id, action_type, points, reference_id, reference_type, status, confirmed_at
    ) VALUES (
      v_author, 'useful_comment', 5, p_comment_id, 'comment', 'confirmed', now()
    )
    ON CONFLICT (reference_id, action_type)
      WHERE action_type = 'useful_comment'
    DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NOT NULL THEN
      v_octanos := 5;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'upvotes_count',  v_upvotes,
    'net_score',      v_net,
    'octanos_earned', v_octanos
  );
END;
$$;

COMMENT ON FUNCTION public.process_comment_vote IS
  'Registra voto + acredita useful_comment (+5) al autor al cruzar >=2 neto, idempotente. Solo desde Edge Function vote-comment. SECURITY DEFINER.';

REVOKE EXECUTE ON FUNCTION public.process_comment_vote(UUID, UUID, SMALLINT) FROM PUBLIC, authenticated, anon;

-- ============================================================
-- soft_delete_comment: author-only soft delete. Never reverts Octanos.
-- ============================================================
CREATE OR REPLACE FUNCTION public.soft_delete_comment(
  p_comment_id UUID,
  p_user_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_author  UUID;
  v_deleted TIMESTAMPTZ;
BEGIN
  SELECT author_id, deleted_at INTO v_author, v_deleted
    FROM public.comments WHERE id = p_comment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMMENT_NOT_FOUND: comentario % no existe', p_comment_id;
  END IF;

  IF v_author <> p_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN: solo el autor puede borrar su comentario';
  END IF;

  -- Idempotent: already deleted is a no-op success.
  IF v_deleted IS NULL THEN
    UPDATE public.comments SET deleted_at = now() WHERE id = p_comment_id;
  END IF;

  RETURN jsonb_build_object('comment_id', p_comment_id, 'deleted', TRUE);
END;
$$;

COMMENT ON FUNCTION public.soft_delete_comment IS
  'Soft-delete de comentario por su autor. No revierte Octanos ya acreditados. Solo desde Edge Function. SECURITY DEFINER.';

REVOKE EXECUTE ON FUNCTION public.soft_delete_comment(UUID, UUID) FROM PUBLIC, authenticated, anon;
