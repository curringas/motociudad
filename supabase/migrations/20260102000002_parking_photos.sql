-- Migration: 20260102000002_parking_photos
-- Tabla de fotos de parkings. Una fila por foto subida.
-- modelo-datos.md §6.3

CREATE TABLE public.parking_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_id      UUID NOT NULL REFERENCES public.parkings(id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES public.users(id),
  storage_path    TEXT NOT NULL,
  thumbnail_path  TEXT,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  is_verification BOOLEAN NOT NULL DEFAULT FALSE,
  width           INTEGER,
  height          INTEGER,
  size_bytes      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.parking_photos IS
  'Una fila por foto de parking. Las de verificación llevan is_verification=true.';
COMMENT ON COLUMN public.parking_photos.storage_path IS
  'Key en Supabase Storage. Formato: parkings-photos/{parking_id}/{photo_id}.webp';
COMMENT ON COLUMN public.parking_photos.is_verification IS
  'TRUE si la foto proviene de un acto de verificación in situ (creada por validate-verification).';

CREATE INDEX idx_photos_parking  ON public.parking_photos(parking_id);
CREATE INDEX idx_photos_uploader ON public.parking_photos(uploaded_by);

-- RLS
ALTER TABLE public.parking_photos ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede ver fotos de parkings visibles
-- (la visibilidad se hereda del parking: si puedes leer el parking, puedes leer sus fotos)
CREATE POLICY parking_photos_read ON public.parking_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parkings p
      WHERE p.id = parking_id
        AND p.deleted_at IS NULL
        AND (
          p.status = 'verified'
          OR p.proposed_by = auth.uid()
        )
    )
  );

-- Los usuarios pueden subir fotos a parkings existentes y visibles
-- La inserción real de fotos de verificación la hace la Edge Function con service_role
CREATE POLICY parking_photos_insert ON public.parking_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND is_verification = FALSE  -- fotos de verificación solo via Edge Function
    AND EXISTS (
      SELECT 1 FROM public.parkings p
      WHERE p.id = parking_id
        AND p.deleted_at IS NULL
        AND (p.status = 'verified' OR p.proposed_by = auth.uid())
    )
  );
