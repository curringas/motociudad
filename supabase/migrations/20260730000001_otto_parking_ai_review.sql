-- Migration: 20260730000001_otto_parking_ai_review
-- Verificación por IA ("Otto") de parkings propuestos. Añade un estado de
-- revisión de IA INDEPENDIENTE de la verificación comunitaria (parking_status):
--   ai_review_status: approved | flagged | rejected
-- Regla de visibilidad: solo los parkings 'approved' son públicos y verificables
-- por la comunidad; los 'flagged'/'rejected' solo los ven su proponente y admin.
-- OpenSpec: changes/otto-parking-verification · design D1/D3 · spec otto-parking-verification

-- ── 1. Enum del veredicto de Otto (independiente de parking_status) ──────────
CREATE TYPE parking_ai_review_status AS ENUM ('approved', 'flagged', 'rejected');

-- ── 2. Columnas en parkings ──────────────────────────────────────────────────
-- Se añade con DEFAULT 'approved' para que TODAS las filas existentes (incluidos
-- los importados de OSM y los ya verificados) queden aprobadas y no desaparezcan.
ALTER TABLE public.parkings
  ADD COLUMN ai_review_status parking_ai_review_status NOT NULL DEFAULT 'approved',
  ADD COLUMN ai_review_reason TEXT,
  ADD COLUMN ai_reviewed_at   TIMESTAMPTZ,
  ADD COLUMN ai_review_source TEXT
    CHECK (ai_review_source IS NULL OR ai_review_source IN ('prefilter', 'provider', 'failsafe'));

-- Tras el backfill implícito (existentes = 'approved'), el default pasa a
-- 'flagged' como salvaguarda: una fila nueva nunca queda pública por accidente
-- si el gate de Otto no fija estado explícitamente.
ALTER TABLE public.parkings
  ALTER COLUMN ai_review_status SET DEFAULT 'flagged';

-- Índice para los filtros del panel admin (dudosos / rechazados / no verificados).
CREATE INDEX idx_parkings_ai_review_status
  ON public.parkings(ai_review_status) WHERE deleted_at IS NULL;

-- ── 3. Visibilidad: el público solo ve parkings 'approved' ────────────────────
-- Las policies actuales (20260705000001) dejaban ver cualquier parking no
-- borrado, incluidos pending. Las reemplazamos para excluir flagged/rejected del
-- público, manteniendo: proponente ve los suyos (cualquier estado) y admin ve todo
-- (policy parkings_read_admin, ya existente).
DROP POLICY IF EXISTS parkings_read ON public.parkings;
DROP POLICY IF EXISTS parkings_read_anon ON public.parkings;

-- Autenticado: parkings aprobados de cualquiera.
CREATE POLICY parkings_read ON public.parkings
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND ai_review_status = 'approved');

-- Autenticado: además, siempre los suyos (para ver "en revisión"/"rechazado").
CREATE POLICY parkings_read_own ON public.parkings
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND proposed_by = auth.uid());

-- Anónimo: solo parkings aprobados.
CREATE POLICY parkings_read_anon ON public.parkings
  FOR SELECT TO anon
  USING (deleted_at IS NULL AND ai_review_status = 'approved');

-- ── 4. Verificación comunitaria solo sobre parkings 'approved' ────────────────
-- Defensa en profundidad a nivel de BD: aunque un flagged/rejected no es visible
-- (y por tanto no debería llegar al flujo de verificación), bloqueamos el INSERT
-- de una verificación contra un parking no aprobado.
CREATE OR REPLACE FUNCTION public.enforce_verification_requires_ai_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_ai parking_ai_review_status;
BEGIN
  SELECT ai_review_status INTO v_ai
  FROM public.parkings
  WHERE id = NEW.parking_id;

  IF v_ai IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'parking % is not AI-approved (ai_review_status=%)', NEW.parking_id, v_ai
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verification_requires_ai_approved
  BEFORE INSERT ON public.parking_verifications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_verification_requires_ai_approved();

COMMENT ON COLUMN public.parkings.ai_review_status IS
  'Veredicto de Otto (IA), independiente de status/verificación comunitaria. otto-parking-verification';
