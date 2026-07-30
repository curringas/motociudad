## Why

Hoy cualquier parking propuesto por un usuario entra directo a la cola `pending`
a la espera de que otro motero lo verifique in situ. Nada impide que se cuele
morralla (una foto que no es un aparcamiento, un nombre sin sentido, notas
incoherentes con la imagen). Queremos un **filtro de calidad por IA en el momento
de proponer** —el agente **Otto**— que compruebe que nombre + notas + foto
correspondan de verdad a un aparcamiento de motos, replicando la experiencia que
ya damos en comentarios ("en revisión por nuestro agente de IA"), sin sustituir
la verificación comunitaria.

## What Changes

- **Nuevo agente "Otto"**: al proponer un parking, una verificación por IA
  (visión + texto) dictamina en el acto uno de tres estados, en un campo
  **independiente** del estado de verificación comunitaria.
- **Nuevo estado `ai_review_status`** en `parkings` (`approved` | `flagged` |
  `rejected`) + `ai_review_reason`, `ai_reviewed_at`, `ai_review_source`. NO
  reutiliza ni modifica el enum `parking_status` (pending/verified/…), que sigue
  siendo la verificación comunitaria.
- **Flujo síncrono** dentro de `propose-parking`:
  - `approved` → el parking entra al pipeline `pending` (visible al proponente,
    esperando verificación comunitaria) y se otorgan los **+50 Octanos**
    (pendientes, como siempre).
  - `flagged` (dudoso, o error/timeout de la IA → failsafe) → NO se publica;
    espera revisión de un administrador; **sin Octanos** hasta que el admin lo
    apruebe.
  - `rejected` → NO se publica; **sin Octanos**.
- **BREAKING (visibilidad)**: un parking solo participa en el flujo público /
  verificable por la comunidad cuando `ai_review_status = 'approved'`. Los
  `flagged`/`rejected` son visibles solo para su proponente y para administradores.
- **Octanos diferidos**: el `+50` deja de otorgarse incondicionalmente al
  insertar; se otorga cuando el parking entra a `pending` (Otto-approved directo,
  o admin-approved tras `flagged`).
- **Panel admin**: filtros por `ai_review_status` (dudosos, rechazados) y por
  "no verificados por usuarios" (approved+pending), y acción **aprobar** un
  dudoso (lo publica en `pending` y otorga los Octanos).
- **Aviso por email (SMTP propio)** al administrador por **cada** parking
  `flagged` y **cada** `rejected`.
- **Feedback al proponente**: spinner "Nuestro agente motero de IA Otto está
  verificando tu aportación…" durante el invoke y, en la misma respuesta, uno de
  los tres mensajes de veredicto.
- **Visión vía proveedor OpenAI-compatible** (el más económico; reutiliza el
  patrón de llamada de `_shared/moderation.ts`). DeepSeek queda descartado para
  visión: su API pública es solo texto.
- **Sin foto** → Otto verifica solo con texto (nombre + notas).

## Capabilities

### New Capabilities
- `otto-parking-verification`: la revisión por IA en sí — Edge Function de
  verificación (visión + texto), los tres estados `ai_review_status`, el
  failsafe a `flagged`, el aviso por email al admin, y el prompt versionado de
  Otto.

### Modified Capabilities
- `propose-parking`: añade el gate de Otto en el flujo de propuesta y mueve el
  otorgamiento de los +50 Octanos al momento de entrar a `pending`.
- `admin-parking-management`: nuevos filtros por `ai_review_status` y por
  no-verificados-por-usuarios, más la acción de aprobar un parking `flagged`.
- `nearby-parkings`: la visibilidad pública exige además
  `ai_review_status = 'approved'` (los no aprobados no aparecen en mapa/lista).
- `verify-parking`: solo los parkings `ai_review_status = 'approved'` son
  verificables por la comunidad.

## Impact

- **Base de datos**: migración que añade `ai_review_status` (+ enum) y columnas
  asociadas a `parkings`; ajuste de RLS/vistas para gatear visibilidad y
  verificación por `approved`; test pgTAP.
- **Edge Functions**: nueva función de verificación (o integración dentro de
  `propose-parking`); nueva función admin para aprobar un `flagged`; envío SMTP
  best-effort; mover la creación del `octano_event` al momento de aprobación.
- **Secrets nuevos**: credenciales del proveedor de visión (OpenAI-compatible) y
  del SMTP propio (host/puerto/usuario/clave, destinatario admin).
- **Móvil**: `features/parkings` (spinner + 3 mensajes de veredicto en el flujo
  de propuesta); presenter para mapear `ai_review_status`.
- **Panel web admin**: `features/admin` (filtros nuevos + acción aprobar).
- **Docs canónicos**: `prd.md` (rol de Otto — reconciliar con el "Otto" scout de
  descubrimiento ya reservado en v1.6), `modelo-datos.md` (nuevas columnas y
  estados), `gamificacion.md` (nuevo momento de otorgamiento de los +50 Octanos),
  `infraestructura.md` (nuevos secrets), `testing.md` si aplica.

## Non-goals

- **No** sustituye la verificación comunitaria in situ: Otto solo filtra la
  entrada; que un parking exista de verdad lo siguen confirmando los moteros.
- **No** hay cola asíncrona ni triggers/pg_net/cron: la verificación es síncrona,
  como la moderación de comentarios.
- **No** se auto-hospedan modelos de visión (DeepSeek-VL, etc.): se usa una API
  de visión gestionada.
- **No** se notifica al proponente por email; solo mensajes in-app. El email es
  únicamente el aviso al administrador.
- **No** se toca el flujo de descubrimiento automático de parkings (el "Otto
  scout" de Google Places del roadmap v1.6); aquí Otto solo verifica aportaciones
  de usuarios.
- **No** se re-verifican con IA los parkings ya existentes/importados de OSM.
