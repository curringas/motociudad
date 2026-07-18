-- Migration: 20260718000005_admin_parking_policies
-- Policies de gestión de parkings y fotos para el panel:
-- admin edita/borra cualquiera; contributor edita los suyos. Borrado (deleted_at)
-- restringido a admin, igual que el cambio de status.
-- OpenSpec: changes/admin-panel · design D4/D5 · spec admin-parking-management

-- Generaliza el guard (también protege el borrado lógico deleted_at)
CREATE OR REPLACE FUNCTION public.enforce_admin_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'Solo un admin puede cambiar el estado o borrar un parking'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_parkings_delete_admin_only
  BEFORE UPDATE OF deleted_at ON public.parkings
  FOR EACH ROW
  WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
  EXECUTE FUNCTION public.enforce_admin_status_change();

-- Edición de parkings desde el panel
CREATE POLICY parkings_update_admin ON public.parkings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY parkings_update_contributor_own ON public.parkings
  FOR UPDATE TO authenticated
  USING (public.can_manage_parkings() AND proposed_by = auth.uid())
  WITH CHECK (public.can_manage_parkings() AND proposed_by = auth.uid());

-- Gestión de fotos por admin (cualquier parking). El contributor ya puede
-- añadir fotos a los suyos vía la policy parking_photos_insert existente.
CREATE POLICY parking_photos_insert_admin ON public.parking_photos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY parking_photos_update_admin ON public.parking_photos
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY parking_photos_delete_admin ON public.parking_photos
  FOR DELETE TO authenticated
  USING (public.is_admin());
