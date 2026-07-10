/**
 * Tipos TypeScript para la Edge Function validate-verification.
 * Fuente de verdad: modelo-datos.md, gamificacion.md §2.2
 */

/** Coordenadas geográficas WGS84 */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Payload de entrada de la Edge Function */
export interface VerificationRequest {
  parking_id: string;       // UUID del parking a verificar
  user_lat: number;         // Latitud actual del usuario
  user_lng: number;         // Longitud actual del usuario
  photo_taken_at: string;   // ISO 8601 timestamp de cuando se tomó la foto
  storage_path: string;     // Path en Supabase Storage donde se subió la foto
  thumbnail_path?: string;  // Path opcional del thumbnail
  photo_width?: number;
  photo_height?: number;
  photo_size_bytes?: number;
}

/** Datos del parking recuperados de la DB */
export interface ParkingData {
  id: string;
  proposed_by: string;
  status: "pending" | "verified" | "rejected" | "archived";
  location_lat: number;
  location_lng: number;
}

/** Resultado de la validación de geofence */
export interface GeofenceResult {
  valid: boolean;
  distance_meters: number;
}

/** Resultado exitoso de la verificación */
export interface VerificationSuccess {
  octanos_earned: number;
  is_first_verifier: boolean;
  new_status: "pending" | "verified";
  verification_id: string;
  photo_id: string;
}

/** Respuesta canónica de la Edge Function */
export interface VerificationResult {
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
  data?: VerificationSuccess;
}

/** Puntos de Octanos por acción (gamificacion.md §2.1) */
export const OCTANO_POINTS = {
  VERIFY_PARKING: 25,
  FIRST_VERIFIER: 15,
} as const;

/** Reglas anti-abuso (gamificacion.md §2.2) */
export const ANTI_ABUSE_RULES = {
  GEOFENCE_RADIUS_METERS: 100,      // máximo 100m del parking
  PHOTO_MAX_AGE_MINUTES: 5,         // foto tomada hace máximo 5 minutos
  DAILY_CAP_OCTANOS: 200,           // máximo 200 Octanos/día
} as const;
