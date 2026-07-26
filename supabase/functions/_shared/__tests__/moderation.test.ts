/**
 * Tests para la moderación de comentarios (pre-filtros, mapeo y fail-safe).
 * Deterministas: no hacen llamadas de red reales.
 * Run: deno test supabase/functions/_shared/__tests__/moderation.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  moderateComment,
  prefilter,
  resolveVerdict,
  verdictSchema,
} from "../moderation.ts";

// ── Pre-filtros deterministas ───────────────────────────────
Deno.test("prefilter: rechaza enlaces (spam)", () => {
  const r = prefilter("Mira esto en https://spam.example");
  assertEquals(r?.status, "rejected");
  assertEquals(r?.categories.includes("spam"), true);
});

Deno.test("prefilter: rechaza dominios sin protocolo", () => {
  assertEquals(prefilter("visita www.chollos.es")?.status, "rejected");
  assertEquals(prefilter("todo en promos.shop barato")?.status, "rejected");
});

Deno.test("prefilter: rechaza repetición excesiva", () => {
  assertEquals(prefilter("holaaaaaaaaaaaa")?.status, "rejected");
});

Deno.test("prefilter: rechaza mayúsculas excesivas", () => {
  assertEquals(prefilter("ESTO ES UN GRITO ENORME EN MAYUSCULAS")?.status, "rejected");
});

Deno.test("prefilter: deja pasar un comentario limpio", () => {
  assertEquals(prefilter("Buen sitio, siempre hay hueco para la moto"), null);
});

// ── Mapeo veredicto -> efecto ───────────────────────────────
Deno.test("resolveVerdict: allow -> approved", () => {
  const r = resolveVerdict(verdictSchema.parse({ decision: "allow", confidence: 0.9 }));
  assertEquals(r.status, "approved");
});

Deno.test("resolveVerdict: reject con confianza alta -> rejected", () => {
  const r = resolveVerdict(
    verdictSchema.parse({ decision: "reject", confidence: 0.95, reason_es: "spam" }),
  );
  assertEquals(r.status, "rejected");
});

Deno.test("resolveVerdict: flag -> pending_review", () => {
  const r = resolveVerdict(verdictSchema.parse({ decision: "flag", confidence: 0.4 }));
  assertEquals(r.status, "pending_review");
});

Deno.test("resolveVerdict: reject con baja confianza se degrada a revisión", () => {
  const r = resolveVerdict(verdictSchema.parse({ decision: "reject", confidence: 0.2 }));
  assertEquals(r.status, "pending_review");
  assertEquals(r.decision, "flag");
});

// ── Contrato del veredicto ──────────────────────────────────
Deno.test("verdictSchema: decisión inválida no valida", () => {
  const r = verdictSchema.safeParse({ decision: "maybe" });
  assertEquals(r.success, false);
});

Deno.test("verdictSchema: rellena defaults", () => {
  const v = verdictSchema.parse({ decision: "allow" });
  assertEquals(v.categories.length, 0);
  assertEquals(v.reason_es, "");
});

// ── Fail-safe: sin clave de proveedor, un comentario limpio queda en revisión ──
Deno.test("moderateComment: proveedor no disponible -> pending_review (fail-safe)", async () => {
  // En el entorno de test no hay DEEPSEEK_API_KEY: la llamada al proveedor falla
  // y NO se aprueba por defecto.
  if (Deno.env.get("DEEPSEEK_API_KEY") || Deno.env.get("MODERATION_PROVIDER") === "off") {
    return; // entorno con clave o bypass: no aplica esta aserción
  }
  const r = await moderateComment("Comentario limpio sobre el parking");
  assertEquals(r.status, "pending_review");
  assertEquals(r.source, "failsafe");
});
