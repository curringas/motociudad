import { useWindowDimensions } from 'react-native';
import { breakpointForWidth, type Breakpoint } from './breakpoints';

export { breakpointForWidth };
export type { Breakpoint };

/** Current responsive breakpoint, recomputed as the window resizes (web). */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return breakpointForWidth(width);
}
