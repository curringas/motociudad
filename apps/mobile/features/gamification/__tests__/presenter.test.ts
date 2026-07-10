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
