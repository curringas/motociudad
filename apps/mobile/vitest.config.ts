import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // No setup file needed: @testing-library/jest-native v5 is incompatible
    // with Vitest + React 19 (its `extend-expect` import fails). We already
    // use @testing-library/react-native v12.8, which ships built-in Jest
    // matchers that auto-register on import, so jest-native is unnecessary.
    setupFiles: [],
    include: ['**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'android', 'ios', '.expo'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'react-native': 'react-native-web',
    },
  },
});
