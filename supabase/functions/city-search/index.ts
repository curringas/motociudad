/**
 * Edge Function: city-search
 * Busca ciudades por texto y devuelve sugerencias estructuradas
 * ("Ciudad, País" + coordenadas) para poblar users.city_primary de forma
 * normalizada. Funciona igual en web, iOS y Android (no depende del geocoder
 * nativo del sistema operativo).
 *
 * Flujo:
 * 1. Autenticar usuario (JWT)
 * 2. Validar la consulta con Zod
 * 3. Consultas < 2 caracteres → [] (no se llama al geocodificador)
 * 4. Proxy a Nominatim (OSM) con User-Agent propio → normalizar → responder
 *
 * OpenSpec: changes/edit-profile · spec city-search
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { ERRORS, errorResponse, makeError } from "../_shared/errors.ts";
import { MIN_QUERY_LENGTH, parseCitySearch } from "./schemas.ts";
import { buildNominatimUrl, normalizeNominatim } from "./nominatim.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Nominatim usage policy requires an identifying User-Agent. */
const USER_AGENT = "MotoCiudad/1.0 (https://motociudad.com)";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ── 1. Autenticación ────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(ERRORS.UNAUTHORIZED, 401);
  }
  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
    jwt,
  );
  if (authError || !user) {
    return errorResponse(
      makeError("INVALID_TOKEN", "Token de autenticación inválido"),
      401,
    );
  }

  // ── 2. Validación ───────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(
      makeError("VALIDATION_ERROR", "El body debe ser JSON válido"),
    );
  }
  const parsed = parseCitySearch(body);
  if (!parsed.success) {
    return errorResponse(makeError("VALIDATION_ERROR", parsed.error));
  }
  const query = parsed.data.q;

  // ── 3. Consulta demasiado corta → sin resultados ────────────
  if (query.length < MIN_QUERY_LENGTH) {
    return jsonResponse({ results: [] });
  }

  // ── 4. Proxy a Nominatim + normalización ────────────────────
  try {
    const res = await fetch(buildNominatimUrl(query), {
      headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
    });
    if (!res.ok) {
      console.error(JSON.stringify({
        code: "GEOCODER_ERROR",
        detail: `Nominatim status ${res.status}`,
        timestamp: new Date().toISOString(),
      }));
      return jsonResponse({ results: [] });
    }
    const items = await res.json();
    return jsonResponse({ results: normalizeNominatim(items) });
  } catch (err) {
    console.error(JSON.stringify({
      code: "GEOCODER_ERROR",
      detail: err instanceof Error ? err.message : "fetch failed",
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }
});
