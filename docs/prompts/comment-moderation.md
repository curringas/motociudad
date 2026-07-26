# Prompt de moderación de comentarios

> Copia documentada del prompt que usa la moderación IA de comentarios.
> **Fuente de verdad**: `supabase/functions/_shared/moderation-prompt.ts`
> (`MODERATION_SYSTEM_PROMPT`). Mantener ambos en sync.
> Change: `ai-comment-moderation` · versión del prompt: `2026-07-26.1`.

## Contexto

- **Proveedor de arranque**: DeepSeek (`deepseek-v4-flash`), API compatible con OpenAI,
  con `response_format: { type: "json_object" }` y `temperature: 0`.
- El proveedor es intercambiable (`MODERATION_PROVIDER`); el prompt no depende del
  proveedor concreto.
- El cuerpo del comentario se envía como **dato delimitado** (entre `<<<COMMENT>>>`
  y `<<<END>>>`), nunca como instrucción — resistencia a inyección de prompt.
- La respuesta se valida con Zod (`verdictSchema`). Un veredicto que no cumpla el
  esquema se trata como fallo → `pending_review` (fail-safe).

## Contrato de salida

```json
{
  "decision": "allow" | "reject" | "flag",
  "categories": ["hate","harassment","spam","sexual","pii","offtopic","illegal","other"],
  "reason_es": "motivo breve en es-ES (vacío si allow)",
  "confidence": 0.0
}
```

Mapeo a estado de moderación: `allow → approved`, `reject → rejected` (no se
persiste el comentario), `flag → pending_review`. Un `reject` con `confidence`
por debajo del umbral (0.5) se degrada a `flag`.

## Reglas de contenido

**RECHAZA (`reject`)**: insultos dirigidos/acoso/odio, spam/publicidad, contenido
sexual o violento explícito, datos personales (teléfonos, matrículas, nombres de
personas, direcciones exactas), instrucciones ilegales/peligrosas, y **off-topic**:
el comentario debe aportar información sobre ESTE parking; se rechaza la charla
ajena al parking aunque hable de motos (describir/presumir de la propia moto,
saludos, temas personales). Mencionar la moto solo vale si es en relación con
aparcar aquí (p. ej. "cabe mi custom sin problema").

**PERMITE (`allow`)**: la crítica negativa **honesta y respetuosa** sobre el
parking. Una opinión desfavorable no es motivo de rechazo (negativo ≠ tóxico).

**MARCA (`flag`)**: casos dudosos (ironía, jerga fuerte no claramente ofensiva,
ambigüedad) → revisión humana en el panel admin.

## System prompt (es-ES)

El texto íntegro vive en `supabase/functions/_shared/moderation-prompt.ts`. Si se
edita, subir la versión (`MODERATION_PROMPT_VERSION`) y actualizar este documento.
