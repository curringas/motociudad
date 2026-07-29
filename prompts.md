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
| 2026-07-18 | **Panel admin — backend (entrega final)** | Change OpenSpec `admin-panel`: roles/suspensión, funciones/triggers RLS, policies, Edge Function `admin-set-role` | `92f4588`, `5c15807`, `f9b5d90`, `35a3eb1` |
| 2026-07-18 | **Panel admin — panel web + cierre (entrega final)** | `/opsx:apply`: pgTAP+Deno+Vitest, slice `features/admin`, rutas `app/admin`, fix RLS de borrado (mig. 000007), despliegue a Cloud, E2E Playwright y archivado del change | rama `feature-admin-panel-CMH` |
| 2026-07-19 | **Prueba en Android (entrega final)** | Build nativo en emulador: fix de deps SDK 54, config de Google Maps API key, y fix de un bug real (markers de parking invisibles en Android por `tracksViewChanges`) | PR #7 (`fix/android-build-google-maps`) |
| 2026-07-19 | **Ranking de Octanos (entrega final)** | Change OpenSpec `ranking-octanos` con `/opsx:propose`+`/opsx:apply`: migración `mv_ranking_by_city` + grants, slice `features/ranking` (UI + hooks), auth-gate sin sesión, pgTAP + Vitest + Maestro; E2E en web/iOS/Android; desplegado a Cloud + web; change archivado | PR #8 (`feat/ranking-octanos`) |
| 2026-07-20/22 | **Comentarios en parkings (entrega final)** | Change OpenSpec `add-parking-comments` con `/opsx:explore`+`/opsx:propose`+`/opsx:apply`: tablas `comments`/`comment_votes` (RLS+pgTAP), RPCs atómicas, 3 Edge Functions (post/vote/delete-comment), slice `features/comments` (móvil+web); **escalera de Octanos +10/+5** acumulable con `useful_comment`, sin geolocalización; desplegado a Cloud + E2E lógica/HTTP/UI Android; fix UX teclado; change archivado | PR #10 (`comentarios`) |
| 2026-07-22 | **Regla de verificación E2E multiplataforma (DX)** | Regla de cierre para todo `opsx:apply`: skill `verify-all-platforms` + subagente `e2e-verifier` (web/Playwright + Android/adb + iOS/XcodeBuildMCP, login usuario+admin, limpieza de datos) + regla en `CLAUDE.md`/`openspec/config.yaml` + **hook** que bloquea `openspec archive` sin evidencia; se habilita `ui-automation` de XcodeBuildMCP y se crea cuenta `E2E_USER_*` | PR #13 (`chore/verify-all-platforms-gate`) |
| 2026-07-24 | **Moderación IA de comentarios (entrega final)** | Change OpenSpec `ai-comment-moderation` (explore→propose→apply): puerta **síncrona** en `post-comment` con pre-filtros + **DeepSeek** (`deepseek-v4-flash`), veredicto `allow`/`reject`/`flag`; columna `moderation_status` (+RLS de visibilidad por estado), Octanos **diferidos** a la aprobación, **fail-safe** (nunca aprueba por defecto) → cola mínima en el panel. Verificado E2E (web+Android; iOS build/render) con **fixes reales** (CORS en respuestas de error, teclado iOS, off-topic estricto); desplegado a Cloud, archivado | PR #15 (`feat/comments-ai-validation`) |
| 2026-07-26 | **Gestión de comentarios + panel claro (entrega final)** | Change OpenSpec `admin-comments-management` (brainstorming con **companion visual** → propose → apply): gestión completa (listado **paginado 50**, buscar, **filtro de ciudad por texto**, acciones en bloque, **eliminar = hard delete + retirada de Octanos**) + **rediseño del panel a tema claro** (excepción MVP; app móvil oscura) con kit `features/admin/ui.tsx`; paginación 50 también en Usuarios/Parkings. E2E web (admin), desplegado a Cloud, archivado | PR #16 (`feat/admin-comments-management`) |
| 2026-07-27 | **Perfil editable + perfiles públicos (entrega final)** | Change OpenSpec `edit-profile` (`/opsx:propose` con 2 rondas de aclaración → `/opsx:apply`): editar **nick (@handle)** único case-insensitive (índice `LOWER(username)` + CHECK) que dirige la identidad pública, **ciudad** por buscador (Edge Function **`city-search`** proxy a Nominatim/OSM, activa el ranking por ciudad) y **avatar** (bucket `avatars` con MIME/tamaño + policies de carpeta propia, re-codificado 512×512 en cliente). **Perfiles públicos** (`/user/[id]`) + autoría (proponente, autor de comentario, modal de verificadores; `ranking_visible`). **Hardening**: guard congela los campos caché de Octanos/nivel. 4 migraciones + Edge Function a Cloud vía MCP; Vitest 128/128, deno 11/11; E2E **Web+Android PASS**, iOS build+arranque PASS (login validado por el usuario); archivado | PR #17 (`feat/edit-profile`) |
| 2026-07-28 | **Fixes de UI en Android real (entrega final)** | Detalles reportados probando en dispositivo: **safe-area de la tab bar** (SDK 54 edge-to-edge la tapaba con la barra de navegación) → `useSafeAreaInsets`; y el detalle del parking, que era un panel estático con asa decorativa, reescrito como **bottom sheet arrastrable** (gesture-handler + reanimated; `@gorhom/bottom-sheet` no respondía a gestos bajo reanimated 4) con backdrop para cerrar. Verificado en emulador (adb) | PR #24 (`fix/android-ui-safearea-sheet`) |
| 2026-07-28 | **Distribución en Google Play + OTA (entrega final)** | Primera publicación: **rename de paquete a `com.motociudad.app`**; config EAS (AAB, `versionCode` manual —`autoIncrement` no va con `app.config.ts`—, `environment=production` + variables `EXPO_PUBLIC_*` en EAS, `eas submit` con **service account**); builds 1/2/3 firmados por **Play App Signing**; **pista interna → abierta** (`track: beta`, auto-rollout). **EAS Update (OTA)** para empujar cambios de JS sin recompilar (`runtimeVersion: appVersion` tras fallar `fingerprint` en "Configure expo-updates"). **Legal**: política de privacidad y página de **eliminación de cuenta** servidas en motociudad.com (`public/*.html`); guía **Data Safety** campo a campo; cuenta admin de review (`googleplayconsole@`). **Ficha**: textos + **icono de marca** (pin de mapa + moto) y **gráfico de funciones 1024×500** renderizados con **Playwright MCP** desde HTML; capturas reales de Android → carpeta `googleplay/`. Higiene: `.env` saneado (EXPO_TOKEN/service_role), workflow EAS a `workflow_dispatch`. Roadmap ampliado (v1.8 **verificación de fotos con IA**; **reportes de abuso/incidencias** al panel; **entradas in-app**: eliminar cuenta, reportar) | PRs #18–#35 |

