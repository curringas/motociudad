import { describe, it, expect } from 'vitest';
import { ottoVerdictView } from '../ottoPresenter';

describe('ottoVerdictView', () => {
  it('approved muestra Octanos y mensaje de aprobado', () => {
    const v = ottoVerdictView('approved', 50);
    expect(v.showOctanos).toBe(true);
    expect(v.title).toContain('aprobado');
    expect(v.message).toContain('50 Octanos');
  });

  it('flagged no muestra Octanos y avisa de revisión', () => {
    const v = ottoVerdictView('flagged', 0);
    expect(v.showOctanos).toBe(false);
    expect(v.message.toLowerCase()).toContain('administrador');
  });

  it('rejected no muestra Octanos y explica el rechazo', () => {
    const v = ottoVerdictView('rejected', 0);
    expect(v.showOctanos).toBe(false);
    expect(v.message.toLowerCase()).toContain('no ha pasado');
  });
});
