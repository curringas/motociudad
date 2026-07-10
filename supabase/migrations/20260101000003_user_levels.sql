-- Migration: 20260101000003_user_levels
-- Tabla catálogo user_levels con los 7 niveles del sistema de gamificación.
-- Datos de referencia: gamificacion.md §3

CREATE TABLE public.user_levels (
  level       INTEGER PRIMARY KEY,
  name        VARCHAR(40) NOT NULL,
  min_octanos INTEGER NOT NULL UNIQUE,
  benefits    JSONB NOT NULL DEFAULT '[]'::jsonb,
  icon_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_levels IS
  'Catálogo estático de niveles del sistema de gamificación. Fuente: gamificacion.md §3.';

-- Datos iniciales de niveles (seed integrado en la migración por ser catálogo estático)
-- gamificacion.md §3 — Tabla de niveles y beneficios
INSERT INTO public.user_levels (level, name, min_octanos, benefits) VALUES
  (1, 'Pipiolo',             0,     '["read", "propose", "comment"]'::jsonb),
  (2, 'Rodador',             101,   '["verify"]'::jsonb),
  (3, 'Buscaplazas',         501,   '["auto_publish"]'::jsonb),
  (4, 'Cartógrafo',          1501,  '["report_double_weight"]'::jsonb),
  (5, 'Centinela',           4001,  '["moderation_double_vote"]'::jsonb),
  (6, 'Maestro Motero',      10001, '["edit_metadata"]'::jsonb),
  (7, 'Leyenda del Asfalto', 25001, '["special_badge", "beta_access"]'::jsonb);

-- RLS: tabla de catálogo, lectura pública (no contiene datos personales)
ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_levels_read_all ON public.user_levels
  FOR SELECT
  USING (true);
