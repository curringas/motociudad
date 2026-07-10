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
  if (!first) throw new Error('Empty level catalog');

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
