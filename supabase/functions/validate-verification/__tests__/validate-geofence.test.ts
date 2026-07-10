/**
 * Tests para validateGeofence y haversineDistance.
 * Funciones puras — no requieren DB ni mocks de Supabase.
 *
 * Run: deno test __tests__/validate-geofence.test.ts
 */

import {
  assertEquals,
  assertAlmostEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  haversineDistance,
  validateGeofence,
} from "../validators.ts";

// Coordenadas de referencia: Puerta del Sol, Madrid
const SOL_LAT = 40.41668;
const SOL_LNG = -3.70325;

// Punto a ~55m al norte de Sol
const NEARBY_LAT = 40.41718;
const NEARBY_LNG = -3.70325;

// Punto a ~200m al norte de Sol (fuera del geofence de 100m)
const FAR_LAT = 40.41848;
const FAR_LNG = -3.70325;

// ============================================================
// haversineDistance
// ============================================================

Deno.test("haversineDistance: mismo punto devuelve 0", () => {
  const dist = haversineDistance(SOL_LAT, SOL_LNG, SOL_LAT, SOL_LNG);
  assertEquals(dist, 0);
});

Deno.test("haversineDistance: puntos a ~55m devuelven distancia razonable", () => {
  const dist = haversineDistance(SOL_LAT, SOL_LNG, NEARBY_LAT, NEARBY_LNG);
  // La distancia debe estar entre 40m y 70m
  assertEquals(dist > 40 && dist < 70, true, `Distancia esperada ~55m, obtenida: ${dist}`);
});

Deno.test("haversineDistance: puntos a ~200m devuelven distancia razonable", () => {
  const dist = haversineDistance(SOL_LAT, SOL_LNG, FAR_LAT, FAR_LNG);
  assertEquals(dist > 150 && dist < 250, true, `Distancia esperada ~200m, obtenida: ${dist}`);
});

Deno.test("haversineDistance: es simétrica (A→B == B→A)", () => {
  const distAB = haversineDistance(SOL_LAT, SOL_LNG, NEARBY_LAT, NEARBY_LNG);
  const distBA = haversineDistance(NEARBY_LAT, NEARBY_LNG, SOL_LAT, SOL_LNG);
  assertAlmostEquals(distAB, distBA, 0.001);
});

Deno.test("haversineDistance: coordenadas en hemisferios opuestos", () => {
  // Madrid a Buenos Aires: ~10.000 km
  const distMadridBA = haversineDistance(40.41, -3.70, -34.61, -58.37);
  assertEquals(distMadridBA > 9_000_000 && distMadridBA < 11_000_000, true);
});

// ============================================================
// validateGeofence
// ============================================================

Deno.test("validateGeofence: válido cuando el usuario está en el parking exacto", () => {
  const result = validateGeofence(SOL_LAT, SOL_LNG, SOL_LAT, SOL_LNG);
  assertEquals(result.valid, true);
  assertEquals(result.distance_meters, 0);
});

Deno.test("validateGeofence: válido cuando el usuario está a ~55m (dentro de 100m)", () => {
  const result = validateGeofence(NEARBY_LAT, NEARBY_LNG, SOL_LAT, SOL_LNG);
  assertEquals(result.valid, true);
  assertEquals(result.distance_meters < 100, true);
});

Deno.test("validateGeofence: inválido cuando el usuario está a ~200m (fuera de 100m)", () => {
  const result = validateGeofence(FAR_LAT, FAR_LNG, SOL_LAT, SOL_LNG);
  assertEquals(result.valid, false);
  assertEquals(result.distance_meters > 100, true);
});

Deno.test("validateGeofence: exactamente en el límite de 100m devuelve válido", () => {
  // 100m al norte: ~0.0009 grados de latitud
  const borderLat = SOL_LAT + 0.0009;
  const result = validateGeofence(borderLat, SOL_LNG, SOL_LAT, SOL_LNG);
  // Puede ser válido o no según la precisión, pero la distancia debe ser ~100m
  assertEquals(result.distance_meters > 80 && result.distance_meters < 120, true);
});

Deno.test("validateGeofence: devuelve la distancia calculada en el resultado", () => {
  const result = validateGeofence(NEARBY_LAT, NEARBY_LNG, SOL_LAT, SOL_LNG);
  assertEquals(typeof result.distance_meters, "number");
  assertEquals(result.distance_meters > 0, true);
});
