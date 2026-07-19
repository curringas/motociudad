# Deploy Web (CD por FTP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** publicar la web de MotoCiudad en un dominio propio con despliegue continuo automático por FTP en cada push a `main`.

**Architecture:** GitHub Action que en push a `main` (paths `apps/mobile/**`) buildea la web estática de Expo como SPA y la sincroniza por FTP (delta) a un servidor Apache que sirve el dominio desde su raíz.

**Tech Stack:** Expo SDK 54 (export web), Expo Router, GitHub Actions, `SamKirkland/FTP-Deploy-Action@v4`, Apache (`.htaccess`), pnpm 9 / Node 20.

## Global Constraints

- baseUrl del sitio = `/` (dominio dedicado servido desde la raíz).
- Web como **SPA**: `web.output = 'single'` en `apps/mobile/app.config.ts`.
- Env de build: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon key es público por diseño; en local vienen de `apps/mobile/.env`, en CI de secrets).
- FTP **plano** (`protocol: ftp`); credenciales en GitHub Secrets, nunca en el repo.
- Node 20, pnpm 9.
- Commits: Conventional Commits en español; código y comentarios en inglés.
- El export `apps/mobile/dist/` NO se commitea (gitignored).

---

### Task 1: Web como SPA + routing `.htaccess`, verificado en local

**Files:**
- Modify: `apps/mobile/app.config.ts` (bloque `web`, ~línea 51-54: `output: 'static'` → `output: 'single'`)
- Create: `apps/mobile/public/.htaccess`

**Interfaces:**
- Produces: un `apps/mobile/dist/` que Expo genera con un único `index.html` + assets, más el `.htaccess` copiado a la raíz del `dist/`. La Task 3 sube ese `dist/`.

- [ ] **Step 1: Cambiar el output web a SPA**

En `apps/mobile/app.config.ts`, dentro del objeto `web`:

```ts
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
```

- [ ] **Step 2: Crear el `.htaccess` de fallback SPA**

Crear `apps/mobile/public/.htaccess` (Expo copia `public/` a la raíz del `dist/`):

```apache
# SPA fallback for Expo Router client-side routing.
# Serve real files/dirs as-is; route everything else to index.html.
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]
  RewriteRule ^ index.html [L]
</IfModule>
```

- [ ] **Step 3: Generar el export web**

Run: `cd apps/mobile && npx expo export -p web`
Expected: termina sin error y crea `apps/mobile/dist/` con `index.html`, carpeta de assets y `.htaccess` en la raíz.

- [ ] **Step 4: Verificar el `.htaccess` está en el dist**

Run: `ls -a apps/mobile/dist/ | grep htaccess`
Expected: `.htaccess`

- [ ] **Step 5: Servir en local y verificar routing SPA (incl. ruta dinámica)**

Run (en un terminal): `npx serve -s apps/mobile/dist -l 3000`
En otro terminal:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/parking/abc123
```
Expected: ambas devuelven `200` (el flag `-s` de `serve` reescribe rutas desconocidas a `index.html`, igual que hará el `.htaccess`). Parar el server con Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app.config.ts apps/mobile/public/.htaccess
git commit -m "feat(web): exporta la web como SPA y añade .htaccess de routing"
```

---

### Task 2: Ignorar el `dist/` en git

**Files:**
- Modify: `apps/mobile/.gitignore` (o `.gitignore` raíz si no existe el de mobile)

**Interfaces:**
- Consumes: el `dist/` generado en Task 1.
- Produces: garantiza que el artefacto de build no entra en el repo.

- [ ] **Step 1: Comprobar si `dist` ya está ignorado**

Run: `cd /Users/curro/Developer/AI4DEV/AI4Devs-finalproject/motociudad && git check-ignore apps/mobile/dist || echo "NO IGNORADO"`
Expected: si imprime la ruta → ya está ignorado, saltar al commit de la Task 3. Si imprime `NO IGNORADO`, continuar.

- [ ] **Step 2: Añadir `dist/` al gitignore de mobile**

