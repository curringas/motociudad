/**
 * Edge Function: propose-parking
 * Crea un parking nuevo, lo verifica con el agente de IA "Otto" y registra los
 * Octanos correspondientes.
 *
 * Flujo:
 * 1. Autenticar usuario (JWT)
 * 2. Validar body con Zod
 * 3. Otto revisa la aportación (nombre + notas + foto) -> approved|flagged|rejected
 * 4. Insertar parking con service_role fijando ai_review_status
 * 5. Solo si Otto aprueba: insertar octano_event propose_parking (+50, pending)
 * 6. Si se aportó photo_storage_path, insertar parking_photos
 * 7. Si flagged/rejected: avisar al admin por email (best-effort)
 * 8. Devolver { id, ai_review_status, octanos_earned, review_reason }
 *
 * NUNCA loguear tokens ni service_role_key.
 * OpenSpec: changes/otto-parking-verification · spec propose-parking / otto-parking-verification
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { errorResponse, makeError, ERRORS } from "../_shared/errors.ts";
import { parseProposeParkingRequest } from "./schemas.ts";
import { reviewParking } from "../_shared/otto.ts";
import { sendOttoAdminEmail } from "../_shared/email.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OCTANOS_PROPOSE_PARKING = 50;
const PHOTO_BUCKET = "parkings-photos";

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

  // ── 1b. La cuenta no debe estar suspendida ──────────────────
  const { data: proposer } = await supabaseAdmin
    .from("users")
    .select("suspended")
    .eq("id", userId)
    .single();
  if (proposer?.suspended) {
    return errorResponse(ERRORS.USER_SUSPENDED, 403);
  }

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

  // ── 3. Revisión de Otto (visión + texto) ────────────────────
  // La foto (si la hay) ya está subida al bucket público; le pasamos su URL.
  const photoUrl = input.photo_storage_path
    ? supabaseAdmin.storage.from(PHOTO_BUCKET).getPublicUrl(input.photo_storage_path)
        .data.publicUrl
    : null;

  // reviewParking nunca lanza: ante fallo devuelve failsafe -> flagged.
  const review = await reviewParking({
    name: input.name,
    notes: input.notes ?? null,
    photoUrl,
  });

  // ── 4. Insertar parking fijando el veredicto de Otto ────────
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
      ai_review_status: review.status,
      ai_review_reason: review.reason_es || null,
      ai_reviewed_at: new Date().toISOString(),
      ai_review_source: review.source === "bypass" ? null : review.source,
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

  // ── 5. Octanos SOLO si Otto aprueba (entra al pipeline público) ──
  const approved = review.status === "approved";
  if (approved) {
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
  }

  // ── 6. Insertar foto si se proporcionó ──────────────────────
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

  // ── 7. Aviso al admin por email en dudosos/rechazados (best-effort) ──
  if (review.status === "flagged" || review.status === "rejected") {
    // No rompe la respuesta ni el veredicto: sendOttoAdminEmail nunca lanza.
    await sendOttoAdminEmail({
      parkingId,
      name: input.name,
      city: input.city,
      status: review.status,
      reason: review.reason_es,
      proposedBy: userId,
    });
  }

  // ── 8. Respuesta con el veredicto de Otto ───────────────────
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        id: parkingId,
        ai_review_status: review.status,
        octanos_earned: approved ? OCTANOS_PROPOSE_PARKING : 0,
        review_reason: review.reason_es,
      },
    }),
    {
      status: 201,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    },
  );
});
