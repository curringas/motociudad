/**
 * Edge Function: admin-approve-parking
 * Aprueba un parking que Otto marcó 'flagged'. Solo admins.
 * OpenSpec: changes/otto-parking-verification · spec admin-parking-management (D7).
 *
 * Flujo:
 * 1. Autenticar al llamante (JWT).
 * 2. Verificar que el llamante es admin y no está suspendido.
 * 3. Validar el body con Zod (parkingId).
 * 4. RPC approve_flagged_parking con service_role: publica el parking y otorga
 *    los +50 Octanos pendientes de forma idempotente (regla #1: octano_events
 *    solo dentro del RPC).
 *
 * NUNCA loguear tokens ni service_role_key.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { ERRORS, errorResponse, makeError } from "../_shared/errors.ts";
import { parseApproveParkingRequest } from "./schemas.ts";

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
  const parsed = parseApproveParkingRequest(body);
  if (!parsed.success) {
    return errorResponse(makeError("VALIDATION_ERROR", parsed.error));
  }

  // ── 4. Aprobar (atómico + idempotente en Octanos) ───────────
  const { data: txResult, error: txError } = await supabaseAdmin.rpc(
    "approve_flagged_parking",
    { p_parking_id: parsed.data.parkingId },
  );

  if (txError) {
    const msg = txError.message ?? "";
    if (msg.includes("PARKING_NOT_FOUND")) {
      return errorResponse(makeError("NOT_FOUND", "El parking no existe"), 404);
    }
    if (msg.includes("NOT_FLAGGED")) {
      return errorResponse(
        makeError("NOT_FLAGGED", "El parking no está pendiente de revisión (dudoso)"),
        409,
      );
    }
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: msg,
      parking_id: parsed.data.parkingId,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        ai_review_status: "approved",
        octanos_earned: Number(txResult?.octanos_earned ?? 0),
      },
    }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
