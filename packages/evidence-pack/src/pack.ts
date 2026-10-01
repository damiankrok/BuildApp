/**
 * The Analyzer Evidence Pack (BUILDPLAN-ANALYZER-005D).
 *
 * One directory per run that lets a coordinator see, from the repository, what the analyzer saw,
 * what it inferred, which alternatives existed, what it accepted and rejected, and where the first
 * wrong decision happened — as pictures of analyzer-owned primitives with JSON sidecars, a decision
 * timeline and a manifest, never as prose alone and never as a publisher's drawing.
 *
 * It is built from what the run already wrote (`RunRecord`) and is a pure function of it: the same
 * run gives the same pack byte for byte, and building a pack changes nothing the run decided.
 */
import { sha256Bytes, sha256Hex, stableJson } from '@buildapp/source-common'
import { COLOURS, FORBIDDEN_IN_SVG, Svg } from './svg.js'
import { TIMELINE_STAGES } from './types.js'
import type { ChainJson, DecisionEvent, LatticeJson, MarkJson, ObservationJson, PlanJson, Rect, RunRecord, SolutionJson, TimelineStage } from './types.js'

export const EVIDENCE_PACK_SCHEMA = 'buildapp.evidence-pack' as const
export const EVIDENCE_PACK_VERSION = '1.0.0' as const

/**
 * Size bounds: a pack is something a reviewer opens on GitHub. Pictures carry at most `svgElements`
 * primitives; lists keep their top `topK` and summarise the rest; at most `frames` plan copies are
 * analysed; the preview is at most `previewWidth` pixels wide (bounded by the writer that supplies
 * it); a JSON file over `jsonBytes` is cut to its summary. The winner and anything a failure names
 * are always kept.
 */
export const PACK_BOUNDS = { svgElements: 3000, topK: 200, frames: 4, metricFrames: 8, jsonBytes: 1_500_000, previewWidth: 800 } as const

export const PACK_FILES = [
  '00-source-summary.json',
  '01-page-classification.json',
  '02-asset-inventory.json',
  '03-plan-frame.svg',
  '03-plan-frame.json',
  '04-wall-bands.svg',
  '04-wall-bands.json',
  '05-dimension-lines.svg',
  '05-dimension-lines.json',
  '06-tick-candidates.svg',
  '06-tick-candidates.json',
  '07-ocr-labels.svg',
  '07-ocr-labels.json',
  '08-dimension-span-hypotheses.svg',
  '08-dimension-span-hypotheses.json',
  '09-scale-hypotheses.svg',
  '09-scale-hypotheses.json',
  '10-extent-hypotheses.svg',
  '10-extent-hypotheses.json',
  '11-envelope-candidates.svg',
  '11-envelope-candidates.json',
  '12-opening-observations.svg',
  '12-opening-observations.json',
  '13-body-candidates.svg',
  '13-body-candidates.json',
  '14-selected-layout.svg',
  '14-selected-layout.json',
  '15-canonical-model-summary.json',
  '17-evidence-trace.json',
  '18-decision-timeline.json',
  'evidence-summary.svg',
  'README.md',
] as const

export type EvidencePack = {
  /** File name → content. Text files as strings; the preview (when supplied) as bytes. */
  files: Map<string, string | Uint8Array>
  manifest: PackManifest
  timeline: DecisionEvent[]
}

export type PackManifest = {
  schema: typeof EVIDENCE_PACK_SCHEMA
  evidenceModeVersion: string
  runId: string
  gitSha: string | null
  versions: Record<string, string>
  hashes: Record<string, string | null>
  result: 'COMPLETED' | 'FAILED'
  failureCode: string | null
  firstWarning: string | null
  selectedPlanFrameId: string | null
  counts: Record<string, number>
  files: Array<{ name: string; sha256: string; bytes: number }>
}

const markIdOf = (chainId: string, atPx: number): string => `tick:${chainId}:${Math.round(atPx * 2) / 2}`
const labelIdOf = (o: Pick<ObservationJson, 'chainId' | 'orientation' | 'rawText'>): string => `label:${o.chainId}:${o.orientation}:${o.rawText}`
const round = (v: number, d = 4): number => Math.round(v * 10 ** d) / 10 ** d
const rectText = (r: Rect | null | undefined): string => (r ? `${round(r.x0, 1)},${round(r.y0, 1)},${round(r.x1, 1)},${round(r.y1, 1)}` : 'none')
const json = (v: unknown): string => stableJson(v)

/** Keep the first `k`, and say how many more there were. */
function topK<T>(items: readonly T[], k: number = PACK_BOUNDS.topK): { items: T[]; omitted: number } {
  return { items: items.slice(0, k), omitted: Math.max(0, items.length - k) }
}

/** The plan copies the pack looks at: the selected one first, then the other copies of its storey. */
function framesOf(run: RunRecord): PlanJson[] {
  const plans = run.digest?.plans ?? []
  const selected = plans.find((p) => p.frameId === run.digest?.selectedPlanFrameId) ?? plans[0]
  if (!selected) return []
  const rest = plans.filter((p) => p !== selected && p.storey === selected.storey)
  return [selected, ...rest].slice(0, PACK_BOUNDS.frames)
}

const marksOf = (c: ChainJson): MarkJson[] => (c.marks && c.marks.length === c.ticksPx.length ? c.marks : c.ticksPx.map((atPx) => ({ atPx, class: 'TICK' as const, reasons: ['UNCLASSIFIED'] })))
/**
 * A mark's decision as the timeline records it. A questionable mark is still a measurement point (a span may stop
 * at it), so it is ACCEPTED with its doubt named; only a rejected mark stops being one. This is what the first
 * divergence compares: the step from "a point the chain may be cut at" to "no point at all".
 */
const decisionOfMark = (m: MarkJson): string => (m.class === 'REJECTED' ? 'REJECTED' : m.class === 'QUESTIONABLE' ? 'ACCEPTED_QUESTIONABLE' : 'ACCEPTED')

/** The observations a frame's chains decided on: each chain's labels in the orientation it took. */
function decided(observations: readonly ObservationJson[]): ObservationJson[] {
  return observations.filter((o) => o.independence !== 'ORIENTATION_UNDECIDED')
}

/** The binding each label measures: the 005D primary binding, or (before 1.3.0) the span it was accepted on. */
function boundSpanOf(obs: readonly ObservationJson[]): Map<string, ObservationJson> {
  const out = new Map<string, ObservationJson>()
  for (const o of [...obs].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const key = labelIdOf(o)
    const primary = o.binding ? o.binding.role === 'PRIMARY' : o.status === 'ACCEPTED'
    if (primary && !out.has(key)) out.set(key, o)
  }
  return out
}

