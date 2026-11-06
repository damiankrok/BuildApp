/**
 * EXTERIOR-COMPLETE E13: level marks a second reader (a vision model) read on a section the numeric reader could not
 * read — its glyphs under the legibility gate — admitted only by checks on the same drawing, never by the reader's own
 * confidence.
 *
 * A reading is a text and a box in the section's pixels. It is admitted when:
 *  1. it parses as a level datum (`parseNumber`), as printed;
 *  2. the level symbol it is printed over is found in the same bytes below its box (`markerApexBelow`): that fixes the
 *     row it marks — the reader's box only says where to look;
 *  3. its value lies on the ladder the other admitted readings make — one straight line from row to metres — within
 *     `LADDER_TOLERANCE_PX` of the line fitted WITHOUT it (leave one out), widened by the mark's leverage (the
 *     prediction interval: a ridge far above a cluster of floor marks is predicted less surely). A misread digit among
 *     the floors moves a mark several pixels and the drawing refuses it; a misread ridge digit may stay inside the
 *     widened interval — which is why the published height is required as well. At least `MIN_LADDER_MARKS` readings
 *     must stand, and the line must rise upwards.
 * A second, independent check is the published building height, when the page states one: the highest admitted level
 * less one of the admitted ground marks (0 to −1.5 m) must equal it within `PUBLISHED_HEIGHT_TOLERANCE_M`. A ladder with no published height to meet is
 * consistent but not corroborated, and the caller says so.
 *
 * What stands becomes LEVEL_DATUM evidence and the section's registration exactly as the numeric reader would have
 * made them, with `VISION_VALIDATED` provenance naming the reader and both checks. Pure: no network, no model call.
 */
import { stableId } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import { markerApexBelow } from './extract.js'
import { parseNumber } from './parse.js'
import { registerFrame } from './registration.js'
import type { CoordinateRegistration, MetricEvidence } from './schema.js'

export const EXTERNAL_LEVELS_VERSION = '1.1.0' as const
export const MIN_LADDER_MARKS = 3
export const LADDER_TOLERANCE_PX = 2.5
export const PUBLISHED_HEIGHT_TOLERANCE_M = 0.02

export type ExternalLevelReading = { text: string; boxPx: PixelRect; classConfidence: number }
export type LevelReadingCheck = {
  index: number
  text: string
  value?: number
  rowPx?: number
  status: 'ON_LADDER' | 'OFF_LADDER' | 'NOT_A_LEVEL' | 'NO_SYMBOL'
  residualPx?: number
  why: string
}
export type LevelLadderVerdict = {
  checks: LevelReadingCheck[]
  ladder?: { metresPerPixel: number; zeroRowPx: number; marks: number }
  published?: { key: string; valueM: number; spanM: number; groundM: number; agrees: boolean }
  admitted: boolean
  why: string
}

const fitLine = (pts: ReadonlyArray<{ row: number; value: number }>): { a: number; b: number } | undefined => {
  const n = pts.length
  if (n < 2) return undefined
  const mr = pts.reduce((s, p) => s + p.row, 0) / n
  const mv = pts.reduce((s, p) => s + p.value, 0) / n
  const sxx = pts.reduce((s, p) => s + (p.row - mr) ** 2, 0)
  if (sxx < 1e-9) return undefined
  const b = pts.reduce((s, p) => s + (p.row - mr) * (p.value - mv), 0) / sxx
  return { a: mv - b * mr, b }
}

/** Check a second reader's level readings on one section's raster. */
/**
 * E13: the box a second reader gives is where to look, not where the text is. Where the numeric reader found ink of its
 * own there — a token it could not read — the label's box is that token's: the one whose centre lies in the reader's box,
 * mostly inside it, covering at least a third of it. The reading's text stays the second reader's; only its place is taken from the drawing.
 */
