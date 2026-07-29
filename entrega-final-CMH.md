# Entrega final — CMH

> Bitácora de **nuevas features y correcciones realizadas después de la entrega 2**,
> de cara a la entrega final del máster.
> Autor: Curro Martínez Hidalgo (CMH).

## Punto de partida

La **entrega 2** quedó congelada en la rama `feature-entrega2-CMH`, cuyo estado
en el momento de la entrega fue el commit:

- `b6688df` — *fix(mapa): tipa MAP_STYLE_DARK como MapStyleElement[] para pasar typecheck* (2026-07-11)

Ese commit incluía ya: el merge de iPhone (Octanos en Perfil + mejoras de
verificación) y el fix de tipos del mapa. **Todo lo que aparece en este
documento es posterior a ese punto** y forma parte de la entrega final.

> Nota: el trabajo del buscador (ver abajo) se commiteó sobre la propia rama
> `feature-entrega2-CMH` *después* de su push inicial de entrega 2, y de ahí se
> integró en `main`. Es, por tanto, trabajo de la entrega final aunque
> comparta rama.

---

## Nuevas features

### 1. Buscador de ubicaciones sobre el mapa

Barra de búsqueda fija sobre el mapa que permite escribir una calle o ciudad y
centrar la vista en esa zona para ver los parkings disponibles allí (caso de uso
del "motorista viajero"). Geocoding nativo vía `expo-location` (sin API key ni
billing). Al encontrar la ubicación, solo se recentra el mapa; la recarga de
pins reutiliza el ciclo por región ya existente.

- **Estado:** implementado, integrado en `main` y **verificado end-to-end en
  simulador** (2026-07-18): buscar "Avda la paz, la carlota" centró el mapa en
  La Carlota (Córdoba) y cargó los parkings de esa zona.
- **Slice:** `apps/mobile/features/search/` (`api.ts`, `hooks.ts`, `schemas.ts`,
  `components/MapSearchBar.tsx`).
- **Tests:** `features/search/api.ts` cubierto con 4 tests (Vitest,
  `expo-location` mockeado).
- **Specs:** `docs/superpowers/specs/2026-07-11-buscador-mapa-design.md` ·
  `docs/superpowers/plans/2026-07-11-buscador-mapa.md`.
- **Docs actualizados:** `prd.md` (user story + feature F15), `arquitectura.md`
  (nota de forward geocoding), `testing.md` (tests de `features/search`).
- **Commits:** `e74fbe5`, `e5e79a2`, `b80017f`, `c81e290`, `8937f27`,
  `ca13a84`, `42cac40` (2026-07-11).

### 2. Versión web de consulta (navegador)

MotoCiudad servida en el navegador **reutilizando el código móvil**, con
aislamiento total por plataforma (ficheros `.web.tsx` + redirects de Metro): las
apps iOS/Android no cambian. Es una versión de **consulta** (ver mapa, buscar y
ver fichas); aportar y verificar siguen siendo exclusivos de la app móvil para
garantizar la integridad de foto y GPS.

- **Mapa:** Leaflet + OpenStreetMap (sin API key), con carga diferida SSR-safe.
- **Buscador de direcciones:** geocoding con Nominatim; botón "Cómo llegar" →
  Google Maps.
- **Presentación responsive:** rail de navegación + panel lateral en escritorio;
  pestañas + hoja inferior en móvil.
- **Shims web** de `react-native-maps`, `expo-camera`, `expo-image-manipulator`,
  `expo-file-system` y deeplinks, para que el código compartido funcione en web.
- **Estado:** implementado e integrado en `main`.
- **Ficheros clave:** `app/**/*.web.tsx`, `components/web/` (NavRail, MobileTabs,
  MapSearch, ParkingSidePanel), `lib/maps-web/`, `lib/camera-web/`,
  `lib/breakpoints.ts`, `lib/responsive.ts`, `metro.config.js`.
- **Tests:** suite web separada `vitest.web.config.ts` (entorno node) —
  `lib/maps-web/geo.ts` (región↔zoom) y `lib/breakpoints.ts`. 5 tests en verde.
  Se ejecuta con `pnpm --filter mobile exec vitest run --config vitest.web.config.ts`.
- **Specs:** `docs/superpowers/specs/2026-07-10-version-web-design.md` ·
  `docs/superpowers/plans/2026-07-10-version-web.md`.
- **Docs actualizados:** `README.md`, `arquitectura.md`, `estructura-proyecto.md`,
  `prd.md`, `infraestructura.md`, `testing.md`.
- **Commits:** `745bdbe` (feat web) + `352bbad` (merge con `main`).

### 3. Panel de administración web (roles + gestión)

Panel de administración **solo web** para gestionar la comunidad y el dataset, con
autorización real en servidor (RLS + Edge Function), no solo en la UI. Desarrollado
con Spec Driven Development vía OpenSpec (change `admin-panel`, 36 tareas).

