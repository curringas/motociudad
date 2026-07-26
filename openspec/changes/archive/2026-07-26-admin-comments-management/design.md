## Context

`ai-comment-moderation` (archivado) dejó: `comments.moderation_status`
(`approved`/`pending_review`/`rejected`), RLS que permite al admin ver todo,
Edge Function `admin-moderate-comment` (aprobar/rechazar vía RPC `moderate_comment`,
que acredita los Octanos diferidos al aprobar), y una **cola mínima** en
`app/admin/comments.web.tsx` (`features/admin/components/PendingCommentsQueue.tsx`)
que solo lista `pending_review`. El panel admin (solo web) usa el kit
`features/admin/ui.tsx` con una paleta **oscura** (`C`).

Esta change convierte esa cola en una **gestión completa** y, de paso, reestiliza
todo el panel a **tema claro**. Diseño (listado compacto de 2 líneas + panel en
claro) aprobado por el usuario con mockups.

## Goals / Non-Goals

**Goals:**
- Listar, buscar y paginar comentarios `approved`/`pending_review`; filtrar por
  ciudad; moderar en volumen (acciones en bloque).
- Borrado administrativo con retirada de Octanos, coherente y sin huérfanos.
- Un lenguaje visual claro y consistente en las 3 secciones del panel.

**Non-Goals:**
- Persistir/gestionar auto-rechazos de la IA; código postal; tema claro en la app
  móvil; job de purga; cambiar la lógica de Parkings/Usuarios (solo su estilo).

## Decisions

### D1 — Listado: RPC de búsqueda paginada (no PostgREST directo)
La búsqueda cruza **texto del comentario + autor + nombre del parking** y filtra
por **ciudad** (del parking), con **paginación** y **total**. Eso es incómodo con
PostgREST (OR entre tablas embebidas). Se crea un RPC de solo lectura
`admin_list_comments(p_status, p_city, p_search, p_limit, p_offset)`
(SECURITY DEFINER + `search_path` fijo) que valida `is_admin()` y devuelve
`{ rows: [...], total: N }`. Cada fila trae comentario + estado + fecha + upvotes +
autor (username/display_name) + parking (name, city). Orden: más reciente primero.
**Alternativa descartada:** vista + PostgREST — no resuelve bien el OR multi-tabla.

### D2 — Filtros y estados
`p_status ∈ { pending_review, approved, all }` (por defecto en el cliente:
`pending_review`). Solo se listan `approved` y `pending_review` (nunca `rejected`
ni borrados). `p_city` filtra por `parkings.city` con **búsqueda de texto (ILIKE,
match parcial)** — no un catálogo de ciudades en botones, porque pueden ser
cientos; el cliente usa un input de texto como en Parkings. `p_search` aplica ILIKE
sobre body, username, display_name y parking name.

### D3 — Aprobar (individual y en bloque)
Reutiliza `moderate_comment` (acredita Octanos diferidos, D3 del change anterior).
`admin-moderate-comment` acepta **uno o varios** `commentIds` + `action: approve`;
en bloque itera de forma atómica por id. Rechazo binario ya no se usa desde el
panel (el flujo es Aprobar / Eliminar).

### D4 — Eliminar = hard delete + retirada de Octanos
Nuevo RPC `admin_delete_comments(p_comment_ids uuid[])` (SECURITY DEFINER + fijo,
guard `is_admin()`):
1. Recolecta los autores afectados y los `octano_events` cuyo `metadata->>'comment_id'`
   o `reference_id` (useful_comment) apunta a esos comentarios.
2. **Borra esos `octano_events`** (libera además el puesto de escalera si era
   first/second_comment).
3. **Borra los comentarios** (`comment_votes` caen por FK ON DELETE CASCADE).
4. **Recalcula** `total_octanos`/`octanos_this_month` de los autores afectados
   desde `octano_events` confirmados (el trigger de caché es solo INSERT, así que
   el recálculo es explícito).
Se expone vía Edge Function `admin-delete-comment` (service_role + verificación de
rol admin), individual y en bloque (array). **Alternativa descartada:** soft-delete
— el usuario pidió hard delete y sin retención.

### D5 — Tema claro del panel (sistema de diseño en `ui.tsx`)
Se amplía `features/admin/ui.tsx` con una paleta **clara** (fondo blanco/gris
`#f8fafc`, superficie `#ffffff`, borde `#e2e8f0`, texto `#0f172a`, muted `#64748b`,
acento `#FFD60A`, badges suaves) y primitivas nuevas: `Tabs`, `Chips` (ya existe),
`SearchInput`, `CompactRow`, `Pagination`, `BulkBar`, `Badge` de estado/rol. Se
aplican en las 3 pantallas web (`parkings`, `users`, `comments`) manteniendo
**sidebar + contenido**. El tema claro del panel se documenta como **excepción**
consciente al "sin light theme" (que aplica a la app móvil).

### D6 — Paginación por offset
`p_limit`/`p_offset` con controles de página numerados (50/pág). Suficiente para el
volumen previsto; simple de implementar y con total exacto para "N–M de T".

## Risks / Trade-offs

- **Rendimiento de la búsqueda** (ILIKE sobre body/joins) a gran volumen → para el
  MVP es aceptable; mitigación futura: índice GIN `pg_trgm` sobre `body` y nombres.
  Se documenta, no se implementa ahora.
- **Retirada de Octanos incorrecta** (huérfanos o caché desincronizado) → el RPC
  hace borrado de eventos + recálculo en una transacción y hay pgTAP que lo cubre
  (borra evento, recalcula, verifica residuo cero, y que el puesto de escalera
  queda libre).
- **Regresiones del restyle** (tocar las 3 pantallas del panel) → cambio
  presentacional, sin tocar lógica; se verifica cada sección en la verificación
  E2E (solo web).
- **Consistencia visual con la app** → el panel claro convive con la app oscura;
  decisión intencionada y documentada; no se toca el tema de la app.
- **Acciones en bloque parciales** → cada operación en bloque es atómica a nivel de
  RPC (todo o nada) para evitar estados a medias.

## Migration Plan

1. Migración: RPCs `admin_list_comments` (lectura, filtro de ciudad por ILIKE) y
   `admin_delete_comments` (borrado + retirada de Octanos), con `REVOKE` a
   anon/authenticated y guard `is_admin()`. pgTAP de la retirada de Octanos.
2. Edge Functions: `admin-delete-comment` (nueva) y `admin-moderate-comment`
   (aceptar array para aprobar en bloque). Deploy a Cloud.
3. Ampliar `features/admin/ui.tsx` (paleta clara + primitivas) y reestilar
   `_layout.web.tsx`, `parkings.web.tsx`, `users.web.tsx`.
4. Nueva pantalla `comments.web.tsx` (tabs, buscador, filtro ciudad, filas
   compactas, selección múltiple, barra de bloque, paginación) sustituyendo la cola
   mínima; retirar/replegar `PendingCommentsQueue` a la nueva estructura.
5. Docs + verificación E2E (solo web: usuario normal denegado, admin gestiona).
6. **Rollback**: revertir el cliente al componente de cola mínima; los RPCs nuevos
   quedan inertes si no se llaman.

## Open Questions

- Filtro de ciudad: **resuelto** como búsqueda de texto (ILIKE), no catálogo.
- ¿Mostrar en el listado el motivo por el que un comentario quedó `pending_review`
  (flag vs fail-safe)? → útil pero opcional; se decide en implementación.
