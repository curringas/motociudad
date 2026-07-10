# Octanos en el Perfil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en el Perfil los Octanos conseguidos, los pendientes y el nivel actual (derivado de los conseguidos) con barra de progreso.

**Architecture:** Slice vertical `features/gamification/` (hoy vacío). Una función pura deriva el nivel del catálogo `user_levels`; `api.ts` hace 3 lecturas Supabase (RLS-permitidas), `hooks.ts` las envuelve en TanStack Query, y `OctanosSummary.tsx` renderiza la tarjeta en `app/(tabs)/profile.tsx`. Todo es lectura — no se escribe en `octano_events`.

**Tech Stack:** React Native + Expo Router, TypeScript strict, Zustand, TanStack Query v5, NativeWind 4, Zod, Vitest + React Native Testing Library.

## Global Constraints

- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`; imports absolutos vía `@/`.
- Código y comentarios en inglés; copy de UI en español (es-ES).
- Commits: Conventional Commits en español (`feat(gamification): …`).
- Nunca escribir en `octano_events` desde el cliente (solo SELECT propio, RLS `octano_events_read_own`).
- Tests en `**/__tests__/**/*.{test,spec}.{ts,tsx}`. Ejecutar con `pnpm --filter mobile test` (o `cd apps/mobile && npx vitest run`).
- Enum `octano_status` = `'pending' | 'confirmed' | 'reverted'`.
- Catálogo `user_levels` (7): Pipiolo 0, Rodador 101, Buscaplazas 501, Cartógrafo 1501, Centinela 4001, Maestro Motero 10001, Leyenda del Asfalto 25001.
- Tokens de color NativeWind: `primary` #FFD60A, `pending` #f59e0b, `surface`, `background`, `content`/`content-muted`/`content-subtle`, radios `rounded-card`/`rounded-pill`.

---

### Task 1: Función pura `levelForOctanos`

**Files:**
- Create: `apps/mobile/features/gamification/levels.ts`
- Test: `apps/mobile/features/gamification/__tests__/levels.test.ts`

**Interfaces:**
- Consumes: `Database['public']['Tables']['user_levels']['Row']` desde `@/types/database`.
- Produces:
  - `type UserLevel = Pick<..., 'level' | 'name' | 'min_octanos'>`
  - `type LevelProgress = { current: { level: number; name: string }; next: { name: string; minOctanos: number } | null; progress: number }`
  - `function levelForOctanos(confirmed: number, levels: UserLevel[]): LevelProgress`

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/mobile/features/gamification/__tests__/levels.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { levelForOctanos, type UserLevel } from '../levels';

const LEVELS: UserLevel[] = [
  { level: 1, name: 'Pipiolo', min_octanos: 0 },
  { level: 2, name: 'Rodador', min_octanos: 101 },
  { level: 3, name: 'Buscaplazas', min_octanos: 501 },
  { level: 7, name: 'Leyenda del Asfalto', min_octanos: 25001 },
];

describe('levelForOctanos', () => {
  it('con 0 Octanos devuelve Pipiolo y progreso 0 hacia Rodador', () => {
    const r = levelForOctanos(0, LEVELS);
    expect(r.current).toEqual({ level: 1, name: 'Pipiolo' });
    expect(r.next).toEqual({ name: 'Rodador', minOctanos: 101 });
    expect(r.progress).toBe(0);
  });

  it('con 50 Octanos sigue en Pipiolo con progreso parcial', () => {
    const r = levelForOctanos(50, LEVELS);
    expect(r.current.name).toBe('Pipiolo');
    expect(r.progress).toBeCloseTo(50 / 101, 5);
  });

  it('justo en el umbral (101) sube a Rodador con progreso 0', () => {
    const r = levelForOctanos(101, LEVELS);
    expect(r.current).toEqual({ level: 2, name: 'Rodador' });
    expect(r.progress).toBe(0);
  });

  it('en el nivel máximo no hay siguiente y el progreso es 1', () => {
    const r = levelForOctanos(30000, LEVELS);
    expect(r.current.name).toBe('Leyenda del Asfalto');
    expect(r.next).toBeNull();
    expect(r.progress).toBe(1);
  });

  it('no depende del orden del catálogo de entrada', () => {
    const shuffled = [...LEVELS].reverse();
    expect(levelForOctanos(600, shuffled).current.name).toBe('Buscaplazas');
  });

  it('lanza si el catálogo está vacío', () => {
    expect(() => levelForOctanos(0, [])).toThrow();
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `cd apps/mobile && npx vitest run features/gamification/__tests__/levels.test.ts`
Expected: FAIL — `Cannot find module '../levels'`.

- [ ] **Step 3: Implementación mínima**

Crear `apps/mobile/features/gamification/levels.ts`:

```ts
import type { Database } from '@/types/database';

