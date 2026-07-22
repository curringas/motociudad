## Why

Los parkings solo se pueden proponer y verificar, pero la comunidad no tiene
forma de dejar contexto útil ("hay cámara", "cabe solo scooter", "los findes se
llena"). El modelo de datos ya diseñó `comments` y `comment_votes`
(`modelo-datos.md` §6.6–6.7) y la gamificación ya reservó la acción
`useful_comment`, pero nunca se implementaron. Activar los comentarios completa
la capa colaborativa del MVP y da una palanca de retención barata: comentar no
requiere estar en el sitio, así que cualquiera puede aportar desde el sofá.

## What Changes

- **Nueva funcionalidad: comentar parkings.** Cualquier usuario registrado con
  email confirmado y no suspendido puede publicar comentarios (1–500 caracteres)
  en cualquier parking, **sin necesidad de estar en el lugar** (a diferencia de
  la verificación). Los comentarios se listan en el detalle del parking.
- **Votos en comentarios.** Los usuarios pueden votar (+1 / −1) los comentarios
  de otros; el recuento de upvotes se cachea en `comments.upvotes_count`.
- **Cambio de gamificación — escalera de primeros comentarios (NUEVO):**
  - **1er comentario elegible → +10 Octanos**, **2º comentario elegible → +5**,
    3º en adelante → 0 por posición.
  - *Elegible* = autor **distinto del proponente** del parking **y distinto de
    cualquier verificador** (evaluado en el momento de comentar). Los
    comentarios del proponente/verificadores se permiten pero dan 0 puntos y
    **no consumen puesto** en la escalera.
  - Los dos puestos de la escalera se otorgan a **autores distintos** (un mismo
    usuario no puede cobrar +10 y +5 en el mismo parking).
- **Gamificación — bonus por calidad (regla §2.1 existente, ahora activada):**
  un comentario que alcanza **≥2 upvotes** otorga **+5** (`useful_comment`).
- **Los bonus se acumulan**: un comentario puede cobrar por posición **y** por
  upvotes (mejor caso: 1er comentario con ≥2 upvotes = **+15**).
- **Anti-abuso**: el bonus respeta el cap diario de 200 Octanos, no lo cobran
  cuentas suspendidas, exige email confirmado, valida longitud del cuerpo y
  aplica rate limit por usuario. La eligibilidad se congela en el momento de
  comentar (**sin clawback** si el autor verifica el parking después).
- **Backend**: toda acreditación de Octanos ocurre en Edge Functions
  (`octano_events` nunca se escribe desde el cliente). Se añaden valores al enum
  `octano_action` para la escalera.

## Capabilities

### New Capabilities
- `parking-comments`: publicar, listar, votar y borrar (soft-delete) comentarios
  sobre parkings, y las reglas de Octanos asociadas (escalera de primeros
  comentarios +10/+5, bonus por upvotes +5, acumulación, anti-abuso y
  privacidad sin geolocalización).

### Modified Capabilities
<!-- Ninguna capability de openspec/specs/ cambia sus requisitos. El impacto en
     gamificación se refleja en el doc canónico docs/gamificacion.md, no en una
     spec de openspec existente. -->

## Impact

- **Base de datos**: nuevas tablas `comments` y `comment_votes` (RLS + policies +
  pgTAP en este cambio); nuevos valores en el enum `octano_action`
  (`first_comment` +10, `second_comment` +5); vista de detalle de parking podría
  exponer `comments_count`.
- **Edge Functions**: `post-comment` (inserta comentario + evalúa escalera +
  acredita Octanos) y `vote-comment` (registra voto + acredita `useful_comment`
  al cruzar ≥2 upvotes). Deno + Zod, patrón de `validate-verification`.
- **Móvil/Web**: nuevo slice `features/comments/` (api, hooks, schemas,
  components) integrado en la pantalla de detalle de parking; funciona en móvil
  (iOS/Android) y en la web de consulta.
- **Privacidad**: `comments` no almacena geolocalización (cumple la regla de
  privacidad por diseño).
- **Documentos canónicos a actualizar en este cambio**:
  - `docs/gamificacion.md` §2.1 (filas de la escalera 10/5 y matiz vs
    `useful_comment` +5) y §2.2 (nuevas reglas anti-abuso de comentarios).
  - `docs/prd.md` (comentarios pasan a estar en alcance del MVP).
  - `docs/modelo-datos.md` (confirmar schema de `comments`/`comment_votes` y los
    nuevos valores de `octano_action`).
  - `docs/testing.md` (cobertura pgTAP + Deno + componentes de la feature).

## Non-goals

- ❌ Comentarios anidados / hilos (respuestas a comentarios). Lista plana en MVP.
- ❌ Menciones (@usuario), adjuntos o imágenes en comentarios.
- ❌ Edición de comentarios por el autor (solo crear y soft-delete en MVP).
- ❌ Moderación automática de contenido (NLP/toxicidad); la moderación de
  cuerpos queda para admin/reportes en un cambio posterior.
- ❌ Notificaciones push por nuevos comentarios.
- ❌ Insignias de comunidad (`Comentarista`, `Mentor`): quedan documentadas pero
  su desbloqueo se implementa fuera de este cambio.
- ❌ Cualquier acreditación de Octanos desde el panel de administración.
