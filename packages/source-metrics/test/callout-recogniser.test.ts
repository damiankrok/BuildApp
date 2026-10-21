/**
 * BUILDPLAN-ANALYZER-005Y-N1: the external recogniser heard on plan callout rings (`callout-recogniser.ts`), with
 * fixture recognisers — no ONNX:
 *  - the halves are cut from the ring's own pixels, split at the bar, and their glyphs counted;
 *  - the gate takes a half only when it is confident, stable, the model's own answer, two or three digits, every glyph
 *    read and an opening's size — `118` read `18` (a dropped leading digit) is refused by its ink;
 *  - a half refused on the bracket alone is taken only when another ring on the sheet reads the same pair outright;
 *  - in the metric reading, a ring both of whose halves pass reads what the recogniser read, first among its
 *    candidates; any other ring keeps the template's reading; and without a recogniser nothing changes.
 */
import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import type { SourceCoordinateFrame, SourceObservationGraph } from '@buildapp/source-observations'
import { inkChannel } from '@buildapp/source-cv'
import { extractMetricEvidence, extractMetricEvidenceAsync } from '../src/extract.js'
import { readOpeningCallouts } from '../src/callouts.js'
import { corroborateBySibling, glyphCount, judgeCalloutHalf, planCorroborableWidth, ringHalfCrops } from '../src/callout-recogniser.js'
import type { CalloutHalfVerdict } from '../src/callout-recogniser.js'
import type { ExternalReading, LabelCrop, LabelRecogniser } from '../src/recogniser.js'
import { METRIC_EVIDENCE_CALLOUT_RING_SCHEMA_VERSION } from '../src/schema.js'

const reading = (text: string, p = 0.99, meanP = 0.99, stable = true, greedy = text): ExternalReading => ({
  key: 'k',
  engine: 'ocr.fixture@0',
  modelSha256: 'a'.repeat(64),
  runtime: 'fixture',
  topK: text ? [{ text, p }] : [],
  greedy: { text: greedy, meanP },
  stable,
  variants: [
    { variant: 'BASE', top: text, p },
    { variant: 'PAD2', top: stable ? text : `${text}1`, p },
    { variant: 'TRIM1', top: text, p },
    { variant: 'SCALE90', top: text, p },
  ],
})

const ring = (c: Canvas, cx: number, cy: number, r: number): void => {
  const steps = Math.round(2 * Math.PI * r * 2)
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * 2 * Math.PI
    c.plot(Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), 40)
  }
}
const callout = (c: Canvas, cx: number, cy: number, upper: string, lower: string, r = 13): void => {
  ring(c, cx, cy, r)
  c.line(cx - r + 2, cy, cx + r - 2, cy, 1, 40)
  const cap = 9
  c.text(upper, cx - Math.round((upper.length * 5) / 2), cy - 2 - cap, cap, { value: 60, letterGap: 1 })
  c.text(lower, cx - Math.round((lower.length * 5) / 2), cy + 3, cap, { value: 60, letterGap: 1 })
}

describe('ring halves for the recogniser', () => {
  it('cuts each half from the disc, split at the bar, and counts its glyphs', () => {
    const c = new Canvas(200, 120)
    callout(c, 90, 60, '300', '23')
    const raster = c.toRaster()
    const found = readOpeningCallouts(raster, { frameId: 't' }).find((f) => Math.abs(f.circle.cx - 90) <= 3 && f.bar)
    expect(found).toBeDefined()
    if (!found?.bar) return
    const { upper, lower } = ringHalfCrops(inkChannel(raster), found.circle, found.bar.y, 'r0')
    expect(upper?.crop.key).toBe('r0u')
    expect(lower?.crop.key).toBe('r0l')
    expect(upper?.glyphs).toBe(3)
    expect(lower?.glyphs).toBe(2)
    // Image only: a crop has nothing but its key, its pixels and its height.
    expect(Object.keys(upper?.crop ?? {}).sort()).toEqual(['capPx', 'gray', 'key'])
  })

  it('counts a digit broken across its waist as one glyph, and two digits apart as two', () => {
    const g = { width: 12, height: 9, data: new Uint8ClampedArray(12 * 9).fill(255) }
    for (const y of [1, 2, 3, 5, 6, 7]) g.data[y * 12 + 2] = 0
    for (const y of [1, 2, 3, 4, 5, 6, 7]) g.data[y * 12 + 8] = 0
    expect(glyphCount(g)).toBe(2)
  })

  it('005Y-N5: counts a digit whose pale stroke broke off in the next column as one glyph, digits one clear column apart as two', () => {
    // A small 4 on a tinted disc: its diagonal (columns 2..3) lost the pixel joining it to the stem (column 4).
    const g = { width: 12, height: 9, data: new Uint8ClampedArray(12 * 9).fill(255) }
    for (const [x, y] of [[3, 1], [3, 2], [2, 3], [2, 4]]) g.data[y * 12 + x] = 0
    for (const y of [1, 2, 3, 4, 5, 6, 7]) g.data[y * 12 + 4] = 0
    for (const x of [2, 3]) g.data[5 * 12 + x] = 0
    expect(glyphCount(g)).toBe(1)
    // The same stroke with a clear column before the next digit stays two.
    for (const y of [1, 2, 3, 4, 5, 6, 7]) g.data[y * 12 + 6] = 0
    expect(glyphCount(g)).toBe(2)
  })
})

