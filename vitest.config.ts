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
      'tests/benchmark/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/web/e2e/**'],
    environment: 'node',
    reporters: 'default',
    // The reconstruction fixtures render a whole set of sheets to PNG bytes,
    // decode them again and run the entire pipeline over them. That is the
    // point — nothing is injected halfway down — and it takes tens of seconds,
    // not the five the default allows.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
