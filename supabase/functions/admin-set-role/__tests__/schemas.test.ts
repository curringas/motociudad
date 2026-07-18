/**
 * Tests del contrato de admin-set-role (validación de input con Zod).
 *
 * Siguen la convención del repo (validate-verification): la lógica de auth/DB del
 * handler exige env vars y clientes reales, por lo que se prueba el esquema de
 * entrada — el gate 400 (input inválido). Los gates 401/403/404 (llamante no
 * admin, auto-modificación, usuario inexistente) están cubiertos por:
 *   - el código del handler (index.ts, pasos 1-5),
 *   - los tests pgTAP del trigger trg_users_privileged_fields (escalada bloqueada).
 *
 * Run: deno test __tests__/schemas.test.ts
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseSetRoleRequest } from "../schemas.ts";

const VALID_UUID = "8dac2082-0000-4000-8000-000000000001";

Deno.test("schema: cambio de rol válido es aceptado", () => {
  const result = parseSetRoleRequest({ userId: VALID_UUID, role: "admin" });
  assertEquals(result.success, true);
});

Deno.test("schema: suspensión con motivo es aceptada", () => {
  const result = parseSetRoleRequest({
    userId: VALID_UUID,
    suspended: true,
    suspendedReason: "spam reiterado",
  });
  assertEquals(result.success, true);
});

Deno.test("schema: role + suspended a la vez es aceptado", () => {
  const result = parseSetRoleRequest({
    userId: VALID_UUID,
    role: "contributor",
    suspended: false,
  });
  assertEquals(result.success, true);
});

Deno.test("schema: userId no UUID es rechazado (400)", () => {
  const result = parseSetRoleRequest({ userId: "not-a-uuid", role: "admin" });
  assertEquals(result.success, false);
  if (!result.success) assertStringIncludes(result.error, "userId");
});

Deno.test("schema: rol fuera del enum es rechazado (400)", () => {
  const result = parseSetRoleRequest({ userId: VALID_UUID, role: "superadmin" });
  assertEquals(result.success, false);
});

Deno.test("schema: sin role ni suspended es rechazado (400)", () => {
  const result = parseSetRoleRequest({ userId: VALID_UUID });
  assertEquals(result.success, false);
  if (!result.success) {
    assertStringIncludes(result.error, "role");
  }
});

Deno.test("schema: suspendedReason demasiado largo es rechazado (400)", () => {
  const result = parseSetRoleRequest({
    userId: VALID_UUID,
    suspended: true,
    suspendedReason: "x".repeat(501),
  });
  assertEquals(result.success, false);
});

Deno.test("schema: body vacío es rechazado (400)", () => {
  const result = parseSetRoleRequest({});
  assertEquals(result.success, false);
});
