// Web replacement for lib/deeplinks.ts. On web there is no native maps app to
// deep-link into, so "Cómo llegar" opens Google Maps directions (from the user's
// current location to the destination) in a new browser tab. Same public API as
// the native module; Metro resolves this file only on web.

/**
 * Opens Google Maps directions to the given coordinates in a new tab.
 * `api=1&destination=lat,lng` makes Google Maps start turn-by-turn directions
 * from the user's current location automatically.
 */
export async function openInExternalMaps(
  lat: number | null,
  lng: number | null,
  _name: string | null,
): Promise<void> {
  if (lat == null || lng == null) {
    if (typeof window !== 'undefined') {
      window.alert('Este parking no tiene coordenadas guardadas.');
    }
    return;
  }
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