**Artefactos SDD generados:**
- **Skills superpowers** (`docs/superpowers/`):
  - Specs: `octanos-perfil-design`, `version-web-design`, `buscador-mapa-design`.
  - Planes: `propose-parking-edge-function-y-fix-mapa`, `octanos-perfil`, `version-web`, `buscador-mapa`.
- **OpenSpec** (`openspec/changes/`):
  - `motociudad-mvp` — change del MVP (`proposal.md` + `design.md` + `tasks.md`), 71/83 tareas.
  - `admin-panel` — change del panel de administración (proposal + design + 3 specs + tasks), **36/36 tareas, archivado** en `openspec/changes/archive/2026-07-18-admin-panel/`. Specs canónicas sincronizadas a `openspec/specs/{user-roles,admin-user-management,admin-parking-management}/`.
  - `ranking-octanos` — change del ranking (proposal + design + spec + tasks), **archivado** en `openspec/changes/archive/2026-07-19-ranking-octanos/`. Spec canónica en `openspec/specs/ranking-octanos/`.
  - `add-parking-comments` — change de comentarios (proposal + design + spec + tasks), **archivado** en `openspec/changes/archive/2026-07-20-add-parking-comments/`. Spec canónica en `openspec/specs/parking-comments/`.
  - `ai-comment-moderation` — moderación IA (proposal + design + 2 specs + tasks), **archivado** en `openspec/changes/archive/2026-07-26-ai-comment-moderation/`. Specs canónicas: `comment-moderation` (nueva) + `parking-comments` (actualizada).
  - `admin-comments-management` — gestión de comentarios + panel claro (proposal + design + 2 specs + tasks), **archivado** en `openspec/changes/archive/2026-07-26-admin-comments-management/`. Specs canónicas: `admin-comment-management` (nueva) + `comment-moderation` (actualizada).
  - `edit-profile` — perfil editable + perfiles públicos y autoría (proposal + design + 3 specs + tasks), **archivado** en `openspec/changes/archive/2026-07-27-edit-profile/`. Specs canónicas: `user-profile`, `city-search`, `public-user-profiles` (nuevas).

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

### 3.6 Panel de administración (entrega final)
- `/opsx:apply admin-panel` → implementación de las tareas del change OpenSpec `admin-panel`
  (grupos 4–8): al aplicar se descubrió y corrigió un **bug real de RLS** (el admin no podía
  borrar/archivar) → nueva migración `parkings_read_admin`; se escribieron pgTAP/Deno/Vitest,
  el slice `features/admin`, las rutas `app/admin/*.web.tsx` y se saneó la suite pgTAP.
- `si` (¿desplegar a Cloud?) → aplicar la migración 000007 a Supabase Cloud (MCP) y redeploy
  de `propose-parking`/`validate-verification` (CLI).
- `Puedes usar el usuario administrador … guárdalo en .env para cada vez que pruebes E2E con mcps`
  → credenciales de admin para E2E guardadas en `apps/mobile/.env` (gitignored) como
  `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` (contraseña nunca en git ni en memoria).
- `si` (¿verificación manual?) → **E2E con Playwright MCP**: deny sin sesión, login como admin,
  crear/verificar/borrar parking y cambio de rol de usuario; verificado en BD; datos limpiados.
- `/opsx:archive admin-panel` + `Sincronizar y archivar` → sync de las 3 delta specs a
  `openspec/specs/` y archivado del change.
