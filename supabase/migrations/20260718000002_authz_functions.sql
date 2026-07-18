-- Migration: 20260718000002_authz_functions
-- Primitivas de autorización reutilizables en las policies RLS.
-- SECURITY DEFINER + search_path fijo: evitan recursión de RLS al consultar users
-- y cierran el vector de search_path mutable.
-- OpenSpec: changes/admin-panel · spec user-roles

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
      AND NOT suspended
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_parkings()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('contributor', 'admin')
      AND NOT suspended
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'TRUE si auth.uid() es admin y no está suspendido. Uso en policies RLS.';
COMMENT ON FUNCTION public.can_manage_parkings() IS
  'TRUE si auth.uid() es contributor o admin y no está suspendido. Uso en policies RLS.';