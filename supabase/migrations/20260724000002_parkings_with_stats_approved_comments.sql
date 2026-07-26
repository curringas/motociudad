-- Migration: 20260724000002_parkings_with_stats_approved_comments
-- comments_count in parkings_with_stats must count only publicly visible
-- (approved, not deleted) comments, so pending_review/rejected do not inflate it.
-- OpenSpec: changes/ai-comment-moderation · spec parking-comments
--
-- Same column set/order as 20260720000004 (CREATE OR REPLACE only tweaks the
-- comments_count subquery predicate).
CREATE OR REPLACE VIEW public.parkings_with_stats AS
SELECT
  p.*,
  (
    SELECT COUNT(*)
    FROM public.parking_photos ph
    WHERE ph.parking_id = p.id
  ) AS photos_count,
  ST_Y(p.location::geometry) AS lat,
  ST_X(p.location::geometry) AS lng,
  (
    SELECT COUNT(*)
    FROM public.comments c
    WHERE c.parking_id = p.id
      AND c.deleted_at IS NULL
      AND c.moderation_status = 'approved'
  ) AS comments_count
FROM public.parkings p
WHERE p.deleted_at IS NULL;

COMMENT ON VIEW public.parkings_with_stats IS
  'Parkings activos con contadores derivados (photos_count, comments_count solo approved) y lat/lng. Solo lectura. modelo-datos.md §11.1';
