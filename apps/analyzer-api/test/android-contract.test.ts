/**
 * The Android client's contract fixtures are what this server actually says.
 *
 * They are regenerated here and compared with the committed copies the
 * Android JVM tests parse (`apps/android/app/src/test/resources/analyzer-contract`).
 * A change to a response that the phone has not been tested against fails
 * this test; `scripts/capture-android-contract.ts` refreshes the copies.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { captureAndroidContract } from './support/android-contract.js'

const DIR = resolve(import.meta.dirname, '../../android/app/src/test/resources/analyzer-contract')

describe('the Android contract fixtures', () => {
  it('match the real responses of the API, byte for byte after normalising the job id and the clock', async () => {
    const fresh = await captureAndroidContract()
    for (const [name, text] of Object.entries(fresh)) {
      expect(readFileSync(join(DIR, name), 'utf8'), `${name} is stale: run apps/analyzer-api/scripts/capture-android-contract.ts`).toBe(text)
    }
  })
})
