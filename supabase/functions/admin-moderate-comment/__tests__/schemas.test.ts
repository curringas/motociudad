/**
 * Tests para el schema de admin-moderate-comment (validación pura, sin DB).
 * El gate de admin (rol) vive en el handler (mismo patrón que admin-set-role) y
 * se cubre además en la verificación E2E; el RPC moderate_comment está REVOKEd
 * para clientes (solo service_role).
 * Run: deno test __tests__/schemas.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseModerateCommentRequest,
  STATUS_FOR_ACTION,
} from "../schemas.ts";

const COMMENT_ID = "11111111-1111-4111-8111-111111111111";

Deno.test("admin-moderate-comment: acepta approve", () => {
  const r = parseModerateCommentRequest({ commentId: COMMENT_ID, action: "approve" });
  assertEquals(r.success, true);
  if (r.success) assertEquals(r.data.action, "approve");
});

Deno.test("admin-moderate-comment: acepta reject", () => {
  const r = parseModerateCommentRequest({ commentId: COMMENT_ID, action: "reject" });
  assertEquals(r.success, true);
});

Deno.test("admin-moderate-comment: rechaza action inválida", () => {
  const r = parseModerateCommentRequest({ commentId: COMMENT_ID, action: "delete" });
  assertEquals(r.success, false);
});

Deno.test("admin-moderate-comment: rechaza commentId no-UUID", () => {
  const r = parseModerateCommentRequest({ commentId: "nope", action: "approve" });
  assertEquals(r.success, false);
});

Deno.test("admin-moderate-comment: mapeo action -> moderation_status", () => {
  assertEquals(STATUS_FOR_ACTION.approve, "approved");
  assertEquals(STATUS_FOR_ACTION.reject, "rejected");
});
