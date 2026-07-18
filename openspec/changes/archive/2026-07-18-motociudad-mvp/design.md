## Context

MotoCiudad parte de cero: no hay tablas de parkings, ni pantalla de mapa, ni lógica de gamificación implementada. Este change establece los cimientos del dominio principal en tres capas interdependientes que deben construirse en orden estricto:

1. **Base de datos** (`parkings`, `parking_verifications`, `parking_photos`, `octano_events`) con PostGIS y RLS — bloquea todo lo demás.
2. **Edge Function** `validate-verification` — lógica anti-abuso que no puede ejecutarse en el cliente.
3. **Mobile screens** — pantalla de mapa (Sprint 1) y flujos de proponer/verificar (Sprint 2).

El proyecto ya tiene: Supabase configurado localmente con Docker, Expo SDK 52 inicializado, TypeScript strict, y estructura de carpetas `features/<domain>/` definida.

## Goals / Non-Goals

**Goals:**
- Crear la tabla `parkings` con schema completo, índice GiST, 4 RLS policies y función RPC `nearby_parkings`.
- Implementar la pantalla de mapa como punto de entrada principal de la app.
- Implementar la Edge Function `validate-verification` con validaciones anti-abuso y otorgamiento transaccional de Octanos.
- Cubrir los tres flujos principales (ver mapa, proponer, verificar) con tests automatizados.
- Regenerar tipos TypeScript desde el schema de Supabase.

**Non-Goals:**
- Rankings, sistema de insignias o racha semanal (post-MVP).
- Notificaciones push (excepto la push de "tu propuesta fue verificada" que es parte de HU-03).
- Light theme, mensajería privada, pagos.
- Importación masiva de datos externos.
- La tabla `pois` (talleres) — se implementa en sprint posterior.

## Decisions

### D1: Base de datos primero, frontend después

ENG-103 (migración SQL) bloquea tanto ENG-102 (frontend mapa) como ENG-101 (edge function). El orden de ejecución es:

```
ENG-103 → ENG-102 (paralelo con ENG-101 una vez la DB existe)
       → ENG-101
```

**Alternativa considerada**: mockear la BD con datos en memoria para desarrollar frontend en paralelo desde el día 1.

**Descartada porque**: los tipos TypeScript generados desde Supabase (`pnpm gen:types`) son la fuente de verdad para el tipado del cliente. Trabajar con mocks manuales diverge inevitablemente y genera bugs al integrar.

---

### D2: Lógica anti-abuso exclusivamente en Edge Function, nunca en cliente

Las 5 reglas de validación (geofence, foto fresca, no auto-verificación, cooldown, cap diario) viven en `supabase/functions/validate-verification/validators.ts` como funciones puras.

**Por qué no SQL CHECK constraints**: las reglas cruzan tablas (`octano_events`, `parking_verifications`) y dependen del reloj del servidor. Los CHECKs son atómicos pero no pueden hacer joins cross-table en tiempo de ejecución.

**Por qué no RLS policies**: las RLS se evalúan por fila, no tienen acceso fácil a agregados (SUM de Octanos del día) ni a lógica de distancia GPS avanzada.

**Por qué no trigger PostgreSQL**: los triggers en PL/pgSQL son difíciles de testear en aislamiento y mezclan lógica de negocio con la capa de datos. La Edge Function se puede testear con Vitest/Deno standard.

---

### D3: `nearby_parkings` como función SQL STABLE (no view materializada)

La RPC `nearby_parkings(in_lat, in_lng, in_radius_m, in_filter, in_only_verified, in_limit)` usa `ST_DWithin` sobre el índice GiST. Es una función `LANGUAGE sql STABLE` invocada vía PostgREST RPC.

**Alternativa**: view materializada actualizada con `pg_cron` cada hora.

**Descartada porque**: la view materializada no refleja nuevos parkings hasta el siguiente refresco, y las búsquedas son por viewport variable — no hay una vista única que precalcular. Con el índice GiST, `ST_DWithin` sobre 50k filas tarda < 20ms.

---

### D4: react-native-maps con provider nativo (no MapLibre ni Mapbox)

Se usa `react-native-maps` con `PROVIDER_DEFAULT` (Apple Maps en iOS, Google Maps en Android) para los pins del mapa.

