/**
 * Zod schemas for post-comment input validation.
 */

import { z } from "npm:zod@3";

const uuidSchema = z.string().uuid({ message: "Debe ser un UUID v4 válido" });

export const postCommentSchema = z.object({
  parking_id: uuidSchema,
  body: z
    .string({ invalid_type_error: "El comentario debe ser texto" })
    .trim()
    .min(1, "El comentario no puede estar vacío")
    .max(500, "El comentario no puede superar los 500 caracteres"),
});

export type PostCommentInput = z.infer<typeof postCommentSchema>;

export function parsePostComment(body: unknown):
  | { success: true; data: PostCommentInput }
  | { success: false; error: string } {
  const result = postCommentSchema.safeParse(body);
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
