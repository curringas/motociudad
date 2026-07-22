/**
 * Edge Function: post-comment
 * Publica un comentario en un parking y acredita la escalera de Octanos.
 *
 * Flujo:
 * 1. Autenticar usuario (JWT)
 * 2. Email confirmado + cuenta no suspendida
 * 3. Validar body con Zod (1–500 caracteres)
 * 4. Rate limit por usuario (máx. 1 comentario / 30 s)
 * 5. RPC atómica process_comment: inserta comentario + acredita +10/+5 si procede
 *
 * Comentar NO requiere geolocalización (no se persiste ninguna coordenada).
 * La acreditación de Octanos ocurre solo aquí (nunca desde el cliente).
 * NUNCA loguear tokens ni service_role_key.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { ERRORS, errorResponse, makeError } from "../_shared/errors.ts";
import { parsePostComment } from "./schemas.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Ventana de rate limit: máx. 1 comentario cada 30 segundos por usuario. */
const RATE_LIMIT_WINDOW_MS = 30_000;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
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
    console.error(JSON.stringify({
      code: "INVALID_TOKEN",
      detail: authError?.message ?? "No user",
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(
      makeError("INVALID_TOKEN", "Token de autenticación inválido"),
      401,
    );
  }
  const userId = user.id;

  // ── 2. Email confirmado + cuenta activa ─────────────────────
  if (!user.email_confirmed_at) {
    return errorResponse(ERRORS.EMAIL_NOT_CONFIRMED, 403);
  }
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("suspended")
    .eq("id", userId)
    .single();
  if (profile?.suspended) {
    return errorResponse(ERRORS.USER_SUSPENDED, 403);
  }

  // ── 3. Validación del body ──────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(
      makeError("VALIDATION_ERROR", "El body debe ser JSON válido"),
    );
  }
  const parsed = parsePostComment(body);
  if (!parsed.success) {
    return errorResponse(makeError("VALIDATION_ERROR", parsed.error));
  }
  const input = parsed.data;

  // ── 4. Rate limit (máx. 1 comentario / 30 s por usuario) ────
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentCount, error: rateError } = await supabaseAdmin
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .gte("created_at", since);
  if (rateError) {
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: "Error checking rate limit",
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }
  if ((recentCount ?? 0) >= 1) {
    return errorResponse(ERRORS.RATE_LIMITED, 429);
  }

  // ── 5. Transacción atómica: insertar comentario + acreditar ──
  const { data: txResult, error: txError } = await supabaseAdmin.rpc(
    "process_comment",
    {
      p_parking_id: input.parking_id,
      p_user_id: userId,
      p_body: input.body,
    },
  );

  if (txError) {
    const msg = txError.message ?? "";
    if (msg.includes("PARKING_NOT_FOUND")) {
      return errorResponse(ERRORS.PARKING_NOT_FOUND, 404);
    }
    if (msg.includes("PARKING_ARCHIVED")) {
      return errorResponse(ERRORS.PARKING_ARCHIVED, 422);
    }
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: msg,
      user_id: userId,
      parking_id: input.parking_id,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        comment_id: txResult?.comment_id ?? "",
        octanos_earned: Number(txResult?.octanos_earned ?? 0),
        action_type: txResult?.action_type ?? null,
        eligible: Boolean(txResult?.eligible),
        cap_reached: Boolean(txResult?.cap_reached),
      },
    }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
