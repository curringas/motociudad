# Diseño — Deploy de la web a URL pública (CD por FTP)

**Fecha:** 2026-07-19
**Objetivo:** publicar la versión web de MotoCiudad en un dominio propio del usuario,
satisfaciendo el requisito de la entrega final ("URL pública accesible / sistema en vivo"),
con despliegue continuo automático.

## Contexto

- La app es Expo (SDK 54) con Expo Router. `app.config.ts` ya define
  `web: { bundler: 'metro', output: 'static' }`.
- El export web se genera con `npx expo export -p web` → `apps/mobile/dist/`.
- Servidor de destino: **Apache** (usa `.htaccess`), **dominio dedicado servido desde la raíz**
  (`baseUrl = '/'`).
- Subida: **FTP plano**, automatizada con una **GitHub Action** que sube en cada push a `main`.
- Las variables `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` se hornean en el
  bundle en tiempo de build. El anon key es público por diseño (lo protege la RLS).

## Arquitectura

Workflow de GitHub Actions que, en cada push a `main` que toque `apps/mobile/**`:

1. Checkout + setup pnpm (v9) + Node 20.
2. `pnpm install --frozen-lockfile`.
3. `npx expo export -p web` con las env de Supabase inyectadas desde secrets →
   `apps/mobile/dist/`.
4. `SamKirkland/FTP-Deploy-Action@v4`: sincroniza `apps/mobile/dist/` con la raíz del dominio
   por FTP (delta-sync: solo ficheros nuevos/cambiados).

```
push a main (apps/mobile/**)
   └─> build web estático (env Supabase horneado)
         └─> FTP delta-sync → servidor Apache
               └─> web en vivo en el dominio
```

## Componentes

### 1. `.github/workflows/deploy-web.yml`
- Trigger: `push` a `main` con `paths: apps/mobile/**` (evita redeploy en cambios de docs).
  Añadir `workflow_dispatch` para poder lanzarlo a mano.
- Env de build desde secrets: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Deploy con FTP-Deploy-Action: `server`, `username`, `password` desde secrets;
  `protocol: ftp`; `local-dir: apps/mobile/dist/`; `server-dir` desde secret/variable.

### 2. Routing SPA — `apps/mobile/public/.htaccess`
Expo copia el contenido de `apps/mobile/public/` a la raíz del `dist/`. El `.htaccess`
resuelve las entradas por URL directa a rutas del router.

**Decisión (resuelta en implementación):** se fija `web.output = 'single'` — SPA de un único
`index.html` — y un `.htaccess` catch-all que sirve los ficheros/directorios reales tal cual y
enruta todo lo demás a `index.html`. Es lo más robusto para una app cliente en un dominio
dedicado (sin SEO ni API routes) y verificable en local con `serve -s`. Validado: `/` y
`/parking/<id>` por URL directa devuelven 200.

### 3. Secrets de GitHub (los configura el usuario)
| Secret | Uso |
|---|---|
| `FTP_SERVER` | host FTP |
| `FTP_USERNAME` | usuario FTP |
| `FTP_PASSWORD` | contraseña FTP |
| `FTP_SERVER_DIR` | carpeta raíz del dominio en el servidor |
| `EXPO_PUBLIC_SUPABASE_URL` | build web |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | build web |

### 4. `README.md` §0.4
Sustituir "pendiente de despliegue" por la URL pública real.

## Manejo de errores

- Si el build (`expo export`) falla, el job termina antes del deploy → no se sube nada roto.
- FTP-Deploy-Action mantiene `.ftp-deploy-sync-state.json` en el servidor para el delta-sync;
  el primer despliegue sube todo el árbol.
- FTP plano: las credenciales viajan sin cifrar; asumido por el usuario. Van en secrets, no en
  el repo.

## Verificación

1. **Local (antes de subir nada):** `npx expo export -p web`, servir `apps/mobile/dist/`
   (p.ej. `npx serve dist`) y comprobar: home, navegación, **ruta dinámica `/parking/[id]`
   por URL directa**, y que carga datos reales de Supabase (env horneado).
2. **CI:** el workflow buildea y despliega sin error.
3. **En vivo:** abrir la URL del dominio y verificar mapa, búsqueda y fichas de parking,
   incluido recargar en una ficha concreta (prueba del routing SPA).

## Fuera de alcance (YAGNI)

- No se toca lógica de la app.
- No CI de builds nativos (EAS) — ya guardado aparte.
- No cache-busting avanzado ni CDN.
- No FTPS (el usuario ha elegido FTP plano).
