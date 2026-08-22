## Context

`propose-parking` (Edge Function) inserta hoy un parking con `parking_status =
'pending'` y crea de inmediato un `octano_event` de +50 (pendiente); una foto
opcional se sube antes a Storage y se registra en `parking_photos`. La RLS de
`parkings` deja ver al público solo `status = 'verified'` (más los propios del
proponente); un parking pasa a `verified` cuando otro usuario lo verifica in situ
(trigger). No existe cribado de IA, ni infraestructura asíncrona (triggers/pg_net/
cron), ni envío de email, ni proveedor de visión.

La moderación de comentarios (`_shared/moderation.ts` + `post-comment`) es el
patrón de referencia: **síncrona**, proveedor **OpenAI-compatible** (DeepSeek,
solo texto), tres estados (`approved`/`pending_review`/`rejected`), failsafe a
revisión humana, y un badge in-app "en revisión por nuestro agente de IA".

## Goals / Non-Goals

**Goals:**
- Filtrar por IA (visión + texto) las aportaciones de parkings en el momento de
  proponer, sin bloquear al usuario ante lentitud o fallo (failsafe a `flagged`).
- Modelar la revisión de Otto como una dimensión **ortogonal** a la verificación
  comunitaria: dos ejes independientes que no se pisan.
- Diferir los +50 Octanos al momento en que el parking entra realmente a la cola
  pública `pending`.
- Dar al admin las tres búsquedas que pidió y una acción de aprobación.
- Avisar al admin por email de cada `flagged` y cada `rejected`.

**Non-Goals:**
- Cola asíncrona / triggers / cron (se mantiene síncrono como comentarios).
- Auto-hospedar modelos de visión.
- Re-verificar parkings existentes/importados de OSM.
- Notificar por email al proponente (solo mensajes in-app).

## Decisions

### D1 — Dos dimensiones independientes, no un enum ampliado
`ai_review_status` (nuevo enum `parking_ai_review_status`:
`approved`|`flagged`|`rejected`) vive junto a `parking_status`
(`pending`|`verified`|`rejected`|`archived`, sin tocar). Alternativa descartada:
añadir valores como `ai_flagged` al enum `parking_status` — mezclaría dos
conceptos que el usuario pidió explícitamente separados y rompería el trigger de
verificación comunitaria. Columnas nuevas en `parkings`: `ai_review_status`
(default `flagged` para que nada quede público por accidente si el gate no corre),
`ai_review_reason TEXT`, `ai_reviewed_at TIMESTAMPTZ`, `ai_review_source`
(`prefilter`|`provider`|`failsafe`).

### D2 — Gate síncrono dentro de `propose-parking`
La foto ya está en Storage antes del invoke, así que la función genera una URL
firmada y la pasa al proveedor de visión en la misma llamada. Alternativa
descartada: async con `pg_net`/webhook — introduce infraestructura inexistente y
diverge del patrón de comentarios. El veredicto vuelve en la misma respuesta
(sync), así que el "spinner + mensaje final" del cliente es el estado de carga y
la resolución de un único invoke.

### D3 — Visibilidad y verificación gateadas por `ai_review_status='approved'`
- RLS/vista pública (`nearby-parkings`): además de `status='verified'`, exigir
  `ai_review_status='approved'`.
- Verificación comunitaria (`verify-parking`): solo sobre parkings `approved`.
- El proponente ve siempre los suyos (cualquier `ai_review_status`) para poder
  mostrarle "en revisión"/"rechazado". El admin ve todos.
- Los `flagged`/`rejected` conservan `parking_status='pending'` a nivel de fila
  (valor por defecto), pero quedan fuera del pipeline porque el gate de
  visibilidad/verificación se apoya en `ai_review_status`.

### D4 — Octanos al entrar a `pending` público, no al insertar
El `octano_event` de +50 se crea (i) en `propose-parking` cuando Otto devuelve
`approved`, o (ii) en la función admin cuando se aprueba un `flagged`. Nunca en
`rejected`. Se mantiene el schedule existente que convierte el pendiente en
otorgado al verificarse comunitariamente.

