/**
 * Tests para validatePhotoFreshness y validateNotSelfVerification.
 * Funciones puras — no requieren DB.
 *
 * Run: deno test __tests__/validate-cooldown.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  validatePhotoFreshness,
  validateNotSelfVerification,
} from "../validators.ts";
import type { ParkingData } from "../types.ts";

// ============================================================
// validatePhotoFreshness (Regla 2: STALE_PHOTO)
// ============================================================

const NOW = new Date("2026-05-25T12:00:00Z");

Deno.test("validatePhotoFreshness: foto tomada ahora mismo es válida", () => {
  const photoTakenAt = NOW.toISOString();
  assertEquals(validatePhotoFreshness(photoTakenAt, NOW), true);
});

Deno.test("validatePhotoFreshness: foto tomada hace 1 minuto es válida", () => {
  const oneMinAgo = new Date(NOW.getTime() - 60_000);
  assertEquals(validatePhotoFreshness(oneMinAgo.toISOString(), NOW), true);
});

Deno.test("validatePhotoFreshness: foto tomada hace 4m59s es válida", () => {
  const almostFiveMin = new Date(NOW.getTime() - (5 * 60 * 1000 - 1000));
  assertEquals(validatePhotoFreshness(almostFiveMin.toISOString(), NOW), true);
});

Deno.test("validatePhotoFreshness: foto tomada hace exactamente 5 minutos es válida", () => {
  const fiveMinAgo = new Date(NOW.getTime() - 5 * 60 * 1000);
  assertEquals(validatePhotoFreshness(fiveMinAgo.toISOString(), NOW), true);
});

Deno.test("validatePhotoFreshness: foto tomada hace 5m01s es inválida (stale)", () => {
  const stale = new Date(NOW.getTime() - (5 * 60 * 1000 + 1000));
  assertEquals(validatePhotoFreshness(stale.toISOString(), NOW), false);
});

Deno.test("validatePhotoFreshness: foto tomada hace 10 minutos es inválida", () => {
  const tenMinAgo = new Date(NOW.getTime() - 10 * 60 * 1000);
  assertEquals(validatePhotoFreshness(tenMinAgo.toISOString(), NOW), false);
});

Deno.test("validatePhotoFreshness: foto del futuro (> 30s) es inválida", () => {
  const future = new Date(NOW.getTime() + 60_000); // 1 minuto en el futuro
  assertEquals(validatePhotoFreshness(future.toISOString(), NOW), false);
});

Deno.test("validatePhotoFreshness: foto del futuro por debajo del drift de reloj (< 30s) es válida", () => {
  const slightFuture = new Date(NOW.getTime() + 15_000); // 15 segundos en el futuro
  assertEquals(validatePhotoFreshness(slightFuture.toISOString(), NOW), true);
});

Deno.test("validatePhotoFreshness: timestamp inválido devuelve false", () => {
  assertEquals(validatePhotoFreshness("not-a-date", NOW), false);
  assertEquals(validatePhotoFreshness("", NOW), false);
  assertEquals(validatePhotoFreshness("2026-13-45T99:99:99Z", NOW), false);
});

// ============================================================
// validateNotSelfVerification (Regla 3: SELF_VERIFICATION_FORBIDDEN)
// ============================================================

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makeParkingData(proposedBy: string): ParkingData {
  return {
    id: "parking-id-1",
    proposed_by: proposedBy,
    status: "pending",
    location_lat: 40.41,
    location_lng: -3.70,
  };
}

Deno.test("validateNotSelfVerification: válido cuando el verificador es distinto al proponente", () => {
  const parking = makeParkingData(USER_A);
  assertEquals(validateNotSelfVerification(USER_B, parking), true);
});

Deno.test("validateNotSelfVerification: inválido cuando el verificador es el proponente", () => {
  const parking = makeParkingData(USER_A);
  assertEquals(validateNotSelfVerification(USER_A, parking), false);
});

Deno.test("validateNotSelfVerification: compara por valor exacto de UUID", () => {
  const parking = makeParkingData(USER_A);
  // UUID con mayúsculas/minúsculas diferente
  const upperA = USER_A.toUpperCase();
  // En JS los UUIDs se comparan como strings — debe ser case-sensitive
  // (en la práctica Supabase siempre devuelve minúsculas, pero verificamos el comportamiento)
  assertEquals(
    validateNotSelfVerification(upperA, parking),
    upperA !== USER_A, // Si son distintos strings, retorna true
  );
});

Deno.test("validateNotSelfVerification: parking verificado por otro usuario también es válido", () => {
  const parking = makeParkingData(USER_A);
  parking.status = "verified";
  assertEquals(validateNotSelfVerification(USER_B, parking), true);
});
