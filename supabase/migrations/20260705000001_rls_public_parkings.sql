-- Migration: 20260705000001_rls_public_parkings
-- Abre la lectura de parkings a usuarios no autenticados y hace visibles los
-- parkings en estado pending para que la comunidad pueda verificarlos.
-- Sin este cambio: anon no ve nada; parkings pending solo los ve el proponente.

-- Eliminar las políticas restrictivas anteriores
DROP POLICY IF EXISTS parkings_read_verified ON public.parkings;
DROP POLICY IF EXISTS parkings_read_own ON public.parkings;

-- Cualquier usuario (autenticado o anónimo) puede leer todos los parkings no eliminados.
-- El estado pending es visible para que la comunidad pueda ir a verificarlos.
CREATE POLICY parkings_read ON public.parkings
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY parkings_read_anon ON public.parkings
  FOR SELECT TO anon
  USING (deleted_at IS NULL);
