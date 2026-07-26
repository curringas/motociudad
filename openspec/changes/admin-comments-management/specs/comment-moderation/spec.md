## MODIFIED Requirements

### Requirement: Cola de moderación en el panel de administración

El panel de administración (solo web) SHALL ofrecer una **gestión de comentarios**
(capability `admin-comment-management`) que lista los comentarios `approved` y
`pending_review` de forma paginada y buscable, con la vista de **pendientes por
defecto**, filtro por ciudad y acciones individuales y en bloque. Un administrador
SHALL poder **aprobar** los `pending_review` (pasan a `approved`, quedan visibles y
se evalúa su acreditación de Octanos) y **eliminar** comentarios. El cambio de
estado y el borrado SHALL realizarse exclusivamente vía Edge Function con
`service_role` y verificación de rol admin; el cliente NO SHALL cambiar el estado
de moderación ni borrar comentarios directamente.

#### Scenario: Admin aprueba un comentario pendiente

- **WHEN** un administrador aprueba un comentario en `pending_review`
- **THEN** el comentario pasa a `approved`, queda visible y se evalúa su
  acreditación de Octanos

#### Scenario: Admin gestiona el listado

- **WHEN** un administrador abre la gestión de comentarios
- **THEN** ve por defecto los `pending_review`, y puede buscar, filtrar por ciudad,
  aprobar y eliminar (individual o en bloque)

#### Scenario: No admin no puede moderar

- **WHEN** un usuario sin rol admin intenta aprobar o eliminar un comentario
- **THEN** la operación se deniega
