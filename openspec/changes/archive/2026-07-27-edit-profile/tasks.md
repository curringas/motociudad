## 1. Base de datos: unicidad del nick

- [x] 1.1 Crear migración `supabase migration new profile_username_unique_ci` con índice único funcional `CREATE UNIQUE INDEX users_username_lower_key ON public.users (LOWER(username));`
- [x] 1.2 En la misma migración, añadir `CHECK` de formato del nick (`^[A-Za-z0-9_.-]{3,30}$`) sobre `users.username`
- [x] 1.3 pgTAP en `supabase/tests/`: dos usuarios no pueden tener nicks que difieran solo en capitalización; un nick fuera de formato es rechazado; un usuario puede reguardar su propio nick

## 2. Storage: bucket de avatares

- [x] 2.1 Migración idempotente que aprovisiona el bucket `avatars` (`insert into storage.buckets ... on conflict do update`) con `public = true`, `file_size_limit` (2 MB) y `allowed_mime_types = {image/jpeg,image/png,image/webp}`
- [x] 2.2 Policies sobre `storage.objects` para `avatars`: SELECT público; INSERT/UPDATE/DELETE solo `authenticated` cuando el primer segmento del path es `auth.uid()`
- [x] 2.3 pgTAP: lectura pública permitida; escritura en carpeta ajena rechazada; escritura en carpeta propia permitida

## 2b. Integridad de Octanos (cerrar `users_self_update`)

- [x] 2b.1 Migración que extiende `enforce_privileged_user_fields` (y su `CREATE TRIGGER ... UPDATE OF ...`) para rechazar cambios de `total_octanos`/`octanos_this_month`/`current_level` cuando `auth.uid() IS NOT NULL`
- [x] 2b.2 pgTAP: un cliente no puede subir su `total_octanos` ni cambiar `current_level`; los triggers del servidor sí pueden actualizarlos

## 2c. Lectura pública de verificadores

- [x] 2c.1 Migración que añade policy `parking_verifications_read_anon` (`FOR SELECT TO anon USING (true)`) para que la web pública pueda listar quién verificó
- [x] 2c.2 pgTAP: un cliente anónimo puede leer `parking_verifications`

## 3. Edge Function `city-search`

- [x] 3.1 Crear `supabase/functions/city-search/` (Deno + TypeScript) que valida entrada con Zod (query mínima 2 chars), exige usuario autenticado y proxea Nominatim (`format=jsonv2&addressdetails=1&limit=5`) con `User-Agent` propio
- [x] 3.2 Normalizar la respuesta a `{ name, region, country, country_code, lat, lng, label }` con `label = "Ciudad, País"`, filtrando a resultados de tipo ciudad/pueblo; devolver `[]` para query corta o sin coincidencias
- [x] 3.3 `deno test` del handler: consulta con resultados, ciudad internacional, query corta → `[]`, sin auth → error (11/11 verde)
- [x] 3.4 Desplegar la función a Supabase Cloud _(city-search v1 ACTIVE, verify_jwt; las 4 migraciones también aplicadas a Cloud y registradas en el historial con sus versiones)_

## 4. Cliente: feature `profile` (datos y lógica)

- [x] 4.1 Añadir dependencia `expo-image-picker` a `apps/mobile/package.json` (versión alineada al SDK) — instalado `~17.0.11`; _reconstruir dev build es paso nativo del usuario_
- [x] 4.2 `features/profile/schemas.ts`: Zod del nick (3–30, `^[A-Za-z0-9_.-]+$`) y del formulario de perfil
- [x] 4.3 `features/profile/api.ts`: `getMyProfile()` (lee la fila `users`), `updateProfile({ nick, city })` (UPDATE directo con RLS, escribe `username` y `display_name` con el mismo valor), `checkNickAvailable(nick)` (pre-check con `lower()`), `uploadAvatar(file)` (procesa y sube a `avatars/{uid}/avatar.jpg` con `upsert`, devuelve URL con cache-busting)
- [x] 4.4 `features/profile/hooks.ts`: `useMyProfile`, `useUpdateProfile`, `useNickAvailability` (debounced), `useUploadAvatar`; invalidar queries de perfil y ranking al guardar
- [x] 4.5 Traducir el error `23505` (unique_violation) a "Ese nick ya está en uso" en la capa de mutación

## 5. Cliente: búsqueda de ciudad

- [x] 5.1 `features/profile/api.ts` (o `features/search`): `searchCities(query)` que invoca la Edge Function `city-search` y devuelve las sugerencias tipadas
- [x] 5.2 `useCitySearch` (TanStack Query, debounced) y componente `CitySearchInput` (typeahead con lista de sugerencias "Ciudad, País")
- [x] 5.3 Al elegir una sugerencia, fijar `city_primary` con su `label`; no persistir texto libre no seleccionado

## 6. Cliente: UI de "Mi perfil"

