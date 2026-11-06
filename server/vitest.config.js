import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    hookTimeout: 120000,
    testTimeout: 30000,
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    restoreMocks: true,
    clearMocks: true,
  },
});
