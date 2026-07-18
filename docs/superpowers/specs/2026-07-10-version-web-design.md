# Diseño: versión web funcional de MotoCiudad

**Fecha:** 2026-07-10
**Estado:** implementada (build local) — con las variaciones del addendum
**Autor:** brainstorming con Claude Code

---

## 0. Addendum de implementación (2026-07-18)

Cambios respecto al diseño original, decididos durante la implementación:

- **Motor de mapa: Leaflet + OpenStreetMap** (no MapLibre/CARTO). El estilo oscuro de
  CARTO no convenció; se probó claro (Voyager/Positron) y finalmente Leaflet+OSM (raster,
  sin key). Leaflet se **carga de forma diferida** en cliente porque toca `window` y Expo
  web prerenderiza en SSR. La conversión región↔zoom usa tamaño de teja 256px.
- **Buscador de direcciones**: añadido sobre el mapa con **Nominatim** (geocoder de OSM,
  sin key). Al elegir un resultado el mapa vuela allí y recarga los parkings de la zona.
  (`components/web/MapSearch.tsx`).
- **"Cómo llegar"**: en web abre Google Maps con direcciones en pestaña nueva
  (`lib/deeplinks.web.ts`), en vez del deeplink nativo.
- **Aportar y verificar deshabilitados en web** (decisión de producto): son acciones de
  contribución que requieren presencia física (ubicación + foto en el momento); en navegador
  la foto sería una subida de archivo, no fiable. Además el alta usa `Alert.alert` con
  botones, no soportado por react-native-web. Se muestra un aviso que remite a la app móvil
  en: panel del mapa, ficha (`app/parking/[id].web.tsx`), ruta de verificar
  (`app/verify/[parkingId].web.tsx`) y pestaña Aportar (`app/(tabs)/contribute.web.tsx`).
  La web queda como companion de consulta.
- **Tooling de tests**: se añadió `jsdom` (dev) y una config aparte `vitest.web.config.ts`
  (entorno node) para la lógica pura web, porque la suite compartida estaba pre-rota en el
  worktree.

El resto del diseño (aislamiento por plataforma, shims, presentación responsive, Supabase
remoto, política de no-commit hasta validar) se mantiene como se describe abajo.

---

## 1. Objetivo

Ofrecer una versión **web totalmente funcional** de MotoCiudad, servida por HTTP en
local (localhost), **sin romper ni modificar nada de lo que usa la app móvil iOS que
ya se está testeando en dispositivo real**.

Requisitos de éxito:

- La web se abre en el navegador y permite: ver el mapa con pines de parkings,
  abrir el detalle, dar de alta un parking (flujo de 3 pasos con foto) y verificar
  un parking (foto + ubicación).
- **En escritorio se ve como una web de escritorio** (no un teléfono estirado ni
  centrado): layout dedicado con rail de iconos + mapa + panel contextual.
- **Es responsive**: en móvil-web se comporta como la app actual (pestañas abajo,
  bottom sheet), porque será un caso de uso frecuente.
- El bundle de iOS no cambia de comportamiento. Ningún fichero que el bundler de
  iOS resuelva se modifica.
- Coste y dependencias externas cero: sin API keys ni facturación.

## 2. Principio rector: riesgo cero para el móvil

Metro (el bundler de Expo) **resuelve ficheros por plataforma**: para un import dado,
prioriza `fichero.web.tsx` en web y `fichero.tsx`/`fichero.native.tsx` en iOS/Android.
Además, el repo **ya usa** un redirect de resolución condicionado a `platform === 'web'`
en `metro.config.js` (hoy: `react-native-maps` → `lib/maps-web-stub.js`).

Consecuencia: iOS **nunca** carga código marcado como web. Todo lo nuevo será web-only
o aditivo. **No se edita ningún fichero que iOS resuelva.** El aislamiento es
estructural, no depende de disciplina en runtime.

## 3. Estructura: mismo proyecto, ficheros `.web` (no carpeta aparte)

La web es la **misma app Expo** (`apps/mobile`) en otra plataforma. Se comparte el
**cerebro** (features, hooks, queries, stores, validaciones, cliente Supabase) y se
construye una **capa de presentación web** propia para escritorio. Compartir código
**no** implica compartir diseño: la lógica es idéntica; sólo cambia *cómo se colocan*
los componentes según el ancho de pantalla.

