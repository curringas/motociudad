## 1. Base de datos — enum y tablas

- [x] 1.1 Migración: añadir valores `first_comment` y `second_comment` al enum `octano_action` (migración atómica, solo enum)
- [x] 1.2 Migración: crear tabla `comments` (`modelo-datos.md` §6.6) con `id`, `parking_id`, `author_id`, `body` (CHECK 1–500), `upvotes_count`, `octanos_awarded`, `created_at`, `updated_at`, `deleted_at`, e índice `idx_comments_parking` (WHERE `deleted_at IS NULL`)
- [x] 1.3 Migración: crear tabla `comment_votes` (`modelo-datos.md` §6.7) con PK `(comment_id, user_id)` y CHECK `value IN (-1,1)`
- [x] 1.4 Migración: activar RLS y policies en `comments` (SELECT público de no borrados; sin INSERT/UPDATE/DELETE de cliente) y `comment_votes` (SELECT público; escritura solo vía Edge)

## 2. Base de datos — acreditación atómica

- [x] 2.1 Migración: índice único parcial en `octano_events` que garantice ≤1 evento por `(parking, posición)` para `first_comment`/`second_comment` (blindaje de carreras, design D4)
- [x] 2.2 Migración: RPC `SECURITY DEFINER` `process_comment` que inserta el comentario y, calculando el puesto sobre autores elegibles distintos, acredita `first_comment`/`second_comment` o 0, respetando el cap diario
- [x] 2.3 Migración: RPC/lógica de `useful_comment` idempotente (acredita +5 al cruzar ≥2 upvotes netos por primera vez; comprueba evento previo)
- [x] 2.4 Migración/vista: exponer `comments_count` en la vista de detalle de parking (evitar N+1)

## 3. Base de datos — tests pgTAP

- [x] 3.1 pgTAP: RLS de `comments` (lectura pública de no borrados; cliente no inserta)
- [x] 3.2 pgTAP: RLS de `comment_votes` (lectura pública; no auto-voto; escritura solo Edge)
- [x] 3.3 pgTAP: escalera de posición (1º +10, 2º +5 a autor distinto, 3º 0; proponente/verificador no consumen puesto; mismo autor no cobra ambos)
- [x] 3.4 pgTAP: cliente no puede insertar en `octano_events`; idempotencia de `useful_comment`; sin clawback tras soft-delete/verificación posterior

## 4. Edge Functions

- [x] 4.1 `post-comment`: auth (JWT) + email confirmado + no suspendido, validación Zod (1–500), reglas anti-abuso fail-fast (design D5), llamada a RPC `process_comment`, respuesta uniforme
- [x] 4.2 `post-comment`: rate limit por usuario (arranque: 1 comentario / 30 s) y `DAILY_CAP_REACHED` que publica el comentario sin acreditar
- [x] 4.3 `vote-comment`: auth + registro/actualización de voto (no auto-voto), recálculo de `upvotes_count`, acreditación idempotente de `useful_comment` al cruzar ≥2
- [x] 4.4 `soft-delete-comment` (o acción en la Edge): permite al autor borrar su comentario sin revertir Octanos
- [x] 4.5 Deno tests de las Edge Functions (camino feliz + cada regla anti-abuso, según `testing.md`)

## 5. Cliente móvil/web — feature comments

- [x] 5.1 `features/comments/schemas.ts`: schemas Zod de comentario, voto y respuestas
- [x] 5.2 `features/comments/api.ts`: llamadas a Supabase (lectura) y a las Edge Functions (post/vote/delete)
- [x] 5.3 `features/comments/hooks.ts`: hooks TanStack Query (`useParkingComments`, `usePostComment`, `useVoteComment`, `useDeleteComment`) con invalidación optimista
- [x] 5.4 `features/comments/components/`: `CommentList`, `CommentItem` (autor, cuerpo, upvotes, voto, borrar-si-propio), `CommentComposer` (input 1–500 + envío)
- [x] 5.5 Integrar comentarios en la pantalla de detalle de parking; verificar paridad web (react-native-web / .web.tsx si procede)
- [x] 5.6 Tests de componentes (Vitest + @testing-library/react + react-native-web) para lista, composer y estados loading/error/empty

## 6. Documentación canónica (mismo cambio)

- [x] 6.1 `docs/gamificacion.md` §2.1: añadir filas de la escalera (1er comentario +10, 2º +5) y aclarar la relación/acumulación con `useful_comment` +5
- [x] 6.2 `docs/gamificacion.md` §2.2 y §8: nuevas reglas anti-abuso de comentarios (email confirmado, rate limit, no clawback) y eventos `first_comment`/`second_comment`
- [x] 6.3 `docs/prd.md`: mover comentarios a alcance del MVP con su user story
- [x] 6.4 `docs/modelo-datos.md`: confirmar/ajustar schema de `comments`/`comment_votes` y documentar los nuevos valores de `octano_action`
- [x] 6.5 `docs/testing.md`: registrar cobertura pgTAP + Deno + componentes de la feature

## 7. Verificación y cierre

- [x] 7.1 `pnpm typecheck` verde y `gen:types` regenerado desde Cloud (reemplaza el stopgap manual)
- [x] 7.2 Suites verdes: `pnpm test` (94) + `deno test` (16). pgTAP no ejecutable local (CLI `.env`); en su lugar E2E de lógica contra Cloud (DO block rollback) cubriendo las 32 aserciones: escalera 10/5/0, elegibilidad, acumulación +15, idempotencia, self-vote/forbidden-delete, no-clawback → PASS
- [x] 7.3 E2E backend + HTTP contra las 3 Edge Functions desplegadas + E2E de UI en emulador Android (crear/votar/borrar comentario, banner de Octanos, gate de login). Pendiente no bloqueante: Maestro iOS + click-through web
- [x] 7.4 Desplegado a Cloud (4 migraciones + 3 Edge Functions + tipos + advisors sin issues nuevos) y commit/PR desde la rama `comentarios`. Pendiente no bloqueante: EAS Update (OTA) del cliente
