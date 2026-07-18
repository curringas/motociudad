# Versión web funcional de MotoCiudad — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servir MotoCiudad como web funcional en localhost (mapa, alta y verificación de parkings) sin modificar ni un fichero que resuelva el bundle de iOS.

**Architecture:** Misma app Expo (`apps/mobile`) en plataforma web. Aislamiento por ficheros `.web`/redirects de Metro condicionados a `platform === 'web'`. Las librerías nativas (`react-native-maps`, `expo-camera`, `expo-image-manipulator`, `expo-file-system/legacy`) se sustituyen en web por shims que exponen la **misma API pública**, de modo que las pantallas no cambian. El mapa web usa MapLibre GL JS con estilo oscuro keyless.

**Tech Stack:** Expo SDK 54 · React Native Web · MapLibre GL JS · TanStack Query · Supabase (remoto) · Vitest.

## Global Constraints

- **NO commits hasta verificación del usuario.** Todo el trabajo queda en el working tree del worktree. Los pasos "Commit" del formato estándar se sustituyen por checkpoints (`git status` para revisar); el commit final es la Task 13, solo tras OK del usuario.
- **Ni un fichero que iOS resuelva se modifica.** Solo se crean ficheros web-only (`*.web.tsx`, `lib/maps-web/`, `lib/camera-web/`, `lib/*-web.ts`, `components/web/`), se amplía la rama `platform === 'web'` de `metro.config.js`, y se añaden scripts/deps a `package.json`.
- **Dos capas:** (1) shims de módulo nativo (Tasks 3–5) para que las libs funcionen en navegador; (2) presentación web responsive (Tasks 6–9) — escritorio con rail+mapa+panel, móvil-web como la app actual.
- **Supabase remoto.** Requiere `apps/mobile/.env` presente en el worktree (copiado del repo principal, gitignored). `lib/supabase.ts` lanza error si faltan `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Idioma:** código y comentarios en inglés; copy de UI y docs en español (es-ES).
- **TypeScript:** `strict: true`, `noUncheckedIndexedAccess: true`, imports absolutos vía `@/`.
- **Mapa keyless:** estilo oscuro sin API key (CARTO dark-matter GL style, keyless con atribución).
- Rutas relativas a la raíz del worktree: `apps/mobile/` es el paquete Expo.

## File Structure

- `apps/mobile/lib/maps-web/geo.ts` — conversión pura región↔zoom (testeable).
- `apps/mobile/lib/maps-web/geo.test.ts` — tests unitarios de `geo.ts`.
- `apps/mobile/lib/maps-web/index.tsx` — shim de `react-native-maps` (MapView + Marker sobre MapLibre). Reemplaza `lib/maps-web-stub.js`.
- `apps/mobile/lib/camera-web/index.tsx` — shim de `expo-camera` (CameraView + useCameraPermissions sobre `<input type=file>`).
- `apps/mobile/lib/image-manipulator-web.ts` — shim de `expo-image-manipulator` (canvas).
- `apps/mobile/lib/file-system-web.ts` — shim de `expo-file-system/legacy` (readAsStringAsync base64).
- `apps/mobile/metro.config.js` — MODIFICAR: ampliar rama web con los redirects nuevos.
- `apps/mobile/package.json` — MODIFICAR: scripts `web*` + deps `maplibre-gl`, `serve`.
- `README.md`, `docs/infraestructura.md`, `docs/arquitectura.md`, `docs/estructura-proyecto.md` — MODIFICAR: documentación.

---

## Task 1: Entorno web + baseline verde

Levantar la web con el stub actual y confirmar que arranca contra Supabase remoto, antes de tocar nada. Establece la red de seguridad (typecheck + tests del móvil verdes).

**Files:**
- Copy: `apps/mobile/.env` (desde el repo principal, gitignored)
- Modify: `apps/mobile/package.json` (scripts + deps)

**Interfaces:**
- Produces: scripts `pnpm web`, `pnpm web:export`, `pnpm web:serve`; dependencia `maplibre-gl`, `serve`.

- [ ] **Step 1: Copiar el `.env` con credenciales remotas al worktree**

```bash
cp /Users/curro/Developer/AI4DEV/AI4Devs-finalproject/motociudad/apps/mobile/.env \
   /Users/curro/Developer/AI4DEV/AI4Devs-finalproject/motociudad/.claude/worktrees/web/apps/mobile/.env
```

- [ ] **Step 2: Confirmar que `.env` está gitignored (no se comiteará)**

Run: `cd apps/mobile && git check-ignore .env`
Expected: imprime `.env` (está ignorado). Si no imprime nada, PARAR y revisar `.gitignore`.

- [ ] **Step 3: Instalar dependencias web**

Run:
```bash
cd apps/mobile && pnpm add maplibre-gl && pnpm add -D serve
```
Expected: `maplibre-gl` en `dependencies`, `serve` en `devDependencies`.

- [ ] **Step 4: Añadir scripts web a `apps/mobile/package.json`**

En el bloque `"scripts"` añadir:
```json
    "web": "expo start --web",
    "web:export": "expo export --platform web",
    "web:serve": "serve dist --listen 3000"
```

- [ ] **Step 5: Baseline — typecheck y tests del proyecto en verde**

Run: `pnpm typecheck && pnpm test`
Expected: ambos PASAN. Es el estado de referencia del móvil; debe seguir igual al final.

- [ ] **Step 6: Levantar la web y confirmar arranque contra Supabase remoto**

Run: `cd apps/mobile && pnpm web`
Expected: compila y sirve en `http://localhost:8081`. Al abrirlo en el navegador NO aparece el error "Missing Supabase environment variables". El mapa se ve como placeholder oscuro "Mapa (solo móvil)" (stub actual todavía). Los datos de Supabase remoto responden (p. ej. login o llamadas a `nearby_parkings` no fallan por credenciales).

- [ ] **Step 7: Checkpoint (sin commit)**

Run: `git status`
Expected: `package.json` modificado; `.env` NO aparece (gitignored). Sin commit todavía.

---

## Task 2: Conversión región↔zoom (`geo.ts`) — TDD

Función pura que traduce el `longitudeDelta` de `react-native-maps` a un nivel de zoom de MapLibre, dado el ancho del viewport. La usa el shim de mapa para `initialRegion` y `animateToRegion`.

