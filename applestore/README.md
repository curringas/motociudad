# App Store — MotoCiudad (iOS)

Todo lo necesario para publicar MotoCiudad en la App Store. Los **textos** están en
[`ficha-textos.md`](./ficha-textos.md) (listos para copiar/pegar). Aquí queda el
checklist maestro y los recursos gráficos.

> **Cuenta**: se publica bajo el equipo de Apple **CR6CKJ247R** (cuenta de un
> tercero; la org propia está caducada). App: `com.motociudad.app`, ascAppId
> **6795799534**. Firma/subida vía **EAS**.

---

## Recursos en esta carpeta

| Fichero | Uso | Tamaño |
|---|---|---|
| `icon-1024.png` | Icono de la App Store | 1024×1024 |
| `screenshots/iphone-6.5/01-mapa.png` | Captura: mapa con parkings | 1242×2688 |
| `screenshots/iphone-6.5/02-detalle-parking.png` | Captura: detalle de un parking | 1242×2688 |
| `screenshots/iphone-6.5/03-perfil.png` | Captura: perfil de usuario | 1242×2688 |
| `screenshots/iphone-6.5/04-buscar-ciudad.png` | Captura: buscador de ciudad | 1242×2688 |

### ⚠️ Sobre las capturas
- Son las capturas de **Android reescaladas** a lienzo iPhone 6.5" (1242×2688), con
  relleno en el color de fondo de la app (#0f172a) para que el marco sea invisible.
  **Sirven para pasar la revisión.**
- Muestran la cuenta de prueba (`@e2e_user`). Para una ficha más pulida conviene
  **regenerarlas desde el simulador de iOS** con una cuenta "de escaparate". Ver
  "Regenerar capturas" abajo.
- **Solo se necesita iPhone 6.5"**. La app tiene `supportsTablet: false`, así que
  **NO hacen falta capturas de iPad**. Solo se usan las 3 primeras en la hoja de
  instalación.

---

## Requisitos de tamaño de captura (App Store Connect)
- **iPhone 6.5" Display** (única obligatoria aquí): `1242 × 2688` o `1284 × 2778`
  (portrait), o sus equivalentes en horizontal. Apple reutiliza estas para el resto
  de tamaños de iPhone.
- App Previews (vídeos): opcional, no los tenemos.

---

## Checklist de publicación

### En el terminal (subir el build) — puede estar corriendo ya
- [ ] `eas build --platform ios --profile production`  → build **0.1.0 (2)**
- [ ] `eas submit --platform ios --profile production --non-interactive`
- [ ] Esperar a que el build aparezca "Ready to Submit" en App Store Connect.
> El build 2 lleva los arreglos: solo ubicación *When In Use*, sin permiso *Always*,
> y `ITSAppUsesNonExemptEncryption=false` (sin prompt de export compliance).

### En App Store Connect — página de la versión 1.0
- [ ] **Screenshots** iPhone 6.5" (subir las 4 de `screenshots/iphone-6.5/`)
- [ ] **Promotional Text** (ver `ficha-textos.md`)
- [ ] **Description** (ver `ficha-textos.md`)
- [ ] **Keywords** (ver `ficha-textos.md`)
- [ ] **Support URL** / **Marketing URL**
- [ ] **Copyright**
- [ ] **Build**: pulsar "Add Build" → seleccionar el 0.1.0 (2)

### App Review Information
- [ ] **Sign-In required** + cuenta demo (`E2E_USER_*` de `apps/mobile/.env`) ← crítico
- [ ] Contact Information (nombre, teléfono, email)
- [ ] Notes (ver `ficha-textos.md`)

### Secciones globales de la app (una vez)
- [ ] **App Privacy** relleno (tabla en `ficha-textos.md`) ← bloquea el envío si falta
- [ ] **Privacy Policy URL**: https://motociudad.com/privacidad.html
- [ ] **Categoría**: Navegación
- [ ] **Age Rating**: 4+ (responder cuestionario)

### Publicación
- [ ] Elegir **"Manually release"** (recomendado para la 1ª versión)
- [ ] **Submit for Review**

---

## Regenerar capturas desde el simulador de iOS (opcional, más pulido)
Si quieres capturas nativas de iPhone en vez de las reescaladas de Android:
1. Arranca un simulador de 6.5"/6.7" (p. ej. iPhone 15 Plus).
2. Corre la app en él (`expo run:ios` o un build de simulador).
3. Navega a Mapa / Detalle / Perfil / Ranking e inicia sesión con una cuenta limpia.
4. Captura con ⌘S (o herramientas de XcodeBuildMCP) y sustituye los PNG de
   `screenshots/iphone-6.5/`. El simulador 6.5"/6.7" ya da el tamaño correcto.
