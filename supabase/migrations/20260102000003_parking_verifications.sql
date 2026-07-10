-- Migration: 20260102000003_parking_verifications
-- Tabla de verificaciones de parkings. Acción más valiosa del sistema.
-- modelo-datos.md §6.4

-- Nota: la referencia a parking_photos.id es opcional (nullable) para permitir
-- inserciones desde la Edge Function en un único paso.
CREATE TABLE public.parking_verifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_id        UUID NOT NULL REFERENCES public.parkings(id) ON DELETE CASCADE,
  verified_by       UUID NOT NULL REFERENCES public.users(id),
  photo_id          UUID REFERENCES public.parking_photos(id),
  user_location     GEOGRAPHY(Point, 4326),
  distance_meters   NUMERIC(8, 2),
  is_first_verifier BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parking_id, verified_by)  -- un usuario solo puede verificar un parking una vez
);

COMMENT ON TABLE public.parking_verifications IS
  'Cada acto de verificación in situ. La unicidad (parking_id, verified_by) impide auto-verificación repetida.';
COMMENT ON COLUMN public.parking_verifications.user_location IS
  'Posición del usuario en el momento de la verificación. Privacy: solo se persiste aquí, nunca en otras tablas.';
COMMENT ON COLUMN public.parking_verifications.distance_meters IS
  'Distancia calculada por la Edge Function entre user_location y parking.location (debe ser ≤100m).';

CREATE INDEX idx_verifications_parking ON public.parking_verifications(parking_id);
CREATE INDEX idx_verifications_user    ON public.parking_verifications(verified_by);

-- Trigger: incrementar verifications_count en parkings y actualizar last_verified_at
CREATE OR REPLACE FUNCTION public.increment_parking_verifications_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.parkings
  SET
    verifications_count = verifications_count + 1,
    last_verified_at = NEW.created_at,
    -- Si el parking estaba pendiente, pasa a verificado con la primera verificación
    status = CASE
      WHEN status = 'pending' THEN 'verified'::parking_status
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.parking_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_parking_verifications_count
  AFTER INSERT ON public.parking_verifications
  FOR EACH ROW EXECUTE FUNCTION public.increment_parking_verifications_count();

-- RLS
ALTER TABLE public.parking_verifications ENABLE ROW LEVEL SECURITY;

-- Lectura pública para usuarios autenticados (para mostrar quiénes verificaron)
CREATE POLICY verifications_read ON public.parking_verifications
  FOR SELECT TO authenticated
  USING (true);

-- Inserción: solo via Edge Function validate-verification (service_role).
-- No hay policy INSERT para 'authenticated' — protección crítica de anti-abuso.