export function buildEvidencePack(run: RunRecord): EvidencePack {
  const files = new Map<string, string | Uint8Array>()
  const events: DecisionEvent[] = []
  let seq = 0
  const event = (stage: TimelineStage, objectId: string, decision: string, reason: string, extra: Partial<DecisionEvent> = {}): void => {
    seq += 1
    events.push({ eventId: `e${String(seq).padStart(5, '0')}`, seq, stage, objectId, decision, reason, supportIds: [], conflictIds: [], reversible: true, downstream: downstreamOf(stage), ...extra })
  }
  const metrics = run.metrics ?? {}
  const frames = framesOf(run)
  const selected = frames[0]
  const solutionOf = (frameId: string): SolutionJson | undefined => metrics.metricSolutions?.find((s) => s.frameId === frameId)
  const chainsOf = (frameId: string): ChainJson[] => (metrics.chains ?? []).filter((c) => c.frameId === frameId)
  const observationsOf = (frameId: string): ObservationJson[] => (metrics.dimensionObservations ?? []).filter((o) => o.frameId === frameId)
  const preSchema = !metrics.schemaVersion || metrics.schemaVersion < '1.3.0'
  // Every plan copy the metric layer solved: its decisions come before any plan is selected.
  // Ordered as a reader would look: the lowest storey's copies first, dimensioned before area tables, the largest first.
  const assetOf = new Map((run.pkg.assets ?? []).map((a) => [a.id, a]))
  const STOREY_ORDER = ['BASEMENT', 'GROUND', 'UNKNOWN', 'FIRST', 'UPPER', 'ATTIC']
  const frameKey = (frameId: string): Array<number | string> => {
    const sol = (metrics.metricSolutions ?? []).find((x) => x.frameId === frameId) as (SolutionJson & { assetId?: string }) | undefined
    const asset = sol?.assetId ? assetOf.get(sol.assetId) : undefined
    const variant = asset?.variants?.find((v) => v.id === asset.selectedVariantId) ?? asset?.variants?.[0]
    const storey = asset?.roles?.storey ?? 'UNKNOWN'
    return [STOREY_ORDER.indexOf(storey) < 0 ? 9 : STOREY_ORDER.indexOf(storey), asset?.roles?.annotation === 'DIMENSIONED' ? 0 : 1, -((variant?.decoded?.width ?? 0) * (variant?.decoded?.height ?? 0)), frameId]
  }
  const byKey = (a: string, b: string): number => {
    const [x, y] = [frameKey(a), frameKey(b)]
    for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1
    return 0
  }
  const metricFrames = [...new Set((metrics.metricSolutions ?? []).map((s) => s.frameId))].sort(byKey).slice(0, PACK_BOUNDS.metricFrames)
  const longestFirst = (cs: ChainJson[]): ChainJson[] => [...cs].sort((a, b) => b.ticksPx[b.ticksPx.length - 1] - b.ticksPx[0] - (a.ticksPx[a.ticksPx.length - 1] - a.ticksPx[0]) || (a.id < b.id ? -1 : 1))
  const sizeOf = (frameId: string): { width: number; height: number } => run.digest?.plans.find((p) => p.frameId === frameId)?.sizePx ?? { width: 1, height: 1 }

  // --- 00–02: the source --------------------------------------------------------
  const assets = run.pkg.assets ?? []
  const byDocument: Record<string, number> = {}
  for (const a of assets) byDocument[a.roles?.document ?? 'UNKNOWN'] = (byDocument[a.roles?.document ?? 'UNKNOWN'] ?? 0) + 1
  const failuresByCode: Record<string, number> = {}
  for (const f of run.pkg.failures ?? []) failuresByCode[String(f.code)] = (failuresByCode[String(f.code)] ?? 0) + 1
  files.set(
    '00-source-summary.json',
    json({
      runId: run.runId,
      canonicalUrl: run.pkg.canonicalUrl ?? null,
      packageId: run.pkg.id ?? null,
      contentHash: run.pkg.contentHash ?? null,
      adapter: run.pkg.adapter ?? null,
      assets: assets.length,
      assetsByDocument: byDocument,
      publishedFacts: (run.pkg.publishedFacts ?? []).map((f) => ({ key: f.key, value: f.value, unit: f.unit })),
      failuresByCode,
      note: 'facts and hashes only; no publisher drawing, page or render is in this pack',
    }),
  )
  event('SOURCE', `source:${run.pkg.id ?? run.runId}`, 'ACQUIRED', `${assets.length} assets (${Object.entries(byDocument).map(([k, v]) => `${k} ${v}`).join(', ')}), ${(run.pkg.publishedFacts ?? []).length} published figures, ${(run.pkg.failures ?? []).length} failures`)
  files.set('01-page-classification.json', json({ assets: assets.map((a) => ({ id: a.id, caption: a.caption ?? null, roles: a.roles ?? {} })), planFrames: (run.digest?.plans ?? []).map((p) => ({ frameId: p.frameId, storey: p.storey, annotation: p.annotation, sizePx: p.sizePx })) }))
  files.set(
    '02-asset-inventory.json',
    json({
      assets: assets.map((a) => ({
        assetId: a.id,
        role: a.roles ?? {},
        selectedVariantId: a.selectedVariantId ?? null,
        variants: (a.variants ?? []).map((v) => ({ id: v.id, url: v.url, canonicalUrl: v.url, sha256: v.byteHash, byteSize: v.byteLength ?? null, pixels: v.decoded ?? null, contentType: v.mediaType ?? null, crop: v.crop ?? null })),
      })),
    }),
  )


  // --- 03–14: the selected frame's pictures ------------------------------------------
  const W = selected?.sizePx.width ?? 400
  const H = selected?.sizePx.height ?? 300
  const svg = (title: string): Svg => new Svg(W, H, `${run.runId} — ${title}`, PACK_BOUNDS.svgElements)
  const frameChains = selected ? chainsOf(selected.frameId) : []
  const frameObs = selected ? observationsOf(selected.frameId) : []
  const sol = selected ? solutionOf(selected.frameId) : undefined

  // 03: the frame
  {
    const s = svg('plan frame')
    if (selected) {
      s.rect(0, 0, W, H, { stroke: '#cccccc', width: 1 })
      s.rect(selected.extent.x0, selected.extent.y0, selected.extent.x1, selected.extent.y1, { stroke: COLOURS.extent, width: 2 }, 'extent')
      if (selected.envelope) s.rect(selected.envelope.x0, selected.envelope.y0, selected.envelope.x1, selected.envelope.y1, { stroke: COLOURS.envelope, width: 1.5, dash: '6 3' }, 'envelope')
      for (const x of selected.linesX ?? []) s.line(x, 0, x, H, { stroke: '#e0b0e0', width: 0.5 })
      for (const y of selected.linesY ?? []) s.line(0, y, W, y, { stroke: '#e0b0e0', width: 0.5 })
    }
    files.set('03-plan-frame.svg', s.render())
    files.set('03-plan-frame.json', json({ selectedPlanFrameId: selected?.frameId ?? null, frames: frames.map((p) => ({ frameId: p.frameId, storey: p.storey, annotation: p.annotation, sizePx: p.sizePx, wallPx: p.wallPx, scale: p.scale, extent: p.extent, extentWeak: p.extentWeak ?? null, extentProvenance: p.extentProvenance ?? null, envelope: p.envelope, gridLines: { x: p.linesX?.length ?? 0, y: p.linesY?.length ?? 0 } })) }))
  }

  // 04: wall bands
  {
    const s = svg('wall bands')
    for (const [i, b] of (selected?.bands ?? []).entries()) s.rect(b.bounds.x0, b.bounds.y0, b.bounds.x1, b.bounds.y1, { fill: COLOURS.wall, opacity: 0.6 }, `band-${i}`, { axis: b.axis, thickness: b.thickness })
    const bands = topK((selected?.bands ?? []).map((b, i) => ({ id: `band-${i}`, ...b, decision: 'ACCEPTED', reason: 'a run of wall-thick ink' })))
    files.set('04-wall-bands.svg', s.render())
    files.set('04-wall-bands.json', json({ frameId: selected?.frameId ?? null, wallPx: selected?.wallPx ?? null, bands: bands.items, omitted: bands.omitted }))
  }

  // 05: dimension lines
  {
    const s = svg('dimension lines')
    const draw = (c: ChainJson): void => {
      const [lo, hi] = [c.ticksPx[0], c.ticksPx[c.ticksPx.length - 1]]
      const at = (a: number, d = 0): [number, number] => (c.axis === 'HORIZONTAL' ? [a, c.baselinePx + d] : [c.baselinePx + d, a])
      s.line(...at(lo), ...at(hi), { stroke: '#888888', width: 1 }, c.id)
      for (const g of c.segments) {
        const colour = g.origin === 'READ' ? COLOURS.PRIMARY : g.origin === 'CHAIN_CORRECTED' ? COLOURS.QUESTIONABLE : g.origin === 'DERIVED' ? COLOURS.ALTERNATIVE : '#dddddd'
        s.line(...at(g.fromPx, 3), ...at(g.toPx, 3), { stroke: colour, width: 2 }, undefined, { origin: g.origin ?? 'UNRESOLVED', value: g.valueCm ?? '' })
      }
    }
    for (const c of frameChains) draw(c)
    const lines = topK(frameChains.map((c) => ({ id: c.id, axis: c.axis, baselinePx: c.baselinePx, ticksPx: c.ticksPx, segments: c.segments.map((g) => ({ fromPx: g.fromPx, toPx: g.toPx, pixelLength: g.pixelLength, valueCm: g.valueCm ?? null, origin: g.origin ?? 'UNRESOLVED' })), note: c.note ?? null })))
    files.set('05-dimension-lines.svg', s.render())
    files.set('05-dimension-lines.json', json({ frameId: selected?.frameId ?? null, legend: { READ: COLOURS.PRIMARY, CHAIN_CORRECTED: COLOURS.QUESTIONABLE, DERIVED: COLOURS.ALTERNATIVE }, chains: lines.items, omitted: lines.omitted, unsolvedLines: (selected?.chains ?? []).filter((d) => !frameChains.some((c) => Math.abs(c.baselinePx - d.baselinePx) < 0.5 && (c.axis === 'HORIZONTAL') === (d.axis === 'H'))).length }))
  }

  // 06: tick candidates (and the timeline's tick stage, over every frame looked at)
  {
    const s = svg('tick candidates')
    const records: Array<Record<string, unknown>> = []
    for (const c of frameChains) {
      const at = (a: number, d: number): [number, number] => (c.axis === 'HORIZONTAL' ? [a, c.baselinePx + d] : [c.baselinePx + d, a])
      s.line(...at(c.ticksPx[0], 0), ...at(c.ticksPx[c.ticksPx.length - 1], 0), { stroke: '#bbbbbb', width: 0.75 })
      for (const m of marksOf(c)) {
        const id = markIdOf(c.id, m.atPx)
        s.line(...at(m.atPx, -6), ...at(m.atPx, 6), { stroke: COLOURS[m.class], width: m.class === 'TICK' ? 1.5 : 2.5 }, id, { class: m.class, reasons: m.reasons.join(' ') })
        records.push({ id, chainId: c.id, atPx: m.atPx, class: m.class, decision: decisionOfMark(m), reasons: m.reasons, supportIds: [c.id], conflictIds: [] })
      }
    }
    const kept = [...records.filter((r) => r.class !== 'TICK'), ...records.filter((r) => r.class === 'TICK')]
    const bounded = topK(kept, PACK_BOUNDS.topK * 2)
    files.set('06-tick-candidates.svg', s.render())
    files.set('06-tick-candidates.json', json({ frameId: selected?.frameId ?? null, classified: !preSchema, note: preSchema ? 'metric evidence before schema 1.3.0: marks were not classified, every crossing mark was a tick' : undefined, legend: { TICK: COLOURS.TICK, QUESTIONABLE: COLOURS.QUESTIONABLE, REJECTED: COLOURS.REJECTED }, counts: { TICK: records.filter((r) => r.class === 'TICK').length, QUESTIONABLE: records.filter((r) => r.class === 'QUESTIONABLE').length, REJECTED: records.filter((r) => r.class === 'REJECTED').length }, marks: bounded.items, omitted: bounded.omitted }))
  }
  for (const frameId of metricFrames) {
    const labelled = new Set(observationsOf(frameId).map((o) => o.chainId))
    const size = sizeOf(frameId)
    for (const c of longestFirst(chainsOf(frameId))) {
      const long = size.width > 1 && c.ticksPx[c.ticksPx.length - 1] - c.ticksPx[0] >= 0.25 * (c.axis === 'HORIZONTAL' ? size.width : size.height)
      if (!labelled.has(c.id) && !long) continue
      for (const m of marksOf(c)) event('DIMENSION_TICK_CLASSIFICATION', markIdOf(c.id, m.atPx), decisionOfMark(m), m.reasons.join(',') || 'a stroke as dark as its line, on both sides', { supportIds: [c.id], reversible: m.class !== 'TICK' })
    }
  }

  // 07: OCR labels — every token's box and reading, and (005E) each label ink's numeric lattice: the 005D reading, the
  // as-read string, the image-only sequences, the glyph candidates, the class, and the value its span was given with
  // the image score and the metric support apart. Numbers only; the glyphs themselves are not reproduced.
  const latticeOf = new Map((metrics.numericLattices ?? []).map((l) => [l.id, l]))
  {
    const s = svg('OCR labels')
    const tokens = (metrics.ocrTokens ?? []).filter((t) => t.frameId === selected?.frameId && /\d/.test(t.text))
    const nearChain = (t: (typeof tokens)[number]): boolean => frameChains.some((c) => (c.axis === 'HORIZONTAL' ? Math.abs((t.box.y0 + t.box.y1) / 2 - c.baselinePx) < 3 * Math.max(8, t.box.y1 - t.box.y0) : Math.abs((t.box.x0 + t.box.x1) / 2 - c.baselinePx) < 3 * Math.max(8, t.box.x1 - t.box.x0)))
    const relevant = [...tokens].sort((a, b) => Number(nearChain(b)) - Number(nearChain(a)) || (a.id < b.id ? -1 : 1))
    const shown = topK(relevant)
    const lattices = (metrics.numericLattices ?? []).filter((l) => l.frameId === selected?.frameId)
    const classColour = (c: string): string => (c === 'CLEAR' ? COLOURS.PRIMARY : c === 'SUPPORTED' ? COLOURS.TICK : c === 'AMBIGUOUS' ? COLOURS.AMBIGUOUS : COLOURS.REJECTED)
    const latticeAt = new Map(lattices.map((l) => [`${l.orientation}|${rectText(l.box)}`, l]))
    for (const t of shown.items) {
      const l = latticeAt.get(`${t.orientation ?? 'HORIZONTAL'}|${rectText(t.box)}`)
      const colour = l ? classColour(l.ocrClass) : t.pageVote === 'DISCARDED' ? COLOURS.ALTERNATIVE : COLOURS.PRIMARY
      s.rect(t.box.x0, t.box.y0, t.box.x1, t.box.y1, { stroke: colour, width: 1 }, t.id, { orientation: t.orientation ?? '', text: t.text, ...(l ? { asRead: l.asRead, class: l.ocrClass } : {}) })
      s.text(t.box.x0, t.box.y0 - 2, l && l.asRead !== t.text ? `${l.asRead} (${t.text})` : t.text, 9, colour)
    }
    files.set('07-ocr-labels.svg', s.render())
    // The span each lattice's ink measures, and the value it was given there.
    const boundObs = (metrics.dimensionObservations ?? []).filter((o) => o.frameId === selected?.frameId && o.ocr && o.binding?.role === 'PRIMARY' && o.independence !== 'ORIENTATION_UNDECIDED')
    const records = topK(
      [...lattices].sort((a, b) => (b.box.x1 - b.box.x0) * (b.box.y1 - b.box.y0) - (a.box.x1 - a.box.x0) * (a.box.y1 - a.box.y0) || (a.id < b.id ? -1 : 1)).map((l) => {
        const o = boundObs.find((x) => x.ocr?.latticeId === l.id)
        const chosen = o?.ocr?.selected
        const reject = (q: LatticeJson['sequences'][number]): string | null => {
          if (q.asRead) return null
          if (chosen && chosen.text === q.text) return null
          if (q.valueCm === undefined) return 'NOT_A_DIMENSION'
          if (o && o.impliedCmPerPx > 0) return 'NOT_SELECTED: the as-read value or a better image score fits the chosen scale, or no scale was chosen'
          return 'NOT_SELECTED: unbound to a span'
        }
        return {
          id: l.id,
          orientation: l.orientation,
          box: l.box,
          rawTopRead: l.rawTopText,
          asRead: l.asRead,
          asReadValueCm: l.asReadValueCm ?? null,
          asReadVariant: l.asReadVariant,
          ocrClass: l.ocrClass,
          classWhy: l.classWhy,
          asReadP: l.asReadP,
          probabilityMargin: l.probabilityMargin,
          sequenceMargin: l.sequenceMargin,
          minGlyphScore: l.minGlyphScore,
          maxRunnerRatio: l.maxRunnerRatio,
          entropy: l.entropy,
          sequences: l.sequences.map((q) => ({ text: q.text, valueCm: q.valueCm ?? null, imageScore: q.imageScore, p: q.p, nonTop: q.nonTop.length, variants: q.variants, segmentation: q.pathIds[0] ?? null, asRead: q.asRead, rejected: reject(q) })),
          glyphs: l.glyphs.map((g) => ({ box: g.box, candidates: g.candidates, runnerRatio: g.runnerRatio, topologyRunnerRatio: g.topologyRunnerRatio, holes: g.holes, touching: g.touching, broken: g.broken })),
          segmentations: l.paths.map((p) => ({ id: p.id, variant: p.variant, kind: p.kind, text: p.text, slope: p.slope, cuts: p.cuts, changedBoundaries: p.changedBoundaries, segScore: p.segScore, ratioToBest: p.ratioToBest })),
          expansions: l.expansions,
          truncatedBy: l.truncatedBy,
          mergedCount: l.mergedCount ?? null,
          emittedMass: l.emittedMass ?? null,
          asReadStability: l.asReadStability ?? null,
          span: o ? { observationId: o.id, chainId: o.chainId, from: o.fromPx, to: o.toPx, spanPx: o.spanPx } : null,
          selected: chosen ? { by: chosen.by, text: chosen.text ?? null, valueCm: chosen.valueCm ?? null, imageScore: chosen.imageScore ?? null, imageRank: chosen.imageRank ?? null, metricSupportResidualPx: chosen.metricResidualPx ?? null } : null,
          refutedBy: o?.ocr?.refutedBy ?? null,
        }
      }),
    )
    files.set(
      '07-ocr-labels.json',
      json({
        frameId: selected?.frameId ?? null,
        note: 'boxes and readings only; the glyphs themselves are not reproduced',
        latticeRecorded: (metrics.numericLattices ?? []).length > 0,
        legend: { CLEAR: classColour('CLEAR'), SUPPORTED: classColour('SUPPORTED'), AMBIGUOUS: classColour('AMBIGUOUS'), LOW_QUALITY: classColour('LOW_QUALITY') },
        tokens: shown.items.map((t) => ({ id: t.id, text: t.text, orientation: t.orientation ?? null, box: t.box, pageVote: t.pageVote ?? null, confidence: t.confidence ?? null, nearChain: nearChain(t), glyphs: (t.glyphs ?? []).map((g) => ({ char: g.char, score: round(g.score), alternatives: (g.alternatives ?? []).slice(0, 3).map((a) => ({ char: a.char, score: round(a.score) })) })) })),
        omitted: shown.omitted,
        lattices: records.items,
        latticesOmitted: records.omitted,
      }),
    )
  }
  // 005E: the candidate set each bound label's ink offered, before any value was read off it — the reader's own
  // values, keyed by ink (text region and pass), never by text. Before metric evidence 1.4.0 the set is 005D's: the
  // text as read and its one-glyph values.
  for (const frameId of metricFrames) {
    const seen = new Set<string>()
    for (const o of [...decided(observationsOf(frameId))].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const primary = o.binding ? o.binding.role === 'PRIMARY' : o.status === 'ACCEPTED'
      const key = `ink:${o.textRegionId}:${o.orientation}`
      if (!primary || seen.has(key)) continue
      seen.add(key)
      const l = o.ocr ? latticeOf.get(o.ocr.latticeId) : undefined
      const asRead = l ? l.asRead : o.rawText
      const others = l ? l.sequences.filter((q) => !q.asRead).map((q) => q.text) : (o.valueAlternatives ?? []).map((a) => a.text)
      const set = [...new Set(others)].sort()
      event('OCR_SEQUENCE_CANDIDATES', key, `CANDIDATES:${asRead}|${set.join(',')}`, l ? `${l.ocrClass} (p ${round(l.asReadP, 3)}); read ${l.rawTopText} by the 005D reader; ${l.sequences.length} image-only values` : `005D reading; ${set.length} one-glyph value(s)`, { supportIds: [o.textRegionId] })
    }
  }
  for (const frameId of metricFrames) {
    const bound = boundSpanOf(decided(observationsOf(frameId)))
    for (const [key, o] of bound) {
      event('OCR_READING', key, `READ:${o.rawText}`, `${o.orientation}${o.ocr ? `; ${o.ocr.ocrClass}, the 005D reader read ${o.ocr.rawTopText}` : ''}${o.valueAlternatives?.length ? `; it may also be ${o.valueAlternatives.map((a) => `${a.text} (${a.ratio})`).join(', ')}` : ''}`, { supportIds: [o.textRegionId] })
      event('LABEL_BINDING', key, `BOUND:${round(o.fromPx, 1)}-${round(o.toPx, 1)}`, o.binding ? `${o.binding.role}; centred ${round(o.binding.offsetShare, 3)} of the span off; runs across ${o.binding.skipped.tick} tick(s), ${o.binding.skipped.questionable} questionable, ${o.binding.skipped.rejected} rejected` : `accepted on this span (${o.status})`, { supportIds: [o.id], confidenceAfter: o.impliedCmPerPx })
    }
  }

  // 08: span hypotheses
  {
    const s = svg('dimension span hypotheses')
    const chainOf = new Map(frameChains.map((c) => [c.id, c]))
    const obs = decided(frameObs)
    const records = obs.map((o) => {
      const role = o.binding?.role ?? (o.status === 'ACCEPTED' ? 'PRIMARY' : 'ALTERNATIVE')
      const decision = o.status === 'ACCEPTED' ? 'ACCEPTED' : role === 'PRIMARY' ? (o.status === 'REJECTED' ? 'REJECTED_BY_SCALE' : 'PRIMARY') : 'REJECTED'
      const reason = role === 'PRIMARY' ? (o.status === 'REJECTED' ? 'its span is the label’s, but the chosen scale contradicts the value as read' : 'the span the label is centred on') : role === 'ALTERNATIVE' ? 'NOT_PRIMARY_BINDING: another span is better centred on the label or ends on fewer questionable marks' : role === 'AMBIGUOUS' ? 'AMBIGUOUS_BINDING: the label ties between spans of different length' : 'UNCENTRED: no span is centred on the label'
      return { id: o.id, labelId: labelIdOf(o), chainId: o.chainId, rawText: o.rawText, orientation: o.orientation, span: [o.fromPx, o.toPx], spanPx: o.spanPx, valueCm: o.valueCm, impliedCmPerPx: o.impliedCmPerPx, role, offsetShare: o.binding?.offsetShare ?? null, skipped: o.binding?.skipped ?? null, independence: o.independence, status: o.status, decision, reason, alternatives: o.valueAlternatives ?? [], supportIds: [o.textRegionId], conflictIds: sol?.conflictingObservationIds.includes(o.id) ? [sol.frameId] : [] }
    })
    for (const r of records) {
      const c = chainOf.get(r.chainId)
      if (!c) continue
      const off = r.role === 'PRIMARY' ? 8 : r.role === 'ALTERNATIVE' ? 13 : 18
      const colour = COLOURS[r.role as keyof typeof COLOURS] ?? COLOURS.ALTERNATIVE
      const [a, b] = r.span as [number, number]
      if (c.axis === 'HORIZONTAL') s.line(a, c.baselinePx + off, b, c.baselinePx + off, { stroke: colour, width: 2, dash: r.role === 'PRIMARY' ? undefined : '4 3' }, r.id, { role: r.role, label: r.rawText, cmPerPx: r.impliedCmPerPx })
      else s.line(c.baselinePx + off, a, c.baselinePx + off, b, { stroke: colour, width: 2, dash: r.role === 'PRIMARY' ? undefined : '4 3' }, r.id, { role: r.role, label: r.rawText, cmPerPx: r.impliedCmPerPx })
    }
    const kept = topK([...records.filter((r) => r.role === 'PRIMARY'), ...records.filter((r) => r.role !== 'PRIMARY')], PACK_BOUNDS.topK * 2)
    files.set('08-dimension-span-hypotheses.svg', s.render())
    files.set('08-dimension-span-hypotheses.json', json({ frameId: selected?.frameId ?? null, bindingRecorded: !preSchema, legend: { PRIMARY: COLOURS.PRIMARY, ALTERNATIVE: COLOURS.ALTERNATIVE, AMBIGUOUS: COLOURS.AMBIGUOUS, UNCENTRED: COLOURS.UNCENTRED }, observations: kept.items, omitted: kept.omitted, undecidedOrientationReadings: frameObs.length - obs.length }))
  }
  for (const frameId of metricFrames) {
    for (const r of (metrics.chainRelations ?? []).filter((x) => x.frameId === frameId && (x.kind === 'TOTAL_OF' || x.kind === 'PARALLEL_COPY_OF' || x.kind === 'CONFLICTS_WITH')).slice(0, PACK_BOUNDS.topK)) {
      event('DIMENSION_HIERARCHY', `${r.kind.toLowerCase()}:${r.fromChainId}>${r.toChainId}${r.span ? `@${JSON.stringify(r.span)}` : ''}`, r.check ?? r.kind, r.sum ? `total ${String((r.sum as Record<string, unknown>).totalCm)} cm against parts ${String((r.sum as Record<string, unknown>).partsCm)} cm` : r.kind, { supportIds: [r.fromChainId, r.toChainId] })
    }
  }

  // 09: scale hypotheses — a chart of analyzer numbers, nothing of the drawing
  {
    const s = new Svg(900, 360, `${run.runId} — scale hypotheses`, PACK_BOUNDS.svgElements)
    const hyps = sol?.hypotheses ?? []
    const values = [...hyps.map((h) => h.cmPerPixel), sol?.legacy.cmPerPixel ?? 0, sol?.cmPerPixelX ?? 0].filter((v) => v > 0)
    if (values.length > 0) {
      const lo = Math.log(Math.min(...values) * 0.8)
      const hi = Math.log(Math.max(...values) * 1.25)
      const x = (v: number): number => 60 + ((Math.log(v) - lo) / Math.max(1e-9, hi - lo)) * 800
      const maxW = Math.max(1e-9, ...hyps.map((h) => h.independentWeight))
      s.line(60, 300, 860, 300, { stroke: '#444444', width: 1 })
      for (const [i, h] of hyps.entries()) {
        const height = 20 + 220 * (h.independentWeight / maxW)
        const chosen = h.id === sol?.selectedHypothesisId
        s.rect(x(h.cmPerPixel) - 6, 300 - height, x(h.cmPerPixel) + 6, 300, { fill: chosen ? COLOURS.PRIMARY : h.plausible ? COLOURS.ALTERNATIVE : COLOURS.REJECTED, opacity: 0.85 }, `scale-${i}`, { cmPerPx: h.cmPerPixel, groups: h.independentGroups })
        s.text(x(h.cmPerPixel), 300 - height - 6, `${round(h.cmPerPixel, 4)} (${h.independentGroups})`, 11, chosen ? COLOURS.PRIMARY : COLOURS.text, 'middle')
      }
      if (sol?.legacy.cmPerPixel) {
        s.line(x(sol.legacy.cmPerPixel), 40, x(sol.legacy.cmPerPixel), 300, { stroke: COLOURS.QUESTIONABLE, width: 2, dash: '5 3' })
        s.text(x(sol.legacy.cmPerPixel), 34, `page vote ${round(sol.legacy.cmPerPixel, 4)}`, 11, COLOURS.QUESTIONABLE, 'middle')
      }
      if (sol?.cmPerPixelX) s.text(60, 330, `final ${round(sol.cmPerPixelX, 4)} cm/px — ${sol.relation} / ${sol.confidence}`, 13, COLOURS.text, 'start', 'bold')
    } else s.text(20, 40, 'no scale hypothesis on this frame', 14)
    files.set('09-scale-hypotheses.svg', s.render())
    files.set('09-scale-hypotheses.json', json({ frameId: selected?.frameId ?? null, relation: sol?.relation ?? null, confidence: sol?.confidence ?? null, final: { x: sol?.cmPerPixelX ?? null, y: sol?.cmPerPixelY ?? null, isotropy: sol?.isotropy ?? null }, legacy: sol?.legacy ?? null, selectedHypothesisId: sol?.selectedHypothesisId ?? null, hypotheses: (sol?.hypotheses ?? []).map((h) => ({ ...h, decision: h.id === sol?.selectedHypothesisId ? 'SELECTED' : h.plausible ? 'NOT_SELECTED' : 'RULED_OUT_BY_WALLS' })), supportingObservationIds: sol?.supportingObservationIds ?? [], conflictingObservationIds: sol?.conflictingObservationIds ?? [], topology: sol?.topology ?? null, why: sol?.why ?? null }))
  }
  for (const frameId of metricFrames) {
    const f = { frameId }
    const fs = solutionOf(f.frameId)
    if (!fs) continue
    for (const h of fs.hypotheses) event('SCALE_HYPOTHESIS', `scale:${f.frameId}:${round(h.cmPerPixel, 3)}`, h.id === fs.selectedHypothesisId ? 'SELECTED' : h.plausible ? 'NOT_SELECTED' : 'RULED_OUT', h.why, { supportIds: h.witnessIds.slice(0, 8), confidenceAfter: h.independentGroups })
    event('METRIC_RELATION', `metric:${f.frameId}`, `${fs.relation}/${fs.confidence}`, fs.why, { supportIds: fs.supportingObservationIds.slice(0, 8), conflictIds: fs.conflictingObservationIds.slice(0, 8), confidenceBefore: fs.legacy.independentGroups, confidenceAfter: fs.confidence })
    const reg = metrics.coordinateRegistrations?.find((r) => r.frameId === f.frameId && r.plane === 'PLAN_XZ')
    if (reg) event('REGISTRATION', `registration:${f.frameId}`, `${round(reg.metresPerPixelX * 100, 4)}x${round(reg.metresPerPixelY * 100, 4)}`, `${reg.anchors?.length ?? 0} anchors`)
  }

  // 10: extent hypotheses
  {
    const s = svg('extent hypotheses')
    if (selected) {
      s.rect(selected.extent.x0, selected.extent.y0, selected.extent.x1, selected.extent.y1, { stroke: COLOURS.extent, width: 2.5 }, 'extent-chosen', { provenance: selected.extentProvenance ? `${selected.extentProvenance.x}/${selected.extentProvenance.y}` : 'legacy' })
      for (const id of selected.extentRefused ?? []) {
        const c = frameChains.find((x) => x.id === id)
        if (!c) continue
        const [lo, hi] = [c.ticksPx[0], c.ticksPx[c.ticksPx.length - 1]]
        if (c.axis === 'HORIZONTAL') s.line(lo, c.baselinePx, hi, c.baselinePx, { stroke: COLOURS.REJECTED, width: 2, dash: '6 3' }, `refused:${id}`)
        else s.line(c.baselinePx, lo, c.baselinePx, hi, { stroke: COLOURS.REJECTED, width: 2, dash: '6 3' }, `refused:${id}`)
      }
    }
    const readings = Object.entries({ ...(run.digest?.challenge ?? {}), ...(run.digest?.resolution ?? {}) }).filter(([k]) => /^reading\d|^chosen$/.test(k)).map(([k, v]) => ({ key: k, summary: String(v) }))
    files.set('10-extent-hypotheses.svg', s.render())
    files.set('10-extent-hypotheses.json', json({ frameId: selected?.frameId ?? null, chosen: selected ? { rect: selected.extent, weak: selected.extentWeak ?? null, provenance: selected.extentProvenance ?? null, refusedChains: selected.extentRefused ?? [] } : null, otherCopies: frames.slice(1).map((p) => ({ frameId: p.frameId, extent: p.extent, provenance: p.extentProvenance ?? null })), resolverReadings: readings }))
  }
  // frame selection: which copy the structural pass (or the resolver) took the building from
  event('FRAME_SELECTION', 'selected-plan', selected ? `SELECTED:${selected.frameId}` : 'NONE', selected ? `${selected.storey ?? '?'} ${selected.annotation ?? '?'} ${selected.sizePx.width}×${selected.sizePx.height} px` : 'no plan was read')
  for (const p of run.digest?.skipped ?? []) event('FRAME_SELECTION', `frame:${p.frameId}`, 'SKIPPED', p.why)
  for (const f of frames) event('EXTENT', `extent:${f.frameId}`, rectText(f.extent), `${f.extentProvenance ? `${f.extentProvenance.x}/${f.extentProvenance.y}` : 'legacy frame'}${f.extentWeak ? ', weak' : ''}${f.extentRefused?.length ? `; refused ${f.extentRefused.join(', ')}` : ''}`, { conflictIds: f.extentRefused ?? [] })

  // 11: envelope candidates
  {
    const s = svg('envelope candidates')
    if (selected) {
      for (const c of selected.cells ?? []) s.rect(c.rect.x0, c.rect.y0, c.rect.x1, c.rect.y1, { fill: c.enclosed ? COLOURS.envelope : '#f2f2f2', opacity: c.enclosed ? 0.25 : 0.6, stroke: '#dddddd', width: 0.5 }, `cell-${c.ix}-${c.iy}`, { cls: c.cls, enclosed: String(c.enclosed) })
      if (selected.envelope) s.rect(selected.envelope.x0, selected.envelope.y0, selected.envelope.x1, selected.envelope.y1, { stroke: COLOURS.envelope, width: 2.5 }, 'envelope-long-band-box')
      for (const r of selected.regions ?? []) s.rect(r.rect.x0, r.rect.y0, r.rect.x1, r.rect.y1, { stroke: r.cls === 'BUILT' ? COLOURS.body : COLOURS.QUESTIONABLE, width: 1.5, dash: '3 2' }, r.id)
    }
    files.set('11-envelope-candidates.svg', s.render())
    files.set('11-envelope-candidates.json', json({ frameId: selected?.frameId ?? null, longBandBox: selected?.envelope ?? null, boundary: selected?.boundary ? { accepted: selected.boundary.accepted, candidates: selected.boundary.candidates ?? [], extensions: selected.boundary.extensions ?? [], policies: selected.boundary.policies ?? null, gaps: selected.boundary.gaps ?? {}, why: selected.boundary.why ?? null } : null, cells: { total: selected?.cells?.length ?? 0, enclosed: selected?.cells?.filter((c) => c.enclosed).length ?? 0 } }))
  }
  for (const f of frames) {
    event('ENVELOPE', `envelope:${f.frameId}`, f.envelope ? `BOX:${rectText(f.envelope)}` : 'NONE', `${f.cells?.filter((c) => c.enclosed).length ?? 0} of ${f.cells?.length ?? 0} cells enclosed`)
    if (f.boundary) event('ENVELOPE', `outline:${f.frameId}`, f.boundary.accepted ? 'ADOPTED' : 'NOT_ADOPTED', f.boundary.why ?? '')
  }

  // 12: openings
  {
    const s = svg('opening observations')
    const openings = (selected?.wideOpenings ?? []).map((w, i) => ({ id: `opening-${i}`, ...w }))
    for (const w of openings) {
      const colour = w.decision === 'OPENING_IN_WALL' ? COLOURS.TICK : w.decision === 'OPEN_SIDE' ? COLOURS.REJECTED : COLOURS.QUESTIONABLE
      if (w.axis === 'X') s.line(w.fromPx, w.linePx, w.toPx, w.linePx, { stroke: colour, width: 3 }, w.id, { decision: w.decision })
      else s.line(w.linePx, w.fromPx, w.linePx, w.toPx, { stroke: colour, width: 3 }, w.id, { decision: w.decision })
    }
    const callouts = (metrics.evidence ?? []).filter((e) => e.frameId === selected?.frameId && e.kind === 'OPENING_CALLOUT' && e.textBox)
    for (const c of topK(callouts).items) if (c.textBox) s.rect(c.textBox.x0, c.textBox.y0, c.textBox.x1, c.textBox.y1, { stroke: COLOURS.AMBIGUOUS, width: 1 }, c.id, { value: c.value })
    files.set('12-opening-observations.svg', s.render())
    files.set('12-opening-observations.json', json({ frameId: selected?.frameId ?? null, wideOpenings: openings, gapClasses: selected?.boundary?.gaps ?? {}, callouts: topK(callouts).items.map((c) => ({ id: c.id, value: c.value, rawText: c.rawText ?? null, box: c.textBox ?? null })) }))
  }

  // 13: bodies
  {
    const s = svg('body candidates')
    const bodies = (selected?.boundary?.bodies ?? []).map((b, i) => ({ id: `body-${i}`, ...b, decision: b.built ? 'BUILT' : 'NOT_BUILT' }))
    for (const b of bodies) {
      s.rect(b.rect.x0, b.rect.y0, b.rect.x1, b.rect.y1, { stroke: b.built ? COLOURS.body : COLOURS.rejectedBody, width: 2, fill: b.built ? COLOURS.body : COLOURS.rejectedBody, opacity: 0.35 }, b.id, { relation: b.relation })
      s.text(b.rect.x0 + 3, b.rect.y0 + 12, `${b.relation} ${round(b.areaM2, 1)} m²`, 10)
    }
    for (const m of selected?.masses ?? []) s.rect(m.rect.x0, m.rect.y0, m.rect.x1, m.rect.y1, { stroke: COLOURS.PRIMARY, width: 2 }, m.id)
    files.set('13-body-candidates.svg', s.render())
    files.set('13-body-candidates.json', json({ frameId: selected?.frameId ?? null, bodies, masses: selected?.masses ?? [], bays: selected?.bays ?? [] }))
  }
  for (const f of frames) {
    for (const [i, b] of (f.boundary?.bodies ?? []).entries()) event('BODIES', `body:${f.frameId}:${i}:${b.relation}`, b.built ? 'BUILT' : 'NOT_BUILT', `${round(b.areaM2, 2)} m², junction wall ${round(b.junctionWallShare, 2)}, side wall ${round(b.sideWallShare, 2)}`)
    event('BODIES', `masses:${f.frameId}`, `${f.masses.length}`, f.masses.map((m) => rectText(m.rect)).join(' | ') || 'none')
  }

  // 14: selected layout
  {
    const s = svg('selected layout')
    if (selected) {
      s.rect(selected.extent.x0, selected.extent.y0, selected.extent.x1, selected.extent.y1, { stroke: COLOURS.extent, width: 1, dash: '4 3' })
      for (const r of selected.regions ?? []) s.rect(r.rect.x0, r.rect.y0, r.rect.x1, r.rect.y1, { fill: r.cls === 'BUILT' ? COLOURS.body : COLOURS.QUESTIONABLE, opacity: 0.3 }, r.id)
      for (const m of selected.masses) s.rect(m.rect.x0, m.rect.y0, m.rect.x1, m.rect.y1, { stroke: COLOURS.PRIMARY, width: 2.5 }, m.id)
    }
    files.set('14-selected-layout.svg', s.render())
    files.set('14-selected-layout.json', json({ frameId: selected?.frameId ?? null, masses: selected?.masses ?? [], regions: selected?.regions ?? [], scale: selected?.scale ?? null }))
  }

  // challenge, resolution, final
  const challenge = run.digest?.challenge ?? run.trace?.entries?.find((e) => e.substage === 'METRIC_CHALLENGE')?.counts
  if (challenge) event('FIRST_SUCCESS_CHALLENGE', 'challenge', String(challenge.outcome ?? 'UNKNOWN'), String(challenge.chosen ?? challenge.trigger ?? ''), { confidenceAfter: String(challenge.publishedFigure ?? '') })
  const resolution = run.digest?.resolution ?? run.trace?.entries?.find((e) => e.substage === 'PLAN_RESOLUTION')?.counts
  if (resolution) event('PLAN_RESOLUTION', 'resolution', String(resolution.outcome ?? 'UNKNOWN'), String(resolution.chosen ?? resolution.reading1 ?? ''), { confidenceAfter: String(resolution.publishedFigure ?? '') })

  // 15: the canonical model
  const lowest = [...(run.model?.levels ?? [])].sort((a, b) => a.index - b.index)[0]
  const ringArea = (poly: Array<{ x: number; z: number }>): number => Math.abs(poly.reduce((a, p, i) => a + p.x * poly[(i + 1) % poly.length].z - poly[(i + 1) % poly.length].x * p.z, 0)) / 2
  const footprint = run.model?.slabs?.filter((s) => s.levelId === lowest?.id).reduce((a, s) => a + ringArea(s.polygon), 0)
  const published = run.pkg.publishedFacts?.find((f) => f.key === 'footprint_area' && f.unit === 'm2')?.value
  files.set(
    '15-canonical-model-summary.json',
    json({
      result: run.summary ? 'COMPLETED' : 'FAILED',
      modelHash: run.summary?.modelHash ?? null,
      sceneSha256: run.summary?.sceneSha256 ?? null,
      levels: (run.model?.levels ?? []).map((l) => ({ id: l.id, index: l.index, elevation: l.elevation ?? null })),
      lowestStoreyFootprintM2: footprint !== undefined ? round(footprint, 2) : null,
      publishedFootprintM2: published ?? null,
      footprintResidualPct: footprint !== undefined && published ? round((footprint / published - 1) * 100, 2) : null,
      walls: run.model?.walls?.length ?? null,
      openings: run.model?.openings?.length ?? null,
      bodies: run.summary?.masses ?? (run.summary?.counts as Record<string, number> | undefined)?.masses ?? null,
      failure: run.failure ? { code: run.failure.code ?? null, reasonCode: run.failure.reasonCode ?? null, message: run.failure.message ?? null } : null,
    }),
  )
  const firstWarning = (run.summary?.warningDetails ?? []).find((w) => w.severity === 'LIMITING' || w.severity === 'BLOCKING')
  event('FINAL', 'result', run.summary ? 'COMPLETED' : `FAILED:${String(run.failure?.reasonCode ?? run.failure?.code ?? 'UNKNOWN')}`, run.summary ? `model ${String(run.summary.modelHash ?? '').slice(0, 16)}; footprint ${footprint !== undefined ? round(footprint, 2) : '?'} m²${published ? ` against ${published}` : ''}${firstWarning ? `; first limiting warning ${firstWarning.code}` : ''}` : String(run.failure?.message ?? ''), { reversible: false })
  if (run.preview) files.set('16-final-model-preview.png', run.preview)

  // 17: the evidence trace — how each frame's ids link from marks to the model
  {
    const trace = frames.map((f) => {
      const obs = decided(observationsOf(f.frameId))
      const fs = solutionOf(f.frameId)
      return {
        frameId: f.frameId,
        chains: topK(
          chainsOf(f.frameId)
            .filter((c) => obs.some((o) => o.chainId === c.id))
            .map((c) => ({ chainId: c.id, marks: marksOf(c).map((m) => markIdOf(c.id, m.atPx)), labels: [...new Set(obs.filter((o) => o.chainId === c.id).map(labelIdOf))], primary: obs.filter((o) => o.chainId === c.id && (o.binding?.role === 'PRIMARY' || (!o.binding && o.status === 'ACCEPTED'))).map((o) => o.id) })),
        ).items,
        selectedHypothesis: fs?.selectedHypothesisId ?? null,
        witnesses: fs?.supportingObservationIds ?? [],
        relation: fs ? `${fs.relation}/${fs.confidence}` : null,
        registration: metrics.coordinateRegistrations?.find((r) => r.frameId === f.frameId && r.plane === 'PLAN_XZ') ? `registration:${f.frameId}` : null,
        extent: `extent:${f.frameId}`,
        envelope: `envelope:${f.frameId}`,
        masses: f.masses.map((m) => m.id),
      }
    })
    files.set('17-evidence-trace.json', json({ runId: run.runId, selectedPlanFrameId: selected?.frameId ?? null, frames: trace, model: run.summary?.modelHash ?? null }))
  }
  files.set('18-decision-timeline.json', json({ runId: run.runId, stages: TIMELINE_STAGES, events }))

  // the coordinator-facing summary
  files.set('evidence-summary.svg', summarySvg(run, selected, sol, frameChains, frameObs, footprint, published, firstWarning?.code ?? null, events))

  // README
  files.set('README.md', readmeOf(run, selected, sol))

  // size bounds: a JSON file over its bound is replaced by its own summary, never silently cut mid-object
  for (const [name, content] of files) {
    if (typeof content !== 'string' || !name.endsWith('.json') || content.length <= PACK_BOUNDS.jsonBytes) continue
    files.set(name, json({ truncated: true, bytes: content.length, bound: PACK_BOUNDS.jsonBytes, note: 'over the size bound; the full record is in the run directory this pack was made from' }))
  }
  for (const [name, content] of files) if (typeof content === 'string' && name.endsWith('.svg') && FORBIDDEN_IN_SVG.some((re) => re.test(content))) throw new Error(`evidence pack: ${name} would embed a raster or an external reference`)

  const manifest = manifestOf(run, files, selected?.frameId ?? null, firstWarning?.code ?? null, events)
  files.set('manifest.json', json(manifest))
  return { files, manifest, timeline: events }
}

