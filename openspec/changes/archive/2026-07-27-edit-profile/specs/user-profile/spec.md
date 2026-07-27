## ADDED Requirements

### Requirement: Ver el perfil propio
El sistema SHALL mostrar en "Mi perfil" los datos de la fila `public.users` del usuario
autenticado: avatar (o iniciales si no tiene), nick (@handle público), nivel, ciudad principal
y resumen de Octanos. Además MUST mostrar el email de la cuenta en **solo lectura** (no se
edita ni se pierde). Si no hay avatar, MUST usar un marcador de posición con la inicial del
nick.

#### Scenario: Perfil con datos completos
- **WHEN** un usuario autenticado con avatar, nick y ciudad abre "Mi perfil"
- **THEN** ve su avatar, su nick, su nivel, su ciudad, sus Octanos y su email en solo lectura

#### Scenario: El email no es editable
- **WHEN** el usuario abre la edición de su perfil
- **THEN** el email se muestra pero no puede modificarse desde "Mi perfil"

#### Scenario: Perfil sin avatar
- **WHEN** un usuario sin avatar abre "Mi perfil"
- **THEN** ve un marcador con la inicial de su nick en lugar de una imagen

#### Scenario: Sin sesión
- **WHEN** un visitante sin sesión abre "Mi perfil"
- **THEN** se le invita a iniciar sesión o registrarse y no se muestran datos de perfil

### Requirement: Editar el nick (@handle) como identidad pública única
El sistema SHALL permitir al usuario cambiar su nick (@handle) desde "Mi perfil" mediante un
único campo "Nombre de usuario", **independiente del email**. Al guardar, ese valor MUST
escribirse a la vez en `username` y en `display_name`, de modo que sea el nombre visible en
ranking y en los comentarios (incluido el panel de administración). No SHALL existir límite de
frecuencia de cambios.

#### Scenario: Cambio de nick correcto
- **WHEN** el usuario introduce un nick válido y disponible y guarda
- **THEN** el sistema actualiza `username` y `display_name` con ese valor y lo refleja en el perfil

#### Scenario: El nick nuevo aparece en el ranking y los comentarios
- **WHEN** un usuario que figura en el ranking y ha comentado cambia su nick
- **THEN** tanto el ranking como sus comentarios (app y panel) pasan a mostrar el nuevo nick

### Requirement: Unicidad del nick insensible a mayúsculas
El sistema SHALL garantizar que el nick es único ignorando mayúsculas/minúsculas: dos
usuarios distintos MUST NOT poder tener nicks que difieran solo en capitalización. Un intento
de tomar un nick ya usado MUST rechazarse y mostrarse al usuario un mensaje claro sin exponer
detalles internos.

#### Scenario: Nick ya en uso con otra capitalización
- **WHEN** un usuario intenta guardar "Curro" y ya existe otro usuario con "curro"
- **THEN** la operación se rechaza y se muestra "Ese nick ya está en uso"

#### Scenario: El usuario reguarda su propio nick
- **WHEN** un usuario vuelve a guardar su perfil sin cambiar el nick
- **THEN** la operación se acepta (la unicidad no colisiona consigo mismo)

### Requirement: Validación de formato del nick
El sistema SHALL validar el formato del nick antes de guardarlo, tanto en cliente como en
base de datos: longitud entre 3 y 30 caracteres y solo letras, dígitos y los separadores
permitidos (`_`, `.`, `-`), sin espacios. Los valores fuera de formato MUST rechazarse con un
mensaje explicativo.

#### Scenario: Nick demasiado corto
- **WHEN** el usuario introduce un nick de menos de 3 caracteres
- **THEN** el sistema lo rechaza e indica el mínimo requerido

#### Scenario: Nick con caracteres no permitidos
- **WHEN** el usuario introduce un nick con espacios o símbolos no permitidos
- **THEN** el sistema lo rechaza e indica los caracteres válidos

### Requirement: Seleccionar la ciudad principal por autocompletar
El sistema SHALL permitir fijar la ciudad "Me suelo mover por…" eligiéndola de una lista de
sugerencias devueltas por la búsqueda de ciudades, no como texto libre sin validar. Al
seleccionar una sugerencia, el sistema MUST almacenar en `city_primary` una etiqueta canónica
("Ciudad, País") derivada de esa sugerencia, de forma que la misma ciudad se guarde igual con
independencia de cómo la escriba el usuario.