**Alternativa considerada**: MapLibre GL (tiles propios, sin coste de Google Maps Platform).

**Descartada para MVP**: requiere hosting de tiles, configuración de estilos propios y mayor complejidad de integración. El coste de Google Maps Platform es despreciable al nivel de usuarios del MVP. Se puede migrar post-MVP.

---

### D5: TanStack Query con debounce de 500ms para consultas al mover el mapa

El hook `useNearbyParkings(viewport)` usa `useQuery` de TanStack Query v5. El viewport (boundingBox) se debouncea 500ms antes de disparar la query. Esto evita saturar la RPC al arrastrar el mapa.

**Implementación**: `useDebouncedValue(viewport, 500)` como hook auxiliar. La query key incluye el viewport debounceado, por lo que el cache de TanStack funciona correctamente.

---

### D6: Foto de verificación — timestamp en cliente, no en EXIF

El campo `photo_taken_at` se registra en el momento de la captura (`expo-camera` callback), no se lee del EXIF (que puede ser falsificado o estar en timezone incorrecta). El EXIF de geolocalización se elimina con `expo-image-manipulator` antes de subir a Storage.

**Consecuencia**: si la red falla y se reintenta el upload, el timestamp original se preserva en el payload JSON. La Edge Function valida `now() - photo_taken_at ≤ 5 min`.

## Risks / Trade-offs

**[Riesgo] Precisión GPS insuficiente en edificios** → Mitigation: si `accuracy > 50m` al momento de la verificación, se bloquea el botón y se muestra aviso "Espera a tener señal GPS precisa". La Edge Function también rechaza con GEOFENCE_FAIL si la distancia supera los 100m.

**[Riesgo] Google Maps Platform billing** → Mitigation: activar `mapType="none"` con tiles propios es una opción de escape. En MVP, el coste es irrelevante (< €10/mes).

**[Riesgo] react-native-maps-super-cluster puede ser lento con > 500 pins** → Mitigation: el límite de la RPC `nearby_parkings` es `in_limit=200` por defecto. El clustering se hace en cliente sobre ese subconjunto.

**[Trade-off] Edge Function Deno vs Node** → Supabase usa Deno para edge functions. Deno tiene un ecosistema más pequeño, pero para este caso (validaciones puras + Supabase client) no hay dependencias externas problemáticas. Vitest no corre directamente en Deno; los tests se ejecutan con `deno test`.

**[Riesgo] Tipos TypeScript desfasados** → Mitigation: `pnpm gen:types` es paso obligatorio en CI antes de typecheck. Se documenta en `CLAUDE.md`.

## Migration Plan

1. **Paso 1** — Aplicar `20260101000010_create_parkings.sql` en entorno local: `supabase db reset`.
2. **Paso 2** — Ejecutar `pnpm gen:types` → commit de `apps/mobile/types/database.ts`.
3. **Paso 3** — Añadir seeds de Madrid: `supabase db reset` de nuevo para verificar datos.
4. **Paso 4** — Deploy a Supabase Preview: `supabase db push`.
5. **Paso 5** — Desarrollar y desplegar Edge Function: `supabase functions deploy validate-verification`.
6. **Paso 6** — Build de preview mobile: `eas build --platform all --profile preview`.

**Rollback**: la migración crea objetos nuevos sin tocar tablas existentes. Si hay problema, se puede ejecutar una migración inversa que haga DROP de `parkings` y objetos dependientes (sin datos de producción que perder en este punto).

## Open Questions

- **¿Clustering en cliente o en servidor?** Por ahora en cliente con `react-native-maps-super-cluster`. Si el límite de 200 pins resulta insuficiente, considerar clustering server-side con PostGIS `ST_SnapToGrid`.
- **¿Push notification de "tu propuesta fue verificada" en MVP?** Está en HU-03 criterio de aceptación pero requiere configurar FCM/APNs. Puede aplazarse a Sprint 3 si hay riesgo de timeline.
- **¿`nearby_parkings` debe devolver parkings `pending` al proponente?** La política RLS `parkings_read_own` los permite ver, pero la función RPC actual no los filtra por proponente. Definir comportamiento exacto antes de implementar.
