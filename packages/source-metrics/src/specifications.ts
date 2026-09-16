/**
 * Reading the publisher's own technical specification.
 *
 * A catalogue page carries a short list of sentences about how the building is
 * built — the roof, the walls, the floor structure, the joinery — and those
 * sentences state things that the drawings state only implicitly or not at
 * all. "dach: dwuspadowy, nachylenie 40 st." is a roof KIND and a roof PITCH,
 * printed as words, from the same publisher whose drawings are the rest of the
 * evidence. It is not a weaker source than a drawing; for a pitch it is a
 * stronger one, because measuring an angle off a raster elevation costs
 * several degrees of error and reading a printed number costs none.
 *
 * Two kinds of output come out of it:
 *
 * - **Metric evidence** for the numbers — an angle, a knee-wall height, a wall
 *   build-up — attached to the PAGE rather than to a drawing, because that is
 *   where they were printed, and the page has a hash like everything else.
 * - **Findings** for the words — gable or hip, eaves or no eaves — which are
 *   not measurements and must not be turned into any.
 *
 * The vocabulary is a language's, not a project's. Nothing here knows which
 * building it is reading about, and a specification that says nothing produces
 * nothing rather than a default.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { MetricEvidence, SpecificationFinding } from './schema.js'

export const SPEC_READER_NAME = 'published-specification-reader'
export const SPEC_READER_VERSION = '1.0.0'

/** The frame a statement printed on the page itself belongs to. */
export const PUBLISHED_PAGE_FRAME = 'frame-published-page'
export const PUBLISHED_PAGE_ASSET = 'asset-published-page'

export type PublishedSpecificationInput = { key: string; label: string; text: string }

export type SpecificationReading = {
  evidence: MetricEvidence[]
  findings: SpecificationFinding[]
  /** Specification lines that carried a number nothing here knew how to read. */
  unread: Array<{ key: string; label: string; why: string }>
}

/**
 * Latin text flattened to the ASCII a keyword list can be written in.
 *
 * NFD strips the marks that decompose, but a stroked or slashed letter is a
 * single codepoint that decomposes into itself — a Polish ł survives NFD
 * intact, and a rule written for `plaski` then never matches `płaski`. The few
 * letters that behave that way are listed out.
 */
const STROKED: Record<string, string> = { 'ł': 'l', 'đ': 'd', 'ø': 'o', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ð': 'd', 'þ': 'th' }
const deaccent = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[łđøßæœðþ]/g, (c) => STROKED[c] ?? c)

/** `40 st.`, `40°`, `40 stopni`, `40 degrees`, `pitch 40`. */
const ANGLE_PATTERNS: RegExp[] = [
  /(?<![\d.,])(\d{1,2}(?:[.,]\d+)?)(?!\d)\s*(?:st\.|stopni|stopnie|°|deg\b|degrees\b)/i,
  /(?:nachyleni\w*|spadek|pitch|slope)\D{0,12}(?<![\d.,])(\d{1,2}(?:[.,]\d+)?)(?!\d)/i,
]

const CM_PATTERN = /(\d{1,3}(?:[.,]\d+)?)\s*cm\b/gi

/** Roof kinds by the word a specification uses for them. Order matters: the more specific word must be tested first. */
const ROOF_KINDS: Array<{ test: RegExp; value: string; why: string }> = [
  { test: /\bjednospadow/, value: 'MONOPITCH', why: 'a roof described as falling one way' },
  { test: /\bdwuspadow|\bgable\b|\bsiodlow/, value: 'GABLE', why: 'a roof described as falling two ways off a ridge' },
  { test: /\bczterospadow|\bkopertow|\bnamiotow|\bhipped?\b/, value: 'HIP', why: 'a roof described as falling four ways' },
  { test: /\bwielospadow/, value: 'MULTI_PITCH', why: 'a roof described as falling several ways' },
  { test: /\bplaski\b|\bstropodach|\bflat roof\b/, value: 'FLAT', why: 'a roof described as flat' },
  { test: /\bmansardow/, value: 'MANSARD', why: 'a roof described as a mansard' },
]