**Files:**
- Create: `apps/mobile/lib/maps-web/geo.ts`
- Test: `apps/mobile/lib/maps-web/geo.test.ts`

**Interfaces:**
- Produces:
  - `zoomFromLongitudeDelta(longitudeDelta: number, viewportWidthPx: number): number` — zoom clamp [1, 20].
  - `MAPLIBRE_TILE_SIZE = 512` (constante).

- [ ] **Step 1: Escribir el test que falla**

`apps/mobile/lib/maps-web/geo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { zoomFromLongitudeDelta } from './geo';

describe('zoomFromLongitudeDelta', () => {
  it('devuelve zoom 0 base cuando delta cubre el mundo en una teja de 512px', () => {
    // 360° a lo ancho de 512px => zoom 0, pero clamp mínimo es 1
    expect(zoomFromLongitudeDelta(360, 512)).toBeCloseTo(1, 5);
  });

  it('sube un nivel de zoom al duplicar el ancho del viewport', () => {
    const z1 = zoomFromLongitudeDelta(10, 512);
    const z2 = zoomFromLongitudeDelta(10, 1024);
    expect(z2 - z1).toBeCloseTo(1, 5);
  });

  it('un delta pequeño (0.01°) en 375px de ancho da zoom de ciudad (~13-15)', () => {
    const z = zoomFromLongitudeDelta(0.01, 375);
    expect(z).toBeGreaterThan(12);
    expect(z).toBeLessThan(16);
  });

  it('hace clamp a [1, 20]', () => {
    expect(zoomFromLongitudeDelta(1000, 100)).toBe(1);
    expect(zoomFromLongitudeDelta(0.0000001, 4000)).toBe(20);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `cd apps/mobile && pnpm test -- geo.test.ts`
Expected: FAIL (`Cannot find module './geo'` o `zoomFromLongitudeDelta is not a function`).

- [ ] **Step 3: Implementación mínima**

`apps/mobile/lib/maps-web/geo.ts`:
```ts
// Conversion helpers between react-native-maps Region deltas and MapLibre zoom.
// MapLibre uses 512px vector tiles; at zoom Z the world (360°) spans 512 * 2^Z px.
export const MAPLIBRE_TILE_SIZE = 512;

/**
 * Compute the MapLibre zoom level that shows `longitudeDelta` degrees across a
 * viewport `viewportWidthPx` pixels wide. Clamped to [1, 20].
 */
export function zoomFromLongitudeDelta(
  longitudeDelta: number,
  viewportWidthPx: number,
): number {
  const safeDelta = Math.max(longitudeDelta, 1e-9);
  const safeWidth = Math.max(viewportWidthPx, 1);
  const zoom = Math.log2((360 * safeWidth) / (MAPLIBRE_TILE_SIZE * safeDelta));
  return Math.min(Math.max(zoom, 1), 20);
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `cd apps/mobile && pnpm test -- geo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Checkpoint (sin commit)**

Run: `git status`
Expected: `lib/maps-web/geo.ts` y `geo.test.ts` nuevos. Sin commit.

---

## Task 3: Shim del mapa (`lib/maps-web/index.tsx`) sobre MapLibre

Sustituir el stub por un mapa real. Implementa el subconjunto de `react-native-maps` que usa la app: `MapView` (con `initialRegion`, `onRegionChangeComplete`, `showsUserLocation`, ref `animateToRegion`) y `Marker` (con `coordinate`, `onPress`, `children`), más las constantes `PROVIDER_DEFAULT`/`PROVIDER_GOOGLE`. Las pantallas y `ParkingMapPin.tsx` NO se tocan.

**Files:**
- Create: `apps/mobile/lib/maps-web/index.tsx`
- Modify: `apps/mobile/metro.config.js` (redirigir `react-native-maps` → `lib/maps-web/index.tsx`)
- Delete: `apps/mobile/lib/maps-web-stub.js`

**Interfaces:**
- Consumes: `zoomFromLongitudeDelta` (Task 2).
- Produces (API compatible con `react-native-maps`):
  - `default` export `MapView` — props `{ style, initialRegion, onRegionChangeComplete, showsUserLocation, children }`, ref con método `animateToRegion(region)`.
  - named `Marker` — props `{ coordinate: {latitude, longitude}, onPress?, children?, identifier? }`.
  - named `PROVIDER_DEFAULT = null`, `PROVIDER_GOOGLE = 'google'`.
  - type `Region = { latitude; longitude; latitudeDelta; longitudeDelta }`.

- [ ] **Step 1: Escribir el shim del mapa**

`apps/mobile/lib/maps-web/index.tsx`:
```tsx
// Web replacement for `react-native-maps`, backed by MapLibre GL JS.
// Implements ONLY the API surface the app uses (see map.tsx / contribute.tsx /
// ParkingMapPin.tsx). Bundled by Metro exclusively on web (see metro.config.js);
// native platforms never resolve this file.
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { zoomFromLongitudeDelta } from './geo';

// Keyless dark vector style with free tiles (attribution required, included by style).
const DARK_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const PROVIDER_DEFAULT = null;
export const PROVIDER_GOOGLE = 'google';

const MapContext = createContext<maplibregl.Map | null>(null);

type MapViewProps = {
  style?: unknown;
  initialRegion?: Region;
  onRegionChangeComplete?: (region: Region) => void;
  showsUserLocation?: boolean;
  children?: React.ReactNode;
  testID?: string;
  // Unsupported props (provider, customMapStyle, showsCompass, ...) are accepted and ignored.
  [key: string]: unknown;
};

export type MapViewHandle = {
  animateToRegion: (region: Region, duration?: number) => void;
};

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { initialRegion, onRegionChangeComplete, showsUserLocation, children, testID },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const width = containerRef.current.clientWidth || 375;
    const region = initialRegion ?? {
      latitude: 40.4168,
      longitude: -3.7038,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE_URL,
      center: [region.longitude, region.latitude],
      zoom: zoomFromLongitudeDelta(region.longitudeDelta, width),
      attributionControl: { compact: true },
    });

    if (showsUserLocation) {
      instance.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
        }),
      );
    }

    const emitRegion = () => {
      if (!onRegionChangeComplete) return;
      const c = instance.getCenter();
      const b = instance.getBounds();
      onRegionChangeComplete({
        latitude: c.lat,
        longitude: c.lng,
        latitudeDelta: Math.abs(b.getNorth() - b.getSouth()),
        longitudeDelta: Math.abs(b.getEast() - b.getWest()),
      });
    };
    instance.on('moveend', emitRegion);

    mapRef.current = instance;
    instance.once('load', () => setMap(instance));

    return () => {
      instance.remove();
      mapRef.current = null;
    };
    // Mount once; initialRegion changes are ignored (matches RN Maps behaviour).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region) => {
      const instance = mapRef.current;
      if (!instance) return;
      const width = containerRef.current?.clientWidth || 375;
      instance.flyTo({
        center: [region.longitude, region.latitude],
        zoom: zoomFromLongitudeDelta(region.longitudeDelta, width),
      });
    },
  }));

  return (
    <div
      ref={containerRef}
      data-testid={testID}
      style={{ position: 'relative', flex: 1, width: '100%', height: '100%' }}
    >
      {map ? (
        <MapContext.Provider value={map}>{children}</MapContext.Provider>
      ) : null}
    </div>
  );
});

