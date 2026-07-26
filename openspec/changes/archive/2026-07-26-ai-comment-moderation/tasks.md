## 1. Base de datos y RLS

- [x] 1.1 Migración: añadir `comments.moderation_status` (`approved` | `pending_review` | `rejected`) con DEFAULT `'approved'` y backfill del histórico a `approved`
- [x] 1.2 Índice parcial para el listado por parking filtrando `moderation_status = 'approved' AND deleted_at IS NULL`
- [x] 1.3 Actualizar RLS de `comments`: SELECT público solo `approved`; autor ve sus `pending_review`; admin ve todo; `rejected` oculto a no-admin
- [x] 1.4 Actualizar `parkings_with_stats` para que el contador de comentarios cuente solo `approved`
- [x] 1.5 Tests pgTAP de la nueva RLS y del contador (público / autor / admin / rejected)

## 2. Gamificación (Octanos diferidos)

- [x] 2.1 Ajustar RPC `process_comment`: insertar con el `moderation_status` resultante y acreditar Octanos SOLO cuando el estado sea `approved`
- [x] 2.2 RPC/función de aprobación admin que, al pasar a `approved`, evalúa la escalera (entre comentarios `approved`) y acredita el bonus de posición si queda puesto
- [x] 2.3 Tests pgTAP: `pending_review` no acredita ni consume puesto; aprobación posterior acredita según puesto disponible; sin doble pago

## 3. Proveedor de IA (desacoplado)

- [x] 3.1 `supabase/functions/_shared/moderation.ts`: interfaz `moderateComment(text): Promise<Verdict>` + selección por `MODERATION_PROVIDER` (default `deepseek`, `off` = bypass)
- [x] 3.2 Adaptador DeepSeek (API compatible OpenAI, `response_format` JSON) con timeout corto y 0 reintentos
- [x] 3.3 `moderation-prompt.ts`: prompt es-ES con las reglas de contenido (rechazo duro + protección de crítica honesta + off-topic sin tolerancia)
- [x] 3.4 Esquema Zod del veredicto (`decision`/`categories`/`reason_es`/`confidence`) + validación; veredicto inválido = fallo
- [x] 3.5 Pre-filtros deterministas (enlaces/URLs, flood/repetición, mayúsculas) que cortan antes de llamar al proveedor
- [x] 3.6 Tests Deno: pre-filtros deterministas; mapeo verdict→efecto; fail-safe con proveedor mockeado (caída/timeout/no-parseable → `pending_review`)

## 4. Edge Functions

- [x] 4.1 Integrar la puerta en `post-comment`: pre-filtros → proveedor → estado, respetando auth/email/suspendido/rate-limit ya existentes
- [x] 4.2 Respuestas al cliente: `approved` (publicado), `reject` (422 + `reason_es`), `pending_review` (en revisión)
- [x] 4.3 Edge Function `admin-moderate-comment` (service_role + verificación rol admin) para aprobar/rechazar `pending_review`
- [x] 4.4 Tests Deno de `admin-moderate-comment` (aprobar/rechazar, no-admin denegado)

## 5. Móvil / Web (features/comments)

- [x] 5.1 Estado de carga "⏳ Tu comentario está siendo revisado por nuestro agente de IA…" durante la publicación
- [x] 5.2 Mensajes de resultado: publicado / rechazado con motivo / pendiente de revisión
- [x] 5.3 Mostrar al autor sus comentarios `pending_review` con distintivo "en revisión"; el listado público solo `approved`
- [x] 5.4 Tests de componente (Vitest + @testing-library/react + RNW) de los tres estados

## 6. Panel admin (solo web) — cola mínima

<!-- Solo lo imprescindible para no dejar pendientes huérfanos. La gestión rica
     (borrar/restaurar/filtros/métricas) se difiere a la feature admin-comments-management. -->

- [x] 6.1 Cola de moderación: listado de comentarios `pending_review` con acciones aprobar/rechazar
- [x] 6.2 Wiring a `admin-moderate-comment` + invalidación de queries
- [x] 6.3 Tests de componente de la cola (aprobar/rechazar, estados vacíos)

## 7. Infra y secretos

- [x] 7.1 Fijar secrets `DEEPSEEK_API_KEY` y `MODERATION_PROVIDER` en Supabase (no en cliente)
- [x] 7.2 Desplegar migración, RPCs y Edge Functions a Cloud
- [x] 7.3 Regenerar tipos TS (`pnpm gen:types`) y pasar `pnpm typecheck`

## 8. Documentación (cierre)

- [x] 8.1 `docs/prd.md`: feature de moderación IA de comentarios
- [x] 8.2 `docs/modelo-datos.md` (nuevo campo + estados), `docs/gamificacion.md` (Octanos diferidos), `docs/arquitectura.md` (proveedor IA en edge + decisión de residencia de datos), `docs/testing.md` (mock del clasificador), `docs/infraestructura.md` (secret)
- [x] 8.3 README: sección de moderación IA
- [x] 8.4 Documentar el prompt de moderación versionado (docs/prompts)

## 9. Verificación de cierre (obligatoria)

- [x] 9.1 Ejecutar `verify-all-platforms` (subagente `e2e-verifier`): app móvil → web (Playwright) + Android + iOS; panel admin → solo web; logueado como usuario y como admin
- [x] 9.2 Cubrir casos: comentario limpio (allow), tóxico/PII/off-topic (reject), dudoso (flag → cola admin), fallo del proveedor (fail-safe → pending_review), aprobación/rechazo admin y acreditación de Octanos
- [x] 9.3 Limpiar datos de prueba y dejar evidencia en `.claude/verify-runs/ai-comment-moderation.md`