function downstreamOf(stage: TimelineStage): TimelineStage[] {
  const i = TIMELINE_STAGES.indexOf(stage)
  return TIMELINE_STAGES.slice(i + 1, i + 3) as TimelineStage[]
}

function manifestOf(run: RunRecord, files: Map<string, string | Uint8Array>, selected: string | null, firstWarning: string | null, events: DecisionEvent[]): PackManifest {
  const bytes = (c: string | Uint8Array): Uint8Array => (typeof c === 'string' ? new TextEncoder().encode(c) : c)
  const listed = [...files.entries()].filter(([n]) => n !== 'manifest.json').sort(([a], [b]) => (a < b ? -1 : 1))
  return {
    schema: EVIDENCE_PACK_SCHEMA,
    evidenceModeVersion: run.provenance.evidenceModeVersion ?? EVIDENCE_PACK_VERSION,
    runId: run.runId,
    gitSha: run.provenance.gitSha ?? null,
    versions: Object.fromEntries(Object.entries(run.provenance.versions).sort(([a], [b]) => (a < b ? -1 : 1))),
    hashes: {
      sourcePackage: run.pkg.contentHash ?? null,
      metricEvidence: run.metrics?.contentHash ?? null,
      model: run.summary?.modelHash ?? null,
      scene: run.summary?.sceneSha256 ?? null,
      sceneContent: run.summary?.sceneContentHash ?? null,
      candidate: run.summary?.candidateHash ?? null,
    },
    result: run.summary ? 'COMPLETED' : 'FAILED',
    failureCode: run.failure ? String(run.failure.reasonCode ?? run.failure.code ?? 'UNKNOWN') : null,
    firstWarning,
    selectedPlanFrameId: selected,
    counts: { events: events.length, files: listed.length },
    files: listed.map(([name, c]) => ({ name, sha256: typeof c === 'string' ? sha256Hex(c) : sha256Bytes(c), bytes: bytes(c).length })),
  }
}