type MarkerProps = {
  coordinate: { latitude: number; longitude: number };
  onPress?: () => void;
  children?: React.ReactNode;
  identifier?: string;
  [key: string]: unknown;
};

export function Marker({ coordinate, onPress, children }: MarkerProps) {
  const map = useContext(MapContext);
  const elRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  if (!elRef.current) {
    elRef.current = document.createElement('div');
    elRef.current.style.cursor = 'pointer';
  }

  useEffect(() => {
    if (!map || !elRef.current) return;
    const marker = new maplibregl.Marker({ element: elRef.current, anchor: 'bottom' })
      .setLngLat([coordinate.longitude, coordinate.latitude])
      .addTo(map);
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, coordinate.latitude, coordinate.longitude]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPress?.();
  };

  if (!elRef.current) return null;
  return createPortal(
    <div onClick={handleClick}>{children}</div>,
    elRef.current,
  );
}

// react-native-maps default export IS MapView, with named exports as properties too.
type MapViewComponent = typeof MapView & {
  Marker: typeof Marker;
  PROVIDER_DEFAULT: typeof PROVIDER_DEFAULT;
  PROVIDER_GOOGLE: typeof PROVIDER_GOOGLE;
};
const MapViewWithStatics = MapView as MapViewComponent;
MapViewWithStatics.Marker = Marker;
MapViewWithStatics.PROVIDER_DEFAULT = PROVIDER_DEFAULT;
MapViewWithStatics.PROVIDER_GOOGLE = PROVIDER_GOOGLE;

export default MapViewWithStatics;
```

- [ ] **Step 2: Actualizar el redirect de Metro y borrar el stub**

En `apps/mobile/metro.config.js`, dentro del `resolveRequest`, cambiar la rama del mapa para apuntar al nuevo módulo:
```js
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: path.resolve(__dirname, 'lib/maps-web/index.tsx'),
      type: 'sourceFile',
    };
  }
```
Luego borrar el stub antiguo:
```bash
rm apps/mobile/lib/maps-web-stub.js
```

- [ ] **Step 3: Verificar que el mapa real carga en web**

Run: `cd apps/mobile && pnpm web` (o recargar si ya corre)
Expected: en `http://localhost:8081` la pestaña Mapa muestra un mapa oscuro MapLibre real (no el placeholder). Al mover/zoom el mapa, la consola no muestra errores y aparecen pines de parkings de Supabase remoto.

- [ ] **Step 4: Verificar recentrado (animateToRegion)**

Con GPS del navegador permitido, pulsar el botón de recentrar (◎).
Expected: el mapa vuela a la ubicación del usuario sin errores.

- [ ] **Step 5: Regresión typecheck**

Run: `pnpm typecheck`
Expected: PASA (el shim tipa la API que consumen las pantallas).

- [ ] **Step 6: Checkpoint (sin commit)**

Run: `git status`
Expected: `lib/maps-web/index.tsx` nuevo, `metro.config.js` modificado, `lib/maps-web-stub.js` borrado. Sin commit.

---

## Task 4: Shim de cámara (`lib/camera-web/index.tsx`) sobre input de archivo

`expo-camera` no es fiable en navegador. El shim expone `CameraView` (con ref `takePictureAsync`) y `useCameraPermissions` sobre un `<input type="file" accept="image/*" capture>`. Al pulsar el botón de disparo existente de la pantalla, `takePictureAsync()` abre el selector y resuelve con `{ uri }` (object URL del fichero elegido). Pantallas intactas.

**Files:**
- Create: `apps/mobile/lib/camera-web/index.tsx`
- Modify: `apps/mobile/metro.config.js` (redirigir `expo-camera` → shim en web)

**Interfaces:**
- Produces (API compatible con `expo-camera`):
  - `CameraView` — componente con ref exponiendo `takePictureAsync(opts?): Promise<{ uri: string; width: number; height: number }>`. Acepta y ignora props `facing`, `style`.
  - `useCameraPermissions(): [Permission, () => Promise<Permission>]` con `Permission = { granted: boolean; canAskAgain: boolean; status: 'granted'; expires: 'never' }`.

- [ ] **Step 1: Escribir el shim de cámara**

