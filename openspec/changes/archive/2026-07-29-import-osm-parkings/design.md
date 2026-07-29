## Context

El mapa quedó vacío tras purgar los datos de prueba. Queremos poblarlo con parkings de moto reales sin escribirlos a mano y sin infringir licencias. OpenStreetMap expone plazas de moto con el tag `amenity=motorcycle_parking` bajo licencia **ODbL** (uso libre con atribución). Ya tenemos infraestructura reutilizable: la Edge Function `city-search` habla con **Nominatim** (`nominatim.ts`, User-Agent propio) para geocoding, y el modelo `parkings` acepta inserciones con `service_role`.

Restricciones del proyecto que condicionan el diseño:
- Autorización solo por RLS; los parkings `pending` no son visibles para `anon`/`authenticated` (solo el proponente y admin), pero `service_role` los ve todos.
- No se persiste geolocalización de usuarios; aquí solo geolocalizamos **parkings**, no personas.
- `docs/prd.md` §7.2 excluye "importación masiva de datos externos": este change acota esa exclusión (seeding admin, `pending`, ODbL) con confirmación del usuario.

## Goals / Non-Goals

**Goals:**
- Sembrar parkings reales de Córdoba desde OSM (POC ~12), en estado `pending`.
- Dejar un script **reutilizable** que importe cualquier ciudad cambiando un parámetro.
- Ser **idempotente**: re-ejecutar una ciudad no crea duplicados.
- Importar fotos **solo cuando la licencia es libre** (Wikimedia Commons).
- Atribuir correctamente los datos (ODbL) y las fotos (autor/licencia CC).

**Non-Goals:**
- Ejecutar ciudades distintas de Córdoba en este change.
- Verificación automática de los parkings importados.
- Automatizar la importación (cron / edge function).
- Nuevas tablas o columnas (`osm_id`); la idempotencia es por proximidad.

## Decisions

### D1 — Fuente: Overpass API por *bounding box* (no `area[name]`)
Overpass devuelve nodos/ways de `amenity=motorcycle_parking`. La consulta `area[name="Córdoba"]` da **504 timeout**; el bounding box `(37.83,-4.85,37.92,-4.70)` responde de forma fiable (~12 resultados medidos). Los `way` (polígonos) se reducen a su centroide (`out center`). **Alternativa descartada**: descargar el extracto de España (~7.5k) y filtrar localmente — innecesario para un POC por ciudad y más pesado de operar.

### D2 — Script Deno en `scripts/osm-import/` (no Edge Function, no Node)
Deno permite reutilizar directamente `city-search/nominatim.ts`, no necesita build step y ejecuta TS nativo, igual que las Edge Functions del repo. Se ejecuta **manualmente** por un operador con la `service_role key` del `.env` raíz (nunca se sube al cliente). **Alternativas descartadas**: Edge Function (se dispararía desde el cliente, no encaja para una herramienta ops puntual) y script Node (obligaría a build/tsx y a duplicar la lógica de Nominatim).

Estructura:
- `cities.ts` — catálogo `{ slug, city, bbox }`. Arranca con `cordoba`.
- `osm.ts` — consulta Overpass y normaliza nodos/ways a un tipo `OsmParking`.
- `mapping.ts` — `OsmParking → ParkingInsert` (mapeo de tags, nombre, features).
- `import-osm-parkings.ts` — orquestador CLI: `deno run ... --city <slug> [--dry-run]`.

### D3 — Autor: usuario de sistema `@motociudad` (UUID fijo determinista)
`parkings.proposed_by` es FK a `public.users`, que a su vez es FK a `auth.users`. Creamos ambas filas en una **migración idempotente** (`ON CONFLICT DO NOTHING`) con un UUID fijo conocido (constante compartida entre migración y script). `display_name="MotoCiudad"`, `username="motociudad"`, `ranking_visible=false` (no compite en el ranking). **Alternativa descartada**: reusar el admin `curro` — mezcla seeding con una cuenta personal y ensucia su perfil/ranking.

### D4 — Idempotencia por proximidad (<25 m), sin columna nueva
Antes de insertar cada candidato, el script consulta si existe algún parking a <25 m vía `ST_DWithin(location, ST_MakePoint(lng,lat)::geography, 25)` (con `service_role`, que ve también los `pending`). Si lo hay, se omite. **Alternativa descartada**: columna `osm_id` unique + upsert — más limpio y auditable, pero implica migración de schema, y el usuario prefirió evitarla para el POC. Riesgo asumido en Risks.

### D5 — Nombre: `tags.name` → si falta, calle vía Nominatim reverse-geocode
Las plazas de calle casi nunca tienen `name`. Si `tags.name` existe se usa tal cual; si no, se llama a Nominatim `reverse` (lat/lng → dirección) y se compone `Parking moto · {calle}`. Se respeta el rate-limit de Nominatim (**1 req/s**, User-Agent `MotoCiudad/1.0`). `name` es `NOT NULL`, así que si el reverse-geocode también falla, se usa el fallback `Parking moto · {ciudad}`.

