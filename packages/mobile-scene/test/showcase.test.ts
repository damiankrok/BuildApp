/**
 * MARCOWKI-UI (OWNER, 2026-11-26): the app opens one readable showcase house on a clean start. The marker lives in the
 * scene registry (the only place that names a building) and reaches the phone as one extra field of `index.json`;
 * the frozen model and scene bytes of the delivery it points at must not move.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, ROOT, SCENES } from '../scripts/scenes.js'

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

describe('the showcase scene', () => {
  it('is exactly one scene of the registry: the frozen Marcówki delivery, under the owner’s words', () => {
    const marked = SCENES.filter((s) => s.showcase)
    expect(marked.map((s) => s.key)).toEqual(['marcowki-c-v35414'])
    const [spec] = marked
    expect(spec.showcase?.title).toBe('Dom w marcówkach')
    expect(spec.showcase?.subtitle).toContain('Model demonstracyjny')
    // the registry's own record stays the technical one
    expect(spec.title).toBe('Marcówki — poprawka v3.54.14 (oddany)')
  })

  it('keeps the frozen model and scene bytes of the OWNER’s brief', () => {
    const model = readFileSync(join(ROOT, 'packages/candidates/src/owner-v35414/marcowki-c-v35414.model.json'))
    expect(sha256(model)).toBe('a66428c88135d1ad2d30678943acd0ea4746d4d2977b96a9b37d16f48759a0f5')
    const scene = join(ASSET_DIR, 'marcowki-c-v35414.scene.json')
    if (!existsSync(scene)) return
    expect(sha256(readFileSync(scene))).toBe('680a3f4bb731d77430c2c81db968f243076dcc65c2648dcda2348a3023d47166')
  })

  it('reaches the app as one extra field of its index entry, and only there', () => {
    const indexPath = join(ASSET_DIR, 'index.json')
    if (!existsSync(indexPath)) return
    const index = JSON.parse(readFileSync(indexPath, 'utf8')) as { key: string; contentHash: string; showcase?: { title: string; subtitle: string } }[]
    const marked = index.filter((e) => e.showcase)
    expect(marked.map((e) => e.key)).toEqual(['marcowki-c-v35414'])
    expect(marked[0].showcase).toEqual(SCENES.find((s) => s.key === 'marcowki-c-v35414')?.showcase)
    expect(marked[0].contentHash).toBe('3dc4d3bb843dc58c144459aec9cf9591da93f564681df35c9cbe7d30aea0ffb7')
  })
})
