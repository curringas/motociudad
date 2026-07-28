/**
 * Parking name resolution. Uses the OSM `name` tag when present; otherwise
 * reverse-geocodes the street ("Parking moto · {calle}"); if that also fails,
 * falls back to the city ("Parking moto · {ciudad}"). `name` is NOT NULL in the
 * schema, so a non-empty string is always returned. The reverse geocoder is
 * injected so this stays unit-testable without network access.
 */

import type { OsmParking } from "./osm.ts";
import type { ReverseGeocoder } from "./nominatim.ts";

/** parkings.name is VARCHAR(120). */
const NAME_MAX = 120;

export async function resolveName(
  osm: OsmParking,
  city: string,
  reverse: ReverseGeocoder,
): Promise<string> {
  const osmName = osm.tags.name?.trim();
  if (osmName) return osmName.slice(0, NAME_MAX);

  const street = await reverse(osm.lat, osm.lng);
  if (street) return `Parking moto · ${street}`.slice(0, NAME_MAX);

  return `Parking moto · ${city}`.slice(0, NAME_MAX);
}
