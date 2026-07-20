-- Migration: 20260720000001_octano_action_comments
-- Adds the two new comment-ladder actions to the octano_action enum.
-- gamificacion.md §2.1 (escalera de primeros comentarios) + change add-parking-comments.
--
-- Kept atomic (enum-only) on purpose: PostgreSQL forbids using a freshly added
-- enum value in the same transaction that adds it, so the RPCs that reference
-- these values live in a later migration (20260720000003).

ALTER TYPE octano_action ADD VALUE IF NOT EXISTS 'first_comment';   -- 1er comentario elegible (+10)
ALTER TYPE octano_action ADD VALUE IF NOT EXISTS 'second_comment';  -- 2º comentario elegible (+5)
