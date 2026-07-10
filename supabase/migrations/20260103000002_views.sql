-- Migration: 20260103000002_views
-- Vistas y materialized views que dependen de múltiples tablas del dominio.
-- modelo-datos.md §11
-- Debe ejecutarse después de: parkings, parking_photos, octano_events, y comments.

-- ============================================================
-- Vista: parkings_with_stats
-- Agrega contadores de fotos y comentarios sin múltiples joins.
-- La tabla comments se crea en una migración posterior al MVP core;
-- aquí usamos solo parking_photos por ahora y dejamos comments cuando exista.
-- modelo-datos.md §11.1
-- ============================================================
CREATE OR REPLACE VIEW public.parkings_with_stats AS
SELECT
  p.*,
  (
    SELECT COUNT(*)
    FROM public.parking_photos ph
    WHERE ph.parking_id = p.id
  ) AS photos_count
FROM public.parkings p
WHERE p.deleted_at IS NULL;

COMMENT ON VIEW public.parkings_with_stats IS
  'Parkings activos con contadores derivados. No persistir — solo para lectura. modelo-datos.md §11.1';

-- ============================================================
-- Materialized view: mv_ranking_global
-- Ranking global recalculado por pg_cron.
-- modelo-datos.md §11.2
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_ranking_global AS
SELECT
  u.id,
  u.username,
  u.display_name,
  u.avatar_url,
  u.current_level,
  u.city_primary,
  u.total_octanos,
  u.octanos_this_month,
  ROW_NUMBER() OVER (ORDER BY u.total_octanos DESC)        AS rank_total,
  ROW_NUMBER() OVER (ORDER BY u.octanos_this_month DESC)   AS rank_month
FROM public.users u
WHERE u.ranking_visible = TRUE
  AND u.flagged_for_review = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ranking_global_id
  ON public.mv_ranking_global(id);

CREATE INDEX IF NOT EXISTS idx_mv_ranking_global_rank_total
  ON public.mv_ranking_global(rank_total);

CREATE INDEX IF NOT EXISTS idx_mv_ranking_global_rank_month
  ON public.mv_ranking_global(rank_month);

COMMENT ON MATERIALIZED VIEW public.mv_ranking_global IS
  'Ranking global. Refrescado por pg_cron cada 5 minutos. modelo-datos.md §11.2';

-- Programar refresh con pg_cron (cada 5 minutos)
SELECT cron.schedule(
  'refresh-ranking-global',
  '*/5 * * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_ranking_global; $$
);
