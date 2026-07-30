# Mejoras posteriores a la entrega final — MotoCiudad

> Registro de todo el trabajo realizado **después** de la entrega final.
> Punto de partida (snapshot de entrega): rama `finalproject-CMH` en el commit `1024d18`.
> A partir de ahí, `main` continúa recibiendo mejoras. Cada entrada anota qué se hizo, por qué y cómo.

---

## Convenciones de este registro

- Orden **cronológico** (lo más reciente arriba dentro de cada sección de fecha).
- Cada mejora enlaza su **rama** y su **PR** cuando exista.
- Se anota: **qué**, **por qué**, **cómo** (resumen técnico) y **estado** (en curso / mergeado / desplegado / verificado).

---

## 2026-07-30

### Otto: verificación por IA de parkings propuestos (en curso)
- **Rama**: `feat/otto-parking-verification`.
- **Qué**: agente de IA "Otto" que, al proponer un parking, verifica con visión+texto que nombre/notas/foto correspondan a un aparcamiento de motos. Estado `ai_review_status` (approved/flagged/rejected) **independiente** de la verificación comunitaria (`parking_status`). Síncrono en `propose-parking`. Panel admin con filtros (dudosos/rechazados/no-verificados). Email SMTP al admin por dudosos y rechazados. Mensajes al proponente (spinner + 3 veredictos). Octanos al entrar a `pending` (Otto-approved o admin-approved tras dudoso).
- **Por qué**: filtrar morralla antes de que entre a la cola pública, manteniendo intacta la verificación comunitaria.
- **Cómo**: change OpenSpec `otto-parking-verification`. Visión vía proveedor OpenAI-compatible (el más económico; reutiliza el patrón de `_shared/moderation.ts`). DeepSeek descartado para visión (su API pública es solo texto).
- **Estado**: 📋 propuesta OpenSpec **completa y válida** (proposal + design + 5 specs + tasks). Pendiente implementar con `/opsx:apply`.

### Automatización: rama dedicada por cambio de OpenSpec (hook)
- **Qué**: hook `PreToolUse` sobre la tool `Skill` que, al ejecutar `opsx:propose` u `opsx:apply`, obliga a trabajar en una rama dedicada `<tipo>/<change-id>` creada desde `main`. El `<tipo>` sigue Conventional Commits según lo explorado (`feat` por defecto para mejoras, `fix` para correcciones, `chore|docs|test|refactor|perf` según toque). `opsx:explore` queda excluido (es reflexión de solo-lectura).
- **Por qué**: mantener `main` desplegable y `finalproject-CMH` intacta; una rama + PR por cada cambio.
- **Cómo**: `.claude/hooks/opsx-branch-guard.sh` lee el JSON del hook, filtra por `.tool_input.skill` e inyecta `additionalContext`. Registrado en `.claude/settings.json` (versionado) junto al hook existente del gate de `openspec archive`. El nombrado se delega en el modelo porque en `propose` el change-id aún no existe.
- **Estado**: ✅ hecho y validado (pipe-test + `jq -e`).

### Inicio del registro
- **Qué**: se crea este documento para llevar la bitácora de mejoras posteriores a la entrega.
- **Por qué**: mantener trazabilidad clara de lo hecho tras congelar la entrega final.
- **Cómo**: `finalproject-CMH` queda como snapshot inmutable (== `main` en `1024d18`); el trabajo nuevo se hace en ramas de feature sobre `main`.
- **Estado**: ✅ hecho.

---

<!-- Nuevas entradas debajo, añadiendo una fecha nueva cuando cambie el día. -->