- `prepara los commits pero revisa que quede documentado todo … recuerda que esto es la entrega
  de un proyecto final de máster de AI4DEVS` → esta tanda de commits + actualización de
  `README.md`, `entrega-final-CMH.md` y este `prompts.md`.

### 3.7 Prueba en Android (entrega final)
- `me gustaria probar la app en android me ayudas?` → arrancó el emulador `Pixel_4_API_34`
  y el build nativo (`expo run:android`, dev build — Expo Go no vale). Se descubrió y corrigió
  un **desajuste de dependencias**: `expo-dev-client ^56` y `expo-file-system ^57` eran de una
  SDK futura e incompatibles con `expo-modules-core@3.0.30` (rompían la compilación Kotlin);
  se fijaron a las de SDK 54 (`~6.0.21` y `~19.0.22`).
- Segundo bloqueo detectado: en Android el mapa fuerza `PROVIDER_GOOGLE`, que exige una
  **Google Maps API key** (`com.google.android.geo.API_KEY`) — sin ella, crash al montar el
  `MapView`. Se cableó `app.config.ts` para leerla de `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY`.
- `a ver no se configurar la api key, ayudame … ¿cuáles [restricciones] selecciono?` /
  `pues creo que ya esta` / `ya está guardado, recarga la app` → guía paso a paso en Google
  Cloud Console (habilitar **Maps SDK for Android** + facturación + restricción por app con la
  huella SHA-1 del debug keystore). Clave: tras poner/cambiar la key hay que
  `expo prebuild -p android --clean` (un `expo run:android` normal no regenera el manifest).
  Verificado: el mapa de Google carga teselas correctamente.
- `veo que los parkings no se estan mostrando en android` → **`systematic-debugging`**: se
  descartó problema de datos (el RPC `nearby_parkings` devuelve 8 parkings en el centro de
  Madrid vía Supabase MCP) y se localizó la **causa raíz**: `ParkingMapPin` usaba
  `tracksViewChanges={false}` desde el montaje; en Android react-native-maps snapshotea el
  marker custom antes de pintarse → pins invisibles (en iOS el snapshot al montar es correcto).
  Fix: en Android arrancar con tracking activo y desactivarlo tras el primer frame. Verificado
  en emulador (pins "M" visibles); typecheck + 55/55 tests en verde.
- `Recuerda documentar … rellena prompts.md … commit, push, pr y mergea` → esta entrada +
  merge del PR #7 a `main`. (Los POIs de Google que se ven en Android se dejan a propósito:
  *«no estorban y orientan más dónde estás situado»*.)

### 3.8 Ranking de Octanos (entrega final)
- `La sección de Ranking de octanos esta realizada?` → auditoría del estado: backend (`mv_ranking_global`)
  y specs existían, pero la pantalla del tab era un placeholder "Próximamente" (≈20% hecho).
- `lo podemos hacer con opsx?` → `/opsx:propose ranking-octanos`: proposal + design + spec + tasks.
- `/opsx:apply` → implementación: migración `mv_ranking_by_city` (partición por ciudad) + grants,
  slice `features/ranking` (schemas/api/hooks con `useInfiniteQuery`/presenter/componentes), pantalla,
  pgTAP + Vitest + flow Maestro. Se pausó antes de tocar Cloud para pedir confirmación.
- `Pruebalo e2e con mcps y me lo dejas levantado que lo vea` → `apply_migration` a Supabase Cloud +
  verificación con `execute_sql` (contenido de las MV, grants, privacidad) + `generate_typescript_types`;
  app levantada en web y verificada con **Playwright MCP** (login, podio, "Tu posición", Mi ciudad).
- `si no estoy registrado da error … poner que es necesario validarse … boton de inicia sesion como en
  aportar` → **fix**: auth-gate en `RankingScreen` (sin sesión, prompt de login en vez del error de carga)
  + `enabled` en `useRanking` para no lanzar consultas anónimas; 2 tests nuevos.
- `pues cierra o archiva el spec push y pr y anota que el roadmap … usuarios al registrarse apunten su
  ciudad no?` → `/opsx:archive` + sync de spec, nota de roadmap en `docs/prd.md` (capturar `city_primary`
  en el registro), commit + push + **PR #8**.
- `lo has probado en emuladores?` / `cuando diga que pruebes o hagas e2e … tiene que ser en todos lados
  en los que se vea … el panel de administracion solo … web pero el resto … en cada sitio` → E2E en las
  **3 plataformas**: web (Playwright), iOS (render nativo del gate; sin tap/type en el MCP) y Android
  (flujo completo logueado automatizado con `adb input`: podio con resaltado + Mi ciudad). Pauta anotada
  en memoria para próximas sesiones.
- `mergea a main la pr si no lo hiciste y lo dejamos todo en produccion` → el primer CI falló por **mi
  test pgTAP** (el trigger `handle_new_user` creaba la fila antes que el INSERT → `DO NOTHING` no fijaba
  los campos): fix con `ON CONFLICT DO UPDATE` + ciudades de prueba únicas, verificado con `supabase test
  db` local en verde. Merge de PR #8; el push a `main` no disparó el CD (filtro `paths` en merge commit),
  así que se lanzó **Deploy Web** con `workflow_dispatch` → web en producción.
- `algo que poner en prompts o docs?` → esta entrada.

