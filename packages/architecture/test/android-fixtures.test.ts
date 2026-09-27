/** The Android test-resource bundles of the architectural fixtures are current. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ANDROID_FIXTURES, ANDROID_FIXTURE_DIR, androidFixtureBundle } from '../scripts/android-fixtures-lib.js'

describe('the Android architecture fixture bundles', () => {
  it.each([...ANDROID_FIXTURES])('%s is current (npm run architecture:android-fixtures)', (id) => {
    expect(readFileSync(join(ANDROID_FIXTURE_DIR, `${id}.scene.json`), 'utf8') === androidFixtureBundle(id)).toBe(true)
  })
})
