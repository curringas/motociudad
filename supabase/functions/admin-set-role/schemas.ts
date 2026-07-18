import { z } from "npm:zod@3";

export const setRoleRequestSchema = z
  .object({
    userId: z.string().uuid("userId debe ser un UUID válido"),
    role: z.enum(["user", "contributor", "admin"]).optional(),
    suspended: z.boolean().optional(),
    suspendedReason: z.string().max(500).optional(),
  })
  .refine((d) => d.role !== undefined || d.suspended !== undefined, {
    message: "Debe indicar 'role' y/o 'suspended'",
  });

export type SetRoleRequest = z.infer<typeof setRoleRequestSchema>;

export function parseSetRoleRequest(
  body: unknown,
): { success: true; data: SetRoleRequest } | { success: false; error: string } {
  const result = setRoleRequestSchema.safeParse(body);
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
