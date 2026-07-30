# Prompt de Otto — verificación de aportaciones de parkings

- **Agente**: Otto (verificador de MotoCiudad).
- **Versión**: `2026-07-30.1` (sincronizada con `OTTO_PROMPT_VERSION` en `supabase/functions/_shared/otto-prompt.ts`).
- **Dónde vive el prompt real**: `supabase/functions/_shared/otto-prompt.ts` (fuente de verdad). Este documento es la copia legible y el registro de versiones.
- **Proveedor**: intercambiable vía `OTTO_PROVIDER` (arranque con un modelo con visión OpenAI-compatible). El prompt no depende del proveedor.
- **Privacidad**: al proveedor se envía solo el nombre, las notas y —si la hay— una URL firmada de la foto de la aportación (contenido de la propia propuesta). No se envía PII de cuenta ni geolocalización del usuario.

## Contrato de salida

El proveedor devuelve **solo** un objeto JSON:

```json
{ "decision": "approve|reject|flag", "reason_es": "<motivo breve>", "confidence": 0.0 }
```

Mapeo a `ai_review_status`:

| decision | ai_review_status | Efecto |
|----------|------------------|--------|
| `approve` | `approved` | Entra al pipeline `pending` (visible) + 50 Octanos pendientes |
| `reject` (confianza ≥ 0.6) | `rejected` | No se publica, sin Octanos |
| `reject` (confianza < 0.6) | `flagged` | Se degrada a revisión humana (conservador) |
| `flag` | `flagged` | No se publica; espera aprobación del admin, sin Octanos aún |
| _(error/timeout)_ | `flagged` | **Failsafe**: nunca aprueba por defecto |

## Criterios (resumen)

- **approve**: nombre/notas y foto coherentes y plausibles como sitio para aparcar motos.
- **reject**: claramente NO es un aparcamiento de motos (comida, personas, interiores sin relación, texto sin sentido, troll).
- **flag**: duda razonable, foto que no confirma, incoherencia texto-foto, o falta de información. **Ante la duda, `flag`, nunca `reject`.**

Sin foto → Otto valora solo el texto.

## Notas de versión

- `2026-07-30.1`: versión inicial. Prompt conservador (preferencia por `flag` sobre `reject`); salida JSON forzada; visión opcional según haya foto.
