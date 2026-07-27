## Why

Hoy la pantalla **"Mi perfil"** solo muestra el email y los Octanos: el usuario no puede
elegir su identidad pública. El `username` se autogenera con el prefijo del email y queda
inmutable, no hay foto de avatar y `city_primary` nunca se rellena. Esto último deja el
**ranking por ciudad vacío** (la infraestructura existe pero nadie tiene ciudad). Los
usuarios piden poder personalizar su nick, su ciudad ("Me suelo mover por…") y su avatar.

## What Changes

- **El email se mantiene** visible en "Mi perfil" como identidad de la cuenta, en **solo
  lectura** (lo gestiona Supabase Auth). No se pierde.
- **Editar el nick (@handle)** como **campo aparte del email**: es el identificador que hoy se
  muestra en los comentarios y el ranking (por defecto el prefijo del email). Un único campo
  público que escribe a la vez `username` y `display_name`, de modo que lo que el usuario
  elige es exactamente lo que se ve en ranking y comentarios. El nick es **único e insensible a
  mayúsculas** ("Curro" == "curro") y validado en formato; si ya existe, se avisa con un
  mensaje claro. Sin límite de cambios.
- **Cerrar el hueco de `users_self_update`**: se impide que un usuario edite directamente sus
  propios campos de Octanos/nivel (`total_octanos`, `octanos_this_month`, `current_level`) al
  actualizar su fila, para que no pueda falsear el ranking. Solo cambian vía los triggers del
  servidor.
- **Ciudad "Me suelo mover por…"** con **buscador tipo autocompletar**: al escribir se
  muestran sugerencias "Ciudad, País" (no solo España) y el usuario escoge una; se guarda
  una etiqueta canónica en `city_primary`, de modo que se escriba como se escriba siempre
  se normaliza a la misma ciudad. Esto **activa el ranking por ciudad**.
- **Avatar**: el usuario puede subir una imagen desde su galería. Restringido a imágenes y
  endurecido contra ficheros maliciosos: la imagen se re-codifica y redimensiona en cliente
  (se descartan EXIF y cualquier carga incrustada) y el bucket de Storage impone MIME y
  tamaño máximo en servidor. Cada usuario solo puede escribir en su propia carpeta.
- **Rediseño de "Mi perfil"**: se carga la fila `public.users` (hoy no se lee) para mostrar
  avatar real, nick, nivel, ciudad y Octanos, con acceso a "Editar perfil".
- Nueva **Edge Function `city-search`** que proxea un geocodificador keyless (Nominatim/OSM,
  igual que la web) y devuelve sugerencias normalizadas; funciona igual en web, iOS y Android.
- **Perfiles públicos y atribución de autoría en toda la app pública**:
  - El **detalle de un parking** muestra siempre el **avatar + @nick del que lo propuso**.
  - Cada **comentario** muestra el **avatar + @nick de su autor**.
  - En el **contador de verificaciones** del parking se puede abrir un **modal con la lista de
    quién ha verificado** (avatar + @nick de cada verificador).
  - **Al pulsar sobre cualquier usuario** (creador, autor de comentario, verificador, fila del
    ranking) se abre su **perfil público**: avatar, @nick, ciudad, nivel y Octanos.
  - La ficha pública respeta la privacidad: si el usuario tiene `ranking_visible = false` se
    ocultan sus Octanos y su posición, mostrando solo avatar, @nick y ciudad.

## Capabilities

### New Capabilities
- `user-profile`: ver y editar el perfil propio — nick único (case-insensitive) que dirige
  la identidad pública, ciudad principal seleccionada por autocompletar, y avatar subido a
  Storage con validación de imagen. Reglas de autorización (solo el propio usuario edita su
  fila) y de integridad (unicidad del nick, MIME/tamaño del avatar).
- `city-search`: servicio de búsqueda de ciudades por texto que devuelve sugerencias
  estructuradas (nombre, región, país, coordenadas) para poblar `city_primary` de forma
  normalizada y multiplataforma.
- `public-user-profiles`: ver el perfil público de cualquier usuario (avatar, @nick, ciudad,
  nivel y Octanos, respetando `ranking_visible`) y mostrar la autoría con identidad
  (avatar + @nick) del creador del parking, del autor de cada comentario y de los
  verificadores, con navegación al perfil al pulsar sobre cualquier usuario.

### Modified Capabilities
<!-- Ninguna requirement de specs existentes cambia su comportamiento. El endurecimiento
     contra la auto-edición de Octanos/nivel se modela como requisito de autorización de la
     capacidad `user-profile` (misma superficie: editar la fila propia). `ranking-octanos`
     no cambia: solo empieza a recibir datos de ciudad. -->

## Impact

- **Código móvil**: nueva feature `features/profile/` (api.ts, hooks.ts, schemas.ts,
  components/ con formulario de edición, `CitySearchInput` y selector de avatar) y rediseño
  de `app/(tabs)/profile.tsx`. Nueva feature/hook de búsqueda de ciudad reutilizable.
- **Perfiles públicos / autoría**: nueva ruta `app/user/[id].tsx` (+ `.web.tsx`) para el
  perfil público; componentes compartidos `Avatar` y `UserChip` (avatar + @nick pulsable).
  Se muestran en el detalle del parking (creador), en `CommentItem` (autor) y en las filas del
  ranking; nuevo modal de "quién verificó" en el detalle del parking. Se amplía
  `getParkingById` con la identidad del proponente (embedding FK `proposed_by`), se añade una
  consulta de verificadores (`verified_by`), y el presenter/vista de comentarios pasa a
  incluir el avatar (hoy se consulta pero se descarta).
- **Dependencias**: se añade `expo-image-picker` (selección desde galería). Se reutiliza
  `expo-image-manipulator` (ya presente) para re-codificar/redimensionar.
- **Backend**: migración con índice único funcional sobre `LOWER(username)` + CHECK de
  formato del nick; provisión idempotente del bucket `avatars` (público de lectura, MIME
  restringido a imágenes, límite de tamaño) y sus policies de Storage (escritura solo en la
  carpeta propia); extensión del guard de campos privilegiados a los campos de Octanos/nivel;
  y policy de lectura `anon` para `parking_verifications` (hoy solo `authenticated`) para que
  la lista de verificadores se vea también en la web pública. Nueva Edge Function `city-search`.
- **Datos**: `users.city_primary` pasa a poblarse → el ranking por ciudad deja de estar vacío.
- **Docs canónicos**: actualizar `docs/prd.md` (funcionalidad de perfil), `docs/modelo-datos.md`
  (índice de unicidad, bucket `avatars` y su path/formato), `docs/arquitectura.md` (Edge
  Function `city-search` y geocoding vía Nominatim), `docs/testing.md` (nuevos tests) y, si
  procede, `docs/infraestructura.md` (bucket de Storage).
- **Privacidad**: no se persiste geolocalización del usuario; la ciudad es una etiqueta
  textual que el propio usuario elige (cumple la regla de privacidad).

## Non-goals

- No se edita el email ni la contraseña (los gestiona Supabase Auth).
- No se añade elección de nick/ciudad/avatar en el **registro** (solo en "Mi perfil"); el
  alta sigue igual.
- No se implementa `bike_model` ni otros campos de perfil todavía.
- No se recortan/editan imágenes (crop) más allá del redimensionado automático.
- No se cambia el catálogo ni la normalización de `parkings.city` (dominio distinto).
- No hay cooldown ni historial de cambios de nick.
- No se edita `city_primary` como texto libre (siempre por selección de sugerencia).
