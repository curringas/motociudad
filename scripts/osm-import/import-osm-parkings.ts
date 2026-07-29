/**
 * CLI orchestrator for seeding motorcycle parkings from OpenStreetMap.
 *
 *   deno task import --city cordoba            # inserts into the linked project
 *   deno task import --city cordoba --dry-run  # prints candidates, writes nothing
 *
 * Flow per city: query Overpass → for each element, dedupe by proximity (<25 m
 * via the existing nearby_parkings RPC, run as service_role so it sees pending
 * rows too) → resolve name → resolve Commons photo (best-effort) → insert the
 * parking (status defaults to 'pending') → upload the photo. Photos and names
 * never block a parking insert.
 */

import { parseArgs } from "jsr:@std/cli/parse-args";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { citySlugs, findCity } from "./cities.ts";
import { fetchOsmParkings } from "./osm.ts";
import { createReverseGeocoder } from "./nominatim.ts";
import { resolveName } from "./naming.ts";
import { mapToParking } from "./mapping.ts";
import { resolveCommonsPhoto, type ResolvedPhoto, selectCommonsFile } from "./photos.ts";
import {
  DEDUPE_METERS,
  PARKINGS_BUCKET,
  SYSTEM_USER_ID,
} from "./constants.ts";
import { getSupabaseAdmin } from "./config.ts";

async function hasNearbyParking(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("nearby_parkings", {
    in_lat: lat,
    in_lng: lng,
    in_radius_m: DEDUPE_METERS,
    in_only_verified: false,
    in_limit: 1,
  });
  if (error) throw new Error(`nearby_parkings falló: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

async function uploadPhoto(
  supabase: SupabaseClient,
  parkingId: string,
  photo: ResolvedPhoto,
): Promise<boolean> {
  try {
    const path = `${parkingId}/${crypto.randomUUID()}.${photo.ext}`;
    const { error: upErr } = await supabase.storage
      .from(PARKINGS_BUCKET)
      .upload(path, photo.bytes, { contentType: photo.contentType, upsert: false });
    if (upErr) {
      console.error(`     foto: subida falló (${upErr.message})`);
      return false;
    }
    const { error: rowErr } = await supabase.from("parking_photos").insert({
      parking_id: parkingId,
      uploaded_by: SYSTEM_USER_ID,
      storage_path: path,
      is_primary: true,
      is_verification: false,
    });
    if (rowErr) {
      console.error(`     foto: fila falló (${rowErr.message})`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`     foto: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    string: ["city"],
    boolean: ["dry-run"],
  });

  const slug = args.city;
  const available = citySlugs().join(", ");
  if (!slug) {
    console.error(`Falta --city <slug>. Disponibles: ${available}`);
    Deno.exit(1);
  }
  const city = findCity(slug);
  if (!city) {
    console.error(`Ciudad '${slug}' no está en el catálogo. Disponibles: ${available}`);
    Deno.exit(1);
  }
  const dryRun = args["dry-run"] === true;

  console.log(`\n📍 ${city.city}${dryRun ? "  (dry-run)" : ""}`);
  console.log("Consultando Overpass…");
  const osmParkings = await fetchOsmParkings(city.bbox);
  console.log(`OSM devolvió ${osmParkings.length} elementos.\n`);

  const supabase = await getSupabaseAdmin();
  const reverse = createReverseGeocoder();

  let inserted = 0;
  let skipped = 0;
  let photos = 0;

  for (const osm of osmParkings) {
    if (await hasNearbyParking(supabase, osm.lat, osm.lng)) {
      skipped++;
      console.log(`  ⏭  ${osm.osmId} omitido (parking existente a <${DEDUPE_METERS} m)`);
      continue;
    }

    const name = await resolveName(osm, city.city, reverse);
    const commonsFile = selectCommonsFile(osm.tags);
    const photo = commonsFile ? await resolveCommonsPhoto(commonsFile) : null;

    const parking = mapToParking(osm, { city: city.city, name });
    if (photo) {
      // Photo attribution lives in notes (features is boolean-only for the client).
      const author = photo.attribution.author ?? "autor desconocido";
      const license = photo.attribution.license ?? "CC";
      parking.notes += ` · Foto: ${author} — ${license} (Wikimedia Commons)`;
    }

    if (dryRun) {
      inserted++;
      console.log(`  ✓ [dry] ${name}  (${osm.lat}, ${osm.lng})${photo ? "  +foto" : ""}`);
      continue;
    }

    const { data: row, error } = await supabase
      .from("parkings")
      .insert(parking as never)
      .select("id")
      .single();
    if (error || !row) {
      console.error(`  ✗ ${osm.osmId}: ${error?.message ?? "sin datos"}`);
      continue;
    }
    inserted++;
    console.log(`  ✓ ${name} → ${row.id}`);

    if (photo && (await uploadPhoto(supabase, row.id as string, photo))) {
      photos++;
    }
  }

  console.log(
    `\nResumen ${city.city}: ${inserted} ${dryRun ? "candidatos (dry-run)" : "insertados"}, ` +
      `${skipped} omitidos por proximidad, ${photos} fotos.\n`,
  );
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    Deno.exit(1);
  });
}
