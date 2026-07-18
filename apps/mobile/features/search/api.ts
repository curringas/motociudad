import * as Location from 'expo-location';
import type { GeocodeResult } from './schemas';

export type { GeocodeResult };

/**
 * Forward-geocodes a free-text address (street, city, etc.) using the OS
 * native geocoder via expo-location. Returns the top match, or null when the
 * query is empty or the geocoder finds nothing. Rejects if the geocoder fails.
 */
export async function geocodeAddress(
  query: string,
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;

  const results = await Location.geocodeAsync(trimmed);
  const first = results[0];
  if (!first) return null;

  return { latitude: first.latitude, longitude: first.longitude };
}
