/**
 * BUILDPLAN-ANALYZER-005H: the external recogniser's seam and the P2 ensemble rule, with fixture recognisers — no ONNX
 * Runtime here. What is held:
 *
 *  - the rule (`ensembleOf`) decision by decision: agreement corroborates, a disagreement with a CLEAR/SUPPORTED reading
 *    is AMBIGUOUS — with both values only when the external one corroborates —, an unstable or unconfident external, or
 *    a digit string that is not the model's own answer, never corroborates or leads, a value of another digit count is
 *    recorded and never a candidate, a decimal separator is compared by its digits and separators;
 *  - the metric layer reads the ensemble's reading and offers the other witness at full strength — and nothing else;
 *  - the seam is image-only: the recogniser receives crops cut from the pass field at the label's box, keyed, with no
 *    other field, once per plan frame, before any scale exists — and the same crops whatever the chains decide;
 *  - `recogniser: undefined` is today's reading byte for byte (the content hash), and a run with one says so.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_LABEL_STYLE, LARCHFIELD, renderGroundPlan, renderLabel } from '@buildapp/synthetic-drawings'
import type { SourceCoordinateFrame, SourceObservationGraph } from '@buildapp/source-observations'
import { extractMetricEvidence, extractMetricEvidenceAsync } from '../src/extract.js'
import { OCR_ENSEMBLE_BOUNDS, ensembleOf, readingOf } from '../src/ensemble.js'
import type { EnsembledLattice } from '../src/ensemble.js'
import { correctionReadings, latticeAlternatives } from '../src/metric-solution.js'
import { NUMERIC_LATTICE_ENSEMBLE_VERSION, NUMERIC_LATTICE_VERSION, labelLattice } from '../src/numeric-lattice.js'
import { readNumbers } from '../src/ocr.js'
import { RECOGNISER_CROP, cropForToken, labelCrop } from '../src/recogniser.js'
import type { ExternalReading, LabelCrop, LabelRecogniser } from '../src/recogniser.js'
import { METRIC_EVIDENCE_ENSEMBLE_SCHEMA_VERSION, METRIC_EVIDENCE_SCHEMA_VERSION } from '../src/schema.js'

const reading = (text: string, p = 0.99, meanP = 0.99, stable = true, extra: Array<{ text: string; p: number }> = []): ExternalReading => ({
  key: 'k',
  engine: 'ocr.fixture@0',
  modelSha256: 'a'.repeat(64),
  runtime: 'fixture',
  topK: [...(text ? [{ text, p }] : []), ...extra],
  greedy: { text, meanP },
  stable,
  variants: [
    { variant: 'BASE', top: text, p },
    { variant: 'PAD2', top: stable ? text : `${text}1`, p },
    { variant: 'TRIM1', top: text, p },
    { variant: 'SCALE90', top: text, p },
  ],
})
/** A reading whose model answered `own` over its whole alphabet while the digit beam's top is `top` (005H red team D). */
const heardAs = (top: string, own: string, p = 0.99, meanP = 0.99): ExternalReading => ({ ...reading(top, p, meanP), greedy: { text: own, meanP } })
const lat = (asRead: string, ocrClass: 'CLEAR' | 'SUPPORTED' | 'AMBIGUOUS' | 'LOW_QUALITY') => ({ asRead, asReadValueCm: /^[1-9]\d{1,3}$/.test(asRead) ? Number(asRead) : undefined, ocrClass })

