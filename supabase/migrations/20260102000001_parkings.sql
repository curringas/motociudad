-- Migration: 20260102000001_parkings
-- Tabla principal de parkings con índices geoespaciales, RLS y función nearby_parkings.
-- modelo-datos.md §6.2 y §12.1

CREATE TABLE public.parkings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_by         UUID NOT NULL REFERENCES public.users(id),
  name                VARCHAR(120) NOT NULL,
  type                parking_type NOT NULL,
  status              parking_status NOT NULL DEFAULT 'pending',
  location            GEOGRAPHY(Point, 4326) NOT NULL,
  address             VARCHAR(200),
  city                VARCHAR(80) NOT NULL,
  district            VARCHAR(80),
  capacity            INTEGER,
  price_monthly       NUMERIC(7, 2),
  features            JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- features: {"covered": bool, "cameras": bool, "anchors": bool,
  --            "lit": bool, "free": bool, "h24": bool, "battery_layout": bool}
  notes               TEXT,
  verifications_count INTEGER NOT NULL DEFAULT 0,
  reports_count       INTEGER NOT NULL DEFAULT 0,
  last_verified_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE public.parkings IS
  'Entidad core. Cada fila es un parking propuesto o verificado por la comunidad.';
COMMENT ON COLUMN public.parkings.verifications_count IS
  'Caché derivado. Mantenido por trigger al insertar en parking_verifications.';
COMMENT ON COLUMN public.parkings.reports_count IS
  'Caché derivado. Mantenido por trigger al insertar en parking_reports.';
COMMENT ON COLUMN public.parkings.features IS
  'Mapa JSONB de características: covered, cameras, anchors, lit, free, h24, battery_layout.';

-- Índices — el GiST es obligatorio para consultas geoespaciales eficientes
CREATE INDEX idx_parkings_location ON public.parkings USING GIST (location);
CREATE INDEX idx_parkings_status   ON public.parkings(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_parkings_city     ON public.parkings(city)   WHERE deleted_at IS NULL;
CREATE INDEX idx_parkings_proposer ON public.parkings(proposed_by);

-- Trigger updated_at
CREATE TRIGGER trg_parkings_updated_at
  BEFORE UPDATE ON public.parkings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.parkings ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede ver parkings verificados
CREATE POLICY parkings_read_verified ON public.parkings
  FOR SELECT TO authenticated
  USING (status = 'verified' AND deleted_at IS NULL);

-- El proponente puede ver sus propios parkings en cualquier estado
CREATE POLICY parkings_read_own ON public.parkings
  FOR SELECT TO authenticated
  USING (proposed_by = auth.uid() AND deleted_at IS NULL);

-- Usuarios autenticados pueden insertar sus propios parkings (solo en estado pending)
CREATE POLICY parkings_insert ON public.parkings
  FOR INSERT TO authenticated
  WITH CHECK (proposed_by = auth.uid() AND status = 'pending');

-- Solo el dueño puede actualizar, y solo si está en estado pending
CREATE POLICY parkings_update_own_pending ON public.parkings
  FOR UPDATE TO authenticated
  USING (proposed_by = auth.uid() AND status = 'pending')
  WITH CHECK (proposed_by = auth.uid() AND status = 'pending');

-- ============================================================
-- Función: nearby_parkings
-- RPC para la app móvil: parkings ordenados por distancia.
-- modelo-datos.md §12.1
-- ============================================================
CREATE OR REPLACE FUNCTION public.nearby_parkings(
  in_lat           DOUBLE PRECISION,
  in_lng           DOUBLE PRECISION,
  in_radius_m      INTEGER DEFAULT 5000,
  in_filter        parking_type DEFAULT NULL,
  in_only_verified BOOLEAN DEFAULT FALSE,
  in_limit         INTEGER DEFAULT 100
)
RETURNS TABLE (
  id                  UUID,
  name                VARCHAR,
  type                parking_type,
  status              parking_status,
  city                VARCHAR,
  district            VARCHAR,
  capacity            INTEGER,
  features            JSONB,
  verifications_count INTEGER,
  distance_meters     NUMERIC,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION
)
LANGUAGE sql STABLE
SECURITY INVOKER
AS $$
  SELECT
    p.id,
    p.name,
    p.type,
    p.status,
    p.city,
    p.district,
    p.capacity,
    p.features,
    p.verifications_count,
    ST_Distance(
      p.location,
      ST_MakePoint(in_lng, in_lat)::geography
    )::numeric AS distance_meters,
    ST_Y(p.location::geometry) AS lat,
    ST_X(p.location::geometry) AS lng
  FROM public.parkings p
  WHERE
    p.deleted_at IS NULL
    AND (NOT in_only_verified OR p.status = 'verified')
    AND (in_filter IS NULL OR p.type = in_filter)
    AND ST_DWithin(
      p.location,
      ST_MakePoint(in_lng, in_lat)::geography,
      in_radius_m
    )
  ORDER BY distance_meters ASC
  LIMIT in_limit;
$$;

-- Grants para que la función sea accesible como RPC
GRANT EXECUTE ON FUNCTION public.nearby_parkings(
  DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, parking_type, BOOLEAN, INTEGER
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.nearby_parkings(
  DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, parking_type, BOOLEAN, INTEGER
) TO anon;

-- NOTA: La vista parkings_with_stats se crea en una migración posterior
-- (20260103000002_views.sql) porque depende de las tablas parking_photos y comments
-- que se crean en migraciones posteriores a esta.
