## Context

MotoCiudad no tiene roles de usuario ni herramienta de gestión. La autorización
es **exclusivamente RLS** en PostgreSQL (no hay API gateway), y la lógica con
efectos sobre Octanos vive en Edge Functions. Ya existe una app web de consulta
(react-native-web + Leaflet) que reutiliza el código móvil con aislamiento por
plataforma (`.web.tsx`).

Estado actual relevante:
- `users`: sin `role` ni estado de cuenta (solo `flagged_for_review`).
- `parkings`: `status` enum (`pending`/`verified`/`rejected`/`archived`), `proposed_by`.
- `parking_photos`: fotos con `storage_path`, `uploaded_by`, `is_primary`.
- Flujo de verificación comunitaria (geofence + foto) vía `parking_verifications`.

## Goals / Non-Goals

**Goals:**
- Modelo de roles (`user`/`contributor`/`admin`) y suspensión global aplicables en RLS.
- Panel web para gestionar usuarios (admin) y parkings (contributor/admin).
- Autorización real en servidor (RLS + Edge Function), no solo en la UI.
- Contributor limitado a sus propios parkings; verificar/borrar solo admin.
- El panel nunca genera Octanos.

**Non-Goals:**
- Privilegios de contributor más allá de sus parkings; panel en móvil;
  auto-promoción por nivel/Octanos; feedback/reportes (v1.4); notificaciones (v1.5).

## Decisions

### D1. Rol en columna + funciones `SECURITY DEFINER` (no JWT claim)
`users.role user_role DEFAULT 'user'`. Helpers `is_admin()` y
`can_manage_parkings()` en SQL, `SECURITY DEFINER`, que leen rol y `suspended`
de `auth.uid()`.
- *Por qué:* comprobable directamente en cualquier policy; `SECURITY DEFINER`
  evita la recursión de RLS al consultar `users` desde una policy de `users`.
- *Alternativas:* claim en JWT (`app_metadata`) — más rápido pero exige
  re-sincronizar el token al cambiar rol; tabla `user_roles` — flexible pero
  sobra para 3 roles mutuamente excluyentes.

### D2. Suspensión como *gate* global
`users.suspended BOOLEAN DEFAULT FALSE` (+ `suspended_at`, `suspended_reason`).
`is_admin()` y `can_manage_parkings()` incluyen `AND NOT suspended`, y las
policies de escritura existentes (proponer/verificar) pasan a exigir `NOT suspended`.
- *Por qué:* un suspendido de cualquier rol queda en solo-lectura sin duplicar
  lógica.
- *Alternativa:* enum `account_status` — innecesario para un binario activo/suspendido.

### D3. Cambio de rol y suspensión vía Edge Function `admin-set-role`
Mutación por Edge Function (Deno + Zod) que valida `is_admin()` del llamante y
usa `service_role`. No hay `UPDATE` de `users.role`/`suspended` desde el cliente.
- *Por qué:* dar `UPDATE` sobre `users` al cliente abre escalada de privilegios
  (auto-ascenso); la protección a nivel de columna en RLS es frágil. Centralizarlo
  en una función auditable es más seguro.
- *Alternativa:* policy RLS + trigger anti-escalada — más difícil de razonar y probar.

### D4. Protección de `parkings.status` por trigger `BEFORE UPDATE`
El contributor tiene `UPDATE` sobre sus filas, pero **no** puede tocar `status`
(verificar). Un trigger rechaza cambios de `status` si `NOT is_admin()`.
- *Por qué:* RLS es por fila, no por columna; el trigger da control a nivel de columna.
- *Alternativa:* RPC/Edge Function `admin-verify-parking` dedicada — válida, pero
  el trigger cubre el caso con menos superficie (verificar no genera Octanos).

### D5. Permisos de parkings por propiedad
`USING (is_admin() OR (can_manage_parkings() AND proposed_by = auth.uid()))` para
UPDATE de `parkings` y para INSERT/UPDATE/DELETE de `parking_photos`. Borrar/
archivar parkings: solo `is_admin()`.

### D6. Verificación admin sin Octanos
Verificar desde el panel = `UPDATE parkings.status = 'verified'` (admin, vía D4).
No inserta en `octano_events` ni usa `parking_verifications`. El panel jamás toca
Octanos.

### D7. Panel solo web, en slice `features/admin/`
Rutas/pantallas `.web.tsx` gateadas por rol, reutilizando patrones web existentes
(NavRail, datatables). El *guard* de ruta en cliente es UX; la seguridad real es
RLS + Edge Function.

## Risks / Trade-offs

- **Olvidar el gate `suspended` en alguna policy de escritura existente** →
  Mitigación: auditar todas las policies de escritura y cubrir cada una con pgTAP.
- **`SECURITY DEFINER` mal acotado** (bypassa RLS) → Mitigación: las funciones
  solo leen `role`/`suspended` de `auth.uid()`, nada más.
- **Trigger de `status` con casuística** (p. ej. archivar) → Mitigación: definir
  claramente qué transiciones puede hacer cada rol; pgTAP por caso.
- **Guard de cliente confundido con seguridad** → Mitigación: documentar que la
  autorización vive en RLS/Edge; el guard solo evita mostrar UI.
- **Bootstrap del primer admin** → Mitigación: paso de seed/SQL explícito.

## Migration Plan

1. Migración(es) en orden atómico: enum `user_role` → columnas en `users` →
   funciones `is_admin()`/`can_manage_parkings()` → trigger de `status` → policies
   nuevas → actualización de policies de escritura con `NOT suspended`.
2. Backfill trivial por defaults (`role='user'`, `suspended=false`).
3. **Bootstrap admin**: paso SQL/seed que asigna `role='admin'` a un usuario concreto.
4. `pnpm gen:types` para regenerar tipos.
5. pgTAP verde para todas las policies (nuevas y modificadas) antes de mergear.
6. Rollback en desarrollo: revertir policies/trigger/funciones/columnas/enum.
   (En producción se seguiría la regla de deprecación antes de `DROP` de columnas.)

## Open Questions

- **Bootstrap del primer admin**: ¿seed SQL fijo por email/username, o asignación
  manual en el SQL Editor de Supabase? (propuesta: seed por username conocido).
- **Alcance de "editar campos" de parking**: confirmar lista final
  (`name, type, features, notes, city, capacity`) y transiciones de `status`
  permitidas al admin (verify, reject, archive).
- **Bucket de Storage** para imágenes de parking: reutilizar el existente
  (`parkings-photos`).
