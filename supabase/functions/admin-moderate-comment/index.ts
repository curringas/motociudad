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
import { idsOf, parseModerateCommentRequest, STATUS_FOR_ACTION } from "./schemas.ts";

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
  const ids = idsOf(input);
  const newStatus = STATUS_FOR_ACTION[input.action];

  // ── 4. Aplicar la moderación a 1..N comentarios ─────────────
  // Cada moderate_comment es atómico y acredita Octanos al aprobar. Los ids que
  // ya no están pendientes se ignoran (idempotente en bloque); errores reales
  // de BD abortan.
  let processed = 0;
  let octanos = 0;
  let internalError = false;
  for (const id of ids) {
    const { data: txResult, error: txError } = await supabaseAdmin.rpc(
      "moderate_comment",
      { p_comment_id: id, p_new_status: newStatus },
    );
    if (txError) {
      const msg = txError.message ?? "";
      // NOT_PENDING / COMMENT_NOT_FOUND: se ignora en bloque (ya resuelto/borrado).
      if (msg.includes("NOT_PENDING") || msg.includes("COMMENT_NOT_FOUND")) continue;
      console.error(JSON.stringify({
        code: "DATABASE_ERROR",
        detail: msg,
        comment_id: id,
        timestamp: new Date().toISOString(),
      }));
      internalError = true;
      continue;
    }
    processed += 1;
    octanos += Number(txResult?.octanos_earned ?? 0);
  }

  if (internalError && processed === 0) {
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        processed,
        moderation_status: newStatus,
        octanos_earned: octanos,
      },
    }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
