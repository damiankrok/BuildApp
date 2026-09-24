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
import { silhouetteTop } from '@buildapp/image-metrology'

export type ResidualKind = 'OPENING_SILL' | 'OPENING_HEAD' | 'ROOF_EDGE' | 'RECESS_PLANE' | 'MEMBER_EDGE' | 'SILHOUETTE_WIDTH'

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
  // Roof edges: the building's top edge at sample columns against the roof
  // plane. The edge is found by the metrology package's silhouette tracer over
  // the registered extent, which is blind to the sky and the trees above it.
  if (b.mainRoof) {
    const roof = b.mainRoof
    for (const { view, raster } of views) {
      const extent = view.registration.extent
      // The tracer takes each column's sky from the first rows of its region,
      // so the region starts well above the registered extent: the sky, not the ridge.
      const skyRows = Math.max(12, Math.round((extent.y1 - extent.y0) * 0.08))
      const regionTop = Math.max(0, extent.y0 - skyRows)
      const top = silhouetteTop(raster, { x0: extent.x0, y0: regionTop, x1: extent.x1, y1: extent.y1 }, { runPx: Math.max(6, Math.round((extent.y1 - extent.y0) * 0.03)) })
      const samples = view.side === 'FRONT' || view.side === 'REAR' ? [0.15, 0.3, 0.5, 0.7, 0.85].map((f) => roof.footprint.x0 + (roof.footprint.x1 - roof.footprint.x0) * f) : [0.2, 0.5, 0.8].map((f) => roof.footprint.z0 + (roof.footprint.z1 - roof.footprint.z0) * f)
      for (const along of samples) {
        const px = Math.round(view.pxOf(along))
        const column = px - extent.x0
        const topRow = column >= 0 && column < top.length ? top[column] : null
        if (topRow === null || topRow === undefined) continue
        const observed = view.yOf(topRow)
        const model = view.side === 'FRONT' || view.side === 'REAR' ? roofTopAt(roof, along) : roof.ridgeY
        out.push({ featureId: roof.featureId, objectId: 'roof-main', frameId: view.registration.frameId, kind: 'ROOF_EDGE', modelM: round6(model), observedM: round6(observed), residualM: round6(model - observed), toleranceM: 0.25, withinTolerance: Math.abs(model - observed) <= 0.25, why: `the traced top edge at ${along.toFixed(2)} m along the ${view.side.toLowerCase()} view` })
      }
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
