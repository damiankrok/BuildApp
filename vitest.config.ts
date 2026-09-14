import { defineConfig } from 'vitest/config'

/**
 * One vitest run covers every workspace package and the architecture suite.
 * Browser end-to-end checks live in apps/web/e2e and run under Playwright,
 * never under vitest.
 */
export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
      'apps/web/src/**/*.test.ts',
      'tests/architecture/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/web/e2e/**'],
    environment: 'node',
    reporters: 'default',
  },
})