const number = (text: string): number | null => {
  const n = Number(text.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Turn a publisher's specification list into evidence and findings.
 *
 * `pageHash` is the sha-256 of the page the specification was printed on, and
 * it goes on every piece of evidence this produces: a reading is only valid
 * for the bytes it was read from, here as everywhere else in the pipeline.
 */
export function readSpecifications(specifications: readonly PublishedSpecificationInput[], pageHash: string): SpecificationReading {
  const evidence: MetricEvidence[] = []
  const findings: SpecificationFinding[] = []
  const unread: SpecificationReading['unread'] = []

  const emit = (
    kind: MetricEvidence['kind'],
    value: number,
    unit: MetricEvidence['unit'],
    spec: PublishedSpecificationInput,
    rawText: string,
    confidence: number,
    why: string,
    origin: MetricEvidence['origin'] = 'READ',
  ): void => {
    evidence.push({
      id: stableId('metric', `spec-${spec.key}-${kind.toLowerCase()}`, { key: spec.key, kind, value, unit, rawText }),
      kind,
      frameId: PUBLISHED_PAGE_FRAME,
      assetId: PUBLISHED_PAGE_ASSET,
      variantByteHash: pageHash,
      value: round6(value),
      unit,
      origin,
      rawText,
      association: {
        kind: 'PUBLISHED_SPECIFICATION',
        score: confidence,
        why,
        observationIds: [],
      },
      ocrTokenIds: [],
      observationIds: [],
      alternatives: [],
      confidence,
      provenance: { extractor: 'PACKAGE_METADATA', name: `${SPEC_READER_NAME}@${SPEC_READER_VERSION}`, detail: `${spec.label}: ${spec.text}` },
    })
  }

  for (const spec of specifications) {
    const flat = deaccent(spec.text)

    // --- the roof --------------------------------------------------------
    if (spec.key === 'roof' || /\bdach\b|\broof\b/.test(flat)) {
      const kind = ROOF_KINDS.find((k) => k.test.test(flat))
      if (kind) {
        findings.push({
          key: spec.key,
          subject: 'ROOF_KIND',
          value: kind.value,
          quote: spec.text.slice(0, 200),
          confidence: 0.9,
          why: `${kind.why}, in the publisher's own specification`,
        })
      }
      // "bez okapow" — a roof the publisher says has no eaves has no overhang,
      // and a default overhang applied over the top of that statement would be
      // the reconstruction inventing half a metre of roof on every side.
      if (/\bbez\s+okap|\bno eaves\b|\bbez\s+wysiegu/.test(flat)) {
        findings.push({ key: spec.key, subject: 'ROOF_EAVES', value: 'NONE', quote: spec.text.slice(0, 200), confidence: 0.85, why: 'the specification says the roof has no eaves' })
      } else if (/\bokap\w*\b/.test(flat)) {
        findings.push({ key: spec.key, subject: 'ROOF_EAVES', value: 'PRESENT', quote: spec.text.slice(0, 200), confidence: 0.6, why: 'the specification mentions eaves' })
      }

      let pitch: number | null = null
      let quote = ''
      for (const pattern of ANGLE_PATTERNS) {
        const m = pattern.exec(spec.text)
        if (!m) continue
        const n = number(m[1])
        // A pitch outside this range is not a pitch: it is a percentage, a
        // year, a product code or a thickness that happened to sit next to the
        // word.
        if (n === null || n < 3 || n > 70) continue
        pitch = n
        quote = m[0]
        break
      }
      if (pitch !== null) emit('ANGLE', pitch, 'deg', spec, quote, 0.92, `the publisher prints the roof pitch as "${quote}"`)
      else if (/nachyleni|spadek|pitch|slope/.test(flat)) unread.push({ key: spec.key, label: spec.label, why: 'the line speaks of a pitch but states no angle this reader could recognise' })
    }

    // --- a knee wall, which is a storey height and nothing else -----------
    if (spec.key === 'knee_wall') {
      const m = CM_PATTERN.exec(spec.text)
      CM_PATTERN.lastIndex = 0
      const n = m ? number(m[1]) : null
      if (n !== null && n > 20 && n < 400) emit('LINEAR_DIMENSION', n, 'cm', spec, m ? m[0] : String(n), 0.85, 'the height of the knee wall, printed in the specification')
      else unread.push({ key: spec.key, label: spec.label, why: 'no plausible height in centimetres' })
    }

    // --- the wall build-up ------------------------------------------------
    if (spec.key === 'walls') {
      const layers: number[] = []
      for (const m of spec.text.matchAll(CM_PATTERN)) {
        const n = number(m[1])
        if (n !== null && n >= 2 && n <= 80) layers.push(n)
      }
      if (layers.length > 0) {
        const total = layers.reduce((a, b) => a + b, 0)
        emit(
          'LINEAR_DIMENSION',
          total,
          'cm',
          spec,
          layers.map((l) => `${l} cm`).join(' + '),
          layers.length > 1 ? 0.7 : 0.6,
          `${layers.length} layer${layers.length === 1 ? '' : 's'} of wall build-up printed in the specification, summed; a render coat is usually not given a thickness and is not in this number`,
          'DERIVED',
        )
      }
    }
  }

  evidence.sort((a, b) => a.id.localeCompare(b.id))
  // Two lines saying the same thing corroborate each other; two lines saying
  // different things are a disagreement and both survive, for the layout gate
  // to see. Neither is a reason to print the same row twice.
  const merged = new Map<string, SpecificationFinding & { seen: number }>()
  for (const f of findings.sort((a, b) => a.subject.localeCompare(b.subject) || a.key.localeCompare(b.key))) {
    const key = `${f.subject}::${f.value}`
    const held = merged.get(key)
    if (held) held.seen += 1
    else merged.set(key, { ...f, seen: 1 })
  }
  const deduped = [...merged.values()].map(({ seen, ...f }) => ({
    ...f,
    confidence: round6(Math.min(0.97, f.confidence + 0.05 * (seen - 1))),
    why: seen > 1 ? `${f.why}, said in ${seen} places on the page` : f.why,
  }))
  findings.length = 0
  findings.push(...deduped)
  findings.sort((a, b) => a.subject.localeCompare(b.subject) || a.key.localeCompare(b.key))
  unread.sort((a, b) => a.key.localeCompare(b.key))
  return { evidence, findings, unread }
}

/** The one finding of a subject, when the specification settled it. */
export const findingOf = (findings: readonly SpecificationFinding[], subject: SpecificationFinding['subject']): SpecificationFinding | undefined =>
  findings.find((f) => f.subject === subject)
