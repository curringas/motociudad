## Why

El proyecto no tiene roles de usuario ni una herramienta de gestión: hoy no se
puede moderar la cola de parkings ni administrar la comunidad. El PRD (roadmap
v1.3) contempla un panel de administración web con roles. Esta change lo
implementa: un panel (solo web) donde el staff gestiona usuarios y parkings con
autorización real por RLS.

## What Changes

- **Modelo de roles**: nuevo enum `user_role` (`user`, `contributor`, `admin`) y
  columna `users.role` (default `user`).
- **Suspensión global**: nueva columna `users.suspended` (+ `suspended_at`,
  `suspended_reason`). Un usuario suspendido —sea cual sea su rol— no accede al
  panel ni puede contribuir en la app móvil (solo lectura).
- **Primitivas de autorización** en SQL: `is_admin()` y `can_manage_parkings()`
  (`SECURITY DEFINER`), ambas exigen `NOT suspended`. Se reutilizan en las policies.
- **Panel web (nuevo)** gateado por rol:
  - **Sección Usuarios** (solo admin): listar, buscar y filtrar (por rol),
    ver detalle (perfil, estado, Octanos), cambiar rol y suspender/reactivar.
  - **Sección Parkings** (contributor + admin): listar y filtrar (ciudad, estado),
    crear, editar. El **contributor solo edita/añade imágenes a los parkings que
    creó** (`proposed_by = auth.uid()`); el **admin** edita todos, **verifica**,
    **borra/archiva** y gestiona imágenes de cualquiera.
- **Edge Function** `admin-set-role` para cambio de rol y suspensión (valida que
  el llamante es admin; usa `service_role`). Nunca `UPDATE` directo desde cliente
  (evita escalada de privilegios).
- **Trigger** que impide a no-admins cambiar `parkings.status` (verificar es
  admin-only), ya que RLS es por fila y no por columna.
- **El panel NO genera Octanos** bajo ninguna acción ni rol; los Octanos solo se
  acreditan desde la app móvil.
- **BREAKING** (interno): las policies de escritura existentes (proponer,
  verificar) pasan a exigir `NOT suspended`.

## Capabilities

### New Capabilities
- `user-roles`: modelo de roles y suspensión; primitivas `is_admin()` /
  `can_manage_parkings()`; cambio de rol y suspensión vía Edge Function.
- `admin-user-management`: gestión de usuarios en el panel (listar, buscar,
  filtrar por rol, ver detalle, cambiar rol, suspender/reactivar) — solo admin.
- `admin-parking-management`: gestión de parkings en el panel (listar, filtrar
  por ciudad/estado, crear, editar, añadir imágenes; verificar y borrar solo
  admin; contributor limitado a los suyos).

### Modified Capabilities
<!-- No hay specs canónicos previos en openspec/specs/. El endurecimiento de las
     policies de escritura por `suspended` se documenta en design.md e Impact. -->

## Impact

- **Base de datos**: enum `user_role`; columnas `users.role`, `users.suspended`,
  `users.suspended_at`, `users.suspended_reason`; funciones `is_admin()` y
  `can_manage_parkings()`; trigger de protección de `parkings.status`; nuevas
  policies RLS (SELECT users admin; SELECT/UPDATE/DELETE parkings; INSERT/UPDATE/
  DELETE parking_photos) y actualización de las policies de escritura para exigir
  `NOT suspended`. Tests **pgTAP** para cada policy nueva/modificada.
- **Edge Functions**: nueva `admin-set-role` (Deno + Zod) con test.
- **App web**: nueva slice `features/admin/` y sección/rutas de panel
  (`.web.tsx`) gateadas por rol; UI de gestión de usuarios y parkings.
- **Tipos**: regenerar `apps/mobile/types/database.ts` (`pnpm gen:types`).
- **Docs canónicos a actualizar**: `prd.md` (v1.3 → implementado),
  `modelo-datos.md` (rol/suspensión, funciones, trigger), `arquitectura.md`
  (panel admin + modelo de autorización), `testing.md` (pgTAP de las policies).

## Non-goals

- Privilegios de `contributor` más allá de crear/editar sus propios parkings
  (p. ej. propuestas pre-verificadas): fuera de alcance.
- Panel en la app móvil (esta change es **solo web**).
- Auto-promoción de rol por nivel/Octanos.
- Que el panel genere Octanos (explícitamente, ninguno).
- Sistema de feedback/reportes (PRD v1.4) y notificaciones in-app (PRD v1.5):
  changes futuros independientes.
