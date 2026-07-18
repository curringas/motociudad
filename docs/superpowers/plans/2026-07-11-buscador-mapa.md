# Buscador de ubicaciones sobre el mapa — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una barra de búsqueda sobre el mapa que centre la vista en una calle o ciudad usando geocoding nativo, mostrando los parkings de esa zona.

**Architecture:** Nueva vertical slice `features/search/` (api → hook → componente). El componente `MapSearchBar` posee input, geocoding y estados; `map.tsx` solo recibe las coordenadas y anima el mapa. Reutiliza el ciclo de recarga por región ya existente (`onRegionChangeComplete` → `useNearbyParkings`).

**Tech Stack:** React Native + Expo, `expo-location` (`geocodeAsync`, ya es dependencia — **no se añaden libs nuevas**), TanStack Query v5 (`useMutation`), NativeWind, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-11-buscador-mapa-design.md`

## Global Constraints

- TypeScript `strict: true` y `noUncheckedIndexedAccess: true` — `array[0]` es `T | undefined`, hay que estrecharlo.
- Imports absolutos vía `@/`.
- Código y comentarios en **inglés**; copy de UI en **castellano (es-ES)**.
- Commits en **Conventional Commits**, en castellano, terminando con la línea `Co-Authored-By`.
- Un componente por archivo, PascalCase; hooks con prefijo `use`.
- **No se añaden dependencias** (expo-location ya está).
- **Deuda conocida RNTL + Vitest** (`project-test-infra-debt`): no se escriben tests de render de componentes ni de hooks; los tests automatizados cubren solo lógica pura (`api.ts`). Los deliverables de UI se verifican con `pnpm typecheck` + comprobación manual en simulador.

---

## Estructura de ficheros

```
apps/mobile/features/search/
├── api.ts                       # geocodeAddress(query) — Task 1
├── schemas.ts                   # GeocodeResult type — Task 1
├── hooks.ts                     # useGeocodeSearch() — Task 2
├── components/
│   └── MapSearchBar.tsx         # barra de búsqueda — Task 3
└── __tests__/
    └── api.test.ts              # test de geocodeAddress — Task 1

apps/mobile/app/(tabs)/map.tsx   # integración — Task 4 (modificar)

docs/prd.md                      # user story + feature — Task 5 (modificar)
docs/arquitectura.md             # nota geocoding — Task 5 (modificar)
docs/testing.md                  # ref a tests nuevos — Task 5 (modificar)
```

---

## Task 1: Geocoding — schema y api (con tests)

**Files:**
- Create: `apps/mobile/features/search/schemas.ts`
- Create: `apps/mobile/features/search/api.ts`
- Test: `apps/mobile/features/search/__tests__/api.test.ts`

**Interfaces:**
- Produces:
  - `type GeocodeResult = { latitude: number; longitude: number }` (en `schemas.ts`, re-exportado desde `api.ts`)
  - `async function geocodeAddress(query: string): Promise<GeocodeResult | null>` (en `api.ts`)

- [ ] **Step 1: Escribe el schema/tipo**

Crea `apps/mobile/features/search/schemas.ts`:

```ts
/** Coordinates returned by a successful geocoding lookup. */
export type GeocodeResult = {
  latitude: number;
  longitude: number;
};
```

- [ ] **Step 2: Escribe el test que falla**

Crea `apps/mobile/features/search/__tests__/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock expo-location so no native module is loaded under Vitest.
vi.mock('expo-location', () => ({
  geocodeAsync: vi.fn(),
}));

import * as Location from 'expo-location';
import { geocodeAddress } from '../api';

