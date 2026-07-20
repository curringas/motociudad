# parking-comments Specification

## Purpose
Permitir a la comunidad publicar, votar y borrar (soft-delete) comentarios en los parkings —sin necesidad de estar en el lugar— y recompensarlo con Octanos: escalera de primeros comentarios (+10 el 1º elegible, +5 el 2º) acumulable con el bonus de calidad `useful_comment` (+5 al alcanzar ≥2 upvotes netos). Ver `docs/gamificacion.md` §2.3.
## Requirements
### Requirement: Publicación de comentarios

El sistema SHALL permitir a un usuario autenticado, con email confirmado y no
suspendido, publicar comentarios de texto (1–500 caracteres) sobre cualquier
parking existente y comentable (estado `pending` o `verified`), **sin exigir
proximidad geográfica ni foto in situ**. La publicación de un comentario NO SHALL
persistir ninguna geolocalización del usuario.

#### Scenario: Comentario válido publicado

- **WHEN** un usuario autenticado con email confirmado y cuenta activa envía un
  comentario de 1–500 caracteres sobre un parking comentable
- **THEN** el comentario se crea asociado al parking con su `author_id` y queda
  visible en el detalle del parking

#### Scenario: Comentar no requiere estar en el lugar

- **WHEN** el usuario publica un comentario desde cualquier ubicación
- **THEN** el sistema acepta el comentario sin comprobar distancia al parking y
  sin almacenar coordenadas del usuario

#### Scenario: Cuerpo fuera de rango rechazado

- **WHEN** el usuario envía un comentario vacío o de más de 500 caracteres
- **THEN** el sistema responde `VALIDATION_ERROR` y no crea el comentario

#### Scenario: Usuario no autenticado o sin email confirmado

- **WHEN** un usuario sin JWT válido, o con email sin confirmar, intenta comentar
- **THEN** el sistema rechaza la petición (`UNAUTHORIZED` / `INVALID_TOKEN` /
  `EMAIL_NOT_CONFIRMED`) y no crea el comentario

#### Scenario: Cuenta suspendida

- **WHEN** un usuario suspendido intenta comentar
- **THEN** el sistema responde `USER_SUSPENDED` y no crea el comentario

### Requirement: Escalera de Octanos por primeros comentarios

El sistema SHALL otorgar Octanos por posición al primer y segundo comentario
**elegible** de cada parking: **+10** al 1º (`first_comment`) y **+5** al 2º
(`second_comment`). Un comentario es *elegible* cuando su autor es distinto del
proponente del parking y distinto de cualquier verificador del parking en el
momento de comentar. Los dos puestos SHALL otorgarse a autores distintos: un
mismo usuario no puede cobrar ambos en el mismo parking. Del 3er comentario
elegible en adelante, la posición otorga 0 Octanos. La acreditación de Octanos
SHALL realizarse exclusivamente vía Edge Function (nunca desde el cliente).

#### Scenario: Primer comentario elegible

- **WHEN** un usuario elegible publica el primer comentario elegible de un parking
- **THEN** recibe +10 Octanos (`first_comment`) y el comentario queda marcado como
  premiado por posición

#### Scenario: Segundo comentario elegible de otro autor

- **WHEN** un segundo usuario elegible, distinto del primero, publica un comentario
  en un parking cuyo primer puesto ya fue premiado
- **THEN** recibe +5 Octanos (`second_comment`)

#### Scenario: Tercer comentario en adelante

- **WHEN** un usuario elegible publica un comentario y ambos puestos de la escalera
  ya han sido premiados
- **THEN** el comentario se publica pero no otorga Octanos por posición

#### Scenario: Mismo autor no cobra ambos puestos

- **WHEN** el autor que ya recibió el bonus de 1º publica un segundo comentario en
  el mismo parking antes que ningún otro
- **THEN** ese segundo comentario no otorga el bonus de 2º (queda disponible para
  otro autor elegible)

### Requirement: Elegibilidad de proponente y verificadores

Los comentarios del proponente del parking o de cualquier verificador SHALL
permitirse pero NO SHALL otorgar Octanos por posición, y NO SHALL consumir puesto
en la escalera. La elegibilidad SHALL evaluarse en el momento de comentar y NO
SHALL revertirse (sin clawback) si el autor pasa a verificar el parking después.

#### Scenario: Proponente comenta primero, externo cobra el 1º

- **WHEN** el proponente comenta y a continuación un usuario externo elegible
  publica el primer comentario elegible
- **THEN** el usuario externo recibe +10 (es el 1º elegible), y el comentario del
  proponente no otorga Octanos ni consume puesto