function summarySvg(run: RunRecord, selected: PlanJson | undefined, sol: SolutionJson | undefined, chains: ChainJson[], obs: ObservationJson[], footprint: number | undefined, published: number | undefined, firstWarning: string | null, events: DecisionEvent[]): string {
  const s = new Svg(1000, 640, `${run.runId} — evidence summary`, 400)
  const marks = chains.flatMap(marksOf)
  const bound = decided(obs)
  const primary = bound.filter((o) => o.binding?.role === 'PRIMARY')
  const selectedHyp = sol?.hypotheses.find((h) => h.id === sol.selectedHypothesisId)
  const rejectedMarks = marks.filter((m) => m.class === 'REJECTED')
  const rows: Array<[string, string, string]> = [
    ['WALLS', `${selected?.bands.length ?? 0} bands, wall ${selected?.wallPx ?? '?'} px`, ''],
    ['DIMENSIONS', `${chains.length} chains on the selected frame, ${chains.filter((c) => c.segments.some((g) => g.origin === 'READ')).length} read`, ''],
    ['TICKS', `${marks.filter((m) => m.class === 'TICK').length} tick, ${marks.filter((m) => m.class === 'QUESTIONABLE').length} questionable, ${rejectedMarks.length} rejected`, rejectedMarks.slice(0, 3).map((m) => `${Math.round(m.atPx)} ${m.reasons.slice(0, 2).join('+')}`).join('; ')],
    ['OCR', `${bound.length} readings bound in the decided way up, ${primary.length} primary`, sol?.topology?.valueAmbiguity ? `value ambiguous: ${sol.topology.valueAmbiguity.rawText} ↔ ${sol.topology.valueAmbiguity.alternatives.join('/')}` : ''],
    ['SCALE', sol ? `${sol.relation} / ${sol.confidence}: ${sol.cmPerPixelX ?? '?'} cm/px (page vote ${sol.legacy.cmPerPixel ?? '?'})` : 'no metric solution', selectedHyp ? `winner ${selectedHyp.id}, ${selectedHyp.independentGroups} independent` : ''],
    ['EXTENT', selected ? `${rectText(selected.extent)} ${selected.extentProvenance ? `${selected.extentProvenance.x}/${selected.extentProvenance.y}` : ''}${selected.extentWeak ? ' (weak)' : ''}` : '—', selected?.extentRefused?.length ? `refused ${selected.extentRefused.length}` : ''],
    ['ENVELOPE', selected?.envelope ? `box ${rectText(selected.envelope)}; outline ${selected.boundary?.accepted ? 'adopted' : 'not adopted'}` : 'none', `${selected?.cells?.filter((c) => c.enclosed).length ?? 0} of ${selected?.cells?.length ?? 0} cells enclosed`],
    ['BODIES', `${selected?.masses.length ?? 0} masses; ${(selected?.boundary?.bodies ?? []).filter((b) => b.built).length} bodies built of ${(selected?.boundary?.bodies ?? []).length}`, (selected?.boundary?.bodies ?? []).map((b) => b.relation).slice(0, 4).join(', ')],
    ['FINAL', run.summary ? `COMPLETED ${String(run.summary.modelHash ?? '').slice(0, 12)}; ${footprint !== undefined ? `${Math.round(footprint * 100) / 100} m²` : '?'}${published ? ` vs ${published} (${footprint !== undefined ? `${Math.round((footprint / published - 1) * 10000) / 100}%` : '?'})` : ''}` : `FAILED ${String(run.failure?.reasonCode ?? run.failure?.code ?? '')}`, firstWarning ? `first limiting warning ${firstWarning}` : ''],
  ]
  s.text(20, 34, `${run.runId}`, 20, COLOURS.text, 'start', 'bold')
  s.text(20, 56, `${run.pkg.canonicalUrl ?? ''}`, 11, '#555555')
  rows.forEach(([k, a, b], i) => {
    const y = 96 + i * 58
    s.rect(16, y - 22, 984, y + 26, { fill: i % 2 === 0 ? '#f6f6f6' : '#ffffff' })
    s.text(28, y, k, 15, COLOURS.text, 'start', 'bold')
    s.text(170, y, a, 13, COLOURS.text)
    if (b) s.text(170, y + 18, b, 11, '#666666')
  })
  s.text(20, 630, `${events.length} decisions in 18-decision-timeline.json; evidence pack ${EVIDENCE_PACK_VERSION}`, 10, '#777777')
  return s.render()
}