`apps/mobile/lib/camera-web/index.tsx`:
```tsx
// Web replacement for `expo-camera`. Renders a neutral placeholder and, on
// takePictureAsync(), opens a native file picker (camera on mobile browsers).
// Bundled by Metro only on web; native never resolves this file.
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

export type CameraPermission = {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted';
  expires: 'never';
};

const GRANTED: CameraPermission = {
  granted: true,
  canAskAgain: true,
  status: 'granted',
  expires: 'never',
};

// File input needs no permission on web — always report granted.
export function useCameraPermissions(): [CameraPermission, () => Promise<CameraPermission>] {
  const [permission] = useState<CameraPermission>(GRANTED);
  const request = useCallback(async () => GRANTED, []);
  return [permission, request];
}

export type PictureResult = { uri: string; width: number; height: number };
export type CameraViewHandle = {
  takePictureAsync: (opts?: { quality?: number }) => Promise<PictureResult | undefined>;
};

type CameraViewProps = { style?: unknown; facing?: string; [key: string]: unknown };

export const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(
  function CameraView(_props, ref) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const resolverRef = useRef<((r: PictureResult | undefined) => void) | null>(null);

    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const resolve = resolverRef.current;
      resolverRef.current = null;
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!resolve) return;
      if (!file) return resolve(undefined);
      const uri = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ uri, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ uri, width: 0, height: 0 });
      img.src = uri;
    }, []);

    useImperativeHandle(ref, () => ({
      takePictureAsync: () =>
        new Promise<PictureResult | undefined>((resolve) => {
          resolverRef.current = resolve;
          inputRef.current?.click();
        }),
    }));

    return (
      <div
        style={{
          flex: 1,
          minHeight: 240,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e293b',
          color: '#94a3b8',
          fontSize: 13,
          borderRadius: 12,
        }}
      >
        <span>Pulsa el botón para seleccionar o hacer una foto</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={onChange}
        />
      </div>
    );
  },
);

export default { CameraView, useCameraPermissions };
```

- [ ] **Step 2: Añadir el redirect de Metro para `expo-camera`**

En `apps/mobile/metro.config.js`, dentro de `resolveRequest`, junto al del mapa:
```js
  if (platform === 'web' && moduleName === 'expo-camera') {
    return {
      filePath: path.resolve(__dirname, 'lib/camera-web/index.tsx'),
      type: 'sourceFile',
    };
  }
```

- [ ] **Step 3: Verificar el disparo de cámara en web (alta de parking)**

Run: `pnpm web` y navegar al paso 3 (Foto) del alta de parking.
Expected: al pulsar el botón de disparo se abre el selector de archivos; tras elegir una imagen, se muestra la vista previa (`photoUri`) sin errores de consola.

- [ ] **Step 4: Regresión typecheck**

Run: `pnpm typecheck`
Expected: PASA.

- [ ] **Step 5: Checkpoint (sin commit)**

Run: `git status`
Expected: `lib/camera-web/index.tsx` nuevo, `metro.config.js` modificado. Sin commit.

---

## Task 5: Shims de imagen (`image-manipulator-web.ts`, `file-system-web.ts`)

`contribute.tsx` y `verify` procesan la foto con `ImageManipulator.manipulateAsync(...)` y leen base64 con `FileSystem.readAsStringAsync(uri, { encoding: Base64 })`. En web se reimplementan con `<canvas>` y `fetch(uri)`. Pantallas intactas.

**Files:**
- Create: `apps/mobile/lib/image-manipulator-web.ts`
- Create: `apps/mobile/lib/file-system-web.ts`
- Modify: `apps/mobile/metro.config.js` (redirigir `expo-image-manipulator` y `expo-file-system/legacy` en web)

**Interfaces:**
- Produces `expo-image-manipulator` compat:
  - `manipulateAsync(uri: string, actions: unknown[], opts?: { compress?: number; format?: string }): Promise<{ uri: string; width: number; height: number }>`
  - `SaveFormat = { JPEG: 'jpeg', PNG: 'png' }`
- Produces `expo-file-system/legacy` compat:
  - `readAsStringAsync(uri: string, opts?: { encoding?: string }): Promise<string>` (base64 sin prefijo `data:`)
  - `EncodingType = { Base64: 'base64', UTF8: 'utf8' }`

- [ ] **Step 1: Escribir el shim de image-manipulator**

`apps/mobile/lib/image-manipulator-web.ts`:
```ts
// Web replacement for `expo-image-manipulator`. Re-encodes the image via canvas,
// which strips EXIF and applies JPEG compression. Only the subset used by the app.
export const SaveFormat = { JPEG: 'jpeg', PNG: 'png' } as const;

type ManipulateResult = { uri: string; width: number; height: number };

export async function manipulateAsync(
  uri: string,
  _actions: unknown[],
  opts?: { compress?: number; format?: string },
): Promise<ManipulateResult> {
  const img = await loadImage(uri);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0);
  const mime = opts?.format === SaveFormat.PNG ? 'image/png' : 'image/jpeg';
  const quality = opts?.compress ?? 0.8;
  const dataUri = canvas.toDataURL(mime, quality);
  return { uri: dataUri, width: canvas.width, height: canvas.height };
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image: ' + uri));
    img.src = uri;
  });
}

export default { manipulateAsync, SaveFormat };
```

- [ ] **Step 2: Escribir el shim de file-system/legacy**

`apps/mobile/lib/file-system-web.ts`:
```ts
// Web replacement for `expo-file-system/legacy`. Only readAsStringAsync(Base64),
// used to turn a local photo URI into base64 for upload.
export const EncodingType = { Base64: 'base64', UTF8: 'utf8' } as const;

export async function readAsStringAsync(
  uri: string,
  opts?: { encoding?: string },
): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  if (opts?.encoding === EncodingType.UTF8) {
    return blob.text();
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  // Strip the `data:<mime>;base64,` prefix — callers expect raw base64.
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export default { readAsStringAsync, EncodingType };
```

- [ ] **Step 3: Añadir los redirects de Metro**

En `apps/mobile/metro.config.js`, dentro de `resolveRequest`:
```js
  if (platform === 'web' && moduleName === 'expo-image-manipulator') {
    return {
      filePath: path.resolve(__dirname, 'lib/image-manipulator-web.ts'),
      type: 'sourceFile',
    };
  }
  if (
    platform === 'web' &&
    (moduleName === 'expo-file-system/legacy' || moduleName === 'expo-file-system')
  ) {
    return {
      filePath: path.resolve(__dirname, 'lib/file-system-web.ts'),
      type: 'sourceFile',
    };
  }
```

- [ ] **Step 4: Verificar subida de foto end-to-end (alta de parking)**

Run: `pnpm web`, completar el alta de parking con foto y enviar.
Expected: la foto se comprime, se convierte a base64 y se sube a Supabase Storage remoto sin errores; el parking queda creado (verificar en la app o en Supabase).

- [ ] **Step 5: Verificar el flujo de verificación con foto**