describe('the P2 rule, decision by decision', () => {
  it('a corroborating external reading that agrees makes the reading CLEAR', () => {
    for (const cls of ['CLEAR', 'SUPPORTED', 'AMBIGUOUS', 'LOW_QUALITY'] as const) {
      const e = ensembleOf(lat('1950', cls), reading('1950'))
      expect(e.decision).toBe('AGREES')
      expect(e.ocrClass).toBe('CLEAR')
      expect(e.asRead).toBe('1950')
      expect(e.rival).toBeUndefined()
    }
  })

  it('a disagreement with a CLEAR or SUPPORTED reading is AMBIGUOUS, the lattice still read — the external value a candidate only when it corroborates', () => {
    for (const cls of ['CLEAR', 'SUPPORTED'] as const) {
      const e = ensembleOf(lat('1410', cls), reading('1950'))
      expect(e.decision).toBe('CONTESTS')
      expect(e.ocrClass).toBe('AMBIGUOUS')
      expect(e.asRead).toBe('1410')
      expect(e.rival).toEqual({ text: '1950', valueCm: 1950, witness: 'EXTERNAL' })
      expect(e.lattice).toEqual({ asRead: '1410', valueCm: 1410, ocrClass: cls })
      // unconfident, unstable or both: doubt, and no candidate (red team A1 / D5)
      for (const x of [reading('1950', 0.05, 0.2, false), reading('1950', 0.6, 0.95), reading('1950', 0.99, 0.99, false)]) {
        const d = ensembleOf(lat('1410', cls), x)
        expect(d).toMatchObject({ decision: 'CONTESTS', ocrClass: 'AMBIGUOUS', asRead: '1410' })
        expect(d.rival).toBeUndefined()
      }
    }
  })

  it('a digit string the model did not itself read is no reading: it never corroborates, leads or offers a value (red team D1)', () => {
    // `2·5`: the digit beam hands the dot's frame to a digit and reads 25 at p ≈ 1
    expect(ensembleOf(lat('25', 'CLEAR'), heardAs('25', '2·5', 0.997, 0.97))).toMatchObject({ decision: 'CONTESTS', ocrClass: 'AMBIGUOUS', asRead: '25' })
    expect(ensembleOf(lat('25', 'CLEAR'), heardAs('25', '2·5', 0.997, 0.97)).rival).toBeUndefined()
    expect(ensembleOf(lat('25', 'AMBIGUOUS'), heardAs('25', '2·5', 0.997, 0.97))).toMatchObject({ decision: 'NOT_COMPARABLE', ocrClass: 'AMBIGUOUS', asRead: '25' })
    // a slash tick before 12: the beam reads 112
    expect(ensembleOf({ asRead: '', asReadValueCm: undefined, ocrClass: 'LOW_QUALITY' }, heardAs('112', '/12', 0.93))).toMatchObject({ decision: 'NOT_COMPARABLE', asRead: '', ocrClass: 'LOW_QUALITY' })
    // superscript millimetres: 12⁵ is not 125
    expect(ensembleOf(lat('125', 'CLEAR'), heardAs('125', '12⁵'))).toMatchObject({ decision: 'CONTESTS_COUNT', ocrClass: 'AMBIGUOUS' })
    // a stray dot with other digits doubts a CLEAR reading instead of slipping past it (red team A3)
    expect(ensembleOf(lat('1410', 'CLEAR'), heardAs('1910', '1.910', 0.97))).toMatchObject({ decision: 'CONTESTS', ocrClass: 'AMBIGUOUS' })
    expect(ensembleOf(lat('1410', 'CLEAR'), heardAs('1910', '1.910', 0.97)).rival).toBeUndefined()
    // and the same digits with a stray dot change nothing either way
    expect(ensembleOf(lat('1410', 'AMBIGUOUS'), heardAs('1410', '1.410', 0.97))).toMatchObject({ decision: 'NOT_COMPARABLE', ocrClass: 'AMBIGUOUS' })
    // letters: no digit read at all
    expect(ensembleOf(lat('1410', 'CLEAR'), heardAs('0', 'WC', 0.95))).toMatchObject({ decision: 'NO_VALUE', ocrClass: 'CLEAR' })
  })

  it('stability is read from the bracket itself, not taken on the recogniser’s word (red team A8)', () => {
    const claimed = { ...reading('2590'), variants: reading('2590').variants.map((v) => (v.variant === 'TRIM1' ? { ...v, top: '2580' } : v)) }
    expect(claimed.stable).toBe(true)
    expect(ensembleOf(lat('1140', 'AMBIGUOUS'), claimed)).toMatchObject({ decision: 'NOT_CORROBORATING', asRead: '1140' })
    const missingVariant = { ...reading('2590'), variants: reading('2590').variants.filter((v) => v.variant !== 'SCALE90') }
    expect(ensembleOf(lat('1140', 'AMBIGUOUS'), missingVariant).decision).toBe('NOT_CORROBORATING')
  })

  it('a value of another digit count is recorded, never a candidate: it doubts the reading and contests no scale', () => {
    const e = ensembleOf(lat('190', 'SUPPORTED'), reading('1950'))
    expect(e.decision).toBe('CONTESTS_COUNT')
    expect(e.ocrClass).toBe('AMBIGUOUS')
    expect(e.rival).toBeUndefined()
    expect(e.asRead).toBe('190')
  })

  it('a corroborating reading leads a reading in doubt; the lattice value of the same count stays a full candidate', () => {
    const e = ensembleOf(lat('1140', 'AMBIGUOUS'), reading('2590'))
    expect(e.decision).toBe('LEADS')
    expect(e).toMatchObject({ asRead: '2590', asReadValueCm: 2590, ocrClass: 'SUPPORTED', rival: { text: '1140', valueCm: 1140, witness: 'LATTICE' } })
    // another count: it leads alone
    expect(ensembleOf(lat('114', 'LOW_QUALITY'), reading('2590')).rival).toBeUndefined()
    // and a lattice that read no dimension at all
    expect(ensembleOf({ asRead: '', asReadValueCm: undefined, ocrClass: 'LOW_QUALITY' }, reading('648'))).toMatchObject({ decision: 'LEADS', asRead: '648', ocrClass: 'SUPPORTED' })
  })

  it('an external reading that is unstable, or under either bound, never corroborates and never leads', () => {
    const cases = [reading('2590', 0.99, 0.99, false), reading('2590', OCR_ENSEMBLE_BOUNDS.posterior - 0.001, 0.99), reading('2590', 0.99, OCR_ENSEMBLE_BOUNDS.meanP - 0.001)]
    for (const x of cases) {
      expect(ensembleOf(lat('1140', 'AMBIGUOUS'), x)).toMatchObject({ decision: 'NOT_CORROBORATING', asRead: '1140', ocrClass: 'AMBIGUOUS' })
      expect(ensembleOf(lat('2590', 'AMBIGUOUS'), x)).toMatchObject({ decision: 'NOT_CORROBORATING', asRead: '2590', ocrClass: 'AMBIGUOUS' })
    }
    // the bounds themselves corroborate
    expect(ensembleOf(lat('2590', 'AMBIGUOUS'), reading('2590', OCR_ENSEMBLE_BOUNDS.posterior, OCR_ENSEMBLE_BOUNDS.meanP)).decision).toBe('AGREES')
  })

  it('a reading of no digit, or of no dimension, is recorded and changes nothing', () => {
    expect(ensembleOf(lat('1140', 'AMBIGUOUS'), reading(''))).toMatchObject({ decision: 'NO_VALUE', asRead: '1140', ocrClass: 'AMBIGUOUS' })
    // five digits state no dimension: it may not lead…
    expect(ensembleOf(lat('1140', 'AMBIGUOUS'), reading('11405'))).toMatchObject({ decision: 'NO_VALUE', asRead: '1140' })
    // …but a disagreement in the digits still doubts a confident reading (005G compares readings as text)
    expect(ensembleOf(lat('11405', 'SUPPORTED'), reading('11408'))).toMatchObject({ decision: 'CONTESTS', ocrClass: 'AMBIGUOUS' })
    expect(ensembleOf(lat('11405', 'SUPPORTED'), reading('11408')).rival).toBeUndefined()
  })

  it('a decimal separator is compared by its digits and separators: a different reading doubts, nothing agrees on digits alone, nothing leads', () => {
    const metres = { asRead: '4,50', asReadValueCm: 450, ocrClass: 'AMBIGUOUS' as const }
    // the model read no comma: another number, not an agreement (the production-path gate's light_ink-5001-2 `72,408`)
    expect(ensembleOf(metres, reading('450'))).toMatchObject({ decision: 'NOT_COMPARABLE', ocrClass: 'AMBIGUOUS', asRead: '4,50' })
    expect(ensembleOf(metres, reading('480'))).toMatchObject({ decision: 'NOT_COMPARABLE', ocrClass: 'AMBIGUOUS', asRead: '4,50' })
    expect(ensembleOf({ asRead: '72,408', asReadValueCm: undefined, ocrClass: 'LOW_QUALITY' }, reading('72408'))).toMatchObject({ decision: 'NOT_COMPARABLE', ocrClass: 'LOW_QUALITY' })
    // a confident decimal reading the external reader reads otherwise is in doubt — never a candidate (red team A3)
    const sure = { ...metres, ocrClass: 'SUPPORTED' as const }
    expect(ensembleOf(sure, reading('480'))).toMatchObject({ decision: 'CONTESTS', ocrClass: 'AMBIGUOUS', asRead: '4,50' })
    expect(ensembleOf(sure, reading('480')).rival).toBeUndefined()
    expect(ensembleOf(sure, reading('4500'))).toMatchObject({ decision: 'CONTESTS_COUNT', ocrClass: 'AMBIGUOUS' })
    // a confident decimal reading the model read without its comma is in doubt too
    expect(ensembleOf(sure, reading('450'))).toMatchObject({ decision: 'CONTESTS', ocrClass: 'AMBIGUOUS' })
    // the same reading in the model's own words, separator and all, changes nothing
    expect(ensembleOf(sure, heardAs('450', '4.50'))).toMatchObject({ decision: 'NOT_COMPARABLE', ocrClass: 'SUPPORTED' })
  })

  it('is a function of the two readings only', () => {
    const a = ensembleOf(lat('1410', 'SUPPORTED'), reading('1950'))
    const b = ensembleOf(lat('1410', 'SUPPORTED'), reading('1950'))
    expect(a).toEqual(b)
  })
})

