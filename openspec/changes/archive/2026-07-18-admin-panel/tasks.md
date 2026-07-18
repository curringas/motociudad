## 1. Base de datos — roles y suspensión

- [x] 1.1 Migración: enum `user_role` (`user`,`contributor`,`admin`) + columnas `users.role` (default `user`), `users.suspended` (default false), `users.suspended_at`, `users.suspended_reason`
- [x] 1.2 Migración: funciones `is_admin()` y `can_manage_parkings()` (`SECURITY DEFINER`, leen rol/`suspended` de `auth.uid()`, exigen `NOT suspended`)
- [x] 1.3 Migración: trigger `BEFORE UPDATE OF status` en `parkings` que rechaza el cambio de `status` salvo `is_admin()` o `auth.uid() IS NULL` (service_role); preserva la verificación comunitaria
- [x] 1.4 pgTAP: `is_admin()`/`can_manage_parkings()` (admin activo→true, admin suspendido→false, contributor activo→true, user→false) — `supabase/tests/rls/authz_functions.test.sql` (11 asserts)
- [x] 1.5 Probar local: `supabase db reset` sin errores (todas las migraciones aplican limpias)

## 2. Base de datos — policies RLS

- [x] 2.1 Policy `SELECT` en `users` para admin → **ya cubierto** por `users_public_read` (SELECT público). Añadido en su lugar el guard `trg_users_privileged_fields` que cierra la escalada de privilegios en `users_self_update`.
- [x] 2.2 Policies en `parkings`: `parkings_update_admin` (admin) y `parkings_update_contributor_own` (contributor, sus filas); borrado (`deleted_at`) restringido a admin vía `trg_parkings_delete_admin_only`
- [x] 2.3 Policies en `parking_photos`: `parking_photos_insert/update/delete_admin` (admin cualquiera); contributor añade a los suyos vía policy existente
- [x] 2.4 `NOT suspended` aplicado a `parkings_insert`, `parkings_update_own_pending` y `parking_photos_insert` (helper `is_suspended()`). Falta el chequeo `suspended` dentro de las Edge Functions propose/verify (service_role salta RLS) → grupo 3
- [x] 2.5 pgTAP: cada policy nueva/modificada — `supabase/tests/rls/admin_policies.test.sql` (14 asserts: admin, contributor propio, ajeno→deniega, user→deniega, suspendido→deniega, verificar/borrar). Se corrigió `parkings.test.sql` (estaba obsoleto: lectura pública desde 20260705, UUIDs no-hex, CTE inválido) y `nearby_parkings.test.sql` (UUIDs no-hex).
- [x] 2.6 `supabase test db` → 100% pass (4 ficheros, 51 asserts). **Bug encontrado y corregido**: el admin no podía borrar/archivar (`deleted_at`) porque las policies SELECT ocultaban la fila resultante → nueva migración `20260718000007_parkings_admin_read.sql` (policy `parkings_read_admin`). **Aplicada a Cloud** (verificado: parkings=7 policies, parking_photos=6).

## 3. Backend — Edge Function `admin-set-role`

- [x] 3.1 Scaffold `supabase/functions/admin-set-role/` (Deno + TypeScript) con auth check del llamante (admin activo) y uso de `service_role`
- [x] 3.2 Validación de input con Zod (`userId`, y `role` y/o `suspended`)
- [x] 3.3 Lógica: actualizar `role`/`suspended` (+ `suspended_at`/`suspended_reason`); rechazar si el llamante no es admin; impedir auto-modificación
- [x] 3.4 Deno test: `supabase/functions/admin-set-role/__tests__/schemas.test.ts` (8 tests, verde con `deno task test`) cubre el gate 400 (input inválido). Se añadió `admin-set-role/deno.json`. Los gates 401/403/404 viven en el handler (auth real) y el trigger `trg_users_privileged_fields` (cubierto por pgTAP).
- [x] 3.5 Deploy `admin-set-role` a Cloud (v1 ACTIVE). `propose-parking` y `validate-verification` **redesplegadas a Cloud** (CLI) con el chequeo `suspended` incluido.

## 4. Tipos y capa de datos (cliente)

