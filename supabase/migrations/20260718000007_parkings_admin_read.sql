-- Migration: 20260718000007_parkings_admin_read
-- Los admin pueden LEER todos los parkings, incluidos los borrados (deleted_at)
-- y archivados, para poder gestionarlos desde el panel.
--
-- Motivo técnico: las policies SELECT existentes (parkings_read / _anon) solo
-- muestran filas con deleted_at IS NULL. En un UPDATE que fija deleted_at, la
-- fila resultante deja de ser visible bajo cualquier policy SELECT y PostgreSQL
-- rechaza el propio UPDATE con "new row violates row-level security policy".
-- Sin esta policy el admin no puede borrar/archivar (task 7.5), pese al trigger
-- trg_parkings_delete_admin_only que ya lo autoriza.
-- OpenSpec: changes/admin-panel · design D4/D5 · spec admin-parking-management

CREATE POLICY parkings_read_admin ON public.parkings
  FOR SELECT TO authenticated
  USING (public.is_admin());
