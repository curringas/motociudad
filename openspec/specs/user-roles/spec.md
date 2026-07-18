# user-roles Specification

## Purpose
Modelo de roles de usuario (`user`/`contributor`/`admin`) y suspensión global de
cuenta, con las primitivas de autorización (`is_admin()`, `can_manage_parkings()`)
que aplican las policies RLS. El cambio de rol/suspensión solo se hace vía la Edge
Function privilegiada `admin-set-role`.
## Requirements
### Requirement: Modelo de roles de usuario
El sistema SHALL asignar a cada usuario exactamente uno de tres roles: `user`,
`contributor` o `admin`, con `user` como valor por defecto.

#### Scenario: Usuario nuevo recibe rol por defecto
- **WHEN** se crea una cuenta de usuario
- **THEN** su `role` es `user`

#### Scenario: Los roles son mutuamente excluyentes
- **WHEN** se consulta el rol de un usuario
- **THEN** devuelve un único valor de entre `user`, `contributor` o `admin`

### Requirement: Suspensión global de cuenta
El sistema SHALL permitir suspender a cualquier usuario con independencia de su
rol. Un usuario suspendido MUST quedar bloqueado para toda acción de escritura o
contribución y para el acceso al panel, conservando el acceso de solo lectura.

#### Scenario: Suspendido no puede contribuir en la app
- **WHEN** un usuario suspendido intenta proponer o verificar un parking
- **THEN** la operación es rechazada

#### Scenario: Suspendido no accede al panel
- **WHEN** un usuario suspendido (aunque su rol sea `admin` o `contributor`) intenta entrar al panel
- **THEN** se le deniega el acceso

#### Scenario: Suspendido conserva la lectura
- **WHEN** un usuario suspendido consulta el mapa o la lista de parkings
- **THEN** puede verlos con normalidad

### Requirement: Primitivas de autorización
El sistema SHALL exponer las funciones `is_admin()` y `can_manage_parkings()`, que
devuelven verdadero solo para el rol correspondiente y no suspendido, y las
policies RLS SHALL usarlas para autorizar.

#### Scenario: is_admin verdadero para admin activo
- **WHEN** se evalúa `is_admin()` para un admin no suspendido
- **THEN** devuelve verdadero

#### Scenario: is_admin falso para admin suspendido
- **WHEN** se evalúa `is_admin()` para un admin suspendido
- **THEN** devuelve falso

#### Scenario: can_manage_parkings para contributor activo
- **WHEN** se evalúa `can_manage_parkings()` para un contributor no suspendido
- **THEN** devuelve verdadero

### Requirement: Cambio de rol y suspensión restringido a admin
El sistema SHALL permitir cambiar el rol y suspender/reactivar únicamente a través
de una Edge Function privilegiada que verifique que el llamante es admin. Los
`UPDATE` directos de `role` o `suspended` desde el cliente MUST ser rechazados.

#### Scenario: Admin cambia el rol de un usuario
- **WHEN** un admin invoca la función de cambio de rol sobre otro usuario
- **THEN** el rol de ese usuario se actualiza

#### Scenario: No-admin no puede cambiar roles
- **WHEN** un usuario que no es admin invoca la función de cambio de rol
- **THEN** la operación es rechazada

#### Scenario: El cliente no puede auto-ascenderse
- **WHEN** un usuario intenta un `UPDATE` directo de su propio `role`
- **THEN** la RLS lo rechaza