Añadir al final de `apps/mobile/.gitignore` (crear el fichero si no existe):

```
# Web export artifact
/dist/
```

- [ ] **Step 3: Verificar**

Run: `git check-ignore apps/mobile/dist`
Expected: imprime `apps/mobile/dist`

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/.gitignore
git commit -m "chore(web): ignora el artefacto dist/ del export web"
```

---

### Task 3: Workflow de despliegue por FTP

**Files:**
- Create: `.github/workflows/deploy-web.yml`

**Interfaces:**
- Consumes: `apps/mobile/dist/` (Task 1) y los secrets de GitHub.
- Produces: despliegue automático en push a `main`.

- [ ] **Step 1: Crear el workflow**

Crear `.github/workflows/deploy-web.yml`:

```yaml
name: Deploy Web

on:
  push:
    branches:
      - main
    paths:
      - apps/mobile/**
  workflow_dispatch:

jobs:
  deploy:
    name: Build & FTP Deploy
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Export web
        working-directory: apps/mobile
        env:
          EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.EXPO_PUBLIC_SUPABASE_URL }}
          EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY }}
        run: npx expo export -p web

      - name: FTP Deploy
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          protocol: ftp
          server-dir: ${{ secrets.FTP_SERVER_DIR }}
          local-dir: apps/mobile/dist/
```

- [ ] **Step 2: Validar la sintaxis YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy-web.yml')); print('YAML OK')"`
Expected: `YAML OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-web.yml
git commit -m "ci(web): despliegue continuo de la web por FTP en push a main"
```

---

### Task 4: Configurar secrets y primer despliegue (manual, con el usuario)

**Files:** ninguno (acción de configuración + verificación en vivo).

**Interfaces:**
- Consumes: el workflow (Task 3).
- Produces: la web en vivo en el dominio.

- [ ] **Step 1: El usuario añade los Secrets en GitHub**

En `github.com/curringas/motociudad` → Settings → Secrets and variables → Actions → New repository secret. Crear los 6:
`FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_SERVER_DIR` (raíz del dominio, p.ej. `/` o `/public_html/`), `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (estos dos = los mismos que hay en `apps/mobile/.env`).

- [ ] **Step 2: Lanzar el despliegue**

Tras mergear el PR a `main` (o vía `workflow_dispatch` desde la pestaña Actions), el workflow `Deploy Web` corre.

Run: `gh run watch $(gh run list --workflow="Deploy Web" --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status`
Expected: `Build & FTP Deploy` termina en verde.

- [ ] **Step 3: Verificar en vivo**

Abrir la URL del dominio en el navegador y comprobar:
- Carga el mapa/home.
- Búsqueda funciona.
- Abrir una ficha de parking; **recargar la página en esa URL** (prueba del `.htaccess`) → sigue cargando (no 404).
- Los datos son reales (vienen de Supabase → confirma que el env se horneó).

---

### Task 5: URL pública en el README §0.4

**Files:**
- Modify: `README.md` (§0.4, línea ~58: fila "Demo web pública")

**Interfaces:**
- Consumes: la URL en vivo verificada (Task 4).

- [ ] **Step 1: Poner la URL real**

En `README.md` §0.4, sustituir:
```
| Demo web pública (consulta) | _pendiente de despliegue — se publicará para la entrega final_ |
```
por (con el dominio real del usuario):
```
| Demo web pública (consulta) | https://EL-DOMINIO-REAL |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): publica la URL de la web en vivo (§0.4)"
```

---

## Notas de ejecución

- **Orden:** Tasks 1-3 y 5 son cambios de repo → van en la rama `feature-deploy-web` y su PR. Task 4 (secrets + verificación en vivo) requiere acción del usuario y ocurre alrededor del merge.
- **Prerequisito de Task 5:** necesito el **nombre del dominio** (aún no facilitado).
- **Env local:** el export de la Task 1 usa `apps/mobile/.env` (ya existente) para las vars de Supabase.
