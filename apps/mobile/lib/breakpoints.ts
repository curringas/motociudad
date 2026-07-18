// Pure responsive-breakpoint logic (no React Native imports) so it stays unit-testable
// in a plain node environment. The hook lives in ./responsive.ts.
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function breakpointForWidth(width: number): Breakpoint {
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}
