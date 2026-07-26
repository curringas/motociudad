import { z } from "npm:zod@3";

export const deleteCommentsRequestSchema = z.object({
  commentIds: z
    .array(z.string().uuid("cada id debe ser un UUID válido"))
    .min(1, "Debe indicar al menos un comentario")
    .max(200, "Máximo 200 comentarios por operación"),
});

export type DeleteCommentsRequest = z.infer<typeof deleteCommentsRequestSchema>;

export function parseDeleteCommentsRequest(
  body: unknown,
): { success: true; data: DeleteCommentsRequest } | { success: false; error: string } {
  const result = deleteCommentsRequestSchema.safeParse(body);
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
