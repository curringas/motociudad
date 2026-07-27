import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Note: @testing-library/jest-native v5 is incompatible with Vitest + React
    // 19 (its `extend-expect` import fails), so we don't use it. The setup file
    // only wires dummy env vars and an expo-router mock for shared components.
    setupFiles: ['./vitest.setup.ts'],
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
