import { describe, it, expect } from 'vitest';
import { levelForOctanos } from '../levels';
import type { UserLevel } from '../levels';

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
