/**
 * Comment moderation — decoupled AI provider + deterministic pre-filters.
 * OpenSpec: changes/ai-comment-moderation · spec comment-moderation (D4, D5, D6).
 *
 * moderateComment(text) resolves a comment to a DB moderation status:
 *   allow    -> approved       (visible, credits ladder)
 *   reject   -> rejected       (not persisted by the caller)
 *   flag     -> pending_review (hidden, human review)
 *   failsafe -> pending_review (provider down/timeout/invalid -> never auto-approve)
 *
 * Provider is selected by MODERATION_PROVIDER (default "deepseek"; "off" bypasses
 * moderation and approves everything — rollback switch, see design D4/Migration).
 * The provider key lives in a server secret; never expose it to the client.
 */

import { z } from "npm:zod@3";
import {
  buildUserMessage,
  MODERATION_PROMPT_VERSION,
  MODERATION_SYSTEM_PROMPT,
} from "./moderation-prompt.ts";

export type Decision = "allow" | "reject" | "flag";
export type ModerationStatus = "approved" | "pending_review" | "rejected";
export type ModerationSource =
  | "prefilter"
  | "provider"
  | "failsafe"
  | "bypass";

export interface ModerationResult {
  status: ModerationStatus;
  decision: Decision | "failsafe";
  reason_es: string;
  categories: string[];
  source: ModerationSource;
  promptVersion: string;
}

/** Structured verdict contract expected from the provider (D5). */
export const verdictSchema = z.object({
  decision: z.enum(["allow", "reject", "flag"]),
  categories: z.array(z.string()).default([]),
  reason_es: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0),
});
export type Verdict = z.infer<typeof verdictSchema>;

const PROVIDER = Deno.env.get("MODERATION_PROVIDER")?.trim() || "deepseek";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-flash";
const PROVIDER_TIMEOUT_MS = 4_000;
/** Below this confidence, a "reject" is downgraded to human review (D5, open Q). */
const REJECT_CONFIDENCE_FLOOR = 0.5;

function statusForDecision(d: Decision): ModerationStatus {
  return d === "allow" ? "approved" : d === "reject" ? "rejected" : "pending_review";
}

// ── Deterministic pre-filters (D6) ──────────────────────────
const URL_RE = /(https?:\/\/|www\.|\b[\w-]+\.(com|net|org|io|es|shop|xyz)\b)/i;

/** Returns a reject result when an obvious rule is violated, else null. */
export function prefilter(text: string): ModerationResult | null {
  if (URL_RE.test(text)) {
    return reject("No se permiten enlaces ni publicidad en los comentarios.", [
      "spam",
    ], "prefilter");
  }
  // Character flood: one character repeated 10+ times in a row.
  if (/(.)\1{9,}/.test(text)) {
    return reject("El comentario parece spam (repetición excesiva).", ["spam"],
      "prefilter");
  }
  // Excessive caps: long text mostly uppercase.
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 15) {
    const uppers = (text.match(/\p{Lu}/gu) ?? []).length;
    if (uppers / letters.length > 0.7) {
      return reject("Evita escribir todo en mayúsculas.", ["other"], "prefilter");
    }
  }
  return null;
}

function reject(
  reason_es: string,
  categories: string[],
  source: ModerationSource,
): ModerationResult {
  return {
    status: "rejected",
    decision: "reject",
    reason_es,
    categories,
    source,
    promptVersion: MODERATION_PROMPT_VERSION,
  };
}

function failsafe(): ModerationResult {
  return {
    status: "pending_review",
    decision: "failsafe",
    reason_es:
      "No hemos podido validar tu comentario automáticamente; queda pendiente de revisión por un administrador.",
    categories: [],
    source: "failsafe",
    promptVersion: MODERATION_PROMPT_VERSION,
  };
}

// ── DeepSeek adapter (OpenAI-compatible, JSON output) (D4) ───
async function callDeepSeek(text: string): Promise<Verdict> {
  if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: MODERATION_SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(text) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Empty provider content");
    return verdictSchema.parse(JSON.parse(content));
  } finally {
    clearTimeout(timer);
  }
}

const PROVIDERS: Record<string, (text: string) => Promise<Verdict>> = {
  deepseek: callDeepSeek,
};

/**
 * Moderate a comment body. Never throws: any provider failure resolves to a
 * fail-safe pending_review so the caller can persist it for human review.
 */
export async function moderateComment(text: string): Promise<ModerationResult> {
  if (PROVIDER === "off") {
    return {
      status: "approved",
      decision: "allow",
      reason_es: "",
      categories: [],
      source: "bypass",
      promptVersion: MODERATION_PROMPT_VERSION,
    };
  }

  const pre = prefilter(text);
  if (pre) return pre;

  const call = PROVIDERS[PROVIDER];
  if (!call) return failsafe();

  let verdict: Verdict;
  try {
    verdict = await call(text);
  } catch (_e) {
    return failsafe();
  }
  return resolveVerdict(verdict);
}

/**
 * Pure mapping from a validated provider verdict to a moderation result.
 * Low-confidence rejections are downgraded to human review (D5). Exported for
 * deterministic unit testing without hitting the network.
 */
export function resolveVerdict(verdict: Verdict): ModerationResult {
  let decision = verdict.decision;
  if (decision === "reject" && verdict.confidence < REJECT_CONFIDENCE_FLOOR) {
    decision = "flag";
  }
  return {
    status: statusForDecision(decision),
    decision,
    reason_es: verdict.reason_es,
    categories: verdict.categories,
    source: "provider",
    promptVersion: MODERATION_PROMPT_VERSION,
  };
}
