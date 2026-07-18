-- Migration: 20260718000006_harden_write_policies_suspended
-- Aplica el gate de suspensión a las policies de escritura de usuario existentes.
-- (Los flujos vía Edge Function con service_role saltan RLS; el chequeo de
-- suspensión en esos flujos se añade en las propias funciones.)
-- OpenSpec: changes/admin-panel · spec user-roles

CREATE OR REPLACE FUNCTION public.is_suspended()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND suspended
  );
$$;

COMMENT ON FUNCTION public.is_suspended() IS
  'TRUE si el usuario auth.uid() está suspendido. Uso en policies de escritura.';

-- Proponer parking: requiere no estar suspendido
DROP POLICY parkings_insert ON public.parkings;
CREATE POLICY parkings_insert ON public.parkings
  FOR INSERT TO authenticated
  WITH CHECK (
    proposed_by = auth.uid()
    AND status = 'pending'::parking_status
    AND NOT public.is_suspended()
  );

-- Editar propio parking pendiente (móvil): requiere no estar suspendido
DROP POLICY parkings_update_own_pending ON public.parkings;
CREATE POLICY parkings_update_own_pending ON public.parkings
  FOR UPDATE TO authenticated
  USING (
    proposed_by = auth.uid()
    AND status = 'pending'::parking_status
    AND NOT public.is_suspended()
  )
  WITH CHECK (
    proposed_by = auth.uid()
    AND status = 'pending'::parking_status
    AND NOT public.is_suspended()
  );

-- Añadir foto: requiere no estar suspendido
DROP POLICY parking_photos_insert ON public.parking_photos;
CREATE POLICY parking_photos_insert ON public.parking_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND is_verification = false
    AND NOT public.is_suspended()
    AND EXISTS (
      SELECT 1 FROM public.parkings p
      WHERE p.id = parking_photos.parking_id
        AND p.deleted_at IS NULL
        AND (p.status = 'verified'::parking_status OR p.proposed_by = auth.uid())
    )
  );