Navegar a verificar un parking, hacer foto y enviar.
Expected: la verificación se registra en Supabase remoto sin errores.

- [ ] **Step 6: Regresión typecheck**

Run: `pnpm typecheck`
Expected: PASA.

- [ ] **Step 7: Checkpoint (sin commit)**

Run: `git status`
Expected: dos ficheros nuevos + `metro.config.js` modificado. Sin commit.

---

## Task 6: Hook responsive (`lib/responsive.ts`) — TDD

Selección de layout por ancho de ventana. Función pura testeable + hook que la envuelve.

**Files:**
- Create: `apps/mobile/lib/responsive.ts`
- Test: `apps/mobile/lib/responsive.test.ts`

**Interfaces:**
- Produces:
  - `type Breakpoint = 'mobile' | 'tablet' | 'desktop'`
  - `breakpointForWidth(width: number): Breakpoint` (mobile <768, tablet 768–1023, desktop ≥1024)
  - `useBreakpoint(): Breakpoint` (hook sobre `useWindowDimensions`)

- [ ] **Step 1: Test que falla**

`apps/mobile/lib/responsive.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { breakpointForWidth } from './responsive';

describe('breakpointForWidth', () => {
  it('clasifica anchos', () => {
    expect(breakpointForWidth(375)).toBe('mobile');
    expect(breakpointForWidth(767)).toBe('mobile');
    expect(breakpointForWidth(768)).toBe('tablet');
    expect(breakpointForWidth(1023)).toBe('tablet');
    expect(breakpointForWidth(1024)).toBe('desktop');
    expect(breakpointForWidth(1920)).toBe('desktop');
  });
});
```

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `cd apps/mobile && pnpm test -- responsive.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementación**

`apps/mobile/lib/responsive.ts`:
```ts
import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function breakpointForWidth(width: number): Breakpoint {
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return breakpointForWidth(width);
}
```

- [ ] **Step 4: Ejecutar y ver pasar**

Run: `cd apps/mobile && pnpm test -- responsive.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint (sin commit)** — `git status`.

---

## Task 7: Navegación de escritorio (`_layout.web.tsx` + rail)

En web, sustituir la barra de pestañas por un rail de iconos en escritorio/tablet y mantener pestañas en móvil. Mismas rutas de `expo-router`.

**Files:**
- Read primero: `apps/mobile/app/(tabs)/_layout.tsx` (para replicar rutas/orden/iconos y el tema).
- Create: `apps/mobile/app/(tabs)/_layout.web.tsx`
- Create: `apps/mobile/components/web/NavRail.tsx`

**Interfaces:**
- Consumes: `useBreakpoint` (Task 6).
- Produces: layout web que, en `mobile`, renderiza el mismo `Tabs` que el nativo; en `tablet`/`desktop`, un `NavRail` lateral + `<Slot />` para el contenido.

- [ ] **Step 1: Leer el `_layout.tsx` nativo** para replicar exactamente las rutas, orden, títulos e iconos y no divergir.

Run: `cat "apps/mobile/app/(tabs)/_layout.tsx"`
Expected: lista de `Tabs.Screen` (map, list, contribute, ranking, profile) con sus iconos y opciones.

- [ ] **Step 2: Crear `NavRail.tsx`** (rail vertical de iconos, tema oscuro, item activo resaltado). Usa `usePathname`/`router` de expo-router y los mismos iconos que el nativo. Copiar la paleta del `_layout.tsx` nativo.

```tsx
// apps/mobile/components/web/NavRail.tsx — desktop/tablet left icon rail (web-only).
import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

type Item = { href: string; label: string; icon: string };
const ITEMS: Item[] = [
  { href: '/(tabs)/map', label: 'Mapa', icon: '🗺️' },
  { href: '/(tabs)/list', label: 'Lista', icon: '📋' },
  { href: '/(tabs)/contribute', label: 'Aportar', icon: '➕' },
  { href: '/(tabs)/ranking', label: 'Ranking', icon: '🏆' },
  { href: '/(tabs)/profile', label: 'Perfil', icon: '👤' },
];

export function NavRail({ expanded = false }: { expanded?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <View
      style={{
        width: expanded ? 200 : 72,
        backgroundColor: '#0f172a',
        borderRightWidth: 1,
        borderRightColor: '#1e293b',
        paddingVertical: 16,
        alignItems: expanded ? 'flex-start' : 'center',
        gap: 8,
      }}
    >
      {ITEMS.map((item) => {
        const active = pathname.includes(item.href.split('/').pop() as string);
        return (
          <Pressable
            key={item.href}
            onPress={() => router.navigate(item.href as never)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              paddingHorizontal: expanded ? 16 : 0,
              width: '100%',
              justifyContent: expanded ? 'flex-start' : 'center',
              backgroundColor: active ? '#1e293b' : 'transparent',
              borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 22 }}>{item.icon}</Text>
            {expanded ? (
              <Text style={{ color: active ? '#FFD60A' : '#94a3b8', fontSize: 15 }}>
                {item.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
```
(Ajustar `href`/iconos a los reales tras el Step 1.)

- [ ] **Step 3: Crear `_layout.web.tsx`**

```tsx
// apps/mobile/app/(tabs)/_layout.web.tsx — web-only responsive nav shell.
// mobile width => same Tabs as native; tablet/desktop => left NavRail + content.
import React from 'react';
import { View } from 'react-native';
import { Slot } from 'expo-router';
import { useBreakpoint } from '@/lib/responsive';
import { NavRail } from '@/components/web/NavRail';
import NativeTabsLayout from './_layout';

export default function WebTabsLayout() {
  const bp = useBreakpoint();
  if (bp === 'mobile') {
    return <NativeTabsLayout />;
  }
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' }}>
      <NavRail expanded={bp === 'desktop'} />
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </View>
  );
}
```
NOTA: si reusar `NativeTabsLayout` da problemas con `<Slot/>` anidado, replicar el `Tabs` del nativo aquí para el caso mobile (sin importar el fichero nativo). Verificar en el Step siguiente.

- [ ] **Step 4: Verificar navegación en los tres anchos**

Run: `pnpm web`; redimensionar la ventana.
Expected: <768px pestañas abajo; ≥768px rail lateral (compacto en tablet, con etiquetas en desktop). Navegar entre secciones funciona en todos.

