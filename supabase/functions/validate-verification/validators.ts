/**
 * Funciones puras de validación para validate-verification.
 * Las funciones puras no dependen de la DB — son testables sin mocks.
 * Las funciones que requieren DB reciben el cliente como parámetro.
 *
 * Reglas anti-abuso: gamificacion.md §2.2
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { ANTI_ABUSE_RULES, GeofenceResult, ParkingData } from "./types.ts";

// ============================================================
// FUNCIONES PURAS (testables sin DB)
// ============================================================

/**
 * Calcula la distancia entre dos puntos geográficos usando la fórmula de Haversine.
 * Retorna la distancia en metros.
 *
 * @pure - No tiene efectos secundarios
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Radio de la Tierra en metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Regla 1: GEOFENCE_FAIL
 * Valida que el usuario esté dentro del radio permitido del parking.
 *
 * @pure
 */
export function validateGeofence(
  userLat: number,
  userLng: number,
  parkingLat: number,
  parkingLng: number,
): GeofenceResult {
  const distance_meters = haversineDistance(
    userLat,
    userLng,
    parkingLat,
    parkingLng,
  );

  return {
    valid: distance_meters <= ANTI_ABUSE_RULES.GEOFENCE_RADIUS_METERS,
    distance_meters,
  };
}

/**
 * Regla 2: STALE_PHOTO
 * Valida que la foto se tomó en los últimos N minutos.
 *
 * @pure - nowOverride permite tests deterministas
 */
export function validatePhotoFreshness(
  photoTakenAt: string,
  nowOverride?: Date,
): boolean {
  const photoTime = new Date(photoTakenAt).getTime();
  const now = (nowOverride ?? new Date()).getTime();

  if (isNaN(photoTime)) return false;

  const ageMs = now - photoTime;
  const maxAgeMs = ANTI_ABUSE_RULES.PHOTO_MAX_AGE_MINUTES * 60 * 1000;

  // También rechazar fotos del futuro (más de 30s de diferencia por drift de reloj)
  if (ageMs < -30_000) return false;

  return ageMs <= maxAgeMs;
}

/**
 * Regla 3: SELF_VERIFICATION_FORBIDDEN
 * Comprueba que el verificador no sea el proponente del parking.
 *
 * @pure
 */
export function validateNotSelfVerification(
  userId: string,
  parking: ParkingData,
): boolean {
  return userId !== parking.proposed_by;
}

// ============================================================
// FUNCIONES QUE REQUIEREN DB
// ============================================================

/**
 * Regla 4: ALREADY_VERIFIED
 * Comprueba que el usuario no haya verificado ya este parking.
 */
export async function validateNotAlreadyVerified(
  supabase: SupabaseClient,
  parkingId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("parking_verifications")
    .select("id")
    .eq("parking_id", parkingId)
    .eq("verified_by", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error checking existing verification: ${error.message}`,
    );
  }

  return data === null; // true = no existe verificación previa (OK)
}

/**
 * Regla 5: DAILY_CAP_REACHED
 * Comprueba que el usuario no haya alcanzado el límite de Octanos diarios.
 * El cap es de 200 Octanos/día (gamificacion.md §2.2 regla 1).
 */
export async function validateDailyCap(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  const { data, error } = await supabase
    .from("octano_events")
    .select("points")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("created_at", yesterday.toISOString());

  if (error) {
    throw new Error(`Error checking daily cap: ${error.message}`);
  }

  const totalToday = (data ?? []).reduce(
    (sum: number, row: { points: number }) => sum + (row.points ?? 0),
    0,
  );

  return totalToday < ANTI_ABUSE_RULES.DAILY_CAP_OCTANOS;
}

/**
 * Comprueba si este será el primer verificador del parking.
 */
export async function isFirstVerifier(
  supabase: SupabaseClient,
  parkingId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("parking_verifications")
    .select("id", { count: "exact", head: true })
    .eq("parking_id", parkingId);

  if (error) {
    throw new Error(`Error checking first verifier: ${error.message}`);
  }

  return (count ?? 0) === 0;
}
