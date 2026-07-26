/**
 * Tests para el schema de admin-delete-comment (validación pura, sin DB).
 * El gate admin vive en el handler; el RPC admin_delete_comments está REVOKEd.
 * Run: deno test __tests__/schemas.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseDeleteCommentsRequest } from "../schemas.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

Deno.test("acepta una lista de UUIDs", () => {
  const r = parseDeleteCommentsRequest({ commentIds: [A, B] });
  assertEquals(r.success, true);
  if (r.success) assertEquals(r.data.commentIds.length, 2);
});

Deno.test("rechaza lista vacía", () => {
  const r = parseDeleteCommentsRequest({ commentIds: [] });
  assertEquals(r.success, false);
});

Deno.test("rechaza id no-UUID", () => {
  const r = parseDeleteCommentsRequest({ commentIds: ["nope"] });
  assertEquals(r.success, false);
});

Deno.test("rechaza sin commentIds", () => {
  const r = parseDeleteCommentsRequest({});
  assertEquals(r.success, false);
});
