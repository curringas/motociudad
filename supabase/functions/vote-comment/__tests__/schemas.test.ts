/**
 * Tests para el schema de vote-comment (validación pura, sin DB).
 * Run: deno test __tests__/schemas.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseVoteComment } from "../schemas.ts";

const COMMENT_ID = "22222222-2222-4222-8222-222222222222";

Deno.test("vote-comment: acepta value = 1", () => {
  const r = parseVoteComment({ comment_id: COMMENT_ID, value: 1 });
  assertEquals(r.success, true);
});

Deno.test("vote-comment: acepta value = -1", () => {
  const r = parseVoteComment({ comment_id: COMMENT_ID, value: -1 });
  assertEquals(r.success, true);
});

Deno.test("vote-comment: rechaza value = 0", () => {
  const r = parseVoteComment({ comment_id: COMMENT_ID, value: 0 });
  assertEquals(r.success, false);
});

Deno.test("vote-comment: rechaza value = 2", () => {
  const r = parseVoteComment({ comment_id: COMMENT_ID, value: 2 });
  assertEquals(r.success, false);
});

Deno.test("vote-comment: rechaza value no entero", () => {
  const r = parseVoteComment({ comment_id: COMMENT_ID, value: 1.5 });
  assertEquals(r.success, false);
});

Deno.test("vote-comment: rechaza comment_id no-UUID", () => {
  const r = parseVoteComment({ comment_id: "nope", value: 1 });
  assertEquals(r.success, false);
});
