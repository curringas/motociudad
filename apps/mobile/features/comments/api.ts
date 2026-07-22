import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  commentRowSchema,
  type CommentRow,
  type PostCommentResult,
  type VoteCommentResult,
} from './schemas';

/** Known error codes returned by the comment Edge Functions. */
export const COMMENT_ERROR_CODES = {
  EMAIL_NOT_CONFIRMED: 'EMAIL_NOT_CONFIRMED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PARKING_NOT_FOUND: 'PARKING_NOT_FOUND',
  PARKING_ARCHIVED: 'PARKING_ARCHIVED',
  COMMENT_NOT_FOUND: 'COMMENT_NOT_FOUND',
  SELF_VOTE_FORBIDDEN: 'SELF_VOTE_FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;

/**
 * Fetches the non-deleted comments of a parking, newest first, with the author
 * profile joined for display. Read is public (RLS allows it).
 */
export async function fetchParkingComments(
  parkingId: string,
): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(
      'id, parking_id, author_id, body, upvotes_count, created_at, ' +
        'author:author_id(display_name, username, avatar_url, current_level)',
    )
    .eq('parking_id', parkingId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Supabase types the FK join loosely; validate/normalize with Zod.
  return (data ?? []).map((row) => commentRowSchema.parse(row));
}

/**
 * Recovers a structured `{ success:false, error }` body from a non-2xx
 * Edge Function response (mirrors the verifications flow).
 */
async function readFunctionError<T extends { success: boolean }>(
  error: unknown,
): Promise<T | null> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as T;
      if (body && typeof body === 'object' && 'success' in body) return body;
    } catch {
      // fall through
    }
  }
  return null;
}

/** Publishes a comment via the post-comment Edge Function. */
export async function postComment(
  parkingId: string,
  body: string,
): Promise<PostCommentResult> {
  const { data, error } = await supabase.functions.invoke<PostCommentResult>(
    'post-comment',
    { body: { parking_id: parkingId, body } },
  );
  if (error) {
    const recovered = await readFunctionError<PostCommentResult>(error);
    if (recovered) return recovered;
    throw new Error(error.message);
  }
  return data as PostCommentResult;
}

/** Casts a vote (+1 / -1) via the vote-comment Edge Function. */
export async function voteComment(
  commentId: string,
  value: 1 | -1,
): Promise<VoteCommentResult> {
  const { data, error } = await supabase.functions.invoke<VoteCommentResult>(
    'vote-comment',
    { body: { comment_id: commentId, value } },
  );
  if (error) {
    const recovered = await readFunctionError<VoteCommentResult>(error);
    if (recovered) return recovered;
    throw new Error(error.message);
  }
  return data as VoteCommentResult;
}

/** Soft-deletes the caller's own comment via the delete-comment Edge Function. */
export async function deleteComment(
  commentId: string,
): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  const { data, error } = await supabase.functions.invoke('delete-comment', {
    body: { comment_id: commentId },
  });
  if (error) {
    const recovered = await readFunctionError<{ success: boolean }>(error);
    if (recovered) return recovered;
    throw new Error(error.message);
  }
  return data as { success: boolean };
}
