import { availableParallelism, cpus } from 'node:os'
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
    // And they block a worker's event loop for as long as they run, so the
    // runner's acknowledgement of each finished test cannot be received
    // until the file is done; past sixty seconds of that the worker gives
    // up waiting and the run is failed. The setup file yields the loop once
    // before every test. See tests/setup/yield-between-tests.ts.
    setupFiles: ['tests/setup/yield-between-tests.ts'],
    // And they are CPU-bound for tens of seconds at a stretch, which is why
    // the number of workers is capped BELOW the core count rather than set to
    // it. Vitest's main thread has to service each worker's progress calls
    // while they run; with one worker per core and two of them pegged by the
    // fixture and mutation suites, it does not get scheduled, the calls time
    // out, and a run in which every test passed is reported as a failure.
    // Leaving a core for the reporter costs a little wall time and buys a
    // result that means what it says.
    // Never below two, though: on a small runner one worker would mean a
    // serial run, which trades a reporting problem for a slow one.
    maxWorkers: Math.max(2, (availableParallelism?.() ?? cpus().length) - 1),
  },
})
