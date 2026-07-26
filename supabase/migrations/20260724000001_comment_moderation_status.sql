-- Migration: 20260724000001_comment_moderation_status
-- Adds AI-moderation state to comments and enforces per-status visibility via RLS.
-- OpenSpec: changes/ai-comment-moderation · spec comment-moderation (D2, D7)
--
-- moderation_status:
--   approved       -> public, counts toward listing and comment ladder
--   pending_review -> hidden from the public; visible to the author and admins
--   rejected       -> hidden from everyone except admins (managed in a later feature)
--
-- Existing rows are backfilled to 'approved' (NOT NULL DEFAULT); the historical
-- comments stay visible (Non-goal: no retroactive moderation).

-- ── Enum ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comment_moderation_status') THEN
    CREATE TYPE comment_moderation_status AS ENUM ('approved', 'pending_review', 'rejected');
  END IF;
END $$;

-- ── Column ──────────────────────────────────────────────────
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS moderation_status comment_moderation_status
  NOT NULL DEFAULT 'approved';

COMMENT ON COLUMN public.comments.moderation_status IS
  'Estado de moderación IA: approved (público) | pending_review (oculto, visible a autor/admin) | rejected (solo admin). OpenSpec ai-comment-moderation.';

-- ── Partial index for the public listing (approved, not deleted) ──
CREATE INDEX IF NOT EXISTS idx_comments_parking_approved
  ON public.comments (parking_id)
  WHERE moderation_status = 'approved' AND deleted_at IS NULL;

-- ============================================================
-- RLS: per-status visibility (D7)
--   public (anon + authenticated): only approved & not deleted
--   author: additionally their own pending_review
--   admin: all non-deleted rows (needed for the moderation queue)
-- Writes stay exclusively through Edge Functions with service_role.
-- ============================================================
DROP POLICY IF EXISTS comments_read ON public.comments;
DROP POLICY IF EXISTS comments_read_anon ON public.comments;

CREATE POLICY comments_read ON public.comments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      moderation_status = 'approved'
      OR (author_id = auth.uid() AND moderation_status = 'pending_review')
      OR public.is_admin()
    )
  );

CREATE POLICY comments_read_anon ON public.comments
  FOR SELECT TO anon
  USING (deleted_at IS NULL AND moderation_status = 'approved');
