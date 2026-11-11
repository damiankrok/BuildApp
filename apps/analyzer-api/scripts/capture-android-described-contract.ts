/**
 * `npx vite-node apps/analyzer-api/scripts/capture-android-described-contract.ts`
 *
 * Writes the real API responses of the described path (v3.53.2) into the Android test resources
 * (`apps/android/app/src/test/resources/analyzer-described/`). Run it when that contract changes and review the diff;
 * `test/android-described-contract.test.ts` fails until the committed copies match the server again.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DESCRIBED_CONTRACT_DIR, captureDescribedContract } from '../test/support/android-described-contract.js'

mkdirSync(DESCRIBED_CONTRACT_DIR, { recursive: true })
for (const [name, content] of Object.entries(await captureDescribedContract())) {
  writeFileSync(join(DESCRIBED_CONTRACT_DIR, name), content)
  process.stdout.write(`wrote ${name} (${typeof content === 'string' ? Buffer.byteLength(content) : content.byteLength} bytes)\n`)
}
