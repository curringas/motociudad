## ADDED Requirements

### Requirement: Obtención de parkings desde OpenStreetMap
El sistema SHALL obtener plazas de moto desde OpenStreetMap consultando la Overpass API por el tag `amenity=motorcycle_parking`, acotando la consulta a un *bounding box* geográfico definido por ciudad.

#### Scenario: Consulta por bounding box de una ciudad del catálogo
- **WHEN** el operador ejecuta la importación para `--city cordoba`
- **THEN** el sistema consulta Overpass con el bounding box de Córdoba definido en el catálogo `cities.ts`
- **AND** recibe los nodos y ways de `amenity=motorcycle_parking` dentro de ese área

#### Scenario: Ways reducidos a su centroide
- **WHEN** un elemento OSM es un `way` (polígono) en lugar de un `node`
- **THEN** el sistema usa su centroide (`out center`) como coordenada del parking

#### Scenario: Fallo o timeout de Overpass
- **WHEN** la Overpass API responde con error o timeout
- **THEN** el sistema reintenta con backoff
- **AND** si sigue fallando aborta la importación sin escribir datos parciales

### Requirement: Catálogo de ciudades reutilizable
El sistema SHALL definir las ciudades importables en un catálogo `cities.ts` con `slug`, etiqueta de ciudad canónica y *bounding box*, de modo que importar una ciudad nueva solo requiera añadir una entrada y pasar su `slug`.

#### Scenario: Ciudad presente en el catálogo
- **WHEN** el operador ejecuta la importación con un `--city <slug>` presente en el catálogo
- **THEN** el sistema usa el bounding box y la etiqueta de ciudad de esa entrada

#### Scenario: Ciudad ausente del catálogo
- **WHEN** el operador pasa un `--city <slug>` que no existe en el catálogo
- **THEN** el sistema termina con un error claro que indica los slugs disponibles
- **AND** no consulta Overpass ni escribe datos

### Requirement: Mapeo de datos OSM al modelo de parkings
El sistema SHALL mapear cada elemento OSM al modelo `parkings` usando: coordenadas → `location` (`geography(Point,4326)`); `type='public'`; `status='pending'`; `city` = etiqueta canónica del catálogo; `capacity` = `tags.capacity` solo si es un entero positivo; y `features` con **solo valores booleanos** conocidos del modelo (`covered` desde `tags.covered='yes'`, `free` desde `tags.fee='no'`). La trazabilidad (id del elemento OSM y atribución) NO va en `features` —que el cliente valida como `z.record(z.boolean())`— sino en `notes` (texto).

#### Scenario: Parking con capacidad y cubierta declaradas
- **WHEN** un elemento OSM tiene `capacity=10`, `covered=yes` y `fee=no`
- **THEN** el parking resultante tiene `capacity=10` y `features` con `covered=true` y `free=true`

#### Scenario: features contiene únicamente booleanos
- **WHEN** se mapea cualquier elemento OSM
- **THEN** todos los valores de `features` son booleanos (nunca texto)
- **AND** el id OSM se registra en `notes` (p. ej. `· osm:node/123`), no en `features`

#### Scenario: Tags ausentes o no numéricos
- **WHEN** un elemento OSM no tiene `capacity` o tiene un `capacity` no numérico
- **THEN** el parking resultante deja `capacity` nulo
- **AND** no añade claves de `features` fuera de las conocidas por el modelo

#### Scenario: Estado y tipo por defecto
- **WHEN** se mapea cualquier elemento OSM
- **THEN** el parking nace con `status='pending'` y `type='public'`

### Requirement: Nombre del parking
El sistema SHALL asignar como nombre el `tags.name` de OSM cuando exista; si no existe, SHALL reverse-geocodificar la calle vía Nominatim y componer `Parking moto · {calle}`, respetando el rate-limit de Nominatim (1 req/s) y un User-Agent identificativo. Como `name` es obligatorio, si el reverse-geocode falla SHALL usar el fallback `Parking moto · {ciudad}`.

#### Scenario: El elemento OSM tiene name
- **WHEN** el elemento OSM incluye `tags.name`
- **THEN** el parking usa ese nombre tal cual, sin llamar a Nominatim

#### Scenario: El elemento OSM no tiene name
- **WHEN** el elemento OSM no incluye `tags.name`
- **THEN** el sistema reverse-geocodifica la coordenada vía Nominatim
- **AND** compone el nombre `Parking moto · {calle}` con la calle obtenida