### 3.9 Comentarios en parkings (entrega final)
- `/opsx:explore Añadir comentarios en los parkings. el primer comentario seran 10 octanos para
  el primer comentario diferente del que creo el parking y de cualquiera que lo verifique … hay
  que cambiar gamificación, hay que añadir la posibilidad de comentar, no será necesario estar en
  el lugar para comentar` → modo explore: se detectó que `comments`/`comment_votes` ya estaban
  **diseñadas** en `modelo-datos.md` §6.6–6.7 pero nunca implementadas, y que la regla del usuario
  **difería** de la documentada (`useful_comment` +5 por upvotes). Con `AskUserQuestion` se cerró el
  modelo: escalera **+10 (1º elegible) / +5 (2º)** que **evolucionó** a incluir el 2º puesto por
  idea del usuario (`creo que el segundo comentario también podemos otorgar 5 puntos`), acumulable
  con `useful_comment`, gate = registrado + **email confirmado**, sin geolocalización, elegible =
  autor ≠ proponente y ≠ verificador (no consumen puesto), sin clawback.
- `/opsx:propose` → proposal + design (6 decisiones con alternativas) + spec `parking-comments`
  (8 requisitos SHALL/MUST) + tasks (32).
- `/opsx:apply` → implementación completa: 4 migraciones (enum, tablas+RLS, RPCs+índices
  anti-carrera, `comments_count`), 2 ficheros pgTAP (13+32 asserts), 3 Edge Functions Deno+Zod
  con tests, slice `features/comments`, integración en detalle de parking (móvil+web) y docs.
- `si hazlo todo en cloud no esta aun en producción, haz test e2e para comprobar que funciona`
  → **Supabase MCP**: `apply_migration` ×4 + `deploy_edge_function` ×3 + `generate_typescript_types`
  + `get_advisors` (sin issues nuevos). E2E de **lógica** contra Cloud con un bloque `DO` que se
  auto-revierte por excepción centinela (32 asserts) y E2E **HTTP** invocando las Edge Functions con
  un JWT real (401/400/200 +10/429/422/200); datos de prueba limpiados y caché de Octanos recalculada.
- `primero prueba en emulador` → E2E de **UI en emulador Android** (`adb`): login, detalle de parking,
  publicar comentario (+10 con banner), votar y **borrar**; datos reales limpiados por SQL tras la prueba.
- `Pues mejora los findings` → sobre los 3 hallazgos de la verificación: (2) banner de Octanos que era
  fugaz → **banner de color persistente** (6 s) en `CommentsSection`; (3) el teclado tapaba el botón →
  `login.tsx` en `ScrollView` + `keyboardShouldPersistTaps` en el detalle; (1) deep-link a parking = artefacto
  del dev-client, no se tocó routing. Re-verificado en emulador.
- `en android al tomar la foto parece que la foto no se muestra. En el emulador` +
  `1 por ahora solo he probado en emulador android. 2 recuadro gris vacio. 3 acabo de hacerla y se
  queda el cuadro gris vacio` → **`systematic-debugging`** con instrumentación: el feed en vivo del
  `CameraView` ya sale **negro** → causa raíz = cámara trasera del AVD en `hw.camera.back=virtualscene`
  (no renderiza), la foto capturada es negra. **No es bug de la app** (funciona en dispositivo real);
  instrumentación revertida.
- `si no es un problema real pues hacemos … el archive de openspec commit push y pr` /
  `haz el merge y lo que falte para tener todo actualizado` → `openspec archive` (sync de la spec
  `parking-comments` + movida a `archive/`), commit en la rama `comentarios`, push, **PR #10** y merge a `main`.
- `tenemos el prompts y docs actualizados? con la nueva feature` → esta entrada (§3.9) + fila en §2 +
  artefacto OpenSpec; los docs canónicos (`gamificacion.md` §2.3, `prd.md` F16, `modelo-datos.md`,
  `testing.md` §8.5) ya iban en el PR #10.

### 3.10 Regla de verificación E2E multiplataforma (DX / entrega final)
- `cómo podemos hacer para trabajar con opsx que el apply tenga como regla final probar con
  playwright, emu en android y emu en iphone y con un usuario si es necesario validarse, tanto como
  usuario como administrador para el panel de administración … a ver qué se te ocurre junto con esta
  docs [features-overview] o quizás con la propia doc de openspec` → lectura de la doc de features de
  Claude Code (WebFetch) + cómo funciona OpenSpec por dentro (`openspec/config.yaml` inyecta `context`
  y `rules`). Propuesta de arquitectura por capas: **skill** (procedimiento), **subagente** (aislar el
  E2E que inunda el contexto), **CLAUDE.md/rules** (regla) y **hook** (garantía). Cita clave de la doc:
  *"una instrucción es una petición, no una garantía; si una regla debe cumplirse siempre, hazla un hook"*.
- Decisiones vía `AskUserQuestion`: **regla + hook (garantía)** · **intentar habilitar la UI-automation de
  iOS** · **subagente `e2e-verifier`**.
