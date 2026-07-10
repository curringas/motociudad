/**
 * Schemas Zod para validación de input de validate-verification.
 * Todas las validaciones estructurales se hacen aquí antes de ejecutar lógica de negocio.
 */

import { z } from "npm:zod@3";

/** UUID v4 válido */
const uuidSchema = z
  .string()
  .uuid({ message: "Debe ser un UUID v4 válido" });

/** Latitud WGS84 */
const latSchema = z
  .number({ invalid_type_error: "La latitud debe ser un número" })
  .min(-90, "Latitud mínima: -90")
  .max(90, "Latitud máxima: 90");

/** Longitud WGS84 */
const lngSchema = z
  .number({ invalid_type_error: "La longitud debe ser un número" })
  .min(-180, "Longitud mínima: -180")
  .max(180, "Longitud máxima: 180");

/** Timestamp ISO 8601 */
const isoTimestampSchema = z
  .string()
  .datetime({ message: "photo_taken_at debe ser un timestamp ISO 8601 válido" });

/** Path de storage — no puede estar vacío ni contener secuencias peligrosas */
const storagePathSchema = z
  .string()
  .min(1, "storage_path no puede estar vacío")
  .max(500, "storage_path demasiado largo")
  .regex(
    /^[a-zA-Z0-9\-_/.]+$/,
    "storage_path contiene caracteres no permitidos",
  );

/** Schema principal del request de verificación */
export const verificationRequestSchema = z.object({
  parking_id: uuidSchema,
  user_lat: latSchema,
  user_lng: lngSchema,
  photo_taken_at: isoTimestampSchema,
  storage_path: storagePathSchema,
  thumbnail_path: storagePathSchema.optional(),
  photo_width: z.number().int().positive().optional(),
  photo_height: z.number().int().positive().optional(),
  photo_size_bytes: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024, "El tamaño máximo de foto es 5MB")
    .optional(),
});

export type VerificationRequestInput = z.infer<typeof verificationRequestSchema>;

/**
 * Valida y parsea el body del request.
 * @returns { success: true, data } | { success: false, error }
 */
export function parseVerificationRequest(body: unknown):
  | { success: true; data: VerificationRequestInput }
  | { success: false; error: string } {
  const result = verificationRequestSchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.errors[0];
    return {
      success: false,
      error: firstError
        ? `${firstError.path.join(".")}: ${firstError.message}`
        : "Datos de entrada inválidos",
    };
  }

  return { success: true, data: result.data };
}
