import { describe, it, expect } from 'vitest';
import { zoomFromLongitudeDelta } from '../geo';

describe('zoomFromLongitudeDelta', () => {
  it('devuelve zoom base cuando delta cubre el mundo en una teja de 512px', () => {
    // 360° a lo ancho de 512px => zoom 0, pero el clamp mínimo es 1
    expect(zoomFromLongitudeDelta(360, 512)).toBeCloseTo(1, 5);
  });

  it('sube un nivel de zoom al duplicar el ancho del viewport', () => {
    const z1 = zoomFromLongitudeDelta(10, 512);
    const z2 = zoomFromLongitudeDelta(10, 1024);
    expect(z2 - z1).toBeCloseTo(1, 5);
  });

  it('un delta pequeño (0.01°) en 375px de ancho da zoom de ciudad (~13-15)', () => {
    const z = zoomFromLongitudeDelta(0.01, 375);
    expect(z).toBeGreaterThan(12);
    expect(z).toBeLessThan(16);
  });

  it('hace clamp a [1, 20]', () => {
    expect(zoomFromLongitudeDelta(1000, 100)).toBe(1);
    expect(zoomFromLongitudeDelta(0.0000001, 4000)).toBe(20);
  });
});