const mockGeocode = Location.geocodeAsync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('geocodeAddress', () => {
  it('devuelve el primer resultado cuando el geocoder encuentra la dirección', async () => {
    mockGeocode.mockResolvedValue([
      { latitude: 40.4168, longitude: -3.7038 },
      { latitude: 1, longitude: 2 },
    ]);

    const result = await geocodeAddress('Gran Vía, Madrid');

    expect(result).toEqual({ latitude: 40.4168, longitude: -3.7038 });
    expect(mockGeocode).toHaveBeenCalledWith('Gran Vía, Madrid');
  });

  it('devuelve null cuando el geocoder no encuentra nada', async () => {
    mockGeocode.mockResolvedValue([]);

    expect(await geocodeAddress('asdfghjkl')).toBeNull();
  });

  it('devuelve null y no llama al geocoder con query vacía', async () => {
    expect(await geocodeAddress('   ')).toBeNull();
    expect(mockGeocode).not.toHaveBeenCalled();
  });

  it('propaga el error cuando el geocoder lanza', async () => {
    mockGeocode.mockRejectedValue(new Error('geocoder down'));

    await expect(geocodeAddress('Madrid')).rejects.toThrow('geocoder down');
  });
});
```

- [ ] **Step 3: Ejecuta el test y verifica que falla**

Run: `cd apps/mobile && pnpm exec vitest run features/search/__tests__/api.test.ts`
Expected: FAIL — no se puede resolver `../api` (módulo inexistente).

- [ ] **Step 4: Implementa `api.ts`**

Crea `apps/mobile/features/search/api.ts`:

```ts
import * as Location from 'expo-location';
import type { GeocodeResult } from './schemas';

export type { GeocodeResult };

/**
 * Forward-geocodes a free-text address (street, city, etc.) using the OS
 * native geocoder via expo-location. Returns the top match, or null when the
 * query is empty or the geocoder finds nothing. Rejects if the geocoder fails.
 */
export async function geocodeAddress(
  query: string,
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;

  const results = await Location.geocodeAsync(trimmed);
  const first = results[0];
  if (!first) return null;

  return { latitude: first.latitude, longitude: first.longitude };
}
```

- [ ] **Step 5: Ejecuta el test y verifica que pasa**

Run: `cd apps/mobile && pnpm exec vitest run features/search/__tests__/api.test.ts`
Expected: PASS — 4 tests en verde.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck` (desde la raíz del repo)
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/features/search/schemas.ts apps/mobile/features/search/api.ts apps/mobile/features/search/__tests__/api.test.ts
git commit -m "$(cat <<'EOF'
feat(search): añade geocodeAddress con expo-location y sus tests

geocodeAddress(query) delega en Location.geocodeAsync y devuelve el primer
resultado, o null si la query está vacía o no hay coincidencias. Cubierto
con Vitest (expo-location mockeado).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Hook `useGeocodeSearch`

**Files:**
- Create: `apps/mobile/features/search/hooks.ts`

**Interfaces:**
- Consumes: `geocodeAddress`, `GeocodeResult` (de `./api`)
- Produces: `function useGeocodeSearch(): UseMutationResult<GeocodeResult | null, Error, string>`

> Sin test automatizado: probar un hook con `useMutation` exige `renderHook` +
> `QueryClientProvider`, que arrastra la deuda RNTL + Vitest. Se verifica con
> typecheck y, en Task 4, en simulador.

- [ ] **Step 1: Implementa el hook**

Crea `apps/mobile/features/search/hooks.ts`:

```ts
import { useMutation } from '@tanstack/react-query';
import { geocodeAddress, type GeocodeResult } from './api';

/**
 * Mutation wrapper around geocodeAddress. Exposes isPending / isError so the
 * search bar can show a spinner and an inline "not found / error" message.
 */
export function useGeocodeSearch() {
  return useMutation<GeocodeResult | null, Error, string>({
    mutationFn: (query: string) => geocodeAddress(query),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/features/search/hooks.ts
git commit -m "$(cat <<'EOF'
feat(search): añade hook useGeocodeSearch

useMutation sobre geocodeAddress; expone isPending/isError para que la barra
muestre spinner y mensaje inline.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Componente `MapSearchBar`

**Files:**
- Create: `apps/mobile/features/search/components/MapSearchBar.tsx`

**Interfaces:**
- Consumes: `useGeocodeSearch` (de `../hooks`), `GeocodeResult` (de `../api`)
- Produces: `function MapSearchBar(props: { onLocationFound: (coords: GeocodeResult) => void }): JSX.Element`

> Sin test de render (deuda RNTL + Vitest). Verificación: typecheck + simulador (Task 4).

- [ ] **Step 1: Implementa el componente**

Crea `apps/mobile/features/search/components/MapSearchBar.tsx`:

```tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGeocodeSearch } from '../hooks';
import type { GeocodeResult } from '../api';

