## 1. Migración: usuario de sistema @motociudad

- [x] 1.1 Crear migración idempotente que inserta `@motociudad` en `auth.users` y `public.users` (UUID fijo determinista, `display_name`="MotoCiudad", `username`="motociudad", `ranking_visible=false`) con `ON CONFLICT DO NOTHING`.
- [x] 1.2 Definir el UUID del usuario de sistema como constante compartida (documentada) para que migración y script coincidan.
- [x] 1.3 Aplicar la migración a Supabase Cloud y verificar que la fila existe y es idempotente (re-aplicar sin error).

## 2. Script de importación (scripts/osm-import/)

- [x] 2.1 Crear `cities.ts` con el catálogo `{ slug, city, bbox }` y la entrada `cordoba` (bbox 37.83,-4.85,37.92,-4.70).
- [x] 2.2 Crear `osm.ts`: consulta Overpass por bounding box (`amenity=motorcycle_parking`, `out center`), con reintentos/backoff, y normaliza nodos/ways a un tipo `OsmParking` (id, lat, lng, tags).
- [x] 2.3 Crear `mapping.ts`: `OsmParking → ParkingInsert` según D7 (location, type='public', status='pending', city, capacity entero>0, features conocidas + `source='osm'`/`osm_id`, notes con atribución ODbL).
- [x] 2.4 Implementar el nombrado: `tags.name` → reverse-geocode Nominatim (reutilizando `city-search/nominatim.ts`, rate-limit 1 req/s, User-Agent `MotoCiudad/1.0`) → fallback `Parking moto · {ciudad}`.
- [x] 2.5 Implementar dedupe por proximidad (`ST_DWithin` a <25 m vía `service_role`) antes de insertar.
- [x] 2.6 Implementar importación de foto best-effort solo desde `wikimedia_commons` (Commons API imageinfo/extmetadata → descarga → subida a `parkings-photos` → fila `parking_photos` is_primary/uploaded_by=@motociudad → atribución en `features.source_photo`); ignorar tag `image`.
- [x] 2.7 Crear el orquestador CLI `import-osm-parkings.ts`: parseo de `--city <slug>` y `--dry-run`, lectura de `service_role key` del `.env` raíz, resumen final (insertados / omitidos por dedupe / fotos).
- [x] 2.8 Añadir `deno.json`/tareas y un `README.md` en `scripts/osm-import/` con el comando y cómo añadir ciudades nuevas.

## 3. Atribución en la app (ODbL)

- [x] 3.1 Añadir el crédito "© OpenStreetMap contributors" en la pantalla de información/ajustes, visible en móvil y web.

## 4. Tests

- [x] 4.1 Tests unitarios de `mapping.ts` (tags→features, capacity numérica/ausente, defaults status/type, notes de atribución).
- [x] 4.2 Tests unitarios del nombrado (name presente, ausente con calle, fallback ciudad).
- [x] 4.3 Test pgTAP idempotente de la migración del usuario de sistema (existe con `ranking_visible=false`; re-aplicar no duplica).
- [x] 4.4 Test unitario de la selección de foto (usa `wikimedia_commons`, ignora `image`, best-effort no bloquea).

## 5. Ejecución POC Córdoba

- [x] 5.1 Ejecutar `deno run ... --city cordoba --dry-run` y revisar el listado candidato.
- [x] 5.2 Ejecutar sin `--dry-run` contra Cloud e insertar los parkings de Córdoba.
- [x] 5.3 Comprobar en Cloud que las filas tienen `proposed_by=@motociudad`, `status='pending'`, `features.source='osm'`.

## 6. Documentación canónica (specs)

- [x] 6.1 Actualizar `docs/prd.md` §7.2: excepción acotada a "importación masiva de datos externos" (seeding OSM admin/ops, `pending`, atribución ODbL).
- [x] 6.2 Actualizar `docs/modelo-datos.md`: usuario de sistema `@motociudad` y convención de trazabilidad de origen OSM en `features`/`notes`.

## 7. Verificación de cierre (obligatoria)

- [ ] 7.1 Ejecutar `verify-all-platforms` vía subagente `e2e-verifier`: app móvil en web (Playwright) + Android (emulador) + iOS (simulador), logueado como usuario, comprobando que los parkings importados aparecen en mapa/lista como `pending` y son verificables.
- [ ] 7.2 Limpiar cualquier dato de prueba generado durante la verificación y dejar evidencia en `.claude/verify-runs/import-osm-parkings.md`.
