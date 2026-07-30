/**
 * Unit tests for Otto's pure verdict mapping and pre-filter.
 * Run with: deno test supabase/functions/_shared/__tests__/otto.test.ts
 * No network / no env: covers resolveVerdict and prefilter deterministically.
 * OpenSpec: changes/otto-parking-verification · spec otto-parking-verification.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { prefilter, resolveVerdict } from "../otto.ts";

Deno.test("approve -> approved", () => {
  const r = resolveVerdict({ decision: "approve", reason_es: "ok", confidence: 0.9 });
  assertEquals(r.status, "approved");
  assertEquals(r.source, "provider");
});

Deno.test("flag -> flagged", () => {
  const r = resolveVerdict({ decision: "flag", reason_es: "duda", confidence: 0.4 });
  assertEquals(r.status, "flagged");
});

Deno.test("confident reject -> rejected", () => {
  const r = resolveVerdict({ decision: "reject", reason_es: "no es un parking", confidence: 0.9 });
  assertEquals(r.status, "rejected");
});

Deno.test("low-confidence reject is downgraded to flagged (conservative)", () => {
  const r = resolveVerdict({ decision: "reject", reason_es: "quizá", confidence: 0.3 });
  assertEquals(r.status, "flagged");
  assertEquals(r.decision, "flag");
});

Deno.test("prefilter flags an empty/gibberish name", () => {
  const r = prefilter({ name: "!!", notes: null, photoUrl: null });
  assertEquals(r?.status, "flagged");
  assertEquals(r?.source, "prefilter");
});

Deno.test("prefilter passes a normal name", () => {
  const r = prefilter({ name: "Parking Plaza Mayor", notes: "en batería", photoUrl: null });
  assertEquals(r, null);
});
