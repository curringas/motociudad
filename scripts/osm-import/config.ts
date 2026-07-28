/**
 * Supabase admin client for the seeding tool. Reads the service_role key from
 * the repo-root `.env` (gitignored) — it is NEVER hardcoded nor shipped to the
 * client. This module is imported only by the CLI orchestrator, keeping the
 * pure mapping/naming/photo modules free of network dependencies.
 */

import { load } from "jsr:@std/dotenv";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

let client: SupabaseClient | null = null;

export async function getSupabaseAdmin(): Promise<SupabaseClient> {
  if (client) return client;

  // Repo root is two levels up from scripts/osm-import/.
  const envPath = new URL("../../.env", import.meta.url).pathname;
  const env = await load({ envPath, export: false });

  const url = env.EXPO_PUBLIC_SUPABASE_URL ??
    Deno.env.get("EXPO_PUBLIC_SUPABASE_URL");
  const key = env.SUPABASE_SERVICE_ROLE_KEY ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error(
      "Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env raíz.",
    );
  }

  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
