## Context

Los comentarios de parkings se crean hoy en la Edge Function `post-comment`
(auth → email/suspendido → Zod 1–500 → rate limit 1/30s → RPC atómica
`process_comment` que inserta y acredita Octanos en un solo paso). La tabla
`comments` no tiene ningún estado de moderación; el listado público muestra todo
lo no borrado (`deleted_at IS NULL`). El panel de administración (solo web) ya
está en producción y sirve como superficie natural para revisión humana.

Queremos interponer un agente de IA que evalúe cada comentario en el momento de
publicarlo. La decisión de producto (fijada en exploración) es: sistema
**síncrono** con feedback de "en revisión" en el cliente, proveedor **DeepSeek**
(a modo de prueba, desacoplado), estados de moderación persistidos, cero
tolerancia con el off-topic, y **fail-safe a revisión humana** (nunca aprobar por
defecto ante fallo del proveedor).

## Goals / Non-Goals

**Goals:**
- Bloquear en el punto de entrada el contenido tóxico/spam/PII/off-topic antes de
  que sea público.
- Mantener una experiencia clara: el usuario sabe si su comentario se publicó, se
  rechazó (con motivo) o quedó pendiente de revisión.
- Aislar el proveedor de IA para poder cambiarlo (DeepSeek ↔ Claude ↔ otro) sin
  tocar la lógica de negocio.
- No acreditar Octanos por contenido que no está aprobado/visible.
- Reusar el panel admin existente para la cola de revisión.

**Non-Goals:**
- Moderación asíncrona en segundo plano (Sistema B) o re-moderación del histórico.
- Moderar entidades distintas de los comentarios de parking.
- Apelaciones del usuario o edición de comentarios rechazados.
- Multi-idioma (prompt y motivos en es-ES).

## Decisions

### D1 — Sistema A (síncrono) con estado intermedio persistido
La moderación ocurre dentro de la petición de `post-comment`, con UX de carga en
el cliente. **Alternativa descartada:** Sistema B (insertar y moderar en segundo
plano) — añade cola, reproceso y claw-back de Octanos que no compensan en MVP.
Consecuencia de la regla de fail-safe: A **no es binario**; necesita un estado
`pending_review`, así que se persiste `moderation_status`.

### D2 — Máquina de estados de moderación
Nueva columna `comments.moderation_status` (`approved | pending_review | rejected`).

```
                 post-comment  (síncrono; cliente: "⏳ revisando…")
                        │  pre-filtros (enlaces/flood/repetición)
                        ▼
                 proveedor IA  → veredicto {decision, categories, reason_es}
   ┌──────────────┬───────────────┬──────────────┬──────────────────────────┐
   ▼              ▼               ▼              ▼                           ▼
 allow          reject          flag         fallo/timeout/no-parseable
   │              │               │              │
 approved       (no inserta,   pending_review  pending_review
 INSERT+Octanos  422+motivo)    INSERT sin      INSERT sin Octanos
   │                            Octanos            │
   ▼                              └───────┬────────┘
 "Publicado"                              ▼
                              "⏳ Pendiente de revisión"
                                          │
                            admin aprueba │ admin rechaza
                                          ▼          ▼
                              approved (evalúa Octanos)   rejected (oculto)
```

**Rechazo duro (`reject`) no inserta** el comentario (no ocupa espacio ni requiere
limpieza). `flag` y fallos **sí insertan** como `pending_review`.

### D3 — Octanos evaluados en el momento de `approved`
La elegibilidad de posición (`first_comment`/`second_comment`) y la acreditación
se calculan **cuando el comentario pasa a `approved`**, considerando solo
comentarios `approved`. Camino `allow` → aprobado al instante → mismo
comportamiento que hoy. Camino `pending_review` → no acredita hasta que el admin
aprueba, y entonces compite por los puestos restantes en ese momento.
**Alternativa descartada:** acreditar al insertar y revertir si se rechaza
(claw-back) — frágil y confuso para el usuario. Esto significa que el RPC
`process_comment` deja de acreditar incondicionalmente: acredita solo en la
transición a `approved` (inserción con `allow`, o aprobación admin).

### D4 — Proveedor desacoplado en `_shared/moderation.ts`
Interfaz `moderateComment(text): Promise<Verdict>` con un adaptador `deepseek`
seleccionado por env (`MODERATION_PROVIDER`, por defecto `deepseek`). DeepSeek usa
API compatible con OpenAI (`https://api.deepseek.com`, modelo `deepseek-chat`),
con **salida JSON forzada** (`response_format: { type: "json_object" }`).
**Alternativa descartada:** llamar al proveedor inline en `post-comment` — acopla
y dificulta el cambio "a ver qué tal" y el testeo.

### D5 — Contrato estructurado del veredicto
```json
{ "decision": "allow" | "reject" | "flag",
  "categories": ["hate","harassment","spam","sexual","pii","offtopic","illegal"],
  "reason_es": "motivo legible para el usuario, en es-ES",
  "confidence": 0.0 }
```
Se valida con Zod al recibirlo; si no cumple el esquema → se trata como fallo
(D2, `pending_review`). Baja confianza en `allow`/`reject` puede degradarse a
`flag` (umbral configurable).

