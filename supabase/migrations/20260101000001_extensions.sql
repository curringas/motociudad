-- Migration: 20260101000001_extensions
-- Habilitación de extensiones PostgreSQL necesarias para MotoCiudad.
-- Orden: debe ejecutarse primero, antes que cualquier otra migración.

-- pgcrypto: genera UUIDs con gen_random_uuid() y funciones de hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- postgis: soporte geoespacial (GEOGRAPHY, ST_DWithin, ST_Distance, etc.)
CREATE EXTENSION IF NOT EXISTS "postgis";

-- pg_cron: tareas programadas en PostgreSQL (refresh rankings, limpiezas)
-- Nota: pg_cron requiere permisos especiales en Supabase Cloud.
-- En local con supabase start está disponible automáticamente.
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- pg_net: permite hacer HTTP requests desde PostgreSQL (usado por check_level_up)
-- Disponible en Supabase Cloud y local desde CLI v1.x
CREATE EXTENSION IF NOT EXISTS "pg_net";
