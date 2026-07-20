/**
 * Tests para el schema de delete-comment (validación pura, sin DB).
 * Run: deno test __tests__/schemas.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseDeleteComment } from "../schemas.ts";

const COMMENT_ID = "33333333-3333-4333-8333-333333333333";

Deno.test("delete-comment: acepta comment_id válido", () => {
  const r = parseDeleteComment({ comment_id: COMMENT_ID });
  assertEquals(r.success, true);
});

Deno.test("delete-comment: rechaza comment_id no-UUID", () => {
  const r = parseDeleteComment({ comment_id: "nope" });
  assertEquals(r.success, false);
});

Deno.test("delete-comment: rechaza body sin comment_id", () => {
  const r = parseDeleteComment({});
  assertEquals(r.success, false);
});
