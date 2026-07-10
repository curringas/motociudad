/**
 * Supabase client singleton para Edge Functions.
 * Usa service_role_key — NUNCA exponer en código de cliente.
 *
 * REGLA CRÍTICA: este módulo solo se importa desde Edge Functions (supabase/functions/).
 * No forma parte del bundle de la app móvil.
 */

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is required");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
}

/**
 * Cliente Supabase con service_role_key.
 * Bypasea RLS — usar solo para operaciones privilegiadas en Edge Functions.
 * Nunca log este objeto ni serializar su configuración.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

/**
 * Crea un cliente Supabase con el JWT del usuario autenticado.
 * Respeta RLS — usar para leer datos con los permisos del usuario.
 */
export function createUserClient(jwt: string): SupabaseClient {
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_ANON_KEY environment variable is required");
  }

  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
