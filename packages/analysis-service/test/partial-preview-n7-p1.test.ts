/**
 * N7-P1, end to end through the production service: a house whose attached body is refused is delivered as the last
 * valid model — validated, compiled, packed, read back and replayed exactly as a complete one — and says what it is.
 *
 * SLIVERTON's garage is drawn narrower than its own two walls; read faithfully, its ring is refused with the failure an
 * owner's house met (`WALLS_OVERLAP` between the ring's w1 and w3, command 21) while the main body before it is valid.
 */
import { describe, expect, it } from 'vitest'
import { memoryByteCache } from '@buildapp/source-package'
import { HOLLOWAY, LARCHFIELD, SLIVERTON, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { loadBundle, sha256 } from '@buildapp/mobile-scene'
import { serializeModel } from '@buildapp/model'
import { verifyReplay } from '@buildapp/reconstruction'
import { AnalysisError, runAnalysis, summaryOf } from '../src/index.js'

const publisher = syntheticPublisher({
  projects: [
    { code: 'sliverton-s01', title: 'Sliverton', house: SLIVERTON },
    { code: 'sliverton-no-section', title: 'Sliverton', house: SLIVERTON, only: (slug) => slug !== 'przekroj' },
    { code: 'holloway-hw02', title: 'Holloway', house: HOLLOWAY },
    { code: 'section-only', title: 'Only a section', house: LARCHFIELD, only: (slug) => slug === 'przekroj' },
  ],
})
const run = (code: string) => runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
const sliverton = run('sliverton-s01')
const noSection = run('sliverton-no-section')
const holloway = run('holloway-hw02')
for (const p of [sliverton, noSection, holloway]) p.catch(() => undefined)

describe('a refused attached ring after a valid main body', () => {
  it('is delivered as PARTIAL_3D_PREVIEW, with the refusal kept as it was met', async () => {
    const { result } = await sliverton
    expect(result.preview.outcome).toBe('PARTIAL_3D_PREVIEW')
    const p = result.preview.partial
    expect(p?.basis).toBe('CHECKPOINT')
    expect(p?.failure).toMatchObject({ commandIndex: 21, type: 'createWallRing', id: 'ring-attached-0-0', codes: ['WALLS_OVERLAP'], objectIds: ['ring-attached-0-0-w1'] })
    expect(p?.failure.message).toMatch(/^walls ring-attached-0-0-w1 and ring-attached-0-0-w3 share [0-9.]+ m²/)
    expect(p?.missing.map((m) => `${m.id}:${m.cause}`)).toEqual(['slab-attached-0-0:SAME_BODY', 'ring-attached-0-0:FAILED', 'roof-attached-0:SAME_BODY'])
    expect(result.warningDetails.find((w) => w.code === 'PARTIAL_3D_PREVIEW')).toMatchObject({ severity: 'LIMITING' })
    expect(result.warnings.join(' ')).toMatch(/partial 3D preview, not a complete reconstruction/)
    // what failed is named among what the analyzer could not settle, so the details say it too
    expect(result.unresolved.some((u) => u.what === 'createWallRing ring-attached-0-0' && u.status === 'REFUSED')).toBe(true)
  })

  it('keeps the main body’s walls and floors, and the checkpoint before the refusal', async () => {
    const { result, reconstruction } = await sliverton
    expect(result.model.wallRings.map((r) => r.id)).toEqual(['ring-main-0', 'ring-main-1'])
    expect(result.model.walls.some((w) => w.id.startsWith('ring-attached'))).toBe(false)
    expect(result.preview.built.wallRings).toBe(2)
    expect(result.preview.built.walls).toBeGreaterThanOrEqual(8)
    expect(result.preview.partial?.checkpoint).toMatchObject({ wallRings: ['ring-main-0', 'ring-main-1'], slabs: ['slab-main-0', 'slab-main-1'] })
    expect(reconstruction.violations).toEqual({ graph: [], ledger: [] })
  })

  it('passes the same validation, compile, serialization, read-back and replay as a complete model', async () => {
    const { result, sceneText } = await sliverton
    expect(result.verification.replay).toBe('BYTE_IDENTICAL')
    expect(verifyReplay(result.candidate).ok).toBe(true)
    expect(result.candidate.modelHash).toBe(result.modelHash)
    expect(sha256(serializeModel(result.model))).toBe(result.modelSha256)
    expect(sha256(sceneText)).toBe(result.sceneSha256)
    const back = loadBundle(sceneText)
    expect(back.ok).toBe(true)
    if (back.ok) expect(back.bundle.contentHash).toBe(result.sceneContentHash)
    expect(result.counts.meshes).toBeGreaterThan(0)
    // the summary a client downloads carries the preview
    expect(summaryOf(result).preview.outcome).toBe('PARTIAL_3D_PREVIEW')
  })

  it('names the drawing its walls came from: the dimensioned ground plan, by hash and size, with its scale', async () => {
    const { result } = await sliverton
    expect(result.sourceBasis).toMatchObject({ document: 'FLOOR_PLAN', projection: 'ORTHOGRAPHIC_PLAN', storey: 'GROUND', annotation: 'DIMENSIONED', largestOffered: true })
    expect(result.sourceBasis?.variant.byteHash).toMatch(/^[0-9a-f]{64}$/)
    expect(result.sourceBasis?.variant.widthPx).toBeGreaterThan(0)
    expect(result.sourceBasis?.dimensions.chains).toBeGreaterThan(0)
    expect(result.sourceBasis?.scale).toMatchObject({ confidence: 'STRONG', verified: true })
    expect(result.preview.provisional.map((p) => p.code)).not.toContain('SCALE_NOT_VERIFIED')
  })
})

describe('no section: the storeys are a convention, said as one', () => {
  it('the model is built at an explicit height for viewing (HEIGHT_ASSUMED_FOR_PREVIEW)', async () => {
    const { result, reconstruction } = await noSection
    expect(reconstruction.heights).toEqual({ measured: false, assumedStoreyHeightM: 2.8 })
    expect(result.preview.provisional.map((p) => p.code)).toContain('HEIGHT_ASSUMED_FOR_PREVIEW')
    expect(result.warningDetails.find((w) => w.code === 'HEIGHT_ASSUMED_FOR_PREVIEW')).toMatchObject({ severity: 'LIMITING' })
    expect(result.preview.outcome).toBe('PARTIAL_3D_PREVIEW')
    expect(result.model.wallRings.length).toBeGreaterThan(0)
  })
})

describe('what does not change', () => {
  it('a house the model takes whole is COMPLETE, with no partial record and no new warning', async () => {
    const { result, reconstruction } = await holloway
    expect(result.preview.outcome).toBe('COMPLETE')
    expect(result.preview.partial).toBeNull()
    expect(reconstruction.partialPreview).toBeUndefined()
    expect(result.warningDetails.map((w) => w.code)).not.toContain('PARTIAL_3D_PREVIEW')
    expect(reconstruction.heights.measured).toBe(true)
    // the garage is built: as a ring, or (N8-02B: it shares the one wall the plan draws with the house) wall by wall
    const bodies = [...result.model.wallRings.map((r) => r.id), ...result.model.walls.filter((w) => w.tags?.includes('body-envelope')).map((w) => /^(ring-.+?-\d+)-w\d/.exec(w.id)?.[1])]
    expect(bodies).toContain('ring-attached-0-0')
  })

  it('a page with no plan still refuses: no outline, no house', async () => {
    await expect(run('section-only')).rejects.toBeInstanceOf(AnalysisError)
  })
}, 600_000)
