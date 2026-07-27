-- Migration: 20260727000003_guard_octano_cache_fields
-- change: edit-profile
-- Extiende el guard de campos privilegiados: además de role/suspensión, congela
-- los campos caché de gamificación (total_octanos, octanos_this_month,
-- current_level) frente a escritura directa del cliente. Estos solo cambian
-- desde la lógica de servidor (triggers en contexto service_role, auth.uid()
-- NULL) que mantiene el caché a partir de octano_events.
-- OpenSpec: changes/edit-profile · design D6

CREATE OR REPLACE FUNCTION public.enforce_privileged_user_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Rol y suspensión: solo vía Edge Function admin-set-role (service_role).
  IF auth.uid() IS NOT NULL AND (
       NEW.role             IS DISTINCT FROM OLD.role
    OR NEW.suspended         IS DISTINCT FROM OLD.suspended
    OR NEW.suspended_at      IS DISTINCT FROM OLD.suspended_at
    OR NEW.suspended_reason  IS DISTINCT FROM OLD.suspended_reason
  ) THEN
    RAISE EXCEPTION 'El rol y la suspensión solo pueden cambiarse vía la Edge Function admin-set-role'
      USING ERRCODE = '42501';
  END IF;

  -- Octanos y nivel: caché derivado de octano_events; nunca desde el cliente.
  IF auth.uid() IS NOT NULL AND (
       NEW.total_octanos      IS DISTINCT FROM OLD.total_octanos
    OR NEW.octanos_this_month IS DISTINCT FROM OLD.octanos_this_month
    OR NEW.current_level      IS DISTINCT FROM OLD.current_level
  ) THEN
    RAISE EXCEPTION 'Los Octanos y el nivel se calculan en el servidor y no pueden modificarse directamente'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Recrear el trigger para incluir los nuevos campos en la cláusula UPDATE OF.
DROP TRIGGER IF EXISTS trg_users_privileged_fields ON public.users;
CREATE TRIGGER trg_users_privileged_fields
  BEFORE UPDATE OF role, suspended, suspended_at, suspended_reason,
                   total_octanos, octanos_this_month, current_level ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_privileged_user_fields();

COMMENT ON FUNCTION public.enforce_privileged_user_fields() IS
  'Impide cambiar role/suspensión y los campos caché de Octanos/nivel salvo en contexto service_role (auth.uid() NULL).';
