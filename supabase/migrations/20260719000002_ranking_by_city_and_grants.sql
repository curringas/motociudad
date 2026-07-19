-- Migration: 20260719000002_ranking_by_city_and_grants
-- Ranking por ciudad + acceso de lectura del ranking para el cliente.
-- modelo-datos.md §11.3 · gamificacion.md §5
--
-- Contexto: mv_ranking_global ya existe (20260103000002_views.sql). Aquí se añade
-- la vista particionada por ciudad y se conceden los privilegios de lectura que
-- el cliente necesita. Las materialized views NO soportan RLS, pero ambas MV ya
-- excluyen filas privadas en su definición (ranking_visible = FALSE y
-- flagged_for_review = TRUE), por lo que exponer SELECT a `authenticated` no
-- filtra datos privados. El ranking requiere sesión: `anon` no recibe acceso.

-- ============================================================
-- Materialized view: mv_ranking_by_city
-- Como mv_ranking_global pero con posiciones recalculadas por ciudad.
-- modelo-datos.md §11.3
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_ranking_by_city AS
SELECT
  u.id,
  u.username,
  u.display_name,
  u.avatar_url,
  u.current_level,
  u.city_primary,
  u.total_octanos,
  u.octanos_this_month,
  ROW_NUMBER() OVER (PARTITION BY u.city_primary ORDER BY u.total_octanos DESC)      AS rank_total,
  ROW_NUMBER() OVER (PARTITION BY u.city_primary ORDER BY u.octanos_this_month DESC) AS rank_month
FROM public.users u
WHERE u.ranking_visible = TRUE
  AND u.flagged_for_review = FALSE
  AND u.city_primary IS NOT NULL;

-- Índice único requerido por REFRESH ... CONCURRENTLY. Cada usuario aparece una
-- sola vez (su city_primary), así que (id) es único.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ranking_by_city_id
  ON public.mv_ranking_by_city(id);

CREATE INDEX IF NOT EXISTS idx_mv_ranking_by_city_city_rank_total
  ON public.mv_ranking_by_city(city_primary, rank_total);

CREATE INDEX IF NOT EXISTS idx_mv_ranking_by_city_city_rank_month
  ON public.mv_ranking_by_city(city_primary, rank_month);

COMMENT ON MATERIALIZED VIEW public.mv_ranking_by_city IS
  'Ranking por ciudad. Refrescado por pg_cron cada 5 minutos. modelo-datos.md §11.3';

-- Programar refresh con pg_cron (cada 5 minutos)
SELECT cron.schedule(
  'refresh-ranking-by-city',
  '*/5 * * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_ranking_by_city; $$
);

-- ============================================================
-- Acceso de lectura del ranking (solo usuarios autenticados)
-- ============================================================
GRANT SELECT ON public.mv_ranking_global  TO authenticated;
GRANT SELECT ON public.mv_ranking_by_city TO authenticated;

-- El ranking requiere sesión: nos aseguramos de no exponerlo a anónimos.
REVOKE ALL ON public.mv_ranking_global  FROM anon;
REVOKE ALL ON public.mv_ranking_by_city FROM anon;
