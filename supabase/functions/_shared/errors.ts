/**
 * Códigos de error canónicos para Edge Functions de MotoCiudad.
 * Deben coincidir con los manejados en el cliente (features/{domain}/api.ts).
 */

export type ErrorCode =
  // Errores de autenticación
  | "UNAUTHORIZED"
  | "INVALID_TOKEN"
  // Errores de validación de input
  | "VALIDATION_ERROR"
  | "MISSING_FIELDS"
  // Errores de negocio — verificación (validate-verification)
  | "GEOFENCE_FAIL"        // usuario > 100m del parking
  | "STALE_PHOTO"          // foto tomada hace > 5 minutos
  | "SELF_VERIFICATION_FORBIDDEN"  // usuario intentando verificar su propio parking
  | "ALREADY_VERIFIED"     // usuario ya verificó este parking
  | "DAILY_CAP_REACHED"    // límite de 200 octanos/día alcanzado
  | "VERIFICATION_LIMIT_REACHED"  // el parking ya tiene el máximo de 3 verificaciones
  | "PARKING_NOT_FOUND"    // parking no existe o fue borrado
  | "PARKING_ARCHIVED"     // parking archivado, no se pueden hacer más verificaciones
  // Errores internos
  | "INTERNAL_ERROR"
  | "DATABASE_ERROR";

export interface AppError {
  code: ErrorCode;
  message: string;
  /** Detalles técnicos — solo para logging interno, nunca al cliente */
  detail?: string;
}

/**
 * Crea un objeto AppError normalizado.
 */
export function makeError(
  code: ErrorCode,
  message: string,
  detail?: string,
): AppError {
  return { code, message, detail };
}

/**
 * Respuesta HTTP de error normalizada.
 * El campo `detail` se omite de la respuesta al cliente.
 */
export function errorResponse(
  error: AppError,
  status: number = 400,
): Response {
  // Log estructurado — detail es interno, nunca se envía al cliente
  if (error.detail) {
    console.error(
      JSON.stringify({
        code: error.code,
        detail: error.detail,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

/** Errores predefinidos de uso frecuente */
export const ERRORS = {
  UNAUTHORIZED: makeError(
    "UNAUTHORIZED",
    "Autenticación requerida",
  ),
  GEOFENCE_FAIL: makeError(
    "GEOFENCE_FAIL",
    "Debes estar a menos de 100 metros del parking para verificarlo",
  ),
  STALE_PHOTO: makeError(
    "STALE_PHOTO",
    "La foto debe tomarse en los últimos 5 minutos",
  ),
  SELF_VERIFICATION_FORBIDDEN: makeError(
    "SELF_VERIFICATION_FORBIDDEN",
    "No puedes verificar un parking que tú mismo propusiste",
  ),
  ALREADY_VERIFIED: makeError(
    "ALREADY_VERIFIED",
    "Ya has verificado este parking anteriormente",
  ),
  DAILY_CAP_REACHED: makeError(
    "DAILY_CAP_REACHED",
    "Has alcanzado el límite diario de Octanos (200 puntos). Vuelve mañana.",
  ),
  VERIFICATION_LIMIT_REACHED: makeError(
    "VERIFICATION_LIMIT_REACHED",
    "Este parking ya tiene el máximo de 3 verificaciones.",
  ),
  PARKING_NOT_FOUND: makeError(
    "PARKING_NOT_FOUND",
    "Parking no encontrado",
  ),
  INTERNAL_ERROR: makeError(
    "INTERNAL_ERROR",
    "Error interno del servidor. Por favor, inténtalo de nuevo.",
  ),
} as const;