#### Scenario: Reverse-geocode no disponible
- **WHEN** Nominatim no devuelve una calle utilizable
- **THEN** el sistema usa el fallback `Parking moto · {ciudad}`
- **AND** el parking siempre tiene un `name` no nulo

### Requirement: Autoría por usuario de sistema
El sistema SHALL crear los parkings importados con `proposed_by` apuntando a un usuario de sistema `@motociudad` (UUID fijo determinista, `display_name` "MotoCiudad", `ranking_visible=false`). El usuario de sistema SHALL crearse mediante una migración idempotente en `auth.users` y `public.users`.

#### Scenario: El usuario de sistema no existía
- **WHEN** se aplica la migración por primera vez
- **THEN** se crea la fila del usuario `@motociudad` en `auth.users` y `public.users`

#### Scenario: La migración se aplica de nuevo
- **WHEN** la migración vuelve a ejecutarse y el usuario ya existe
- **THEN** no se produce error ni duplicado (inserción idempotente)

#### Scenario: Autoría de los parkings importados
- **WHEN** el script inserta un parking importado
- **THEN** su `proposed_by` es el UUID del usuario de sistema `@motociudad`

### Requirement: Idempotencia por proximidad
El sistema SHALL evitar duplicados al re-importar: antes de insertar un candidato, SHALL descartarlo si existe algún parking a menos de 25 metros (`ST_DWithin`), consultado con `service_role` para incluir también los parkings en estado `pending`.

#### Scenario: Re-ejecución de una ciudad ya importada
- **WHEN** se ejecuta la importación de una ciudad cuyos parkings ya se importaron
- **THEN** cada candidato con un parking existente a <25 m se omite
- **AND** no se crean filas duplicadas

#### Scenario: Candidato en zona sin parkings cercanos
- **WHEN** un candidato no tiene ningún parking existente a <25 m
- **THEN** el candidato se inserta normalmente

### Requirement: Importación de fotos solo con licencia libre
El sistema SHALL importar una foto para un parking únicamente cuando el elemento OSM tenga el tag `wikimedia_commons`. SHALL ignorar el tag `image` genérico. La importación de foto es *best-effort*: si cualquier paso falla, el parking se inserta igual sin foto.

#### Scenario: Elemento con foto de Wikimedia Commons
- **WHEN** un elemento OSM tiene `wikimedia_commons=File:...`
- **THEN** el sistema resuelve la URL, autor y licencia vía la Commons API
- **AND** descarga la imagen, la sube al bucket `parkings-photos/{parking_id}/{photo_id}` con `service_role`
- **AND** inserta una fila en `parking_photos` con `is_primary=true`, `is_verification=false` y `uploaded_by=@motociudad`
- **AND** anexa la atribución (autor, licencia, Wikimedia Commons) a `notes`

#### Scenario: Elemento con solo tag image genérico
- **WHEN** un elemento OSM tiene `image=<URL>` pero no `wikimedia_commons`
- **THEN** el sistema no importa ninguna foto para ese parking

#### Scenario: La descarga o subida de la foto falla
- **WHEN** la resolución, descarga o subida de la foto de Commons falla
- **THEN** el parking se inserta igualmente sin foto
- **AND** la importación continúa con el resto de elementos

### Requirement: Modo dry-run
El sistema SHALL soportar un flag `--dry-run` que imprima los parkings que se insertarían (tras dedupe) sin escribir nada en la base de datos ni en el Storage.

#### Scenario: Ejecución con --dry-run
- **WHEN** el operador ejecuta la importación con `--dry-run`
- **THEN** el sistema imprime el listado de parkings candidatos tras el dedupe
- **AND** no realiza ninguna escritura en `parkings`, `parking_photos` ni Storage

### Requirement: Atribución de datos OSM
El sistema SHALL atribuir los datos importados a OpenStreetMap: cada parking importado SHALL registrar su origen en `notes` (atribución ODbL + id del elemento OSM), y la app SHALL mostrar el crédito "© OpenStreetMap contributors" en una pantalla visible tanto en móvil como en web.

#### Scenario: Trazabilidad de origen en el parking
- **WHEN** se inserta un parking importado
- **THEN** `notes` incluye la atribución ODbL y el id OSM (`· osm:{id}`)

#### Scenario: Crédito visible en la app
- **WHEN** el usuario abre la pantalla de información/ajustes de la app (móvil o web)
- **THEN** ve el crédito "© OpenStreetMap contributors"