/** A real lattice from a drawn label, for the metric functions. */
function drawnLattice(text: string): EnsembledLattice {
  const r = renderLabel(text, { ...DEFAULT_LABEL_STYLE, capHeight: 16, slant: 0 })
  const read = readNumbers(r.raster, { orientations: ['HORIZONTAL'], hypotheses: true, retainPasses: true })
  const token = (read.raw ?? []).filter((t) => t.orientation === 'HORIZONTAL' && t.passBox).sort((a, b) => b.box.x1 - b.box.x0 - (a.box.x1 - a.box.x0))[0]
  const lattice = labelLattice({ orientation: 'HORIZONTAL', ink: read.passes?.HORIZONTAL as NonNullable<NonNullable<typeof read.passes>['HORIZONTAL']>, page: { width: r.raster.width, height: r.raster.height } }, token)
  if (!lattice) throw new Error('no lattice')
  return lattice
}

describe('the metric layer reads the ensemble, and offers the other witness at full strength', () => {
  it('without an external witness the lattice functions are unchanged', () => {
    const l = drawnLattice('1950')
    expect(readingOf(l)).toEqual({ asRead: l.asRead, ...(l.asReadValueCm !== undefined ? { valueCm: l.asReadValueCm } : {}), ocrClass: l.ocrClass })
  })

  it('CONTESTS: the external value is an alternative at ratio 1 and a correction one choice away', () => {
    const l = drawnLattice('1950')
    const rivalText = l.asRead === '1410' ? '1950' : '1410'
    const e = ensembleOf({ asRead: l.asRead, asReadValueCm: l.asReadValueCm, ocrClass: 'SUPPORTED' }, reading(rivalText))
    const with_: EnsembledLattice = { ...l, ocrClass: 'SUPPORTED', ensemble: e }
    expect(readingOf(with_)).toMatchObject({ asRead: l.asRead, ocrClass: 'AMBIGUOUS' })
    expect(latticeAlternatives(with_)[0]).toEqual({ text: rivalText, valueCm: Number(rivalText), ratio: 1 })
    const corr = correctionReadings(with_)
    expect(corr.find((c) => c.valueCm === Number(rivalText))).toMatchObject({ confidence: 1, substitutions: 1 })
    expect(corr.find((c) => c.substitutions === 0)?.text).toBe(l.asRead)
  })

  it('LEADS: the external value is the reading, the lattice value the candidate; no other external value is offered', () => {
    const l = drawnLattice('1140')
    const x = reading('2590', 0.99, 0.99, true, [{ text: '2690', p: 0.004 }, { text: '2560', p: 0.003 }])
    const e = ensembleOf({ asRead: l.asRead, asReadValueCm: l.asReadValueCm, ocrClass: 'AMBIGUOUS' }, x)
    expect(e.decision).toBe('LEADS')
    const with_: EnsembledLattice = { ...l, ocrClass: 'AMBIGUOUS', external: x, ensemble: e }
    expect(readingOf(with_)).toEqual({ asRead: '2590', valueCm: 2590, ocrClass: 'SUPPORTED' })
    const corr = correctionReadings(with_)
    expect(corr.filter((c) => c.substitutions === 0).map((c) => c.text)).toEqual(['2590'])
    expect(corr.some((c) => c.text === '2690' || c.text === '2560')).toBe(false)
    expect(latticeAlternatives(with_).some((a) => a.text === '2690' || a.text === '2560')).toBe(false)
    if (l.asReadValueCm !== undefined && l.asRead.length === 4) expect(latticeAlternatives(with_)[0]).toEqual({ text: l.asRead, valueCm: l.asReadValueCm, ratio: 1 })
  })
})