#### Scenario: Verificador comenta

- **WHEN** un usuario que ha verificado el parking publica un comentario
- **THEN** el comentario se publica con 0 Octanos por posición y sin consumir puesto

#### Scenario: Sin clawback tras verificar después

- **WHEN** un usuario recibe +10 por el 1er comentario elegible y más tarde
  verifica ese mismo parking
- **THEN** conserva los +10 Octanos ya acreditados

### Requirement: Votos y bonus de calidad

El sistema SHALL permitir a un usuario autenticado votar (+1 / −1) el comentario
de otro usuario, y NO SHALL permitir votar el comentario propio. Cuando un
comentario alcanza por primera vez ≥2 upvotes netos, el sistema SHALL otorgar
**+5** Octanos (`useful_comment`) a su autor, una única vez. Retirar votos por
debajo del umbral NO SHALL revertir el bonus ya otorgado.

#### Scenario: Comentario alcanza el umbral

- **WHEN** un comentario recibe su 2º upvote neto por parte de usuarios distintos
- **THEN** su autor recibe +5 Octanos (`useful_comment`) una sola vez

#### Scenario: No auto-voto

- **WHEN** un usuario intenta votar su propio comentario
- **THEN** el sistema rechaza el voto

#### Scenario: Bonus de calidad no se paga dos veces

- **WHEN** un comentario que ya otorgó `useful_comment` pierde y recupera upvotes
  cruzando de nuevo el umbral
- **THEN** no se acreditan Octanos adicionales por `useful_comment`

### Requirement: Acumulación de bonus de posición y calidad

El sistema SHALL acumular sobre un mismo comentario el bonus de posición
(first_comment / second_comment) y el bonus de calidad (useful_comment). Un
comentario que gana el 1er puesto y además alcanza ≥2 upvotes netos MUST otorgar
+15 Octanos en total a su autor.

#### Scenario: Primer comentario votado

- **WHEN** el autor del primer comentario elegible (+10) recibe además ≥2 upvotes
  netos (+5)
- **THEN** acumula +15 Octanos en total por ese comentario

### Requirement: Cap diario y rate limit

La acreditación de Octanos por comentarios SHALL respetar el cap diario de 200
Octanos por usuario; superado el cap, el comentario se publica pero no acredita
Octanos. El sistema SHALL aplicar un rate limit por usuario a la publicación de
comentarios para frenar spam.

#### Scenario: Cap diario alcanzado

- **WHEN** un usuario con ≥200 Octanos confirmados hoy publica un comentario que
  sería elegible para bonus
- **THEN** el comentario se publica pero no se le acreditan Octanos

#### Scenario: Rate limit superado

- **WHEN** un usuario publica comentarios por encima del límite permitido en la
  ventana reciente
- **THEN** el sistema responde `RATE_LIMITED` y no crea el comentario adicional

### Requirement: Lectura y soft-delete de comentarios

El sistema SHALL exponer la lista de comentarios no borrados de un parking a
cualquier usuario (lectura pública), ordenados de más reciente a más antiguo, con
su recuento de upvotes. El autor de un comentario SHALL poder borrarlo mediante
soft-delete (`deleted_at`); los comentarios borrados NO SHALL mostrarse en la
lista. El soft-delete NO SHALL revertir los Octanos ya acreditados por ese
comentario.

#### Scenario: Listado público

- **WHEN** cualquier usuario abre el detalle de un parking con comentarios
- **THEN** ve la lista de comentarios no borrados con autor, cuerpo y upvotes

#### Scenario: Autor borra su comentario

- **WHEN** el autor solicita borrar su comentario
- **THEN** el comentario se marca con `deleted_at`, deja de listarse y los Octanos
  previamente acreditados se conservan

### Requirement: Seguridad de las tablas de comentarios

Las tablas `comments` y `comment_votes` SHALL tener RLS activa con al menos una
policy y cobertura pgTAP. La escritura en `octano_events` derivada de comentarios
o votos SHALL realizarse únicamente vía Edge Function con `service_role`; el
cliente NO SHALL poder insertar en `octano_events`.

#### Scenario: Cliente no puede escribir octano_events

- **WHEN** un cliente autenticado intenta insertar directamente en `octano_events`
  un evento de comentario
- **THEN** RLS deniega la operación

#### Scenario: Lectura pública, escritura vía Edge

- **WHEN** un usuario anónimo lee comentarios y un usuario autenticado intenta
  insertar un comentario saltándose la Edge Function
- **THEN** la lectura se permite y la inserción directa desde el cliente se deniega
  por policy

