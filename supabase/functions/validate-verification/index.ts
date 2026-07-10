/**
 * Edge Function: validate-verification
 * Valida y registra la verificación in situ de un parking de moto.
 *
 * Flujo:
 * 1. Autenticar usuario (JWT)
 * 2. Validar schema del body (Zod)
 * 3. Obtener datos del parking
 * 4. Ejecutar reglas anti-abuso en orden fail-fast
 * 5. En transacción: insertar foto + verificación + octano_events + actualizar parking
 *
 * Reglas anti-abuso (gamificacion.md §2.2):
 * - GEOFENCE_FAIL: usuario > 100m del parking
 * - STALE_PHOTO: foto tomada hace > 5 minutos
 * - SELF_VERIFICATION_FORBIDDEN: es el proponente
 * - ALREADY_VERIFIED: ya verificó este parking
 * - DAILY_CAP_REACHED: >= 200 octanos confirmados hoy
 *
 * NUNCA loguear tokens, contraseñas ni service_role_key.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { ERRORS, errorResponse, makeError } from "../_shared/errors.ts";
import { parseVerificationRequest } from "./schemas.ts";
import {
  isFirstVerifier,
  validateDailyCap,
  validateGeofence,
  validateNotAlreadyVerified,
  validateNotSelfVerification,
  validatePhotoFreshness,
} from "./validators.ts";
import { OCTANO_POINTS, VerificationResult } from "./types.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight CORS
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

  // ── 2. Validación del body ──────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(
      makeError("VALIDATION_ERROR", "El body debe ser JSON válido"),
    );
  }

  const parsed = parseVerificationRequest(body);
  if (!parsed.success) {
    return errorResponse(
      makeError("VALIDATION_ERROR", parsed.error),
    );
  }

  const input = parsed.data;

  // ── 3. Obtener datos del parking ────────────────────────────
  const { data: parking, error: parkingError } = await supabaseAdmin
    .from("parkings")
    .select("id, proposed_by, status, location")
    .eq("id", input.parking_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (parkingError || !parking) {
    console.error(JSON.stringify({
      code: "PARKING_NOT_FOUND",
      parking_id: input.parking_id,
      user_id: userId,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.PARKING_NOT_FOUND, 404);
  }

  if (parking.status === "archived" || parking.status === "rejected") {
    return errorResponse(
      makeError(
        "PARKING_ARCHIVED",
        "Este parking no está disponible para verificaciones",
      ),
      422,
    );
  }

  // Extraer coordenadas del campo geography de PostGIS
  // Supabase devuelve el campo geography como GeoJSON
  let parkingLat: number;
  let parkingLng: number;

  if (parking.location && typeof parking.location === "object") {
    // GeoJSON Point: { type: "Point", coordinates: [lng, lat] }
    const coords = (parking.location as { coordinates?: [number, number] }).coordinates;
    if (coords) {
      parkingLng = coords[0];
      parkingLat = coords[1];
    } else {
      return errorResponse(ERRORS.INTERNAL_ERROR, 500);
    }
  } else {
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  // ── 4. Reglas anti-abuso (fail-fast) ────────────────────────

  // Regla 1: GEOFENCE_FAIL
  const geofence = validateGeofence(
    input.user_lat,
    input.user_lng,
    parkingLat,
    parkingLng,
  );
  if (!geofence.valid) {
    console.error(JSON.stringify({
      code: "GEOFENCE_FAIL",
      user_id: userId,
      parking_id: input.parking_id,
      distance_meters: geofence.distance_meters,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.GEOFENCE_FAIL, 422);
  }

  // Regla 2: STALE_PHOTO
  if (!validatePhotoFreshness(input.photo_taken_at)) {
    console.error(JSON.stringify({
      code: "STALE_PHOTO",
      user_id: userId,
      parking_id: input.parking_id,
      photo_taken_at: input.photo_taken_at,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.STALE_PHOTO, 422);
  }

  // Regla 3: SELF_VERIFICATION_FORBIDDEN
  if (!validateNotSelfVerification(userId, { ...parking, location_lat: parkingLat, location_lng: parkingLng })) {
    console.error(JSON.stringify({
      code: "SELF_VERIFICATION_FORBIDDEN",
      user_id: userId,
      parking_id: input.parking_id,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.SELF_VERIFICATION_FORBIDDEN, 422);
  }

  // Regla 4: ALREADY_VERIFIED
  try {
    const notAlreadyVerified = await validateNotAlreadyVerified(
      supabaseAdmin,
      input.parking_id,
      userId,
    );
    if (!notAlreadyVerified) {
      return errorResponse(ERRORS.ALREADY_VERIFIED, 422);
    }
  } catch (err) {
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: "Error checking existing verification",
      user_id: userId,
      parking_id: input.parking_id,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  // Regla 5: DAILY_CAP_REACHED
  try {
    const underDailyCap = await validateDailyCap(supabaseAdmin, userId);
    if (!underDailyCap) {
      return errorResponse(ERRORS.DAILY_CAP_REACHED, 422);
    }
  } catch (err) {
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: "Error checking daily cap",
      user_id: userId,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  // ── 5. Determinar si es primer verificador ─────────────────
  let isFirst = false;
  try {
    isFirst = await isFirstVerifier(supabaseAdmin, input.parking_id);
  } catch (err) {
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: "Error checking first verifier",
      user_id: userId,
      parking_id: input.parking_id,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  // ── 6. Transacción: insertar foto, verificación, octano_events ──
  // Supabase no expone transacciones directamente en el cliente,
  // usamos una RPC que ejecuta el bloque atómico en PostgreSQL.
  const { data: txResult, error: txError } = await supabaseAdmin.rpc(
    "process_parking_verification",
    {
      p_parking_id: input.parking_id,
      p_user_id: userId,
      p_user_lat: input.user_lat,
      p_user_lng: input.user_lng,
      p_distance_meters: geofence.distance_meters,
      p_storage_path: input.storage_path,
      p_thumbnail_path: input.thumbnail_path ?? null,
      p_photo_width: input.photo_width ?? null,
      p_photo_height: input.photo_height ?? null,
      p_photo_size_bytes: input.photo_size_bytes ?? null,
      p_is_first_verifier: isFirst,
    },
  );

  if (txError) {
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: txError.message,
      user_id: userId,
      parking_id: input.parking_id,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  const octanos_earned = isFirst
    ? OCTANO_POINTS.VERIFY_PARKING + OCTANO_POINTS.FIRST_VERIFIER
    : OCTANO_POINTS.VERIFY_PARKING;

  const result: VerificationResult = {
    success: true,
    data: {
      octanos_earned,
      is_first_verifier: isFirst,
      new_status: parking.status === "pending" ? "verified" : parking.status as "verified",
      verification_id: txResult?.verification_id ?? "",
      photo_id: txResult?.photo_id ?? "",
    },
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
