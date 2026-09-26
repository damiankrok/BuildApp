/**
 * Source-view verification and semantic repair (§19).
 *
 * The model is projected back into the registered views and compared, edge
 * for edge, with what those views show — never pixel colours against pixel
 * colours. The residuals are per feature and in metres; the repair loop may
 * move only what the sources do not fix (an assumed sill, an assumed head)
 * and only within the source uncertainty, for a bounded number of rounds,
 * and it writes down every operation it applied and every one it refused.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { BuildingV2 } from './building.js'
import type { ElevationFrameV2 } from './frame.js'
import { elevationExtent } from './openings-v2.js'
import { lumaAt } from './scan.js'

export type ResidualKind = 'OPENING_SILL' | 'OPENING_HEAD' | 'ROOF_EDGE' | 'RECESS_PLANE' | 'MEMBER_EDGE' | 'SILHOUETTE_WIDTH' | 'BAND_TOP' | 'BAND_SOFFIT' | 'RETURN_FACE' | 'VERGE_UNDERSIDE'

export type SourceViewResidual = {
  featureId: string
  objectId?: string
  frameId: string
  kind: ResidualKind
  /** Model value and the value the view shows, in metres, and their difference. */
  modelM: number
  observedM: number
  residualM: number
  /** Tolerance the feature is held to: its own source uncertainty. */
  toleranceM: number
  withinTolerance: boolean
  why: string
}

export type RepairOperation = { kind: 'MOVE_WALL' | 'RESIZE_OPENING' | 'MOVE_OPENING' | 'ADJUST_RECESS' | 'ADJUST_ROOF_EDGE' | 'ADJUST_FACADE_MEMBER'; featureId: string; before: Record<string, number>; after: Record<string, number>; why: string }
export type RepairRefusal = { featureId: string; kind: RepairOperation['kind']; why: string }
export type RepairTrace = { iterations: Array<{ index: number; residualsBefore: number; residualsAfter: number; applied: RepairOperation[]; refused: RepairRefusal[] }>; converged: boolean }

export type VerificationInput = { building: BuildingV2; views: Array<{ view: ElevationFrameV2; raster: Raster }>; silhouetteTop?: (view: ElevationFrameV2) => Array<number | null> | undefined }

