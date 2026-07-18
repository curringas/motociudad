-- Migration: 20260718000001_user_roles
-- Introduce el modelo de roles y la suspensión global de cuenta.
-- OpenSpec: changes/admin-panel · spec user-roles · modelo-datos.md (rol/suspensión)

-- Roles de usuario (mutuamente excluyentes)
CREATE TYPE user_role AS ENUM ('user', 'contributor', 'admin');

-- Rol y estado de suspensión en el perfil público
ALTER TABLE public.users
  ADD COLUMN role              user_role   NOT NULL DEFAULT 'user',
  ADD COLUMN suspended         BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN suspended_at      TIMESTAMPTZ,
  ADD COLUMN suspended_reason  TEXT;

COMMENT ON COLUMN public.users.role IS
  'Rol de la cuenta: user (por defecto), contributor (gestiona sus parkings en el panel), admin (gestión total).';
COMMENT ON COLUMN public.users.suspended IS
  'Si TRUE, la cuenta queda en solo-lectura: sin acceso al panel ni contribuciones en la app, sea cual sea el rol.';

-- Índice para filtrar usuarios por rol en el panel de administración
CREATE INDEX idx_users_role ON public.users(role);
