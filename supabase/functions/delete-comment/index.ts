/**
 * Edge Function: delete-comment
 * Soft-delete de un comentario por su autor. No revierte Octanos ya acreditados.
 *
 * Flujo:
 * 1. Autenticar usuario (JWT)
 * 2. Cuenta no suspendida
 * 3. Validar body con Zod (comment_id)
 * 4. RPC soft_delete_comment: solo el autor puede borrar (FORBIDDEN si no lo es).
 *
 * NUNCA loguear tokens ni service_role_key.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { ERRORS, errorResponse, makeError } from "../_shared/errors.ts";
import { parseDeleteComment } from "./schemas.ts";

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

  // ── 2. Cuenta activa ────────────────────────────────────────
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
  const parsed = parseDeleteComment(body);
  if (!parsed.success) {
    return errorResponse(makeError("VALIDATION_ERROR", parsed.error));
  }
  const input = parsed.data;

  // ── 4. Soft-delete (solo autor) ─────────────────────────────
  const { data: txResult, error: txError } = await supabaseAdmin.rpc(
    "soft_delete_comment",
    {
      p_comment_id: input.comment_id,
      p_user_id: userId,
    },
  );

  if (txError) {
    const msg = txError.message ?? "";
    if (msg.includes("COMMENT_NOT_FOUND")) {
      return errorResponse(ERRORS.COMMENT_NOT_FOUND, 404);
    }
    if (msg.includes("FORBIDDEN")) {
      return errorResponse(ERRORS.FORBIDDEN, 403);
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
        comment_id: txResult?.comment_id ?? input.comment_id,
        deleted: Boolean(txResult?.deleted),
      },
    }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
