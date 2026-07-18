## ADDED Requirements

### Requirement: Listado, búsqueda y filtro de usuarios
El panel SHALL permitir a un admin listar los usuarios, buscarlos por texto
(`username` o `display_name`) y filtrarlos por rol. Los no-admins MUST NOT tener
acceso a esta sección.

#### Scenario: Admin lista los usuarios
- **WHEN** un admin abre la sección Usuarios del panel
- **THEN** ve la lista de usuarios

#### Scenario: Buscar usuarios por texto
- **WHEN** el admin introduce un texto de búsqueda
- **THEN** la lista se filtra por `username` o `display_name` coincidentes

#### Scenario: Filtrar por rol
- **WHEN** el admin filtra por un rol concreto
- **THEN** la lista muestra solo usuarios de ese rol

#### Scenario: Contributor no ve la sección Usuarios
- **WHEN** un contributor accede al panel
- **THEN** no ve ni puede abrir la sección Usuarios

### Requirement: Detalle de usuario
El panel SHALL mostrar a un admin el detalle de un usuario: perfil, rol, estado
(suspendido o no), nivel y Octanos.

#### Scenario: Ver detalle de un usuario
- **WHEN** un admin abre un usuario de la lista
- **THEN** ve su perfil, rol, estado de suspensión, nivel y Octanos

### Requirement: Cambiar rol y suspender desde el panel
El panel SHALL permitir a un admin cambiar el rol de un usuario y suspenderlo o
reactivarlo, aplicando el cambio a través de la Edge Function privilegiada.

#### Scenario: Admin cambia el rol de un usuario
- **WHEN** el admin selecciona un rol distinto para un usuario y confirma
- **THEN** el rol se actualiza y se refleja en el panel

#### Scenario: Admin suspende y reactiva
- **WHEN** el admin suspende a un usuario y luego lo reactiva
- **THEN** el estado `suspended` del usuario cambia en consecuencia
