import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Several tests replay the whole pipeline (40+ resorts) from fixtures; 5s is too tight
    // when the suite runs in parallel.
    testTimeout: 30_000,
  },
});
