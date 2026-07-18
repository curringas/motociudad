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

- **Estado:** implementado e integrado en `main`. Verificado en simulador (la
  barra renderiza y se coloca correctamente); pendiente la prueba manual
  end-to-end de teclear y comprobar el centrado.
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

---

## Deuda técnica pendiente

- **Verificación manual del buscador:** teclear "Barcelona" en el simulador y
  confirmar el centrado end-to-end.

---

## Mantenimiento de este documento

Cada nueva feature o corrección que entre a partir de aquí se añade en su sección
con: qué hace, estado, ficheros/slice, tests, specs afectadas y commits. Así este
`.md` sirve como resumen de todo lo aportado en la entrega final respecto a la
entrega 2.
