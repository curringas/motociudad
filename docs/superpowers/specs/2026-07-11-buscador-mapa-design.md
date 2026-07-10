# Diseño — Buscador de ubicaciones sobre el mapa

- **Fecha:** 2026-07-11
- **Estado:** Aprobado (diseño) — pendiente de plan de implementación
- **Rama:** `feature-entrega2-CMH`

## 1. Problema y objetivo

Hoy el mapa solo se centra en la ubicación GPS del usuario (o Madrid como
fallback). El **motorista viajero** —persona explícita del PRD— llega a una
ciudad nueva y no puede explorar los parkings de una calle o zona concreta sin
desplazarse manualmente por el mapa.

**Objetivo:** añadir un buscador sobre el mapa que permita escribir una calle,
ciudad o dirección y centrar el mapa en esa zona, mostrando automáticamente los
parkings disponibles allí.

## 2. Alcance

**Feature nueva, no contemplada en el PRD actual.** El "Flujo B — Buscar y
navegar" del PRD se refiere a *tap en parking → detalle → llévame*, no a un
buscador de direcciones. Este cambio añade la feature y actualiza el PRD en el
mismo commit (regla de mantenimiento de specs del proyecto).

Dentro de alcance:
- Buscar por texto libre (calle / ciudad / dirección) usando geocoding nativo.
- Centrar el mapa en el resultado.

Fuera de alcance (YAGNI):
- Autocompletado en vivo / sugerencias (requeriría Google Places API + billing).
- Pin de referencia en el punto buscado (se descartó por simplicidad).
- Historial de búsquedas / favoritos.

## 3. Decisiones de diseño

### 3.1 Geocoding: `expo-location` (gratis, sin API key)
Se usa `Location.geocodeAsync(query)`, que delega en el geocoder nativo del
sistema operativo (Apple/Google del propio dispositivo). No requiere API key ni
billing. `expo-location` ya es dependencia del proyecto.

Alternativas descartadas: Google Places Autocomplete (mejor UX pero exige API
key + billing + coste por petición) y Nominatim/OSM (límites de uso y
atribución). Para un MVP, `expo-location` resuelve el valor principal —llevarte
a la zona— sin fricción. Si en el futuro se quiere autocompletado, se migra sin
rehacer la UI.

### 3.2 Comportamiento tras la búsqueda: solo centrar el mapa
Al encontrar la ubicación se anima el mapa a esa región. No se dibuja pin de
referencia (decisión explícita de simplicidad).

### 3.3 UI: barra fija arriba
Barra siempre visible pegada al borde superior (patrón Google/Apple Maps), más
descubrible que un icono desplegable.

## 4. Arquitectura

Nueva vertical slice `features/search/` siguiendo la convención del proyecto:

```
features/search/
├── api.ts                 # geocodeAddress(query) → wrapper de Location.geocodeAsync
├── hooks.ts               # useGeocodeSearch() → useMutation de TanStack Query
├── schemas.ts             # tipos del resultado (coords)
└── components/
    └── MapSearchBar.tsx   # input + lupa + X + spinner + mensaje de error
```

**Separación de responsabilidades:**
- `MapSearchBar` posee el input, dispara el geocoding y gestiona sus estados
  (loading / error / sin resultados). Expone una prop `onLocationFound(coords)`.
- `app/(tabs)/map.tsx` recibe las coordenadas y ejecuta `mapRef.animateToRegion`.
  No conoce nada del geocoding.

### 4.1 Contrato de los módulos

**`api.ts`**
```ts
type GeocodeResult = { latitude: number; longitude: number };
// Devuelve el primer resultado, o null si el geocoder no encuentra nada.
async function geocodeAddress(query: string): Promise<GeocodeResult | null>;
```

**`hooks.ts`**
```ts
// useMutation<GeocodeResult | null, Error, string>
function useGeocodeSearch(): UseMutationResult<...>;
```

