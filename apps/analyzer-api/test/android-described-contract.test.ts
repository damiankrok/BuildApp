/**
 * v3.53.2: the Android client's fixtures for the described path are what this server actually says — regenerated here
 * and compared with the committed copies the phone's JVM tests replay.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { DESCRIBED_CONTRACT_DIR, DESCRIBED_PILOT_TOKEN, captureDescribedContract } from './support/android-described-contract.js'

const fresh = captureDescribedContract()
fresh.catch(() => undefined)

describe('the Android fixtures of the described path', () => {
  it('match the real responses of the API, byte for byte after normalising the job ids and the clock', async () => {
    for (const [name, content] of Object.entries(await fresh)) {
      const committed = readFileSync(join(DESCRIBED_CONTRACT_DIR, name))
      const now = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content)
      expect(committed.equals(now), `${name} is stale: run apps/analyzer-api/scripts/capture-android-described-contract.ts and review the change`).toBe(true)
    }
  }, 120_000)

  it('pin what the phone relies on: three phases in order, pictures hashed apart, a named refusal, a cancellation, and no token in any answer', async () => {
    const files = await fresh
    const json = (name: string) => JSON.parse(files[name] as string) as Record<string, any>
    expect(['status-sorting.json', 'status-describing.json', 'status-building.json'].map((f) => json(f).describing.phase)).toEqual(['SORTING_PICTURES', 'DESCRIBING_HOUSE', 'BUILDING_MODEL'])
    expect(json('status-sorting.json').describing.pictures).toEqual([])
    const pictures = json('status-completed.json').describing.pictures as Array<Record<string, any>>
    expect(pictures.length).toBeGreaterThan(0)
    for (const p of pictures) expect(p.sent.sha256).not.toBe(p.original.sha256)
    // the original the phone downloads IS the bytes the status hashes
    expect(createHash('sha256').update(files['picture-original.png'] as Uint8Array).digest('hex')).toBe(pictures[0].original.sha256)
    expect(json('refusal-wrong-token.json').error.code).toBe('PILOT_TOKEN_INVALID')
    expect(json('status-failed-without-token.json')).toMatchObject({ status: 'FAILED', error: { code: 'NO_DRAWINGS' } })
    expect(json('status-failed-without-token.json').describing).toBeUndefined()
    expect(json('status-cancelled.json')).toMatchObject({ status: 'CANCELLED', describing: { phase: 'DESCRIBING_HOUSE' } })
    expect(json('result.json').warningDetails.map((w: { code: string }) => w.code)).toContain('MODEL_FROM_SOURCE_DESCRIPTION')
    for (const [name, content] of Object.entries(files)) if (typeof content === 'string' && name !== 'meta.json') expect(content, name).not.toContain(DESCRIBED_PILOT_TOKEN)
  }, 120_000)
})
