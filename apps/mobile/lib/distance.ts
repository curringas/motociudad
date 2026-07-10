/**
 * Formats a distance in metres to a human-readable Spanish string.
 *
 * Examples:
 *   formatDistance(250)   → "250 m"
 *   formatDistance(1200)  → "1.2 km"
 *   formatDistance(10500) → "10.5 km"
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  // Show one decimal place, strip trailing zeros
  const formatted = km.toFixed(1).replace(/\.0$/, '');
  return `${formatted} km`;
}
