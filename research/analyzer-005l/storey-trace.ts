/**
 * storey-trace.ts — BUILDPLAN-ANALYZER-005L storey-registration forensics (RESEARCH ONLY; never imported by production).
 *
 *   npx vite-node research/analyzer-005l/storey-trace.ts -- --rows <rows.json> --out <json> [--only A06,A07]
 *
 * For every row, the structural pass the solver runs first (`composeStructuralLayout`, the production entry) is run on
 * the row's sealed package, observation graph and metric evidence, and every decision between an upper plan and the
 * mass it stands on is written out: the plans by role, the base, the alignment targets, every distinct alignment
 * candidate with its parts, the chosen one, the runner-up that puts the storey elsewhere and the margin, the mapped
 * envelope, the upper plan's own BUILT regions mapped into the base, and for every lower mass the intersection with
 * the mapped envelope and with the mapped regions, as shares of the lower mass and of the upper region. Then what the
 * pass did with it: storey spans, footprint regions per storey, unresolved and conflicts, and the gate's reasons.
 *
 * Numbers, ids and rectangles only. No pixel of any source enters the output.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { join, resolve } from 'node:path'
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { alignPlans, alignmentTargets, composeStructuralLayout, levelsFrom, ringArea, ringBounds, ringOfRect } from '@buildapp/reconstruction'
import type { PlanAlignment, PlanReading, StructuralPassOptions } from '@buildapp/reconstruction'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
type Row = { row: string; cache: string; inputs: { package: string; graph: string; metrics: string }; dropFrames?: string[] }
const rows = (JSON.parse(readFileSync(resolve(arg('rows', join(REPO, 'research/analyzer-005l/rows.json'))), 'utf8')) as { rows: Row[] }).rows
const only = arg('only', '')
// --look <dir>: for a developer's eyes, the base plan with the chosen alignment drawn on it (outside the repository only)
const lookDir = arg('look', '')
if (lookDir.startsWith('/home/user/BuildApp')) throw new Error('pictures stay outside the repository')
function lookAt(name: string, raster: Raster, lines: Array<{ axis: 'VERTICAL' | 'HORIZONTAL'; at: number; from: number; to: number; rgb: [number, number, number] }>, rects: Array<{ r: PixelRect; rgb: [number, number, number] }>): void {
  if (!lookDir) return
  mkdirSync(lookDir, { recursive: true })
  const png = new PNG({ width: raster.width, height: raster.height })
  for (let i = 0; i < raster.width * raster.height; i += 1) {
    const a = raster.data[i * 4 + 3] / 255
    for (let k = 0; k < 3; k += 1) png.data[i * 4 + k] = Math.round((raster.data[i * 4 + k] * a + 255 * (1 - a)) * 0.55 + 255 * 0.45)
    png.data[i * 4 + 3] = 255
  }
  const put = (x: number, y: number, rgb: [number, number, number]): void => {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= raster.width || yi >= raster.height) return
    const k = (yi * raster.width + xi) * 4
    png.data[k] = rgb[0]
    png.data[k + 1] = rgb[1]
    png.data[k + 2] = rgb[2]
  }
  for (const l of lines) for (let t = Math.min(l.from, l.to); t <= Math.max(l.from, l.to); t += 1) for (const d of [-1, 0, 1]) (l.axis === 'VERTICAL' ? put(l.at + d, t, l.rgb) : put(t, l.at + d, l.rgb))
  for (const { r, rgb } of rects) {
    for (let x = r.x0; x <= r.x1; x += 1) for (const y of [r.y0, r.y1]) put(x, y, rgb)
    for (let y = r.y0; y <= r.y1; y += 1) for (const x of [r.x0, r.x1]) put(x, y, rgb)
  }
  writeFileSync(join(lookDir, `${name}.png`), PNG.sync.write(png))
}
const p = (x: string): string => (x.startsWith('/') ? x : join(REPO, x))

const area = (r: PixelRect): number => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0)
const inter = (a: { x0: number; z0: number; x1: number; z1: number }, b: { x0: number; z0: number; x1: number; z1: number }): number =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0))
const mapRect = (r: PixelRect, a: PlanAlignment): PixelRect => ({ x0: r.x0 * a.scale + a.offsetX, y0: r.y0 * a.scale + a.offsetY, x1: r.x1 * a.scale + a.offsetX, y1: r.y1 * a.scale + a.offsetY })
const rr = (r: PixelRect): PixelRect => ({ x0: round6(r.x0), y0: round6(r.y0), x1: round6(r.x1), y1: round6(r.y1) })

const out: unknown[] = []
for (const row of rows) {
  if (only && !only.split(',').includes(row.row)) continue
  const pkg = JSON.parse(readFileSync(p(row.inputs.package), 'utf8')) as SourcePackage
  const graph = JSON.parse(readFileSync(p(row.inputs.graph), 'utf8')) as SourceObservationGraph
  const metrics = JSON.parse(readFileSync(p(row.inputs.metrics), 'utf8')) as MetricEvidenceSet
  const cache = fileByteCache(row.cache)
  const rasters = new Map<string, Raster | undefined>()
  for (const a of pkg.assets) {
    for (const v of a.variants) {
      if (rasters.has(v.byteHash)) continue
      const got = await cache.get(v.url)
      try {
        rasters.set(v.byteHash, got ? decodeImage(got.bytes) : undefined)
      } catch {
        rasters.set(v.byteHash, undefined)
      }
    }
  }
  const dropped = new Set(row.dropFrames ?? [])
  const keep = dropped.size > 0 ? (f: { id: string }): boolean => !dropped.has(f.id) : undefined
  const sectionFrame = graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION' && (keep ? keep(f) : true))
  const levels = levelsFrom(metrics, sectionFrame?.id)
  const options: StructuralPassOptions = { slug: row.row, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f) => rasters.get(f.variantByteHash), frameFilter: keep, levels, publishedAreas: pkg.publishedFacts, sheetCache: new Map() }
  const t0 = performance.now()
  const { draft, layout } = composeStructuralLayout(options)
  const ms = Math.round(performance.now() - t0)
  const base = draft.base
  const frame = draft.frame
  const planFrames = graph.coordinateFrames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_PLAN' && f.roles.document === 'FLOOR_PLAN' && (!keep || keep(f)))
  const planRecord = (plan: PlanReading) => {
    const storey = draft.storeys.find((s) => s.frameIds.includes(plan.frame.id))
    const builtRegions = plan.decomposition.regions.filter((r) => r.classification === 'BUILT')
    const rec: Record<string, unknown> = {
      frameId: plan.frame.id,
      declaredStoreyRole: plan.frame.roles.storey,
      readAs: plan.storey,
      storeyIndex: storey?.index ?? null,
      isBase: base?.frame.id === plan.frame.id,
      registrationPresent: plan.registration !== undefined,
      mpp: plan.registration ? { x: plan.registration.metresPerPixelX, y: plan.registration.metresPerPixelY, rmsM: plan.registration.residual.rmsM, provenance: plan.registration.provenance } : null,
      sizePx: plan.frame.size,
      wallPx: plan.wallPx,
      extent: rr(plan.extent),
      extentWeak: plan.extentWeak,
      sourceEnvelope: plan.decomposition.envelope ? { rect: rr(plan.decomposition.envelope.rect), outline: plan.decomposition.envelope.outline !== undefined, outlineCells: plan.decomposition.envelope.outline?.length ?? 0 } : null,
      builtRegions: builtRegions.map((r) => ({ id: r.id, rect: rr(r.rect), metric: r.metric, areaM2Own: round6((r.metric.x1 - r.metric.x0) * (r.metric.z1 - r.metric.z0)), cells: r.cells.length })),
      builtAreaPxShareOfEnvelope: plan.decomposition.envelope ? round6(builtRegions.reduce((a, r) => a + area(r.rect), 0) / Math.max(1, area(plan.decomposition.envelope.rect))) : null,
      recessRegions: plan.decomposition.regions.filter((r) => r.classification === 'RECESS').length,
    }
    if (!base || !frame || rec.isBase) return rec
    const targets = alignmentTargets(base)
    const { best, considered } = alignPlans(base, plan)
    rec.alignmentTargets = targets.map((t) => ({ id: t.id, rect: rr(t.rect) }))
    rec.alignmentCandidates = considered.map((c) => ({ targetId: c.targetId, scale: c.scale, offsetX: c.offsetX, offsetY: c.offsetY, agreement: c.agreement, stated: c.stated, score: c.score, coveragePrior: round6((c.score - c.agreement - (c.stated ? 0.03 : 0)) / 0.15), placedRect: c.placedRect }))
    rec.alignmentCandidateCount = considered.length
    const chosen = draft.alignments.get(plan.frame.id)
    rec.chosen = chosen ? { targetId: chosen.targetId, scale: chosen.scale, offsetX: chosen.offsetX, offsetY: chosen.offsetY, agreement: chosen.agreement, stated: chosen.stated, score: chosen.score, why: chosen.why } : null
    rec.chosenEqualsRecomputedBest = !!best && !!chosen && best.score === chosen.score && best.offsetX === chosen.offsetX && best.offsetY === chosen.offsetY
    if (chosen) {
      const placed = chosen.placedRect
      const iou = (a: PixelRect, b: PixelRect): number => {
        const i = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
        return i / Math.max(1e-9, area(a) + area(b) - i)
      }
      const elsewhere = considered.slice(1).find((c) => iou(c.placedRect, placed) < 0.7)
      const runnerUp = elsewhere ?? considered[1]
      rec.runnerUp = runnerUp ? { targetId: runnerUp.targetId, score: runnerUp.score, agreement: runnerUp.agreement, placedRect: runnerUp.placedRect, elsewhere: elsewhere !== undefined } : null
      rec.margin = runnerUp ? round6(chosen.score - runnerUp.score) : null
      const source = plan.decomposition.envelope?.rect ?? plan.extent
      const mappedEnvelope = mapRect(source, chosen)
      const envRing = ringBounds(ringOfRect(mappedEnvelope, frame))
      rec.mappedSourceEnvelope = { px: rr(mappedEnvelope), m: envRing, areaM2: round6((envRing.x1 - envRing.x0) * (envRing.z1 - envRing.z0)) }
      const mappedRegions = builtRegions.map((r) => {
        const px = mapRect(r.rect, chosen)
        const m = ringBounds(ringOfRect(px, frame))
        return { id: r.id, px: rr(px), m, areaM2: round6((m.x1 - m.x0) * (m.z1 - m.z0)) }
      })
      rec.mappedUpperBuiltRegions = mappedRegions
      const baseRaster = rasters.get(base.frame.variantByteHash)
      if (baseRaster) {
        const longBands = plan.bands.filter((b) => b.length >= plan.wallPx * 2.5)
        lookAt(
          `${row.row}-${plan.storey.toLowerCase()}`,
          baseRaster,
          longBands.map((b) => ({ axis: b.axis, at: b.axisPx * chosen.scale + (b.axis === 'VERTICAL' ? chosen.offsetX : chosen.offsetY), from: (b.axis === 'VERTICAL' ? b.bounds.y0 : b.bounds.x0) * chosen.scale + (b.axis === 'VERTICAL' ? chosen.offsetY : chosen.offsetX), to: (b.axis === 'VERTICAL' ? b.bounds.y1 : b.bounds.x1) * chosen.scale + (b.axis === 'VERTICAL' ? chosen.offsetY : chosen.offsetX), rgb: [220, 0, 0] as [number, number, number] })),
          [...builtRegions.map((r) => ({ r: mapRect(r.rect, chosen), rgb: [0, 160, 0] as [number, number, number] })), { r: mappedEnvelope, rgb: [0, 0, 230] as [number, number, number] }],
        )
      }
      rec.supportByLowerMass = draft.masses.map((mass) => {
        const mb = ringBounds(mass.ring)
        const massArea = ringArea(mass.ring)
        const envI = inter(envRing, mb)
        const regionsI = mappedRegions.map((r) => ({ regionId: r.id, intersectionM2: round6(inter(r.m, mb)), upperSupportedShare: round6(inter(r.m, mb) / Math.max(1e-9, r.areaM2)), lowerCoveredShare: round6(inter(r.m, mb) / Math.max(1e-9, massArea)) }))
        return {
          massId: mass.id,
          role: mass.role,
          ring: mb,
          areaM2: round6(massArea),
          envelopeIntersectionM2: round6(envI),
          envelopeShareOfLower: round6(envI / Math.max(1e-9, massArea)),
          envelopeShareOfUpper: round6(envI / Math.max(1e-9, (envRing.x1 - envRing.x0) * (envRing.z1 - envRing.z0))),
          currentRuleHolds: envI / Math.max(1e-9, massArea) >= 0.5,
          regions: regionsI,
          storeySpan: mass.storeySpan,
          footprintRegionIds: mass.footprintRegionIds,
        }
      })
    }
    return rec
  }
  const gateReasons = layout.gate.reasons.map((r) => `${r.severity}:${r.code}`)
  out.push({
    row: row.row,
    layoutMs: ms,
    planFrames: planFrames.map((f) => ({ id: f.id, storey: f.roles.storey, annotation: f.roles.annotation, sizePx: f.size })),
    skippedPlans: draft.skippedPlans,
    plansRead: draft.plans.length,
    base: base ? { frameId: base.frame.id, storey: base.storey } : null,
    plans: draft.plans.map(planRecord),
    storeyRegistrations: (draft as { storeyRegistrations?: unknown }).storeyRegistrations ?? null,
    storeys: draft.storeys.map((s) => ({ id: s.id, index: s.index, frameIds: s.frameIds, footprintRegionIds: s.footprintRegionIds, registeredFrom: s.registeredFrom ?? null, why: s.why })),
    masses: draft.masses.map((m) => ({ id: m.id, role: m.role, ring: ringBounds(m.ring), areaM2: round6(ringArea(m.ring)), storeySpan: m.storeySpan, footprintRegionIds: m.footprintRegionIds })),
    upperFootprints: draft.footprintRegions.filter((r) => r.kind === 'BUILT' && draft.storeys.find((s) => s.id === r.storeyId)?.index !== draft.storeys.find((s) => base && s.frameIds.includes(base.frame.id))?.index).map((r) => ({ id: r.id, storeyId: r.storeyId, ring: ringBounds(r.ring), areaM2: r.areaM2, why: r.why })),
    storeyUnresolved: draft.unresolved.filter((u) => /storey|coverage|align/.test(u.id)).map((u) => ({ id: u.id, what: u.what, reason: u.reason, status: u.status })),
    storeyConflicts: [...draft.conflicts, ...layout.conflicts].filter((c) => c.kind === 'STOREY_COVERAGE_DISAGREES').map((c) => ({ id: c.id, what: c.what, magnitude: c.magnitude ?? null })),
    storeyAlternatives: draft.alternatives.filter((a) => a.id.includes('storey')).map((a) => ({ id: a.id, chosenId: a.chosenId, margin: a.margin, members: a.members.map((m) => ({ id: m.id, score: m.score })) })),
    gate: { status: layout.gate.status, reasons: gateReasons },
  })
  process.stdout.write(`${row.row}: ${draft.plans.length} plans, ${draft.masses.length} masses, spans ${draft.masses.map((m) => `${m.id}:${m.storeySpan.fromIndex}..${m.storeySpan.toIndex}`).join(' ')}, gate ${layout.gate.status} (${ms} ms)\n`)
}
writeFileSync(resolve(arg('out', '/home/user/work005l/baseline-storey-registration.json')), `${JSON.stringify({ stage: 'BUILDPLAN-ANALYZER-005L', kind: 'storey-registration forensics: the structural pass on sealed evidence (research harness)', rows: out }, null, 1)}\n`)