**`MapSearchBar.tsx`**
```ts
type Props = { onLocationFound: (coords: GeocodeResult) => void };
```

## 5. Flujo de datos

1. El usuario escribe "Gran Vía, Madrid" y pulsa "Buscar" en el teclado.
2. `useGeocodeSearch.mutate(query)` → `geocodeAddress` → `Location.geocodeAsync`.
3. Se toma el **primer** resultado (el geocoder ordena por relevancia).
4. `onLocationFound({ latitude, longitude })` → `map.tsx` hace
   `animateToRegion({ latitude, longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 })`
   (zoom de barrio/distrito).
5. La animación dispara el `onRegionChangeComplete` **ya existente** →
   `setCenter` → `useNearbyParkings` recarga → aparecen los pins de esa zona.

**No se añade lógica nueva de parkings:** reutiliza el ciclo de recarga por
región que ya funciona.

## 6. UI (tema oscuro, NativeWind)

```
┌─────────────────────────────────┐
│  🔍  Busca una calle o ciudad… ✕ │  ← barra fija, SafeArea top, sobre surface
├─────────────────────────────────┤
│         [ banner permisos ]      │  ← si aplica, justo debajo de la barra
│                                  │
│            M A P A               │
│                              ◎   │  ← botón recentrar (existente)
└─────────────────────────────────┘
```

- Campo redondeado sobre `surface`, lupa a la izquierda.
- **X** para limpiar cuando hay texto.
- Spinner en la barra mientras geocodifica.
- Placeholder: "Busca una calle o ciudad…".
- Se reconcilia el z-index/posición con el banner de permisos existente (la
  barra va arriba; el banner se desplaza justo debajo).

## 7. Casos borde y errores

| Caso | Comportamiento |
|------|----------------|
| Query vacía o solo espacios | Botón/acción inhabilitada, no hace nada |
| Sin resultados | Mensaje inline bajo la barra: "No se encontró esa ubicación". Se mantiene el texto |
| El geocoder lanza error | Mensaje inline: "No se pudo buscar, inténtalo de nuevo" |
| Varios resultados | Se toma el primero (mayor relevancia). Sin desambiguación en MVP |
| MVP España | La query se envía tal cual; no se fuerza país (el geocoder del SO es global y forzar "España" podría romper búsquedas concretas) |

## 8. Tests

Conforme a `docs/testing.md` (lógica pura bajo Vitest):
- **`features/search/api.ts`** con `expo-location` mockeado:
  - Devuelve el primer coord cuando hay resultados.
  - Devuelve `null` cuando el array viene vacío.
  - Propaga el error (rechaza) cuando `geocodeAsync` lanza; el hook lo expone
    vía `mutation.isError` y `MapSearchBar` muestra el mensaje inline.
- El test de render de `MapSearchBar` queda fuera por la deuda conocida
  **RNTL + Vitest** (ver `project-test-infra-debt`); se abordará según la vía
  que se decida para esa deuda.

## 9. Documentos a actualizar (mismo commit)

- **`prd.md`:** nueva user story ("Como motorista viajero, quiero buscar una
  calle o ciudad para ver los parkings de esa zona") y entrada en la tabla de
  features (F: buscador de ubicaciones sobre el mapa).
- **`arquitectura.md`:** nota breve sobre forward geocoding con `expo-location`.
- **`modelo-datos.md`:** sin cambios (no toca schema).
- **`testing.md`:** referencia a los nuevos tests de `features/search`.

## 10. Criterios de aceptación

1. Con la app abierta en el mapa, escribo "Barcelona" y el mapa se centra en
   Barcelona mostrando los parkings de esa zona.
2. Escribo una calle concreta con ciudad y el mapa se centra a nivel de
   barrio/distrito.
3. Una búsqueda sin resultados muestra el mensaje inline y no mueve el mapa.
4. `pnpm typecheck` pasa y los tests de `features/search/api.ts` están en verde.
5. El PRD refleja la feature.