- [x] 6.1 Rediseñar `app/(tabs)/profile.tsx` para cargar la fila `users` y mostrar avatar real (o iniciales), nick (con prefijo `@`), nivel, ciudad, Octanos y el **email en solo lectura**
- [x] 6.2 Selector de avatar (`expo-image-picker` `mediaTypes: ['images']`) + procesado con `expo-image-manipulator` (resize 512×512, re-encode JPEG) antes de subir (cross-platform web/native)
- [x] 6.3 Formulario/modal "Editar perfil": email en solo lectura + campo único "Nombre de usuario" (@handle, con feedback de disponibilidad y validación) y `CitySearchInput`; estados de carga/error y mensajes en es-ES usando tokens de color válidos del tema
- [x] 6.4 Mostrar atribución de OSM/Nominatim en el selector de ciudad

## 6b. Componentes compartidos y perfil público

- [x] 6b.1 Componente `Avatar` (imagen desde `avatar_url` vía `getPublicUrl` o iniciales de fallback) reutilizable
- [x] 6b.2 Componente `UserChip` (`Avatar` + `@nick`, pulsable → `router.push('/user/'+id)`)
- [x] 6b.3 Ruta `app/user/[id].tsx`: perfil público con avatar, @nick, ciudad, nivel y Octanos; oculta Octanos/posición si `ranking_visible = false`; `features/profile/api.ts` `getPublicProfile(id)`

## 6c. Atribución de autoría en la app pública

- [x] 6c.1 Parkings: ampliar `getParkingById` con embedding `proposer:proposed_by(username, display_name, avatar_url)` y mostrar el `UserChip` del creador en `app/parking/[id].tsx` (+ `.web.tsx`)
- [x] 6c.2 Comentarios: añadir `authorAvatarUrl` al `CommentView` (presenter) y renderizar `UserChip` en `CommentItem.tsx` (avatar+@nick pulsables)
- [x] 6c.3 Verificadores: `fetchParkingVerifiers(parkingId)` (embedding `verified_by(...)`), hook, y modal accesible desde el contador "✓ Verificado · N" con la lista de `UserChip`
- [x] 6c.4 Ranking: hacer pulsables `RankingRow`/`RankingPodium` → perfil público; mostrar avatar con `Avatar`

## 7. Tipos y tests de cliente

- [x] 7.1 `pnpm gen:types`: **no-op** — el change no añade columnas nuevas (usa `username`/`city_primary`/`avatar_url`/`ranking_visible`/`total_octanos`/`current_level`/`proposed_by`/`verified_by` ya existentes), así que `types/database.ts` no cambia; `typecheck` verde lo confirma
- [x] 7.2 Tests Vitest: validación del nick, mapeo de sugerencias de ciudad, `Avatar`/`UserChip` (fallback y navegación), `CommentItem` con avatar; componentes vía `@testing-library/react` + react-native-web
- [x] 7.3 `pnpm typecheck` y `pnpm test` en verde (128 tests, 21 archivos; lint 0 errores)

## 8. Documentación

- [x] 8.1 `docs/prd.md`: describir la edición de perfil (nick, ciudad, avatar) en "Mi perfil" y los perfiles públicos + atribución de autoría (creador, autor de comentario, verificadores)
- [x] 8.2 `docs/modelo-datos.md`: índice único `LOWER(username)` + CHECK; bucket `avatars` con path `{user_id}/avatar.jpg`, MIME y tamaño; policies de Storage; policy `anon` de `parking_verifications`
- [x] 8.3 `docs/arquitectura.md`: Edge Function `city-search` y geocoding vía Nominatim/OSM; ruta de perfil público y componentes `Avatar`/`UserChip`
- [x] 8.4 `docs/testing.md`: nuevos tests (pgTAP unicidad/Storage/verificadores anón, deno city-search, Vitest de perfil y autoría)

## 9. Verificación de cierre (obligatoria)

- [x] 9.1 `verify-all-platforms`: **Web PASS** + **Backend/RLS/Storage PASS** + **Android PASS** (rebuild nativo; app sin red-box, perfil/edición/avatar-picker nativo/city-search en runtime) + **iOS PASS** a nivel build+arranque+enlace nativo (rebuild `Build Succeeded`, app carga sin red-box, Perfil renderiza; login logueado delegado al usuario — mismo código RN ya PASS en Android/Web)
- [x] 9.2 Flujos verificados en runtime (web + backend): cambiar nick (colisión "ya está en uso" / "✓ Disponible" / formato inválido), ciudad por autocompletar ("📍 Málaga, España"), subir avatar; nuevo nick propaga a ranking/comentarios; `mv_ranking_by_city` **poblada**
- [x] 9.2b Perfiles públicos/autoría verificados (web + backend): "Propuesto por @nick" en detalle, autor en comentarios, modal de verificadores, ruta `/user/[id]` (avatar/@nick/ciudad/nivel/Octanos), `ranking_visible=false` oculta Octanos
- [x] 9.3 Datos de prueba limpiados (usuario restaurado, avatar borrado, MVs reconciliadas) y evidencia en `.claude/verify-runs/edit-profile.md` (+ capturas)
