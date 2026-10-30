/**
 * `npx vite-node apps/analyzer-api/scripts/capture-android-contract.ts`
 *
 * Writes the real API responses for one synthetic job into the Android test
 * resources, into the CURRENT contract snapshot
 * (`apps/android/app/src/test/resources/analyzer-contract-current/`). Run it
 * when the contract changes, review what changed (`test/android-contract.test.ts`
 * fails until the snapshot matches the server again, and refuses a snapshot
 * that drops a member the legacy one had), and record the review beside it.
 *
 * N9-01: the legacy snapshot (`analyzer-contract/`, captured at solver 2.3.0)
 * is no longer written: it stays as the answer of an older server the phone
 * must still read.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { captureAndroidContract } from '../test/support/android-contract.js'
import { CURRENT_CONTRACT_DIR } from '../test/support/contract-shape.js'

mkdirSync(CURRENT_CONTRACT_DIR, { recursive: true })
const files = await captureAndroidContract()
for (const [name, text] of Object.entries(files)) {
  writeFileSync(join(CURRENT_CONTRACT_DIR, name), text, 'utf8')
  process.stdout.write(`wrote ${name} (${Buffer.byteLength(text)} bytes)\n`)
}