```
apps/mobile/
├── app/
│   ├── (tabs)/_layout.tsx            ← nav móvil (pestañas), COMPARTIDO iOS, sin tocar
│   ├── (tabs)/_layout.web.tsx        ← NUEVO web-only: rail escritorio / pestañas móvil
│   ├── (tabs)/map.tsx                ← pantalla nativa, sin tocar
│   ├── (tabs)/map.web.tsx            ← NUEVO web-only: layout responsive del mapa
│   ├── (tabs)/contribute.tsx         ← sin tocar
│   ├── (tabs)/contribute.web.tsx     ← NUEVO web-only: alta responsive
│   └── verify/[parkingId].tsx        ← sin tocar (+ variante .web si el layout lo pide)
├── features/ · stores/ · hooks/      ← COMPARTIDO, sin tocar (el "cerebro")
├── components/                       ← COMPARTIDO; se reutilizan sub-componentes
├── lib/supabase.ts                   ← COMPARTIDO, sin tocar
└── lib/
    ├── maps-web/                     ← NUEVO, solo web (iOS nunca lo carga)
    │   ├── index.tsx · geo.ts
    ├── camera-web/                   ← NUEVO, solo web
    │   └── index.tsx
    ├── image-manipulator-web.ts      ← NUEVO, solo web
    ├── file-system-web.ts            ← NUEVO, solo web
    └── responsive.ts                 ← NUEVO: hook useBreakpoint() (web + nativo no-op)
```

Se descarta una carpeta `apps/web` separada: obligaría a duplicar/reescribir hooks,
queries y lógica de dominio y a mantener dos cerebros en paralelo. El aislamiento
deseado (no romper iOS) se logra con ficheros `.web` + redirects de Metro; y el diseño
de escritorio se logra con las variantes `.web.tsx`, que **reutilizan los mismos hooks
y sub-componentes** que la versión móvil.

**Nota sobre el nombre de la carpeta:** `apps/mobile` es un nombre heredado; ahora sirve
iOS y web. Renombrarla a algo neutro (`apps/app`) toca rutas del móvil (filtro pnpm,
EAS, CI) y por eso se pospone hasta **después** de validar la web y re-probar iOS.
Fuera del alcance de esta entrega inmediata.

## 4. Estrategia técnica (capa 1): shims de módulo nativo

Dos capas complementarias. **Capa 1 (esta sección):** que las librerías nativas
funcionen en el navegador. **Capa 2 (§4ter):** el diseño de escritorio responsive.

Las **librerías nativas** se sustituyen en web por implementaciones equivalentes que
exponen la **misma API pública** que consume la app. Así funcionan por igual en
móvil-web y en escritorio, sin que el "cerebro" (hooks/queries) note la diferencia.

| Módulo nativo | Resolución en web | Contenido |
|---|---|---|
| `react-native-maps` | `lib/maps-web/` (**MapLibre GL JS**) | Implementa el subconjunto usado por la app: `MapView` (props `initialRegion`, `onRegionChangeComplete`, `showsUserLocation`, `customMapStyle` (ignorado/equivalente), y ref imperativo `animateToRegion`), `Marker` (con `coordinate`, `onPress`, `children`, `identifier`, `tracksViewChanges`), y las constantes `PROVIDER_DEFAULT` / `PROVIDER_GOOGLE`. Tiles vectoriales oscuros **keyless** (OpenFreeMap u equivalente). |
| `expo-camera` | `lib/camera-web/` | `CameraView` + `useCameraPermissions` implementados sobre `<input type="file" accept="image/*" capture>`. Devuelven la misma forma de datos que espera la pantalla (URI/base64 de la foto capturada). |
| `expo-location` | web oficial de Expo | Ya funciona vía Geolocation API del navegador. Solo verificar; sin shim propio salvo sorpresa. |
| `expo-image-manipulator` / `expo-file-system` | web oficial de Expo, o mini-shim `<canvas>` | Redimensionar/comprimir la foto. Si el soporte web oficial no basta para el uso concreto (`ImageManipulator.manipulateAsync`, lectura de fichero), se añade un shim web con `<canvas>`. |

Los redirects nuevos se añaden en `metro.config.js` **dentro de la rama
`platform === 'web'`** (mismo patrón que el redirect ya existente). El
`lib/maps-web-stub.js` actual se sustituye por el módulo real `lib/maps-web/`.

### 4.1 Conversión región ↔ zoom (mapa)

`react-native-maps` es imperativo y trabaja con `Region` (`latitude`, `longitude`,
`latitudeDelta`, `longitudeDelta`). MapLibre trabaja con `center` + `zoom`. El shim
traduce en ambos sentidos con la fórmula estándar de zoom web mercator:

- delta → zoom: `zoom ≈ log2(360 / longitudeDelta)` ajustado por ancho de viewport.
- zoom → delta: la inversa, para emitir `onRegionChangeComplete` con la misma forma
  que la pantalla espera (la pantalla deriva de ahí el radio de búsqueda).

`animateToRegion(region)` → `map.flyTo({ center, zoom })`.
`onRegionChangeComplete` se emite en el evento `moveend` de MapLibre.

### 4.2 Pines

Los `Marker` se renderizan como marcadores MapLibre con el mismo aspecto que hoy
(círculo amarillo para `public`, gris para `private`, con la "M" y la colita), y con
`onPress` cableado al mismo handler que abre el bottom sheet.