- **Modelo de roles y suspensión:** enum `user_role` (`user`/`contributor`/`admin`)
  y suspensión global de cuenta (solo lectura). Primitivas SQL `is_admin()` /
  `can_manage_parkings()` / `is_suspended()` reutilizadas en las policies RLS.
- **Sección Usuarios (solo admin):** listar, buscar (username/display_name) y filtrar
  por rol; detalle (perfil, rol, estado, nivel, Octanos); cambiar rol y
  suspender/reactivar. Toda mutación de rol/suspensión pasa por la Edge Function
  privilegiada `admin-set-role` (un trigger bloquea el `UPDATE` directo → anti-escalada).
- **Sección Parkings (contributor + admin):** listar y filtrar (ciudad/estado); crear
  (sin otorgar Octanos); editar según propiedad (contributor solo los suyos); gestionar
  imágenes; y —solo admin— verificar y borrar/archivar. Un trigger restringe el cambio
  de `status`/`deleted_at` a admin o contexto `service_role` (preserva la verificación
  comunitaria).
- **El panel nunca genera Octanos** (invariante explícito).
- **Estado:** implementado, **desplegado a Supabase Cloud** y **verificado E2E en
  navegador** (Playwright, cuenta admin, 2026-07-18): deny sin sesión → login →
  crear/verificar/borrar parking y cambiar rol de usuario, todo OK, 0 errores de consola.
  Capturas: `docs/screenshots/admin-panel-deny.png`, `docs/screenshots/admin-panel-parkings.png`.
- **Slice:** `apps/mobile/features/admin/` (`api.ts`, `hooks.ts`, `schemas.ts`,
  `permissions.ts` [lógica pura], `ui.tsx`) + rutas `apps/mobile/app/admin/*.web.tsx`
  (guard por rol + secciones) + entrada "Panel" en `NavRail`.
- **Backend:** 7 migraciones (`20260718000001..7`), Edge Function `admin-set-role`.
- **Tests:** **51 asserts pgTAP** (`authz_functions`, `admin_policies` + saneado de
  `parkings`/`nearby_parkings`), **16 tests Vitest** de permisos y **8 tests Deno** de
  `admin-set-role`. Suite completa en verde; `pnpm typecheck` limpio.
- **Specs:** OpenSpec `openspec/changes/archive/2026-07-18-admin-panel/` (archivado) +
  specs canónicas sincronizadas a `openspec/specs/{user-roles,admin-user-management,admin-parking-management}/`.
- **Docs actualizados:** `prd.md` (v1.3 → implementado), `modelo-datos.md` (§21
  autorización), `arquitectura.md` (§6.2 + §11.3), `testing.md` (§8.3), `README.md`.

### 4. Ranking de Octanos (global y por ciudad)

Tabla de clasificación de la comunidad por Octanos, con vistas **Global** y **Mi
ciudad** y períodos **Totales** / **Este mes**. Podio (oro/plata/bronce) + lista, con
la posición propia destacada.

- **Backend:** vista materializada con `GRANT` a `authenticated` (sin RLS; datos de
  ranking públicos entre usuarios).
- **Estado:** implementado, desplegado a Cloud y archivado en OpenSpec.
- **Pendiente (roadmap):** capturar `city_primary` en el registro para que el ranking
  por ciudad se rellene desde el alta.
- **PR:** #8 (2026-07-19).

### 5. Comentarios en parkings

Crear, votar y borrar comentarios en la ficha de un parking (sin geo), para aportar
contexto real de cada sitio. Escalera de Octanos **+10 / +5** acumulable con
`useful_comment`.

- **Estado:** implementado, desplegado a Cloud y archivado en OpenSpec.
- **PRs:** #10 (feature), #12 (fixes de contraste del badge de nivel, botón Borrar y
  banner de error) (2026-07-22).

### 6. Moderación IA de comentarios (DeepSeek)

Al publicar un comentario, un modelo (DeepSeek) lo clasifica `allow` / `reject` /
`flag` con diseño **fail-safe** (si la IA falla, no bloquea). Los Octanos del
comentario quedan **diferidos** hasta la aprobación.

- **Estado:** implementado y desplegado a Cloud.
- **PR:** #15 (2026-07-26).

### 7. Gestión de comentarios en el panel + rediseño a tema claro

Sección de comentarios en el panel admin: listado **paginado (50/pág)** de
`approved` + `pending_review` (por defecto pendientes), búsqueda, filtro por ciudad
(ILIKE) y **aprobar / eliminar** (el borrado retira los Octanos). Además, rediseño
del panel a **tema claro** (excepción del MVP; la app móvil sigue oscura) con un kit
`features/admin/ui.tsx`, y paginación 50 también en Usuarios/Parkings.

