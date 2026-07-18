## 1. Base de datos — roles y suspensión

- [x] 1.1 Migración: enum `user_role` (`user`,`contributor`,`admin`) + columnas `users.role` (default `user`), `users.suspended` (default false), `users.suspended_at`, `users.suspended_reason`
- [x] 1.2 Migración: funciones `is_admin()` y `can_manage_parkings()` (`SECURITY DEFINER`, leen rol/`suspended` de `auth.uid()`, exigen `NOT suspended`)
- [x] 1.3 Migración: trigger `BEFORE UPDATE OF status` en `parkings` que rechaza el cambio de `status` salvo `is_admin()` o `auth.uid() IS NULL` (service_role); preserva la verificación comunitaria
- [ ] 1.4 pgTAP: `is_admin()`/`can_manage_parkings()` (admin activo→true, admin suspendido→false, contributor activo→true, user→false)
- [ ] 1.5 Probar local: `supabase db reset` sin errores

## 2. Base de datos — policies RLS

- [x] 2.1 Policy `SELECT` en `users` para admin → **ya cubierto** por `users_public_read` (SELECT público). Añadido en su lugar el guard `trg_users_privileged_fields` que cierra la escalada de privilegios en `users_self_update`.
- [x] 2.2 Policies en `parkings`: `parkings_update_admin` (admin) y `parkings_update_contributor_own` (contributor, sus filas); borrado (`deleted_at`) restringido a admin vía `trg_parkings_delete_admin_only`
- [x] 2.3 Policies en `parking_photos`: `parking_photos_insert/update/delete_admin` (admin cualquiera); contributor añade a los suyos vía policy existente
- [x] 2.4 `NOT suspended` aplicado a `parkings_insert`, `parkings_update_own_pending` y `parking_photos_insert` (helper `is_suspended()`). Falta el chequeo `suspended` dentro de las Edge Functions propose/verify (service_role salta RLS) → grupo 3
- [ ] 2.5 pgTAP: cada policy nueva/modificada (admin, contributor propio, contributor ajeno→deniega, user→deniega, suspendido→deniega)
- [ ] 2.6 Ejecutar `supabase test db` y verificar 100% pass

## 3. Backend — Edge Function `admin-set-role`

- [x] 3.1 Scaffold `supabase/functions/admin-set-role/` (Deno + TypeScript) con auth check del llamante (admin activo) y uso de `service_role`
- [x] 3.2 Validación de input con Zod (`userId`, y `role` y/o `suspended`)
- [x] 3.3 Lógica: actualizar `role`/`suspended` (+ `suspended_at`/`suspended_reason`); rechazar si el llamante no es admin; impedir auto-modificación
- [ ] 3.4 Deno test: admin cambia rol/suspende OK; no-admin rechazado (403); input inválido rechazado (400) — PENDIENTE
- [x] 3.5 Deploy `admin-set-role` a Cloud (vía MCP, v1 ACTIVE). Chequeo `suspended` añadido a propose-parking/validate-verification — **pendiente redeploy** de esas dos (multi-fichero; falta SUPABASE_ACCESS_TOKEN para CLI)

## 4. Tipos y capa de datos (cliente)

- [ ] 4.1 `pnpm gen:types` y commitear `apps/mobile/types/database.ts` (incluye `role`/`suspended`)
- [ ] 4.2 `features/admin/schemas.ts` (Zod: rol, filtros de usuarios y de parkings)
- [ ] 4.3 `features/admin/api.ts` (listar/buscar usuarios; listar/filtrar parkings; crear/editar parking; subir imagen a Storage + `parking_photos`; `invoke('admin-set-role')`)
- [ ] 4.4 `features/admin/hooks.ts` (TanStack Query: queries y mutations)
- [ ] 4.5 Tests Vitest de la lógica pura de `features/admin` (filtros, permiso derivado por propiedad/rol) con Supabase mockeado

## 5. Panel web — acceso y layout

- [ ] 5.1 Guard de acceso al panel por rol: permitir `admin`/`contributor` no suspendidos; denegar `user` y suspendidos (redirección/mensaje)
- [ ] 5.2 Layout del panel (`.web.tsx`) con navegación entre secciones; ocultar la sección Usuarios a `contributor`

## 6. Panel web — sección Usuarios (solo admin)

- [ ] 6.1 Listado de usuarios con búsqueda por `username`/`display_name` y filtro por rol
- [ ] 6.2 Detalle de usuario: perfil, rol, estado (suspendido), nivel y Octanos
- [ ] 6.3 Acciones: cambiar rol y suspender/reactivar (a través de `admin-set-role`)

## 7. Panel web — sección Parkings (contributor / admin)

- [ ] 7.1 Listado de parkings con filtro por ciudad y por estado
- [ ] 7.2 Crear parking desde el panel (sin generar Octanos)
- [ ] 7.3 Editar campos: contributor solo los suyos; admin cualquiera (UI oculta/deshabilita lo no permitido)
- [ ] 7.4 Añadir imágenes (subida a Storage + registro en `parking_photos`), respetando propiedad
- [ ] 7.5 Verificar y borrar/archivar: solo admin

## 8. Verificación y documentación

- [ ] 8.1 `pnpm typecheck` limpio
- [ ] 8.2 `pnpm test` (app) y suite web (`vitest.web.config.ts`) en verde
- [ ] 8.3 Actualizar docs canónicos: `prd.md` (v1.3 → implementado), `modelo-datos.md` (rol/suspensión, funciones, trigger, policies), `arquitectura.md` (panel admin + modelo de autorización), `testing.md` (pgTAP de las nuevas policies)
- [ ] 8.4 Verificación manual en web: admin gestiona usuarios y parkings; contributor limitado a los suyos y sin sección Usuarios; `user` y suspendidos sin acceso al panel
- [ ] 8.5 Bootstrap: asignar `role='admin'` a un usuario (seed/SQL) para poder entrar al panel
