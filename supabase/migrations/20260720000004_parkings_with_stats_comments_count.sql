-- Migration: 20260720000004_parkings_with_stats_comments_count
-- Adds comments_count to parkings_with_stats (avoids N+1 in the parking detail).
-- modelo-datos.md §11.1 + change add-parking-comments.
--
-- CREATE OR REPLACE VIEW can only append columns, so comments_count goes last,
-- after the existing photos_count/lat/lng (20260706000001).
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
    WHERE c.parking_id = p.id AND c.deleted_at IS NULL
  ) AS comments_count
FROM public.parkings p
WHERE p.deleted_at IS NULL;

COMMENT ON VIEW public.parkings_with_stats IS
  'Parkings activos con contadores derivados (photos_count, comments_count) y lat/lng. Solo lectura. modelo-datos.md §11.1';
