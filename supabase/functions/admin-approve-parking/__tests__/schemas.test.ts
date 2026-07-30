/**
 * Unit tests for admin-approve-parking request schema.
 * Run with: deno test supabase/functions/admin-approve-parking/__tests__/schemas.test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseApproveParkingRequest } from "../schemas.ts";

const VALID_UUID = "a0000000-0770-0000-0000-0000000000a2";

Deno.test("accepts a valid parkingId", () => {
  const r = parseApproveParkingRequest({ parkingId: VALID_UUID });
  assertEquals(r.success, true);
});

Deno.test("rejects a non-uuid parkingId", () => {
  const r = parseApproveParkingRequest({ parkingId: "not-a-uuid" });
  assertEquals(r.success, false);
});

Deno.test("rejects a missing parkingId", () => {
  const r = parseApproveParkingRequest({});
  assertEquals(r.success, false);
});
