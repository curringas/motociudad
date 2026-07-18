# Diseño — Octanos en el Perfil

Fecha: 2026-07-10
Estado: aprobado

## Objetivo

Mostrar en la pantalla de Perfil (`app/(tabs)/profile.tsx`) los Octanos del usuario:
sus **Octanos conseguidos** (confirmados), sus **Octanos pendientes** (de aportaciones
aún no validadas por otro usuario) y su **nivel actual** derivado de los conseguidos.

Hoy el Perfil solo muestra el avatar (inicial del email) y el botón de cerrar sesión;
el slice `features/gamification/` está vacío (placeholder).

## Alcance

Incluido:
- Nivel actual (nombre + número) según Octanos conseguidos, con barra de progreso al siguiente nivel.
- Octanos conseguidos (confirmados).
- Octanos pendientes, con nota: "Se confirmarán cuando otro usuario valide tus aportaciones."

Excluido (YAGNI):
- Historial de eventos de Octanos.
- Insignias / badges.
- Cualquier cambio en el flujo de aportar, GPS, fotos o verificación (funcionan en real).

## Datos y reglas

Todo es **lectura**; no se escribe en `octano_events` desde el cliente (regla no negociable).

- **Conseguidos + nivel**: tabla `users` (`total_octanos`, `current_level`, cachés mantenidos
  por trigger) + catálogo `user_levels` (`level`, `name`, `min_octanos`). RLS: `users_public_read`.
- **Pendientes**: `SUM(points)` de `octano_events` con `status = 'pending'` del propio usuario.
  RLS: `octano_events_read_own` (SELECT propio permitido).
- **Nivel**: función pura `levelForOctanos(confirmed, levels)` que devuelve el nivel actual y el
  siguiente umbral a partir de los Octanos **conseguidos** y del catálogo `user_levels`. Es la única
  fuente para nombre de nivel y barra de progreso. No se usa `users.current_level` para la UI
  (se deriva siempre de los conseguidos, como pidió el usuario).

## Arquitectura (`features/gamification/`)

| Archivo | Responsabilidad |
|---|---|
| `schemas.ts` | Zod: fila `users`, catálogo `user_levels`, agregado de pendientes |
| `api.ts` | `getOctanosSummary(userId)` — 2 lecturas Supabase, devuelve resumen normalizado |
| `hooks.ts` | `useOctanosSummary()` — TanStack Query, key `['octanos', userId]` |
| `levels.ts` | `levelForOctanos()` función pura (dentro del slice) |
| `components/OctanosSummary.tsx` | Tarjeta UI con estados loading / datos / error |

`app/(tabs)/profile.tsx` renderiza `<OctanosSummary />` entre el avatar y el botón de cerrar sesión.

### Forma del resumen

```ts
type OctanosSummary = {
  confirmed: number;
  pending: number;
  level: { level: number; name: string };
  nextLevel: { name: string; minOctanos: number } | null; // null si es nivel máximo
  progress: number; // 0..1 hacia el siguiente nivel (1 si es máximo)
};
```

## Flujo

Perfil → `useOctanosSummary()` → `getOctanosSummary()` → (lectura `users`+`user_levels`,
lectura suma `octano_events` pending) → render de la tarjeta.

## Estados de UI

- **Loading**: skeleton/spinner discreto en la tarjeta.
- **Con datos**: nivel + barra, conseguidos, pendientes (+ nota si pending > 0).
- **Cero pendientes**: se muestra "0" sin la nota, o se oculta la nota.
- **Error**: mensaje corto "No se pudieron cargar tus Octanos".

## Tests

- Unit (`vitest`): `levelForOctanos()` — límites entre niveles (0, 100, 101, 25001), nivel máximo.
- Unit: parsing Zod de respuestas válidas/ inválidas.
- RNTL: `<OctanosSummary>` en estados loading, con-pendientes, cero-pendientes.

## No-objetivos / invariantes

- No tocar `contribute.tsx` ni el flujo de verificación.
- No añadir escritura a `octano_events`.
- es-ES en la UI; código y comentarios en inglés.
