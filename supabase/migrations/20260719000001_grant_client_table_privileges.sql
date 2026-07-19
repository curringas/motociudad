-- Migration: 20260719000001_grant_client_table_privileges
-- Restore explicit table-level privileges for the client roles (anon, authenticated).
--
-- Why: the schema relied on Supabase's historical default of auto-granting DML
-- privileges on public tables to anon/authenticated. Newer Supabase stack images
-- (>= ~2.10x) no longer do this, so `supabase test db` in CI failed with
-- "42501: permission denied for table parkings" — RLS policies never even got
-- evaluated because the role lacked the coarse table privilege underneath them.
--
-- Row-level access stays governed by the existing RLS policies; these GRANTs only
-- provide the table-level privilege that each policy requires. Privileges are
-- derived one-to-one from the policies present in pg_policies (SELECT/INSERT/
-- UPDATE/DELETE per role). octano_events keeps SELECT only (read-own policy);
-- writes remain exclusive to the Edge Function via service_role (rule #1).
-- The statements are idempotent, matching what Supabase Cloud already grants.

-- parkings: public read; contributors insert/update (RLS-gated)
GRANT SELECT ON public.parkings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.parkings TO authenticated;

-- parking_photos: public read; owners insert/update/delete (RLS-gated)
GRANT SELECT ON public.parking_photos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.parking_photos TO authenticated;

-- parking_verifications: authenticated read only (write path is the Edge Function)
GRANT SELECT ON public.parking_verifications TO authenticated;

-- octano_events: authenticated read-own only; never writable from the client
GRANT SELECT ON public.octano_events TO authenticated;

-- user_levels: public catalog, read by everyone
GRANT SELECT ON public.user_levels TO anon, authenticated;

-- users: public profile read; users update their own row (RLS-gated)
GRANT SELECT ON public.users TO anon, authenticated;
GRANT UPDATE ON public.users TO authenticated;

-- parkings_with_stats: aggregated read view consumed by both web (anon) and app
GRANT SELECT ON public.parkings_with_stats TO anon, authenticated;
