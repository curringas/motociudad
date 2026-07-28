/**
 * Reverse geocoding via Nominatim (OSM) to name street parkings that lack an
 * OSM `name` tag. `buildReverseUrl` and `extractStreet` are pure and unit
 * tested; `createReverseGeocoder` wraps them with the mandatory 1 req/s rate
 * limit and identifying User-Agent required by the Nominatim usage policy.
 *
 * Mirrors the conventions of supabase/functions/city-search/nominatim.ts
 * (jsonv2, accept-language=es, own User-Agent).
 */

import { USER_AGENT } from "./constants.ts";

export type ReverseGeocoder = (lat: number, lng: number) => Promise<string | null>;

export function buildReverseUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    format: "jsonv2",
    "accept-language": "es",
    zoom: "18",
    addressdetails: "1",
    lat: String(lat),
    lon: String(lng),
  });
  return `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
}

export function extractStreet(json: unknown): string | null {
  const address = (json as { address?: Record<string, string> } | null)?.address;
  if (!address) return null;
  return (
    address.road ??
    address.pedestrian ??
    address.footway ??
    address.square ??
    address.neighbourhood ??
    address.suburb ??
    null
  );
}

/** Live, rate-limited (1 req/s) reverse geocoder. Returns null on any failure. */
export function createReverseGeocoder(): ReverseGeocoder {
  let lastCall = 0;
  return async (lat, lng) => {
    const wait = 1000 - (Date.now() - lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    try {
      const res = await fetch(buildReverseUrl(lat, lng), {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
      if (!res.ok) return null;
      return extractStreet(await res.json());
    } catch {
      return null;
    }
  };
}