/** Project the building into each view and measure the residuals. */
export function verifyAgainstViews(input: VerificationInput): SourceViewResidual[] {
  const { building: b, views } = input
  const out: SourceViewResidual[] = []
  const sideOf = (f: 'FRONT' | 'REAR' | 'WEST' | 'EAST'): ElevationFrameV2['side'] => (f === 'WEST' ? 'LEFT' : f === 'EAST' ? 'RIGHT' : f)
  for (const o of b.openings) {
    const level = b.levels.find((l) => l.index === o.storeyIndex)
    if (!level) continue
    for (const { view, raster } of views.filter((v) => v.view.side === sideOf(o.facade))) {
      const ext = elevationExtent(raster, view, o.interval, level.elevation, level.height)
      if (!ext || ext.headY - ext.sillY < 0.5) continue
      const tol = o.uncertaintyM + 0.1
      out.push({ featureId: o.id, objectId: o.id, frameId: view.registration.frameId, kind: 'OPENING_SILL', modelM: o.sillY, observedM: ext.sillY, residualM: round6(o.sillY - ext.sillY), toleranceM: tol, withinTolerance: Math.abs(o.sillY - ext.sillY) <= tol, why: ext.why })
      const modelHead = o.profile === 'RAKED_SINGLE' && o.headFarY !== undefined ? Math.max(o.headY, o.headFarY) : o.headY
      out.push({ featureId: o.id, objectId: o.id, frameId: view.registration.frameId, kind: 'OPENING_HEAD', modelM: modelHead, observedM: ext.headY, residualM: round6(modelHead - ext.headY), toleranceM: tol, withinTolerance: Math.abs(modelHead - ext.headY) <= tol, why: ext.why })
    }
  }
  // Roof edges: at sample columns, the strongest horizontal edge within
  // reach of where the model puts the roof's top surface. A published render
  // has trees and a sky gradient above the building, so the topmost non-sky
  // pixel is the tree line as often as the roof; the roof's edge is the sharp
  // change of tone nearest the model, and how far it lies from the model is
  // the residual. No edge within reach is recorded as such, not as agreement.
  if (b.mainRoof) {
    const roof = b.mainRoof
    for (const { view, raster } of views) {
      const extent = view.registration.extent
      const samples = view.side === 'FRONT' || view.side === 'REAR' ? [0.15, 0.3, 0.5, 0.7, 0.85].map((f) => roof.footprint.x0 + (roof.footprint.x1 - roof.footprint.x0) * f) : [0.2, 0.5, 0.8].map((f) => roof.footprint.z0 + (roof.footprint.z1 - roof.footprint.z0) * f)
      const reachM = 0.6
      for (const along of samples) {
        // A column a chimney stands in shows the chimney's top, not the roof's.
        const chimneyThere = b.chimneys.some((c) => (view.side === 'FRONT' || view.side === 'REAR' ? along >= c.x0 - 0.35 && along <= c.x1 + 0.35 : along >= c.z0 - 0.35 && along <= c.z1 + 0.35))
        if (chimneyThere) continue
        const model = view.side === 'FRONT' || view.side === 'REAR' ? roofTopAt(roof, along) : roof.ridgeY
        const px = Math.round(view.pxOf(along))
        if (px < extent.x0 || px > extent.x1) continue
        const rowModel = view.pyOf(model)
        const reachPx = reachM / view.registration.metresPerPixelV
        const y0 = Math.max(2, Math.round(rowModel - reachPx))
        const y1 = Math.min(raster.height - 3, Math.round(rowModel + reachPx))
        // Contrast per row: mean luma over a 5-column window, two rows above against two rows below.
        const contrastAt = (y: number): number => {
          let above = 0
          let below = 0
          for (let dx = -2; dx <= 2; dx += 1) {
            above += lumaAt(raster, px + dx, y - 2) + lumaAt(raster, px + dx, y - 1)
            below += lumaAt(raster, px + dx, y) + lumaAt(raster, px + dx, y + 1)
          }
          return Math.abs(above - below) / 10
        }
        let bestContrast = 0
        for (let y = y0; y <= y1; y += 1) bestContrast = Math.max(bestContrast, contrastAt(y))
        // The roof's edge is the FIRST strong edge from the sky down, not the
        // strongest: below it lie the ridge cap, the tile courses and the
        // shading of the slope, all of them sharper than the sky's boundary.
        let bestRow = -1
        for (let y = y0; y <= y1; y += 1) {
          if (contrastAt(y) >= Math.max(20, bestContrast * 0.5)) {
            bestRow = y
            break
          }
        }
        if (bestRow < 0 || bestContrast < 18) {
          out.push({ featureId: roof.featureId, objectId: 'roof-main', frameId: view.registration.frameId, kind: 'ROOF_EDGE', modelM: round6(model), observedM: round6(model), residualM: 0, toleranceM: 0.25, withinTolerance: false, why: `no edge of the roof within ${reachM} m of the model at ${along.toFixed(2)} m along the ${view.side.toLowerCase()} view (best contrast ${bestContrast.toFixed(0)}): not observed` })
          continue
        }
        const observed = view.yOf(bestRow)
        out.push({ featureId: roof.featureId, objectId: 'roof-main', frameId: view.registration.frameId, kind: 'ROOF_EDGE', modelM: round6(model), observedM: round6(observed), residualM: round6(model - observed), toleranceM: 0.25, withinTolerance: Math.abs(model - observed) <= 0.25, why: `the strongest horizontal edge (contrast ${bestContrast.toFixed(0)}) within ${reachM} m of the model's roof line at ${along.toFixed(2)} m along the ${view.side.toLowerCase()} view` })
      }
    }
  }
  out.push(...verifyExteriorAssemblies(b, views))
  return out
}

// ---------------------------------------------------------------------------
// The exterior assemblies against the views (§17): the edges a person checks
// when they hold the model against the drawing — the top and the soffit of a
// fascia band, the free face of a return, the underside of a verge board, and
// the building's width. Each is the tone edge NEAREST the model within reach
// (not the strongest: a band's own shading, the tile courses above a verge
// and the glazing behind a return are all sharper than the edge that
// matters), and a model edge with no image edge within reach is recorded as
// not observed rather than as agreement.
// ---------------------------------------------------------------------------

const EDGE_MIN_CONTRAST = 18

