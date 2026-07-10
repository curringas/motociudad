# MotoCiudad

**MotoCiudad** es una app móvil colaborativa para motoristas urbanos que resuelve un problema real: Google Maps no documenta la mayoría de zonas de aparcamiento de moto, y ese conocimiento vive disperso en grupos de WhatsApp y foros.

Los usuarios pueden **encontrar, proponer y verificar parkings de moto** (públicos y privados) en su ciudad o cuando viajan. El sistema se sostiene en una comunidad gamificada que premia las contribuciones con **Octanos** (puntos), niveles e insignias — similar al modelo de Waze pero para aparcamientos de moto.

**Diferencial clave**: el dato lo aporta y verifica la propia comunidad, con mecanismos anti-abuso (geofencing, fotos con timestamp, moderación por nivel).

## Funcionalidades principales

- Mapa interactivo con parkings cercanos ordenados por distancia
- Listado de parkings con filtros (público / privado, características)
- Flujo para proponer un parking nuevo (ubicación, foto, descripción)
- Verificación in situ con GPS y foto (solo si estás a menos de 100m)
- Sistema de puntos Octanos con 7 niveles (de Pipiolo a Leyenda del Asfalto)
- Ranking global y mensual de contribuidores

## Cómo probar la app

La app usa cámara, GPS y mapas nativos, por lo que **no funciona con Expo Go**. Hay dos formas de probarla:

---

### Opción A — iPhone físico con Xcode (recomendada para desarrollo)

**Requisitos:**
- [Node.js](https://nodejs.org/) v20 o superior
- [pnpm](https://pnpm.io/installation) — `npm install -g pnpm`
- [Xcode](https://developer.apple.com/xcode/) instalado
- Cuenta de Apple Developer
- iPhone con **modo desarrollador activado** (Ajustes → Privacidad y seguridad → Modo desarrollador)
- Cable USB para conectar el iPhone al Mac

**Paso 1 — Instala dependencias y genera el proyecto iOS**

```bash
pnpm install
cd apps/mobile
npx expo prebuild --platform ios
```

Esto genera la carpeta `ios/` y abre Xcode automáticamente.

**Paso 2 — Configura el entorno**

```bash
cp .env.example .env
```

Rellena el `.env` con las claves del proyecto (solicítalas al autor — WhatsApp: **636 965 165**):

```env
EXPO_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<Publishable key>
SUPABASE_SERVICE_ROLE_KEY=<Secret key>
```

> ⚠️ Nunca subas el `.env` a git. El `.gitignore` ya lo excluye.

**Paso 3 — Arranca el servidor de desarrollo**

```bash
cd apps/mobile
npx expo start --dev-client --localhost
```

**Paso 4 — Lanza la app desde Xcode**

1. Abre `apps/mobile/ios/MotoCiudad.xcworkspace` en Xcode
2. Conecta el iPhone por USB
3. Selecciona tu iPhone como destino en la barra superior
4. Pulsa **Play** (▶)

La app se instalará y abrirá en el iPhone conectándose automáticamente al servidor del Paso 3.

> El servidor del Paso 3 debe estar corriendo siempre mientras pruebas. Sin él la app muestra error.

---

### Opción B — iPhone físico con build de EAS (para compartir con otros)

Útil cuando alguien quiere probar la app sin tener Xcode ni compilar nada.

**Paso 1 — Registra tu dispositivo**

La app solo puede instalarse en dispositivos registrados por el autor (requisito de Apple).

Contacta con el autor para registrar tu iPhone:
- WhatsApp / llamada: **636 965 165**

**Paso 2 — Instala la app**

El autor te enviará un enlace de instalación desde [expo.dev](https://expo.dev). Ábrelo desde **Safari** en el iPhone y sigue los pasos.

**Paso 3 — Configura el entorno y arranca el servidor**

Igual que la Opción A pasos 2 y 3.

> El móvil y el ordenador deben estar en la **misma red WiFi**.

## Estructura del proyecto

```
apps/mobile/          App React Native (Expo)
  app/                Pantallas (Expo Router)
  features/           Lógica por dominio (parkings, auth, gamificación…)
  components/         Componentes reutilizables

supabase/
  migrations/         Esquema de base de datos (SQL)
  functions/          Edge Functions (TypeScript/Deno)
  tests/              Tests de base de datos (pgTAP)
```

## Comandos útiles

```bash
pnpm typecheck          # Verifica tipos TypeScript
pnpm test               # Ejecuta tests unitarios
```

## Estado del proyecto

### Implementado
- Mapa con parkings cercanos (PostGIS + filtros)
- Listado de parkings por distancia
- Flujo completo para proponer un parking (3 pasos: ubicación, detalles, foto)
- Detalle de parking
- Verificación in situ con GPS y cámara (con geofencing y anti-abuso)
- Login y registro
- Base de datos completa con RLS, triggers y Edge Functions
- Tests unitarios, de base de datos y de Edge Functions

### Bugs detectados
- **Foto no se almacena** — al aportar un parking el flujo muestra "Foto lista" pero la foto no se sube correctamente a Supabase Storage y no aparece en la app
- **Pantalla de detalle de parking vacía** — al entrar en un parking no muestra ningún dato
- **Parkings desaparecen al aportar uno nuevo** — posible problema de refresco de la lista/mapa tras crear un parking
- **Verificación solo accesible desde flujo propio** — falta poder verificar un parking desde la pantalla de detalle o haciendo click en el mapa sobre un parking pendiente

### Pendiente de implementar
- Pantalla de Ranking (actualmente muestra "Coming soon")
- Pantalla de Perfil completa (stats, badges, historial de Octanos)
- Visualización de niveles e insignias en la app
- Versión web funcional con mapas (actualmente las librerías nativas no funcionan en navegador)
- Integrar Sentry para registro de errores (el plugin está desactivado temporalmente en `app.config.ts` porque `@sentry/cli` no estaba instalado — bloqueaba el build de EAS)

### Servicios pendientes de configurar
- **Email transaccional** — el correo de confirmación de registro sale con la marca de Supabase, no de MotoCiudad. Requiere dominio propio y servicio como SendGrid o Resend
- **PostHog** — analytics de uso (`EXPO_PUBLIC_POSTHOG_KEY` sin configurar)
- **Sentry** — registro de errores en producción (`EXPO_PUBLIC_SENTRY_DSN` sin configurar)

### Antes de publicar en producción
- Dominio propio para links de confirmación de email y producción
- Configurar App Store y Google Play (certificados, iconos, screenshots, descripción)
- Rellenar claves de Apple y Google en `eas.json` para publicación automática

### Servicios opcionales sin configurar
Estas variables del `.env` son opcionales para desarrollo local. Se necesitan antes de publicar en producción:

| Variable | Servicio | Para qué |
|----------|----------|----------|
| `EXPO_PUBLIC_POSTHOG_KEY` | [PostHog](https://posthog.com) | Analytics de uso |
| `EXPO_PUBLIC_POSTHOG_HOST` | PostHog | URL del servidor (EU por defecto) |
| `EXPO_PUBLIC_SENTRY_DSN` | [Sentry](https://sentry.io) | Registro de errores en producción |

## Stack

- **Mobile**: React Native + Expo SDK 52 + TypeScript
- **Estilos**: NativeWind 4 (Tailwind para React Native)
- **Estado**: Zustand + TanStack Query v5
- **Backend**: Supabase (PostgreSQL + PostGIS + Auth + Edge Functions)