describe('005Y-N5: a refused width reading as a plan-corroborable candidate', () => {
  it('offers an unconfident width reading of an opening size at half its posterior', () => {
    const v = judgeCalloutHalf(reading('260', 0.74, 0.8, false), 1, 'width')
    expect(v.accepted).toBe(false)
    const c = planCorroborableWidth(v)
    expect(c?.valueCm).toBe(260)
    expect(c?.confidence).toBeCloseTo(0.37, 6)
  })
  it('offers nothing for an accepted half, a non-number, or a size no opening has', () => {
    expect(planCorroborableWidth(judgeCalloutHalf(reading('120'), 3, 'width'))).toBeUndefined()
    expect(planCorroborableWidth(judgeCalloutHalf(reading('1a0', 0.5, 0.5), 3, 'width'))).toBeUndefined()
    expect(planCorroborableWidth(judgeCalloutHalf(reading('7', 0.5, 0.5), 3, 'width'))).toBeUndefined()
    expect(planCorroborableWidth(judgeCalloutHalf(reading('990', 0.5, 0.5), 3, 'width'))).toBeUndefined()
  })
})

describe('the gate on one half', () => {
  it('takes a confident, stable reading of every glyph, of an opening’s size', () => {
    const v = judgeCalloutHalf(reading('230'), 3, 'height')
    expect(v.accepted).toBe(true)
    expect(v.valueCm).toBe(230)
  })
  it('refuses a dropped leading digit by the ink it left unread (118 read as 18)', () => {
    expect(judgeCalloutHalf(reading('18', 0.9988, 0.999), 3, 'height').accepted).toBe(false)
    expect(judgeCalloutHalf(reading('5', 0.95, 0.95), 3, 'width').accepted).toBe(false)
    expect(judgeCalloutHalf(reading('30', 0.99, 0.99), 3, 'height').accepted).toBe(false)
  })
  it('refuses an unstable, a doubtful, or a borrowed answer, and a size no opening has', () => {
    expect(judgeCalloutHalf(reading('230', 0.99, 0.99, false), 3, 'height').why).toMatch(/stable/)
    expect(judgeCalloutHalf(reading('230', 0.99, 0.8), 3, 'height').why).toMatch(/mean/)
    expect(judgeCalloutHalf(reading('230', 0.99, 0.99, true, '2.30'), 3, 'height').why).toMatch(/own answer/)
    expect(judgeCalloutHalf(reading('36'), 2, 'width').why).toMatch(/not an opening/)
    expect(judgeCalloutHalf(undefined, 3, 'width').accepted).toBe(false)
  })
})

describe('a half refused on the bracket alone', () => {
  const ok = (text: string): CalloutHalfVerdict => ({ ...judgeCalloutHalf(reading(text), text.length, 'width'), text })
  const unstable = (text: string): CalloutHalfVerdict => judgeCalloutHalf(reading(text, 0.99, 0.99, false), text.length, 'width')
  it('is taken when another ring on the sheet reads the same pair outright, and not otherwise', () => {
    const rings = [
      { id: 'a', width: ok('78'), height: ok('140'), accepted: true, unstableOnly: { width: false, height: false } },
      { id: 'b', width: unstable('78'), height: ok('140'), accepted: false, unstableOnly: { width: true, height: false } },
      { id: 'c', width: unstable('78'), height: ok('118'), accepted: false, unstableOnly: { width: true, height: false } },
    ]
    const lifted = corroborateBySibling(rings)
    expect(lifted.get('b')?.width.accepted).toBe(true)
    expect(lifted.get('b')?.width.why).toMatch(/a on this sheet reads 78\/140/)
    expect(lifted.has('c')).toBe(false)
    // Nothing outright, nothing lifted.
    expect(corroborateBySibling(rings.slice(1)).size).toBe(0)
  })
})

