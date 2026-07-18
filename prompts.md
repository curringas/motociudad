# prompts.md — MotoCiudad

> Registro del trabajo asistido por IA en el desarrollo de **MotoCiudad**: metodología,
> herramientas (Claude Code, MCPs), operaciones, tests y los prompts más relevantes,
> con un histórico de cómo se ha llegado hasta aquí.
> Autor: Curro Martínez Hidalgo (CMH).

---

## 1. Metodología y herramientas de IA

El proyecto se ha desarrollado con **Claude Code** (CLI de Anthropic, modelo **Claude
Opus 4.8**, contexto 1M) siguiendo **Spec Driven Development (SDD)**: antes de tocar
código se escribe/actualiza el spec, luego un plan de implementación tarea a tarea, y
después se implementa con TDD y commits frecuentes.

El proyecto usa **dos sistemas SDD en paralelo**:

**a) Skills "superpowers" (flujo asistido por IA):**
- `brainstorming` → convierte una idea en diseño validado (preguntas 1 a 1, alternativas, aprobación).
- `writing-plans` → plan de implementación tarea a tarea, con código y comandos exactos.
- `executing-plans` → ejecución del plan con verificación (typecheck + tests) y commits por tarea.
- `systematic-debugging` → causa raíz antes de arreglar (usado con la deuda de tests).
- Memoria persistente del proyecto (decisiones, deuda, convenciones).

**b) OpenSpec (CLI v1.3.1 + skills `openspec-*` / `opsx:*`):**
Sistema spec-driven basado en *changes* (`openspec/changes/<id>/` con `proposal.md`,
spec deltas y `tasks.md`). Ciclo: `explore → propose → apply → archive`. CLI para
inspeccionar/validar (`openspec list|show|validate|status|view|archive`).

**MCPs (Model Context Protocol) conectados:**
- **Supabase** (HTTP, `https://mcp.supabase.com/mcp`): esquema, migraciones, logs, advisors, tipos.
- **XcodeBuildMCP** (`xcodebuildmcp@2.6.2 mcp`, stdio): build/run/test de la app en simulador iOS, capturas y snapshots de UI.
- **Playwright** (browser MCP): automatización de navegador para probar y verificar la **versión web** (navegación, snapshots, capturas, interacción con el mapa/buscador en el browser).

**Otras prácticas:**
- **Git worktrees** para trabajo en paralelo: un worktree para iPhone (gamificación/verificación) y otro para la versión web.
- **Conventional Commits** (es-ES), código/comentarios en inglés, UI en castellano.
- Documentos canónicos en `docs/` (`prd.md`, `arquitectura.md`, `modelo-datos.md`, `gamificacion.md`, `testing.md`, `infraestructura.md`) mantenidos en sincronía con el código.

---

## 2. Histórico del proyecto (fases)

> Cronología reconstruida desde el histórico de git. Los prompts literales están en la §3;
> las fases más antiguas se resumen por su resultado (commits) porque no todos los prompts
> originales quedaron registrados.

