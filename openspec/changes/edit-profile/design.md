## Context

`public.users` ya tiene todas las columnas necesarias (`username VARCHAR(30) UNIQUE NOT NULL`,
`display_name VARCHAR(60) NOT NULL`, `avatar_url TEXT`, `city_primary VARCHAR(80)`), y la
policy `users_self_update` permite al propio usuario actualizar su fila (`auth.uid() = id`).
El trigger `enforce_privileged_user_fields` bloquea escritura directa de `role`/`suspended`
pero NO de estos campos de perfil. Sin embargo, la UI de "Mi perfil"
(`app/(tabs)/profile.tsx`) hoy solo muestra el email y los Octanos: no lee la fila `users`,
no hay edición, no hay avatar y `city_primary` nunca se rellena (por eso el ranking por
ciudad —cuya infraestructura ya existe: `mv_ranking_by_city`— está vacío).

El bucket de Storage `avatars` está **documentado** en `docs/modelo-datos.md §14` con path
`avatars/{user_id}.webp`, pero no lo crea ninguna migración (igual que `parkings-photos`, se
creó a mano en el dashboard) ni tiene policies versionadas.

La búsqueda de ciudad del mapa (`features/search`) usa `expo-location.geocodeAsync`, que solo
devuelve coordenadas (sin nombre ni país), no ofrece lista de sugerencias y **no funciona en
web**. La versión web ya usa Nominatim/OSM para geocoding.

Restricciones: autorización solo por RLS; sin `service_role_key` en cliente; no persistir
geolocalización del usuario; toda tabla/policy nueva con test; la feature se ve en la app
móvil ⇒ debe verificarse en web + iOS + Android.

## Goals / Non-Goals

**Goals:**
- Editar el nick como identidad pública única (case-insensitive), con validación de formato.
- Fijar `city_primary` de forma normalizada mediante autocompletar de ciudades, activando el
  ranking por ciudad.
- Subir avatar restringido a imágenes, endurecido contra ficheros maliciosos en cliente y
  servidor.
- Mantener la arquitectura: RLS para la edición del perfil; Edge Function para el geocoding.
- Funcionar igual en web, iOS y Android.

**Non-Goals:**
- Editar email/contraseña, elegir identidad en el registro, `bike_model`, crop de imagen,
  cooldown de cambios de nick (ver `proposal.md` → Non-goals).
- Endurecer los campos caché de Octanos frente a escritura directa (ver Riesgos).

## Decisions

### D1 — Edición del perfil vía UPDATE directo con RLS (no Edge Function)
El guardado de nick/ciudad/avatar se hace con `supabase.from('users').update(...).eq('id', me)`,
apoyándose en `users_self_update`. Es el patrón ya establecido para campos no privilegiados y
no tiene efectos secundarios (no toca Octanos ni ranking, que se recalcula solo).
- **Alternativa descartada**: Edge Function `update-profile`. Añade complejidad sin aportar:
  la unicidad la garantiza la BD y no hay lógica de negocio con efectos. Solo sería necesaria
  si eligiéramos cooldown de nick (descartado).

### D2 — Email en solo lectura + nick (@handle) editable como campo aparte
"Mi perfil" muestra el **email** de `auth.users` en **solo lectura** (identidad de la cuenta,
la gestiona Supabase Auth; no se edita ni se pierde) y, como **campo aparte**, el **nick
editable** = el `username` (@handle). Ese handle es lo que hoy se ve en los comentarios y el
ranking: `CommentRow.authorName` y el presenter de comentarios usan
`display_name || username`, y ambos nacen por defecto del prefijo del email.
- El formulario tiene un solo campo editable "Nombre de usuario". Al guardar se escribe el
  mismo valor en `username` **y** `display_name`, para que el cambio se refleje de inmediato
  en comentarios y ranking (que priorizan `display_name`). En la UI el nick se muestra con
  prefijo `@` para reflejar el modelo mental del usuario.
- **Consecuencia**: el valor compartido debe respetar los límites de `username` (≤30 chars,
  charset restringido), más estrictos que los de `display_name` (≤60). Se validan contra los
  de `username`.
- **Alternativa descartada**: email como algo editable (no lo es, es la cuenta) o `username`
  inmutable con solo `display_name` editable (dejaría el @handle antiguo visible en el panel).

