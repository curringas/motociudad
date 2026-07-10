# propose-parking Edge Function y corrección de mapa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la Edge Function `propose-parking` para persistir Octanos al proponer un parking, y corregir el mapa de la pantalla Aportar para que el marcador se inicialice en el punto que el usuario estaba viendo en el mapa principal.

**Architecture:** El mapa principal (`map.tsx`) persiste su centro actual en `uiStore` (Zustand) para que la pantalla Aportar lo lea como posición inicial del marcador. La llamada `proposeParking` deja de insertarse directamente en la tabla `parkings` desde el cliente y pasa a llamar a una Edge Function Deno que inserta el parking y el evento Octanos con `service_role`, garantizando que los puntos se registran siempre.

**Tech Stack:** TypeScript · React Native · Zustand · Supabase JS client · Deno · Zod · supabase/functions/_shared/supabase.ts

---

## Mapa de archivos

| Acción | Archivo | Qué cambia |
|--------|---------|------------|
| Modify | `apps/mobile/stores/uiStore.ts` | Añade `mapCenter` + `setMapCenter` |
| Modify | `apps/mobile/app/(tabs)/map.tsx` | Persiste centro a `uiStore` |
| Modify | `apps/mobile/app/(tabs)/contribute.tsx` | Lee `mapCenter` del store; usa octanos reales |
| Modify | `apps/mobile/features/parkings/api.ts` | Llama Edge Function en vez de INSERT directo |
| Create | `supabase/functions/propose-parking/deno.json` | Config Deno para la nueva función |
| Create | `supabase/functions/propose-parking/schemas.ts` | Validación Zod del input |
| Create | `supabase/functions/propose-parking/index.ts` | Handler principal |

---

### Task 1: Añadir `mapCenter` a `uiStore`

**Files:**
- Modify: `apps/mobile/stores/uiStore.ts`

- [ ] **Step 1: Reemplazar el contenido de `uiStore.ts`**

```typescript
import { create } from 'zustand';

type MapCenter = { lat: number; lng: number };

type UiStore = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mapCenter: MapCenter | null;
  setMapCenter: (center: MapCenter) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  activeTab: 'map',
  setActiveTab: (tab) => set({ activeTab: tab }),
  mapCenter: null,
  setMapCenter: (center) => set({ mapCenter: center }),
}));
```

- [ ] **Step 2: Verificar que el tipo compila**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep uiStore || echo "OK"
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/stores/uiStore.ts
git commit -m "feat(ui): añade mapCenter al uiStore para compartir posición del mapa entre tabs"
```

---

### Task 2: Persistir el centro del mapa desde `map.tsx`

**Files:**
- Modify: `apps/mobile/app/(tabs)/map.tsx`

- [ ] **Step 1: Importar `useUiStore` y leer `setMapCenter`**

Añadir la importación al bloque existente de imports (línea ~26):

```typescript
import { useUiStore } from '@/stores/uiStore';
```

Dentro de `MapScreen`, justo después de la línea `const { parkingType, onlyVerified } = useFiltersStore();` (línea ~51), añadir:

```typescript
const setMapCenter = useUiStore((s) => s.setMapCenter);
```

- [ ] **Step 2: Persistir centro en `handleRegionChangeComplete`**

Reemplazar la función actual (líneas 74-77):

```typescript
const handleRegionChangeComplete = useCallback((region: Region) => {
  const newCenter = { lat: region.latitude, lng: region.longitude };
  setCenter(newCenter);
  setMapCenter(newCenter);
  setRadiusM(radiusFromDelta(region.latitudeDelta));
}, [setMapCenter]);
```

- [ ] **Step 3: Persistir centro cuando llega el GPS por primera vez**

Reemplazar el `useEffect` de inicialización (líneas 67-71):

```typescript
useEffect(() => {
  if (location && !center) {
    const initial = { lat: location.latitude, lng: location.longitude };
    setCenter(initial);
    setMapCenter(initial);
  }
}, [location, center, setMapCenter]);
```

- [ ] **Step 4: Verificar compilación**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep "map.tsx" || echo "OK"
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(tabs\)/map.tsx
git commit -m "feat(mapa): persiste el centro del mapa en uiStore al mover o al obtener GPS"
```

---

### Task 3: Leer posición compartida en `contribute.tsx`

**Files:**
- Modify: `apps/mobile/app/(tabs)/contribute.tsx`

El bug actual: `useState({ latitude: location?.latitude ?? 40.4168, ... })` evalúa `location` solo una vez en el mount, cuando aún es `null`. El marcador se queda en Madrid para siempre.

La corrección: leer `mapCenter` del store (ya actualizado por `map.tsx`) como primera opción, luego GPS, luego Madrid como último recurso.

- [ ] **Step 1: Importar `useUiStore`**

Añadir a los imports existentes:

```typescript
import { useUiStore } from '@/stores/uiStore';
```

- [ ] **Step 2: Leer `mapCenter` del store**

Justo después de `const { location } = useUserLocation();` (línea ~44), añadir:

