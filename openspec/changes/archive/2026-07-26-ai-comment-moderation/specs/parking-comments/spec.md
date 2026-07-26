## MODIFIED Requirements

### Requirement: Publicación de comentarios

El sistema SHALL permitir a un usuario autenticado, con email confirmado y no
suspendido, publicar comentarios de texto (1–500 caracteres) sobre cualquier
parking existente y comentable (estado `pending` o `verified`), **sin exigir
proximidad geográfica ni foto in situ**. La publicación de un comentario NO SHALL
persistir ninguna geolocalización del usuario. Todo comentario SHALL pasar por la
moderación (capability `comment-moderation`) antes de ser público: solo se crea
como visible (`approved`) si la moderación lo aprueba; puede quedar oculto en
revisión (`pending_review`) o ser rechazado sin crearse.

#### Scenario: Comentario válido y aprobado publicado

- **WHEN** un usuario autenticado con email confirmado y cuenta activa envía un
  comentario de 1–500 caracteres sobre un parking comentable y la moderación lo
  aprueba
- **THEN** el comentario se crea asociado al parking con su `author_id`, con estado
  `approved`, y queda visible en el detalle del parking

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

#### Scenario: Comentario en revisión no visible al público

- **WHEN** la moderación deja un comentario en `pending_review`
- **THEN** el comentario se crea pero no se muestra en el listado público del
  parking hasta que un administrador lo apruebe

### Requirement: Escalera de Octanos por primeros comentarios

El sistema SHALL otorgar Octanos por posición al primer y segundo comentario
**elegible y aprobado** de cada parking: **+10** al 1º (`first_comment`) y **+5**
al 2º (`second_comment`). Un comentario es *elegible* cuando su autor es distinto
del proponente del parking y distinto de cualquier verificador del parking en el
momento de comentar. La elegibilidad de posición y la acreditación SHALL evaluarse
en el momento en que el comentario pasa a estado `approved`, considerando
únicamente comentarios `approved`; un comentario en `pending_review` NO SHALL
acreditar Octanos ni consumir puesto en la escalera hasta ser aprobado. Los dos
puestos SHALL otorgarse a autores distintos: un mismo usuario no puede cobrar
ambos en el mismo parking. Del 3er comentario aprobado y elegible en adelante, la
posición otorga 0 Octanos. La acreditación de Octanos SHALL realizarse
exclusivamente vía Edge Function (nunca desde el cliente).

#### Scenario: Primer comentario elegible y aprobado

- **WHEN** un usuario elegible publica el primer comentario elegible de un parking
  y la moderación lo aprueba
- **THEN** recibe +10 Octanos (`first_comment`) y el comentario queda marcado como
  premiado por posición

#### Scenario: Segundo comentario elegible de otro autor

- **WHEN** un segundo usuario elegible, distinto del primero, publica un comentario
  aprobado en un parking cuyo primer puesto ya fue premiado
- **THEN** recibe +5 Octanos (`second_comment`)

#### Scenario: Comentario pendiente no consume puesto

- **WHEN** un comentario elegible queda en `pending_review` y otro usuario elegible
  publica después un comentario aprobado en el mismo parking
- **THEN** el comentario aprobado ocupa el puesto disponible de la escalera; el
  pendiente no consume puesto mientras siga en revisión

#### Scenario: Aprobación admin acredita en su momento

- **WHEN** un administrador aprueba un comentario elegible que estaba en
  `pending_review`
- **THEN** el sistema evalúa la escalera en ese momento (entre comentarios
  `approved`) y acredita el bonus de posición que corresponda, si queda puesto

#### Scenario: Tercer comentario en adelante

- **WHEN** un usuario elegible publica un comentario aprobado y ambos puestos de la
  escalera ya han sido premiados
- **THEN** el comentario se publica pero no otorga Octanos por posición

#### Scenario: Mismo autor no cobra ambos puestos

- **WHEN** el autor que ya recibió el bonus de 1º publica un segundo comentario
  aprobado en el mismo parking antes que ningún otro
- **THEN** ese segundo comentario no otorga el bonus de 2º (queda disponible para
  otro autor elegible)

### Requirement: Lectura y soft-delete de comentarios

El sistema SHALL exponer la lista de comentarios `approved` y no borrados de un
parking a cualquier usuario (lectura pública), ordenados de más reciente a más
antiguo, con su recuento de upvotes. Los comentarios en `pending_review` SHALL ser
visibles únicamente para su autor (y administradores); los `rejected` NO SHALL
mostrarse a usuarios no administradores. El autor de un comentario SHALL poder
borrarlo mediante soft-delete (`deleted_at`); los comentarios borrados NO SHALL
mostrarse en la lista. El soft-delete NO SHALL revertir los Octanos ya acreditados
por ese comentario.

#### Scenario: Listado público solo de aprobados

- **WHEN** cualquier usuario abre el detalle de un parking con comentarios
- **THEN** ve la lista de comentarios `approved` no borrados con autor, cuerpo y
  upvotes, y no ve los `pending_review` de otros ni los `rejected`

#### Scenario: Autor borra su comentario

- **WHEN** el autor solicita borrar su comentario
- **THEN** el comentario se marca con `deleted_at`, deja de listarse y los Octanos
  previamente acreditados se conservan