### D3 — Unicidad del nick case-insensitive vía índice funcional
Se añade `CREATE UNIQUE INDEX users_username_lower_key ON public.users (LOWER(username));` y
un `CHECK` de formato (`^[A-Za-z0-9_.-]{3,30}$`). La UNIQUE existente sobre `username` se
mantiene (no rompe nada; el índice funcional es el guard efectivo case-insensitive). El
cliente detecta la colisión por el error `23505` (unique_violation) y muestra "Ese nick ya
está en uso"; además hace una pre-comprobación de disponibilidad con debounce
(`select 1 from users where lower(username)=lower($q) and id<>me`) solo para feedback en vivo
—la fuente de verdad es el índice—.
- **Alternativa descartada**: tipo `citext`. Requiere extensión y migrar la columna; el
  índice funcional es más simple y suficiente.

### D4 — Ciudad: Edge Function `city-search` (Nominatim/OSM) + almacenar etiqueta canónica
Nueva Edge Function que proxea Nominatim (`/search?format=jsonv2&addressdetails=1&limit=5`),
con `User-Agent` propio (requisito de la política de uso de OSM) y filtrando a resultados de
tipo ciudad/pueblo. Devuelve `{ name, region, country, country_code, lat, lng, label }` donde
`label` = "Ciudad, País". En cliente, `CitySearchInput` hace typeahead con debounce y, al
elegir, guarda `label` en `city_primary`. Así la misma ciudad produce siempre el mismo string
y el ranking por ciudad agrupa bien.
- **Por qué Edge Function y no cliente directo**: funciona idéntico en web/iOS/Android (el
  geocoder nativo de expo-location no va en web), centraliza el `User-Agent`/rate-limit y deja
  la puerta a caché o a cambiar de proveedor sin tocar clientes.
- **Por qué Nominatim y no Google**: keyless, mundial y ya se usa en la web. La única API key
  del proyecto es la de Android Maps (restringida a la app Android, no sirve para geocoding
  server-side). Google Geocoding exigiría habilitar API + facturación + key de servidor.
- **Trade-off**: Nominatim limita a ~1 req/s y pide atribución. Mitigado con debounce, `limit`
  bajo y `User-Agent`; si la calidad/cuota molesta, se sustituye el proveedor dentro de la
  función sin cambiar la spec.
- **`city_primary` sigue siendo solo texto** (VARCHAR(80)); no añadimos columnas de
  coordenadas: el ranking particiona por el string y no las necesita. Las coordenadas de la
  sugerencia se usan solo en el cliente (p. ej. futura vinculación con el mapa).

### D5 — Avatar: re-codificación en cliente + límites de bucket en servidor
- **Cliente**: `expo-image-picker` con `mediaTypes: Images` (nueva dependencia) para elegir de
  la galería; luego `expo-image-manipulator` (ya presente) redimensiona (máx. 512×512) y
  re-codifica a JPEG. Re-decodificar y re-encodear los píxeles descarta EXIF y cualquier
  payload incrustado (polyglots): solo sobreviven datos de imagen válidos. Se sube como
  `image/jpeg` (mismo patrón que `contribute.tsx`, fiable en las 3 plataformas; se prefiere
  JPEG a WEBP por soporte homogéneo de `ImageManipulator`).
- **Servidor (garantía dura)**: el bucket `avatars` se aprovisiona por migración idempotente
  con `public = true`, `file_size_limit` (p. ej. 2 MB) y
  `allowed_mime_types = {image/jpeg,image/png,image/webp}`; y policies sobre `storage.objects`:
  lectura pública, e INSERT/UPDATE/DELETE solo por `authenticated` cuyo primer segmento de path
  sea su `auth.uid()`. Path: `avatars/{user_id}/avatar.jpg` con `upsert: true` (un avatar por
  usuario, sin acumular basura). `avatar_url` guarda el path; la lectura usa `getPublicUrl` con
  un parámetro de cache-busting (`?v={updated_at}`).
- **Alternativa descartada**: subir vía Edge Function que valide bytes. El bucket con MIME +
  size + policies de path ya da la garantía de servidor sin un salto extra.
- **Doc drift**: `docs/modelo-datos.md` dice `.webp` / `{user_id}.webp`; se actualiza a
  `.jpg` bajo `{user_id}/avatar.jpg`.
