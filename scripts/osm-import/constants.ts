/**
 * Shared constants for the OSM parking seeding tool. Kept free of heavy imports
 * (no Supabase client, no dotenv) so the pure mapping/naming/photo modules — and
 * their unit tests — can import them without pulling in network dependencies.
 */

/**
 * System user @motociudad. Author (`proposed_by`) of every OSM-seeded parking
 * and uploader of their photos. MUST match the UUID created by the migration
 * `20260729000001_system_user_motociudad.sql`.
 */
export const SYSTEM_USER_ID = "d1000000-0000-0000-0000-000000000001";

/** Identifying User-Agent required by Nominatim/Overpass/Wikimedia policies. */
export const USER_AGENT = "MotoCiudad/1.0 (https://motociudad.com)";

/** Storage bucket that holds parking photos. */
export const PARKINGS_BUCKET = "parkings-photos";

/** A candidate is dropped if an existing parking sits within this radius (m). */
export const DEDUPE_METERS = 25;

/** ODbL attribution stored in `parkings.notes` for traceability. */
export const OSM_ATTRIBUTION =
  "Importado de OpenStreetMap (© OpenStreetMap contributors, ODbL).";
