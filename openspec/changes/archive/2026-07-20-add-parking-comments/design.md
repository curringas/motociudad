## Context

Los comentarios ya estaban diseñados (`modelo-datos.md` §6.6–6.7:
`comments`, `comment_votes`) y la gamificación reservó `useful_comment` en el
enum `octano_action`, pero nunca se implementaron: no hay migración, ni Edge
Function, ni slice `features/comments/`. Este cambio los activa y añade una
mecánica nueva de gamificación (escalera de primeros comentarios) por encima de
la regla de calidad ya documentada.

El patrón de referencia es `validate-verification`: Edge Function que autentica
(JWT), valida con Zod, aplica reglas anti-abuso *fail-fast* y ejecuta la
escritura de `octano_events` dentro de una RPC atómica `SECURITY DEFINER`. Los
comentarios se diferencian de las verificaciones en dos puntos clave: **no
requieren geolocalización** (privacidad por diseño) y **cualquiera puede
publicar** (no hay geofence ni foto in situ).

## Goals / Non-Goals

**Goals:**
- Permitir publicar, listar, votar y soft-borrar comentarios en parkings, en
  móvil (iOS/Android) y en la web de consulta.
- Acreditar la escalera de primeros comentarios (+10 / +5) y el bonus de calidad
  (+5 por ≥2 upvotes), acumulables, exclusivamente vía Edge Function.
- Garantizar atomicidad e idempotencia de la acreditación (nunca pagar dos veces
  el mismo puesto ni el mismo bonus de upvotes).
- Cumplir las reglas no negociables: RLS + policy + pgTAP en las tablas nuevas;
  cliente nunca escribe `octano_events`; sin geolocalización almacenada.

**Non-Goals:**
- Hilos/respuestas anidadas, menciones, adjuntos, edición de comentarios.
- Moderación automática de contenido y notificaciones push.
- Desbloqueo de insignias `Comentarista` / `Mentor` (documentadas, fuera de este cambio).

## Decisions

### D1 — Dos Edge Functions (`post-comment`, `vote-comment`) en vez de triggers

Toda acreditación de Octanos pasa por Edge Function (regla no negociable). Se
crean dos:
- `post-comment`: autentica → valida cuerpo (Zod, 1–500) → reglas anti-abuso →
  RPC atómica que inserta el comentario y, si procede, el `octano_event` de
  posición.
- `vote-comment`: autentica → registra/actualiza el voto en `comment_votes` →
  recalcula `upvotes_count` → si cruza el umbral de ≥2 upvotes por primera vez,
  acredita `useful_comment` (+5) al **autor** del comentario.

**Alternativa descartada**: trigger en `comments`/`comment_votes` que llame a la
Edge Function vía `pg_net` (como `check_level_up`). Rechazada porque parte la
lógica de acreditación entre SQL asíncrono y Edge, complica la idempotencia y el
manejo de errores, y `pg_net` es best-effort (podría perder pagos).

### D2 — Escalera contada sobre autores elegibles distintos, snapshot en post-time

*Elegible* = `author_id ∉ {proposed_by} ∪ {verificadores actuales del parking}`.
El puesto se calcula contando cuántos **autores distintos** ya recibieron bonus
de posición en ese parking (`octano_events` con `action_type ∈
{first_comment, second_comment}` y `reference_type='comment'`, agrupando por
autor):
- 0 autores premiados → este es 1º → `first_comment` +10.
- 1 autor premiado (y el actual es distinto) → 2º → `second_comment` +5.
- ≥2, o autor ya premiado en este parking → 0 por posición.

La eligibilidad se evalúa **en el momento de comentar** (verificadores actuales).
**Sin clawback**: si el autor verifica el parking después, conserva el bonus.

**Alternativa descartada**: orden cronológico absoluto (proponente/verificador
consumen puesto). Rechazada por decisión de producto: premia la participación
externa real.

### D3 — Nuevos valores de enum `first_comment` (+10) y `second_comment` (+5)

Se añaden dos valores explícitos a `octano_action`, en línea con el estilo
`verify_parking` / `first_verifier`. `useful_comment` (+5) ya existe y se
reutiliza para el bonus de upvotes.

**Alternativa descartada**: un único `early_comment` con los puntos en
`metadata`. Rechazada porque rompe la legibilidad de las sumas por `action_type`
y la trazabilidad del baremo en `gamificacion.md`.

### D4 — Idempotencia y atomicidad vía RPC `SECURITY DEFINER` + índice único parcial

La acreditación de posición vive en una RPC transaccional (patrón
`process_parking_verification`). Para blindar carreras (dos usuarios comentan a
la vez, ambos leen "0 premiados"):
- Índice **único parcial** sobre `octano_events` que garantice ≤1 evento por
  `(reference_id de parking, posición)` — o equivalente `(parking, action_type)`
  para `first_comment`/`second_comment` — de modo que el 2º insert falle y se
  reintente recalculando el puesto.
