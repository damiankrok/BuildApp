/**
 * baseline.ts — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B). BuildPlan source-cv + boundary evidence on decoded
 * pixels, normalized to the research observation schema. Calls production functions read-only; changes nothing.
 *
 * Configurations (scored separately):
 *   SCV-LINES          prepareFromRaster().allSegments — the generic line layer (axis-aligned runs + Hough on the
 *                      gradient mask, working-resolution box downscale, mapped back to frame pixels)
 *   SCV-WALL           planSheet bands — wall-thick ink runs (adaptive ink mask, two band passes), as axis segments
 *   SCV-SOLID          solidLayer WALL parts (bounds) — the wall-solid layer
 *   SCV-BOUNDARY       readWallLine pieces running ALONG a grid line (boundaryExtension's wall lines)
 *   SCV-BOUNDARY-GAP   the gaps between them, with the production class (DRAWING_BREAK / OPENING / UNKNOWN / TRUE_EXTERIOR)
 *   SCV-OUTLINE        the opening-aware outline (solveOutline, exclusion policy): union of inside cells
 *   SCV-BUILT          the default reading's BUILT cells (decomposePlan with the opening-aware boundary)
 */
import { createHash } from 'node:crypto'
import type { Raster, Mask, Band } from '@buildapp/source-cv'
import { prepareFromRaster } from '@buildapp/source-analyzer'
import { BOUNDARY_EVIDENCE_VERSION, boundaryExtension, decomposePlan, planSheet, solidLayer } from '@buildapp/reconstruction'
import type { BoundaryObservationCandidate } from './observation.js'

export const r3 = (x: number): number => Math.round(x * 1000) / 1000
export const sha256 = (b: Uint8Array | string): string => createHash('sha256').update(b).digest('hex')

type Rect = { x0: number; y0: number; x1: number; y1: number }
// The production option and registration types, taken from the functions themselves.
type DecomposeOptions = NonNullable<Parameters<typeof decomposePlan>[5]>
type Registration = Parameters<typeof decomposePlan>[3]
type Chains = Parameters<typeof decomposePlan>[1]

export type BaselineInput = {
  frameId: string
  raster: Raster
  snapshotSha: string
  /** The boundary layer's inputs; when absent only the pixel layers (lines, bands, solid) are produced. */
  boundary?: { chains: Chains; registration: Registration; extent: Rect; options: DecomposeOptions }
  /** planExtent needs the sheet: called back with it when the caller derives the extent from it. */
  extentFromSheet?: (sheet: { mask: Mask; bands: Band[]; wallPx: number; witness: unknown }) => { chains: Chains; registration: Registration; extent: Rect; options: DecomposeOptions; info: Record<string, unknown> } | null
}

export type BaselineOutput = {
  observations: BoundaryObservationCandidate[]
  wallPx: number
  mask: Mask
  bands: Band[]
  boundary: Record<string, unknown>
  msamPrompt: Record<string, unknown> | null
  timingsMs: Record<string, number>
}

