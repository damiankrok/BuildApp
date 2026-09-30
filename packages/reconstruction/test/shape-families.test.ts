/**
 * BUILDPLAN-ANALYZER-005A: plan shape families through the whole pipeline and the resolver.
 *
 * A footprint is not always one enclosing rectangle. Each family
 * (`@buildapp/synthetic-drawings` shape-families.ts, dimensions made up there)
 * goes in as PNG sheets and comes out as a building or a named refusal. It runs
 * twice: with the footprint a publisher would print, which the layout gate and
 * the resolver weigh, and without one.
 *
 * The rule is the Council's lattice (08-test-leakage-audit.md §5): a row may
 * move up (typed failure → a correct building), never down. A building that
 * completes with the wrong bodies or a footprint more than 6 % off, without a
 * word, is the one outcome that is never allowed — except the rows listed in
 * KNOWN_SILENT, each with the reason it is open, which the report carries as
 * a measured generalization risk rather than a pass.
 */
import { describe, expect, it } from 'vitest'
import { decodeImage } from '@buildapp/source-package'
import { SHAPE_FAMILIES } from '@buildapp/synthetic-drawings'
import type { ShapeFamily } from '@buildapp/synthetic-drawings'
import { ReconstructionFailure, reconstructV2 } from '../src/index.js'
import type { ReconstructionV2Result } from '../src/index.js'
import { buildFixture } from './pipeline.js'

type Outcome = { kind: 'CORRECT' } | { kind: 'WRONG'; bodies: number; areaM2: number } | { kind: 'REFUSED'; code: string }

async function outcomeOf(f: ShapeFamily, published: boolean): Promise<{ outcome: Outcome; result?: ReconstructionV2Result }> {
  const fx = await buildFixture(f.house, f.sheet ?? {})
  try {
    const result = reconstructV2({
      label: f.id,
      slug: f.id,
      sourcePackageId: fx.pkg.id,
      sourcePackageHash: fx.pkg.contentHash,
      graph: fx.graph,
      metrics: fx.metrics,
      raster: (frame) => {
        const asset = fx.pkg.assets.find((a) => a.id === frame.assetId)
        const bytes = asset ? fx.bytesByUrl.get(asset.variants[0].url) : undefined
        return bytes ? decodeImage(bytes) : undefined
      },
      publishedAreas: published ? [{ key: 'footprint_area', label: 'footprint', unit: 'm2', value: f.footprintM2 }] : undefined,
    })
    const areaM2 = result.building.masses.reduce((a, m) => a + (m.x1 - m.x0) * (m.z1 - m.z0), 0)
    const correct = result.building.masses.length === f.bodies && Math.abs(areaM2 / f.footprintM2 - 1) <= 0.06
    return { outcome: correct ? { kind: 'CORRECT' } : { kind: 'WRONG', bodies: result.building.masses.length, areaM2 }, result }
  } catch (error) {
    // Only the solver's own, named refusal counts as a refusal; anything else is a defect.
    if (error instanceof ReconstructionFailure) return { outcome: { kind: 'REFUSED', code: error.code } }
    throw error
  }
}

/** Rows that read the drawing correctly today. They may never move down. */
const CORRECT_TODAY = new Set([
  'rectangle-one-storey',
  'rectangle-two-storeys',
  'l-front',
  'l-rear',
  't-wing',
  'narrow-wing',
].flatMap((id) => [`${id}|published`, `${id}|none`]))

/**
 * Rows that complete with a smaller building and no word, measured and open.
 * Each is a generalization risk the stage report names; the gate fails on any
 * silent row not listed here, and passes when a listed row moves up.
 */
const KNOWN_SILENT: Record<string, string> = {
  'wide-door-wing|none':
    'a 3.2 m door leaves a 0.2 m stub, too short to read as a piece of wall, so no gap is found and the wing floods as outside; with no published footprint nothing contradicts the smaller building. With one, it is refused by name.',
}

describe('plan shape families (005A)', () => {
  for (const f of SHAPE_FAMILIES) {
    for (const published of [true, false]) {
      const row = `${f.id}|${published ? 'published' : 'none'}`
      it(`${f.id}, ${published ? 'with' : 'without'} a published footprint: ${f.what}`, async () => {
        const { outcome } = await outcomeOf(f, published)
        if (CORRECT_TODAY.has(row)) {
          expect(outcome, row).toEqual({ kind: 'CORRECT' })
          return
        }
        if (outcome.kind === 'WRONG') {
          expect(KNOWN_SILENT[row], `${row} completed with ${outcome.bodies} bodies and ${outcome.areaM2.toFixed(1)} m² against ${f.bodies} and ${f.footprintM2}, without a word`).toBeDefined()
          return
        }
        // A named refusal or a correct building: both are allowed here.
        expect(['CORRECT', 'REFUSED']).toContain(outcome.kind)
      }, 60_000)
    }
  }
})
