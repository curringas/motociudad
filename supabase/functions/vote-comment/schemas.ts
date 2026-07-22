/**
 * Zod schemas for vote-comment input validation.
 */

import { z } from "npm:zod@3";

const uuidSchema = z.string().uuid({ message: "Debe ser un UUID v4 válido" });

export const voteCommentSchema = z.object({
  comment_id: uuidSchema,
  value: z
    .number({ invalid_type_error: "value debe ser -1 o 1" })
    .int()
    .refine((v) => v === 1 || v === -1, "value debe ser -1 o 1"),
});

export type VoteCommentInput = z.infer<typeof voteCommentSchema>;

export function parseVoteComment(body: unknown):
  | { success: true; data: VoteCommentInput }
  | { success: false; error: string } {
  const result = voteCommentSchema.safeParse(body);
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
