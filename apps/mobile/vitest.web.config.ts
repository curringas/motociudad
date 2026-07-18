import { defineConfig } from 'vitest/config';
import path from 'path';

// Separate, additive test config for the web layer's PURE logic (no React Native
// imports, no jsdom, no shared setup file). Keeps these fast unit tests runnable
// independently of the project's existing (RN-oriented) vitest.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'lib/maps-web/__tests__/**/*.test.ts',
      'lib/__tests__/breakpoints.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