export function snapToTokens(box: PixelRect, tokens: readonly PixelRect[]): PixelRect | undefined {
  const area = (b: PixelRect): number => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0)
  // one token, never a union: on a small sheet a union joins a label to its neighbour's
  const scored = tokens
    .map((t) => {
      const ix = Math.max(0, Math.min(box.x1, t.x1) - Math.max(box.x0, t.x0))
      const iy = Math.max(0, Math.min(box.y1, t.y1) - Math.max(box.y0, t.y0))
      const cx = (t.x0 + t.x1) / 2
      const cy = (t.y0 + t.y1) / 2
      const centred = cx >= box.x0 && cx <= box.x1 && cy >= box.y0 && cy <= box.y1
      return { t, share: area(t) > 0 && centred ? (ix * iy) / area(t) : 0, cover: area(box) > 0 ? (ix * iy) / area(box) : 0 }
    })
    .filter((x) => x.share >= 0.5 && x.cover >= 0.3)
    .sort((a, b) => b.cover - a.cover)
  return scored[0]?.t
}

export function checkLevelReadings(raster: Raster, readings: readonly ExternalLevelReading[], published?: { key: string; valueM: number }, tokenBoxes: readonly PixelRect[] = []): LevelLadderVerdict {
  const checks: LevelReadingCheck[] = readings.map((r, index) => {
    const parsed = parseNumber(r.text).find((p) => p.kind === 'LEVEL_DATUM')
    if (!parsed) return { index, text: r.text, status: 'NOT_A_LEVEL', why: `"${r.text}" does not read as a level datum` }
    const snapped = snapToTokens(r.boxPx, tokenBoxes)
    const fromTokens = snapped ? markerApexBelow(raster, snapped) : undefined
    const apex = fromTokens ?? markerApexBelow(raster, r.boxPx)
    if (!apex) return { index, text: r.text, value: parsed.value, status: 'NO_SYMBOL', why: `no level symbol below ${snapped ? "the numeric reader's own ink there or " : ''}the box in the drawing: the row it marks is not found` }
    return { index, text: r.text, value: parsed.value, rowPx: apex.row, status: 'ON_LADDER', why: `printed over a level symbol whose apex is row ${apex.row}${fromTokens ? " (the label's place from the numeric reader's own ink)" : ''}` }
  })
  // leave one out, repeatedly dropping the worst, until every remaining mark fits the line the others make
  let live = checks.filter((c) => c.status === 'ON_LADDER')
  for (let guard = 0; guard < readings.length && live.length >= MIN_LADDER_MARKS; guard += 1) {
    const misses = live.map((c) => {
      const others = live.filter((o) => o !== c).map((o) => ({ row: o.rowPx as number, value: o.value as number }))
      const line = fitLine(others)
      if (!line || Math.abs(line.b) < 1e-9) return { c, px: Number.POSITIVE_INFINITY, tol: LADDER_TOLERANCE_PX }
      // the prediction interval of a line fitted on the others: a mark far beyond their rows is predicted less surely
      // (a cluster of floor levels says little about where the ridge row is), so its tolerance widens by the leverage
      const n = others.length
      const mean = others.reduce((s, o) => s + o.row, 0) / n
      const sxx = others.reduce((s, o) => s + (o.row - mean) ** 2, 0)
      const tol = LADDER_TOLERANCE_PX * Math.sqrt(1 + 1 / n + ((c.rowPx as number) - mean) ** 2 / Math.max(1e-9, sxx))
      return { c, px: Math.abs(((c.value as number) - line.a) / line.b - (c.rowPx as number)), tol }
    })
    for (const m of misses) m.c.residualPx = Number.isFinite(m.px) ? Math.round(m.px * 100) / 100 : undefined
    const worst = misses.reduce((w, m) => (m.px / m.tol > w.px / w.tol ? m : w), misses[0])
    if (worst.px <= worst.tol) break
    worst.c.status = 'OFF_LADDER'
    worst.c.why = `${worst.c.text} sits ${Number.isFinite(worst.px) ? worst.px.toFixed(1) : '∞'} px off the ladder the other marks make (tolerance ${worst.tol.toFixed(1)} px there): the drawing refuses the reading`
    live = live.filter((c) => c !== worst.c)
  }
  const line = live.length >= MIN_LADDER_MARKS ? fitLine(live.map((c) => ({ row: c.rowPx as number, value: c.value as number }))) : undefined
  if (!line || line.b >= 0) {
    for (const c of live) c.status = 'OFF_LADDER'
    return { checks, admitted: false, why: line ? 'the marks rise downwards: no section draws its levels so' : `fewer than ${MIN_LADDER_MARKS} marks stand on one ladder: nothing checks them against each other` }
  }
  const values = live.map((c) => c.value as number)
  // the published height is the ridge over the terrain the page measures from: one of the terrain marks the section
  // prints (at or below ±0,00, within 1.5 m), not necessarily the lowest — a section may print the ground at both sides
  const top = Math.max(...values)
  const grounds = values.filter((v) => v <= 0 && v > -1.5)
  const best = grounds.length > 0 && published ? grounds.reduce((b, g) => (Math.abs(top - g - published.valueM) < Math.abs(top - b - published.valueM) ? g : b), grounds[0]) : Math.min(...values)
  const span = top - best
  const pub = published ? { key: published.key, valueM: published.valueM, spanM: Math.round(span * 1000) / 1000, groundM: best, agrees: Math.abs(span - published.valueM) <= PUBLISHED_HEIGHT_TOLERANCE_M } : undefined
  const ladder = { metresPerPixel: Math.round(-line.b * 1e6) / 1e6, zeroRowPx: Math.round((-line.a / line.b) * 100) / 100, marks: live.length }
  return { checks, ladder, ...(pub ? { published: pub } : {}), admitted: true, why: `${live.length} marks on one ladder at ${ladder.metresPerPixel} m/px${pub ? `; highest less the ground mark ${pub.groundM} is ${pub.spanM} m against the published ${pub.valueM} m: ${pub.agrees ? 'agrees' : 'DISAGREES'}` : '; no published height to meet'}` }
}

