import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['contracts/test/**/*.test.ts', 'backend/test/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
