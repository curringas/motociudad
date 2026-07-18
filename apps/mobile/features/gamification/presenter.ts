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
