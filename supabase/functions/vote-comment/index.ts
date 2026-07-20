/**
 * Edge Function: vote-comment
 * Registra un voto (+1/-1) sobre un comentario y acredita el bonus de calidad.
 *
 * Flujo:
 * 1. Autenticar usuario (JWT)
 * 2. Email confirmado + cuenta no suspendida
 * 3. Validar body con Zod (comment_id, value ∈ {-1,1})
 * 4. RPC atómica process_comment_vote: upsert voto + useful_comment (+5) al autor
 *    la primera vez que el comentario alcanza ≥2 upvotes netos (idempotente).
 *
 * El bonus va al AUTOR del comentario (no al votante). NUNCA loguear tokens.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { ERRORS, errorResponse, makeError } from "../_shared/errors.ts";
import { parseVoteComment } from "./schemas.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  const parsed = parseVoteComment(body);
  if (!parsed.success) {
    return errorResponse(makeError("VALIDATION_ERROR", parsed.error));
  }
  const input = parsed.data;

  // ── 4. Transacción atómica: voto + posible useful_comment ───
  const { data: txResult, error: txError } = await supabaseAdmin.rpc(
    "process_comment_vote",
    {
      p_comment_id: input.comment_id,
      p_user_id: userId,
      p_value: input.value,
    },
  );

  if (txError) {
    const msg = txError.message ?? "";
    if (msg.includes("COMMENT_NOT_FOUND")) {
      return errorResponse(ERRORS.COMMENT_NOT_FOUND, 404);
    }
    if (msg.includes("SELF_VOTE_FORBIDDEN")) {
      return errorResponse(ERRORS.SELF_VOTE_FORBIDDEN, 422);
    }
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: msg,
      user_id: userId,
      comment_id: input.comment_id,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        upvotes_count: Number(txResult?.upvotes_count ?? 0),
        net_score: Number(txResult?.net_score ?? 0),
        octanos_earned: Number(txResult?.octanos_earned ?? 0),
      },
    }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