### D6 — Pre-filtros antes de la IA
Heurísticas baratas y deterministas en la edge (enlaces/URLs, flood/repetición,
mayúsculas excesivas). Un enlace obvio → `reject` sin gastar llamada. Reduce coste
y latencia y hace los tests deterministas para esos casos.

### D7 — Visibilidad vía RLS
`comments` SELECT: público solo `approved`; el **autor** ve además los suyos en
`pending_review` (para su "⏳ en revisión"); admin ve todo. Los `rejected` nunca se
listan (equivalente a borrado). El listado y el contador de comentarios de
`parkings_with_stats` cuentan solo `approved`.

### D8 — Aprobación/rechazo admin vía Edge Function
Nueva Edge Function (p. ej. `admin-moderate-comment`) con `service_role`,
protegida por rol admin, que cambia el estado y —al aprobar— dispara la
evaluación de Octanos (D3). Reusa el patrón de `admin-set-role`.

### D9 — Prompt de moderación versionado
El prompt vive en el repo (`supabase/functions/_shared/moderation-prompt.ts` y su
copia documentada en `docs/`), con las reglas es-ES: rechazo duro
(odio/acoso/spam/sexual/PII/ilegal/off-topic) y protección explícita de la crítica
negativa honesta. Se documenta al cierre (PRD + README + prompts).

## Risks / Trade-offs

- **Latencia añadida en cada publicación** → mitigación: modelo rápido
  (`deepseek-chat`), pre-filtros que cortan lo trivial, timeout corto (p. ej. 4s)
  que cae a `pending_review` (D2) en vez de colgar la petición.
- **Caída/inestabilidad del proveedor** → fail-safe a `pending_review`; nunca
  aprueba por defecto, nunca rechaza por defecto; el usuario es avisado.
- **Residencia de datos / privacidad**: enviar el texto del comentario a DeepSeek
  (fuera de la UE) → se envía **solo el body** (contenido público, sin PII de
  cuenta ni geolocalización); decisión consciente documentada en
  `docs/arquitectura.md`. Cambiar de proveedor es trivial (D4) si se decide otra
  política.
- **Inyección de prompt en el body** → el body va como *dato* delimitado, nunca
  concatenado como instrucción; el veredicto se valida con Zod (D5) y cualquier
  desviación cae a `pending_review`.
- **Falsos positivos que censuran crítica legítima** → regla explícita "negativo ≠
  tóxico" (D9) y salida de escape `flag` → revisión humana; se vigila en E2E.
- **No determinismo del modelo** → en tests se **mockea** el clasificador y se
  prueba el *gate* de forma determinista (verdict X → efecto Y); los pre-filtros
  (D6) sí se prueban directos.
- **Coste** → acotado por rate limit (1/30s) + pre-filtros; `DEEPSEEK_API_KEY`
  como secret de Supabase, nunca en cliente.

## Migration Plan

1. Migración: añadir `comments.moderation_status` con **DEFAULT `'approved'`** y
   backfill de las filas existentes a `approved` (el histórico permanece visible;
   Non-goal: no re-moderar). Índice parcial para el listado por estado.
2. Ajustar RLS de `comments` (D7) + tests pgTAP.
3. Ajustar RPC `process_comment` para diferir Octanos (D3) + crear RPC/Function de
   aprobación admin (D8).
4. Desplegar `_shared/moderation.ts` y `moderation-prompt.ts`; fijar
   `DEEPSEEK_API_KEY` y `MODERATION_PROVIDER` como secrets.
5. Integrar la puerta en `post-comment` (pre-filtros → proveedor → estado).
6. Cliente: estado "en revisión", mensajes de rechazo/pendiente; cola en admin.
7. **Rollback**: `MODERATION_PROVIDER=off` (bypass → todo `approved` como hoy) sin
   redeploy de esquema; la columna permanece (no se hace DROP, regla de repo).

## Future Work (feature siguiente: `admin-comments-management`)

Esta feature deja el terreno preparado para una gestión rica de comentarios en el
panel admin, que se implementará por separado. Lo que ya queda listo para
reutilizar:
- Estado `moderation_status` y RLS que ya dan al admin visibilidad total
  (incluidos `rejected`).
- Edge Function `admin-moderate-comment` (service_role + rol admin) como base para
  ampliar acciones.
- Cola mínima de `pending_review` como punto de entrada de UI.

Lo que aporta la feature siguiente (fuera de alcance aquí): borrar cualquier
comentario (no solo pendientes), ver/restaurar `rejected`, filtros y búsqueda,
acciones en bloque, y métricas de moderación (volumen, categorías más frecuentes).

## Open Questions

- Umbral de `confidence` para degradar `allow`/`reject` a `flag` (arrancar con
  degradar solo `reject` de baja confianza).
- ¿Notificar al usuario cuando el admin resuelve su `pending_review`? (fuera de
  alcance MVP; el autor lo ve al recargar el detalle).
- Timeout exacto del proveedor y política de reintentos (0 reintentos en MVP;
  fallo → `pending_review`).
