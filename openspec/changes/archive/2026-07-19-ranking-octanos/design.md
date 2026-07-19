## Context

El tab "Ranking" (`app/(tabs)/ranking.tsx`) es hoy un placeholder. El backend global ya existe: la materialized view `public.mv_ranking_global` (migración `20260103000002_views.sql`) calcula `rank_total` y `rank_month` filtrando por `ranking_visible = TRUE` y `flagged_for_review = FALSE`, y se refresca por `pg_cron` cada 5 min. Falta la vista por ciudad, el acceso de lectura para el cliente y toda la capa de UI/estado. Este cambio implementa el consumo del ranking siguiendo el patrón de vertical slice del resto de features.

## Goals / Non-Goals

**Goals:**
- Pantalla de ranking funcional (podio + lista paginada + resaltado del usuario) para alcances Global y Por ciudad, con métricas Totales/Del mes.
- Feature slice `features/ranking/` completa y tipada, consumiendo TanStack Query v5.
- `mv_ranking_by_city` migrada con su cron y acceso seguro.
- Paridad web sin duplicar lógica (solo componentes `.web.tsx` donde el render difiera).
- Cobertura de tests: componentes (Vitest), pgTAP (acceso/privacidad), E2E (Maestro) del flujo básico.

**Non-Goals:**
- Ranking entre amigos (necesita `user_friendships`).
- UI de ajustes para el toggle `ranking_visible`.
- Realtime; el refresco por cron (≤5 min) es suficiente.

## Decisions

### 1. Acceso de lectura: GRANT directo sobre las MV, sin RLS
Las materialized views no soportan RLS. Como las MV **ya excluyen** filas privadas (`ranking_visible = FALSE`, `flagged_for_review = TRUE`) y solo exponen columnas públicas de perfil (`username`, `display_name`, `avatar_url`, `current_level`, `city_primary`, contadores de Octanos y posiciones), se concede `GRANT SELECT ... TO authenticated` directamente sobre `mv_ranking_global` y `mv_ranking_by_city`. Se **revoca** de `anon` (el ranking requiere sesión). El cliente lee vía PostgREST con `supabase.from('mv_ranking_global')`.
- **Alternativa descartada**: función `SECURITY DEFINER` envolvente. Añade complejidad sin beneficio, ya que las MV no contienen datos privados que filtrar por usuario.

### 2. `mv_ranking_by_city`: ROW_NUMBER particionado
```sql
CREATE MATERIALIZED VIEW public.mv_ranking_by_city AS
SELECT
  u.id, u.username, u.display_name, u.avatar_url, u.current_level, u.city_primary,
  u.total_octanos, u.octanos_this_month,
  ROW_NUMBER() OVER (PARTITION BY u.city_primary ORDER BY u.total_octanos DESC)      AS rank_total,
  ROW_NUMBER() OVER (PARTITION BY u.city_primary ORDER BY u.octanos_this_month DESC) AS rank_month
FROM public.users u
WHERE u.ranking_visible = TRUE AND u.flagged_for_review = FALSE AND u.city_primary IS NOT NULL;
```
Índice único sobre `(id, city_primary)` para permitir `REFRESH ... CONCURRENTLY`; índices sobre `(city_primary, rank_total)` y `(city_primary, rank_month)`. Cron separado `refresh-ranking-by-city` cada 5 min. Migración atómica (una idea): solo la MV de ciudad + índices + cron + grants.

### 3. Consulta y paginación (cliente)
- `api.ts`: `fetchRankingPage({ scope, metric, city, page, pageSize })`.
  - `scope='global'` → `from('mv_ranking_global')`; `scope='city'` → `from('mv_ranking_by_city').eq('city_primary', city)`.
  - `metric='total'` → `.order('rank_total')`; `metric='month'` → `.order('rank_month')`.
  - Paginación con `.range(from, to)` (pageSize 25). Selección de columnas explícita (sin `SELECT *`).
- `hooks.ts`: `useRanking(...)` con `useInfiniteQuery` (TanStack v5), `getNextPageParam` por longitud de página. `staleTime` ~5 min (alineado con el cron).
- `useCurrentUserRank(scope, metric, city)`: consulta puntual de la fila del usuario actual (por `id`) para resaltarla aunque no esté en la página cargada.

### 4. UI y estado de vista
- Estado efímero de la pantalla (scope/metric/ciudad seleccionada) en estado local de React o un pequeño store Zustand; **no** persiste.
- Componentes (uno por archivo, PascalCase):
  - `RankingScreen` (orquesta), `RankingScopeTabs` (Global/Ciudad), `RankingMetricToggle` (Totales/Mes), `RankingPodium` (top 3), `RankingList` + `RankingRow`, `RankingEmptyState`.
- Reutilizar tokens NativeWind existentes; `RankingRow` resalta cuando `row.id === session.user.id`.
- Web: `RankingScreen` renderiza igual salvo diferencias de layout → añadir `.web.tsx` solo si el podio necesita ajuste; evitar duplicar lógica de datos.

### 5. Tipos
Tras la migración, `pnpm gen:types` regenera `apps/mobile/types/database.ts` con la nueva MV. Los `schemas.ts` (Zod) validan la forma de fila del ranking en runtime y sirven de fuente para el tipo del dominio.

## Risks / Trade-offs

- **Ventana de desfase por cron (≤5 min)**: la posición mostrada puede ir ligeramente retrasada respecto a los Octanos reales. Aceptable para un ranking; se comunica implícitamente con `staleTime`.
- **`REFRESH CONCURRENTLY` requiere índice único**: hay que garantizarlo en `mv_ranking_by_city` (`(id, city_primary)`), o el refresco fallará o bloqueará lecturas.
- **Coste de MV grande a escala**: con muchos usuarios, el `ROW_NUMBER` global es O(n log n) cada 5 min. Aceptable en MVP; revisable con índices o refresco menos frecuente.
- **Privacidad**: el riesgo principal es exponer usuarios ocultos. Mitigado porque el filtro vive en la definición de la MV (no en el cliente) y se cubre con test pgTAP.
- **`anon` vs `authenticated`**: se decide requerir sesión. Si producto quiere ranking público, basta añadir GRANT a `anon` en un cambio posterior (la spec ya contempla el escenario).