- [ ] **Step 5: Regresión typecheck** — `pnpm typecheck` PASA.
- [ ] **Step 6: Checkpoint (sin commit)** — `git status`.

---

## Task 8: Pantalla de mapa responsive (`map.web.tsx`)

Layout de escritorio: mapa a pantalla completa + panel derecho (lista de cercanos + detalle del seleccionado). En móvil-web, la composición actual. Reutiliza los mismos hooks y sub-componentes.

**Files:**
- Read primero: `apps/mobile/app/(tabs)/map.tsx` (para reutilizar hooks/handlers y no divergir la lógica).
- Create: `apps/mobile/app/(tabs)/map.web.tsx`
- Create: `apps/mobile/components/web/ParkingSidePanel.tsx`

**Interfaces:**
- Consumes: `useBreakpoint`, `useNearbyParkings`, `useUserLocation`, `useFiltersStore`, `useUiStore`, `ParkingMapPin`, `ParkingBottomSheet` (móvil), MapView shim.
- Produces: pantalla `MapScreen` web responsive.

- [ ] **Step 1: Releer `map.tsx`** y extraer mentalmente: hooks usados, `radiusFromDelta`, handlers (`handleRegionChangeComplete`, `handlePinPress`, `handleRecenter`), estado (`center`, `radiusM`, `selectedParking`). El `.web.tsx` replica esa orquestación reutilizando los mismos hooks (NO se importa lógica privada del `.tsx`; se reescribe el shell reusando hooks públicos).

- [ ] **Step 2: Crear `ParkingSidePanel.tsx`** — panel derecho (desktop) con lista de parkings cercanos (reutilizando el render de item si existe, o uno simple) y, al seleccionar, el detalle (reutilizar el contenido de `ParkingBottomSheet` o componer con los mismos datos `NearbyParking`).

```tsx
// apps/mobile/components/web/ParkingSidePanel.tsx — desktop right panel (web-only).
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import type { NearbyParking } from '@/types/domain';
import { formatDistance } from '@/lib/distance';

type Props = {
  parkings: NearbyParking[];
  selected: NearbyParking | null;
  onSelect: (p: NearbyParking) => void;
};

export function ParkingSidePanel({ parkings, selected, onSelect }: Props) {
  return (
    <View style={{ width: 360, backgroundColor: '#0f172a', borderLeftWidth: 1, borderLeftColor: '#1e293b' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
          Parkings cercanos ({parkings.length})
        </Text>
        {parkings.map((p) => {
          const active = selected?.id === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => onSelect(p)}
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: active ? '#1e293b' : '#111827',
                borderWidth: 1,
                borderColor: active ? '#FFD60A' : '#1e293b',
              }}
            >
              <Text style={{ color: '#f8fafc', fontWeight: '600' }}>{p.name}</Text>
              <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                {formatDistance(p.distance_meters)} · {p.type === 'public' ? 'Público' : 'Privado'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
```
(Ajustar campos a los reales de `NearbyParking` tras releer `types/domain` y `ParkingBottomSheet`.)

- [ ] **Step 3: Crear `map.web.tsx`** — replica la orquestación de `map.tsx` (hooks + handlers + estado) y ramifica por breakpoint: `mobile` = misma composición que el nativo (MapView full + `ParkingBottomSheet`); `desktop`/`tablet` = MapView + `ParkingSidePanel` (o overlay en tablet). Usa el shim MapView (resuelto por Metro), `ParkingMapPin`, y el orden estable por ID como en `map.tsx`.

Estructura (rellenar con los mismos hooks/handlers observados en `map.tsx`):
```tsx
// apps/mobile/app/(tabs)/map.web.tsx — web-only responsive map screen.
import React, { useMemo, useState, useCallback, useRef } from 'react';
import { View } from 'react-native';
import MapView, { type Region, PROVIDER_DEFAULT } from 'react-native-maps';
import { useBreakpoint } from '@/lib/responsive';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useNearbyParkings } from '@/features/parkings/hooks';
import { useFiltersStore } from '@/stores/filtersStore';
import { useUiStore } from '@/stores/uiStore';
import { ParkingMapPin } from '@/features/parkings/components/ParkingMapPin';
import { ParkingBottomSheet } from '@/components/ParkingBottomSheet';
import { ParkingSidePanel } from '@/components/web/ParkingSidePanel';
import type { NearbyParking } from '@/types/domain';

// Reuse the exact search-radius helper contract from map.tsx.
function radiusFromDelta(latDelta: number, lngDelta: number): number {
  const latM = (latDelta / 2) * 111_000;
  const lngM = (lngDelta / 2) * 111_000;
  const diagonal = Math.sqrt(latM * latM + lngM * lngM);
  return Math.round(Math.min(Math.max(diagonal * 1.5, 1_000), 15_000));
}

export default function MapScreenWeb() {
  const bp = useBreakpoint();
  const { location } = useUserLocation();
  const { parkingType, onlyVerified } = useFiltersStore();
  const setMapCenter = useUiStore((s) => s.setMapCenter);
  const mapRef = useRef<React.ElementRef<typeof MapView>>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusM, setRadiusM] = useState(2000);
  const [selected, setSelected] = useState<NearbyParking | null>(null);
  const filterString = parkingType === 'all' ? undefined : parkingType;
  const { data: parkings = [] } = useNearbyParkings(center, radiusM, filterString, onlyVerified);
  const sorted = useMemo(() => [...parkings].sort((a, b) => a.id.localeCompare(b.id)), [parkings]);

  const initialRegion: Region = {
    latitude: location?.latitude ?? 40.4168,
    longitude: location?.longitude ?? -3.7038,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const onRegionChangeComplete = useCallback((r: Region) => {
    const c = { lat: r.latitude, lng: r.longitude };
    setCenter(c);
    setMapCenter(c);
    setRadiusM(radiusFromDelta(r.latitudeDelta, r.longitudeDelta));
  }, [setMapCenter]);

  const map = (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      provider={PROVIDER_DEFAULT}
      initialRegion={initialRegion}
      showsUserLocation
      onRegionChangeComplete={onRegionChangeComplete}
      testID="map-view"
    >
      {sorted.map((p) => (
        <ParkingMapPin key={p.id} parking={p} onPress={() => setSelected(p)} />
      ))}
    </MapView>
  );

  if (bp === 'mobile') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        {map}
        <ParkingBottomSheet parking={selected} onClose={() => setSelected(null)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' }}>
      <View style={{ flex: 1 }}>{map}</View>
      <ParkingSidePanel parkings={sorted} selected={selected} onSelect={setSelected} />
    </View>
  );
}
```