export type UserLevel = Pick<
  Database['public']['Tables']['user_levels']['Row'],
  'level' | 'name' | 'min_octanos'
>;

export type LevelProgress = {
  current: { level: number; name: string };
  next: { name: string; minOctanos: number } | null;
  progress: number; // 0..1 hacia el siguiente nivel; 1 en el nivel máximo
};

/**
 * Derives the user's current level and progress from confirmed Octanos.
 * The catalog does not need to be pre-sorted.
 */
export function levelForOctanos(
  confirmed: number,
  levels: UserLevel[],
): LevelProgress {
  const sorted = [...levels].sort((a, b) => a.min_octanos - b.min_octanos);
  const first = sorted[0];
  if (!first) throw new Error('Catálogo de niveles vacío');

  let current = first;
  for (const lvl of sorted) {
    if (confirmed >= lvl.min_octanos) current = lvl;
    else break;
  }

  const next = sorted.find((l) => l.min_octanos > current.min_octanos) ?? null;

  let progress = 1;
  if (next) {
    const span = next.min_octanos - current.min_octanos;
    progress = span > 0
      ? Math.min(1, Math.max(0, (confirmed - current.min_octanos) / span))
      : 1;
  }

  return {
    current: { level: current.level, name: current.name },
    next: next ? { name: next.name, minOctanos: next.min_octanos } : null,
    progress,
  };
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `cd apps/mobile && npx vitest run features/gamification/__tests__/levels.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/features/gamification/levels.ts apps/mobile/features/gamification/__tests__/levels.test.ts
git commit -m "feat(gamification): añade levelForOctanos para derivar nivel de Octanos"
```

---

### Task 2: Schemas + `getOctanosSummary` (api)

**Files:**
- Create: `apps/mobile/features/gamification/schemas.ts`
- Create: `apps/mobile/features/gamification/api.ts`
- Test: `apps/mobile/features/gamification/__tests__/schemas.test.ts`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase`; `levelForOctanos`, `LevelProgress`, `UserLevel` de `./levels`.
- Produces:
  - `userOctanosSchema`, `userLevelSchema`, `octanoPointsRowSchema` (Zod)
  - `type OctanosSummary = { confirmed: number; pending: number; level: LevelProgress }`
  - `async function getOctanosSummary(userId: string): Promise<OctanosSummary>`

- [ ] **Step 1: Escribir el test que falla (parsing de schemas)**

Crear `apps/mobile/features/gamification/__tests__/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  userOctanosSchema,
  userLevelSchema,
  octanoPointsRowSchema,
} from '../schemas';

