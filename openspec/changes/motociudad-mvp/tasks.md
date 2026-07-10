## 1. Base de datos — Migración `parkings` (ENG-103)

- [x] 1.1 Crear migración: `supabase migration new create_parkings`
- [x] 1.2 Añadir extensiones `pgcrypto`, `postgis`, `pg_cron` al top de la migración si no existen en migración previa
- [x] 1.3 Definir enums `parking_type` y `parking_status` en la migración
- [x] 1.4 Crear tabla `parkings` con todas las columnas, defaults y FK a `users`
- [x] 1.5 Crear índice GiST `idx_parkings_location` sobre columna `location`
- [x] 1.6 Crear índices parciales `idx_parkings_status`, `idx_parkings_city`, `idx_parkings_proposer`
- [x] 1.7 Habilitar RLS en `parkings` y crear las 4 policies: `parkings_read_verified`, `parkings_read_own`, `parkings_insert`, `parkings_update_own_pending`
- [x] 1.8 Crear función SQL `nearby_parkings(in_lat, in_lng, in_radius_m, in_filter, in_only_verified, in_limit)` con `LANGUAGE sql STABLE`
- [x] 1.9 Crear tabla `parking_photos` con índices y FK en la misma migración
- [x] 1.10 Crear tabla `parking_verifications` con índices y FK
- [x] 1.11 Crear tabla `octano_events` con índices y FK (necesaria para la Edge Function)
- [ ] 1.12 Probar localmente: `supabase db reset` sin errores
- [x] 1.13 Crear `supabase/tests/sql/nearby_parkings.test.sql` con ≥ 3 casos pgTAP (distancia, filtro tipo, only_verified)
- [x] 1.14 Crear `supabase/tests/rls/parkings.test.sql` con ≥ 6 escenarios (cada policy + caso de rechazo)
- [ ] 1.15 Ejecutar `supabase test db` y verificar 100% pass
- [x] 1.16 Añadir 5 parkings seed de Madrid en `supabase/seed.sql` con coordenadas verificadas
- [ ] 1.17 Ejecutar `pnpm gen:types` y commitear `apps/mobile/types/database.ts`

## 2. Backend — Edge Function `validate-verification` (ENG-101)

- [x] 2.1 Crear scaffold: `supabase functions new validate-verification`
- [x] 2.2 Crear `supabase/functions/_shared/supabase.ts` con cliente usando `service_role_key`
- [x] 2.3 Crear `supabase/functions/_shared/errors.ts` con los 5 códigos: `GEOFENCE_FAIL`, `STALE_PHOTO`, `SELF_VERIFICATION_FORBIDDEN`, `ALREADY_VERIFIED`, `DAILY_CAP_REACHED`
- [x] 2.4 Crear `schemas.ts` con schema Zod del payload: `{ parking_id, user_lat, user_lng, photo_taken_at, photo_storage_path }`
- [x] 2.5 Crear `types.ts` con tipo de respuesta uniforme `{ success, error?, data? }`
- [x] 2.6 Implementar `validators.ts` — función `validateGeofence(userLoc, parkingLoc): Result`
- [x] 2.7 Implementar `validators.ts` — función `validatePhotoFreshness(photoTakenAt): Result`
- [x] 2.8 Implementar `validators.ts` — función `validateNotSelfVerification(userId, parkingProposedBy): Result`
- [x] 2.9 Implementar `validators.ts` — función `validateCooldown(supabase, userId, parkingId): Promise<Result>`
- [x] 2.10 Implementar `validators.ts` — función `validateDailyCap(supabase, userId): Promise<Result>`
- [x] 2.11 Implementar `index.ts` — handler que extrae JWT, llama a validators en orden fail-fast y ejecuta transacción de INSERT si todo pasa
- [x] 2.12 Añadir logging estructurado en cada rechazo (código + user_id, sin PII sensible)
- [x] 2.13 Configurar Sentry para capturar errores de la función
- [x] 2.14 Escribir `__tests__/validate-geofence.test.ts` cubriendo camino feliz y caso límite (exactamente 100m)
- [x] 2.15 Escribir `__tests__/validate-daily-cap.test.ts` cubriendo cap exacto y cap superado
- [x] 2.16 Escribir `__tests__/validate-cooldown.test.ts`
- [x] 2.17 Escribir `__tests__/handler.test.ts` con test de integración usando DB efímera (`supabase start`)
- [ ] 2.18 Ejecutar `deno test supabase/functions/validate-verification/` y verificar ≥ 90% cobertura en `validators.ts`
- [ ] 2.19 Deploy a entorno preview: `supabase functions deploy validate-verification`

## 3. Frontend — Pantalla Mapa (ENG-102)

