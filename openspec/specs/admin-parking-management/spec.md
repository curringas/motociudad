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

### Requirement: Filter parkings by Otto AI review status
The panel SHALL allow `contributor` and `admin` to filter parkings by `ai_review_status`, with dedicated views for doubtful (`flagged`) and rejected (`rejected`) proposals, plus a view for approved-but-not-yet-community-verified parkings.

#### Scenario: Filter doubtful proposals
- **WHEN** an admin selects the "dudosos" filter
- **THEN** the list SHALL show only parkings with `ai_review_status='flagged'`

#### Scenario: Filter rejected proposals
- **WHEN** an admin selects the "rechazados" filter
- **THEN** the list SHALL show only parkings with `ai_review_status='rejected'`

#### Scenario: Filter approved-but-unverified-by-users
- **WHEN** an admin selects the "no verificados por usuarios" filter
- **THEN** the list SHALL show only parkings with `ai_review_status='approved'` AND `parking_status='pending'`

### Requirement: Admin approves a doubtful (flagged) parking
The system SHALL allow only an `admin` to approve a `flagged` parking, which publishes it into the community pipeline and awards the proposer's +50 pending Octanos. A `contributor` MUST NOT approve flagged parkings.

#### Scenario: Admin approves a flagged parking
- **WHEN** an admin approves a parking with `ai_review_status='flagged'`
- **THEN** its `ai_review_status` SHALL become `'approved'` and `parking_status` SHALL be `'pending'`
- **AND** an `octano_event` with `action_type='propose_parking'`, `points=50`, `status='pending'` SHALL be recorded for the proposer, exactly once (idempotent)
- **AND** the parking SHALL become publicly visible and community-verifiable

#### Scenario: Approving is idempotent
- **WHEN** an admin approves a parking that was already approved
- **THEN** no duplicate `octano_event` SHALL be created

#### Scenario: Contributor cannot approve flagged parkings
- **WHEN** a contributor attempts to approve a flagged parking
- **THEN** the operation SHALL be rejected

