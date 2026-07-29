/**
 * Snapshot de seguridad previo a un import OSM. Vuelca el estado completo de
 * `parkings` y `parking_photos` a ficheros JSON con timestamp en `backups/`, y
 * guarda la lista de IDs de parkings existentes como marca de retorno. No es un
 * backup de plataforma: es la red de seguridad barata y quirúrgica que empareja
 * con `rollback.ts` (el import solo INSERTA y deduplica, así que revertir es
 * borrar exactamente las filas nuevas del usuario de sistema).
 *
 *   deno run --allow-net --allow-env --allow-read --allow-write backup.ts
 */

import { getSupabaseAdmin } from "./config.ts";

const OUT_DIR = new URL("./backups/", import.meta.url).pathname;

async function dumpAll(table: string): Promise<unknown[]> {
  const supabase = await getSupabaseAdmin();
  const rows: unknown[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function main(): Promise<void> {
  await Deno.mkdir(OUT_DIR, { recursive: true });
  // Timestamp determinista para nombrar el backup (UTC, sin ':').
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  const parkings = await dumpAll("parkings");
  const photos = await dumpAll("parking_photos");
  const parkingIds = parkings.map((p) => (p as { id: string }).id);

  const write = async (name: string, payload: unknown) => {
    const path = `${OUT_DIR}${name}`;
    await Deno.writeTextFile(path, JSON.stringify(payload, null, 2));
    return path;
  };

  await write(`parkings_${stamp}.json`, parkings);
  await write(`parking_photos_${stamp}.json`, photos);
  const watermarkPath = await write(`watermark_${stamp}.json`, {
    stamp,
    createdAt: stamp,
    parkings: parkings.length,
    photos: photos.length,
    parkingIds,
  });

  // El rollback lee siempre el último watermark: dejamos también un puntero fijo.
  await write(`watermark_latest.json`, {
    stamp,
    parkings: parkings.length,
    photos: photos.length,
    parkingIds,
  });

  console.log(`\n📦 Backup OK`);
  console.log(`   parkings:        ${parkings.length}`);
  console.log(`   parking_photos:  ${photos.length}`);
  console.log(`   watermark:       ${watermarkPath}`);
  console.log(`   (puntero:        ${OUT_DIR}watermark_latest.json)\n`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    Deno.exit(1);
  });
}
