/**
 * Tests para validateDailyCap y validateNotAlreadyVerified.
 * Estas funciones dependen de la DB, así que usamos mocks del cliente Supabase.
 *
 * Run: deno test __tests__/validate-daily-cap.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  validateDailyCap,
  validateNotAlreadyVerified,
} from "../validators.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// ============================================================
// Helpers: mock del cliente Supabase
// ============================================================

/** Crea un mock de cliente Supabase que devuelve los datos dados */
function mockSupabaseOctanoEvents(
  octanoEvents: Array<{ points: number }>,
  error: Error | null = null,
): Partial<SupabaseClient> {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          eq: (_col2: string, _val2: unknown) => ({
            gte: (_col3: string, _val3: unknown) => Promise.resolve({
              data: error ? null : octanoEvents,
              error: error ? { message: error.message } : null,
            }),
          }),
        }),
      }),
    }),
  } as unknown as Partial<SupabaseClient>;
}

function mockSupabaseVerifications(
  existing: { id: string } | null,
  error: Error | null = null,
): Partial<SupabaseClient> {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          eq: (_col2: string, _val2: unknown) => ({
            maybeSingle: () => Promise.resolve({
              data: error ? null : existing,
              error: error ? { message: error.message } : null,
            }),
          }),
        }),
      }),
    }),
  } as unknown as Partial<SupabaseClient>;
}

const PARKING_ID = "park-id-0000-0000-0000-000000000001";
const USER_ID = "user-id-0000-0000-0000-000000000001";

// ============================================================
// validateDailyCap (Regla 5: DAILY_CAP_REACHED)
// ============================================================

Deno.test("validateDailyCap: OK cuando el usuario tiene 0 octanos hoy", async () => {
  const client = mockSupabaseOctanoEvents([]);
  const result = await validateDailyCap(client as SupabaseClient, USER_ID);
  assertEquals(result, true);
});

Deno.test("validateDailyCap: OK cuando el usuario tiene 199 octanos hoy", async () => {
  const events = [{ points: 100 }, { points: 50 }, { points: 49 }];
  const client = mockSupabaseOctanoEvents(events);
  const result = await validateDailyCap(client as SupabaseClient, USER_ID);
  assertEquals(result, true);
});

Deno.test("validateDailyCap: FAIL cuando el usuario tiene exactamente 200 octanos hoy", async () => {
  const events = [{ points: 100 }, { points: 100 }];
  const client = mockSupabaseOctanoEvents(events);
  const result = await validateDailyCap(client as SupabaseClient, USER_ID);
  assertEquals(result, false);
});

Deno.test("validateDailyCap: FAIL cuando el usuario tiene más de 200 octanos hoy", async () => {
  const events = [{ points: 150 }, { points: 100 }]; // 250 total
  const client = mockSupabaseOctanoEvents(events);
  const result = await validateDailyCap(client as SupabaseClient, USER_ID);
  assertEquals(result, false);
});

Deno.test("validateDailyCap: lanza error cuando la DB falla", async () => {
  const client = mockSupabaseOctanoEvents([], new Error("DB connection failed"));
  await assertRejects(
    () => validateDailyCap(client as SupabaseClient, USER_ID),
    Error,
    "Error checking daily cap",
  );
});

Deno.test("validateDailyCap: maneja puntos nulos en eventos (no rompe la suma)", async () => {
  // En teoría no deberían existir, pero defensividad
  const events = [{ points: 100 }, { points: 0 }];
  const client = mockSupabaseOctanoEvents(events);
  const result = await validateDailyCap(client as SupabaseClient, USER_ID);
  assertEquals(result, true); // 100 < 200
});

// ============================================================
// validateNotAlreadyVerified (Regla 4: ALREADY_VERIFIED)
// ============================================================

Deno.test("validateNotAlreadyVerified: OK cuando no existe verificación previa", async () => {
  const client = mockSupabaseVerifications(null);
  const result = await validateNotAlreadyVerified(
    client as SupabaseClient,
    PARKING_ID,
    USER_ID,
  );
  assertEquals(result, true);
});

Deno.test("validateNotAlreadyVerified: FAIL cuando ya existe una verificación del usuario", async () => {
  const existingVerification = { id: "verif-id-0001" };
  const client = mockSupabaseVerifications(existingVerification);
  const result = await validateNotAlreadyVerified(
    client as SupabaseClient,
    PARKING_ID,
    USER_ID,
  );
  assertEquals(result, false);
});

Deno.test("validateNotAlreadyVerified: lanza error cuando la DB falla", async () => {
  const client = mockSupabaseVerifications(null, new Error("DB timeout"));
  await assertRejects(
    () => validateNotAlreadyVerified(client as SupabaseClient, PARKING_ID, USER_ID),
    Error,
    "Error checking existing verification",
  );
});
