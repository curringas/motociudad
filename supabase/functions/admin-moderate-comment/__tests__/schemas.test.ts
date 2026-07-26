/**
 * Tests para el schema de admin-moderate-comment (validación pura, sin DB).
 * Acepta uno (commentId) o varios (commentIds). El gate admin vive en el handler.
 * Run: deno test __tests__/schemas.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  idsOf,
  parseModerateCommentRequest,
  STATUS_FOR_ACTION,
} from "../schemas.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

Deno.test("acepta un único commentId", () => {
  const r = parseModerateCommentRequest({ commentId: A, action: "approve" });
  assertEquals(r.success, true);
  if (r.success) assertEquals(idsOf(r.data), [A]);
});

Deno.test("acepta commentIds en bloque", () => {
  const r = parseModerateCommentRequest({ commentIds: [A, B], action: "approve" });
  assertEquals(r.success, true);
  if (r.success) assertEquals(idsOf(r.data), [A, B]);
});

Deno.test("rechaza sin ningún id", () => {
  const r = parseModerateCommentRequest({ action: "approve" });
  assertEquals(r.success, false);
});

Deno.test("rechaza action inválida", () => {
  const r = parseModerateCommentRequest({ commentId: A, action: "delete" });
  assertEquals(r.success, false);
});

Deno.test("rechaza id no-UUID", () => {
  const r = parseModerateCommentRequest({ commentIds: ["nope"], action: "approve" });
  assertEquals(r.success, false);
});

Deno.test("mapeo action -> moderation_status", () => {
  assertEquals(STATUS_FOR_ACTION.approve, "approved");
  assertEquals(STATUS_FOR_ACTION.reject, "rejected");
});