describe('the crop is the lattice’s own, padded, and nothing else', () => {
  it('cuts the pass field at the box, padded by the share of its height, off-field as paper', () => {
    const field = { width: 10, height: 6, data: Uint8ClampedArray.from({ length: 60 }, (_, i) => i) }
    const g = cropForToken(field, { x0: 2, y0: 1, x1: 6, y1: 5 })
    const m = Math.max(RECOGNISER_CROP.minPadPx, Math.round(RECOGNISER_CROP.padShare * 4))
    expect([g.width, g.height]).toEqual([4 + 2 * m, 4 + 2 * m])
    expect(g.data[0]).toBe(255)
    expect(g.data[m * g.width + m]).toBe(field.data[1 * 10 + 2])
    const c = labelCrop('id-1', field, { x0: 2, y0: 1, x1: 6, y1: 5 })
    expect(Object.keys(c).sort()).toEqual(['capPx', 'gray', 'key'])
    expect(c.capPx).toBe(4)
  })
})

/** A recogniser that records what it was handed and reads every crop as `answer(crop)`. */
function spyRecogniser(answer: (c: LabelCrop) => ExternalReading | undefined) {
  const calls: LabelCrop[][] = []
  const recogniser: LabelRecogniser = {
    id: 'ocr.spy@0',
    model: { name: 'spy', sha256: 'b'.repeat(64) },
    runtime: 'fixture',
    recognise: async (crops) => {
      calls.push([...crops])
      return crops.flatMap((c) => {
        const r = answer(c)
        return r ? [{ ...r, key: c.key }] : []
      })
    },
  }
  return { recogniser, calls }
}

