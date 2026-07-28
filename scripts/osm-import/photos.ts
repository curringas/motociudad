/**
 * Photo import — Wikimedia Commons only. The generic OSM `image` tag points to
 * externally-hosted photos of unknown licence, so it is ignored (copyright risk
 * for a published app). Commons files carry an explicit free licence (CC), which
 * we resolve (URL + author + licence) via the Commons API and attach as
 * attribution. Everything here is best-effort: any failure returns null and the
 * caller inserts the parking without a photo. `selectCommonsFile` is pure and
 * unit tested.
 */

import { USER_AGENT } from "./constants.ts";
import type { OsmTags } from "./osm.ts";

export type PhotoAttribution = { author: string | null; license: string | null };

export type ResolvedPhoto = {
  bytes: Uint8Array;
  contentType: string;
  ext: "jpg" | "png" | "webp";
  attribution: PhotoAttribution;
};

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Returns the Commons file title (`File:...`) if the element has a
 * `wikimedia_commons` tag; ignores the generic `image` tag. Pure.
 */
export function selectCommonsFile(tags: OsmTags): string | null {
  const wc = tags.wikimedia_commons?.trim();
  if (!wc) return null;
  return wc.startsWith("File:") ? wc : `File:${wc}`;
}

function stripHtml(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/<[^>]*>/g, "").trim();
  return text.length > 0 ? text : null;
}

function extFor(mime: string): ResolvedPhoto["ext"] | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

/** Resolves and downloads a Commons photo. Returns null on any failure. */
export async function resolveCommonsPhoto(
  fileTitle: string,
): Promise<ResolvedPhoto | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      prop: "imageinfo",
      iiprop: "url|mime|extmetadata",
      titles: fileTitle,
    });
    const metaRes = await fetch(`${COMMONS_API}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!metaRes.ok) return null;

    const meta = await metaRes.json();
    const pages = meta?.query?.pages ?? {};
    const page = Object.values(pages)[0] as
      | { imageinfo?: Array<{ url?: string; mime?: string; extmetadata?: Record<string, { value?: string }> }> }
      | undefined;
    const info = page?.imageinfo?.[0];
    if (!info?.url || !info.mime) return null;

    const ext = extFor(info.mime);
    if (!ext) return null;

    const meta2 = info.extmetadata ?? {};
    const attribution: PhotoAttribution = {
      author: stripHtml(meta2.Artist?.value),
      license: stripHtml(meta2.LicenseShortName?.value),
    };

    const imgRes = await fetch(info.url, { headers: { "User-Agent": USER_AGENT } });
    if (!imgRes.ok) return null;
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;

    return { bytes, contentType: info.mime, ext, attribution };
  } catch {
    return null;
  }
}
