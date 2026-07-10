import { describe, it, expect } from 'vitest';
import { calculateDistance } from '../geo';

describe('calculateDistance', () => {
  it('es 0 para el mismo punto', () => {
    expect(calculateDistance(40.4168, -3.7038, 40.4168, -3.7038)).toBe(0);
  });

  it('~111 m por 0.001° de latitud', () => {
    const d = calculateDistance(40.4168, -3.7038, 40.4178, -3.7038);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(115);
  });

  it('Puerta del Sol → Plaza Lavapiés ≈ 900 m (±150)', () => {
    const d = calculateDistance(40.4168, -3.7038, 40.40887, -3.70277);
    expect(d).toBeGreaterThan(750);
    expect(d).toBeLessThan(1050);
  });

  it('es simétrica', () => {
    const a = calculateDistance(40.4168, -3.7038, 40.42, -3.71);
    const b = calculateDistance(40.42, -3.71, 40.4168, -3.7038);
    expect(a).toBeCloseTo(b, 6);
  });
});
