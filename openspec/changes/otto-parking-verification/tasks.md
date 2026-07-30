## 1. Base de datos (migración + RLS + pgTAP)

- [x] 1.1 Migración: crear enum `parking_ai_review_status` (`approved`|`flagged`|`rejected`)
- [x] 1.2 Migración: añadir a `parkings` las columnas `ai_review_status` (NOT NULL default `'flagged'`), `ai_review_reason TEXT`, `ai_reviewed_at TIMESTAMPTZ`, `ai_review_source` (`prefilter`|`provider`|`failsafe`)
- [x] 1.3 Migración: backfill de las filas existentes (incluidos los importados de OSM y ya verificados) a `ai_review_status='approved'` para que no desaparezcan
- [x] 1.4 Migración: gatear visibilidad pública por `ai_review_status='approved'` en la vista `parkings_with_stats`/RPC `nearby_parkings` y/o RLS de lectura; mantener acceso del proponente a los suyos y del admin a todos
- [x] 1.5 Migración: gatear la verificación comunitaria (`verify-parking`) para que solo actúe sobre parkings `approved`
- [x] 1.6 Test pgTAP: RLS de visibilidad (`flagged`/`rejected` ocultos al público, visibles a proponente/admin) y que la verificación rechaza no-`approved`
- [ ] 1.7 Regenerar tipos TS (`pnpm gen:types`)

## 2. Proveedor de visión y SMTP (`_shared`)

- [x] 2.1 Añadir cliente de visión OpenAI-compatible en `supabase/functions/_shared/` (reutilizar el estilo de `moderation.ts`), con selector tipo `OTTO_PROVIDER`/`off` y timeout corto
- [x] 2.2 Definir el prompt versionado de Otto en `docs/prompts/otto-parking-verification.md` y cargarlo desde el shared
- [x] 2.3 Implementar pre-filtros deterministas (nombre/notas mínimamente coherentes) antes de llamar al proveedor
- [x] 2.4 Helper SMTP (Deno, p.ej. `denomailer`) en `_shared/` para enviar el aviso al admin, best-effort (try/catch)
- [ ] 2.5 Declarar secrets nuevos en Supabase (proveedor visión + SMTP host/puerto/usuario/clave + email admin) y documentarlos

## 3. Edge Function: gate de Otto en `propose-parking`

- [x] 3.1 Tras subir la foto/insertar, generar URL firmada de la imagen (si hay foto) y llamar a Otto (texto+visión; solo texto si no hay foto)
- [x] 3.2 Fijar `ai_review_status`/`ai_review_reason`/`ai_reviewed_at`/`ai_review_source` según el veredicto (con failsafe a `flagged` en error/timeout)
- [x] 3.3 Mover la creación del `octano_event` (+50 pending) para que solo ocurra cuando el veredicto es `approved`
- [x] 3.4 En `flagged`/`rejected`, enviar email best-effort al admin (no debe afectar al veredicto ni a la respuesta)
- [x] 3.5 Devolver al cliente el veredicto + mensaje (approved/flagged/rejected)
- [ ] 3.6 Test Deno de la función (approved/flagged/rejected, sin-foto, failsafe por timeout, email no bloqueante)

## 4. Edge Function admin: aprobar dudoso

- [x] 4.1 Nueva función (solo rol admin vía JWT/RLS) que sobre un `flagged`: pone `ai_review_status='approved'`, deja `parking_status='pending'` y crea el `octano_event` (+50 pending) de forma idempotente
- [ ] 4.2 Test Deno: aprobación otorga Octanos una sola vez; contributor/user no pueden; parking pasa a visible/verificable

## 5. Móvil (`features/parkings`)

- [x] 5.1 Spinner "Nuestro agente motero de IA Otto está verificando tu aportación…" durante el invoke de propuesta
- [x] 5.2 Mostrar el mensaje de veredicto (approved/rejected/flagged) según la respuesta, con los textos acordados
- [x] 5.3 Presenter: mapear `ai_review_status` para el estado visible al proponente (p.ej. badge "en revisión")
- [x] 5.4 Tests de componente (Vitest + @testing-library/react + RNW) de los tres veredictos y el estado de carga

## 6. Panel admin web (`features/admin`)

- [x] 6.1 Filtros nuevos en Parkings: "dudosos" (`flagged`), "rechazados" (`rejected`), "no verificados por usuarios" (`approved`+`pending`)
- [x] 6.2 Acción "Aprobar" en un parking `flagged` que llama a la función admin (4.1) y refresca el listado
- [x] 6.3 Usar tokens de tema válidos (tema claro del panel); estado de revisión visible en la fila
- [ ] 6.4 Tests de componente del filtro y de la acción aprobar

## 7. Documentación canónica

- [x] 7.1 `docs/prd.md`: describir el rol verificador de Otto y reconciliar con el "Otto scout" de descubrimiento (v1.6)
- [x] 7.2 `docs/modelo-datos.md`: nuevas columnas/enum y la relación ortogonal con `parking_status`
- [x] 7.3 `docs/gamificacion.md`: nuevo momento de otorgamiento de los +50 Octanos (al entrar a `pending`)
- [x] 7.4 `docs/infraestructura.md`: secrets nuevos (visión + SMTP)
- [x] 7.5 `docs/testing.md`: si aplica, notas de los tests nuevos

## 8. Verificación de cierre (regla obligatoria)

- [ ] 8.1 `pnpm typecheck` + `pnpm test` verdes
- [ ] 8.2 `supabase test db` (pgTAP) y `deno test` de las funciones verdes
- [ ] 8.3 Desplegar a Supabase Cloud (migración + funciones + secrets)
- [ ] 8.4 Verificación E2E multiplataforma vía `verify-all-platforms` (subagente `e2e-verifier`): app móvil = web (Playwright) + Android + iOS como usuario; panel admin = web como admin; con limpieza de datos de prueba y evidencia en `.claude/verify-runs/otto-parking-verification.md`