```typescript
const mapCenter = useUiStore((s) => s.mapCenter);
```

- [ ] **Step 3: Inicializar `markerCoords` con el centro compartido**

Reemplazar las líneas 55-58:

```typescript
const [markerCoords, setMarkerCoords] = useState({
  latitude: mapCenter?.lat ?? location?.latitude ?? 40.4168,
  longitude: mapCenter?.lng ?? location?.longitude ?? -3.7038,
});
```

- [ ] **Step 4: Verificar compilación**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep "contribute.tsx" || echo "OK"
```

Esperado: sin errores.

- [ ] **Step 5: Commit parcial**

```bash
git add apps/mobile/app/\(tabs\)/contribute.tsx
git commit -m "fix(aportar): inicializa marcador en la posición del mapa visto antes de llegar a la tab"
```

---

### Task 4: Crear la Edge Function `propose-parking`

**Files:**
- Create: `supabase/functions/propose-parking/deno.json`
- Create: `supabase/functions/propose-parking/schemas.ts`
- Create: `supabase/functions/propose-parking/index.ts`

#### 4a — deno.json

- [ ] **Step 1: Crear `supabase/functions/propose-parking/deno.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "lib": ["deno.window"]
  },
  "imports": {
    "npm:@supabase/supabase-js@2": "npm:@supabase/supabase-js@2",
    "npm:zod@3": "npm:zod@3"
  }
}
```

#### 4b — schemas.ts

- [ ] **Step 2: Crear `supabase/functions/propose-parking/schemas.ts`**

```typescript
import { z } from "npm:zod@3";

const latSchema = z
  .number({ invalid_type_error: "La latitud debe ser un número" })
  .min(-90, "Latitud mínima: -90")
  .max(90, "Latitud máxima: 90");

const lngSchema = z
  .number({ invalid_type_error: "La longitud debe ser un número" })
  .min(-180, "Longitud mínima: -180")
  .max(180, "Longitud máxima: 180");

const storagePathSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[a-zA-Z0-9\-_/.]+$/, "storage_path contiene caracteres no permitidos");

export const proposeParkingRequestSchema = z.object({
  name: z
    .string()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(120, "El nombre no puede superar los 120 caracteres"),
  type: z.enum(["public", "private"]),
  latitude: latSchema,
  longitude: lngSchema,
  city: z.string().min(1, "La ciudad es obligatoria").max(80),
  capacity: z.number().int().positive().nullable().optional(),
  features: z
    .object({
      covered: z.boolean().optional(),
      cameras: z.boolean().optional(),
      anchors: z.boolean().optional(),
      lit: z.boolean().optional(),
      free: z.boolean().optional(),
      h24: z.boolean().optional(),
      battery_layout: z.boolean().optional(),
    })
    .optional(),
  notes: z.string().max(500).optional(),
  photo_storage_path: storagePathSchema.optional(),
});

export type ProposeParkingRequest = z.infer<typeof proposeParkingRequestSchema>;

