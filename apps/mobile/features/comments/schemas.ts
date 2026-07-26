import { z } from 'zod';

/** Author fields joined from `users` for display. */
export const commentAuthorSchema = z.object({
  display_name: z.string().nullable(),
  username: z.string().nullable(),
  avatar_url: z.string().nullable(),
  current_level: z.number().int().nullable(),
});

/** Moderation state of a comment (mirrors the DB enum). */
export const moderationStatusSchema = z
  .enum(['approved', 'pending_review', 'rejected'])
  .default('approved');
export type ModerationStatus = z.infer<typeof moderationStatusSchema>;

/** A comment row as returned by the list query (with author join). */
export const commentRowSchema = z.object({
  id: z.string().uuid(),
  parking_id: z.string().uuid(),
  author_id: z.string().uuid(),
  body: z.string(),
  upvotes_count: z.number().int().nonnegative(),
  created_at: z.string(),
  moderation_status: moderationStatusSchema,
  author: commentAuthorSchema.nullable(),
});

export type CommentRow = z.infer<typeof commentRowSchema>;
export type CommentAuthor = z.infer<typeof commentAuthorSchema>;

/** Client-side validation of the compose input (mirrors the Edge Function). */
export const commentBodySchema = z
  .string()
  .trim()
  .min(1, 'El comentario no puede estar vacío')
  .max(500, 'El comentario no puede superar los 500 caracteres');

/** Shape returned by the post-comment Edge Function. */
export type PostCommentResult = {
  success: boolean;
  error?: { code: string; message: string };
  data?: {
    comment_id: string;
    moderation_status: ModerationStatus;
    octanos_earned: number;
    action_type: 'first_comment' | 'second_comment' | null;
    eligible: boolean;
    cap_reached: boolean;
    /** Legible notice when the comment is left pending review (flag/fail-safe). */
    review_notice: string | null;
  };
};

/** Shape returned by the vote-comment Edge Function. */
export type VoteCommentResult = {
  success: boolean;
  error?: { code: string; message: string };
  data?: {
    upvotes_count: number;
    net_score: number;
    octanos_earned: number;
  };
};
