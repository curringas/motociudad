-- Migration: 20261109000001_security_invoker_parkings_with_stats
-- Fija la vista pública parkings_with_stats como SECURITY INVOKER para que
-- respete la RLS del usuario que consulta. Antes corría como SECURITY DEFINER
-- (owner postgres) y se saltaba la RLS de `parkings`, devolviendo filas que la
-- política pública restringe a ai_review_status = 'approved'.
--
-- Resuelve el aviso 0010_security_definer_view del linter de Supabase.
-- Sin cambio de comportamiento observable: anon/authenticated tienen SELECT
-- sobre las tablas base (parkings, parking_photos, comments) y todos los
-- parkings vigentes están ai_review_status='approved'. Las subconsultas de
-- fotos y comentarios ya filtran por visibilidad pública.

ALTER VIEW public.parkings_with_stats SET (security_invoker = on);
