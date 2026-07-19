## Why

El ranking es una de las palancas de retención de la comunidad gamificada (Octanos), pero hoy la pantalla del tab "Ranking" es solo un placeholder "Próximamente". El backend global (`mv_ranking_global`) ya existe y se refresca por cron, así que la clasificación se está calculando pero no se muestra a nadie: falta toda la capa cliente para consumirla. Cerrar esta brecha activa una funcionalidad ya especificada (gamificacion.md §5) con coste principalmente de UI.

## What Changes

- **Nueva pantalla de Ranking funcional** que reemplaza el placeholder de `app/(tabs)/ranking.tsx`, con podio de top 3 + lista paginada y resaltado de la posición del usuario actual.
- **Dos vistas de métrica** (Octanos totales / Octanos del mes) conmutables, tal y como define gamificacion.md §5.2.
- **Alcance del ranking**: Global y Por ciudad. El **ranking entre amigos queda fuera** (ver Non-goals).
- **Feature slice `features/ranking/`**: `api.ts` (lectura Supabase), `hooks.ts` (TanStack Query v5), `schemas.ts` (Zod), `components/`.
- **Acceso de lectura seguro a las materialized views**: como las MV no soportan RLS, se expone la lectura mediante función SQL `SECURITY INVOKER` / vista envoltorio con GRANT explícito a `authenticated`, sin filtrar datos privados (las MV ya excluyen `ranking_visible = FALSE`).
- **Migración `mv_ranking_by_city`** (materialized view particionada por `city_primary`), hoy especificada en modelo-datos.md §11.3 pero no migrada, con su índice único, cron de refresco y GRANT.
- **Paridad web**: variantes `.web.tsx` de los componentes que lo requieran, coherente con el patrón de aislamiento por plataforma existente.

## Capabilities

### New Capabilities
- `ranking-octanos`: visualización de la clasificación de usuarios por Octanos (global y por ciudad), con vistas de totales y del mes, podio, lista paginada y resaltado del usuario actual, respetando la privacidad (`ranking_visible`).

### Modified Capabilities
<!-- Ninguna: las specs existentes (nearby-parkings, verify-parking, user-roles, etc.) no cubren ranking. -->

## Impact

- **Código nuevo**: `apps/mobile/features/ranking/` (api/hooks/schemas/components + `__tests__/`), `app/(tabs)/ranking.tsx` (reemplaza placeholder), posibles `*.web.tsx`.
- **Base de datos**: nueva migración para `mv_ranking_by_city` + su cron; función/vista de acceso de lectura y GRANT `SELECT` a `authenticated` sobre las MV de ranking. Tests pgTAP para acceso y privacidad.
- **Tipos**: regenerar `apps/mobile/types/database.ts` (`pnpm gen:types`) tras la migración.
- **Navegación**: el tab ya está enlazado (`app/(tabs)/_layout.tsx`); no cambia la estructura de tabs.
- **Sin cambios** en `octano_events` ni en el cálculo de Octanos (solo lectura del resultado ya materializado).

## Non-goals

- **Ranking entre amigos**: requiere una tabla `user_friendships` inexistente y flujo de opt-in mutuo; se pospone a un cambio posterior.
- **Toggle de privacidad `ranking_visible` desde ajustes**: la columna y el filtrado ya existen; la UI de ajustes para cambiarlo se aborda por separado.
- **Notificaciones o subidas de nivel derivadas del ranking**.
- **Realtime**: el ranking se refresca por cron (≤5 min); no se añade suscripción en tiempo real en este cambio.

## Impacto en documentos canónicos

- `docs/gamificacion.md` §5: marcar el ranking global/ciudad como implementado; aclarar que amigos queda pendiente.
- `docs/modelo-datos.md` §11.3: sustituir la descripción de `mv_ranking_by_city` por el SQL real migrado.
- `docs/testing.md`: registrar los nuevos tests (componentes Vitest, pgTAP de acceso/privacidad, y Maestro E2E si aplica).
- `docs/prd.md`: actualizar el estado de la feature de ranking en la matriz de funcionalidades.