## 4ter. Estrategia técnica (capa 2): presentación web responsive

El diseño de escritorio vive en ficheros `.web.tsx` que **reutilizan los mismos hooks
y sub-componentes** que la versión móvil; sólo cambian la disposición. La plataforma
nativa nunca resuelve estos ficheros.

### Breakpoints

Un hook `useBreakpoint()` (en `lib/responsive.ts`, basado en `useWindowDimensions`)
devuelve `'mobile' | 'tablet' | 'desktop'`:

- `desktop` (≥1024px): **rail** de iconos (izquierda) · **mapa** (centro) · **panel
  contextual** (derecha) con detalle del parking o formularios.
- `tablet` (768–1023px): rail + mapa; el panel derecho pasa a **overlay** deslizante
  sobre el mapa.
- `mobile` (<768px): layout **actual** de la app — pestañas abajo, mapa a pantalla
  completa, detalle en bottom sheet. Es el caso de uso frecuente en móvil-web.

### Navegación

`app/(tabs)/_layout.web.tsx` renderiza, según breakpoint, un **rail vertical** de
iconos (Mapa, Lista, Aportar, Ranking, Perfil, + acción rápida) en escritorio/tablet,
o delega en la barra de **pestañas** en móvil. Las rutas y sus destinos son los mismos
que en nativo (mismo `expo-router`), sólo cambia el contenedor de navegación.

### Pantallas

- `map.web.tsx`: en escritorio, mapa a pantalla completa con panel derecho (lista de
  parkings cercanos + detalle del seleccionado reutilizando el contenido de
  `ParkingBottomSheet`); en móvil, la composición actual. Reutiliza `useNearbyParkings`,
  `useUserLocation`, `ParkingMapPin`, filtros y stores tal cual.
- `contribute.web.tsx`: el asistente de 3 pasos (ubicación, detalles, foto) colocado en
  el panel/columna en escritorio; a pantalla completa en móvil. Misma lógica
  (`useProposeParking`, `useCheckDuplicates`, validaciones Zod, shim de cámara).
- `verify/[parkingId].web.tsx` (si el layout lo requiere): mismo flujo, colocado en panel.

### Estilos

NativeWind (ya en el proyecto) con utilidades responsive donde aplique. Los
sub-componentes de dominio no cambian; el layout se controla en los shells `.web.tsx`.
Se mantiene el tema oscuro actual.

## 4bis. Configuración de entorno (Supabase remoto)

El proyecto usa **Supabase remoto** (cloud), no local. El cliente
(`lib/supabase.ts`) lee `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`
de `process.env` y **lanza error si faltan**. En web, Expo/Metro inyecta esas
variables **en tiempo de build** desde `apps/mobile/.env`.

Situación actual: el `.env` con las credenciales vive en el **repo principal**
(`apps/mobile/.env`), pero **no en este worktree** (`.env` está en `.gitignore`, así
que no viaja con el worktree). Acción previa a levantar la web:

- Copiar `apps/mobile/.env` del repo principal a `apps/mobile/.env` del worktree.
  Sigue estando gitignored → **no se comitea**.
- Verificar que el build web arranca sin el error de "Missing Supabase environment
  variables" y que la web se conecta al Supabase remoto (los pines cargan de datos
  reales).

## 5. Servir por HTTP (local)

Scripts nuevos en `apps/mobile/package.json` (y/o `package.json` raíz):

```bash
pnpm web           # expo start --web  → http://localhost:8081 (iteración rápida)
pnpm web:export    # expo export --platform web → sitio estático en dist/
pnpm web:serve     # sirve dist/ por HTTP en local (dep: serve)
```

El arranque del móvil (`pnpm dev:mobile`) no cambia.

## 6. Flujo de datos

Idéntico al actual: cliente → Edge Function (auth + validación) → PostgreSQL con RLS →
realtime. El shim de mapa solo traduce región↔cámara y pinta los mismos pines. Supabase,
RLS, Edge Functions y gamificación (Octanos, badges) no se tocan.

## 7. Riesgos y mitigación

1. **Fidelidad de la API imperativa de `react-native-maps`** (refs, deltas,
   `onRegionChangeComplete`). → Se implementa exactamente el subconjunto que usa la app
   (verificado en `map.tsx`, `contribute.tsx`, `ParkingMapPin.tsx`); fórmula estándar
   delta↔zoom con tests unitarios de la conversión en `lib/maps-web/geo.ts`.
2. **Otros módulos nativos que fallen al cargar en web** (`@sentry/react-native`,
   `posthog-react-native`, `@gorhom/bottom-sheet`, `react-native-reanimated`,
   `react-native-gesture-handler`). → La mayoría soporta web; se audita en el primer
   build y se añaden guardas o shims **web-only** si algo peta. No afecta a nativo.