### D6 — Fotos solo desde `wikimedia_commons` (licencia libre)
El tag `image` genérico apunta a fotos externas de copyright desconocido → **excluido** por riesgo legal en una app publicada. El tag `wikimedia_commons` (`File:...`) tiene licencia CC explícita. Flujo *best-effort*:
1. Resolver metadatos vía Commons API (`prop=imageinfo&iiprop=url|extmetadata`) → URL del archivo + autor + licencia.
2. Descargar bytes (`Special:FilePath` o `imageinfo.url`), validar `content-type` imagen y tamaño (<5 MB).
3. Subir a `parkings-photos/{parking_id}/{photo_id}.<ext>` vía Storage API (`service_role`).
4. Insertar `parking_photos` con `is_primary=true`, `is_verification=false`, `uploaded_by=@motociudad`.
5. Anexar la atribución (`author`, `license`, "Wikimedia Commons") a `parkings.notes` para trazabilidad (no a `features`, que es boolean-only).
Si cualquier paso falla, se omite la foto y el parking se inserta igual.

### D7 — Mapeo de tags OSM → `parkings`
| Campo `parkings` | Origen | Regla |
|---|---|---|
| `location` | `lat`/`lon` (o centroide del way) | `geography(Point,4326)` |
| `name` | `tags.name` / reverse-geocode | ver D5 |
| `type` | — | siempre `'public'` (plazas en calle) |
| `status` | — | siempre `'pending'` |
| `city` | catálogo | etiqueta canónica del `cities.ts` |
| `capacity` | `tags.capacity` | solo si parsea a entero > 0 |
| `features.covered` | `tags.covered` | `=== 'yes'` |
| `features.free` | `tags.fee` | `=== 'no'` |
| `notes` | — | `"Importado de OpenStreetMap (© OpenStreetMap contributors, ODbL). · osm:{osm_id}"` (+ atribución de foto si la hay) |
| `proposed_by` | — | usuario de sistema @motociudad |

**`features` es SOLO booleanos.** El cliente valida `features` con `z.record(z.boolean())`
(`apps/mobile/features/parkings/schemas.ts`), así que cualquier valor de texto rompe el
parseo en la lista/mapa. Por eso la trazabilidad (id OSM, atribución de foto) vive en `notes`
(texto libre), no en `features`. La identificación/reversión del seeding se hace por
`proposed_by = @motociudad`.

### D8 — Atribución ODbL en la app
Añadir el crédito "© OpenStreetMap contributors" en la pantalla de información/ajustes de la app (donde ya se muestran créditos), cubriendo tanto móvil como web. La atribución de fotos CC viaja en `features.source_photo`.

## Risks / Trade-offs

- **Dedupe por proximidad puede tener falsos positivos/negativos** (dos parkings reales a <25 m se colapsan; o el mismo parking movido >25 m se duplica en una re-ejecución) → Mitigación: umbral 25 m es conservador para plazas de calle; `--dry-run` permite revisar antes de escribir; volumen bajo (POC) revisable a mano. Si escala, se migra a `osm_id` (documentado como evolución futura).
- **Overpass/Nominatim/Commons pueden fallar o limitar** → Mitigación: reintentos con backoff, rate-limit 1 req/s en Nominatim, User-Agent identificativo; fotos y nombres son best-effort y nunca bloquean la inserción del parking.
- **`service_role key` en un script local** → Mitigación: se lee del `.env` raíz (gitignored), nunca se hardcodea ni viaja al cliente; el script es de ejecución manual por operador.
- **Licencia de fotos** → Mitigación: solo Wikimedia Commons (CC), con atribución almacenada; el `image` genérico se ignora.
- **Divergencia code/specs** (regla del proyecto) → Mitigación: el PRD y el modelo-datos se actualizan en este mismo change.

## Migration Plan

1. Aplicar la migración del usuario de sistema `@motociudad` (idempotente) a Supabase Cloud.
2. Ejecutar `deno run --city cordoba --dry-run` y revisar el listado propuesto.
3. Ejecutar sin `--dry-run` para insertar en Cloud.
4. Verificar en app (web + Android + iOS) que los parkings aparecen como `pending` y son verificables (`verify-all-platforms`).
5. **Rollback**: los parkings importados son identificables por `proposed_by = @motociudad` (y `features.source='osm'`); un `DELETE` acotado a ese autor los revierte. La migración del usuario de sistema no se revierte (inocua).

## Open Questions

- Ubicación exacta del crédito ODbL en la UI (pantalla de ajustes vs. "Acerca de"): se decide al implementar D8 según lo que ya exista.