- [ ] 3.1 Instalar dependencias: `react-native-maps`, `@gorhom/bottom-sheet`, `expo-location`, `react-native-maps-super-cluster`
- [x] 3.2 Configurar permisos de ubicación en `app.config.ts` para iOS (`NSLocationWhenInUseUsageDescription`) y Android (`ACCESS_FINE_LOCATION`)
- [x] 3.3 Crear estilo custom del mapa dark mode en `assets/map-style-dark.json`
- [x] 3.4 Crear `hooks/useUserLocation.ts` para gestionar permisos y posición GPS
- [x] 3.5 Crear `lib/deeplinks.ts` con función `openInExternalMaps(lat, lng, name)` — iOS y Android URLs
- [x] 3.6 Crear `lib/__tests__/deeplinks.test.ts` cubriendo iOS y Android con plataforma mockeada
- [x] 3.7 Crear `features/parkings/schemas.ts` con schema Zod para la respuesta de `nearby_parkings`
- [x] 3.8 Crear `features/parkings/api.ts` con función `getNearbyParkings(viewport, filters)`
- [x] 3.9 Crear `features/parkings/hooks.ts` con hook `useNearbyParkings(viewport)` — TanStack Query + debounce 500ms
- [x] 3.10 Crear componente `features/parkings/components/ParkingMapPin.tsx` con variantes de color por tipo y estado
- [x] 3.11 Escribir test RNTL para `<ParkingMapPin>` verificando variantes de color y `accessibilityLabel`
- [x] 3.12 Crear `components/EmptyMapState.tsx` para viewport sin parkings
- [x] 3.13 Crear `components/ParkingBottomSheet.tsx` con foto, nombre, distancia, badge, botones "Llévame" y "Detalles"
- [x] 3.14 Implementar `app/(tabs)/map.tsx` — MapView con provider nativo, dark style, pin de usuario, clustering condicional, bottom sheet al tap, botón de recentrar
- [x] 3.15 Verificar que el mapa no re-centra automáticamente al moverse el usuario (solo el punto azul actualiza)
- [x] 3.16 Añadir telemetría PostHog: `map_viewed`, `parking_pin_tapped`, `navigation_started`
- [x] 3.17 Crear `.maestro/find-and-navigate.yaml` — flow E2E: abrir app → ver mapa con pins → tap pin → tap "Llévame"
- [ ] 3.18 Ejecutar `maestro test .maestro/find-and-navigate.yaml` en simulador iOS y emulador Android

## 4. Frontend — Flujo Proponer Parking

- [x] 4.1 Crear ruta Expo Router para el formulario de propuesta (3 pasos)
- [x] 4.2 Paso 1: implementar mapa con pin arrastrable inicializado en posición del usuario
- [x] 4.3 Paso 1: implementar detección de duplicado (parking verificado a < 30m) con sugerencia "¿Es este?"
- [x] 4.4 Paso 2: implementar campos nombre (requerido), tipo público/privado (requerido), y chips de características multi-select
- [x] 4.5 Paso 2: deshabilitar botón "Continuar" si faltan campos requeridos y resaltar campo faltante
- [x] 4.6 Paso 3: implementar captura de foto desde cámara o galería con procesamiento (resize 800px, strip EXIF, compresión)
- [x] 4.7 Implementar submit: INSERT en `parkings` con `status='pending'` + `octano_event` pendiente de +50
- [x] 4.8 Implementar pantalla de confirmación con mensaje y referencia al estado de verificación
- [x] 4.9 Manejar caso de cap diario: guardar parking pero avisar al usuario sobre los Octanos aplazados
- [x] 4.10 Añadir telemetría PostHog: `parking_proposed` con metadatos (con_foto, ciudad)
- [x] 4.11 Crear `.maestro/propose-parking.yaml` — flow E2E del formulario completo (con mock de cámara)
- [x] 4.12 Añadir tests pgTAP para la policy `parkings_insert` (propuesto_por != auth.uid(), status != 'pending' rechazado)

## 5. Frontend — Flujo Verificar Parking

- [x] 5.1 Añadir botón "¿Has aparcado aquí?" en pantalla de detalle de parking (oculto si el user es el proponente)
- [x] 5.2 Implementar captura de foto con cámara trasera forzada (sin flip button) y registro de `photo_taken_at` al capturar
- [x] 5.3 Implementar comprobación de precisión GPS (bloquear envío si accuracy > 50m con aviso)
- [x] 5.4 Strip EXIF de geolocalización antes de upload a Storage
- [x] 5.5 Implementar llamada a Edge Function `validate-verification` con payload completo
- [x] 5.6 Manejar cada código de error con su mensaje de usuario correspondiente (GEOFENCE_FAIL, STALE_PHOTO, etc.)
- [x] 5.7 Mostrar confirmación con Octanos ganados tras éxito
- [x] 5.8 Comprobar si el usuario cruzó umbral de nivel y disparar animación celebratoria
- [x] 5.9 Añadir telemetría PostHog: `parking_verified` tras éxito
- [x] 5.10 Crear `.maestro/verify-parking.yaml` — flow E2E con mock de GPS y cámara
- [ ] 5.11 Ejecutar smoke test manual en dispositivo físico: verificación real contra preview backend

## 6. CI/CD y documentación

- [x] 6.1 Actualizar workflow CI para ejecutar `supabase test db` (pgTAP) en cada PR
- [x] 6.2 Actualizar workflow CI para ejecutar `deno test supabase/functions/**/*.test.ts`
- [ ] 6.3 Verificar que `pnpm typecheck` pasa con los tipos regenerados
- [ ] 6.4 Actualizar `docs/arquitectura.md` §5.3 si el contrato de la Edge Function difiere del diseño
- [ ] 6.5 Actualizar `docs/modelo-datos.md` §6.2 con defaults reales del SQL si difieren del spec
- [ ] 6.6 Confirmar en SQL Editor de Supabase preview: `SELECT * FROM nearby_parkings(40.4231, -3.7036, 5000)` devuelve seeds