/** The horizontal tone edge nearest `modelY` at one column, within `reachM`. */
export function horizontalEdgeNear(raster: Raster, view: ElevationFrameV2, along: number, modelY: number, reachM: number): { y: number; contrast: number } | undefined {
  const px = Math.round(view.pxOf(along))
  if (px < 3 || px > raster.width - 4) return undefined
  const rowModel = view.pyOf(modelY)
  const reachPx = reachM / view.registration.metresPerPixelV
  const y0 = Math.max(3, Math.round(rowModel - reachPx))
  const y1 = Math.min(raster.height - 3, Math.round(rowModel + reachPx))
  const contrastAt = (y: number): number => {
    let above = 0
    let below = 0
    for (let dx = -2; dx <= 2; dx += 1) {
      above += lumaAt(raster, px + dx, y - 2) + lumaAt(raster, px + dx, y - 1)
      below += lumaAt(raster, px + dx, y) + lumaAt(raster, px + dx, y + 1)
    }
    return Math.abs(above - below) / 10
  }
  let best = 0
  for (let y = y0; y <= y1; y += 1) best = Math.max(best, contrastAt(y))
  if (best < EDGE_MIN_CONTRAST) return undefined
  let row = -1
  for (let y = y0; y <= y1; y += 1) if (contrastAt(y) >= Math.max(EDGE_MIN_CONTRAST, best * 0.5) && (row < 0 || Math.abs(y - rowModel) < Math.abs(row - rowModel))) row = y
  return row < 0 ? undefined : { y: view.yOf(row), contrast: contrastAt(row) }
}

/** The vertical tone edge nearest `modelAlong` at one height, within `reachM`. */
export function verticalEdgeNear(raster: Raster, view: ElevationFrameV2, modelAlong: number, y: number, reachM: number): { along: number; contrast: number } | undefined {
  const py = Math.round(view.pyOf(y))
  if (py < 3 || py > raster.height - 4) return undefined
  const colModel = view.pxOf(modelAlong)
  const reachPx = reachM / view.registration.metresPerPixelU
  const x0 = Math.max(3, Math.round(colModel - reachPx))
  const x1 = Math.min(raster.width - 3, Math.round(colModel + reachPx))
  const contrastAt = (x: number): number => {
    let left = 0
    let right = 0
    for (let dy = -2; dy <= 2; dy += 1) {
      left += lumaAt(raster, x - 2, py + dy) + lumaAt(raster, x - 1, py + dy)
      right += lumaAt(raster, x, py + dy) + lumaAt(raster, x + 1, py + dy)
    }
    return Math.abs(left - right) / 10
  }
  let best = 0
  for (let x = x0; x <= x1; x += 1) best = Math.max(best, contrastAt(x))
  if (best < EDGE_MIN_CONTRAST) return undefined
  let col = -1
  for (let x = x0; x <= x1; x += 1) if (contrastAt(x) >= Math.max(EDGE_MIN_CONTRAST, best * 0.5) && (col < 0 || Math.abs(x - colModel) < Math.abs(col - colModel))) col = x
  return col < 0 ? undefined : { along: view.alongOf(col), contrast: contrastAt(col) }
}

