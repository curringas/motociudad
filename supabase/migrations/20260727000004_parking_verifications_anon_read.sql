-- Migration: 20260727000004_parking_verifications_anon_read
-- change: edit-profile
-- Lectura anónima de parking_verifications para que la web pública pueda listar
-- quién ha verificado un parking (coherente con la lectura abierta de parkings).
-- La escritura sigue restringida a la Edge Function validate-verification.

DROP POLICY IF EXISTS parking_verifications_read_anon ON public.parking_verifications;
CREATE POLICY parking_verifications_read_anon ON public.parking_verifications
  FOR SELECT TO anon
  USING (true);