- **Tamaño y dimensión definitivos** (decidido, ya no abierto): máx. **2 MB** en el bucket y
  redimensionado a **512×512** en cliente. Suficiente para un avatar y evita subidas pesadas.

### D6 — Cerrar el hueco de `users_self_update` (integridad de Octanos) — obligatorio
Se extiende el trigger `enforce_privileged_user_fields` para que, además de `role`/`suspended`,
rechace cualquier cambio de `total_octanos`, `octanos_this_month` y `current_level` cuando
`auth.uid() IS NOT NULL` (contexto cliente). Así, aunque `users_self_update` permita al usuario
actualizar su fila (necesario para nick/ciudad/avatar), no puede falsear sus Octanos ni su
nivel: esos campos solo cambian desde los triggers del servidor (contexto `service_role`, con
`auth.uid()` nulo) que ya mantienen el caché a partir de `octano_events`.
- **Por qué ahora**: esta feature promueve activamente la auto-edición de la fila propia, así
  que el hueco preexistente debe cerrarse en el mismo cambio (decisión explícita del usuario).
- **No cambia la gamificación**: no toca el cálculo ni los triggers que rellenan el caché;
  solo bloquea la escritura directa desde cliente. Se acompaña de su test pgTAP.
- **Alternativa descartada**: mover toda la edición del perfil a una Edge Function con lista
  blanca de columnas. Más pesado; el guard resuelve la integridad manteniendo el UPDATE
  directo por RLS (D1).
- **Modelado en spec**: como requisito de autorización de `user-profile` (misma superficie de
  edición de la fila propia), no como delta de `user-roles`.

### D7 — Atribución de OpenStreetMap/Nominatim (decidido)
El selector de ciudad MUST mostrar la atribución "© OpenStreetMap contributors" (texto breve
bajo la lista de sugerencias), por la política de uso de Nominatim. Decisión cerrada.

### D8 — Perfil público como ruta + componentes compartidos `Avatar`/`UserChip`
El perfil público es una **ruta** `app/user/[id].tsx` (+ `.web.tsx`), no un estado de modal
global: es deep-linkable, funciona igual en web y nativo y encaja con Expo Router. Lee la fila
`users` por id (`users_public_read` = `USING(true)`, también para `anon`) y, si
`ranking_visible`, su posición desde `mv_ranking_global`.
- Se crean dos componentes compartidos reutilizables: `Avatar` (imagen desde `avatar_url` vía
  `getPublicUrl`, o iniciales de fallback) y `UserChip` (`Avatar` + `@nick`, `onPress` →
  `router.push('/user/'+id)`). Se usan en `CommentItem`, en el detalle del parking (creador),
  en el modal de verificadores y en `RankingRow`/`RankingPodium`.
- **Privacidad**: el perfil oculta Octanos y posición si `ranking_visible = false`; avatar,
  @nick y ciudad siempre visibles (columnas públicas que el propio usuario elige).
- **Alternativa descartada**: modal/bottom-sheet global con estado en Zustand. Más acoplado y
  no deep-linkable; el modal solo se usa para la lista de verificadores.

### D9 — Atribución de autoría: joins vía embedding FK + modal de verificadores
- **Creador del parking**: se amplía `getParkingById` (que ya consulta la tabla base
  `parkings`) con embedding FK `proposer:proposed_by(username, display_name, avatar_url)`.
- **Autor del comentario**: los datos (incl. `avatar_url`) YA se consultan en
  `fetchParkingComments`; el arreglo es de UI — añadir `authorAvatarUrl` al `CommentView`
  (hoy el presenter lo descarta) y renderizarlo con `UserChip` en `CommentItem`.
- **Verificadores**: nueva consulta `fetchParkingVerifiers(parkingId)` sobre
  `parking_verifications` con embedding `verified_by(username, display_name, avatar_url)`,
  mostrada en un modal que se abre desde el contador "✓ Verificado · N" del detalle.
- **RLS**: `parking_verifications` hoy solo permite `SELECT TO authenticated`. Para que la
  lista de verificadores se vea también en la web pública (anónima), se añade una policy
  `SELECT TO anon USING (true)` (coherente con la lectura pública de parkings). Con su pgTAP.
