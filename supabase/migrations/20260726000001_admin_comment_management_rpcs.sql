-- Migration: 20260726000001_admin_comment_management_rpcs
-- Admin comment management: paginated/searchable listing + hard delete with
-- Octano revocation.
-- OpenSpec: changes/admin-comments-management · spec admin-comment-management (D1, D4)

-- ============================================================
-- admin_list_comments: paginated, searchable listing of stored comments
-- (approved + pending_review). Read-only; callable by the admin panel directly
-- (guarded by is_admin()). Returns { rows: [...], total: N }.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_comments(
  p_status text DEFAULT 'pending_review',
  p_city   text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit  int  DEFAULT 50,
  p_offset int  DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total  int  := 0;
  v_rows   jsonb := '[]'::jsonb;
  v_search text := NULLIF(btrim(coalesce(p_search, '')), '');
  v_city   text := NULLIF(btrim(coalesce(p_city, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: solo administradores';
  END IF;
  IF p_status NOT IN ('pending_review', 'approved', 'all') THEN
    RAISE EXCEPTION 'INVALID_STATUS: estado no soportado';
  END IF;

  WITH filtered AS (
    SELECT
      c.id, c.body, c.moderation_status::text AS moderation_status,
      c.upvotes_count, c.created_at,
      c.author_id, u.username, u.display_name,
      c.parking_id, p.name AS parking_name, p.city,
      count(*) OVER() AS total_count
    FROM public.comments c
    JOIN public.users u    ON u.id = c.author_id
    JOIN public.parkings p ON p.id = c.parking_id
    WHERE c.deleted_at IS NULL
      AND c.moderation_status IN ('approved', 'pending_review')
      AND (p_status = 'all' OR c.moderation_status = p_status::comment_moderation_status)
      AND (v_city IS NULL OR p.city ILIKE '%' || v_city || '%')
      AND (
        v_search IS NULL
        OR c.body ILIKE '%' || v_search || '%'
        OR u.username ILIKE '%' || v_search || '%'
        OR u.display_name ILIKE '%' || v_search || '%'
        OR p.name ILIKE '%' || v_search || '%'
      )
    ORDER BY c.created_at DESC
    LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
  )
  SELECT
    coalesce(jsonb_agg(to_jsonb(filtered) - 'total_count' ORDER BY created_at DESC), '[]'::jsonb),
    coalesce(max(total_count), 0)
  INTO v_rows, v_total
  FROM filtered;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

COMMENT ON FUNCTION public.admin_list_comments IS
  'Listado paginado/buscable de comentarios approved+pending_review para el panel admin. SECURITY DEFINER + is_admin().';

REVOKE EXECUTE ON FUNCTION public.admin_list_comments(text, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_comments(text, text, text, int, int) TO authenticated;

-- (El filtro de ciudad usa búsqueda de texto ILIKE, no un catálogo de ciudades.)

-- ============================================================
-- admin_delete_comments: hard delete comments + revoke their Octanos.
-- Called ONLY from the admin Edge Function (service_role); the admin gate lives
-- in the Edge Function. Deleting octano_events frees the ladder slot; the author
-- caches are recomputed (the cache trigger only fires on INSERT).
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_comments(p_comment_ids uuid[])
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_authors uuid[];
  v_events  int := 0;
  v_deleted int := 0;
BEGIN
  IF p_comment_ids IS NULL OR array_length(p_comment_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('deleted_comments', 0, 'deleted_events', 0);
  END IF;

  SELECT array_agg(DISTINCT author_id) INTO v_authors
  FROM public.comments WHERE id = ANY(p_comment_ids);

  -- Revoke Octanos: position events (metadata.comment_id) + useful_comment
  -- (reference_type='comment', reference_id=comment_id).
  WITH del AS (
    DELETE FROM public.octano_events
    WHERE (metadata->>'comment_id')::uuid = ANY(p_comment_ids)
       OR (reference_type = 'comment' AND reference_id = ANY(p_comment_ids))
    RETURNING 1
  )
  SELECT count(*) INTO v_events FROM del;

  WITH del AS (
    DELETE FROM public.comments WHERE id = ANY(p_comment_ids) RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM del;

  -- Recompute affected authors' cached totals from confirmed events.
  UPDATE public.users u SET
    total_octanos = COALESCE((
      SELECT SUM(points) FROM public.octano_events e
      WHERE e.user_id = u.id AND e.status = 'confirmed'), 0),
    octanos_this_month = COALESCE((
      SELECT SUM(points) FROM public.octano_events e
      WHERE e.user_id = u.id AND e.status = 'confirmed'
        AND e.created_at >= date_trunc('month', now())), 0)
  WHERE u.id = ANY(v_authors);

  RETURN jsonb_build_object('deleted_comments', v_deleted, 'deleted_events', v_events);
END;
$$;

COMMENT ON FUNCTION public.admin_delete_comments IS
  'Hard delete de comentarios + retirada de Octanos (borra octano_events y recalcula caché del autor). Solo desde Edge Function admin-delete-comment. SECURITY DEFINER.';

REVOKE EXECUTE ON FUNCTION public.admin_delete_comments(uuid[]) FROM PUBLIC, authenticated, anon;
