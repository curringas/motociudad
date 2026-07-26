## 1. Base de datos (RPCs + pgTAP)

- [x] 1.1 RPC `admin_list_comments(p_status, p_city, p_search, p_limit, p_offset)` (SECURITY DEFINER + search_path fijo, guard `is_admin()`): devuelve `{ rows, total }` con comentario + estado + fecha + upvotes + autor + parking(name, city); solo `approved`/`pending_review`; orden reciente
- [x] 1.2 RPC `admin_delete_comments(p_comment_ids uuid[])` (SECURITY DEFINER + fijo, guard `is_admin()`): borra `octano_events` de esos comentarios, borra los comentarios (votes por cascade) y recalcula `total_octanos`/`octanos_this_month` de los autores afectados
- [x] 1.3 RPC ligero de ciudades distintas para el autocompletado (o reutilizar consulta existente)
- [x] 1.4 `REVOKE EXECUTE` a anon/authenticated en los RPCs nuevos
- [x] 1.5 pgTAP: `admin_delete_comments` retira Octanos (borra eventos + recalcula, residuo cero, libera puesto de escalera); `admin_list_comments` filtra por estado/ciudad/búsqueda y pagina

## 2. Edge Functions

- [x] 2.1 Nueva `admin-delete-comment` (service_role + verificación rol admin): borra 1..N comentarios vía `admin_delete_comments`
- [x] 2.2 `admin-moderate-comment`: aceptar `commentIds` (1..N) para **aprobar en bloque** (además del caso individual)
- [x] 2.3 Tests Deno de schemas (delete: array de UUIDs; moderate: acción + ids)

## 3. Kit visual claro (features/admin/ui.tsx)

- [x] 3.1 Paleta CLARA (`C` light: fondo `#f8fafc`, superficie `#ffffff`, borde `#e2e8f0`, texto `#0f172a`, muted `#64748b`, acento `#FFD60A`) y badges suaves (estado y rol)
- [x] 3.2 Primitivas: `Tabs`, `SearchInput`, `CompactRow`, `Pagination`, `BulkBar`, `Badge` (reutilizar `Card`/`Button`/`Chips`)
- [x] 3.3 Tests de componente de las primitivas nuevas (Vitest + @testing-library/react + RNW)

## 4. Pantalla de comentarios (solo web)

- [ ] 4.1 `features/admin` api/hooks/schemas: listado paginado (`admin_list_comments`), aprobar (individual/bloque), eliminar (individual/bloque), ciudades para el filtro
- [ ] 4.2 `app/admin/comments.web.tsx`: tabs (Pendientes por defecto/Aprobados/Todos), buscador, filtro por ciudad, filas compactas de 2 líneas con badges y votos, selección múltiple + barra de bloque, paginación
- [ ] 4.3 Sustituir/replegar `PendingCommentsQueue` a la nueva estructura; invalidación de queries tras aprobar/eliminar
- [ ] 4.4 Tests de componente del listado (filas, estados vacíos, selección múltiple, acciones)

## 5. Restyle del resto del panel (tema claro)

- [ ] 5.1 `app/admin/_layout.web.tsx`: sidebar + contenido en claro (manteniendo estructura y guardas de rol)
- [ ] 5.2 `app/admin/parkings.web.tsx`: aplicar el kit claro (sin cambiar lógica)
- [ ] 5.3 `app/admin/users.web.tsx`: aplicar el kit claro (sin cambiar lógica)
- [ ] 5.4 Revisar contraste/legibilidad en claro de todas las secciones

## 6. Infra y tipos

- [ ] 6.1 Desplegar RPCs y Edge Functions a Cloud
- [ ] 6.2 Regenerar tipos TS (`pnpm gen:types`) y pasar `pnpm typecheck`
- [ ] 6.3 Suite Vitest en verde

## 7. Documentación

- [ ] 7.1 `docs/prd.md`: gestión de comentarios en el panel + **excepción de tema claro** del panel admin (app móvil sigue oscura)
- [ ] 7.2 `docs/arquitectura.md`: tema claro del panel admin y kit `ui.tsx`; `docs/gamificacion.md`: retirada de Octanos al borrar por admin
- [ ] 7.3 `docs/modelo-datos.md`/`docs/testing.md` si aplica (RPCs nuevos, mock)

## 8. Verificación de cierre (obligatoria)

- [ ] 8.1 Ejecutar `verify-all-platforms` (subagente `e2e-verifier`): panel admin → **solo web**, logueado como admin
- [ ] 8.2 Cubrir: listado por defecto (pendientes), búsqueda, filtro ciudad, paginación; aprobar (individual y bloque); eliminar (individual y bloque) con retirada de Octanos verificada; guard de no-admin; restyle claro de las 3 secciones
- [ ] 8.3 Limpiar datos de prueba y dejar evidencia en `.claude/verify-runs/admin-comments-management.md`
