---
name: verify-all-platforms
description: E2E de cierre obligatorio de MotoCiudad — prueba una feature en las plataformas donde se ve (web con Playwright, emulador Android, simulador iOS), logueado como usuario y como admin donde aplique, limpia los datos de prueba y deja evidencia. Úsalo como último paso de todo opsx:apply (normalmente vía el subagente e2e-verifier).
disable-model-invocation: true
---

# verify-all-platforms

Verificación E2E multiplataforma **obligatoria** al cerrar cualquier `opsx:apply`.
Objetivo: comprobar en runtime que la feature funciona donde el usuario la ve,
no solo que compila. Corre preferiblemente dentro del subagente `e2e-verifier`
(contexto aislado). Al final **escribe evidencia** y **limpia** los datos creados.

## 1. Alcance por plataforma (matriz)

Elige plataformas según DÓNDE se ve la feature (regla del proyecto):

| Superficie de la feature | Plataformas a verificar |
|---|---|
| App móvil (mapa, detalle, aportar, verificar, ranking, comentarios, perfil…) | **Web (Playwright) + Android (emulador) + iOS (simulador)** |
| Panel de administración | **Solo web** (Playwright) |
| Solo backend/Edge/SQL | E2E de lógica/HTTP contra Cloud (Supabase MCP) — sin UI |

Enumera explícitamente en el informe qué plataformas cubriste y cuáles no y por qué.

## 2. Cuentas de prueba (login)

Credenciales en `apps/mobile/.env` (gitignored — NUNCA imprimirlas ni commitearlas):
- **Usuario normal**: `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`
- **Admin**: `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`

Prueba el flujo **como usuario normal** siempre que la feature lo requiera, y
**además como admin** cuando toque el panel de administración o comportamiento por rol.
Léelas así (sin volcarlas): `grep -E '^E2E_' apps/mobile/.env | cut -d= -f1`.

## 3. Prerrequisitos comunes

```bash
# Metro (dev client carga el JS desde aquí en Android e iOS)
cd apps/mobile && CI=1 nohup npx expo start --dev-client --port 8081 --clear >/tmp/metro.log 2>&1 &
# esperar sin `sleep` (bloqueado): reintento de curl
curl -s --retry 40 --retry-delay 2 --retry-connrefused -m 8 http://localhost:8081/status
```
- La app apunta a **Supabase Cloud** (creds en `apps/mobile/.env`).
- MCPs: **Playwright** (web), **XcodeBuildMCP** (iOS, requiere workflow `ui-automation`
  activo — ver `.xcodebuildmcp/config.yaml`), **Supabase** (verificación en BD + limpieza).

## 4. Web — Playwright MCP

- `browser_navigate` a la web local/desplegada; `browser_snapshot` para refs.
- Login: `browser_type` en email/password + click en "Iniciar sesión".
- Ejercita la feature (crear/votar/borrar/etc.) y captura con `browser_take_screenshot`.
- El panel admin es **solo web**: cubre deny sin sesión → login admin → acción por rol.

## 5. Android — emulador (adb)

```bash
adb devices                         # emulador arrancado (emulator-5554)
adb reverse tcp:8081 tcp:8081       # device:8081 -> Metro del host
adb shell am force-stop es.motociudad.app
adb shell am start -a android.intent.action.VIEW \
  -d "motociudad://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" es.motociudad.app
adb exec-out screencap -p > /tmp/shot.png     # capturas
adb shell input tap X Y | input text "a%sb" | input swipe X1 Y1 X2 Y2 | keyevent 4
```
**Trampas aprendidas (síguelas o perderás tiempo):**
- **Navegar a un parking**: usa el tab **Lista** y toca la fila, NO los pins del
  mapa (agrupados y poco fiables). El deep link `motociudad://parking/<id>` NO
  enruta con el dev-client ya abierto.
- Los **taps a tabs se comen** si el mapa está cargando: reintenta tras esperar.
- **Campos de texto**: el autocorrector corrompe/quita el 1er carácter (p.ej. email
  pierde la "c"). Limpia (`keyevent 123` fin + `keyevent 67` ×40) y re-teclea; revisa
  por captura antes de enviar. Espacios en `input text` → `%s`.
- **Teclado tapa el botón de enviar**: hay `keyboardShouldPersistTaps="handled"` en el
  detalle, así que puedes tocar el botón con el teclado abierto; en login haz swipe
  para revelarlo. Descarta teclado con `keyevent 4` cuando dude.
- Coordenadas: la captura suele venir a 1080×2280; si la ves a otra escala, multiplica.

## 6. iOS — simulador (XcodeBuildMCP)

Requiere `.xcodebuildmcp/config.yaml` con `enabledWorkflows: [simulator, ui-automation]`
(si `tap`/`swipe`/`type_text` no aparecen, el workflow no está activo → avísalo).

```
session_show_defaults            # SIEMPRE antes del primer build
# defaults: workspace ios/MotoCiudad.xcworkspace, scheme MotoCiudad, un simulador booted
build_run_sim                    # build + launch (primera vez tarda)
snapshot_ui                      # árbol semántico (labels) — confirma que renderiza
screenshot                       # pixeles
tap / swipe / type_text          # (solo si ui-automation está activo)
```
- Deep link para navegar: `xcrun simctl openurl <UDID> "motociudad://parking/<id>"` (en
  iOS SÍ enruta al detalle).
- **Sin `ui-automation`**: limítate a build+launch+deep-link+`snapshot_ui` (verifica que
  los textos/botones existen en el árbol) + `screenshot`; el flujo con tecleo/scroll
  necesita el workflow activo o al humano. Dilo claramente en el informe.
- Relanzar tras cambios: `xcrun simctl terminate <UDID> es.motociudad.app` + `launch`.
  Ojo: relanzar **cierra la sesión** → vuelve a loguear si el test lo necesita.

## 7. Limpieza OBLIGATORIA (Supabase MCP)

Todo dato creado por el E2E se borra al terminar (comentarios, votos, parkings de
prueba, eventos de Octanos) y se recalculan las cachés de usuario. Ejemplo:
```sql
DELETE FROM public.octano_events WHERE user_id='<uid>' AND action_type IN (...) AND reference_id=...;
DELETE FROM public.comments WHERE author_id='<uid>' AND parking_id='<parking>';
UPDATE public.users SET total_octanos=(SELECT COALESCE(SUM(points),0) FROM public.octano_events
  WHERE user_id='<uid>' AND status='confirmed'), octanos_this_month=(...) WHERE id='<uid>';
```
Verifica con un `SELECT` que no queda residuo antes de cerrar.

## 8. Evidencia + informe (cierra el bucle)

Escribe **siempre** `/.claude/verify-runs/<change-name>.md` con:
- fecha/hora, plataformas cubiertas y NO cubiertas (+ por qué),
- pasos ejercitados (crear/votar/borrar/login user+admin…) y resultado,
- rutas de las capturas clave,
- confirmación de limpieza de datos.

Este fichero es la **prueba** que el hook de cierre exige antes de archivar el change.
El informe final (o el resumen del subagente) resume PASS/PARCIAL/FAIL por plataforma.

## 9. Realidad y honestidad

- No inventes cobertura: si una plataforma no se pudo conducir (p.ej. iOS sin
  ui-automation, o flakiness irresoluble), márcala como **PARCIAL** con el motivo.
- Artefactos conocidos que NO son bugs: foto negra en emulador Android (cámara
  `virtualscene`), error de subida de foto en simulador iOS. No los reportes como fallo.