| Fecha | Fase | Qué se hizo | Commits |
|---|---|---|---|
| 2026-05-25 | Arranque | Estructura inicial del repo | `897a5f6` |
| 2026-05-28 | Aportar + web base | Fix de mapa y registro de Octanos vía Edge Function; Metro configurado para navegador | `fe50ab9`, `2db6cd0` |
| 2026-07-06 | Fix mapa | Pins que desaparecían al mover el mapa; mejora del flujo de aportar | `6064cb8` |
| 2026-07-10 | MVP completo | App móvil + backend Supabase (PostGIS, RLS, Edge Functions) + CI/CD; README para evaluación; capturas | `fec5241`, `0afdda6`, `6ca4d3f` |
| 2026-07-10 | MCP simulador | Se añade XcodeBuildMCP y se corrige (pin a 2.6.2 + subcomando `mcp`) | `001753c`, `4945012` |
| 2026-07-10 | Gamificación (worktree iPhone) | Octanos y nivel en Perfil (levels, schemas, hook, tarjeta OctanosSummary) | `9348053`…`44b1c12`, `47912a7` |
| 2026-07-10 | Verificaciones (worktree iPhone) | Baremo 40/25/10 con tope de 3, pre-check de distancia, fotos, badge | `25fb03c`, `26e2a6c` |
| 2026-07-10/11 | Integración entrega 2 | Merge de worktree iPhone en main; fix de tipos del mapa | `0ffc96c`, `b6688df` (tag `entrega2`) |
| 2026-07-11 | **Buscador (entrega final)** | SDD completo: diseño → plan → api+tests → hook → componente → integración → docs | `e74fbe5`…`42cac40` |
| 2026-07-18 | Saneamiento de tests | deeplinks reescrito, `vitest run`, migración de ParkingMapPin a `@testing-library/react` | `6db9f54`, `d197d55`, `8a7c033` |
| 2026-07-18 | **Versión web (entrega final)** | Web de consulta (Leaflet+OSM, buscador Nominatim, responsive, shims web) e integración en main | `745bdbe`, `352bbad` |
| 2026-07-18 | Cierre entrega final | Bitácora `entrega-final-CMH.md`, verificación del buscador en simulador | `c47f8fe`, `d71f7d8`, `75abf57` |

**Artefactos SDD generados:**
- **Skills superpowers** (`docs/superpowers/`):
  - Specs: `octanos-perfil-design`, `version-web-design`, `buscador-mapa-design`.
  - Planes: `propose-parking-edge-function-y-fix-mapa`, `octanos-perfil`, `version-web`, `buscador-mapa`.
- **OpenSpec** (`openspec/changes/`):
  - `motociudad-mvp` — change del MVP (`proposal.md` + `design.md` + `tasks.md`), 71/83 tareas.

---

## 3. Prompts relevantes (literales)

> Prompts reales del usuario en las sesiones registradas (entrega 2 → entrega final).
> Se agrupan por categoría; entre paréntesis, lo que desencadenó cada uno.

### 3.1 MCP y entorno
- `¿qué problema hay con xcodebuild mcp?` → diagnóstico: la v2 del paquete no arranca sin el subcomando `mcp` (imprimía la ayuda y salía → timeout `-32000`).
- `fija la versión` → pin de `xcodebuildmcp@2.6.2` en `.mcp.json` para evitar roturas por `@latest`.
- `verifica el buscador en el simulador` → build/run en simulador iOS vía XcodeBuildMCP, snapshots y capturas de UI.

### 3.2 Producto / SDD (feature nueva)
- `Me gustaría añadir un buscador en la app móvil sobre el mapa para buscar calle, ciudad, etc. y dirigirte allí para ver los parkings disponibles`
  → arrancó el flujo `brainstorming` (geocoding con expo-location vs Google Places; solo centrar vs pin de referencia; barra fija vs icono).
- Respuestas de diseño: `vamos con A` (expo-location, gratis) · `solo centrar el mapa` · `a` (barra fija arriba).
- `escribe el plan de implementación` → `writing-plans` (plan tarea a tarea).
- `adelante` → `executing-plans` (implementación con TDD y commits por tarea).

### 3.3 Ops / Git
- `une la rama worktree-iphone a esta main` → merge del worktree iPhone (Octanos + verificaciones) en `main`, resolución de estado y verificación.
- `si commitea` / `y push` → commit y push.
- Creación de la rama de entrega: `crea rama desde main commiteado llamada feature-entrega2-CMH … Esta rama será la última versión en GitHub`.
- `No hay que dejarla para dejar constancia de cómo estaba la app cuando hice la entrega 2` → se conserva `feature-entrega2-CMH` como snapshot + tag `entrega2`.
- `vamos a integrar todo en main` → fast-forward de `main` a la rama de trabajo + push.
- `lo que sugieres` → tag `entrega2` + análisis del worktree web.
- `Púshealo y añade la versión web a la bitácora`.

