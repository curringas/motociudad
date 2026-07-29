/**
 * Overpass API client for `amenity=motorcycle_parking`. The query targets a
 * bounding box (area[name] lookups time out with 504) and reduces ways to their
 * centroid via `out center`. `normalizeOverpass` is pure so it can be unit
 * tested without network access.
 */

import { USER_AGENT } from "./constants.ts";
import type { BBox } from "./cities.ts";

export type OsmTags = Record<string, string>;

export type OsmParking = {
  /** e.g. "node/123" or "way/456" — stable OSM element id. */
  osmId: string;
  lat: number;
  lng: number;
  tags: OsmTags;
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export function buildOverpassQuery(bbox: BBox): string {
  const b = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;
  return `[out:json][timeout:60];
(
  node["amenity"="motorcycle_parking"]${b};
  way["amenity"="motorcycle_parking"]${b};
);
out center tags;`;
}

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
};

export function normalizeOverpass(json: unknown): OsmParking[] {
  const elements = (json as { elements?: unknown[] } | null)?.elements;
  if (!Array.isArray(elements)) return [];

  const out: OsmParking[] = [];
  for (const el of elements as OverpassElement[]) {
    const lat = el.type === "node" ? el.lat : el.center?.lat;
    const lng = el.type === "node" ? el.lon : el.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      osmId: `${el.type}/${el.id}`,
      lat: lat as number,
      lng: lng as number,
      tags: el.tags ?? {},
    });
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetches parkings from Overpass with backoff. Throws if it never succeeds. */
export async function fetchOsmParkings(
  bbox: BBox,
  retries = 3,
): Promise<OsmParking[]> {
  const query = buildOverpassQuery(bbox);
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ data: query }),
      });
      if (res.ok) return normalizeOverpass(await res.json());
      lastError = new Error(`Overpass status ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < retries) await sleep(2000 * attempt);
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Overpass request failed");
}
