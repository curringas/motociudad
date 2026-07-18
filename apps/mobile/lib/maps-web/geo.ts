// Conversion helpers between react-native-maps Region deltas and slippy-map zoom.
// At zoom Z the world (360°) spans tileSize * 2^Z px. Leaflet uses 256px raster
// tiles; vector engines often use 512px — hence the configurable tileSize.
export const MAPLIBRE_TILE_SIZE = 512;
export const LEAFLET_TILE_SIZE = 256;

/**
 * Compute the zoom level that shows `longitudeDelta` degrees across a viewport
 * `viewportWidthPx` pixels wide, for a given `tileSize`. Clamped to [1, 20].
 */
export function zoomFromLongitudeDelta(
  longitudeDelta: number,
  viewportWidthPx: number,
  tileSize: number = MAPLIBRE_TILE_SIZE,
): number {
  const safeDelta = Math.max(longitudeDelta, 1e-9);
  const safeWidth = Math.max(viewportWidthPx, 1);
  const zoom = Math.log2((360 * safeWidth) / (tileSize * safeDelta));
  return Math.min(Math.max(zoom, 1), 20);
}
