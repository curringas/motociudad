/**
 * Edge Function: admin-set-role
 * Cambia el rol y/o el estado de suspensión de un usuario. Solo admins.
 *
 * Flujo:
 * 1. Autenticar al llamante (JWT).
 * 2. Verificar que el llamante es admin y no está suspendido.
 * 3. Validar el body con Zod (userId + role y/o suspended).
 * 4. Impedir que un admin se modifique a sí mismo (evita auto-bloqueo).
 * 5. Actualizar role/suspended del usuario objetivo con service_role
 *    (el trigger de users solo permite el cambio en contexto service_role).
 *
 * NUNCA loguear tokens ni service_role_key.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { errorResponse, makeError, ERRORS } from "../_shared/errors.ts";
import { parseSetRoleRequest } from "./schemas.ts";

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
  const parsed = parseSetRoleRequest(body);
  if (!parsed.success) {
    return errorResponse(makeError("VALIDATION_ERROR", parsed.error));
  }
  const input = parsed.data;

  // ── 4. No auto-modificación (evita auto-bloqueo) ────────────
  if (input.userId === callerId) {
    return errorResponse(
      makeError("FORBIDDEN", "No puedes cambiar tu propio rol ni tu suspensión"),
      403,
    );
  }

  // ── 5. El usuario objetivo debe existir ─────────────────────
  const { data: target, error: targetError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", input.userId)
    .single();
  if (targetError || !target) {
    return errorResponse(ERRORS.USER_NOT_FOUND, 404);
  }

  // ── 6. Construir y aplicar la actualización ─────────────────
  const update: Record<string, unknown> = {};
  if (input.role !== undefined) {
    update.role = input.role;
  }
  if (input.suspended !== undefined) {
    update.suspended = input.suspended;
    update.suspended_at = input.suspended ? new Date().toISOString() : null;
    update.suspended_reason = input.suspended ? (input.suspendedReason ?? null) : null;
  }

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update(update as never)
    .eq("id", input.userId);
  if (updateError) {
    return errorResponse(
      makeError("DATABASE_ERROR", "No se pudo actualizar el usuario", updateError.message),
      500,
    );
  }

  return new Response(
    JSON.stringify({ success: true, data: { userId: input.userId, ...update } }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
