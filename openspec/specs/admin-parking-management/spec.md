# admin-parking-management Specification

## Purpose
Gestión de parkings en el panel de administración web (contributor + admin):
listar y filtrar (ciudad/estado), crear (sin otorgar Octanos), editar según
propiedad (contributor solo los suyos), gestionar imágenes y —solo admin—
verificar y borrar/archivar.
## Requirements
### Requirement: Listado y filtrado de parkings en el panel
El panel SHALL permitir a `contributor` y `admin` listar los parkings y filtrarlos
por ciudad y por estado. Los usuarios con rol `user` MUST NOT acceder a esta sección.

#### Scenario: Contributor y admin listan parkings
- **WHEN** un contributor o un admin abre la sección Parkings del panel
- **THEN** ve el listado de parkings con su información

#### Scenario: Filtrar por ciudad y estado
- **WHEN** se aplica un filtro de ciudad o de estado
- **THEN** el listado muestra solo los parkings que coinciden

#### Scenario: Rol user sin acceso
- **WHEN** un usuario con rol `user` intenta entrar al panel
- **THEN** se le deniega el acceso

### Requirement: Crear parking desde el panel
El panel SHALL permitir a `contributor` y `admin` crear parkings. La creación desde
el panel MUST NOT otorgar Octanos.

#### Scenario: Crear un parking
- **WHEN** un contributor o admin crea un parking desde el panel
- **THEN** el parking se registra con `proposed_by` = el creador

#### Scenario: Crear en el panel no da Octanos
- **WHEN** se crea un parking desde el panel
- **THEN** no se genera ningún evento de Octanos

### Requirement: Editar parking según propiedad
El sistema SHALL permitir a un `contributor` editar únicamente los parkings que él
creó (`proposed_by` = su id) y a un `admin` editar cualquiera. Un no-admin MUST NOT
poder cambiar el `status` de un parking.

#### Scenario: Contributor edita su propio parking
- **WHEN** un contributor edita campos de un parking que creó
- **THEN** los cambios se guardan

#### Scenario: Contributor no edita parkings ajenos
- **WHEN** un contributor intenta editar un parking que no creó
- **THEN** la operación es rechazada

#### Scenario: Contributor no puede cambiar el estado
- **WHEN** un contributor intenta cambiar el `status` de un parking
- **THEN** la operación es rechazada

#### Scenario: Admin edita cualquier parking
- **WHEN** un admin edita campos de cualquier parking
- **THEN** los cambios se guardan

### Requirement: Gestión de imágenes de parkings
El sistema SHALL permitir a un `contributor` añadir imágenes solo a sus propios
parkings y a un `admin` a cualquiera. Las imágenes se suben a Storage y se
registran en `parking_photos`.

#### Scenario: Contributor añade imagen a su parking
- **WHEN** un contributor añade una imagen a un parking que creó
- **THEN** la imagen se sube y se registra en `parking_photos`

#### Scenario: Contributor no añade imágenes a parkings ajenos
- **WHEN** un contributor intenta añadir una imagen a un parking que no creó
- **THEN** la operación es rechazada

### Requirement: Verificar y borrar parkings (solo admin)
El sistema SHALL permitir únicamente a un `admin` verificar (fijar `status`) y
borrar o archivar cualquier parking. La verificación desde el panel MUST NOT
otorgar Octanos ni usar el flujo comunitario `parking_verifications`.

#### Scenario: Admin verifica un parking
- **WHEN** un admin marca un parking como verificado
- **THEN** su `status` pasa a `verified`

#### Scenario: Verificar en el panel no da Octanos
- **WHEN** un admin verifica un parking desde el panel
- **THEN** no se genera ningún evento de Octanos

#### Scenario: Contributor no puede verificar
- **WHEN** un contributor intenta verificar un parking
- **THEN** la operación es rechazada

#### Scenario: Admin borra o archiva un parking
- **WHEN** un admin borra o archiva un parking
- **THEN** el parking deja de aparecer en el listado activo