function verifyExteriorAssemblies(b: BuildingV2, views: VerificationInput['views']): SourceViewResidual[] {
  const out: SourceViewResidual[] = []
  const facadeOf = (side: ElevationFrameV2['side']): 'FRONT' | 'REAR' | 'WEST' | 'EAST' => (side === 'LEFT' ? 'WEST' : side === 'RIGHT' ? 'EAST' : side)
  const push = (r: Omit<SourceViewResidual, 'residualM' | 'withinTolerance'>): void => {
    out.push({ ...r, modelM: round6(r.modelM), observedM: round6(r.observedM), residualM: round6(r.modelM - r.observedM), withinTolerance: Math.abs(r.modelM - r.observedM) <= r.toleranceM })
  }
  const notObserved = (r: Omit<SourceViewResidual, 'residualM' | 'withinTolerance' | 'observedM'>): void => {
    out.push({ ...r, modelM: round6(r.modelM), observedM: round6(r.modelM), residualM: 0, withinTolerance: false, why: `${r.why}: no image edge within reach — not observed` })
  }
  for (const { view, raster } of views) {
    const facade = facadeOf(view.side)
    const frameId = view.registration.frameId
    // Fascia bands: every balcony slab and portal head on this facade, top and soffit, at three columns.
    const bands: Array<{ id: string; featureId: string; from: number; to: number; top: number; soffit: number }> = [
      ...b.balconies.filter((x) => x.kind === 'BALCONY' && x.side === facade && (facade === 'FRONT' || facade === 'REAR')).map((x) => ({ id: x.id, featureId: x.featureId, from: x.x0, to: x.x1, top: x.topY, soffit: x.topY - x.thicknessM })),
      ...(facade === 'FRONT' ? b.portalHeads.map((p) => ({ id: p.id, featureId: p.featureId, from: p.x0, to: p.x1, top: p.y1, soffit: p.y0 })) : []),
    ]
    for (const band of bands) {
      if (band.to - band.from < 0.6) continue
      for (const f of [0.25, 0.5, 0.75]) {
        const along = band.from + (band.to - band.from) * f
        for (const [kind, modelY] of [['BAND_TOP', band.top], ['BAND_SOFFIT', band.soffit]] as const) {
          const why = `the ${kind === 'BAND_TOP' ? 'top' : 'soffit'} of ${band.id} at ${along.toFixed(2)} m along the ${view.side.toLowerCase()} view`
          const e = horizontalEdgeNear(raster, view, along, modelY, 0.3)
          if (!e) notObserved({ featureId: band.featureId, objectId: band.id, frameId, kind, modelM: modelY, toleranceM: 0.12, why })
          else push({ featureId: band.featureId, objectId: band.id, frameId, kind, modelM: modelY, observedM: e.y, toleranceM: 0.12, why: `${why}: the nearest tone edge (contrast ${e.contrast.toFixed(0)})` })
        }
      }
    }
    // Returns: the free face of each return on this facade, at mid-height of its storey.
    for (const r of b.returns.filter((x) => x.side === facade)) {
      const level = b.levels.find((l) => l.index === r.storeyIndex)
      if (!level) continue
      const bodyFace = Math.abs(r.alongInterval[0] - Math.min(...b.masses.map((m) => (facade === 'FRONT' || facade === 'REAR' ? m.x0 : m.z0)))) < 0.05 ? 0 : 1
      const free = bodyFace === 0 ? r.alongInterval[1] : r.alongInterval[0]
      const y = level.elevation + Math.min(level.height, 2.6) * 0.5
      const why = `the free face of ${r.id} at ${y.toFixed(2)} m on the ${view.side.toLowerCase()} view`
      const e = verticalEdgeNear(raster, view, free, y, 0.25)
      if (!e) notObserved({ featureId: r.featureId, objectId: r.id, frameId, kind: 'RETURN_FACE', modelM: free, toleranceM: 0.08, why })
      else push({ featureId: r.featureId, objectId: r.id, frameId, kind: 'RETURN_FACE', modelM: free, observedM: e.along, toleranceM: 0.08, why: `${why}: the nearest tone edge (contrast ${e.contrast.toFixed(0)})` })
    }
    // Verge boards: the underside at two columns of each rake of this gable.
    if (b.mainRoof && (facade === 'FRONT' || facade === 'REAR')) {
      const roof = b.mainRoof
      for (const v of b.verges.filter((x) => x.side === facade)) {
        // The board's face width runs across the rake; its vertical extent is that over cos(pitch).
        const height = (v.member.widthM ?? 0) / Math.cos((roof.pitchDeg * Math.PI) / 180)
        if (height <= 0) continue
        for (const f of [0.3, 0.7]) {
          for (const half of [0, 1]) {
            const x = half === 0 ? roof.footprint.x0 + (roof.ridgeAt - roof.footprint.x0) * f : roof.ridgeAt + (roof.footprint.x1 - roof.ridgeAt) * (1 - f)
            const modelY = roofTopAt(roof, x) - height
            const why = `the underside of ${v.id} at ${x.toFixed(2)} m along the ${view.side.toLowerCase()} view`
            const e = horizontalEdgeNear(raster, view, x, modelY, 0.3)
            if (!e) notObserved({ featureId: v.featureId, objectId: v.id, frameId, kind: 'VERGE_UNDERSIDE', modelM: modelY, toleranceM: 0.15, why })
            else push({ featureId: v.featureId, objectId: v.id, frameId, kind: 'VERGE_UNDERSIDE', modelM: modelY, observedM: e.y, toleranceM: 0.15, why: `${why}: the nearest tone edge (contrast ${e.contrast.toFixed(0)})` })
          }
        }
      }
    }
    // The building's width on this view: its two outermost walls' outer faces, at 1.2 m.
    const alongX = facade === 'FRONT' || facade === 'REAR'
    const ground = b.masses.filter((m) => m.storeys.includes(0))
    if (ground.length > 0) {
      // The ground storey's outline as the view sees it: its bodies, and the returns that stand out of them to the outer planes.
      const groundReturns = b.returns.filter((r) => r.storeyIndex === 0).flatMap((r) => [r.start, r.end]).map((p) => (alongX ? p.x : p.z))
      const lo = Math.min(...ground.map((m) => (alongX ? m.x0 : m.z0)), ...groundReturns)
      const hi = Math.max(...ground.map((m) => (alongX ? m.x1 : m.z1)), ...groundReturns)
      const y = 1.2
      const eLo = verticalEdgeNear(raster, view, lo, y, 0.3)
      const eHi = verticalEdgeNear(raster, view, hi, y, 0.3)
      const why = `the building's width at ${y} m on the ${view.side.toLowerCase()} view`
      if (!eLo || !eHi) notObserved({ featureId: `silhouette-${view.side.toLowerCase()}`, frameId, kind: 'SILHOUETTE_WIDTH', modelM: hi - lo, toleranceM: 0.15, why })
      else push({ featureId: `silhouette-${view.side.toLowerCase()}`, frameId, kind: 'SILHOUETTE_WIDTH', modelM: hi - lo, observedM: Math.abs(eHi.along - eLo.along), toleranceM: 0.15, why: `${why}: between the outermost tone edges nearest the model's outer faces` })
    }
  }
  return out
}

