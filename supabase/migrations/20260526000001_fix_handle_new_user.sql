-- Fix: handle_new_user trigger now generates a unique username
-- when the email prefix is already taken, by appending a short UUID suffix.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
BEGIN
  base_username := COALESCE(
    REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g'),
    'user_' || SUBSTRING(NEW.id::text, 1, 8)
  );

  -- Ensure uniqueness by appending a suffix if the username already exists
  final_username := base_username;
  IF EXISTS (SELECT 1 FROM public.users WHERE username = final_username) THEN
    final_username := base_username || '_' || SUBSTRING(NEW.id::text, 1, 6);
  END IF;

  INSERT INTO public.users (id, username, display_name)
  VALUES (
    NEW.id,
    final_username,
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
