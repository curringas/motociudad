/**
 * Pure mapping of an OSM element to a `parkings` insert payload. Only writes
 * feature keys known to the data model (`covered`, `free`) plus traceability
 * keys (`source`, `osm_id`). `status` is intentionally omitted so the DB
 * default ('pending') applies. Location uses the WKT form proven by the
 * propose-parking Edge Function: `POINT(lng lat)`.
 */

import type { OsmParking } from "./osm.ts";
import { OSM_ATTRIBUTION, SYSTEM_USER_ID } from "./constants.ts";

export type ParkingFeatures = {
  covered?: boolean;
  free?: boolean;
  source: "osm";
  osm_id: string;
  source_photo?: {
    commons: string;
    author: string | null;
    license: string | null;
  };
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
  const features: ParkingFeatures = { source: "osm", osm_id: osm.osmId };
  if (osm.tags.covered === "yes") features.covered = true;
  if (osm.tags.fee === "no") features.free = true;
  return features;
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
    notes: OSM_ATTRIBUTION,
    proposed_by: SYSTEM_USER_ID,
  };
}
