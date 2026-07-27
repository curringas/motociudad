/**
 * Normalisation of Nominatim (OpenStreetMap) search results into the
 * structured city suggestions the client consumes. Pure & side-effect free so
 * it can be unit-tested without network access.
 */

export type CitySuggestion = {
  name: string;
  region: string | null;
  country: string;
  country_code: string; // ISO-2, uppercase
  lat: number;
  lng: number;
  /** Canonical label to display and to store in users.city_primary. */
  label: string;
};

/** Nominatim addresstype/type values we accept as a "city". */
const CITY_LIKE = new Set([
  "city",
  "town",
  "village",
  "municipality",
  "hamlet",
]);

type NominatimItem = {
  lat?: string;
  lon?: string;
  name?: string;
  type?: string;
  addresstype?: string;
  display_name?: string;
  address?: Record<string, string>;
};

/**
 * Filters Nominatim items down to city-like places and maps them to
 * CitySuggestion, de-duplicating by label. Invalid/partial items are dropped.
 */
export function normalizeNominatim(items: unknown): CitySuggestion[] {
  if (!Array.isArray(items)) return [];

  const seen = new Set<string>();
  const out: CitySuggestion[] = [];

  for (const raw of items as NominatimItem[]) {
    const kind = raw.addresstype ?? raw.type ?? "";
    if (!CITY_LIKE.has(kind)) continue;

    const address = raw.address ?? {};
    const name =
      address.city ??
      address.town ??
      address.village ??
      address.municipality ??
      address.hamlet ??
      raw.name ??
      "";
    const country = address.country ?? "";
    if (!name || !country) continue;

    const lat = Number(raw.lat);
    const lng = Number(raw.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const region = address.state ?? address.province ?? address.region ?? null;
    const label = `${name}, ${country}`;
    if (seen.has(label)) continue;
    seen.add(label);

    out.push({
      name,
      region,
      country,
      country_code: (address.country_code ?? "").toUpperCase(),
      lat,
      lng,
      label,
    });
  }

  return out;
}

/** Builds the Nominatim search URL for a query. */
export function buildNominatimUrl(query: string): string {
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    "accept-language": "es",
    q: query,
  });
  return `https://nominatim.openstreetmap.org/search?${params.toString()}`;
}
