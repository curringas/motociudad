/**
 * Otto admin email notifications via the project's own SMTP.
 * OpenSpec: changes/otto-parking-verification · spec otto-parking-verification (D6).
 *
 * Best-effort: sendOttoAdminEmail never throws. A delivery failure MUST NOT
 * change Otto's verdict nor break the proposal response — the caller may await
 * it and ignore the boolean result. Credentials live in server secrets; never
 * expose them to the client.
 */

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import type { AiReviewStatus } from "./otto.ts";

const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD") ?? "";
const EMAIL_FROM = Deno.env.get("OTTO_EMAIL_FROM") ?? "otto@motociudad.com";
const EMAIL_TO = Deno.env.get("OTTO_EMAIL_TO") ?? "otto@motociudad.com";

export interface OttoEmailInput {
  parkingId: string;
  name: string;
  city?: string | null;
  status: Extract<AiReviewStatus, "flagged" | "rejected">;
  reason: string;
  proposedBy: string;
}

/**
 * Notify the admin (Otto's mailbox) about a flagged or rejected proposal.
 * Returns true on success, false on any failure (including missing config).
 * Never throws.
 */
export async function sendOttoAdminEmail(input: OttoEmailInput): Promise<boolean> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    console.warn("[otto-email] SMTP not configured; skipping notification");
    return false;
  }

  const label = input.status === "flagged" ? "DUDOSO (revisión manual)" : "RECHAZADO";
  const subject = `[Otto] Parking ${label}: ${input.name}`;
  const body = [
    `Otto ha marcado una aportación como ${input.status}.`,
    "",
    `Parking: ${input.name}`,
    `Ciudad: ${input.city ?? "(desconocida)"}`,
    `Propuesto por (id): ${input.proposedBy}`,
    `ID parking: ${input.parkingId}`,
    `Motivo: ${input.reason}`,
    "",
    input.status === "flagged"
      ? "Revísalo en el panel de administración (filtro «dudosos») para aprobarlo o descartarlo."
      : "Puedes revisarlo en el panel de administración (filtro «rechazados»).",
  ].join("\n");

  const client = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_PORT === 465,
      auth: { username: SMTP_USER, password: SMTP_PASSWORD },
    },
  });

  try {
    await client.send({ from: EMAIL_FROM, to: EMAIL_TO, subject, content: body });
    return true;
  } catch (e) {
    console.error("[otto-email] send failed:", e instanceof Error ? e.message : e);
    return false;
  } finally {
    try {
      await client.close();
    } catch (_) { /* ignore close errors */ }
  }
}
