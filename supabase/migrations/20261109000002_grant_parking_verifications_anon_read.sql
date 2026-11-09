-- Migration: 20261109000002_grant_parking_verifications_anon_read
-- La policy parking_verifications_read_anon (20260727000004) permite a anon leer
-- la lista pública de verificadores, pero faltaba el privilegio de tabla: la
-- migración 20260719000001 solo concedió SELECT a 'authenticated'. En Supabase
-- Cloud funcionaba por el auto-grant histórico a 'anon'; en un entorno limpio
-- (CI con imagen reciente) no, y la lectura anónima fallaba con "permission
-- denied for table parking_verifications" (42501).
--
-- La RLS (parking_verifications_read_anon) sigue gobernando el acceso por fila;
-- este GRANT solo aporta el privilegio de tabla que la policy requiere debajo.
-- Idempotente y coherente con lo que Supabase Cloud ya concede.

GRANT SELECT ON public.parking_verifications TO anon;
