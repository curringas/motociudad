import { describe, it, expect } from 'vitest';
import { breakpointForWidth } from '../breakpoints';

describe('breakpointForWidth', () => {
  it('clasifica anchos por breakpoint', () => {
    expect(breakpointForWidth(375)).toBe('mobile');
    expect(breakpointForWidth(767)).toBe('mobile');
    expect(breakpointForWidth(768)).toBe('tablet');
    expect(breakpointForWidth(1023)).toBe('tablet');
    expect(breakpointForWidth(1024)).toBe('desktop');
    expect(breakpointForWidth(1920)).toBe('desktop');
  });
});
