/**
 * Edge Function: propose-parking
 * Crea un parking nuevo y registra el evento Octanos correspondiente.
 *
 * Flujo:
 * 1. Autenticar usuario (JWT)
 * 2. Validar body con Zod
 * 3. Insertar parking con service_role
 * 4. Insertar octano_event propose_parking (+50 pts, status=pending)
 * 5. Si se aportó photo_storage_path, insertar parking_photos
 * 6. Devolver { id, octanos_earned }
 *
 * NUNCA loguear tokens ni service_role_key.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { errorResponse, makeError, ERRORS } from "../_shared/errors.ts";
import { parseProposeParkingRequest } from "./schemas.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OCTANOS_PROPOSE_PARKING = 50;

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
    console.error(JSON.stringify({
      code: "INVALID_TOKEN",
      detail: authError?.message ?? "No user",
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(makeError("INVALID_TOKEN", "Token de autenticación inválido"), 401);
  }

  const userId = user.id;

  // ── 2. Validación del body ──────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(makeError("VALIDATION_ERROR", "El body debe ser JSON válido"));
  }

  const parsed = parseProposeParkingRequest(body);
  if (!parsed.success) {
    return errorResponse(makeError("VALIDATION_ERROR", parsed.error));
  }

  const input = parsed.data;

  // ── 3. Insertar parking ──────────────────────────────────────
  const { data: parking, error: parkingError } = await supabaseAdmin
    .from("parkings")
    .insert({
      name: input.name,
      type: input.type,
      location: `POINT(${input.longitude} ${input.latitude})`,
      city: input.city,
      capacity: input.capacity ?? null,
      features: input.features ?? {},
      notes: input.notes ?? null,
      proposed_by: userId,
    } as never)
    .select("id")
    .single();

  if (parkingError || !parking) {
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: parkingError?.message ?? "No data returned",
      user_id: userId,
      timestamp: new Date().toISOString(),
    }));
    return errorResponse(ERRORS.INTERNAL_ERROR, 500);
  }

  const parkingId: string = parking.id;

  // ── 4. Registrar evento Octanos (propose_parking, pending) ──
  const { error: octanoError } = await supabaseAdmin
    .from("octano_events")
    .insert({
      user_id: userId,
      action_type: "propose_parking",
      points: OCTANOS_PROPOSE_PARKING,
      reference_id: parkingId,
      reference_type: "parking",
      status: "pending",
    });

  if (octanoError) {
    // El parking ya fue creado; logamos el fallo pero no revertimos
    console.error(JSON.stringify({
      code: "DATABASE_ERROR",
      detail: `octano_event insert failed: ${octanoError.message}`,
      user_id: userId,
      parking_id: parkingId,
      timestamp: new Date().toISOString(),
    }));
  }

  // ── 5. Insertar foto si se proporcionó ──────────────────────
  if (input.photo_storage_path) {
    const { error: photoError } = await supabaseAdmin
      .from("parking_photos")
      .insert({
        parking_id: parkingId,
        uploaded_by: userId,
        storage_path: input.photo_storage_path,
        is_primary: true,
        is_verification: false,
      });

    if (photoError) {
      console.error(JSON.stringify({
        code: "DATABASE_ERROR",
        detail: `parking_photos insert failed: ${photoError.message}`,
        user_id: userId,
        parking_id: parkingId,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  // ── 6. Respuesta ────────────────────────────────────────────
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        id: parkingId,
        octanos_earned: OCTANOS_PROPOSE_PARKING,
      },
    }),
    {
      status: 201,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    },
  );
});