- [x] 4.1 `pnpm gen:types` → `apps/mobile/types/database.ts` regenerado (incluye `role`/`suspended`/`user_role`/`is_suspended`)
- [x] 4.2 `features/admin/schemas.ts` (Zod: rol, perfil, filtros usuarios/parkings, set-role, crear/editar parking) + `permissions.ts` (lógica pura de autorización)
- [x] 4.3 `features/admin/api.ts` (perfil, listar/buscar usuarios, `admin-set-role`, listar/filtrar parkings, crear/editar, status, borrado lógico, listar/subir fotos a Storage)
- [x] 4.4 `features/admin/hooks.ts` (TanStack Query: `useCurrentProfile`, usuarios, parkings, fotos + mutations con invalidación)
- [x] 4.5 Tests Vitest `features/admin/__tests__/permissions.test.ts` (16 tests: permisos derivados por rol/propiedad + filtros) — verde

## 5. Panel web — acceso y layout

- [x] 5.1 Guard de acceso por rol en `app/admin/_layout.web.tsx` (permite admin/contributor no suspendidos; deniega user/suspendidos/sin sesión con mensaje y redirección)
- [x] 5.2 Layout del panel (`.web.tsx`) con sidebar de secciones; la sección Usuarios se oculta a `contributor`. Nativo: `_layout.tsx` con aviso "solo web". Entrada "Panel" añadida al `NavRail` (solo admin/contributor).

## 6. Panel web — sección Usuarios (solo admin)

- [x] 6.1 `app/admin/users.web.tsx`: listado con búsqueda (username/display_name) y filtro por rol
- [x] 6.2 Detalle de usuario: perfil, rol, estado (suspendido + motivo), nivel (nombre del catálogo) y Octanos (total/mes)
- [x] 6.3 Acciones: cambiar rol y suspender/reactivar vía `admin-set-role`; auto-modificación bloqueada en la UI

## 7. Panel web — sección Parkings (contributor / admin)

- [x] 7.1 `app/admin/parkings.web.tsx`: listado con filtro por ciudad y por estado (+ ámbito "solo míos" para contributor)
- [x] 7.2 Crear parking desde el panel (inserción directa, sin generar Octanos; queda `pending`, `proposed_by` = creador)
- [x] 7.3 Editar campos (name/type/city/capacity/notes): contributor solo los suyos, admin cualquiera; la UI oculta acciones no permitidas (`canEditParking`)
- [x] 7.4 Añadir imágenes (subida a Storage `parkings-photos` + fila en `parking_photos`), respetando propiedad (`canAddPhoto`)
- [x] 7.5 Verificar/rechazar/archivar y borrar (deleted_at): solo admin (`canChangeParkingStatus`/`canDeleteParking`)

## 8. Verificación y documentación

- [x] 8.1 `pnpm typecheck` limpio
- [x] 8.2 `pnpm test` (app: 55/55, incluye 16 tests de admin) y suite web `vitest.web.config.ts` (5/5) en verde
- [x] 8.3 Docs canónicos actualizados: `prd.md` (v1.3 → ✅ implementado), `modelo-datos.md` (columnas rol/suspensión en `users` + enum `user_role` + nueva §21 con funciones/triggers/policies), `arquitectura.md` (§6.2 autorización por rol + §11.3 panel web), `testing.md` (§8.3 pgTAP de authz + convención de helpers)
- [x] 8.4 Verificación manual en web (Playwright + cuenta admin `curro`, contra Cloud):
  - Deny path: sin sesión, `/admin` → "Inicia sesión" (guard OK).
  - Login admin → aparece entrada "Panel" en el NavRail; sidebar con Parkings + Usuarios.
  - Parkings: listado + filtros; **crear** (queda pending, sin Octanos) → **verificar** (status→verified) → **borrar** (deleted_at) → todo OK en Cloud (confirma el fix de la migración 000007; sin ella el borrado fallaba por RLS).
  - Usuarios: búsqueda/filtro, detalle (nivel `2 · Rodador`, Octanos, estado), banner de auto-modificación en la propia cuenta, y **cambio de rol vía `admin-set-role`** (curro2 user→contributor→user, verificado en BD).
  - 0 errores de consola. Datos de prueba limpiados. (Flujos contributor/user/suspendido no clicados por falta de cuentas separadas, pero cubiertos por 51 asserts pgTAP + 16 tests Vitest de permisos.)
- [x] 8.5 Bootstrap: `role='admin'` asignado a curro@martinezhidalgo.com (username `curro`, id 8dac2082…) vía SQL con service_role en Cloud
