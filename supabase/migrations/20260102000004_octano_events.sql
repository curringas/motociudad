-- Migration: 20260102000004_octano_events
-- Tabla insert-only para eventos de Octanos. Solo la Edge Function puede escribir.
-- modelo-datos.md §8.2 y gamificacion.md §7.1
-- REGLA CRÍTICA: nunca exponer escritura al cliente (anon o authenticated).

CREATE TABLE public.octano_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type    octano_action NOT NULL,
  points         INTEGER NOT NULL,
  reference_id   UUID,
  reference_type VARCHAR(20),
  status         octano_status NOT NULL DEFAULT 'pending',
  metadata       JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.octano_events IS
  'Insert-only. Fuente de verdad de Octanos. Solo la Edge Function (service_role) puede escribir. gamificacion.md §7.1';
COMMENT ON COLUMN public.octano_events.reference_id IS
  'UUID del parking/comment/poi/usuario relacionado con la acción.';
COMMENT ON COLUMN public.octano_events.reference_type IS
  'Tipo del recurso referenciado: "parking", "comment", "poi", "user", "none".';
COMMENT ON COLUMN public.octano_events.metadata IS
  'Contexto extra: IP anonimizada, ciudad, user agent parcial. Nunca tokens ni contraseñas.';

-- Índices para consultas de suma de Octanos y detección de límite diario
CREATE INDEX idx_octano_events_user   ON public.octano_events(user_id, status);
CREATE INDEX idx_octano_events_recent ON public.octano_events(user_id, confirmed_at DESC)
  WHERE status = 'confirmed';
CREATE INDEX idx_octano_events_action ON public.octano_events(action_type, created_at);

-- Trigger: refresh de cachés de usuario tras confirmar un evento
CREATE OR REPLACE FUNCTION public.refresh_user_octano_caches()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    UPDATE public.users
    SET
      total_octanos = (
        SELECT COALESCE(SUM(points), 0)
        FROM public.octano_events
        WHERE user_id = NEW.user_id AND status = 'confirmed'
      ),
      octanos_this_month = (
        SELECT COALESCE(SUM(points), 0)
        FROM public.octano_events
        WHERE user_id = NEW.user_id
          AND status = 'confirmed'
          AND confirmed_at >= now() - INTERVAL '30 days'
      ),
      updated_at = now()
    WHERE id = NEW.user_id;

    -- Comprobación de subida de nivel
    PERFORM public.check_level_up(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_octano_event_confirmed
  AFTER INSERT OR UPDATE OF status ON public.octano_events
  FOR EACH ROW EXECUTE FUNCTION public.refresh_user_octano_caches();

-- Trigger updated_at
CREATE TRIGGER trg_octano_events_updated_at
  BEFORE UPDATE ON public.octano_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Función: comprobar subida de nivel y emitir notificación
CREATE OR REPLACE FUNCTION public.check_level_up(in_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_current_level  INT;
  v_new_level      INT;
  v_total_octanos  INT;
BEGIN
  SELECT current_level, total_octanos
    INTO v_current_level, v_total_octanos
    FROM public.users
   WHERE id = in_user_id;

  SELECT MAX(level) INTO v_new_level
    FROM public.user_levels
   WHERE min_octanos <= v_total_octanos;

  IF v_new_level IS NOT NULL AND v_new_level > v_current_level THEN
    UPDATE public.users
       SET current_level = v_new_level,
           updated_at = now()
     WHERE id = in_user_id;

    -- Emitir notificación de nivel via pg_net (no bloquea la transacción)
    -- La URL se configura en app.settings durante el deploy
    BEGIN
      PERFORM net.http_post(
        url     := current_setting('app.edge_url', true) || '/notify-level-up',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := jsonb_build_object(
                     'user_id',   in_user_id,
                     'new_level', v_new_level
                   )
      );
    EXCEPTION WHEN OTHERS THEN
      -- No propagar el error: la subida de nivel ya ocurrió, la notificación es best-effort
      NULL;
    END;
  END IF;
END;
$$;

-- RLS: tabla protegida — solo lectura propia para autenticados; sin escritura desde el cliente
ALTER TABLE public.octano_events ENABLE ROW LEVEL SECURITY;

-- Cada usuario puede ver solo sus propios eventos (para historial en la app)
CREATE POLICY octano_events_read_own ON public.octano_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Sin policy INSERT/UPDATE/DELETE para 'authenticated' ni 'anon'.
-- La escritura la realiza exclusivamente la Edge Function con service_role_key.
