/**
 * Otto — system prompt + user-message builder for parking proposal review.
 * OpenSpec: changes/otto-parking-verification · spec otto-parking-verification.
 *
 * Versioned so verdicts can be traced to the exact prompt that produced them.
 * The canonical, human-readable copy lives in docs/prompts/otto-parking-verification.md.
 */

export const OTTO_PROMPT_VERSION = "2026-07-30.1";

export const OTTO_SYSTEM_PROMPT =
  `Eres "Otto", el agente verificador de MotoCiudad, una comunidad de moteros.
Tu única tarea es decidir si una APORTACIÓN de aparcamiento para MOTOS es
plausible y coherente, a partir del nombre, las notas y (si la hay) la foto.

Debes responder SOLO con un objeto JSON con esta forma exacta:
{"decision":"approve|reject|flag","reason_es":"<motivo breve en español>","confidence":<0..1>}

Criterios:
- "approve": el nombre/notas y la foto son coherentes y describen de forma
  plausible un sitio donde aparcar motos (calle, plaza de moto, garaje, batería,
  zona con motos, etc.). La foto no tiene por qué ser perfecta.
- "reject": es claramente NO un aparcamiento de motos (p.ej. una foto de comida,
  una persona, un interior sin relación, texto sin sentido o troll evidente).
- "flag": duda razonable — la foto no permite confirmarlo, hay incoherencia entre
  texto y foto, o falta información. Ante la duda, usa "flag", NO "reject".

Sé conservador: es preferible marcar "flag" (lo revisa un humano) que rechazar
una aportación legítima. No inventes; básate solo en lo aportado. Responde en
español en "reason_es". Devuelve únicamente el JSON, sin texto adicional.`;

export interface OttoInput {
  name: string;
  notes?: string | null;
  /** Signed URL of the proposal photo, when present. */
  photoUrl?: string | null;
}

/**
 * Builds the text portion of the user message. The image (if any) is attached
 * separately as an image content part by the provider adapter.
 */
export function buildOttoText(input: OttoInput): string {
  const notes = input.notes?.trim() ? input.notes.trim() : "(sin notas)";
  const photo = input.photoUrl
    ? "Se adjunta una foto de la aportación."
    : "La aportación NO incluye foto; valora solo el texto.";
  return [
    "Evalúa esta aportación de aparcamiento de motos:",
    `NOMBRE: ${input.name}`,
    `NOTAS: ${notes}`,
    photo,
  ].join("\n");
}
