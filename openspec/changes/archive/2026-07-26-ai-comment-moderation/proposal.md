## Why

Los comentarios de parkings se publican hoy sin ningún filtro de contenido más
allá de la longitud (1–500 caracteres) y un rate limit. Eso deja la comunidad
expuesta a insultos, spam, publicidad, datos personales (teléfonos, matrículas,
direcciones exactas) y charla fuera de tema, que degradan la utilidad de las
fichas de parking y la confianza en la comunidad. Queremos moderar cada
comentario con un agente de IA en el momento de publicarlo, aprovechando la
Edge Function `post-comment` que ya existe y el panel de administración ya en
producción para la revisión humana de los casos dudosos.

## What Changes

- **Puerta de moderación síncrona** en `post-comment`: antes de insertar, el
  comentario pasa por pre-filtros baratos (enlaces, flood, repetición) y luego
  por un clasificador de IA que devuelve un veredicto estructurado
  (`allow` / `reject` / `flag`).
- **Proveedor de IA desacoplado** tras `_shared/moderation.ts`, con un adaptador
  inicial para **DeepSeek** (API compatible con OpenAI, salida JSON). Cambiar de
  proveedor (p. ej. volver a Claude) será cambiar configuración, no lógica.
- **UX de "en revisión"**: mientras el agente evalúa, el cliente muestra un
  estado de carga ("Tu comentario está siendo revisado por nuestro agente de
  IA…") y, según el desenlace, un mensaje de publicado, rechazado con motivo, o
  pendiente de revisión.
- **BREAKING (comportamiento)**: publicar un comentario deja de ser inmediato e
  incondicional. Un comentario puede quedar `pending_review` (oculto al público)
  o ser rechazado (`reject`) y no crearse.
- **Nuevo estado de moderación** en `comments` (`moderation_status`:
  `approved` / `pending_review` / `rejected`) con RLS y cobertura pgTAP: el
  público solo ve `approved`; el autor ve además los suyos en `pending_review`;
  admin lo ve todo.
- **Fail-safe a revisión**: si el proveedor de IA cae, da timeout o devuelve algo
  no parseable, el comentario NO se aprueba por defecto — queda `pending_review`
  para moderación humana y se avisa al usuario.
- **Octanos diferidos**: los Octanos solo se acreditan cuando el comentario queda
  `approved`. Un comentario `pending_review` no acredita hasta que un admin lo
  aprueba.
- **Cola de moderación en el panel admin**: los comentarios `pending_review`
  (dudosos o no validables) se listan para que un administrador apruebe o rechace.
- **Off-topic sin tolerancia**: la charla ajena al parking/moto se rechaza.
- **Documentación**: PRD, README y el prompt de moderación versionado se
  actualizan en el mismo cambio.

## Capabilities

### New Capabilities
- `comment-moderation`: moderación de contenido de comentarios mediante IA en el
  momento de publicar — pre-filtros, veredicto estructurado del proveedor,
  máquina de estados de moderación, fail-safe a revisión humana y cola de
  moderación en el panel admin.

### Modified Capabilities
- `parking-comments`: la publicación pasa a estar condicionada por la puerta de
  moderación; el listado público solo muestra comentarios `approved`; la
  acreditación de Octanos se difiere hasta la aprobación.

## Impact

- **Edge Functions**: `supabase/functions/post-comment/` (integra la puerta),
  nuevo `supabase/functions/_shared/moderation.ts` (adaptador DeepSeek + contrato
  estructurado). Nueva Edge Function admin para aprobar/rechazar `pending_review`
  (o extensión de una existente del panel admin).
- **Base de datos**: migración que añade `comments.moderation_status` (+ índice
  parcial), ajuste de RLS de `comments`, y ajuste del RPC `process_comment` para
  diferir Octanos según el estado. Tests pgTAP.
- **Móvil/web**: `features/comments/` (estado de carga "en revisión", mensajes de
  rechazo/pendiente, filtrado por estado). `features/admin/` para la cola de
  moderación (solo web).
- **Secretos/infra**: `DEEPSEEK_API_KEY` como secret de Supabase; documentar en
  `docs/infraestructura.md`. Coste acotado por el rate limit (1/30s) y los
  pre-filtros.
- **Docs canónicos**: `docs/prd.md` (feature nueva), `docs/modelo-datos.md`
  (nuevo campo + estados), `docs/gamificacion.md` (Octanos diferidos),
  `docs/arquitectura.md` (proveedor IA en edge, decisión de residencia de datos),
  `docs/testing.md` (mock del clasificador), `docs/infraestructura.md` (secret),
  y `README`.

## Non-goals

- No se modera retroactivamente el histórico de comentarios ya publicados (solo
  aplica a los nuevos).
- No se implementa moderación asíncrona/en cola de fondo (Sistema B): la
  evaluación es síncrona en la petición de publicación.
- No se modera el contenido de otras entidades (propuestas de parking,
  verificaciones): solo comentarios de parkings.
- No se implementan apelaciones del usuario ni edición de comentarios rechazados.
- No se sustituye el rate limit ni el cap diario de Octanos existentes.
- No se añade multi-idioma; el prompt y los motivos son es-ES.
- **Gestión rica de comentarios en el panel admin** (borrar cualquier comentario,
  ver/restaurar rechazados, filtros, búsqueda, acciones en bloque y métricas de
  moderación) queda **fuera de alcance** y se difiere a una feature siguiente
  (`admin-comments-management`). Esta feature entrega solo la **cola mínima** de
  pendientes con aprobar/rechazar, lo justo para no dejar comentarios
  `pending_review` sin resolver.