function readmeOf(run: RunRecord, selected: PlanJson | undefined, sol: SolutionJson | undefined): string {
  return [
    `# Evidence pack — ${run.runId}`,
    '',
    `Source: ${run.pkg.canonicalUrl ?? '(unknown)'}; package ${run.pkg.contentHash ?? '?'}.`,
    `Result: ${run.summary ? `COMPLETED, model ${run.summary.modelHash ?? '?'}` : `FAILED, ${String(run.failure?.reasonCode ?? run.failure?.code ?? '?')}`}.`,
    `Selected plan frame: ${selected?.frameId ?? 'none'}${sol ? ` — metric ${sol.relation} / ${sol.confidence}, ${sol.cmPerPixelX ?? '?'} cm/px` : ''}.`,
    '',
    'Everything here is analyzer-owned: SVG primitives drawn in the frame’s own pixel coordinates (wall bands, dimension',
    'lines, crossing marks, OCR boxes with the text the reader read, spans, extents, envelopes, bodies) and JSON. No',
    'publisher drawing, crop, render or page is in this directory; assets are listed by address, SHA-256, size and pixels.',
    '',
    'Read in this order: `evidence-summary.svg`, then `18-decision-timeline.json` (every decision, stage by stage, on a',
    'stable object id), then the stage files `03`–`14`, each SVG with its JSON sidecar (ids, decisions, reasons,',
    'alternatives, support and conflict ids). `17-evidence-trace.json` links marks to labels to spans to the scale to the',
    'extent, envelope and masses. `manifest.json` names every version, hash and file.',
    '',
    'Colours: tick green, questionable orange, rejected red; primary binding blue, alternative grey (dashed), ambiguous',
    'purple; extent magenta; envelope cyan; built body green, unbuilt body orange.',
    '',
    'To find where two runs part: `npm run -s evidence:diverge -- <pack A> <pack B>`.',
    '',
  ].join('\n')
}

export type { MarkJson }
export const PACK_TEXT_FILES = PACK_FILES
export const markIdFor = markIdOf
export const labelIdFor = labelIdOf
export const isPreSchema = (v: string | undefined): boolean => !v || v < '1.3.0'
export const _test = { topK, boundSpanOf, decided }
export type { Rect }
