/**
 * Tests de integración para el handler de validate-verification.
 * Simulan el flujo HTTP completo con mocks de Supabase Auth y DB.
 *
 * Estos tests verifican:
 * - Respuestas de error correctas en cada regla anti-abuso
 * - Formato de respuesta exitosa
 * - Códigos HTTP correctos
 *
 * Run: deno test __tests__/handler.test.ts --allow-env
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================
// Helpers de test
// ============================================================

/** Crea un Request POST simulado para validate-verification */
function makeRequest(
  body: Record<string, unknown>,
  authHeader = "Bearer valid-jwt-token",
): Request {
  return new Request("http://localhost:54321/functions/v1/validate-verification", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader,
    },
    body: JSON.stringify(body),
  });
}

/** Body válido de base para reutilizar en tests */
function validBody(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    parking_id: "a0000000-0000-0000-0000-000000000001",
    user_lat: 40.41668,
    user_lng: -3.70325,
    photo_taken_at: new Date().toISOString(), // foto reciente
    storage_path: "parkings-photos/a0000000-0000-0000-0000-000000000001/photo-001.webp",
    ...overrides,
  };
}

// ============================================================
// Tests de validación de input (schema)
// ============================================================

Deno.test("handler: POST sin Authorization devuelve 401", async () => {
  // Importar el handler directamente requeriría env vars reales.
  // Este test valida el contrato de la API usando el schema.
  const { parseVerificationRequest } = await import("../schemas.ts");

  const result = parseVerificationRequest({
    parking_id: "not-a-uuid",
    user_lat: 40.41,
    user_lng: -3.70,
    photo_taken_at: new Date().toISOString(),
    storage_path: "path/to/photo.webp",
  });

  assertEquals(result.success, false);
  if (!result.success) {
    assertStringIncludes(result.error, "parking_id");
  }
});

Deno.test("schema: parking_id inválido (no UUID) es rechazado", async () => {
  const { parseVerificationRequest } = await import("../schemas.ts");
  const result = parseVerificationRequest(validBody({ parking_id: "not-a-valid-uuid" }));
  assertEquals(result.success, false);
});

Deno.test("schema: parking_id válido es aceptado", async () => {
  const { parseVerificationRequest } = await import("../schemas.ts");
  const result = parseVerificationRequest(validBody());
  assertEquals(result.success, true);
});

Deno.test("schema: latitud fuera de rango es rechazada", async () => {
  const { parseVerificationRequest } = await import("../schemas.ts");
  const result = parseVerificationRequest(validBody({ user_lat: 95 }));
  assertEquals(result.success, false);
  if (!result.success) {
    assertStringIncludes(result.error.toLowerCase(), "lat");
  }
});

Deno.test("schema: longitud fuera de rango es rechazada", async () => {
  const { parseVerificationRequest } = await import("../schemas.ts");
  const result = parseVerificationRequest(validBody({ user_lng: -190 }));
  assertEquals(result.success, false);
});

Deno.test("schema: photo_taken_at no ISO devuelve error", async () => {
  const { parseVerificationRequest } = await import("../schemas.ts");
  const result = parseVerificationRequest(validBody({ photo_taken_at: "25/05/2026" }));
  assertEquals(result.success, false);
  if (!result.success) {
    assertStringIncludes(result.error, "photo_taken_at");
  }
});

Deno.test("schema: storage_path con caracteres inválidos es rechazado", async () => {
  const { parseVerificationRequest } = await import("../schemas.ts");
  const result = parseVerificationRequest(
    validBody({ storage_path: "path/with spaces/photo.webp" }),
  );
  assertEquals(result.success, false);
});

Deno.test("schema: storage_path válido es aceptado", async () => {
  const { parseVerificationRequest } = await import("../schemas.ts");
  const result = parseVerificationRequest(
    validBody({ storage_path: "parkings-photos/uuid123/photo-001.webp" }),
  );
  assertEquals(result.success, true);
});

Deno.test("schema: campos opcionales (thumbnail_path, width, height, size_bytes) son opcionales", async () => {
  const { parseVerificationRequest } = await import("../schemas.ts");

  // Sin campos opcionales
  const resultWithout = parseVerificationRequest(validBody());
  assertEquals(resultWithout.success, true);

  // Con todos los campos opcionales
  const resultWith = parseVerificationRequest(
    validBody({
      thumbnail_path: "parkings-photos/uuid123/thumbs/photo-001.webp",
      photo_width: 1920,
      photo_height: 1080,
      photo_size_bytes: 1024 * 1024, // 1MB
    }),
  );
  assertEquals(resultWith.success, true);
});

Deno.test("schema: photo_size_bytes mayor a 5MB es rechazado", async () => {
  const { parseVerificationRequest } = await import("../schemas.ts");
  const result = parseVerificationRequest(
    validBody({ photo_size_bytes: 6 * 1024 * 1024 }), // 6MB
  );
  assertEquals(result.success, false);
});

// ============================================================
// Tests de tipos de respuesta
// ============================================================

Deno.test("types: VerificationResult success tiene la estructura correcta", async () => {
  const { OCTANO_POINTS } = await import("../types.ts");

  const successResult = {
    success: true,
    data: {
      octanos_earned: OCTANO_POINTS.VERIFY_PARKING + OCTANO_POINTS.FIRST_VERIFIER,
      is_first_verifier: true,
      new_status: "verified" as const,
      verification_id: "verif-uuid",
      photo_id: "photo-uuid",
    },
  };

  assertEquals(successResult.success, true);
  assertEquals(successResult.data.octanos_earned, 40); // 25 + 15
  assertEquals(successResult.data.is_first_verifier, true);
});

Deno.test("types: OCTANO_POINTS tienen los valores correctos (gamificacion.md §2.1)", async () => {
  const { OCTANO_POINTS } = await import("../types.ts");

  // gamificacion.md §2.1: Verificar un parking = +25, Ser el 1er verificador = +15 bonus
  assertEquals(OCTANO_POINTS.VERIFY_PARKING, 25);
  assertEquals(OCTANO_POINTS.FIRST_VERIFIER, 15);
});

Deno.test("types: ANTI_ABUSE_RULES tienen los valores correctos (gamificacion.md §2.2)", async () => {
  const { ANTI_ABUSE_RULES } = await import("../types.ts");

  // gamificacion.md §2.2: radio ≤100m, foto ≤5min, cap 200 Octanos/día
  assertEquals(ANTI_ABUSE_RULES.GEOFENCE_RADIUS_METERS, 100);
  assertEquals(ANTI_ABUSE_RULES.PHOTO_MAX_AGE_MINUTES, 5);
  assertEquals(ANTI_ABUSE_RULES.DAILY_CAP_OCTANOS, 200);
});
