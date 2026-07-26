import { z } from "npm:zod@3";

const uuid = z.string().uuid("cada id debe ser un UUID válido");

export const moderateCommentRequestSchema = z
  .object({
    // Uno (commentId) o varios (commentIds); al menos uno.
    commentId: uuid.optional(),
    commentIds: z.array(uuid).max(200, "Máximo 200 comentarios por operación").optional(),
    action: z.enum(["approve", "reject"], {
      errorMap: () => ({ message: "action debe ser 'approve' o 'reject'" }),
    }),
  })
  .refine((d) => !!d.commentId || (d.commentIds && d.commentIds.length > 0), {
    message: "Debe indicar commentId o commentIds",
  });

export type ModerateCommentRequest = z.infer<typeof moderateCommentRequestSchema>;

/** Maps the client action to the target moderation_status. */
export const STATUS_FOR_ACTION: Record<
  ModerateCommentRequest["action"],
  "approved" | "rejected"
> = { approve: "approved", reject: "rejected" };

/** Normaliza la entrada a la lista de ids a moderar. */
export function idsOf(input: ModerateCommentRequest): string[] {
  return input.commentIds && input.commentIds.length > 0
    ? input.commentIds
    : input.commentId
    ? [input.commentId]
    : [];
}

export function parseModerateCommentRequest(
  body: unknown,
): { success: true; data: ModerateCommentRequest } | { success: false; error: string } {
  const result = moderateCommentRequestSchema.safeParse(body);
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
