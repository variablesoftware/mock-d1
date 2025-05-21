import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    timeout: 180000, // Increase timeout to 2 minutes for smoke tests
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/types/**', 'tests/**', '**/*.d.ts'],
    },
  },
});
