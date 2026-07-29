/**
 * Pure mapping of an OSM element to a `parkings` insert payload. `features` only
 * ever holds booleans (`covered`, `free`) because the client validates it as
 * `z.record(z.boolean())`; traceability (OSM id, photo attribution) lives in
 * `notes` (free text) instead. `status` is intentionally omitted so the DB
 * default ('pending') applies. Location uses the WKT form proven by the
 * propose-parking Edge Function: `POINT(lng lat)`.
 */

import type { OsmParking } from "./osm.ts";
import { OSM_ATTRIBUTION, SYSTEM_USER_ID } from "./constants.ts";

/** Only boolean keys known to the data model — never strings. */
export type ParkingFeatures = {
  covered?: boolean;
  free?: boolean;
};

export type ParkingInsert = {
  name: string;
  type: "public";
  location: string;
  city: string;
  capacity: number | null;
  features: ParkingFeatures;
  notes: string;
  proposed_by: string;
};

export function parseCapacity(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function buildFeatures(osm: OsmParking): ParkingFeatures {
  const features: ParkingFeatures = {};
  if (osm.tags.covered === "yes") features.covered = true;
  if (osm.tags.fee === "no") features.free = true;
  return features;
}

/**
 * Attribution note stored in `parkings.notes`: ODbL credit + the OSM element id
 * for traceability (used to identify/revert the seeding alongside proposed_by).
 */
export function buildNotes(osm: OsmParking): string {
  return `${OSM_ATTRIBUTION} · osm:${osm.osmId}`;
}

export function mapToParking(
  osm: OsmParking,
  opts: { city: string; name: string },
): ParkingInsert {
  return {
    name: opts.name,
    type: "public",
    location: `POINT(${osm.lng} ${osm.lat})`,
    city: opts.city,
    capacity: parseCapacity(osm.tags.capacity),
    features: buildFeatures(osm),
    notes: buildNotes(osm),
    proposed_by: SYSTEM_USER_ID,
  };
}
