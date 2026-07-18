-- Migration: 20260718000004_users_privileged_fields_guard
-- Cierra la escalada de privilegios: la policy users_self_update permite a un
-- usuario editar su propia fila. Sin esto podría auto-asignarse role='admin' o
-- quitarse la suspensión. Solo el contexto service_role (Edge Function
-- admin-set-role, auth.uid() null) puede cambiar rol/suspensión.
-- OpenSpec: changes/admin-panel · design D3 · spec user-roles

CREATE OR REPLACE FUNCTION public.enforce_privileged_user_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
       NEW.role             IS DISTINCT FROM OLD.role
    OR NEW.suspended        IS DISTINCT FROM OLD.suspended
    OR NEW.suspended_at      IS DISTINCT FROM OLD.suspended_at
    OR NEW.suspended_reason  IS DISTINCT FROM OLD.suspended_reason
  ) THEN
    RAISE EXCEPTION 'El rol y la suspensión solo pueden cambiarse vía la Edge Function admin-set-role'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_privileged_fields
  BEFORE UPDATE OF role, suspended, suspended_at, suspended_reason ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_privileged_user_fields();

COMMENT ON FUNCTION public.enforce_privileged_user_fields() IS
  'Impide cambiar role/suspensión salvo en contexto service_role (Edge Function admin-set-role).';
