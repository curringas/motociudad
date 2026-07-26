/**
 * Edge Function: admin-delete-comment
 * Borra definitivamente (hard delete) 1..N comentarios y retira sus Octanos.
 * Solo admins. OpenSpec: changes/admin-comments-management · spec admin-comment-management.
 *
 * Flujo:
 * 1. Autenticar al llamante (JWT).
 * 2. Verificar que es admin y no está suspendido.
 * 3. Validar el body con Zod (commentIds: uuid[]).
 * 4. RPC admin_delete_comments con service_role: borra comentarios + octano_events
 *    y recalcula el caché de Octanos de los autores afectados.
 *
 * La escritura en octano_events ocurre solo dentro del RPC (regla #1).
 * NUNCA loguear tokens ni service_role_key.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { ERRORS, errorResponse, makeError } from "../_shared/errors.ts";
import { parseDeleteCommentsRequest } from "./schemas.ts";

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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(ERRORS.UNAUTHORIZED, 401);
  }
  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) {
    return errorResponse(makeError("INVALID_TOKEN", "Token de autenticación inválido"), 401);
  }

  const { data: caller, error: callerError } = await supabaseAdmin
    .from("users")
    .select("role, suspended")
    .eq("id", user.id)
    .single();
  if (callerError || !caller || caller.role !== "admin" || caller.suspended) {
    return errorResponse(ERRORS.FORBIDDEN, 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(makeError("VALIDATION_ERROR", "El body debe ser JSON válido"));
  }
  const parsed = parseDeleteCommentsRequest(body);
  if (!parsed.success) {
    return errorResponse(makeError("VALIDATION_ERROR", parsed.error));
  }

  const { data: txResult, error: txError } = await supabaseAdmin.rpc(
    "admin_delete_comments",
    { p_comment_ids: parsed.data.commentIds },
  );

  if (txError) {
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: txError.message ?? "",
      count: parsed.data.commentIds.length,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        deleted_comments: Number(txResult?.deleted_comments ?? 0),
        deleted_events: Number(txResult?.deleted_events ?? 0),
      },
    }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
