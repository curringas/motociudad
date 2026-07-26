## ADDED Requirements

### Requirement: Listado paginado de comentarios en el panel

El panel de administración (solo web) SHALL listar los comentarios **guardados**
—`approved` y `pending_review`— de forma paginada y ordenados de más reciente a más
antiguo, mostrando por cada uno su autor, el parking, la ciudad, el estado, la
fecha y los upvotes. El listado SHALL ofrecer un filtro por estado con las vistas
**Pendientes** (por defecto), **Aprobados** y **Todos**; un filtro por **ciudad**; y
una **búsqueda** de texto que aplique sobre el cuerpo del comentario, el autor y el
nombre del parking. El listado NO SHALL mostrar comentarios `rejected` ni borrados.
La operación SHALL restringirse a administradores.

#### Scenario: Vista por defecto muestra pendientes

- **WHEN** un administrador abre la sección de comentarios del panel
- **THEN** ve por defecto los comentarios en `pending_review`, paginados y con su
  autor, parking, ciudad, estado y fecha

#### Scenario: Filtrar por estado aprobados

- **WHEN** el administrador selecciona la vista "Aprobados"
- **THEN** el listado muestra solo comentarios `approved`

#### Scenario: Búsqueda por texto, autor o parking

- **WHEN** el administrador busca un término
- **THEN** el listado muestra los comentarios cuyo cuerpo, autor o nombre de parking
  coincide con el término

#### Scenario: Filtro por ciudad

- **WHEN** el administrador filtra por una ciudad
- **THEN** el listado muestra solo comentarios de parkings de esa ciudad

#### Scenario: Paginación

- **WHEN** hay más comentarios que el tamaño de página
- **THEN** el listado se pagina y muestra el total y la página actual

#### Scenario: No admin no accede

- **WHEN** un usuario sin rol admin intenta acceder al listado
- **THEN** el acceso se deniega

### Requirement: Aprobar comentarios pendientes (individual y en bloque)

El administrador SHALL poder aprobar uno o varios comentarios en `pending_review`.
Al aprobar, cada comentario SHALL pasar a `approved`, quedar visible y evaluarse su
acreditación de Octanos diferidos. El cambio de estado SHALL realizarse
exclusivamente vía Edge Function con `service_role` y verificación de rol admin.

#### Scenario: Aprobar un pendiente

- **WHEN** el administrador aprueba un comentario en `pending_review`
- **THEN** pasa a `approved`, queda visible y se evalúa su acreditación de Octanos

#### Scenario: Aprobar en bloque

- **WHEN** el administrador selecciona varios pendientes y pulsa aprobar
- **THEN** todos pasan a `approved` y se evalúa la acreditación de cada uno

#### Scenario: No admin no puede aprobar

- **WHEN** un usuario sin rol admin intenta aprobar un comentario
- **THEN** la operación se deniega

### Requirement: Eliminar comentarios con retirada de Octanos

El administrador SHALL poder **eliminar definitivamente** (hard delete) uno o
varios comentarios `approved` o `pending_review`. Al eliminar, el sistema SHALL
borrar los `octano_events` asociados a esos comentarios y **recalcular el total de
Octanos** de sus autores (retirada de Octanos), liberando además el puesto de la
escalera si el evento era de posición. El borrado SHALL realizarse exclusivamente
vía Edge Function con `service_role` y verificación de rol admin. La retirada de
Octanos por borrado administrativo SHALL aplicarse aunque el borrado por el **propio
autor** (soft-delete) siga sin revertir Octanos.

#### Scenario: Eliminar un aprobado que dio Octanos

- **WHEN** el administrador elimina un comentario `approved` que había acreditado
  Octanos a su autor
- **THEN** el comentario se borra, sus `octano_events` se eliminan y el total del
  autor se recalcula sin esos Octanos

#### Scenario: Eliminar libera el puesto de escalera

- **WHEN** el administrador elimina un comentario que ocupaba el 1er puesto
  (`first_comment`) de un parking
- **THEN** ese puesto queda libre para un futuro comentario elegible del parking

#### Scenario: Eliminar en bloque

- **WHEN** el administrador selecciona varios comentarios y pulsa eliminar
- **THEN** todos se borran y se retiran sus Octanos, recalculando los totales
  afectados

#### Scenario: No admin no puede eliminar

- **WHEN** un usuario sin rol admin intenta eliminar un comentario
- **THEN** la operación se deniega
