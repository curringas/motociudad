# Ficha de App Store — MotoCiudad (iOS)

Textos listos para copiar/pegar en **App Store Connect → tu app → versión 1.0**.
Idioma de la ficha: **Español (España)**. Los límites de caracteres son los que
muestra App Store Connect.

> Cuenta bajo la que se publica: equipo de Apple **CR6CKJ247R** (cuenta de un
> tercero; la org propia está caducada). Ver `../applestore/README.md`.

---

## Promotional Text (máx. 170)
> Editable sin pasar por revisión. Úsalo para lo más actual.
```
Encuentra dónde aparcar tu moto cerca de ti. Mapa colaborativo de aparcamientos propuestos y verificados por moteros. ¡Gana Octanos aportando a la comunidad!
```

## Description (máx. 4,000)
```
🏍️ MotoCiudad — el mapa colaborativo de aparcamientos para moto.

¿Cansado de dar vueltas buscando dónde dejar la moto? MotoCiudad te muestra los aparcamientos de moto que tienes cerca, propuestos y verificados por otros moteros como tú.

🗺️ Encuentra parking al instante
• Mapa con los aparcamientos de moto más cercanos a tu ubicación.
• Filtra por público, privado o verificado por la comunidad.
• Mira fotos, capacidad y características: cubierto, cámaras, anclajes, iluminado, 24h, gratuito…
• Busca cualquier calle o ciudad y explora la zona antes de salir.

✅ Una comunidad que mantiene el mapa vivo
• Propón un aparcamiento en 3 pasos: ubicación, datos y foto.
• Verifica in situ los que ya existen (con GPS y cámara) para que todos puedan fiarse.
• Comenta y vota para aportar contexto real de cada sitio.

🏆 Gana Octanos y sube de nivel
Cada aportación suma Octanos y te hace subir por los 7 niveles de la comunidad, del Pipiolo a la Leyenda del Asfalto. Compite en el ranking global y por ciudad.

👤 Tu perfil motero
Elige tu nombre de usuario, tu ciudad y tu avatar. Lo que aportas te representa en el ranking y en los comentarios.

🔒 Privacidad primero
Usamos tu ubicación solo para mostrarte parkings cercanos y verificar que estás en el sitio; no te rastreamos.

Únete a MotoCiudad y ayuda a construir el mejor mapa de aparcamientos para moto, plaza a plaza. 🛵
```

## Keywords (máx. 100, separadas por comas, SIN espacios tras la coma)
> No repitas el nombre de la app ni la categoría; Apple ya indexa el título.
```
moto,aparcamiento,parking,motocicleta,scooter,aparcar,plazas,motero,mapa,GPS,ciudad,verificado
```
*(Longitud actual: ~95 caracteres.)*

## Support URL
```
https://motociudad.com
```

## Marketing URL (opcional)
```
https://motociudad.com
```

## Version
```
1.0
```

## Copyright (máx. 200)
```
2026 MotoCiudad
```
> ⚠️ El campo copyright debe reflejar al titular de los derechos. Como la cuenta de
> Apple es de un tercero, confirma con el titular qué nombre poner (persona/entidad).

## Routing App Coverage File
Dejar vacío. Es solo para apps de navegación tipo GPS de coche; no aplica.

---

## App Review Information (información para el revisor)

### Sign-In Information — **OBLIGATORIO** (la app exige login)
- Marca **"Sign-in required"**.
- **User name**: usa la cuenta de prueba `E2E_USER_EMAIL` de `apps/mobile/.env`.
- **Password**: usa `E2E_USER_PASSWORD` de `apps/mobile/.env`.
> Sin cuenta demo → rechazo casi seguro (Guideline 2.1). No pongas las credenciales
> en este fichero (está en git); cópialas del `.env` directamente al formulario.

### Contact Information
- **First / Last name**: (tus datos o los del titular de la cuenta)
- **Phone number**: (un teléfono de contacto real)
- **Email**: hola@motociudad.com (o tu email)

### Notes (máx. 4,000) — pega esto:
```
App para encontrar y compartir aparcamientos de moto, sostenida por una comunidad.

Cómo probarla:
1. Inicia sesión con la cuenta de prueba proporcionada arriba.
2. Pestaña "Mapa": muestra aparcamientos de moto cercanos. Requiere permiso de
   ubicación "Al usar la app" (solo en primer plano; no hacemos tracking).
3. Pestaña "Aportar": propone un nuevo aparcamiento en 3 pasos (ubicación, datos, foto).
4. Detalle de un parking → botón "Verificar": confirma su existencia con GPS + cámara.
5. Pestaña "Ranking" y "Perfil": puntos (Octanos), niveles y datos del usuario.

Notas:
- La ubicación se usa únicamente en primer plano para mostrar parkings cercanos y
  para verificar que el usuario está físicamente en el sitio. No se rastrea al usuario
  ni se guarda su ubicación salvo en el instante puntual de una verificación.
- Backend: Supabase. Sin compras dentro de la app ni suscripciones.
```

### Attachment
Opcional. Puedes adjuntar un vídeo corto de demo si lo tienes; no es necesario.

---

## App Store Version Release (cómo se publica tras la aprobación)
**Recomendado para la primera versión: "Manually release this version".**
Así, cuando Apple apruebe, decides tú el momento exacto de publicar (útil para
coordinar con el lanzamiento de Android). Si prefieres que salga sola en cuanto
apruebe, marca "Automatically release".

---

## App Privacy (se rellena en otra sección: App Store Connect → App Privacy)
No es parte de esta página, pero **bloquea el envío** si está vacío. Datos que
recoge MotoCiudad (declarar según uso real):
| Dato | ¿Se recoge? | Vinculado al usuario | Para rastreo |
|---|---|---|---|
| Email | Sí (registro/login) | Sí | No |
| Ubicación (aprox./precisa) | Sí (parkings cercanos + verificación) | No la guardamos salvo en la verificación puntual | No |
| Fotos (parkings/avatar) | Sí (contenido que sube el usuario) | Sí | No |
| Identificadores / datos de uso (PostHog, Sentry) | Sí (analítica/errores) | Según config | No |
> Marca **"No, no rastreamos a los usuarios"** (App Tracking Transparency) si no
> compartes datos con terceros para publicidad — que es el caso.

## Otros campos globales de la app (no de esta versión)
- **Categoría**: Navegación (Navigation). Alternativa: Viajes (Travel).
- **Age Rating**: 4+ (sin contenido sensible). Responde el cuestionario en consecuencia.
- **Privacy Policy URL** (obligatoria): https://motociudad.com/privacidad.html
