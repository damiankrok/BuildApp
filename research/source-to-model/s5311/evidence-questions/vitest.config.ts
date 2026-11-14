import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/** research/ is outside the repository's vitest include; this config runs only this folder's tests. */
export default defineConfig({
  root: fileURLToPath(new URL('../../../..', import.meta.url)),
  test: {
    include: ['research/source-to-model/s5311/evidence-questions/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
})