describe('gamification schemas', () => {
  it('userOctanosSchema acepta total_octanos válido', () => {
    expect(userOctanosSchema.parse({ total_octanos: 150 }).total_octanos).toBe(150);
  });

  it('userOctanosSchema rechaza total_octanos negativo', () => {
    expect(() => userOctanosSchema.parse({ total_octanos: -1 })).toThrow();
  });

  it('userLevelSchema acepta una fila de nivel', () => {
    const row = { level: 2, name: 'Rodador', min_octanos: 101 };
    expect(userLevelSchema.parse(row)).toEqual(row);
  });

  it('octanoPointsRowSchema acepta points entero', () => {
    expect(octanoPointsRowSchema.parse({ points: 50 }).points).toBe(50);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `cd apps/mobile && npx vitest run features/gamification/__tests__/schemas.test.ts`
Expected: FAIL — `Cannot find module '../schemas'`.

- [ ] **Step 3: Implementar schemas.ts**

Crear `apps/mobile/features/gamification/schemas.ts`:

```ts
import { z } from 'zod';

export const userOctanosSchema = z.object({
  total_octanos: z.number().int().nonnegative(),
});

export const userLevelSchema = z.object({
  level: z.number().int(),
  name: z.string(),
  min_octanos: z.number().int().nonnegative(),
});

export const octanoPointsRowSchema = z.object({
  points: z.number().int(),
});
```

- [ ] **Step 4: Implementar api.ts**

Crear `apps/mobile/features/gamification/api.ts`:

```ts
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { levelForOctanos, type LevelProgress } from './levels';
import {
  userOctanosSchema,
  userLevelSchema,
  octanoPointsRowSchema,
} from './schemas';

export type OctanosSummary = {
  confirmed: number;
  pending: number;
  level: LevelProgress;
};

/**
 * Reads the current user's Octanos summary. All reads are RLS-permitted:
 * own `users` row, public `user_levels` catalog, and own pending `octano_events`.
 * Never writes to octano_events.
 */
export async function getOctanosSummary(userId: string): Promise<OctanosSummary> {
  const [userRes, levelsRes, pendingRes] = await Promise.all([
    supabase.from('users').select('total_octanos').eq('id', userId).single(),
    supabase
      .from('user_levels')
      .select('level, name, min_octanos')
      .order('min_octanos', { ascending: true }),
    supabase
      .from('octano_events')
      .select('points')
      .eq('user_id', userId)
      .eq('status', 'pending'),
  ]);

  if (userRes.error) throw userRes.error;
  if (levelsRes.error) throw levelsRes.error;
  if (pendingRes.error) throw pendingRes.error;

  const confirmed = userOctanosSchema.parse(userRes.data).total_octanos;
  const levels = z.array(userLevelSchema).parse(levelsRes.data);
  const pending = z
    .array(octanoPointsRowSchema)
    .parse(pendingRes.data ?? [])
    .reduce((sum, row) => sum + row.points, 0);

  return { confirmed, pending, level: levelForOctanos(confirmed, levels) };
}
```

- [ ] **Step 5: Ejecutar tests y typecheck**

Run: `cd apps/mobile && npx vitest run features/gamification/__tests__/schemas.test.ts && npx tsc --noEmit`
Expected: tests PASS (4); tsc sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/features/gamification/schemas.ts apps/mobile/features/gamification/api.ts apps/mobile/features/gamification/__tests__/schemas.test.ts
git commit -m "feat(gamification): añade getOctanosSummary y schemas de lectura de Octanos"
```

---

### Task 3: Hook + componente `OctanosSummary`

**Files:**
- Create: `apps/mobile/features/gamification/hooks.ts`
- Create: `apps/mobile/features/gamification/presenter.ts`
- Create: `apps/mobile/features/gamification/components/OctanosSummary.tsx`
- Test: `apps/mobile/features/gamification/__tests__/presenter.test.ts`

**Nota sobre tests de componente:** el runner vitest de este repo NO puede montar componentes con `@testing-library/react-native` (arrastra el código fuente Flow de `react-native` → `SyntaxError: Unexpected token 'typeof'`). Es un fallo **preexistente** que afecta a todo el repo (incluido `ParkingMapPin.test.tsx`, que tampoco corre). Por eso NO se escribe un test de render RNTL. En su lugar, la lógica de presentación se extrae a una función pura `toOctanosView` (testeable con vitest sin render) y el render real se verifica en el simulador (Task 4). Arreglar la infra vitest+RNTL queda como deuda conocida fuera del alcance de esta feature.

**Interfaces:**
- Consumes: `getOctanosSummary`, `OctanosSummary` (tipo) de `../api`; `useQuery` de `@tanstack/react-query`.
- Produces:
  - `gamificationKeys`, `useOctanosSummary(userId: string | undefined)` (hooks.ts)
  - `type OctanosView` + `toOctanosView(summary: OctanosSummary): OctanosView` (presenter.ts)
  - `OctanosSummary` (componente React, prop `{ userId: string }`). El componente usa `toOctanosView` para derivar los campos a mostrar.

- [ ] **Step 1: Implementar hooks.ts**

Crear `apps/mobile/features/gamification/hooks.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { getOctanosSummary } from './api';

export const gamificationKeys = {
  all: ['octanos'] as const,
  summary: (userId: string) => [...gamificationKeys.all, userId] as const,
};

/**
 * Fetches the current user's Octanos summary. Disabled until userId is known.
 */
export function useOctanosSummary(userId: string | undefined) {
  return useQuery({
    queryKey: gamificationKeys.summary(userId ?? 'anon'),
    queryFn: () => getOctanosSummary(userId as string),
    enabled: !!userId,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: Escribir el test del presentador que falla**

Crear `apps/mobile/features/gamification/__tests__/presenter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toOctanosView } from '../presenter';
import type { OctanosSummary } from '../api';

const withPending: OctanosSummary = {
  confirmed: 150,
  pending: 50,
  level: {
    current: { level: 1, name: 'Pipiolo' },
    next: { name: 'Rodador', minOctanos: 101 },
    progress: 0.5,
  },
};

describe('toOctanosView', () => {
  it('deriva etiquetas de nivel, %, y muestra la nota con pendientes > 0', () => {
    const v = toOctanosView(withPending);
    expect(v.levelLabel).toBe('Nivel 1');
    expect(v.levelName).toBe('Pipiolo');
    expect(v.progressPct).toBe(50);
    expect(v.progressLabel).toBe('150 / 101 → Rodador');
    expect(v.confirmed).toBe(150);
    expect(v.pending).toBe(50);
    expect(v.showPendingNote).toBe(true);
  });

  it('oculta la nota cuando pending es 0', () => {
    expect(toOctanosView({ ...withPending, pending: 0 }).showPendingNote).toBe(false);
  });

  it('en el nivel máximo (next null) muestra "Nivel máximo alcanzado" y 100%', () => {
    const max: OctanosSummary = {
      confirmed: 30000,
      pending: 0,
      level: { current: { level: 7, name: 'Leyenda del Asfalto' }, next: null, progress: 1 },
    };
    const v = toOctanosView(max);
    expect(v.progressLabel).toBe('Nivel máximo alcanzado');
    expect(v.progressPct).toBe(100);
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `cd apps/mobile && npx vitest run features/gamification/__tests__/presenter.test.ts`
Expected: FAIL — `Cannot find module '../presenter'`.

- [ ] **Step 4: Implementar el presentador**

Crear `apps/mobile/features/gamification/presenter.ts`:

```ts
import type { OctanosSummary } from './api';

export type OctanosView = {
  levelLabel: string;
  levelName: string;
  progressPct: number; // 0..100
  progressLabel: string;
  confirmed: number;
  pending: number;
  showPendingNote: boolean;
};

/** Maps an OctanosSummary to the flat fields the card renders. */
export function toOctanosView(summary: OctanosSummary): OctanosView {
  const { confirmed, pending, level } = summary;
  return {
    levelLabel: `Nivel ${level.current.level}`,
    levelName: level.current.name,
    progressPct: Math.round(level.progress * 100),
    progressLabel: level.next
      ? `${confirmed} / ${level.next.minOctanos} → ${level.next.name}`
      : 'Nivel máximo alcanzado',
    confirmed,
    pending,
    showPendingNote: pending > 0,
  };
}
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `cd apps/mobile && npx vitest run features/gamification/__tests__/presenter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Implementar el componente**

Crear `apps/mobile/features/gamification/components/OctanosSummary.tsx`:

```tsx
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useOctanosSummary } from '../hooks';
import { toOctanosView } from '../presenter';

/**
 * Card showing the user's level, confirmed and pending Octanos.
 * Reads via useOctanosSummary; renders loading and error states.
 */
export function OctanosSummary({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useOctanosSummary(userId);

  if (isLoading) {
    return (
      <View
        className="bg-surface rounded-card p-5 items-center mb-6"
        accessibilityLabel="Cargando Octanos"
      >
        <ActivityIndicator color="#FFD60A" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View className="bg-surface rounded-card p-5 mb-6">
        <Text className="text-content-muted text-center">
          No se pudieron cargar tus Octanos
        </Text>
      </View>
    );
  }

  const view = toOctanosView(data);

  return (
    <View className="bg-surface rounded-card p-5 mb-6">
      <Text className="text-content-muted text-xs uppercase tracking-wide">
        {view.levelLabel}
      </Text>
      <Text className="text-content text-xl font-bold mb-3">{view.levelName}</Text>

      <View className="h-2 rounded-pill bg-background overflow-hidden mb-1">
        <View
          className="h-2 rounded-pill bg-primary"
          style={{ width: `${view.progressPct}%` }}
        />
      </View>
      <Text className="text-content-subtle text-xs mb-5">{view.progressLabel}</Text>

      <View className="flex-row justify-around">
        <View className="items-center">
          <Text
            className="text-primary text-2xl font-bold"
            accessibilityLabel={`${view.confirmed} Octanos conseguidos`}
          >
            {view.confirmed}
          </Text>
          <Text className="text-content-muted text-xs mt-1">⚡ Conseguidos</Text>
        </View>
        <View className="items-center">
          <Text
            className="text-pending text-2xl font-bold"
            accessibilityLabel={`${view.pending} Octanos pendientes`}
          >
            {view.pending}
          </Text>
          <Text className="text-content-muted text-xs mt-1">⏳ Pendientes</Text>
        </View>
      </View>

      {view.showPendingNote && (
        <Text className="text-content-subtle text-xs text-center mt-4">
          Se confirmarán cuando otro usuario valide tus aportaciones.
        </Text>
      )}
    </View>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: sin errores nuevos (pueden persistir 2 errores preexistentes no relacionados en el mapa).

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/features/gamification/hooks.ts apps/mobile/features/gamification/presenter.ts apps/mobile/features/gamification/components/OctanosSummary.tsx apps/mobile/features/gamification/__tests__/presenter.test.ts
git commit -m "feat(gamification): añade hook, presentador y tarjeta OctanosSummary"
```

---

### Task 4: Integrar en el Perfil y limpiar placeholder

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Delete: `apps/mobile/features/gamification/__placeholder__.ts`

**Interfaces:**
- Consumes: `OctanosSummary` de `@/features/gamification/components/OctanosSummary`; `user.id` del `useSessionStore`.

- [ ] **Step 1: Renderizar `<OctanosSummary>` en el Perfil**

En `apps/mobile/app/(tabs)/profile.tsx`, añadir el import bajo la línea `import { supabase } from '@/lib/supabase';`:

```tsx
import { OctanosSummary } from '@/features/gamification/components/OctanosSummary';
```

Y en el bloque del usuario logueado, insertar el componente entre el bloque del avatar (el `</View>` que cierra `items-center mb-8`) y el `TouchableOpacity` de cerrar sesión:

```tsx
        <OctanosSummary userId={user.id} />

        <TouchableOpacity
          className="border border-rejected/50 rounded-card p-4 items-center"
          onPress={handleSignOut}
```

- [ ] **Step 2: Eliminar el placeholder vacío**

```bash
git rm apps/mobile/features/gamification/__placeholder__.ts
```

- [ ] **Step 3: Typecheck y tests de gamification**

Run: `cd apps/mobile && npx tsc --noEmit && npx vitest run features/gamification`
Expected: tsc sin errores nuevos (2 errores preexistentes de mapa pueden persistir); todos los tests de gamification en verde.

Nota: NO ejecutar la suite completa (`npx vitest run` a secas) como criterio de verde — `features/parkings/components/__tests__/ParkingMapPin.test.tsx` falla de forma PREEXISTENTE (`SyntaxError: Unexpected token 'typeof'`, infra vitest+RNTL rota en todo el repo, no relacionado con esta feature). Limitar el run a `features/gamification`.

- [ ] **Step 4: Verificación manual en simulador**

Con Metro corriendo y la app en el simulador iOS (usuario logueado): abrir la pestaña **Perfil** y comprobar que se ve el nivel, la barra de progreso, "⚡ Conseguidos" y "⏳ Pendientes", y la nota cuando hay pendientes > 0. Tomar screenshot.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(tabs)/profile.tsx
git commit -m "feat(gamification): muestra Octanos y nivel en la pantalla de Perfil"
```

---

## Notas de ejecución

- `pnpm install` ya ejecutado y `apps/mobile/.env` presente (Supabase remoto). Metro del worktree en :8082.
- El repo pide "commitear solo cuando el usuario lo pida": confirmar con el usuario antes de ejecutar los pasos de commit, o agruparlos al final.
