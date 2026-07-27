# public-user-profiles Specification

## Purpose
TBD - created by archiving change edit-profile. Update Purpose after archive.
## Requirements
### Requirement: Ver el perfil público de un usuario
El sistema SHALL permitir ver el perfil público de cualquier usuario mostrando su avatar (o
iniciales), su @nick, su ciudad, su nivel y sus Octanos. La lectura MUST apoyarse en la policy
`users_public_read` (lectura pública de la fila `users`), sin exponer campos privados.

#### Scenario: Abrir un perfil público
- **WHEN** un usuario abre el perfil público de otro usuario
- **THEN** ve su avatar, @nick, ciudad, nivel y Octanos

#### Scenario: Usuario sin avatar
- **WHEN** el perfil público pertenece a un usuario sin avatar
- **THEN** se muestra un marcador con la inicial de su @nick

### Requirement: Privacidad del perfil público
El perfil público SHALL respetar la preferencia `ranking_visible`. Si es `false`, el sistema
MUST ocultar los Octanos y la posición en el ranking del usuario, mostrando solo avatar, @nick
y ciudad.

#### Scenario: Usuario oculto del ranking
- **WHEN** se abre el perfil público de un usuario con `ranking_visible = false`
- **THEN** se muestran avatar, @nick y ciudad, pero no sus Octanos ni su posición

### Requirement: Navegación al perfil desde cualquier usuario
El sistema SHALL permitir abrir el perfil público al pulsar sobre la representación de un
usuario (avatar o @nick) en cualquier parte de la app pública: creador de un parking, autor de
un comentario, verificador y fila del ranking.

#### Scenario: Pulsar al autor de un comentario
- **WHEN** el usuario pulsa el avatar o el @nick del autor de un comentario
- **THEN** se abre el perfil público de ese autor

#### Scenario: Pulsar en una fila del ranking
- **WHEN** el usuario pulsa sobre una fila del ranking
- **THEN** se abre el perfil público de ese usuario

### Requirement: Autoría del parking visible
El detalle de un parking SHALL mostrar siempre la identidad de quien lo propuso: su avatar y
su @nick, pulsables para abrir su perfil público. La identidad MUST obtenerse uniendo
`parkings.proposed_by` con `users`.

#### Scenario: Detalle de parking con creador
- **WHEN** un usuario abre el detalle de un parking
- **THEN** ve el avatar y el @nick de quien lo propuso, pulsables

### Requirement: Autoría del comentario visible
Cada comentario SHALL mostrar el avatar y el @nick de su autor, pulsables para abrir su perfil
público. El avatar del autor ya se consulta en la lista de comentarios y MUST incluirse en el
modelo de vista y renderizarse.

#### Scenario: Comentario con avatar del autor
- **WHEN** se lista un comentario cuyo autor tiene avatar
- **THEN** se muestra su avatar junto a su @nick, ambos pulsables

#### Scenario: Autor sin nombre visible
- **WHEN** un comentario no tiene datos de autor (autor eliminado)
- **THEN** se muestra un marcador neutro sin enlace a perfil

### Requirement: Ver quién ha verificado un parking
El detalle de un parking SHALL ofrecer, desde el indicador de verificaciones, una lista (modal)
de los usuarios que lo han verificado, cada uno con su avatar y su @nick pulsables. La lista
MUST obtenerse uniendo `parking_verifications.verified_by` con `users` y MUST poder leerse
tanto por usuarios autenticados como anónimos (web pública).

#### Scenario: Abrir la lista de verificadores
- **WHEN** un usuario pulsa el contador de verificaciones de un parking verificado
- **THEN** se abre un modal con el avatar y el @nick de cada verificador

#### Scenario: Verificador pulsable
- **WHEN** el usuario pulsa un verificador en el modal
- **THEN** se abre el perfil público de ese verificador

#### Scenario: Parking sin verificaciones
- **WHEN** el parking no tiene verificaciones
- **THEN** el modal no está disponible o indica que aún no hay verificaciones

