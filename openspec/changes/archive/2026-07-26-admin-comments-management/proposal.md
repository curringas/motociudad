## Why

El change `ai-comment-moderation` dejó en el panel admin una **cola mínima** de
comentarios `pending_review` (solo aprobar/rechazar). Ahora que la moderación IA
está en producción, los administradores necesitan una **gestión real** de
comentarios: revisar los dudosos, buscar entre todos, moderar en volumen y borrar
lo que no debe estar. Además, el panel admin ha ido creciendo por secciones con
estilos algo dispares; aprovechamos para unificar su **lenguaje visual**.

## What Changes

- **Gestión de comentarios en el panel admin (web)** que sustituye la cola mínima
  de `/admin/comments`:
  - Lista **solo los comentarios guardados**: `approved` + `pending_review` (los
    auto-rechazos de la IA se siguen sin persistir).
  - Pestañas **Pendientes (por defecto)** / **Aprobados** / **Todos**.
  - **Búsqueda** por texto del comentario, autor o parking + **filtro por ciudad**.
  - Listado **compacto** (fila de 2 líneas) con **paginación de servidor** (~25/pág).
  - **Selección múltiple** + **acciones en bloque** (Aprobar N / Eliminar N).
  - Acciones por estado: un **pendiente** se puede **Aprobar** (pasa a visible y
    acredita los Octanos diferidos) o **Eliminar**; un **aprobado** se puede
    **Eliminar**.
  - **BREAKING (gamificación)**: **Eliminar** desde el panel es **hard delete +
    retirada de Octanos** — se borra el comentario y sus `octano_events` y se
    recalcula el total del autor. (El soft-delete del propio autor sigue sin
    revertir Octanos.)
- **Rediseño visual de todo el panel admin** (web), como sistema de diseño común:
  - **Tema claro** (fondo blanco/gris suave, texto oscuro) con acento amarillo
    (#FFD60A) y badges de color. **Decisión consciente**: el panel admin es una
    superficie web aparte; la app móvil sigue en oscuro. Es una **excepción**
    explícita al "sin light theme" del MVP (que aplica a la app móvil).
  - Se mantiene la estructura **sidebar izquierda + contenido derecha**.
  - Se amplía el kit `features/admin/ui.tsx` (colores claros, filas compactas,
    tabs, chips, buscador, paginación, barra de acciones en bloque) y se aplica a
    **Parkings, Usuarios y Comentarios**.

## Capabilities

### New Capabilities
- `admin-comment-management`: gestión de comentarios en el panel admin — listado
  paginado y buscable de comentarios `approved`/`pending_review` con filtro por
  ciudad, aprobar/eliminar (individual y en bloque), y borrado administrativo con
  retirada de Octanos.

### Modified Capabilities
- `comment-moderation`: la "Cola de moderación en el panel de administración" pasa
  de una cola mínima (solo aprobar/rechazar los pendientes) a la gestión completa
  descrita en `admin-comment-management` (pestañas, búsqueda, filtro por ciudad,
  paginación y acciones en bloque).

## Impact

- **Cliente (web)**: `app/admin/comments.web.tsx` (pantalla rica), `features/admin`
  (api/hooks/schemas para listado paginado + acciones en bloque + borrado),
  `features/admin/ui.tsx` (kit visual claro: tabs, chips, buscador, fila compacta,
  paginación, barra de bloque, badges), y restyle de `parkings.web.tsx` /
  `users.web.tsx` + `_layout.web.tsx` al tema claro.
- **Edge Functions**: nueva `admin-delete-comment` (service_role + rol admin, hard
  delete + retirada de Octanos, individual y en bloque); posible variante en bloque
  de `admin-moderate-comment`.
- **BD**: RPC(s) para borrar comentario(s) retirando sus `octano_events` y
  recalculando el caché del autor; y consulta paginada/buscable (RPC o vista) que
  une comentario → autor → parking (ciudad). RLS admin ya permite ver
  `approved`/`pending_review`. pgTAP de la retirada de Octanos.
- **Docs**: `docs/prd.md` (feature + excepción de tema claro del panel),
  `docs/arquitectura.md` (tema claro del panel admin, kit `ui.tsx`),
  `docs/gamificacion.md` (retirada de Octanos al borrar por admin),
  `docs/modelo-datos.md`/`docs/testing.md` si aplica.

## Non-goals

- **Gestión de comentarios auto-rechazados por la IA**: siguen sin guardarse; esta
  feature no los persiste ni los lista.
- **Campo de código postal en parkings**: la búsqueda por ubicación es **solo por
  ciudad**; el código postal queda como mejora futura de parkings.
- **Tema claro en la app móvil**: la app móvil sigue en oscuro; el tema claro es
  exclusivo del panel admin web.
- **Purga/retención programada**: no hay job de limpieza; el borrado admin es
  definitivo (hard delete).
- **Restructurar la lógica** de Parkings/Usuarios: su rediseño es visual; su
  comportamiento y requisitos no cambian.
