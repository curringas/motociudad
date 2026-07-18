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