### D5 — Proveedor de visión OpenAI-compatible
Se añade una rama de visión en `_shared/` reutilizando el estilo de llamada
OpenAI-compatible que ya usa `moderation.ts`. Se elige el tier económico con
visión: el más barato por token y menor coste de integración (mismo formato de
request). DeepSeek queda descartado (API pública solo texto). Sin foto → solo
texto. Prompt de Otto versionado en `docs/prompts/`.

### D6 — Email SMTP propio, best-effort
En `flagged`/`rejected`, la función envía un email vía SMTP propio
(`denomailer` u equivalente Deno) con try/catch: un fallo de email **no** cambia
el veredicto ni rompe la respuesta al usuario. Secrets: host/puerto/usuario/clave
+ destinatario admin.

### D7 — Acción admin "aprobar dudoso"
Nueva Edge Function admin (solo rol admin, vía RLS/JWT) que sobre un parking
`flagged`: pone `ai_review_status='approved'`, deja `parking_status='pending'` y
crea el `octano_event` de +50 (pendiente). Idempotente (no re-otorga si ya se
otorgó).

## Risks / Trade-offs

- **Latencia de visión en el invoke síncrono** → el failsafe a `flagged` en
  timeout/error evita bloquear al usuario; se fija un timeout corto (~4–6s como en
  moderación) y se degrada a "dudoso".
- **Coste del proveedor de visión** → despreciable a este volumen; aun así se usa
  el tier económico y se cachea/optimiza el tamaño de imagen enviado.
- **Falsos rechazos de Otto** (foto legítima marcada como no-parking) → el estado
  `rejected` no borra la fila; el admin puede revisarlo (email + filtro) y, si
  hiciera falta, reabrirlo. Se puede empezar conservador: ante duda → `flagged`,
  no `rejected`.
- **Default de columna** → `ai_review_status` default `flagged` (no `approved`)
  para que un parking nunca quede público si por cualquier razón el gate no marca
  estado.
- **Colisión de nombre "Otto"** con el scout de descubrimiento del roadmap v1.6 →
  se reconcilia en `prd.md` dándole a Otto el doble rol (verificar + descubrir) o
  acotando alcances; se documenta en el mismo cambio.
- **Fuga de secretos SMTP/visión** → solo en Edge Function (service_role), nunca
  en cliente; declarados como secrets de Supabase.

## Migration Plan

1. Migración: enum `parking_ai_review_status` + columnas en `parkings` (default
   `flagged`); backfill de las filas existentes a `approved` (los parkings ya
   publicados/importados no deben desaparecer). Ajuste de vista `nearby` y RLS de
   verificación. Test pgTAP.
2. `_shared/`: cliente de visión OpenAI-compatible + helper SMTP.
3. `propose-parking`: llamar a Otto, fijar `ai_review_status`, gatear el
   `octano_event`, enviar email en `flagged`/`rejected`.
4. Nueva función admin "aprobar dudoso".
5. Cliente móvil: spinner + 3 mensajes; presenter.
6. Panel admin: filtros + acción aprobar.
7. Secrets en Supabase (visión + SMTP).
8. Docs canónicos.
9. Verificación E2E multiplataforma (regla de cierre): web + Android + iOS como
   usuario, panel admin como admin.

**Rollback**: `ai_review_source`/`ai_review_status` son aditivos; si se desactiva
Otto (bypass tipo `MODERATION_PROVIDER=off`), `propose-parking` marca todo
`approved` y el comportamiento vuelve al actual. La migración no hace DROP.

## Open Questions

- Modelo exacto del proveedor de visión (confirmar que el tier económico elegido
  admite `image_url`) — se fija en implementación.
- ¿Umbral de "dudoso" vs "rechazado" en el prompt de Otto? Empezar conservador
  (preferir `flagged`) y calibrar con datos reales.
- ¿Reintento manual del proponente tras `rejected`, o solo vía admin? MVP: solo
  admin; reintento del usuario queda para iteración posterior.