/** A level datum the numeric reader made on the same section that the admitted readings overrule, and why. */
export type SupersededLevel = { evidenceId: string; value: number; why: string }

const boxesOverlap = (a: PixelRect, b: PixelRect): boolean => {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  const smaller = Math.min(Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0), Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0))
  return smaller > 0 && (ix * iy) / smaller >= 0.5
}

/**
 * E13 (a regression section: the numeric reader misread one label by a digit, its runner-up the right reading): the numeric reader's own
 * level datums on the section are weighed against the admitted ladder. One whose text box is the box of an admitted
 * reading is the same printed label read twice — the reading the drawing admits stands; one whose row the ladder puts at
 * another value than it carries, beyond the tolerance an admitted mark has there, is a misread the drawing refuses.
 * Neither is kept beside the admitted readings: two values for one label are a storey that is not there.
 */
export function supersededLevels(existing: readonly MetricEvidence[], frameId: string, readings: readonly ExternalLevelReading[], verdict: LevelLadderVerdict): SupersededLevel[] {
  if (!verdict.admitted || !verdict.ladder) return []
  const ladder = verdict.ladder
  const stand = verdict.checks.filter((c) => c.status === 'ON_LADDER')
  const rows = stand.map((c) => c.rowPx as number)
  const n = rows.length
  const mean = rows.reduce((a, r) => a + r, 0) / n
  const sxx = rows.reduce((a, r) => a + (r - mean) ** 2, 0)
  const out: SupersededLevel[] = []
  for (const e of existing) {
    if (e.kind !== 'LEVEL_DATUM' || e.frameId !== frameId || e.provenance.extractor === 'VISION_VALIDATED') continue
    const same = stand.find((c) => e.textBox && boxesOverlap(e.textBox, readings[c.index].boxPx))
    if (same) {
      if (Math.abs((same.value as number) - e.value) > 1e-6) out.push({ evidenceId: e.id, value: e.value, why: `the same printed label as the admitted ${same.text}: read ${e.rawText ?? e.value} by the numeric reader, which the drawing's ladder does not admit` })
      continue
    }
    const g = e.measuredGeometry
    const row = g && g.type === 'SEGMENT' ? (g.a.y + g.b.y) / 2 : undefined
    if (row === undefined) continue
    const predicted = (ladder.zeroRowPx - row) * ladder.metresPerPixel
    const tolPx = LADDER_TOLERANCE_PX * Math.sqrt(1 + 1 / n + (row - mean) ** 2 / Math.max(1e-9, sxx))
    const offPx = Math.abs(e.value / ladder.metresPerPixel - (ladder.zeroRowPx - row))
    if (offPx > tolPx) out.push({ evidenceId: e.id, value: e.value, why: `its row ${Math.round(row)} stands at ${predicted.toFixed(2)} m on the ladder the admitted marks make, ${offPx.toFixed(1)} px from the ${e.value.toFixed(2)} it carries (tolerance ${tolPx.toFixed(1)} px there): the drawing refuses it` })
  }
  return out
}