function roofTopAt(roof: NonNullable<BuildingV2['mainRoof']>, x: number): number {
  const tan = Math.tan((roof.pitchDeg * Math.PI) / 180)
  const half = (roof.footprint.x1 - roof.footprint.x0) / 2
  const fromRidge = Math.abs(x - roof.ridgeAt)
  return roof.ridgeY - Math.min(half, fromRidge) * tan
}

/**
 * Bounded semantic repair: only properties the sources left ASSUMED may move,
 * only towards a view's reading, only within tolerance, and never a hard
 * dimension (a printed width, a chain-registered position).
 */
export function repairFromResiduals(b: BuildingV2, residuals: SourceViewResidual[], maxIterations = 2): RepairTrace {
  const trace: RepairTrace = { iterations: [], converged: false }
  let current = residuals
  for (let i = 0; i < maxIterations; i += 1) {
    const applied: RepairOperation[] = []
    const refused: RepairRefusal[] = []
    for (const r of current.filter((x) => !x.withinTolerance && (x.kind === 'OPENING_SILL' || x.kind === 'OPENING_HEAD'))) {
      const o = b.openings.find((x) => x.id === r.featureId)
      if (!o) continue
      const prov = r.kind === 'OPENING_SILL' ? o.provenance.sill : o.provenance.head
      if (prov === 'SOURCE_EXACT' || prov === 'SOURCE_CORROBORATED') {
        refused.push({ featureId: o.id, kind: 'RESIZE_OPENING', why: `${r.kind.toLowerCase()} is ${prov.toLowerCase().replace(/_/g, ' ')} and a view reading ${r.residualM.toFixed(2)} m away does not overrule it` })
        continue
      }
      if (prov !== 'ASSUMED_FOR_RENDERING' && prov !== 'UNRESOLVED') {
        refused.push({ featureId: o.id, kind: 'RESIZE_OPENING', why: `${r.kind.toLowerCase()} already comes from a view; a second reading is recorded, not applied` })
        continue
      }
      if (Math.abs(r.residualM) > 1.2) {
        refused.push({ featureId: o.id, kind: 'RESIZE_OPENING', why: `a ${r.residualM.toFixed(2)} m disagreement is not a repair, it is a different reading` })
        continue
      }
      const before = { sillY: o.sillY, headY: o.headY }
      if (r.kind === 'OPENING_SILL') {
        o.sillY = round6(Math.max(0, r.observedM))
        o.provenance.sill = 'IMAGE_METRIC_REGISTERED'
      } else {
        o.headY = round6(r.observedM)
        o.provenance.head = 'IMAGE_METRIC_REGISTERED'
        if (o.headFarY !== undefined) o.headFarY = round6(o.headFarY + (o.headY - before.headY))
      }
      o.unresolved = o.unresolved.filter((u) => !u.startsWith('sill') && !u.startsWith('sill and head'))
      applied.push({ kind: 'RESIZE_OPENING', featureId: o.id, before, after: { sillY: o.sillY, headY: o.headY }, why: `the ${r.kind === 'OPENING_SILL' ? 'sill' : 'head'} was assumed; the elevation reads it at ${r.observedM.toFixed(2)} m` })
    }
    const after = current.map((r) => {
      const o = b.openings.find((x) => x.id === r.featureId)
      if (!o || (r.kind !== 'OPENING_SILL' && r.kind !== 'OPENING_HEAD')) return r
      const modelM = r.kind === 'OPENING_SILL' ? o.sillY : o.profile === 'RAKED_SINGLE' && o.headFarY !== undefined ? Math.max(o.headY, o.headFarY) : o.headY
      const residualM = round6(modelM - r.observedM)
      return { ...r, modelM, residualM, withinTolerance: Math.abs(residualM) <= r.toleranceM }
    })
    trace.iterations.push({ index: i, residualsBefore: current.filter((r) => !r.withinTolerance).length, residualsAfter: after.filter((r) => !r.withinTolerance).length, applied, refused })
    current = after
    if (applied.length === 0) {
      trace.converged = true
      break
    }
  }
  return trace
}
