-- Alinea el RLS de parking_photos con la política abierta de parkings
-- (20260705000001_rls_public_parkings). Si el parking es visible (no eliminado),
-- sus fotos también deben serlo. La política anterior era más restrictiva:
-- solo verified o proposed_by = auth.uid().
DROP POLICY IF EXISTS parking_photos_read ON public.parking_photos;

CREATE POLICY parking_photos_read ON public.parking_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parkings p
      WHERE p.id = parking_id
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY parking_photos_read_anon ON public.parking_photos
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.parkings p
      WHERE p.id = parking_id
        AND p.deleted_at IS NULL
    )
  );