type Props = {
  onLocationFound: (coords: GeocodeResult) => void;
};

/**
 * Search bar pinned to the top of the map. Geocodes the typed address and,
 * on a hit, hands the coordinates up to the map screen (which recenters).
 * Shows a spinner while searching and an inline message when nothing matches.
 */
export function MapSearchBar({ onLocationFound }: Props) {
  const [query, setQuery] = useState('');
  const [notFound, setNotFound] = useState(false);
  const geocode = useGeocodeSearch();

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    setNotFound(false);
    geocode.mutate(trimmed, {
      onSuccess: (result) => {
        if (result) onLocationFound(result);
        else setNotFound(true);
      },
      onError: () => setNotFound(true),
    });
  }, [query, geocode, onLocationFound]);

  const handleClear = useCallback(() => {
    setQuery('');
    setNotFound(false);
  }, []);

  return (
    <SafeAreaView edges={['top']} className="absolute top-0 left-0 right-0 z-20">
      <View className="mx-4 mt-2">
        <View className="flex-row items-center bg-surface rounded-pill px-4 py-2 border border-border shadow-lg">
          <Text className="text-content-muted text-base mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-content text-base"
            placeholder="Busca una calle o ciudad…"
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Buscar ubicación"
          />
          {geocode.isPending ? (
            <ActivityIndicator size="small" color="#FFD60A" />
          ) : query.length > 0 ? (
            <TouchableOpacity
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
            >
              <Text className="text-content-muted text-base ml-2">✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {notFound && (
          <View className="mx-1 mt-1 bg-surface/90 rounded-card px-3 py-2">
            <Text className="text-content-muted text-xs">
              No se encontró esa ubicación. Prueba con otra calle o ciudad.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/features/search/components/MapSearchBar.tsx
git commit -m "$(cat <<'EOF'
feat(search): añade componente MapSearchBar

Barra fija sobre el mapa: input, lupa, botón limpiar, spinner y mensaje
inline de "no encontrado". Al acertar, llama a onLocationFound con las
coordenadas.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integración en la pantalla del mapa

**Files:**
- Modify: `apps/mobile/app/(tabs)/map.tsx`

**Interfaces:**
- Consumes: `MapSearchBar` (de `@/features/search/components/MapSearchBar`), `GeocodeResult` (de `@/features/search/api`)

- [ ] **Step 1: Añade los imports**

En `apps/mobile/app/(tabs)/map.tsx`, tras la línea de import de `EmptyMapState` (`import { EmptyMapState } from '@/components/EmptyMapState';`), añade:

```tsx
import { MapSearchBar } from '@/features/search/components/MapSearchBar';
import type { GeocodeResult } from '@/features/search/api';
```

- [ ] **Step 2: Añade el handler que centra el mapa**

Dentro de `MapScreen`, junto a los demás `useCallback` (p. ej. después de `handleRecenter`), añade:

```tsx
const handleLocationFound = useCallback((coords: GeocodeResult) => {
  mapRef.current?.animateToRegion({
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  });
}, []);
```

- [ ] **Step 3: Monta la barra en el árbol**

En el `return`, justo después de la etiqueta de apertura `<View className="flex-1 bg-background">` y antes del comentario `{/* Map */}`, añade:

```tsx
      <MapSearchBar onLocationFound={handleLocationFound} />
```

- [ ] **Step 4: Reubica el banner de permisos para que no solape la barra**

En el bloque del banner de permisos, cambia el margen superior del `View` interno de `mt-2` a `mt-16` para que quede por debajo de la barra de búsqueda. Es decir, reemplaza:

```tsx
          <View className="mx-4 mt-2 bg-pending/90 rounded-card p-3 flex-row items-center">
```

por:

```tsx
          <View className="mx-4 mt-16 bg-pending/90 rounded-card p-3 flex-row items-center">
```

- [ ] **Step 5: Baja el indicador de carga de parkings para que no solape la barra**

Reemplaza:

```tsx
        <View className="absolute top-16 self-center bg-surface/90 rounded-pill px-4 py-2">
```

por:

```tsx
        <View className="absolute top-28 self-center bg-surface/90 rounded-pill px-4 py-2">
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: sin errores.

- [ ] **Step 7: Verificación manual en simulador**

Arranca la app (Expo dev server o el MCP de XcodeBuild sobre el simulador iOS) y comprueba:
1. La barra aparece fija arriba con el placeholder "Busca una calle o ciudad…".
2. Escribir "Barcelona" + buscar centra el mapa en Barcelona y cargan sus pins.
3. Escribir una calle con ciudad centra a nivel de barrio.
4. Una búsqueda sin sentido ("asdfghjkl") muestra el mensaje inline y no mueve el mapa.
5. La X limpia el texto y el mensaje.
6. El banner de permisos (si aplica) y el indicador de carga no solapan la barra.

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/app/(tabs)/map.tsx"
git commit -m "$(cat <<'EOF'
feat(search): integra el buscador en la pantalla del mapa

Monta MapSearchBar y centra el mapa (animateToRegion, zoom de barrio) al
encontrar la ubicación; reutiliza la recarga por región para mostrar los
parkings de la zona. Reubica banner de permisos e indicador de carga para
no solapar la barra.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Actualización de documentos canónicos

**Files:**
- Modify: `docs/prd.md`
- Modify: `docs/arquitectura.md`
- Modify: `docs/testing.md`

- [ ] **Step 1: PRD — añade la user story**

En `docs/prd.md`, en la sección de historias de usuario (donde están las líneas "Como motorista, quiero ver en un mapa los parkings cercanos…"), añade una nueva historia inmediatamente después de esa:

```markdown
- Como motorista viajero, quiero buscar una calle o ciudad para centrar el mapa en esa zona y ver los parkings disponibles allí, aunque esté lejos de mi ubicación.
```

- [ ] **Step 2: PRD — añade la feature a la tabla**

En la tabla de features de `docs/prd.md` (la que contiene las filas `F2 | Mapa interactivo con pins…` y `F3 | Lista filtrable…`), añade una fila tras `F3`:

```markdown
| F4 | Buscador de ubicaciones sobre el mapa | Centrar el mapa en una calle/ciudad buscada (geocoding nativo) para explorar parkings de otra zona |
```

> Si el identificador `F4` ya está en uso, usa el siguiente libre y ajusta el texto de la columna de id en consecuencia.

- [ ] **Step 3: Arquitectura — nota sobre geocoding**

En `docs/arquitectura.md`, en la sección que describe mapas/ubicación (o al final de la sección de stack móvil), añade:

```markdown
**Geocoding (búsqueda de ubicaciones):** el buscador del mapa usa forward
geocoding nativo vía `expo-location` (`geocodeAsync`), que delega en el
geocoder del sistema operativo. No requiere API key ni billing. Encapsulado en
`features/search/`. Si en el futuro se necesita autocompletado en vivo, se
migraría a un proveedor con Places API sin rehacer la UI.
```

- [ ] **Step 4: Testing — referencia a los tests nuevos**

En `docs/testing.md`, en la sección de tests unitarios de la app móvil (§4), añade a la lista de ejemplos/qué se testea:

```markdown
- `features/search/api.ts` — `geocodeAddress`: primer resultado, sin
  resultados (null), query vacía, propagación de error (con `expo-location`
  mockeado).
```

- [ ] **Step 5: Commit**

```bash
git add docs/prd.md docs/arquitectura.md docs/testing.md
git commit -m "$(cat <<'EOF'
docs(search): documenta el buscador de ubicaciones en specs canónicos

Añade user story del motorista viajero y feature F4 al PRD, nota de forward
geocoding con expo-location en arquitectura, y referencia a los tests de
features/search en testing.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verificación final

- [ ] `pnpm typecheck` sin errores.
- [ ] `cd apps/mobile && pnpm exec vitest run features/search/` en verde.
- [ ] Comprobación manual en simulador (Task 4, Step 7) superada.
- [ ] PRD, arquitectura y testing reflejan la feature.