#### Scenario: Selección de una ciudad sugerida
- **WHEN** el usuario escribe "malaga", elige "Málaga, España" de las sugerencias y guarda
- **THEN** `city_primary` queda con la etiqueta canónica "Málaga, España"

#### Scenario: Normalización entre variantes de escritura
- **WHEN** dos usuarios escriben "MÁLAGA" y "malaga" y ambos eligen la misma sugerencia
- **THEN** ambos quedan con idéntico `city_primary` y comparten grupo en el ranking por ciudad

#### Scenario: Sin selección válida
- **WHEN** el usuario escribe texto que no corresponde a ninguna sugerencia y no elige ninguna
- **THEN** no se guarda ninguna ciudad (no se persiste texto libre sin validar)

### Requirement: Subir avatar restringido a imágenes
El sistema SHALL permitir al usuario subir un avatar desde su galería, restringido a archivos
de imagen. La imagen MUST re-codificarse y redimensionarse en el cliente antes de subirse
(descartando metadatos EXIF y cualquier carga incrustada), y almacenarse en el bucket de
Storage `avatars`. Al completarse, `avatar_url` MUST apuntar a la nueva imagen y el perfil
MUST mostrarla.

#### Scenario: Subida de un avatar válido
- **WHEN** el usuario selecciona una foto de su galería y confirma
- **THEN** la imagen se procesa, se sube a `avatars` y el perfil muestra el nuevo avatar

#### Scenario: Selección restringida a imágenes
- **WHEN** el usuario abre el selector de avatar
- **THEN** solo puede elegir imágenes (no vídeos ni otros tipos de archivo)

### Requirement: Endurecimiento del avatar en servidor
El bucket `avatars` SHALL imponer en servidor un tipo MIME de imagen (`image/jpeg`,
`image/png`, `image/webp`) y un tamaño máximo, de modo que una subida que no sea una imagen
válida o exceda el límite MUST ser rechazada aunque el cliente se salte sus validaciones.

#### Scenario: Archivo no-imagen rechazado por el servidor
- **WHEN** un cliente intenta subir a `avatars` un archivo cuyo MIME no es de imagen
- **THEN** Storage rechaza la subida

#### Scenario: Archivo demasiado grande
- **WHEN** un cliente intenta subir a `avatars` una imagen que excede el tamaño máximo
- **THEN** Storage rechaza la subida

### Requirement: Autorización de edición del perfil
El sistema SHALL permitir que cada usuario edite únicamente su propia fila y su propia carpeta
de avatar. Un usuario MUST NOT poder modificar el perfil de otro ni escribir avatares en la
carpeta de otro; los campos privilegiados (`role`, `suspended`) SHALL seguir bloqueados para
escritura directa desde el cliente.

#### Scenario: Edición del perfil ajeno rechazada
- **WHEN** un usuario intenta actualizar la fila `users` de otro usuario
- **THEN** RLS rechaza la operación

#### Scenario: Avatar en carpeta ajena rechazado
- **WHEN** un usuario intenta subir un avatar a la carpeta de otro usuario en `avatars`
- **THEN** la policy de Storage rechaza la subida

#### Scenario: Campos privilegiados intactos
- **WHEN** un usuario edita su perfil (nick, ciudad, avatar)
- **THEN** su `role` y su estado de suspensión permanecen sin cambios

### Requirement: Integridad de los campos de Octanos y nivel
El sistema MUST impedir que un usuario modifique por escritura directa sus propios campos de
gamificación cacheados (`total_octanos`, `octanos_this_month`, `current_level`) al actualizar
su fila, para que no pueda falsear el ranking. Estos campos SHALL cambiar únicamente desde la
lógica de servidor que mantiene el caché a partir de `octano_events`.

#### Scenario: Auto-edición de Octanos rechazada
- **WHEN** un usuario intenta actualizar su fila fijando un `total_octanos` mayor
- **THEN** la operación es rechazada

#### Scenario: Cambio de nivel manual rechazado
- **WHEN** un usuario intenta cambiar su `current_level` directamente
- **THEN** la operación es rechazada

#### Scenario: El servidor sí puede actualizar el caché
- **WHEN** los triggers del servidor recalculan Octanos tras un evento
- **THEN** `total_octanos`, `octanos_this_month` y `current_level` se actualizan con normalidad
