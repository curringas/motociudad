import type { CommentRow } from './schemas';

/** View model consumed by the comment components (pure, easily testable). */
export type CommentView = {
  id: string;
  authorId: string;
  authorName: string;
  authorLevel: number | null;
  body: string;
  upvotes: number;
  timeLabel: string;
  canDelete: boolean;
};

/**
 * Formats an ISO timestamp as a short Spanish relative label ("hace 5 min").
 * Pure — `now` is injectable for deterministic tests.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.floor((now.getTime() - then) / 1000));

  if (diffSec < 60) return 'hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour} h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `hace ${diffDay} d`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `hace ${diffMonth} mes${diffMonth > 1 ? 'es' : ''}`;
  const diffYear = Math.floor(diffMonth / 12);
  return `hace ${diffYear} año${diffYear > 1 ? 's' : ''}`;
}

/** Best-effort display name from the joined author fields. */
export function authorDisplayName(row: CommentRow): string {
  return (
    row.author?.display_name?.trim() ||
    row.author?.username?.trim() ||
    'Motero anónimo'
  );
}

/** Maps a raw comment row to its view model for the current viewer. */
export function toCommentView(
  row: CommentRow,
  currentUserId: string | undefined,
  now: Date = new Date(),
): CommentView {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: authorDisplayName(row),
    authorLevel: row.author?.current_level ?? null,
    body: row.body,
    upvotes: row.upvotes_count,
    timeLabel: formatRelativeTime(row.created_at, now),
    canDelete: !!currentUserId && currentUserId === row.author_id,
  };
}
