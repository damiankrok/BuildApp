/**
 * `npx vite-node apps/analyzer-api/scripts/capture-android-contract.ts`
 *
 * Writes the real API responses for one synthetic job into the Android test
 * resources (`apps/android/app/src/test/resources/analyzer-contract/`). Run it
 * when the contract changes; `test/android-contract.test.ts` fails until the
 * committed copies match the server again.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { captureAndroidContract } from '../test/support/android-contract.js'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../android/app/src/test/resources/analyzer-contract')
mkdirSync(OUT, { recursive: true })
const files = await captureAndroidContract()
for (const [name, text] of Object.entries(files)) {
  writeFileSync(join(OUT, name), text, 'utf8')
  process.stdout.write(`wrote ${name} (${Buffer.byteLength(text)} bytes)\n`)
}
