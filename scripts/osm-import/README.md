# Importación de parkings desde OpenStreetMap

Herramienta ops (Deno) para sembrar parkings de moto reales desde OpenStreetMap
(`amenity=motorcycle_parking`) en la base de datos de MotoCiudad. Los parkings se
crean en estado `pending` para que la comunidad los verifique.

> Change OpenSpec: `import-osm-parkings`. Ver `openspec/changes/import-osm-parkings/`.

## Requisitos

- [Deno](https://deno.com/) 2.x.
- El `.env` **raíz** del repo con `EXPO_PUBLIC_SUPABASE_URL` y
  `SUPABASE_SERVICE_ROLE_KEY` (gitignored — no se sube). El script lo lee
  automáticamente; la `service_role key` nunca se hardcodea ni viaja al cliente.
- Migración `20260729000001_system_user_motociudad.sql` aplicada (crea el
  usuario de sistema `@motociudad`, autor de los parkings importados).

## Uso

```bash
cd scripts/osm-import

# Previsualizar sin escribir nada (recomendado antes de importar):
deno task import --city cordoba --dry-run

# Importar de verdad:
deno task import --city cordoba
```

Resumen final: nº insertados, omitidos por proximidad y fotos importadas.

## Cómo añadir una ciudad nueva

Edita `cities.ts` y añade una entrada al array `CITIES`:

```ts
{ slug: "sevilla", city: "Sevilla", bbox: { south: 37.32, west: -6.05, north: 37.45, east: -5.90 } }
```

- `slug`: identificador para `--city`.
- `city`: etiqueta que se guarda en `parkings.city`.
- `bbox`: bounding box `south,west,north,east` (usa el area por bbox; el lookup
  `area[name]` de Overpass da 504). Puedes obtenerlo en
  <https://boundingbox.klokantech.com/> (formato CSV RAW).

Luego `deno task import --city sevilla --dry-run` para revisar antes de escribir.

## Qué hace (resumen)

- **Fuente**: Overpass API por bounding box (nodes + ways, ways → centroide).
- **Nombre**: `tags.name` de OSM; si falta, reverse-geocode de la calle vía
  Nominatim (1 req/s, User-Agent propio); fallback `Parking moto · {ciudad}`.
- **Idempotencia**: descarta candidatos con un parking existente a <25 m
  (`nearby_parkings` RPC). Re-ejecutar una ciudad no duplica.
- **Fotos**: solo desde el tag `wikimedia_commons` (licencia libre CC), con
  atribución de autor/licencia. El tag `image` genérico se ignora (licencia
  desconocida). Best-effort: si la foto falla, el parking se inserta igual.
- **Atribución**: cada parking guarda `features.source='osm'` y una nota ODbL.

## Tests

```bash
deno task test   # unit tests de los módulos puros (mapping, naming, fotos)
```
