/**
 * Otto — AI review of user parking proposals (vision + text).
 * OpenSpec: changes/otto-parking-verification · spec otto-parking-verification (D2, D5).
 *
 * reviewParking({name, notes, photoUrl}) resolves a proposal to an AI review status:
 *   approve  -> approved   (enters the public pending pipeline; +50 Octanos)
 *   reject   -> rejected   (not published; no Octanos)
 *   flag     -> flagged    (hidden; awaits admin approval; no Octanos yet)
 *   failsafe -> flagged    (provider down/timeout/invalid -> never auto-approve)
 *
 * Provider is OpenAI-compatible, selected by OTTO_PROVIDER (default "openai";
 * "off" bypasses review and approves everything — rollback switch). The API key
 * lives in a server secret; never expose it to the client. Mirrors the structure
 * of _shared/moderation.ts.
 */

import { z } from "npm:zod@3";
import { buildOttoText, OTTO_PROMPT_VERSION, OTTO_SYSTEM_PROMPT, type OttoInput } from "./otto-prompt.ts";

export type Decision = "approve" | "reject" | "flag";
export type AiReviewStatus = "approved" | "flagged" | "rejected";
export type ReviewSource = "prefilter" | "provider" | "failsafe" | "bypass";

export interface OttoResult {
  status: AiReviewStatus;
  decision: Decision | "failsafe";
  reason_es: string;
  source: ReviewSource;
  promptVersion: string;
}

/** Structured verdict contract expected from the provider. */
export const verdictSchema = z.object({
  decision: z.enum(["approve", "reject", "flag"]),
  reason_es: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0),
});
export type Verdict = z.infer<typeof verdictSchema>;

const PROVIDER = Deno.env.get("OTTO_PROVIDER")?.trim() || "openai";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const VISION_URL = Deno.env.get("OTTO_VISION_URL")?.trim() ||
  "https://api.openai.com/v1/chat/completions";
const VISION_MODEL = Deno.env.get("OTTO_VISION_MODEL")?.trim() || "gpt-4o-mini";
const PROVIDER_TIMEOUT_MS = 8_000; // vision is slower than text moderation
/** Below this confidence, a "reject" is downgraded to human review (be conservative). */
const REJECT_CONFIDENCE_FLOOR = 0.6;

function statusForDecision(d: Decision): AiReviewStatus {
  return d === "approve" ? "approved" : d === "reject" ? "rejected" : "flagged";
}

/** Minimal deterministic pre-filter: obviously empty/gibberish name -> flag (not reject). */
export function prefilter(input: OttoInput): OttoResult | null {
  const letters = input.name.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) {
    return {
      status: "flagged",
      decision: "flag",
      reason_es: "El nombre no aporta información suficiente; revisión manual.",
      source: "prefilter",
      promptVersion: OTTO_PROMPT_VERSION,
    };
  }
  return null;
}

function failsafe(): OttoResult {
  return {
    status: "flagged",
    decision: "failsafe",
    reason_es:
      "No hemos podido verificar tu aportación automáticamente; un administrador la revisará.",
    source: "failsafe",
    promptVersion: OTTO_PROMPT_VERSION,
  };
}

// ── OpenAI-compatible vision adapter (JSON output) ──────────────
async function callVisionProvider(input: OttoInput): Promise<Verdict> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

  const text = buildOttoText(input);
  const userContent: unknown[] = [{ type: "text", text }];
  if (input.photoUrl) {
    userContent.push({ type: "image_url", image_url: { url: input.photoUrl } });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const res = await fetch(VISION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: OTTO_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Vision provider HTTP ${res.status}`);
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Empty provider content");
    return verdictSchema.parse(JSON.parse(content));
  } finally {
    clearTimeout(timer);
  }
}

const PROVIDERS: Record<string, (input: OttoInput) => Promise<Verdict>> = {
  openai: callVisionProvider,
};

/**
 * Review a parking proposal. Never throws: any provider failure resolves to a
 * fail-safe `flagged` so the caller can persist it for human review.
 */
export async function reviewParking(input: OttoInput): Promise<OttoResult> {
  if (PROVIDER === "off") {
    return {
      status: "approved",
      decision: "approve",
      reason_es: "",
      source: "bypass",
      promptVersion: OTTO_PROMPT_VERSION,
    };
  }

  const pre = prefilter(input);
  if (pre) return pre;

  const call = PROVIDERS[PROVIDER];
  if (!call) return failsafe();

  let verdict: Verdict;
  try {
    verdict = await call(input);
  } catch (_e) {
    return failsafe();
  }
  return resolveVerdict(verdict);
}

/**
 * Pure mapping from a validated provider verdict to a review result.
 * Low-confidence rejections are downgraded to human review (be conservative).
 * Exported for deterministic unit testing without hitting the network.
 */
export function resolveVerdict(verdict: Verdict): OttoResult {
  let decision = verdict.decision;
  if (decision === "reject" && verdict.confidence < REJECT_CONFIDENCE_FLOOR) {
    decision = "flag";
  }
  return {
    status: statusForDecision(decision),
    decision,
    reason_es: verdict.reason_es,
    source: "provider",
    promptVersion: OTTO_PROMPT_VERSION,
  };
}
