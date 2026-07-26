import { z } from "npm:zod@3";

export const moderateCommentRequestSchema = z.object({
  commentId: z.string().uuid("commentId debe ser un UUID válido"),
  action: z.enum(["approve", "reject"], {
    errorMap: () => ({ message: "action debe ser 'approve' o 'reject'" }),
  }),
});

export type ModerateCommentRequest = z.infer<typeof moderateCommentRequestSchema>;

/** Maps the client action to the target moderation_status. */
export const STATUS_FOR_ACTION: Record<
  ModerateCommentRequest["action"],
  "approved" | "rejected"
> = { approve: "approved", reject: "rejected" };

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
