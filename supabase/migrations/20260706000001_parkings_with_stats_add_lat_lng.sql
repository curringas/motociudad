-- Añade lat/lng extraídos del punto geográfico a parkings_with_stats.
-- PostgREST devuelve GEOGRAPHY como WKB hex, no como GeoJSON, así que el cliente
-- no puede extraer coordenadas directamente. La vista hace la extracción en DB.
CREATE OR REPLACE VIEW public.parkings_with_stats AS
SELECT
  p.*,
  (
    SELECT COUNT(*)
    FROM public.parking_photos ph
    WHERE ph.parking_id = p.id
  ) AS photos_count,
  ST_Y(p.location::geometry) AS lat,
  ST_X(p.location::geometry) AS lng
FROM public.parkings p
WHERE p.deleted_at IS NULL;
