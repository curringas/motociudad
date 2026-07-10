-- Migration: 20260101000002_enums
-- Definición de todos los tipos ENUM del proyecto MotoCiudad.
-- Deben crearse antes que cualquier tabla que los referencie.

-- Tipos de parking: público (en calle/zona pública) o privado (garaje/comunidad)
CREATE TYPE parking_type AS ENUM ('public', 'private');

-- Estados del ciclo de vida de un parking
CREATE TYPE parking_status AS ENUM ('pending', 'verified', 'rejected', 'archived');

-- Tipos de POI secundario (talleres, ITV, etc.)
CREATE TYPE poi_type AS ENUM ('workshop', 'itv', 'gas_station', 'shop');

-- Motivos para reportar un parking erróneo
CREATE TYPE report_reason AS ENUM (
  'not_exists',
  'wrong_location',
  'closed',
  'private_now',
  'duplicate',
  'other'
);

-- Estados de un reporte de error
CREATE TYPE report_status AS ENUM ('pending', 'confirmed', 'dismissed');

-- Acciones puntuables en el sistema de Octanos
-- Fuente de verdad: gamificacion.md §2.1
CREATE TYPE octano_action AS ENUM (
  'propose_parking',        -- proponer un parking nuevo (+50 pts, diferidos)
  'parking_verified_bonus', -- bonus al proponente cuando su parking queda verificado (+30 pts)
  'verify_parking',         -- verificar un parking in situ (+25 pts)
  'first_verifier',         -- bonus por ser el primero en verificar (+15 pts)
  'report_error',           -- reportar parking erróneo confirmado (+20 pts)
  'upload_photo',           -- subir foto a parking existente (+10 pts, máx. 3 por parking)
  'useful_comment',         -- comentario con ≥2 upvotes (+5 pts)
  'propose_poi',            -- proponer taller/POI secundario (+30 pts)
  'weekly_streak',          -- racha semanal de 7 días consecutivos (+15 pts)
  'invite_friend'           -- invitar amigo que se registra y verifica (+40 pts)
);

-- Estados de un evento de Octanos
CREATE TYPE octano_status AS ENUM ('pending', 'confirmed', 'reverted');

-- Familias de insignias
CREATE TYPE badge_family AS ENUM ('discovery', 'verification', 'community', 'thematic');

-- Estados de amistad entre usuarios
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');
