import { z } from "npm:zod@3";

const latSchema = z
  .number({ invalid_type_error: "La latitud debe ser un número" })
  .min(-90, "Latitud mínima: -90")
  .max(90, "Latitud máxima: 90");

const lngSchema = z
  .number({ invalid_type_error: "La longitud debe ser un número" })
  .min(-180, "Longitud mínima: -180")
  .max(180, "Longitud máxima: 180");

const storagePathSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[a-zA-Z0-9\-_/.]+$/, "storage_path contiene caracteres no permitidos");

export const proposeParkingRequestSchema = z.object({
  name: z
    .string()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(120, "El nombre no puede superar los 120 caracteres"),
  type: z.enum(["public", "private"]),
  latitude: latSchema,
  longitude: lngSchema,
  city: z.string().min(1, "La ciudad es obligatoria").max(80),
  capacity: z.number().int().positive().nullable().optional(),
  features: z
    .object({
      covered: z.boolean().optional(),
      cameras: z.boolean().optional(),
      anchors: z.boolean().optional(),
      lit: z.boolean().optional(),
      free: z.boolean().optional(),
      h24: z.boolean().optional(),
      battery_layout: z.boolean().optional(),
    })
    .optional(),
  notes: z.string().max(500).optional(),
  photo_storage_path: storagePathSchema.optional(),
});

export type ProposeParkingRequest = z.infer<typeof proposeParkingRequestSchema>;

export function parseProposeParkingRequest(
  body: unknown,
): { success: true; data: ProposeParkingRequest } | { success: false; error: string } {
  const result = proposeParkingRequestSchema.safeParse(body);
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