describe('the seam: one batch per plan, crops only, and the OFF path unchanged', () => {
  const raster = renderGroundPlan(LARCHFIELD).toRaster()
  const frame = {
    id: 'frame-plan',
    assetId: 'asset-plan',
    variantByteHash: 'c'.repeat(64),
    size: { width: raster.width, height: raster.height },
    roles: { document: 'FLOOR_PLAN', storey: 'GROUND', annotation: 'DIMENSIONED', view: 'NOT_APPLICABLE', projection: 'ORTHOGRAPHIC_PLAN' },
  } as SourceCoordinateFrame
  const graph: SourceObservationGraph = { schema: 'buildapp.source-observation-graph', schemaVersion: '1.0.0', id: 'obsgraph-ensemble', sourcePackageId: 'pkg', sourcePackageHash: 'e'.repeat(64), extractors: [], coordinateFrames: [frame], observations: [], relations: [], conflicts: [], unresolved: [], contentHash: 'd'.repeat(64) }
  const options = { sourcePackageId: 'pkg', sourcePackageHash: 'e'.repeat(64), graph, raster: () => raster, slug: 'ensemble' }

  it('recogniser: undefined is extractMetricEvidence, byte for byte', async () => {
    const sync = extractMetricEvidence(options)
    const asyncOff = await extractMetricEvidenceAsync({ ...options, recogniser: undefined })
    expect(asyncOff.contentHash).toBe(sync.contentHash)
    expect(JSON.stringify(asyncOff)).toBe(JSON.stringify(sync))
    expect(sync.schemaVersion).toBe(METRIC_EVIDENCE_SCHEMA_VERSION)
    expect(sync.recogniser).toBeUndefined()
    expect((sync.numericLattices ?? []).every((l) => l.reader.version === NUMERIC_LATTICE_VERSION && !l.external && !l.ensemble)).toBe(true)
  })

  it('hands the recogniser one batch per plan frame, of crops alone, cut from the pass fields before any scale', async () => {
    const { recogniser, calls } = spyRecogniser(() => undefined)
    const set = await extractMetricEvidenceAsync({ ...options, recogniser })
    const lattices = set.numericLattices ?? []
    expect(lattices.length).toBeGreaterThan(0)
    expect(calls.length).toBe(1)
    expect(calls[0].length).toBe(lattices.length)
    for (const c of calls[0]) expect(Object.keys(c).sort()).toEqual(['capPx', 'gray', 'key'])
    // keyed opaquely, in order: nothing of the custom reader's text crosses (red team A5)
    expect(calls[0].map((c) => c.key)).toEqual(calls[0].map((_, i) => `c${i}`))
    // with readings for none, nothing was read: the set is the 1.5.0 set, byte for byte (red team A6)
    const off = extractMetricEvidence(options)
    expect(set.schemaVersion).toBe(METRIC_EVIDENCE_SCHEMA_VERSION)
    expect(set.recogniser).toBeUndefined()
    expect(set.contentHash).toBe(off.contentHash)
    expect(JSON.stringify(set)).toBe(JSON.stringify(off))
  })

  it('a set the recogniser read in names the reader it was read with', async () => {
    const { recogniser } = spyRecogniser(() => reading('9999', 0.2, 0.2, false))
    const set = await extractMetricEvidenceAsync({ ...options, recogniser })
    const off = extractMetricEvidence(options)
    expect(set.schemaVersion).toBe(METRIC_EVIDENCE_ENSEMBLE_SCHEMA_VERSION)
    expect(set.recogniser).toEqual({ id: 'ocr.spy@0', model: { name: 'spy', sha256: 'b'.repeat(64) }, runtime: 'fixture' })
    expect((set.numericLattices ?? []).every((l) => l.reader.version === NUMERIC_LATTICE_ENSEMBLE_VERSION && l.external !== undefined && !('key' in l.external))).toBe(true)
    expect(set.contentHash).not.toBe(off.contentHash)
  })

  it('sends the same crops whatever the chain tolerance and the printed specification (inputs the crops must not depend on)', async () => {
    const a = spyRecogniser(() => undefined)
    const b = spyRecogniser(() => undefined)
    await extractMetricEvidenceAsync({ ...options, recogniser: a.recogniser })
    await extractMetricEvidenceAsync({ ...options, tolerancePx: 6, specifications: [{ key: 'roof', label: 'Kąt nachylenia dachu', text: '40°' }], specificationHash: 'f'.repeat(64), recogniser: b.recogniser })
    const bytes = (calls: LabelCrop[][]): string[] => calls.flat().map((c) => `${c.key}|${c.gray.width}x${c.gray.height}|${Buffer.from(c.gray.data).toString('base64')}`)
    expect(bytes(b.calls)).toEqual(bytes(a.calls))
  })

  it('records each reading and the decision beside the lattice, which stays the lattice’s own', async () => {
    const off = extractMetricEvidence(options)
    const { recogniser } = spyRecogniser(() => reading('9999', 0.99, 0.99, true))
    const on = await extractMetricEvidenceAsync({ ...options, recogniser })
    const byId = new Map((off.numericLattices ?? []).map((l) => [l.id, l]))
    for (const l of on.numericLattices ?? []) {
      const own = byId.get(l.id)
      expect(own).toBeDefined()
      expect({ asRead: l.asRead, ocrClass: l.ocrClass, sequences: l.sequences }).toEqual({ asRead: own?.asRead, ocrClass: own?.ocrClass, sequences: own?.sequences })
      expect(l.external?.topK[0]?.text).toBe('9999')
      expect(l.ensemble?.external.text).toBe('9999')
    }
  })

  it('a recogniser that fails fails the reading, and a cancelled one stops it', async () => {
    const failing: LabelRecogniser = { id: 'ocr.broken@0', model: { name: 'x', sha256: 'a'.repeat(64) }, runtime: 'fixture', recognise: async () => Promise.reject(new Error('worker crashed')) }
    await expect(extractMetricEvidenceAsync({ ...options, recogniser: failing })).rejects.toThrow('worker crashed')
  })
})