- El bonus de upvotes es idempotente comprobando existencia previa de un
  `octano_events(action_type='useful_comment', reference_id=comment_id)` antes
  de insertar.

`comments.octanos_awarded` (ya en el schema diseñado) marca que el comentario
obtuvo bonus de **posición** (garantiza pago único por comentario en esa vía).

### D5 — Reglas anti-abuso (orden fail-fast en `post-comment`)

1. `UNAUTHORIZED` / `INVALID_TOKEN`: sin JWT válido.
2. `EMAIL_NOT_CONFIRMED`: `auth.users.email_confirmed_at` es null.
3. `USER_SUSPENDED`: cuenta suspendida (coherente con
   `harden_write_policies_suspended`).
4. `VALIDATION_ERROR`: cuerpo fuera de 1–500 caracteres.
5. `RATE_LIMITED`: más de N comentarios en la ventana reciente por usuario
   (parámetro configurable; arranque propuesto: máx. 1 cada 30 s).
6. `PARKING_NOT_FOUND` / `PARKING_ARCHIVED`: parking inexistente o no comentable.
7. `DAILY_CAP_REACHED`: ≥200 Octanos confirmados hoy → el comentario se publica
   pero **no** se acreditan Octanos (el comentario nunca se bloquea por el cap;
   solo el bonus). *(Decisión: comentar siempre se permite si pasa 1–6; el cap
   solo recorta el premio.)*

### D6 — RLS de `comments` y `comment_votes`

- `comments`: SELECT público (parkings son datos públicos, coherente con
  `rls_public_parkings`) filtrando `deleted_at IS NULL`; INSERT/UPDATE/DELETE
  desde cliente **denegados** (la escritura la hace la Edge Function con
  `service_role`) — o, alternativamente, INSERT propio permitido por RLS pero
  con la acreditación siempre en Edge. Se elige **escritura solo vía Edge** para
  centralizar anti-abuso, igual que verificaciones. Soft-delete del propio autor
  vía Edge/RPC.
- `comment_votes`: SELECT público del agregado; el voto se registra vía
  `vote-comment` (Edge). No se puede votar el propio comentario.

## Risks / Trade-offs

- **Inflación de Octanos por acumulación (+15 máx.)** → Mitigación: solo 2
  puestos por parking, cap diario 200, y el bonus de upvotes exige votos reales
  de ≥2 usuarios distintos.
- **Carrera al calcular el puesto de la escalera** → Mitigación: índice único
  parcial en `octano_events` + reintento dentro de la RPC (D4).
- **Farmeo con cuentas títere (sockpuppets)** para 1º/2º puesto y upvotes →
  Mitigación parcial en MVP: email confirmado + cap diario + rate limit +
  no auto-voto. Detección de patrones queda fuera de alcance.
- **Comentario que ganó puesto y luego se soft-borra** → El `octano_event`
  permanece (sin clawback) y el puesto sigue ocupado; la UI oculta el cuerpo.
  Trade-off aceptado para no permitir farmear borrando y recomentando.
- **`vote-comment` y recuento de upvotes** → El umbral se evalúa al cruzar ≥2
  por primera vez; retirar un voto por debajo de 2 **no** revierte el bonus
  (sin clawback), coherente con el resto del sistema.

## Migration Plan

1. Migración: enum — añadir `first_comment`, `second_comment` a `octano_action`
   (atómica, solo enum).
2. Migración: tablas `comments` + `comment_votes` con RLS activa + policies +
   índices (`idx_comments_parking`), según `modelo-datos.md` §6.6–6.7.
3. Migración: RPC `SECURITY DEFINER` de acreditación de posición + índice único
   parcial en `octano_events`; y (si aplica) columna/vista `comments_count`.
4. pgTAP: RLS de ambas tablas + reglas de la escalera + idempotencia.
5. Deploy Edge Functions `post-comment` y `vote-comment` (Deno + Zod) con tests.
6. Slice móvil/web `features/comments/` + integración en detalle de parking;
   envío por EAS Update (OTA) tras merge.
7. Actualizar docs canónicos (`gamificacion.md`, `prd.md`, `modelo-datos.md`,
   `testing.md`) en el mismo cambio.

**Rollback**: las Edge Functions y la UI se revierten sin tocar datos; las
tablas nuevas pueden quedar vacías sin impacto en el resto del sistema (los
enum values añadidos no se retiran — regla de no-DROP; quedan inertes).

## Open Questions

- Valor exacto del rate limit (arranque propuesto: 1 comentario / 30 s por
  usuario) — ajustar tras lanzamiento con datos reales.
- ¿Exponer `comments_count` como columna nueva en la vista de detalle o
  calcularlo en cliente? (Preferencia: en vista, evita N+1.)
- ¿El bonus de upvotes exige ≥2 upvotes **netos** (upvotes − downvotes) o ≥2
  upvotes brutos? (Propuesta: netos ≥2, para que los downvotes cuenten.)
