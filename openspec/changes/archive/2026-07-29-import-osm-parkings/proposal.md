## Why

Tras purgar los datos de prueba, el mapa está vacío. Necesitamos parkings de moto **reales** para que la comunidad tenga algo que verificar (y ganar Octanos) desde el primer día. OpenStreetMap publica plazas de moto (`amenity=motorcycle_parking`) bajo licencia libre ODbL, así que podemos sembrarlas legalmente. Empezamos por Córdoba como POC (~12) y dejamos la herramienta lista para el resto de ciudades.

## What Changes

- **Nuevo script de seeding reutilizable** (`scripts/osm-import/`, Deno): consulta Overpass API por *bounding box*, mapea los nodos OSM al modelo `parkings` e inserta vía `service_role`. Parametrizable por ciudad (`--city <slug>`) con un catálogo `cities.ts`; soporta `--dry-run`.
- **Parkings importados nacen `status='pending'`** — sin verificación automática; los verifica la comunidad como cualquier propuesta.
- **Usuario de sistema `@motociudad`** como autor (`proposed_by`) de los parkings importados y como `uploaded_by` de sus fotos. Creado por migración idempotente. `ranking_visible=false` para no ensuciar el ranking.
- **Idempotencia por proximidad** (sin cambio de schema): antes de insertar, se descarta cualquier candidato con un parking existente a menos de 25 m. Re-ejecutar una ciudad no duplica.
- **Nombres**: se usa `tags.name` de OSM si existe; si falta (lo habitual en plazas de calle), se reverse-geocodifica la calle vía Nominatim reutilizando `supabase/functions/city-search/nominatim.ts`.
- **Fotos**: se importa foto **solo** desde el tag `wikimedia_commons` (licencia libre CC, con atribución de autor/licencia). Se ignora el tag `image` genérico por licencia desconocida (riesgo de copyright en app publicada). Es *best-effort*: si la foto falla, el parking se inserta igual.
- **Atribución de datos ODbL** ("© OpenStreetMap contributors") visible en la app.
- **Actualización de documentos canónicos** (ver Impact): se acota la exclusión "importación masiva de datos externos" del PRD.

## Capabilities

### New Capabilities
- `import-osm-parkings`: seeding administrado de parkings de moto desde OpenStreetMap — obtención (Overpass), mapeo al modelo `parkings`, dedupe por proximidad, autoría por usuario de sistema, importación opcional de fotos de Wikimedia Commons, y atribución de licencias.

### Modified Capabilities
<!-- Ninguna capability existente cambia sus requisitos; los cambios en docs canónicos (PRD, modelo-datos) se listan en Impact. -->

## Impact

- **Código nuevo**: `scripts/osm-import/{cities.ts,import-osm-parkings.ts,osm.ts,mapping.ts}` (Deno). Reutiliza `supabase/functions/city-search/nominatim.ts`.
- **Migración**: crea el usuario de sistema `@motociudad` (fila idempotente en `auth.users` + `public.users`, UUID fijo determinista). No crea tablas ni columnas nuevas.
- **Datos**: inserta filas en `parkings` (y opcionalmente `parking_photos` + objetos en el bucket `parkings-photos`) usando `service_role`.
- **Dependencias externas**: Overpass API (`overpass-api.de`), Nominatim y Wikimedia Commons API — todas vía `fetch` con User-Agent `MotoCiudad/1.0`, respetando sus políticas de uso (rate-limit 1 req/s en Nominatim).
- **Documentos canónicos**:
  - `docs/prd.md` §7.2 — añadir excepción acotada: se permite el *seeding* de parkings desde OSM ejecutado por admin/ops (estado `pending`, atribución ODbL). Resuelve la discrepancia con la exclusión "importación masiva de datos externos".
  - `docs/modelo-datos.md` — documentar el usuario de sistema `@motociudad` y la convención de trazabilidad de origen OSM en `features`/`notes`.
- **Sin cambios** en Octanos/gamificación (los parkings `pending` no otorgan puntos hasta que la comunidad los verifica) ni en el cliente móvil.

## Non-goals

- **Ejecutar el resto de ciudades**: el script queda listo y probado con Córdoba, pero solo corremos Córdoba como POC en este change.
- **Verificación automática**: nada se marca `verified` por importación; todo nace `pending`.
- **Importar fotos con licencia dudosa** (tag `image` genérico): excluidas por riesgo de copyright.
- **Nuevas tablas o columnas**: la idempotencia es por proximidad, no por columna `osm_id`.
- **Automatizar/programar la importación** (cron, edge function): es una herramienta ops de ejecución manual.