- [ ] **Step 4: Verificar en escritorio y en móvil**

Run: `pnpm web`; ancho ≥1024: mapa + panel derecho con lista; click en item o pin selecciona y resalta. Ancho <768: mapa full + bottom sheet.
Expected: pines de Supabase remoto en ambos; sin errores de consola.

- [ ] **Step 5: Regresión typecheck** — `pnpm typecheck` PASA.
- [ ] **Step 6: Checkpoint (sin commit)** — `git status`.

---

## Task 9: Alta de parking responsive (`contribute.web.tsx`)

El asistente de 3 pasos colocado en columna/panel en escritorio; a pantalla completa en móvil. Misma lógica y shim de cámara.

**Files:**
- Read primero: `apps/mobile/app/(tabs)/contribute.tsx`.
- Create: `apps/mobile/app/(tabs)/contribute.web.tsx`

**Interfaces:**
- Consumes: `useBreakpoint`, `useProposeParking`, `useCheckDuplicates`, `useNearbyParkings`, `useUserLocation`, shim de `expo-camera`/`ImageManipulator`/`FileSystem`, `ParkingMapPin`, MapView shim.
- Produces: pantalla `ContributeScreen` web responsive.

- [ ] **Step 1: Releer `contribute.tsx`** para replicar los 3 pasos, estado y handlers reutilizando los mismos hooks públicos.

- [ ] **Step 2: Crear `contribute.web.tsx`** — misma máquina de pasos que el nativo, envuelta en un contenedor centrado con `maxWidth` (~560px) en escritorio y a pantalla completa en móvil. El paso "Foto" usa el `<CameraView>` (shim) con el botón de disparo existente. Reutilizar los sub-componentes/inputs; NO importar estado privado del `.tsx`.

Contenedor responsive (envuelve el cuerpo del asistente):
```tsx
// apps/mobile/app/(tabs)/contribute.web.tsx — web-only responsive contribute wizard.
// The wizard body reuses the same hooks/components as contribute.tsx; only the
// outer container adapts (centered max-width column on desktop, full-bleed on mobile).
import React from 'react';
import { View, ScrollView } from 'react-native';
import { useBreakpoint } from '@/lib/responsive';
// ...import the same hooks/components used by contribute.tsx and build the 3 steps.

function ContributeWizard() {
  // Replica del flujo de contribute.tsx (pasos Ubicación/Detalles/Foto) usando los
  // mismos hooks: useProposeParking, useCheckDuplicates, useNearbyParkings,
  // useUserLocation, CameraView (shim), ImageManipulator (shim), FileSystem (shim).
  // Devuelve el cuerpo del asistente.
  return null; // (rellenar durante implementación con los pasos reales)
}

export default function ContributeScreenWeb() {
  const bp = useBreakpoint();
  if (bp === 'mobile') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <ContributeWizard />
      </View>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0f172a' }}
      contentContainerStyle={{ alignItems: 'center', paddingVertical: 32 }}
    >
      <View style={{ width: '100%', maxWidth: 560, paddingHorizontal: 24 }}>
        <ContributeWizard />
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 3: Verificar el alta en escritorio y móvil**

Run: `pnpm web`; completar los 3 pasos con foto (input de archivo) y enviar, en ancho desktop y en ancho móvil.
Expected: parking creado en Supabase remoto en ambos; sin errores.

- [ ] **Step 4: Verificación (`verify/[parkingId]`) responsive**

Comprobar el flujo de verificación en web (desktop y móvil). Si el layout a pantalla completa ya se ve bien en escritorio, NO crear variante; si no, crear `app/verify/[parkingId].web.tsx` con el mismo patrón de contenedor centrado. Decidir por observación.

- [ ] **Step 5: Regresión typecheck** — `pnpm typecheck` PASA.
- [ ] **Step 6: Checkpoint (sin commit)** — `git status`.

---

## Task 10: Auditoría de módulos nativos en el build web

Otros módulos nativos pueden fallar al cargar en web (`@sentry/react-native`, `posthog-react-native`, `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-gesture-handler`). Detectar y neutralizar con guardas/shims **web-only**. No se toca código nativo.

**Files:**
- Create (solo si hace falta): `apps/mobile/lib/<modulo>-web.ts` + redirect en `metro.config.js`
- Modify (solo si hace falta): `apps/mobile/metro.config.js`

**Interfaces:**
- Produces: build web sin errores de módulo en consola ni pantalla en blanco.

- [ ] **Step 1: Cargar cada pantalla y recoger errores de consola**

Run: `pnpm web` y navegar por: Mapa, Lista, Aportar, Ranking, Perfil, detalle de parking, verificar.
Recoger en la consola del navegador cualquier error del tipo `X is not a function` / `Cannot read property of undefined` / `requireNativeModule` proveniente de un módulo nativo.

- [ ] **Step 2: Para cada módulo que rompa, crear shim web mínimo o guarda**

Patrón (ejemplo genérico para un módulo de analítica que peta al inicializar):
```ts
// apps/mobile/lib/<modulo>-web.ts — no-op web shim
export default new Proxy({}, { get: () => () => undefined });
```
Y su redirect en `metro.config.js` dentro de la rama `platform === 'web'` (mismo patrón que Task 4/5). Documentar en el commit final qué se apagó y por qué.

- [ ] **Step 3: Verificar que ninguna pantalla queda en blanco**

Run: `pnpm web`, recorrer todas las pantallas.
Expected: todas renderizan; consola sin errores rojos de módulos nativos.

- [ ] **Step 4: Checkpoint (sin commit)**

Run: `git status`
Expected: solo ficheros web-only nuevos y/o `metro.config.js`. Sin commit.

---

## Task 11: Verificación end-to-end de la web (Playwright)

Recorrido funcional completo con el navegador conducido por Playwright MCP, con capturas como evidencia para la entrega.

**Files:** ninguno (verificación).

- [ ] **Step 1: Export estático y servir por HTTP**

Run:
```bash
cd apps/mobile && pnpm web:export && pnpm web:serve
```
Expected: `dist/` generado; sitio servido en `http://localhost:3000`.