3. **Regresión en móvil.** → No se toca ningún fichero que iOS resuelva; la garantía es
   estructural. Gate de seguridad: `pnpm typecheck` + `pnpm test` en verde antes de
   dar por terminado.
4. **`customMapStyle` (JSON de Google) no aplica a MapLibre.** → Se ignora y se usa un
   estilo oscuro equivalente de MapLibre; el objetivo es paridad funcional, no pixel-perfect.

## 7bis. Política de commits

**No se comitea nada** (ni código, ni docs, ni la propia spec) hasta que la web esté
probada y funcionando en localhost, verificada por el usuario. Todo el trabajo se hace
en el working tree del worktree. Una vez validado, se decide rama + commits.

## 8. Verificación

- **Web funciona:** abrir `localhost` en navegador (conducido con Playwright MCP):
  cargar mapa con pines, abrir detalle, alta de parking (3 pasos + foto vía input de
  archivo), flujo de verificación. Capturas como evidencia.
- **Responsive:** verificar el layout de **escritorio** a ≥1024px (rail + mapa + panel)
  y el layout **móvil** a <768px (pestañas + bottom sheet), redimensionando la ventana.
  Capturas de ambos anchos.
- **Móvil no roto:** `pnpm typecheck` y `pnpm test` en verde. Los tests existentes
  (Vitest / RN Testing Library) se mantienen intactos como red de seguridad.
- **Conversión de mapa:** tests unitarios de `geo.ts` (delta↔zoom).

## 9. Fuera de alcance

- Deploy a hosting público (EAS Hosting/Vercel/Netlify). De momento solo local.
- Cámara en vivo con `getUserMedia` (se usa input de archivo).
- Paridad visual pixel-perfect del mapa.
- Tema claro y demás puntos ya fuera de alcance del MVP.

## 10. Documentación (entrega de máster AI4Devs)

Es la entrega de un proyecto final; el tribunal tendrá que **probar la aplicación**.
La documentación se actualiza en el mismo PR (regla del repo: código y specs no
divergen). Se documenta **dónde corresponde**, sin duplicar:

- **`README.md`**
  - Sección de arranque (~línea 334): añadir cómo levantar y probar la **web**
    (`pnpm web`, y el export estático `pnpm web:export` + `pnpm web:serve`), con la
    URL de localhost. Debe quedar claro para alguien que clona el repo por primera vez.
  - Tabla de limitaciones (~línea 79, "Versión web"): actualizar la entrada para
    reflejar que la web ya es funcional vía shims, con las salvedades (mapa MapLibre
    en vez de nativo, foto por input de archivo).
- **`docs/infraestructura.md`** — sección "Entornos": añadir fila/nota del target web
  local y comandos de arranque.
- **`docs/arquitectura.md`** — documentar el patrón de **aislamiento por plataforma**
  (ficheros `.web` + redirect de Metro + shims de módulo nativo) como decisión de
  arquitectura, para justificar por qué la web no toca el código móvil.
- **`docs/estructura-proyecto.md`** — reflejar las carpetas nuevas `lib/maps-web/` y
  `lib/camera-web/` y su rol web-only.

Criterio: quien reciba la entrega debe poder clonar, instalar y **levantar la web en
localhost siguiendo solo el README**, sin conocimiento previo del proyecto.

## 11. Ficheros nuevos / tocados (resumen)

- **Nuevos web-only (capa 1, shims):** `lib/maps-web/index.tsx`, `lib/maps-web/geo.ts`,
  `lib/maps-web/geo.test.ts`, `lib/camera-web/index.tsx`, `lib/image-manipulator-web.ts`,
  `lib/file-system-web.ts`.
- **Nuevos web-only (capa 2, presentación):** `lib/responsive.ts`,
  `app/(tabs)/_layout.web.tsx`, `app/(tabs)/map.web.tsx`, `app/(tabs)/contribute.web.tsx`,
  y si el layout lo pide `app/verify/[parkingId].web.tsx`. Componentes de escritorio
  auxiliares en `components/web/` (rail de nav, panel lateral).
- **Aditivo (solo rama web / scripts / deps):** `metro.config.js` (amplía rama web),
  `package.json` (scripts `web*` + deps `maplibre-gl`, `serve`).
- **Documentación:** `README.md`, `docs/infraestructura.md`, `docs/arquitectura.md`,
  `docs/estructura-proyecto.md` (ver §10).
- **Eliminado:** `lib/maps-web-stub.js` (reemplazado por `lib/maps-web/`).
- **Sin tocar (lo que iOS resuelve):** pantallas `.tsx` nativas, `_layout.tsx`, todos
  los sub-componentes de dominio, features, hooks, stores, `lib/supabase.ts`, tests
  existentes, `app.config.ts` (ya tiene bloque `web`).
