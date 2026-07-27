-- Migration: 20260727000001_profile_username_unique_ci
-- change: edit-profile
-- Nick (@handle) único case-insensitive + CHECK de formato, y saneado del
-- username autogenerado en el alta para que respete el nuevo formato.
-- modelo-datos.md §5.2

-- Unicidad insensible a mayúsculas: "Curro" == "curro".
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key
  ON public.users (LOWER(username));

-- Formato del nick: 3–30 caracteres, letras/dígitos y separadores _ . -
-- NOT VALID: no se valida sobre filas preexistentes (evita romper la migración
-- con usernames heredados del prefijo del email); sí se aplica a INSERT/UPDATE.
ALTER TABLE public.users
  ADD CONSTRAINT users_username_format_chk
  CHECK (username ~ '^[A-Za-z0-9_.-]{3,30}$') NOT VALID;

-- El trigger de alta debe generar un username conforme al nuevo formato y
-- comprobar la unicidad de forma case-insensitive.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
BEGIN
  -- Keep only allowed characters; fall back to a UUID-based handle when the
  -- sanitized prefix is empty or too short.
  base_username := REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^A-Za-z0-9_.-]', '_', 'g');
  IF base_username IS NULL OR LENGTH(base_username) < 3 THEN
    base_username := 'user_' || SUBSTRING(NEW.id::text, 1, 8);
  END IF;
  base_username := LEFT(base_username, 30);

  final_username := base_username;
  IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(username) = LOWER(final_username)) THEN
    -- Leave room for the 7-char suffix ("_" + 6 hex) within the 30-char cap.
    final_username := LEFT(base_username, 23) || '_' || SUBSTRING(NEW.id::text, 1, 6);
  END IF;

  INSERT INTO public.users (id, username, display_name)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      final_username,
      'Usuario'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON INDEX public.users_username_lower_key IS
  'Unicidad del nick insensible a mayúsculas. change: edit-profile';