export function baselineObservations(input: BaselineInput): BaselineOutput {
  const { frameId, raster } = input
  const configHash = sha256(`source-cv@${input.snapshotSha}|boundary-evidence@${BOUNDARY_EVIDENCE_VERSION}`)
  const base = { provider: 'SOURCE_CV' as const, sourceFrameId: frameId, configHash }
  const obs: BoundaryObservationCandidate[] = []
  const t1 = performance.now()
  const prepared = prepareFromRaster(raster)
  const linesMs = performance.now() - t1
  prepared.allSegments.forEach((s, i) =>
    obs.push({ ...base, id: `scv-line-${i}`, configId: 'SCV-LINES', kind: 'LINE_SEGMENT', geometry: { type: 'SEGMENT', a: [r3(s.a.x), r3(s.a.y)], b: [r3(s.b.x), r3(s.b.y)] }, confidence: s.length > 0 ? r3(Math.min(1, s.support / s.length)) : null, provenance: { layer: i < prepared.axisSegments.length ? 'axisAlignedSegments(gradientMask)' : 'houghSegments(gradientMask)', support: s.support, workingScale: prepared.scale }, preprocessing: 'production prepareFromRaster: Rec.601 luma, box downscale to MAX_WORKING_EDGE, gradientMask' }),
  )
  const t2 = performance.now()
  const sheet = planSheet({ id: frameId } as unknown as Parameters<typeof planSheet>[0], { raster: () => raster } as unknown as Parameters<typeof planSheet>[1])
  if (!sheet) throw new Error('planSheet failed')
  const { mask, bands, wallPx } = sheet
  const solid = solidLayer(mask, wallPx)
  const sheetMs = performance.now() - t2
  bands.forEach((b, i) => {
    const vertical = b.axis === 'VERTICAL'
    const a: [number, number] = vertical ? [b.axisPx, b.bounds.y0] : [b.bounds.x0, b.axisPx]
    const e: [number, number] = vertical ? [b.axisPx, b.bounds.y1] : [b.bounds.x1, b.axisPx]
    obs.push({ ...base, id: `scv-band-${i}`, configId: 'SCV-WALL', kind: 'WALL_CONTINUATION', geometry: { type: 'SEGMENT', a: [r3(a[0]), r3(a[1])], b: [r3(e[0]), r3(e[1])], thicknessPx: r3(b.thickness) }, confidence: r3(b.fill), provenance: { layer: 'runLengthBands(adaptiveInkMask(inkChannel))', pieces: b.pieces, length: r3(b.length) }, preprocessing: 'production planSheet: ink channel min(R,G,B), adaptiveInkMask, full resolution' })
  })
  solid.parts
    .filter((p) => p.kind === 'WALL')
    .forEach((p) => {
      const { x0, y0, x1, y1 } = p.bounds
      obs.push({ ...base, id: `scv-solid-${p.id}`, configId: 'SCV-SOLID', kind: 'CLOSED_REGION', geometry: { type: 'POLYGON', rings: [[[x0, y0], [x1 + 1, y0], [x1 + 1, y1 + 1], [x0, y1 + 1]]] }, confidence: null, provenance: { layer: 'solidLayer (wall-solid layer, bounds only)', pixels: p.pixels, kind: p.kind }, preprocessing: 'adaptiveInkMask opened by 0.3 wall' })
    })
  const t3 = performance.now()
  const b = input.boundary ?? input.extentFromSheet?.({ mask, bands, wallPx, witness: sheet.witness }) ?? null
  let boundary: Record<string, unknown> = { available: false, why: 'no extent / registration for the boundary layer' }
  let msamPrompt: Record<string, unknown> | null = null
  let layer: { incumbent: ReturnType<typeof decomposePlan>; ext: ReturnType<typeof boundaryExtension>; full: ReturnType<typeof decomposePlan> } | null = null
  if (b) {
    try {
      const incumbent = decomposePlan(mask, b.chains, bands, b.registration, b.extent, { ...b.options, openingAware: false })
      layer = { incumbent, ext: boundaryExtension(mask, bands, b.registration, b.extent, incumbent, b.options, b.chains), full: decomposePlan(mask, b.chains, bands, b.registration, b.extent, b.options) }
    } catch (e) {
      // A production exception on these inputs is a finding, recorded as such; the pixel layers above still stand.
      boundary = { available: false, why: 'the production boundary layer threw on these inputs', error: String((e as Error).stack ?? e).split('\n').slice(0, 3).join(' | ') }
    }
  }
  if (b && layer) {
    const { registration, extent } = b
    const { incumbent, ext, full } = layer
    let pieceN = 0
    let gapN = 0
    for (const line of [...ext.walls.x, ...ext.walls.y]) {
      const seg = (from: number, to: number): { a: [number, number]; b: [number, number] } => (line.axis === 'X' ? { a: [r3(line.px), r3(from)], b: [r3(line.px), r3(to)] } : { a: [r3(from), r3(line.px)], b: [r3(to), r3(line.px)] })
      for (const p of line.pieces) {
        if (!p.along) continue
        obs.push({ ...base, id: `scv-piece-${pieceN++}`, configId: 'SCV-BOUNDARY', kind: 'WALL_CONTINUATION', geometry: { type: 'SEGMENT', ...seg(p.from, p.to), thicknessPx: r3(wallPx) }, confidence: null, provenance: { layer: 'readWallLine piece', lineAxis: line.axis, linePx: r3(line.px), axisPx: r3(p.axisPx), pieceKind: p.kind }, preprocessing: 'adaptiveInkMask + wall-solid layer' })
      }
      for (const g of line.gaps) {
        obs.push({ ...base, id: `scv-gap-${gapN++}`, configId: 'SCV-BOUNDARY-GAP', kind: 'WALL_CONTINUATION', geometry: { type: 'SEGMENT', ...seg(g.fromPx, g.toPx), thicknessPx: r3(wallPx) }, confidence: null, provenance: { layer: 'readWallLine gap', gapId: g.id, cls: g.cls, boundary: g.boundary, signature: g.signature, occupancy: g.occupancy, widthM: r3(g.widthM), jambs: g.jambs, callout: g.callout?.widthCm ?? null }, preprocessing: 'adaptiveInkMask + wall-solid layer' })
      }
    }
    const lx = ext.lines.x
    const ly = ext.lines.y
    const cells: Array<[number, number, number, number]> = []
    for (let iy = 0; iy < ext.outline.ny; iy += 1) for (let ix = 0; ix < ext.outline.nx; ix += 1) if (ext.outline.inside[iy * ext.outline.nx + ix] === 1) cells.push([lx[ix], ly[iy], lx[ix + 1], ly[iy + 1]])
    const ring = ([x0, y0, x1, y1]: [number, number, number, number]): Array<[number, number]> => [[r3(x0), r3(y0)], [r3(x1), r3(y0)], [r3(x1), r3(y1)], [r3(x0), r3(y1)]]
    obs.push({ ...base, id: 'scv-outline', configId: 'SCV-OUTLINE', kind: 'CLOSED_REGION', geometry: { type: 'POLYGON', rings: cells.map(ring) }, confidence: null, provenance: { layer: 'solveOutline (exclusion policy), union of cells', cells: cells.length, accepted: ext.record.accepted }, preprocessing: 'boundary evidence' })
    const built = full.cells.filter((c) => c.classification === 'BUILT')
    obs.push({ ...base, id: 'scv-built', configId: 'SCV-BUILT', kind: 'CLOSED_REGION', geometry: { type: 'POLYGON', rings: built.map((c) => ring([c.rect.x0, c.rect.y0, c.rect.x1, c.rect.y1])) }, confidence: null, provenance: { layer: 'decomposePlan default reading: BUILT cells', cells: built.length }, preprocessing: 'boundary evidence' })
    boundary = {
      available: true,
      wallPx: r3(wallPx),
      extent,
      ...('info' in b ? { extentInfo: (b as { info: unknown }).info } : {}),
      mpp: { x: registration.metresPerPixelX, y: registration.metresPerPixelY },
      gaps: ext.record.gaps,
      drawingBreaks: ext.record.drawingBreaks,
      bridged: ext.record.bridged,
      accepted: ext.record.accepted,
      linesX: ext.lines.x.map(r3),
      linesY: ext.lines.y.map(r3),
      envelope: full.envelope?.rect ?? null,
      bodies: ext.record.bodies.map((x) => ({ relation: x.relation, built: x.built, rect: x.rect, areaM2: x.areaM2 })),
    }
    const enclosedBuilt = incumbent.cells.filter((c) => c.classification === 'BUILT' && c.enclosed)
    msamPrompt = { extent, wallPx: r3(wallPx), builtCells: enclosedBuilt.map((c) => ({ rect: c.rect, areaPx: r3((c.rect.x1 - c.rect.x0) * (c.rect.y1 - c.rect.y0)) })) }
  }
  const boundaryMs = performance.now() - t3
  return { observations: obs, wallPx, mask, bands, boundary, msamPrompt, timingsMs: { sourceCvLines: r3(linesMs), planSheetAndSolid: r3(sheetMs), boundaryLayer: r3(boundaryMs) } }
}
