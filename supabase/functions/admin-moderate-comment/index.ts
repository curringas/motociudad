/**
 * Edge Function: admin-moderate-comment
 * Aprueba o rechaza un comentario en pending_review. Solo admins.
 * OpenSpec: changes/ai-comment-moderation · spec comment-moderation (D8).
 *
 * Flujo:
 * 1. Autenticar al llamante (JWT).
 * 2. Verificar que el llamante es admin y no está suspendido.
 * 3. Validar el body con Zod (commentId + action approve|reject).
 * 4. RPC moderate_comment con service_role: cambia el estado y, al aprobar,
 *    evalúa y acredita la escalera de Octanos en ese momento (D3).
 *
 * La escritura de octano_events ocurre solo dentro del RPC (regla #1).
 * NUNCA loguear tokens ni service_role_key.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { ERRORS, errorResponse, makeError } from "../_shared/errors.ts";
import { parseModerateCommentRequest, STATUS_FOR_ACTION } from "./schemas.ts";

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
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) {
    return errorResponse(makeError("INVALID_TOKEN", "Token de autenticación inválido"), 401);
  }
  const callerId = user.id;

  // ── 2. El llamante debe ser admin activo ────────────────────
  const { data: caller, error: callerError } = await supabaseAdmin
    .from("users")
    .select("role, suspended")
    .eq("id", callerId)
    .single();
  if (callerError || !caller || caller.role !== "admin" || caller.suspended) {
    return errorResponse(ERRORS.FORBIDDEN, 403);
  }

  // ── 3. Validación del body ──────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(makeError("VALIDATION_ERROR", "El body debe ser JSON válido"));
  }
  const parsed = parseModerateCommentRequest(body);
  if (!parsed.success) {
    return errorResponse(makeError("VALIDATION_ERROR", parsed.error));
  }
  const input = parsed.data;

  // ── 4. Aplicar la moderación (atómica, acredita al aprobar) ──
  const { data: txResult, error: txError } = await supabaseAdmin.rpc(
    "moderate_comment",
    {
      p_comment_id: input.commentId,
      p_new_status: STATUS_FOR_ACTION[input.action],
    },
  );

  if (txError) {
    const msg = txError.message ?? "";
    if (msg.includes("COMMENT_NOT_FOUND")) {
      return errorResponse(ERRORS.COMMENT_NOT_FOUND, 404);
    }
    if (msg.includes("NOT_PENDING")) {
      return errorResponse(
        makeError("NOT_PENDING", "El comentario no está pendiente de revisión"),
        409,
      );
    }
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: msg,
      comment_id: input.commentId,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        comment_id: txResult?.comment_id ?? input.commentId,
        moderation_status: txResult?.moderation_status ?? STATUS_FOR_ACTION[input.action],
        octanos_earned: Number(txResult?.octanos_earned ?? 0),
        action_type: txResult?.action_type ?? null,
      },
    }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