- Implementación: `.claude/skills/verify-all-platforms/SKILL.md` (matriz por superficie, login user+admin
  desde `.env`, patrones robustos de adb/Xcode/Playwright aprendidos en la sesión de comentarios,
  limpieza de datos, evidencia), subagente `.claude/agents/e2e-verifier.md`, regla en `CLAUDE.md` (#7) y
  `openspec/config.yaml` (`context` + `rules.tasks`), hook `.claude/settings.json` +
  `.claude/hooks/require-verify-evidence.py` (bloquea `openspec archive` sin
  `.claude/verify-runs/<change>.md`), y `.xcodebuildmcp/config.yaml` con `enabledWorkflows: [simulator,
  ui-automation]`.
- `necesitas que aporte credenciales en el .env?` → no: `E2E_ADMIN_*` ya estaba y se creó `E2E_USER_*`
  (usuario normal `e2e_user`, email confirmado); ambos verifican login OK contra Cloud.
- `nada salgo y entro ya con el hook` → el hook se activa al recargar config (reiniciar / `/hooks`).
- `añade esta característica en la doc del proyecto en prompts.md` → esta entrada (§3.10) + fila en §2.

### 3.11 Moderación IA de comentarios (entrega final)
- `incluir ia (api de claude) para validación de comentarios, propon la forma de hacerlo y reglas a aplicar. Los comentarios que tenemos ahora son los de los parkings` → `/opsx:explore` sobre el `post-comment` existente. Decisiones (vía `AskUserQuestion`): **Sistema A síncrono** con UX "está siendo revisado", proveedor **DeepSeek** desacoplado (*"a ver qué tal"*, en vez de Claude), `flag` → **cola admin**, **off-topic sin tolerancia**, **fail-safe** (si no se puede validar → `pending_review`, **nunca aprueba por defecto**), **Octanos diferidos** a la aprobación.
- `dejalo preparado para … la siguiente feature … el sistema de comentarios en el panel del administrador` → se entrega solo la **cola mínima** y se anota la gestión rica como feature siguiente (cierra el bucle sin dejar pendientes huérfanos).
- `/opsx:propose` + `/opsx:apply` → `moderation_status` (+RLS de visibilidad +pgTAP), RPCs de Octanos diferidos, `_shared/moderation.ts` (adaptador DeepSeek + **prompt versionado** en `docs/prompts/comment-moderation.md`), Edge Function `admin-moderate-comment`, cliente (estado "en revisión", badge) y cola admin.
- `Deploy con MODERATION_PROVIDER=off primero` · `Pero tienes la api? Esta en los .env` · `Acabo de recargar saldo` → deploy a Cloud (Supabase MCP `apply_migration` + CLI edge), secret `MODERATION_PROVIDER`; la key de DeepSeek estaba en `.env` (`API_KEY_MOTOCIUDAD`); al recargar saldo se detectó que el modelo pasó a **`deepseek-v4-flash`** (antes `deepseek-chat`).
- Verificación (Playwright web + adb Android) con **3 bugs reales corregidos**: (1) **CORS** ausente en las respuestas de error → en web no se veía el motivo de rechazo (fix en `_shared/errors.ts`); (2) teclado iOS tapaba el composer (`automaticallyAdjustKeyboardInsets` + scroll al enfocar); (3) off-topic demasiado permisivo con la charla de moto → prompt afinado ("debe hablar del parking"). `openspec archive` + **PR #15**.

### 3.12 Gestión de comentarios en el panel + tema claro (entrega final)
- `En el anterior feature propusimos un listado de comentarios en el panel de administrador … ver y aprobar los dudosos … buscar entre todos … paginación y un listado más compacto … los flags … buscar por código postal o ciudad` → `brainstorming` con **companion visual** (mockups): fila de **2 líneas** y —tras señalar la regla del MVP— **panel en tema claro** como **excepción consciente** (la app móvil sigue oscura). Modelo: listar solo guardados (`approved`+`pending_review`), **default pendientes**, aprobar/eliminar (**hard delete + retirada de Octanos**), acciones en bloque; ubicación **solo por ciudad** (no existe campo de código postal).
- `todo en un cambio. opción B` → una sola change (gestión + rediseño). `/opsx:propose` + `/opsx:apply`: RPCs `admin_list_comments`/`admin_delete_comments`, Edge Function `admin-delete-comment` + `admin-moderate-comment` en bloque, kit visual claro `features/admin/ui.tsx` y pantalla de gestión.
- `Pagina cada 50. El filtro de ciudad no puede ser con botones porque habra cientos, usa un buscador de texto como en parkings` → página de **50** y filtro de ciudad por **texto (ILIKE)** en vez de chips.
- `Puedes hacer el mismo tipo de listado en parkings y usuarios, paginando por 50 tambien?` → **paginación de 50** también en Usuarios y Parkings (`range()` + count).
- E2E web (Playwright, admin): listar/buscar/filtrar ciudad/aprobar/eliminar (**retirada de Octanos 10→0**)/bloque/paginar + restyle claro verificado. `openspec archive` + **PR #16**; docs (PRD F18, arquitectura §6.6, gamificación, testing §7.4) + README.

### 3.13 Perfil editable + perfiles públicos (entrega final)
- `en el apartado mi perfil, poder cambiar el nombre de usuario (el nic), poner una ciudad bajo el label "Me suelo mover por…" y un avatar … restringido a imágenes y con la seguridad de … ningún archivo malicioso. El nic no podrá estar repetido` → `/opsx:propose edit-profile`: exploración del código (perfil solo mostraba email; columnas ya existían) + 3 preguntas de diseño (ciudad, unicidad del nick, identidad pública). **Recordatorio del usuario**: `empezar todo el proceso en una rama nueva` → `feat/edit-profile`.
- `ahora tenemos correo como usuario … eso no lo quiero perder; el campo tipo @primerapartedelcorreo … es lo que quiero que sea editable como campo aparte. user_self_update lo cerramos aquí. Propón tú el tamaño … Que no quede ninguna pregunta sin contestar` → email en **solo lectura**, nick = @handle editable (escribe `username`+`display_name`), **hardening obligatorio** del guard de Octanos, avatar **2 MB/512×512**, atribución OSM. Se reescriben proposal/design/specs/tasks sin preguntas abiertas.
- `de paso muestra siempre … el nic y avatar del que creó el parking … de cualquier comentario … para las verificaciones un modal … En cualquier parte que se pulse sobre un usuario se podrá ver su perfil` → nueva capacidad `public-user-profiles`: componentes `Avatar`/`UserChip`, ruta `/user/[id]`, embeds de proponente/verificadores, avatar del autor en comentarios (ya se consultaba, se descartaba), filas del ranking pulsables; policy `anon` para leer verificadores en la web pública.
- `/opsx:apply` → 4 migraciones (índice `LOWER(username)`+CHECK con saneo de `handle_new_user`, bucket `avatars`, guard de Octanos, anon-read de verificadores) + pgTAP; Edge Function `city-search` (Deno+Zod, proxy Nominatim) + **deno 11/11**; slice `features/profile` (api/hooks/schemas + `CitySearchInput`/`AvatarPicker`/`EditProfileForm`/`VerifiersModal`); typecheck + **Vitest 128/128** (setup con env + mock de expo-router).
- `verifica con playwright y emuladores` → tras confirmar en Cloud que no había nicks duplicados, despliegue de migraciones + `city-search` **vía Supabase MCP** (`execute_sql` + `deploy_edge_function`, historial con versiones exactas). `verify-all-platforms`/`e2e-verifier`: **Web PASS** + backend/RLS/Storage PASS; rebuild nativo → **Android PASS** (adb: perfil, picker nativo de imágenes, city-search "Málaga, España/Colombia") e **iOS build+arranque PASS** (XcodeBuildMCP); `ya lo he probado yo en iOS. Funciona` (login validado por el usuario). Limpieza de datos confirmada; evidencia en `.claude/verify-runs/edit-profile.md`.

### 3.14 Fixes de UI en Android real (entrega final)
- `la barra de botones de android sale encima de los botones o menú de la aplicación` → safe-area: la tab bar usa `useSafeAreaInsets().bottom` (SDK 54 dibuja tras la barra de navegación).
- `en el mapa, al hacer click en un parking se abre un pequeño detalle … el icono de arriba no hace nada … estaría bien que al subir se vea el detalle completo y al bajar se cierre` → se reescribe `ParkingBottomSheet` como bottom sheet arrastrable con gesture-handler + reanimated (dos alturas + backdrop). Nota honesta: `@gorhom/bottom-sheet` no respondía a gestos con reanimated 4; el drag fino no se pudo validar por `adb` (RNGH ignora toques inyectados), sí el cierre por backdrop.

### 3.15 Distribución en Google Play + OTA + ficha (entrega final)
- `pues arregla las 2 cosas` → `SUPABASE_SERVICE_ROLE_KEY` mal en `apps/mobile/.env` (era la URL; se elimina, no va en el cliente) y se declara el plugin `expo-image-picker` con permiso de fotos.
- `regenera el EXPO_TOKEN` → no es acuñable por CLI (solo dashboard); se quita el token inválido de los `.env` (la CLI usa la sesión `curringas`); se explica qué es Expo vs EAS y que el token solo hace falta para builds EAS en CI.
- `hay un .env en el raíz y otro en apps, ¿son necesarios los 2?` → sí, sirven a herramientas distintas (Expo lee `apps/mobile/.env`; el CLI de Supabase/shell el raíz, que tenía la service_role real y 2 líneas malformadas que rompían el parser → comentadas).
- `ya vamos a probar en google play console nuestra primera versión, ayúdame` → config de release: AAB, `versionCode` manual, variables `EXPO_PUBLIC_*` en EAS, `eas submit` con service account; comprobación de nicks duplicados en Cloud; migraciones + `city-search` desplegadas.
- `mejor sería com.motociudad.app` → **rename de paquete** `es.` → `com.motociudad.app` antes de la 1ª subida (aún no bloqueado).
- `crea [googleplayconsole@…] como administrador y que esté activa` → cuenta de "App access" para la review, creada vía Auth Admin API + rol admin por SQL; login verificado.
- Data Safety guiado campo a campo (ubicación aprox/precisa, email, ID, fotos): `se recogen` sí / `se comparten` **no** (ver contenido público entre usuarios ≠ compartir con terceros); ubicación precisa **no temporal** (se guarda `user_location` en la verificación) + prevención de fraudes.
- `el icono sale un cuadro azul … despliega tu creatividad y haz uno` y `le veo mucho padding … el fondo alrededor del marcador transparente` → icono de marca (pin de mapa amarillo + moto) diseñado en HTML y renderizado con **Playwright MCP**; se explica por qué un icono no debe ser transparente (Play/iOS opacos; máscara adaptativa de Android recorta) y se agranda el pin.
- `voy a usar prueba abierta … quiero que se actualice sola` → `eas submit` a `track: beta` (abierta, auto-rollout) + **OTA** para cambios de JS. Se aclara: promover el build actual en consola una vez; los nuevos builds ya van directos.
- `sí, publica los cambios por OTA cuando estén listos` / `creo que tenemos un icono nuevo` → el icono es **nativo** (no OTA); se lanza el **build 3** (`versionCode 3`) con el icono, que va directo a prueba abierta.

### 3.16 Distribución en App Store (iOS) + ficha con capturas nativas (entrega final)
- `¿puedo ir pasando la app a distribución en App Store sin que falle en TestFlight?` → se aclara que TestFlight y App Store son **el mismo binario** (subir con `eas submit` → processing → se ata a la versión y "Submit for Review"); pasar el processing de TestFlight ≠ pasar App Store Review (más estricto: metadata, App Privacy, **cuenta demo** por el login obligatorio).
- Revisión de `apps/mobile/eas.json` + `app.config.ts` → 4 arreglos pre-envío: (1) se retira **background location** (`NSLocationAlwaysAndWhenInUse` del infoPlist y `locationAlwaysAndWhenInUsePermission` del plugin) tras verificar en el código que solo se usa ubicación en primer plano (evita rechazo Apple 5.1.1); (2) **`buildNumber` 1→2** (`appVersionSource: local` no autoincrementa y el build 1 ya estaba en TestFlight); (3) **`ITSAppUsesNonExemptEncryption: false`** (sin prompt de export compliance en cada subida).
- `pues mejor no tocamos la versión entonces` → se revierte `version` a `0.1.0`: al ser `runtimeVersion: appVersion`, subirla a 1.0.0 cambiaría el runtime y dejaría al Android en review (versionCode 4, runtime 0.1.0) **huérfano de OTA**. Se aclara que el "1.0.0" que el usuario puso en Play Console es solo el *release name* (etiqueta interna), no el versionName ni el runtime del binario.
- `créame una carpeta applestore en el raíz con las imágenes y todo lo que necesitamos` → carpeta `applestore/` con `ficha-textos.md` (todos los campos de App Store Connect en es-ES), `README.md` (checklist), `icon-1024.png` y capturas.
- `si quiero algo más pulido usa el emulador de iOS` → **capturas nativas de iPhone** hechas en el simulador: se crea a mano un **iPhone 14 Plus** (los sim 15/17 dan 1290×2796, tamaño NO aceptado; el 14 Plus da **1284×2778**, exacto para el hueco 6.5"), `expo run:ios`, ubicación del sim fijada a Córdoba para que el mapa saliera lleno de los parkings OSM, y navegación por Mapa/Lista/Ranking/Perfil/Verificar con **XcodeBuildMCP** (`snapshot_ui`/`tap`/`type_text`). El login lo tecleó el usuario (el HID de la automatización mapeaba mal `-` y `@`).
- `puedo poner en copyright mi nombre o un seudónimo?` → sí (campo de texto libre: año + nombre/seudónimo/marca); se distingue del **seller** público, que va atado a la cuenta de Apple (la del amigo) y no se cambia sin transferir la app.
- `el usuario e2e es administrador? … supongo que darle un administrador` → **no**: al revisor se le da el **usuario normal** (`e2e-user@…`), no admin. El panel admin es web (no lo revisa Apple) y exponer herramientas de moderación puede penalizar (Guideline 2.1/5.x).
- Nota de limpieza: se eliminaron un `eas.json` y `app.json` sueltos en la **raíz** (scaffolds por defecto de correr `eas` fuera de `apps/mobile/`, con `submit` vacío) para que no confundieran a la CLI.

---

## 4. Operaciones (ops) realizadas con IA

- **Gestión de ramas y worktrees:** creación/merge de `worktree-iphone` y `worktree-web` en `main`; rama de entrega `feature-entrega2-CMH`; tag `entrega2` como snapshot de la entrega 2.
- **Resolución de incidencias de integración:** detección de un `HEAD` detached tras un `git checkout`, recuperación a `main` sin perder trabajo; resolución de conflictos previsibles (docs, `package.json`, `pnpm-lock`).
- **Verificación previa a integrar:** siempre `pnpm typecheck` + suite de tests antes de merge/push.
- **Diagnóstico de runtime:** redbox de Expo Router causado por un **Metro obsoleto** de un worktree borrado → arranque de Metro limpio (`expo start --clear`).
- **Build y prueba en Android (emulador):** arranque de AVD, `expo run:android` (descarga de NDK/CMake la primera vez), `adb reverse tcp:8081` para llegar a Metro, lanzamiento del dev-client por deep link `exp+motociudad://…`, inyección de GPS con `adb emu geo fix`, capturas con `adb exec-out screencap` y lectura de errores nativos con `adb logcat` (autorización de Google Maps). Diagnóstico de datos con **Supabase MCP** (`execute_sql` sobre `parkings_with_stats` y el RPC `nearby_parkings`).
- **CI/CD:** GitHub Actions + EAS (definido en el MVP; ver `docs/infraestructura.md`).
- **Despliegue del panel admin a Supabase Cloud:** migración `parkings_read_admin` aplicada
  vía Supabase MCP (`apply_migration`) y verificada por `execute_sql`; redeploy de las Edge
  Functions `propose-parking`/`validate-verification` vía Supabase CLI. Local: `supabase start` +
  `supabase db reset` + `supabase test db` para la suite pgTAP.
- **Archivado OpenSpec:** `/opsx:archive` con sync de specs canónicas a `openspec/specs/`
  (primer change archivado del repo).

---

## 5. Tests

- **Runner:** Vitest (app) + suite web separada (`vitest.web.config.ts`).
- **Estado final:** app **55/55** (10 ficheros) + web **5/5** (2 ficheros); typecheck limpio.
- **Trabajo de tests asistido por IA:**
  - `features/search/api.ts` (`geocodeAddress`) con `expo-location` mockeado (TDD).
  - `deeplinks.test.ts` reescrito para la implementación real (ActionSheetIOS / comgooglemaps / web).
  - Script `test` cambiado a `vitest run` (antes colgaba en modo watch); `test:watch` añadido.
  - **Decisión de arquitectura de tests:** los tests de componentes usan `@testing-library/react` + react-native-web (RNTL es incompatible con Vitest — carga el `react-native` real con sintaxis Flow). Documentado en `docs/testing.md` §5.0.
  - **Panel admin:** `features/admin/permissions.ts` (lógica pura de autorización por rol/propiedad y filtros) con **16 tests Vitest**; `admin-set-role` con **8 tests Deno** (gate de validación 400).
- **RLS (pgTAP):** `supabase test db` = **51 asserts en verde** (4 ficheros). Nuevos del panel:
  `authz_functions.test.sql` (funciones `is_admin`/`can_manage_parkings`/`is_suspended`) y
  `admin_policies.test.sql` (edición por rol/propiedad, verificar/borrar solo admin, gate de
  suspensión, recuento de policies). Además se sanearon `parkings.test.sql` y `nearby_parkings.test.sql`.
- **E2E:** Maestro (móvil, flows en `docs/testing.md`); **Playwright** (web: consulta y **panel admin**).

---

## 6. MCPs (uso concreto)

- **Supabase MCP:** consulta de esquema/tablas, migraciones, logs y advisors, generación de tipos TypeScript; configuración del cliente (URL + publishable key). En el panel admin: `list_projects`/`list_migrations`, **`apply_migration`** (policy `parkings_read_admin` a Cloud) y **`execute_sql`** para verificar el estado en producción (recuento de policies, rol de usuarios, borrado del parking de prueba). En `edit-profile`/release: `execute_sql` para aplicar las 4 migraciones con versiones exactas y comprobar duplicados de nick, `deploy_edge_function` para `city-search`, y creación de la cuenta admin de review por SQL.
- **Playwright MCP (renderizado de gráficos):** además de la web, se usó para **renderizar activos de la ficha de Google Play** desde HTML propio — el **icono** (pin de mapa + moto) y el **gráfico de funciones 1024×500** — sirviendo el HTML por un `http.server` local y capturando a resolución exacta (`browser_resize` + `browser_take_screenshot`, ya que `file://` está bloqueado).
- **XcodeBuildMCP:** `discover_projs`, `list_schemes`, `list_sims`, `session_set_defaults`, `build_run_sim`, `launch_app_sim`, `screenshot`, `snapshot_ui` — para compilar y ejecutar la app en el simulador iOS y verificar la UI (p. ej. el buscador). En la sesión de la ficha de App Store se usó además la **automatización de UI** (`snapshot_ui` + `tap`/`type_text`/`key_sequence`) para navegar por las pantallas y capturar el set nativo de screenshots (1284×2778) en un iPhone 14 Plus. Limitación observada: el tecleo por HID mapea mal algunos símbolos (`-`, `@`) según el layout del teclado, por lo que el login lo tecleó el usuario (alternativa: portapapeles vía `simctl pbcopy`).
- **Playwright MCP:** automatización de navegador para la **versión web** — navegar la app en el browser, tomar snapshots/capturas y ejercitar la UI (mapa Leaflet, buscador Nominatim, fichas) para verificar el port web fuera del simulador nativo. También para la **verificación E2E del panel de administración** (2026-07-18): deny sin sesión, login como admin, y flujo completo de gestión de parkings (crear/verificar/borrar) y de usuarios (cambio de rol vía `admin-set-role`), con capturas en `docs/screenshots/admin-panel-*.png`.

---

## 7. Notas de honestidad sobre este registro

- Los prompts de la §3 son **literales** de las sesiones registradas (entrega 2 en adelante).
- Las fases más antiguas (MVP, gamificación, verificaciones iniciales, base web) se resumen por su **resultado en git**, no por el prompt original, porque no todos quedaron registrados. Si conservas esos prompts, este es el sitio para añadirlos.
- Documento vivo: se actualiza con cada nueva feature/corrección de la entrega final (ver también `entrega-final-CMH.md`).