/** The admitted readings as the numeric reader's own evidence and the section's registration. */
export function levelEvidenceFromReadings(frame: Pick<SourceCoordinateFrame, 'id' | 'assetId' | 'variantByteHash'>, readings: readonly ExternalLevelReading[], verdict: LevelLadderVerdict, reader: { id: string; model: string }): { evidence: MetricEvidence[]; registration?: CoordinateRegistration } {
  if (!verdict.admitted || !verdict.ladder) return { evidence: [] }
  const ladder = verdict.ladder
  const stand = verdict.checks.filter((c) => c.status === 'ON_LADDER')
  const name = `${reader.id}/${reader.model}@level-marks+ladder-${EXTERNAL_LEVELS_VERSION}`
  const evidence: MetricEvidence[] = stand.map((c) => {
    const r = readings[c.index]
    const row = c.rowPx as number
    const cx = Math.round((r.boxPx.x0 + r.boxPx.x1) / 2)
    return {
      id: stableId('metric', 'level', { frameId: frame.id, box: r.boxPx, value: c.value }),
      kind: 'LEVEL_DATUM',
      frameId: frame.id,
      assetId: frame.assetId,
      variantByteHash: frame.variantByteHash,
      value: c.value as number,
      unit: 'm',
      origin: 'READ',
      rawText: r.text,
      textBox: r.boxPx,
      measuredGeometry: { type: 'SEGMENT', a: { x: cx - 1, y: row }, b: { x: cx + 1, y: row } },
      association: { kind: 'LEVEL_MARKER', score: 0.5, why: c.why, observationIds: [] },
      ocrTokenIds: [],
      observationIds: [],
      alternatives: [],
      confidence: 0.7,
      provenance: { extractor: 'VISION_VALIDATED', name, detail: `read by ${reader.model} (AI_SUGGESTED, class confidence ${r.classConfidence}); admitted by the drawing: ${c.why}, ${c.residualPx ?? 0} px off the ladder of ${ladder.marks} marks${verdict.published ? `; the published ${verdict.published.key} ${verdict.published.agrees ? 'agrees' : 'disagrees'}` : ''}` },
    } as MetricEvidence
  })
  const anchors = stand
    .filter((c) => (c.value as number) > 0 && Math.abs(ladder.zeroRowPx - (c.rowPx as number)) >= 20)
    .map((c) => ({
      id: stableId('anchor', 'level', { frameId: frame.id, row: c.rowPx, value: c.value }),
      kind: 'LEVEL_DATUM_PAIR' as const,
      evidenceIds: [evidence.find((e) => e.value === c.value)?.id as string],
      axis: 'Y' as const,
      pixelSpan: Math.round(Math.abs(ladder.zeroRowPx - (c.rowPx as number)) * 1e6) / 1e6,
      metricSpan: c.value as number,
      weight: 0.5,
    }))
  const registration = anchors.length >= 2 ? registerFrame({ frameId: frame.id, assetId: frame.assetId, variantByteHash: frame.variantByteHash, plane: 'SECTION_HY', anchors, originPx: { x: 0, y: ladder.zeroRowPx }, flipX: false, flipY: true, detail: `${anchors.length} anchors from level datums a vision model read and the drawing's own ladder admitted (${name})` }) : undefined
  return { evidence, ...(registration ? { registration } : {}) }
}
