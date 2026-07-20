-- Migration: 20260720000002_comments
-- Comment subdomain tables: comments + comment_votes.
-- modelo-datos.md §6.6–6.7 + change add-parking-comments.
--
-- Comments require NO geolocation (privacy rule): unlike parking_verifications,
-- these tables never store user coordinates. Octano crediting is done only by the
-- Edge Functions (service_role); there is no client INSERT/UPDATE/DELETE policy.

-- ============================================================
-- comments
-- ============================================================
CREATE TABLE public.comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_id      UUID NOT NULL REFERENCES public.parkings(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES public.users(id),
  body            TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  upvotes_count   INTEGER NOT NULL DEFAULT 0,          -- cache of upvotes (value = 1)
  octanos_awarded BOOLEAN NOT NULL DEFAULT FALSE,      -- position bonus paid once
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

COMMENT ON TABLE public.comments IS
  'Comentarios de la comunidad sobre parkings. Sin geolocalización (privacidad). Escritura solo vía Edge Function. modelo-datos.md §6.6';
COMMENT ON COLUMN public.comments.upvotes_count IS
  'Caché del número de upvotes (value=1). Mantenido por el RPC process_comment_vote.';
COMMENT ON COLUMN public.comments.octanos_awarded IS
  'TRUE cuando el comentario ya recibió bonus de posición (first_comment/second_comment). Garantiza pago único por comentario en esa vía.';

CREATE INDEX idx_comments_parking ON public.comments(parking_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- comment_votes
-- ============================================================
CREATE TABLE public.comment_votes (
  comment_id    UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  value         SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

COMMENT ON TABLE public.comment_votes IS
  'Votos (+1/-1) sobre comentarios. El umbral de calidad (useful_comment) usa el neto. modelo-datos.md §6.7';

CREATE INDEX idx_comment_votes_comment ON public.comment_votes(comment_id);

CREATE TRIGGER trg_comment_votes_updated_at
  BEFORE UPDATE ON public.comment_votes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS: lectura pública, escritura solo vía Edge Function (service_role)
-- ============================================================
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;

-- comments: lectura pública de no-borrados (web anon + app authenticated)
CREATE POLICY comments_read ON public.comments
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY comments_read_anon ON public.comments
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

-- Sin policy INSERT/UPDATE/DELETE para 'authenticated' ni 'anon':
-- crear, votar y soft-borrar pasa exclusivamente por Edge Functions con service_role.

-- comment_votes: lectura pública del agregado
CREATE POLICY comment_votes_read ON public.comment_votes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY comment_votes_read_anon ON public.comment_votes
  FOR SELECT TO anon
  USING (true);

-- ============================================================
-- Grants de tabla (RLS sigue gobernando el acceso por fila)
-- Solo SELECT para el cliente; la escritura la hace service_role (bypass RLS).
-- ============================================================
GRANT SELECT ON public.comments TO anon, authenticated;
GRANT SELECT ON public.comment_votes TO anon, authenticated;