- **No se toca el RPC `nearby_parkings` ni los pins del mapa**: la autoría del creador se
  muestra en el detalle del parking, no en cada marcador (evita ruido y no encarece el mapa).

## Risks / Trade-offs

- **[Gaming de Octanos]** `users_self_update` permitía al usuario escribir también
  `total_octanos`/`octanos_this_month`/`current_level`. → **Cerrado en este change** (ver D6):
  el guard extendido los congela ante escritura de cliente. Ya no es deuda.
- **[Rate-limit / disponibilidad de Nominatim]** → debounce + `limit` bajo + `User-Agent`;
  proveedor sustituible dentro de la Edge Function.
- **[Bucket ya existente en dashboard]** La migración usa `on conflict do nothing` al insertar
  en `storage.buckets` y `create policy if not exists`, para ser idempotente sobre el bucket
  creado a mano.
- **[Colisión de nick en carrera]** Dos usuarios pidiendo el mismo nick a la vez: la
  pre-comprobación puede pasar en ambos, pero el índice único rechaza al segundo en el commit
  → el cliente traduce `23505` a mensaje amable. La BD es la fuente de verdad.
- **[Ciudad ambigua]** "Córdoba, España" vs "Córdoba, Argentina": la etiqueta incluye país, así
  que se guardan distintas y el ranking no las mezcla.
- **[Exposición de perfiles públicos]** Avatar/@nick/ciudad ya eran datos públicos
  (`users_public_read`); los Octanos también (el ranking es público). Se respeta
  `ranking_visible` para ocultar Octanos/posición de quien se excluye del ranking. No se expone
  el email de otros usuarios (no está en las columnas mostradas del perfil público).
- **[Lectura anónima de verificadores]** Añadir `SELECT TO anon` a `parking_verifications`
  amplía la lectura pública. Es coherente con la política abierta de `parkings`; solo expone
  qué usuario verificó y cuándo (ya visible para autenticados). Con su pgTAP.

## Migration Plan

1. Migración SQL: índice único funcional `LOWER(username)` + CHECK de formato del nick;
   aprovisionamiento idempotente del bucket `avatars` (MIME + size) y policies de
   `storage.objects`; extensión (obligatoria) del guard `enforce_privileged_user_fields` para
   congelar los campos caché de Octanos/nivel; policy `SELECT TO anon` en
   `parking_verifications`.
2. pgTAP: unicidad case-insensitive, CHECK de formato, policies de Storage de `avatars`,
   que un cliente no pueda auto-editar `total_octanos`/`octanos_this_month`/`current_level`, y
   lectura anónima de `parking_verifications`.
3. Edge Function `city-search` (Deno + Zod) + `deno test`; desplegar a Cloud.
4. Cliente: dependencia `expo-image-picker`; feature `features/profile/`
   (api/hooks/schemas/components), `CitySearchInput`, rediseño de `profile.tsx`; variantes
   `.web.tsx` donde el picker difiera.
5. Cliente (perfiles públicos/autoría): componentes `Avatar` y `UserChip`; ruta `app/user/[id]`
   (+ `.web.tsx`); creador en el detalle del parking; avatar+chip en `CommentItem`; modal de
   verificadores; filas del ranking pulsables.
6. Regenerar tipos (`pnpm gen:types`) y `pnpm typecheck` + `pnpm test`.
7. Actualizar docs canónicos (prd, modelo-datos, arquitectura, testing).
8. Cierre obligatorio: `verify-all-platforms` (web + Android + iOS), logueado como usuario,
   con limpieza de datos de prueba y evidencia en `.claude/verify-runs/edit-profile.md`.

**Rollback**: la migración es aditiva (índice + bucket + policies); si algo falla, `drop index`
y revertir policies del bucket es seguro (no se hace DROP de columnas). La Edge Function y el
código cliente se revierten por despliegue/PR.

## Open Questions

Ninguna. Todas resueltas:
- **Tamaño/dimensión del avatar**: 2 MB máx. + 512×512 (D5).
- **Hardening de Octanos**: se aborda en este change, obligatorio (D6).
- **Atribución OSM/Nominatim**: sí, se muestra en el selector de ciudad (D7).
- **Email**: se conserva, en solo lectura; el nick editable es el @handle (D2).