- [ ] **Step 2: Recorrido con Playwright MCP y capturas**

Con las herramientas `mcp__plugin_playwright_playwright__*`:
- Navegar a `http://localhost:3000`.
- Login (si aplica) contra Supabase remoto.
- Mapa: confirmar mapa oscuro + pines; abrir un pin → bottom sheet de detalle. Captura.
- Alta de parking: 3 pasos (ubicación, detalles, foto vía input) → enviar. Captura.
- Verificación: foto + ubicación → enviar. Captura.
Expected: cada paso funciona sin errores; capturas guardadas.

- [ ] **Step 3: Resumen de evidencias al usuario**

Presentar capturas y resultado. Punto de decisión: ¿la web funciona bien? (Gate del usuario antes de cualquier commit.)

---

## Task 12: Documentación (entrega máster AI4Devs)

Documentar dónde corresponde para que el tribunal pueda clonar y probar la web solo con el README.

**Files:**
- Modify: `README.md`
- Modify: `docs/infraestructura.md`
- Modify: `docs/arquitectura.md`
- Modify: `docs/estructura-proyecto.md`

- [ ] **Step 1: README — sección de arranque web**

En la sección de comandos/arranque (~línea 334, junto a `pnpm dev:mobile`) añadir subsección "Versión web (localhost)":
```markdown
### Versión web (localhost)

La app corre también en el navegador (mismo código, plataforma web de Expo).

```bash
cp apps/mobile/.env.example apps/mobile/.env   # rellenar con credenciales Supabase
pnpm install
pnpm --filter mobile web                        # http://localhost:8081 (desarrollo)
# Build estático servido por HTTP:
pnpm --filter mobile web:export
pnpm --filter mobile web:serve                  # http://localhost:3000
```

Requiere el mismo `.env` de Supabase remoto que el móvil.
```

- [ ] **Step 2: README — tabla de limitaciones (~línea 79)**

Actualizar la fila "Versión web" para reflejar que ya es funcional vía shims: mapa MapLibre (en vez de mapa nativo), captura de foto mediante selector de archivo del navegador.

- [ ] **Step 3: `docs/arquitectura.md` — patrón de aislamiento por plataforma**

Añadir apartado que documente: ficheros `.web` + redirects de Metro (`platform === 'web'`) + shims de módulo nativo (`react-native-maps`→MapLibre, `expo-camera`→input de archivo, image/file-system→canvas/fetch). Justificar que la web no toca el código móvil.

- [ ] **Step 4: `docs/infraestructura.md` — target web local**

En la tabla de Entornos / sección local, añadir el target web (comandos `web`, `web:export`, `web:serve`) como forma adicional de ejecutar en local.

- [ ] **Step 5: `docs/estructura-proyecto.md` — carpetas web-only**

Reflejar `apps/mobile/lib/maps-web/`, `lib/camera-web/`, `lib/image-manipulator-web.ts`, `lib/file-system-web.ts` y su rol web-only.

- [ ] **Step 6: Checkpoint (sin commit)**

Run: `git status`
Expected: README + 3 docs modificados. Sin commit.

---

## Task 13: Gate de regresión + commit final (solo tras OK del usuario)

**Files:** ninguno (verificación + commit).

- [ ] **Step 1: Regresión completa del móvil**

Run: `pnpm typecheck && pnpm test`
Expected: ambos PASAN (mismo estado que el baseline de Task 1). Confirma que el móvil no se rompió.

- [ ] **Step 2: Confirmar con el usuario que la web funciona**

NO continuar hasta que el usuario confirme explícitamente que la web está OK (Task 7).

- [ ] **Step 3: Crear rama y commitear (solo tras OK)**

```bash
git checkout -b feat/version-web
git add apps/mobile/lib apps/mobile/metro.config.js apps/mobile/package.json \
        pnpm-lock.yaml README.md docs/
git status   # confirmar que .env NO está en el stage
git commit -m "feat(web): versión web funcional con shims de mapa y cámara

- Mapa web con MapLibre GL (shim de react-native-maps)
- Foto vía input de archivo (shims de expo-camera/image-manipulator/file-system)
- Scripts web + docs de arranque para la entrega
- Cero cambios en código que resuelve iOS

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
Expected: commit creado en rama `feat/version-web`; `.env` NO incluido.

---

## Self-Review

**Spec coverage:**
- §2 aislamiento por plataforma → Tasks 3–6 (redirects en rama web) + Global Constraints. ✓
- §3 estructura mismo proyecto → File Structure + Tasks 2–5. ✓
- §4 shims (maps/camera/location/image) → Tasks 3, 4, 5; location ya funciona (verificado en Task 6 recorrido). ✓
- §4bis Supabase remoto (.env) → Task 1 Steps 1–2, 6. ✓
- §5 servir por HTTP → Task 1 (scripts), Task 7 (export+serve). ✓
- §7 riesgos (fidelidad API, otros módulos, regresión, customMapStyle) → Tasks 3 (geo TDD), 6 (auditoría), 9 (regresión), 3 Step1 (estilo dark equivalente). ✓
- §7bis no commits hasta verificar → Global Constraints + checkpoints + Task 9 gate. ✓
- §8 verificación → Tasks 7 y 9. ✓
- §10 documentación → Task 8. ✓

**Placeholder scan:** sin TBD/TODO; Task 6 es intencionadamente adaptativa (auditoría) pero con patrón de shim concreto y criterio de aceptación medible (sin errores de consola). ✓

**Type consistency:** `zoomFromLongitudeDelta(delta, width)` usado igual en Task 2/3. `Region`, `Marker`, `PROVIDER_*` coherentes entre shim y uso en pantallas. `manipulateAsync`/`SaveFormat`/`readAsStringAsync`/`EncodingType` con las firmas exactas observadas en `contribute.tsx` y `verify`. ✓
