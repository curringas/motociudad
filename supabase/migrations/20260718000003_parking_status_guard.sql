-- Migration: 20260718000003_parking_status_guard
-- Solo un admin puede cambiar parkings.status desde contexto de usuario.
-- La verificación comunitaria corre con service_role (auth.uid() null) y queda permitida.
-- OpenSpec: changes/admin-panel · design D4 · spec admin-parking-management

CREATE OR REPLACE FUNCTION public.enforce_admin_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Permitir si es admin (verificación desde el panel) o si no hay usuario en
  -- contexto (service_role: verificación comunitaria vía Edge Function).
  IF NOT (public.is_admin() OR auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'Solo un admin puede cambiar el estado de un parking'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_parkings_status_admin_only
  BEFORE UPDATE OF status ON public.parkings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.enforce_admin_status_change();

COMMENT ON FUNCTION public.enforce_admin_status_change() IS
  'Rechaza cambios de parkings.status salvo admin o contexto service_role (auth.uid() null).';