/**
 * The Android client's contract fixtures are what this server actually says.
 *
 * The CURRENT snapshot (`apps/android/app/src/test/resources/analyzer-contract-current`) is regenerated here and
 * compared with the committed, reviewed copy the Android JVM tests parse. A change to a response that the phone has
 * not been tested against fails this test; `scripts/capture-android-contract.ts` refreshes the copy, and the change
 * is reviewed (N9-01: `stage-reports/artifacts/analyzer-n9-01/ANDROID-CONTRACT.md`).
 *
 * The LEGACY snapshot (`analyzer-contract`, solver 2.3.0) is an older server's answer. It is not rewritten; what this
 * test holds about it is that today's server still says everything it said — no member removed or renamed — so the
 * phone's parser of the old answer stays a parser of the new one.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { captureAndroidContract } from './support/android-contract.js'
import { CURRENT_CONTRACT_DIR, LEGACY_CONTRACT_DIR, memberPaths } from './support/contract-shape.js'

const fresh = captureAndroidContract()
fresh.catch(() => undefined)

describe('the Android contract fixtures', () => {
  it('the current snapshot matches the real responses of the API, byte for byte after normalising the job id and the clock', async () => {
    for (const [name, text] of Object.entries(await fresh)) {
      expect(readFileSync(join(CURRENT_CONTRACT_DIR, name), 'utf8'), `${name} is stale: run apps/analyzer-api/scripts/capture-android-contract.ts and review the change`).toBe(text)
    }
  })

  it('today’s answers keep every member the legacy (solver 2.3.0) answers had: the change is additive', async () => {
    const files = await fresh
    for (const name of readdirSync(LEGACY_CONTRACT_DIR).filter((f) => f.endsWith('.json'))) {
      const legacy = memberPaths(JSON.parse(readFileSync(join(LEGACY_CONTRACT_DIR, name), 'utf8')))
      const now = memberPaths(JSON.parse(files[name] ?? '{}'))
      expect([name, [...legacy].filter((p) => !now.has(p))]).toEqual([name, []])
    }
  })

  it('the result carries the three assessment axes (and, N9-02A, the elevation registration) and keeps the model it is about', async () => {
    const result = JSON.parse((await fresh)['result.json']) as Record<string, any>
    expect(Object.keys(result.assessment).sort()).toEqual(['decompositionCompleteness', 'elevationRegistration', 'previewAvailable', 'schema', 'schemaVersion', 'sourceFidelity', 'sourceUnchecked', 'summary', 'technicalValidity'])
    expect(result.assessment.previewAvailable).toBe(true)
    expect(result.assessment.decompositionCompleteness.verdict).toBe(result.preview.completeness?.verdict ?? 'NOT_ASSESSED')
    expect(result.links.scene).toBeTruthy()
  })
})
