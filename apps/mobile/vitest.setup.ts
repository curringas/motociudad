import { vi } from 'vitest';

// Dummy Supabase env so `lib/supabase.ts` can be imported by components under
// test (e.g. Avatar). The client is never actually called in unit tests.
process.env.EXPO_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';

// expo-router ships untranspiled TSX that Vitest can't parse from node_modules.
// Components use only the navigation hooks, so mock the surface we touch.
// Individual tests can override this with their own vi.mock('expo-router').
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useLocalSearchParams: () => ({}),
  Stack: Object.assign(() => null, { Screen: () => null }),
  Link: () => null,
}));