### 3.4 Tests / deuda técnica
- `vamos a por la deuda` / `vamos a por lo que tenemos pendiente` → saneamiento de la infraestructura de tests con `systematic-debugging`.
- `ok migra` → migración de `ParkingMapPin` de RNTL (incompatible con Vitest) a `@testing-library/react` + react-native-web.

### 3.5 Seguimiento / gestión
- `recuérdame cómo vamos en el proyecto` → resumen de estado (features, tareas OpenSpec, pendientes).
- `se supone que tengo que llevar un archivo prompts.md … ¿podríamos recopilar cosas para rellenarlo?` → este documento.

---

## 4. Operaciones (ops) realizadas con IA

- **Gestión de ramas y worktrees:** creación/merge de `worktree-iphone` y `worktree-web` en `main`; rama de entrega `feature-entrega2-CMH`; tag `entrega2` como snapshot de la entrega 2.
- **Resolución de incidencias de integración:** detección de un `HEAD` detached tras un `git checkout`, recuperación a `main` sin perder trabajo; resolución de conflictos previsibles (docs, `package.json`, `pnpm-lock`).
- **Verificación previa a integrar:** siempre `pnpm typecheck` + suite de tests antes de merge/push.
- **Diagnóstico de runtime:** redbox de Expo Router causado por un **Metro obsoleto** de un worktree borrado → arranque de Metro limpio (`expo start --clear`).
- **CI/CD:** GitHub Actions + EAS (definido en el MVP; ver `docs/infraestructura.md`).

---

## 5. Tests

- **Runner:** Vitest (app) + suite web separada (`vitest.web.config.ts`).
- **Estado final:** app **39/39** (9 ficheros) + web **5/5** (2 ficheros); typecheck limpio.
- **Trabajo de tests asistido por IA:**
  - `features/search/api.ts` (`geocodeAddress`) con `expo-location` mockeado (TDD).
  - `deeplinks.test.ts` reescrito para la implementación real (ActionSheetIOS / comgooglemaps / web).
  - Script `test` cambiado a `vitest run` (antes colgaba en modo watch); `test:watch` añadido.
  - **Decisión de arquitectura de tests:** los tests de componentes usan `@testing-library/react` + react-native-web (RNTL es incompatible con Vitest — carga el `react-native` real con sintaxis Flow). Documentado en `docs/testing.md` §5.0.
- **E2E:** Maestro (flows definidos en `docs/testing.md`); **RLS:** pgTAP.

---

## 6. MCPs (uso concreto)

- **Supabase MCP:** consulta de esquema/tablas, migraciones, logs y advisors, generación de tipos TypeScript; configuración del cliente (URL + publishable key).
- **XcodeBuildMCP:** `discover_projs`, `list_schemes`, `list_sims`, `session_set_defaults`, `build_run_sim`, `launch_app_sim`, `screenshot`, `snapshot_ui` — para compilar y ejecutar la app en el simulador iOS y verificar la UI (p. ej. el buscador). Limitación encontrada: la automatización de UI (tap/tecleo) no está habilitada en esta instalación, por lo que el tecleo end-to-end lo hizo el usuario y la IA verificó por captura.
- **Playwright MCP:** automatización de navegador para la **versión web** — navegar la app en el browser, tomar snapshots/capturas y ejercitar la UI (mapa Leaflet, buscador Nominatim, fichas) para verificar el port web fuera del simulador nativo.

---

## 7. Notas de honestidad sobre este registro

- Los prompts de la §3 son **literales** de las sesiones registradas (entrega 2 en adelante).
- Las fases más antiguas (MVP, gamificación, verificaciones iniciales, base web) se resumen por su **resultado en git**, no por el prompt original, porque no todos quedaron registrados. Si conservas esos prompts, este es el sitio para añadirlos.
- Documento vivo: se actualiza con cada nueva feature/corrección de la entrega final (ver también `entrega-final-CMH.md`).
