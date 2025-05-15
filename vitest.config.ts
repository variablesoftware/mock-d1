import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    timeout: 180000, // Increase timeout to 2 minutes for smoke tests
  },
});