export function parseProposeParkingRequest(
  body: unknown,
): { success: true; data: ProposeParkingRequest } | { success: false; error: string } {
  const result = proposeParkingRequestSchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.errors[0];
    return {
      success: false,
      error: firstError
        ? `${firstError.path.join(".")}: ${firstError.message}`
        : "Datos de entrada inválidos",
    };
  }
  return { success: true, data: result.data };
}
```

#### 4c — index.ts

- [ ] **Step 3: Crear `supabase/functions/propose-parking/index.ts`**

```typescript
/**
 * Edge Function: propose-parking
 * Crea un parking nuevo y registra el evento Octanos correspondiente.
 *
 * Flujo:
 * 1. Autenticar usuario (JWT)
 * 2. Validar body con Zod
 * 3. Insertar parking con service_role
 * 4. Insertar octano_event propose_parking (+50 pts, status=pending)
 * 5. Si se aportó photo_storage_path, insertar parking_photos
 * 6. Devolver { id, octanos_earned }
 *
 * NUNCA loguear tokens ni service_role_key.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { errorResponse, makeError, ERRORS } from "../_shared/errors.ts";
import { parseProposeParkingRequest } from "./schemas.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OCTANOS_PROPOSE_PARKING = 50;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── 1. Autenticación ────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(ERRORS.UNAUTHORIZED, 401);
  }

  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

  if (authError || !user) {
    console.error(JSON.stringify({
      code: "INVALID_TOKEN",
      detail: authError?.message ?? "No user",
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(makeError("INVALID_TOKEN", "Token de autenticación inválido"), 401);
  }

  const userId = user.id;

  // ── 2. Validación del body ──────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(makeError("VALIDATION_ERROR", "El body debe ser JSON válido"));
  }

  const parsed = parseProposeParkingRequest(body);
  if (!parsed.success) {
    return errorResponse(makeError("VALIDATION_ERROR", parsed.error));
  }

  const input = parsed.data;

  // ── 3. Insertar parking ──────────────────────────────────────
  const { data: parking, error: parkingError } = await supabaseAdmin
    .from("parkings")
    .insert({
      name: input.name,
      type: input.type,
      location: `POINT(${input.longitude} ${input.latitude})`,
      city: input.city,
      capacity: input.capacity ?? null,
      features: input.features ?? {},
      notes: input.notes ?? null,
      proposed_by: userId,
    } as never)
    .select("id")
    .single();

  if (parkingError || !parking) {
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: parkingError?.message ?? "No data returned",
      user_id: userId,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  const parkingId: string = parking.id;

  // ── 4. Registrar evento Octanos (propose_parking, pending) ──
  const { error: octanoError } = await supabaseAdmin
    .from("octano_events")
    .insert({
      user_id: userId,
      action_type: "propose_parking",
      points: OCTANOS_PROPOSE_PARKING,
      reference_id: parkingId,
      reference_type: "parking",
      status: "pending",
    });

  if (octanoError) {
    // El parking ya fue creado; logamos el fallo pero no revertimos
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: `octano_event insert failed: ${octanoError.message}`,
      user_id: userId,
      parking_id: parkingId,
      timestamp: new Date().toISOString(),
    }));
  }

  // ── 5. Insertar foto si se proporcionó ──────────────────────
  if (input.photo_storage_path) {
    const { error: photoError } = await supabaseAdmin
      .from("parking_photos")
      .insert({
        parking_id: parkingId,
        uploaded_by: userId,
        storage_path: input.photo_storage_path,
        is_primary: true,
        is_verification: false,
      });

    if (photoError) {
      console.error(JSON.stringify({
        code: "DATABASE_ERROR",
        detail: `parking_photos insert failed: ${photoError.message}`,
        user_id: userId,
        parking_id: parkingId,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  // ── 6. Respuesta ────────────────────────────────────────────
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        id: parkingId,
        octanos_earned: OCTANOS_PROPOSE_PARKING,
      },
    }),
    {
      status: 201,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    },
  );
});
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/propose-parking/
git commit -m "feat(edge): añade Edge Function propose-parking con registro de Octanos pendientes"
```

---

### Task 5: Actualizar `proposeParking` en `api.ts`

**Files:**
- Modify: `apps/mobile/features/parkings/api.ts`

- [ ] **Step 1: Reemplazar la función `proposeParking`**

Reemplazar la función entera (líneas 63-91) con:

```typescript
/**
 * Propone un nuevo parking. Delega a la Edge Function propose-parking
 * que inserta el parking y registra el evento Octanos con service_role.
 * Devuelve el id del parking creado y los Octanos ganados.
 */
export async function proposeParking(
  payload: ProposeParkingInput & { photo_storage_path?: string },
): Promise<{ id: string; octanos_earned: number }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token;

  if (!jwt) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase.functions.invoke<{
    success: boolean;
    data: { id: string; octanos_earned: number };
  }>('propose-parking', {
    body: payload,
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (error) throw error;
  if (!data?.success || !data.data) {
    throw new Error('No se pudo crear el parking');
  }

  return data.data;
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep "api.ts" || echo "OK"
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/features/parkings/api.ts
git commit -m "feat(parkings): proposeParking llama Edge Function en lugar de insertar directo en BD"
```

---

### Task 6: Usar Octanos reales en `contribute.tsx`

**Files:**
- Modify: `apps/mobile/app/(tabs)/contribute.tsx`

La función `proposeParking` ahora retorna `{ id, octanos_earned }`. Actualizamos `handleSubmit` para leer ese valor en vez del hardcoded `10`.

- [ ] **Step 1: Actualizar `handleSubmit` para leer `octanos_earned`**

En `handleSubmit` (línea ~163), reemplazar:

```typescript
      setPendingOctanos(10); // propose_parking event awards 10 Octanos (pending)
      setSubmitted(true);
```

con:

```typescript
      setPendingOctanos(result.octanos_earned);
      setSubmitted(true);
```

La línea anterior ya tiene `const result = await proposeMutation.mutateAsync({...})`.

- [ ] **Step 2: Verificar que `hooks.ts` propaga el tipo de retorno**

Abrir `apps/mobile/features/parkings/hooks.ts` y comprobar que `useProposeParking` usa `mutationFn: (payload) => proposeParking(payload)`. El tipo de retorno se infiere automáticamente porque `proposeParking` ahora retorna `Promise<{ id: string; octanos_earned: number }>`. No hay cambios que hacer en `hooks.ts`.

- [ ] **Step 3: Verificar compilación completa**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20
```

Esperado: `0 errors`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(tabs\)/contribute.tsx
git commit -m "fix(aportar): muestra Octanos reales devueltos por la Edge Function"
```

---

## Verificación final

```bash
# Typecheck global
cd apps/mobile && npx tsc --noEmit

# Confirmar que la Edge Function existe y tiene los tres archivos
ls supabase/functions/propose-parking/

# Confirmar que no queda ningún INSERT directo a octano_events en código cliente
grep -r "octano_events" apps/mobile/ --include="*.ts" --include="*.tsx"
# Esperado: sin resultados (solo la Edge Function puede escribir ahí)
```