describe('the recogniser in the metric reading', () => {
  const c = new Canvas(360, 200)
  c.fill(20, 60, 340, 72, 0)
  c.line(90, 72, 90, 96, 1, 0)
  callout(c, 90, 110, '110', '230')
  const raster = c.toRaster()
  const frame = {
    id: 'frame-plan',
    assetId: 'asset-plan',
    variantByteHash: 'c'.repeat(64),
    size: { width: raster.width, height: raster.height },
    roles: { document: 'FLOOR_PLAN', storey: 'GROUND', annotation: 'DIMENSIONED', view: 'NOT_APPLICABLE', projection: 'ORTHOGRAPHIC_PLAN' },
  } as SourceCoordinateFrame
  const graph: SourceObservationGraph = { schema: 'buildapp.source-observation-graph', schemaVersion: '1.0.0', id: 'obsgraph-rings', sourcePackageId: 'pkg', sourcePackageHash: 'e'.repeat(64), extractors: [], coordinateFrames: [frame], observations: [], relations: [], conflicts: [], unresolved: [], contentHash: 'd'.repeat(64) }
  const options = { sourcePackageId: 'pkg', sourcePackageHash: 'e'.repeat(64), graph, raster: () => raster, slug: 'rings' }
  const recogniserOf = (answer: (c: LabelCrop) => ExternalReading | undefined): { recogniser: LabelRecogniser; calls: LabelCrop[][] } => {
    const calls: LabelCrop[][] = []
    return {
      calls,
      recogniser: {
        id: 'ocr.spy@0',
        model: { name: 'spy', sha256: 'b'.repeat(64) },
        runtime: 'fixture',
        recognise: async (crops) => {
          calls.push([...crops])
          return crops.flatMap((k) => {
            const r = answer(k)
            return r ? [{ ...r, key: k.key }] : []
          })
        },
      },
    }
  }
  const ringCallout = (set: ReturnType<typeof extractMetricEvidence>) => set.evidence.find((e) => e.kind === 'OPENING_CALLOUT' && e.textBox && Math.abs((e.textBox.x0 + e.textBox.x1) / 2 - 90) <= 4)

  it('a ring both halves of which pass reads what the recogniser read, first among its candidates', async () => {
    const { recogniser, calls } = recogniserOf((k) => (k.key.endsWith('u') ? reading('120') : k.key.endsWith('l') ? reading('210') : undefined))
    const set = await extractMetricEvidenceAsync({ ...options, recogniser })
    const ringBatch = calls.find((b) => b.some((k) => /^r\d+[ul]$/.test(k.key)))
    expect(ringBatch).toBeDefined()
    expect(set.schemaVersion).toBe(METRIC_EVIDENCE_CALLOUT_RING_SCHEMA_VERSION)
    const rec = (set.calloutRings ?? []).find((r) => Math.abs(r.centrePx.x - 90) <= 3)
    expect(rec?.accepted).toBe(true)
    expect(rec?.finders).toContain('OPENING')
    const ev = ringCallout(set)
    expect(ev?.rawText).toBe('120/210')
    expect(ev?.alternatives[0]).toMatchObject({ value: 120, rawText: '120' })
    expect(ev?.alternatives[0].why).toMatch(/^width candidate: the recogniser read/)
    expect(ev?.alternatives[1]).toMatchObject({ value: 210, rawText: '210' })
    expect(ev?.alternatives[1].why).toMatch(/^height candidate: the recogniser read/)
    // The template's own candidates stay on the record after the recogniser's.
    expect(ev?.alternatives.slice(2).some((a) => a.value === 110)).toBe(true)
  })

  it('a ring a half of which fails keeps the template’s reading for that half, leads with the half that passed, and says why on its record (005Y-N5)', async () => {
    const { recogniser } = recogniserOf((k) => (k.key.endsWith('u') ? reading('110') : k.key.endsWith('l') ? reading('30') : undefined))
    const set = await extractMetricEvidenceAsync({ ...options, recogniser })
    const off = extractMetricEvidence(options)
    const rec = (set.calloutRings ?? []).find((r) => Math.abs(r.centrePx.x - 90) <= 3)
    expect(rec?.accepted).toBe(false)
    expect(rec?.height.why).toMatch(/glyphs|not an opening/)
    const offHeight = (ringCallout(off)?.rawText ?? '').split('/')[1]
    expect(ringCallout(set)?.rawText).toBe(`110/${offHeight}`)
    const alts = ringCallout(set)?.alternatives ?? []
    expect(alts[0]).toMatchObject({ value: 110, rawText: '110' })
    expect(alts[0].why).toMatch(/^width candidate: the recogniser read the upper half as 110 .*the lower half was refused/)
    // The refused height reading (30) is no candidate at all; the template's own candidates follow unchanged.
    expect(alts.some((a) => a.rawText === '30')).toBe(false)
    expect(alts.slice(1)).toEqual(ringCallout(off)?.alternatives)
  })

  it('without a recogniser the set carries no ring records and keeps its version', () => {
    const off = extractMetricEvidence(options)
    expect(off.calloutRings).toBeUndefined()
    expect(off.schemaVersion).not.toBe(METRIC_EVIDENCE_CALLOUT_RING_SCHEMA_VERSION)
  })
})