- **Estado:** implementado, desplegado a Cloud, verificado E2E (web) y archivado.
- **PR:** #16 (2026-07-26).

### 8. Perfil editable + perfiles públicos

Edición de perfil: **nick (@handle) único** (índice funcional `LOWER(username)` +
CHECK de formato; escribe `username` y `display_name`), **ciudad** con autocompletado
"Ciudad, País" vía Edge Function `city-search` (proxy a Nominatim/OSM) que activa el
ranking por ciudad, y **avatar**. El email queda en solo lectura. Perfiles públicos y
autoría visible en ranking y comentarios.

- **Estado:** implementado y desplegado a Cloud.
- **PR:** #17 (2026-07-27).

### 9. Import de parkings desde OpenStreetMap (dataset real)

Purga de los datos de prueba (parkings/fotos/Octanos a 0, usuarios intactos) y
**seeding de parkings de moto reales desde OpenStreetMap** (no Google): Córdoba 9 +
Sevilla 21 + Barcelona 309 + Madrid 947, en estado `pending`, autor `@motociudad`.
Scripts idempotentes de `backup` / `rollback` en `scripts/osm-import/`.

- **Estado:** ejecutado contra Cloud; 964 parkings en 4 ciudades.
- **PRs:** #39 (Córdoba + scripts), #41 (Sevilla/Madrid/Barcelona) (2026-07-29).

### 10. Icono de marca (pin + moto)

Icono de la app diseñado en HTML y renderizado con **Playwright MCP** (pin de mapa
amarillo + moto), opaco (Play/iOS lo exigen; la máscara adaptativa de Android recorta).

- **Estado:** integrado; entra por build nativo (no OTA).
- **PRs:** #32 (icono), #33 (menos padding) (2026-07-28).

---

## Correcciones

### 1. Saneada la infraestructura de tests (Vitest) — suite 100% verde

Se resolvió la deuda de tests que arrastraba la entrega 2. La suite pasa ahora
de 21/26 a **34/34 tests en verde** (7 ficheros).

- **`deeplinks.test.ts`** reescrito: comprobaba una implementación antigua
  (`geo:`/`maps://`). Ahora cubre el comportamiento real (ActionSheetIOS en iOS;
  `comgooglemaps://` + fallback web en Android; caso sin coordenadas). 7 tests.
  Commit `6db9f54`.
- **Script `test`** de `apps/mobile` cambiado de `vitest` (modo watch, cuelga en
  CI) a `vitest run`; añadido `test:watch`. Commit `d197d55`.
- **`ParkingMapPin.test.tsx`** migrado de RNTL (incompatible con Vitest — cargaba
  el `react-native` real flow-typed) a `@testing-library/react` + react-native-web
  renderizando como web sobre jsdom. Añadidas devDeps `@testing-library/react` y
  `@testing-library/dom`; `docs/testing.md` §2/§5/§15 actualizado. 6 tests.
  Commit `8a7c033`.

### 2. Bug de RLS: el admin no podía borrar/archivar parkings

Detectado al escribir los tests pgTAP del panel: al fijar `deleted_at`, la fila
resultante dejaba de ser visible bajo las policies `SELECT` existentes
(`deleted_at IS NULL`), por lo que PostgreSQL rechazaba el propio `UPDATE`
("new row violates row-level security policy"). El admin no podía borrar/archivar
pese al trigger que ya lo autorizaba.

- **Fix:** nueva policy `parkings_read_admin` (`USING is_admin()`) en la migración
  `20260718000007_parkings_admin_read.sql`. Como efecto útil, el admin también ve
  los parkings archivados/borrados para poder gestionarlos.
- **Verificado:** los 51 asserts pgTAP pasan; en Cloud el borrado funciona (E2E).

### 3. Saneado de los tests pgTAP preexistentes

`parkings.test.sql` y `nearby_parkings.test.sql` estaban rotos (nunca habían pasado):
UUIDs con caracteres no hexadecimales, aserciones obsoletas tras el cambio a lectura
pública de parkings, y CTEs que modifican datos usados como subconsulta. Corregidos
para dejar `supabase test db` 100% verde (4 ficheros, 51 asserts).

### 4. Build de Android + Google Maps

Arreglo del build nativo de Android (deps de SDK 54) y configuración de la Google
Maps API key (prebuild + huella SHA-1 de debug). PR #7 (2026-07-19).

### 5. Recentrado del mapa al conceder la ubicación

Al conceder el permiso, el mapa se recentra en la ubicación real del usuario en vez
de quedarse en la vista por defecto. PR #6 (2026-07-19).

### 6. Permiso de fotos del avatar (selector del sistema)

