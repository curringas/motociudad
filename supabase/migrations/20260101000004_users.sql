-- Migration: 20260101000004_users
-- Tabla public.users que extiende auth.users con el perfil público.
-- modelo-datos.md §5.2

CREATE TABLE public.users (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username            VARCHAR(30) UNIQUE NOT NULL,
  display_name        VARCHAR(60) NOT NULL,
  avatar_url          TEXT,
  bike_model          VARCHAR(80),
  city_primary        VARCHAR(80),
  current_level       INTEGER NOT NULL DEFAULT 1
                        REFERENCES public.user_levels(level),
  total_octanos       INTEGER NOT NULL DEFAULT 0,
  octanos_this_month  INTEGER NOT NULL DEFAULT 0,
  ranking_visible     BOOLEAN NOT NULL DEFAULT TRUE,
  flagged_for_review  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS
  'Perfil público del usuario. Extiende auth.users. Nunca tocar directamente desde el cliente.';
COMMENT ON COLUMN public.users.total_octanos IS
  'Caché derivado de octano_events. No modificar directamente — mantenido por trigger.';
COMMENT ON COLUMN public.users.octanos_this_month IS
  'Caché para ranking. Ventana de 30 días. Mantenido por trigger.';

-- Índices para rankings y filtros frecuentes
CREATE INDEX idx_users_city ON public.users(city_primary)
  WHERE ranking_visible = TRUE;

CREATE INDEX idx_users_total_octanos ON public.users(total_octanos DESC)
  WHERE ranking_visible = TRUE;

-- Trigger: mantener updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: crear perfil public.users automáticamente al registrarse en auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, username, display_name)
  VALUES (
    NEW.id,
    -- Usar email como username provisional (sanitizado); el usuario puede cambiarlo después
    COALESCE(
      SPLIT_PART(NEW.email, '@', 1),
      'user_' || SUBSTRING(NEW.id::text, 1, 8)
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      SPLIT_PART(NEW.email, '@', 1),
      'Usuario'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver perfiles públicos
CREATE POLICY users_public_read ON public.users
  FOR SELECT
  USING (true);

-- Solo el propio usuario puede actualizar su perfil
CREATE POLICY users_self_update ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Solo service_role puede insertar (lo hace el trigger handle_new_user con SECURITY DEFINER)
-- Sin policy INSERT para 'authenticated' — se insertan vía trigger
