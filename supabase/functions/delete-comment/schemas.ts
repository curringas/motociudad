/**
 * Zod schemas for delete-comment input validation.
 */

import { z } from "npm:zod@3";

const uuidSchema = z.string().uuid({ message: "Debe ser un UUID v4 válido" });

export const deleteCommentSchema = z.object({
  comment_id: uuidSchema,
});

export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>;

export function parseDeleteComment(body: unknown):
  | { success: true; data: DeleteCommentInput }
  | { success: false; error: string } {
  const result = deleteCommentSchema.safeParse(body);
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
