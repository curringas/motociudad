## 1. Backend: migración `mv_ranking_by_city` y acceso

- [x] 1.1 Crear migración `supabase migration new ranking_by_city_and_grants` con la MV `mv_ranking_by_city` (ROW_NUMBER particionado por `city_primary`, ver design §2).
- [x] 1.2 Añadir índice único `(id, city_primary)` (necesario para `REFRESH CONCURRENTLY`) e índices `(city_primary, rank_total)` y `(city_primary, rank_month)`.
- [x] 1.3 Programar cron `refresh-ranking-by-city` (`*/5 * * * *`) con `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
- [x] 1.4 `GRANT SELECT` sobre `mv_ranking_global` y `mv_ranking_by_city` a `authenticated`; `REVOKE`/no conceder a `anon`.
- [x] 1.5 Aplicar la migración a Supabase Cloud (`supabase db push`) y verificar el refresco inicial de ambas MV.

## 2. Backend: tests pgTAP (acceso y privacidad)

- [x] 2.1 Test: rol `authenticated` puede leer ambas MV; rol `anon` NO puede.
- [x] 2.2 Test: un usuario con `ranking_visible = FALSE` no aparece en `mv_ranking_global` ni en `mv_ranking_by_city` tras refresco.
- [x] 2.3 Test: un usuario con `flagged_for_review = TRUE` queda excluido.
- [ ] 2.4 Ejecutar `supabase test db` en verde (recordar los GRANT a `authenticated`/`anon`, deuda conocida del CI de Supabase).

## 3. Tipos y schemas

- [x] 3.1 Regenerar tipos con `pnpm gen:types` y confirmar que aparecen `mv_ranking_by_city` y `mv_ranking_global` en `apps/mobile/types/database.ts`.
- [x] 3.2 Crear `features/ranking/schemas.ts` (Zod) con `RankingRowSchema`, `RankingScope`, `RankingMetric` y tipos derivados.

## 4. Feature slice: datos (api + hooks)

- [x] 4.1 `features/ranking/api.ts`: `fetchRankingPage({ scope, metric, city, page, pageSize })` con selección de columnas explícita (sin `SELECT *`), `.order(...)` por métrica y `.range(...)`.
- [x] 4.2 `features/ranking/api.ts`: `fetchCurrentUserRank({ scope, metric, city, userId })`.
- [x] 4.3 `features/ranking/hooks.ts`: `useRanking(...)` con `useInfiniteQuery` (getNextPageParam, `staleTime` ~5 min).
- [x] 4.4 `features/ranking/hooks.ts`: `useCurrentUserRank(...)`.
- [x] 4.5 Eliminar `features/ranking/__placeholder__.ts`.

## 5. Feature slice: UI (componentes)

- [x] 5.1 `RankingScopeTabs` (Global / Por ciudad) y `RankingMetricToggle` (Totales / Del mes).
- [x] 5.2 `RankingPodium` (top 3) y `RankingRow` (con resaltado del usuario actual).
- [x] 5.3 `RankingList` (lista paginada con carga incremental) y `RankingEmptyState`.
- [x] 5.4 `RankingScreen` que orquesta scope/metric/ciudad (estado efímero, no persiste) y compone lo anterior.
- [x] 5.5 Reemplazar el placeholder de `app/(tabs)/ranking.tsx` por `RankingScreen`.
- [x] 5.6 Añadir variantes `.web.tsx` solo donde el layout lo requiera (evitar duplicar lógica de datos).

## 6. Tests de cliente

- [x] 6.1 Tests de componentes en `features/ranking/__tests__/` (Vitest + @testing-library/react + react-native-web): render de podio, resaltado del usuario, cambio de métrica, estado vacío.
- [x] 6.2 Test de `api.ts`/`hooks.ts`: orden por métrica y paginación (mock de Supabase).
- [x] 6.3 Flujo E2E Maestro: abrir tab Ranking, alternar Global/Ciudad y Totales/Mes, ver lista.
- [x] 6.4 `pnpm typecheck` y `pnpm test` en verde.

## 7. Documentación (specs sincronizadas)

- [x] 7.1 `docs/modelo-datos.md` §11.3: sustituir la descripción por el SQL real de `mv_ranking_by_city`.
- [x] 7.2 `docs/gamificacion.md` §5: marcar Global/Ciudad como implementado; dejar Amigos como pendiente.
- [x] 7.3 `docs/testing.md`: registrar los nuevos tests (componentes, pgTAP, Maestro).
- [x] 7.4 `docs/prd.md`: actualizar el estado de la feature de ranking.

## 8. Verificación final

- [x] 8.1 Verificar en dispositivo/emulador: podio, lista, paginación, resaltado y cambio de métrica/alcance funcionan contra Supabase Cloud.
- [x] 8.2 Confirmar que un usuario oculto no aparece (prueba manual con cuenta de test).
- [ ] 8.3 CI (Mobile + Supabase) en verde.
