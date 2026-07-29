/**
 * Deshace un import OSM devolviendo `parkings` al estado del último backup.
 * Borra SOLO los parkings del usuario de sistema @motociudad que NO existían en
 * el snapshot (`backups/watermark_latest.json`), así que es imposible tocar datos
 * reales de usuarios o el seed previo. Las fotos caen en cascada
 * (`parking_photos.parking_id ON DELETE CASCADE`).
 *
 *   deno run --allow-net --allow-env --allow-read rollback.ts            # DRY-RUN: solo lista
 *   deno run --allow-net --allow-env --allow-read rollback.ts --apply    # borra de verdad
 *
 * Nota: el DELETE borra las filas de `parking_photos`, pero los objetos de la
 * foto quedan huérfanos en el bucket de Storage (inofensivos, nadie los
 * referencia). Se limpian aparte si se quiere.
 */

import { getSupabaseAdmin } from "./config.ts";
import { SYSTEM_USER_ID } from "./constants.ts";

const WATERMARK = new URL("./backups/watermark_latest.json", import.meta.url).pathname;

type Watermark = { stamp: string; parkingIds: string[] };

async function main(): Promise<void> {
  const apply = Deno.args.includes("--apply");

  let wm: Watermark;
  try {
    wm = JSON.parse(await Deno.readTextFile(WATERMARK));
  } catch {
    console.error(
      `No encuentro ${WATERMARK}. Ejecuta backup.ts antes de importar.`,
    );
    Deno.exit(1);
  }
  const preExisting = new Set(wm.parkingIds);
  console.log(`\nSnapshot de referencia: ${wm.stamp} (${preExisting.size} parkings previos)`);

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("parkings")
    .select("id, name, city, created_at, notes")
    .eq("proposed_by", SYSTEM_USER_ID)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`consulta parkings: ${error.message}`);

  const toDelete = (data ?? []).filter(
    (p) => !preExisting.has((p as { id: string }).id),
  );

  if (toDelete.length === 0) {
    console.log("\nNada que revertir: no hay parkings de sistema posteriores al backup.\n");
    return;
  }

  console.log(`\nFilas a borrar (${toDelete.length}):`);
  for (const p of toDelete) {
    const r = p as { name: string; city: string; created_at: string };
    console.log(`  - ${r.city} · ${r.name} · ${r.created_at}`);
  }

  if (!apply) {
    console.log(`\n(dry-run) Nada borrado. Repite con --apply para ejecutar.\n`);
    return;
  }

  const ids = toDelete.map((p) => (p as { id: string }).id);
  const { error: delErr, count } = await supabase
    .from("parkings")
    .delete({ count: "exact" })
    .in("id", ids);
  if (delErr) throw new Error(`delete: ${delErr.message}`);

  console.log(`\n🗑  Borrados ${count ?? ids.length} parkings (sus fotos en cascada).`);
  console.log(`   Recuerda: pueden quedar objetos de foto huérfanos en Storage.\n`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    Deno.exit(1);
  });
}
