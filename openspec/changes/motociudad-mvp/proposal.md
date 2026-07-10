## Why

Los motoristas urbanos en España no disponen de ningún mapa colaborativo que documente plazas reales de aparcamiento de moto. El conocimiento existe en la comunidad pero está fragmentado en grupos de WhatsApp y foros. MotoCiudad resuelve esto construyendo el dataset de referencia mantenido por la propia comunidad: los usuarios encuentran, proponen y verifican parkings, ganando Octanos por sus contribuciones.

## What Changes

Se implementa el núcleo funcional del MVP: las tres acciones principales que definen el ciclo de valor del producto.

- **Nueva pantalla Mapa** (`app/(tabs)/map.tsx`): mapa interactivo centrado en la ubicación del usuario con pins coloreados por tipo y estado, clustering para alta densidad, y bottom sheet de detalle con navegación a app de mapas nativa.
- **Nuevo flujo Proponer parking**: formulario de 3 pasos (ubicación con pin arrastrable, datos básicos, foto opcional) que crea un parking en estado `pending` y registra +50 Octanos pendientes de confirmar.
- **Nueva Edge Function `validate-verification`**: gatekeeper server-side que aplica las reglas anti-abuso (geofencing ≤ 100m, foto reciente ≤ 5 min, no auto-verificación, cooldown, cap diario 200 Octanos) y, si todas pasan, inserta la verificación y otorga Octanos en transacción atómica.
- **Migración SQL fundacional** (`create_parkings`): tabla `parkings` con PostGIS, índice GiST, RLS con 4 policies, función RPC `nearby_parkings` y seeds de Madrid.
- **Tipos TypeScript** regenerados desde el schema de Supabase.

## Capabilities

### New Capabilities

- `nearby-parkings`: Localizar parkings cercanos en un mapa interactivo — pins, clustering, bottom sheet y navegación a app de mapas nativa (HU-02, ENG-102).
- `propose-parking`: Formulario de 3 pasos para proponer un parking nuevo con ubicación, datos básicos y foto opcional; genera un `octano_event` pendiente de +50 puntos (HU-03).
- `verify-parking`: Verificación in situ de un parking mediante foto con validaciones server-side (geofencing, timestamp, anti-abuso) y recompensa inmediata en Octanos (HU-01, ENG-101).

### Modified Capabilities

<!-- Ninguna — este es el primer conjunto de features de dominio. No hay specs existentes que modifiquen sus requisitos. -->

## Impact

**Base de datos**: nueva tabla `parkings`, enums `parking_type`/`parking_status`, función `nearby_parkings`, 4 RLS policies, tests pgTAP. Bloquea todas las features de parkings hasta estar lista.

**Mobile app** (`apps/mobile/`):
- Nuevas dependencias: `react-native-maps`, `@gorhom/bottom-sheet`, `expo-location`, `react-native-maps-super-cluster`.
- Nuevas rutas Expo Router: `app/(tabs)/map.tsx`, flujo de proponer parking.
- Nueva capa de features: `features/parkings/` (api, hooks, schemas, components).

**Supabase backend**:
- Nueva Edge Function `supabase/functions/validate-verification/` (Deno).
- Shared utilities `supabase/functions/_shared/` (cliente con service_role, códigos de error).

**CI/CD**: el workflow de Supabase debe ejecutar `supabase test db` para validar RLS y la función `nearby_parkings`. Las edge functions se validan con `deno test`.

**Observabilidad**: eventos PostHog `map_viewed`, `parking_pin_tapped`, `navigation_started`, `parking_proposed`, `parking_verified`. Sentry captura errores de la Edge Function.