Se declara el plugin `expo-image-picker` con permiso de fotos y se usa el **selector
del sistema** (PHPicker/Android 13+), que no requiere permisos amplios de media. PR
#18 (2026-07-27). Relacionado: rechazo posterior de Google Play por
`READ_MEDIA_IMAGES` → resuelto quitando esos permisos y bloqueándolos en
`blockedPermissions` (ver Distribución).

### 7. Safe-area de la tab bar + bottom sheet arrastrable

Ajustes de UI en dispositivo real: respeto del área segura en la barra de pestañas y
hoja inferior de detalle arrastrable. PR #24 (2026-07-27).

### 8. CI de Supabase (grants pgTAP + test Deno)

Arreglo del workflow de Supabase: `GRANT` de tabla que faltaba para pgTAP (42501) y
configuración del test Deno. PR #3 (2026-07-19).

---

## Distribución y publicación

Bloque de puesta en producción de la app en las tres plataformas. La distribución
móvil se hace con **EAS Build/Submit** + **EAS Update (OTA)** para iterar JS sin
recompilar.

### Web — despliegue continuo a motociudad.com

CD por **FTP a ISPConfig** (`/web/`): cada cambio de la versión web se publica en
**https://motociudad.com** (fuentes de Expo incluidas, HTTPS forzado). PRs #4, #5
(2026-07-19).

### Android — Google Play (prueba abierta)

- Rename de paquete a **`com.motociudad.app`** antes de la 1ª subida (PR #21).
- Build **AAB** + `eas submit` al track **beta** (prueba abierta), `versionCode`
  manual vía `app.config` dinámico (PRs #20, #22, #34, #35, #38).
- **Rechazo del versionCode 3** por política (pedía `READ_MEDIA_IMAGES`, Android 13+
  exige el selector del sistema) → fix quitando esos permisos + `blockedPermissions`.
  **versionCode 4 en revisión** en Google Play.
- Páginas legales requeridas: **política de privacidad** (`/privacidad.html`, PR #23)
  y **eliminación de cuenta** para Data Safety (`/eliminar-cuenta.html`, PR #30).

### OTA — EAS Update

`updates.url` + `runtimeVersion: appVersion` para servir updates de JS/assets sin
recompilar; se corrigió el build con OTA (`runtimeVersion appVersion`). PRs #25, #26,
#29 (2026-07-27).

### iOS — App Store Connect / TestFlight

- La app se publica bajo la cuenta de Apple de un tercero (**Team CR6CKJ247R**; la
  org propia está caducada). `eas submit` configurado con appleId / **ascAppId
  `6795799534`** / appleTeamId (PR #40).
- Config nativa pre-envío (PR #42): **ubicación solo *When In Use*** (retirado el
  permiso `Always` que no se usa → evita rechazo 5.1.1), **`buildNumber` 1→2**,
  **`ITSAppUsesNonExemptEncryption: false`**. `version` se mantiene en `0.1.0` para no
  mover el runtime OTA del Android en review.
- **Ficha de App Store** en `applestore/`: textos es-ES (`ficha-textos.md`), checklist
  (`README.md`), `icon-1024.png` y **5 capturas nativas de iPhone 1284×2778** (Mapa,
  Lista, Ranking, Perfil, Verificar) hechas en el simulador (iPhone 14 Plus) con
  XcodeBuildMCP.
- **Estado:** build subido y `eas submit` a App Store Connect; pendiente rellenar la
  ficha + cuenta demo del revisor + App Privacy y **Submit for Review**.

### CI/CD

EAS Build pasado a **manual** (`workflow_dispatch`) en vez de en cada PR, para no
consumir cuota de build (PR #19).

---

## Documentación y roadmap (PRD)

Actualizaciones de especificación registradas como parte de la entrega final:

- **v1.4** — reportes de abuso e incidencias al panel; entradas in-app para borrado de
  cuenta y reportes (PRs #28, #31).
- **v1.8 (roadmap)** — verificación de fotos con IA (PR #27).
- **DX** — regla obligatoria de **verificación E2E multiplataforma** al cerrar
  `opsx:apply` (skill `verify-all-platforms` + subagente `e2e-verifier` + hook que
  bloquea `openspec archive` sin evidencia). PR #13 (2026-07-22).

---

## Deuda técnica pendiente

- **Ranking por ciudad**: capturar `city_primary` en el alta para poblarlo desde el
  registro (hoy depende de que el usuario fije ciudad en el perfil).
- **iOS**: falta completar la ficha en App Store Connect y **Submit for Review**;
  a la espera de aprobación de Apple y de Google Play (Android versionCode 4).
- Sin deuda de tests ni de specs (código y documentación en sincronía).

---

## Mantenimiento de este documento

Cada nueva feature o corrección que entre a partir de aquí se añade en su sección
con: qué hace, estado, ficheros/slice, tests, specs afectadas y commits. Así este
`.md` sirve como resumen de todo lo aportado en la entrega final respecto a la
entrega 2.
