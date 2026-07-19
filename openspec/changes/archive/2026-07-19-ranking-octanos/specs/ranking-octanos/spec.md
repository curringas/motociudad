## ADDED Requirements

### Requirement: Ranking global de Octanos

El sistema SHALL mostrar una clasificación global de usuarios ordenada por Octanos, leyendo de la materialized view `mv_ranking_global`. La lista SHALL excluir a los usuarios con `ranking_visible = FALSE` o `flagged_for_review = TRUE` (garantizado por la propia MV).

#### Scenario: Usuario abre el ranking global

- **WHEN** un usuario autenticado abre el tab "Ranking" con el alcance "Global" seleccionado
- **THEN** el sistema muestra los usuarios ordenados de mayor a menor por la métrica activa, con su posición (`rank_total` o `rank_month`), nombre visible, avatar y nivel

#### Scenario: Usuario oculto no aparece

- **WHEN** un usuario tiene `ranking_visible = FALSE`
- **THEN** ese usuario NO aparece en ninguna posición de la lista, aunque siga acumulando Octanos

### Requirement: Ranking por ciudad

El sistema SHALL ofrecer una vista de ranking filtrada por ciudad, leyendo de la materialized view `mv_ranking_by_city` particionada por `city_primary`, con posiciones recalculadas dentro de cada ciudad.

#### Scenario: Usuario consulta el ranking de su ciudad

- **WHEN** un usuario selecciona el alcance "Por ciudad"
- **THEN** el sistema muestra por defecto el ranking de su `city_primary` con las posiciones relativas a esa ciudad

#### Scenario: Ciudad sin usuarios rankeables

- **WHEN** la ciudad seleccionada no tiene usuarios con `ranking_visible = TRUE`
- **THEN** el sistema muestra un estado vacío explicativo, sin error

### Requirement: Métricas conmutables (totales y del mes)

El ranking SHALL ofrecer dos métricas conmutables: "Octanos totales" (`total_octanos`, `rank_total`) y "Octanos del mes" (`octanos_this_month`, `rank_month`). La métrica seleccionada SHALL determinar el orden y la posición mostrada.

#### Scenario: Cambio de métrica

- **WHEN** el usuario cambia de "Totales" a "Del mes"
- **THEN** el sistema reordena la lista por `octanos_this_month` y muestra `rank_month` como posición

### Requirement: Podio y resaltado del usuario actual

El sistema SHALL destacar visualmente el top 3 (podio) y SHALL resaltar la fila del usuario autenticado cuando aparezca en la lista.

#### Scenario: El usuario actual está en la lista

- **WHEN** el usuario autenticado tiene `ranking_visible = TRUE` y aparece en el ranking activo
- **THEN** su fila se resalta visualmente respecto al resto

#### Scenario: El usuario actual está oculto

- **WHEN** el usuario autenticado tiene `ranking_visible = FALSE`
- **THEN** no se resalta ninguna fila propia y opcionalmente se le informa de que está oculto del ranking

### Requirement: Paginación de la lista

El sistema SHALL paginar la lista de ranking para no cargar todos los usuarios de golpe, cargando páginas adicionales bajo demanda (scroll infinito o botón "cargar más").

#### Scenario: Carga incremental

- **WHEN** el usuario llega al final de la página actual del ranking
- **THEN** el sistema solicita y anexa la siguiente página manteniendo el orden

### Requirement: Acceso de lectura seguro a las materialized views

Como las materialized views no soportan RLS, el sistema SHALL exponer el acceso de lectura al ranking mediante GRANT explícito de `SELECT` al rol `authenticated` (y no exponer datos privados, dado que las MV ya filtran por `ranking_visible`). El cliente SHALL leer el ranking solo de estas vistas, nunca de la tabla `users` directamente para este fin.

#### Scenario: Cliente autenticado lee el ranking

- **WHEN** un cliente autenticado consulta la vista de ranking
- **THEN** la consulta devuelve las filas visibles sin exponer columnas sensibles de `users`

#### Scenario: Cliente anónimo

- **WHEN** un cliente sin autenticar intenta leer el ranking
- **THEN** el acceso se deniega (el ranking requiere sesión), salvo decisión explícita de producto de hacerlo público
