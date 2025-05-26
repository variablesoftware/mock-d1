import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    maxConcurrency: 12,
    teardownTimeout: 10000, // Increase timeout to 2 minutes for smoke tests
    exclude: ['node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'lcov', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/types/**', 'tests/**', '**/*.d.ts'],
    },
  },
});
