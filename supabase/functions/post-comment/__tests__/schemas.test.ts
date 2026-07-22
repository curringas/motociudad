/**
 * Tests para el schema de post-comment (validación pura, sin DB).
 * Run: deno test __tests__/schemas.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parsePostComment } from "../schemas.ts";

const PARKING_ID = "11111111-1111-4111-8111-111111111111";

Deno.test("post-comment: acepta un comentario válido", () => {
  const r = parsePostComment({ parking_id: PARKING_ID, body: "Buen sitio" });
  assertEquals(r.success, true);
  if (r.success) assertEquals(r.data.body, "Buen sitio");
});

Deno.test("post-comment: recorta espacios del cuerpo", () => {
  const r = parsePostComment({ parking_id: PARKING_ID, body: "  hola  " });
  assertEquals(r.success, true);
  if (r.success) assertEquals(r.data.body, "hola");
});

Deno.test("post-comment: rechaza cuerpo vacío", () => {
  const r = parsePostComment({ parking_id: PARKING_ID, body: "   " });
  assertEquals(r.success, false);
});

Deno.test("post-comment: rechaza cuerpo > 500 caracteres", () => {
  const r = parsePostComment({ parking_id: PARKING_ID, body: "a".repeat(501) });
  assertEquals(r.success, false);
});

Deno.test("post-comment: acepta exactamente 500 caracteres", () => {
  const r = parsePostComment({ parking_id: PARKING_ID, body: "a".repeat(500) });
  assertEquals(r.success, true);
});

Deno.test("post-comment: rechaza parking_id no-UUID", () => {
  const r = parsePostComment({ parking_id: "not-a-uuid", body: "hola" });
  assertEquals(r.success, false);
});

Deno.test("post-comment: rechaza body ausente", () => {
  const r = parsePostComment({ parking_id: PARKING_ID });
  assertEquals(r.success, false);
});
