/**
 * Characteristic facade assemblies (§15, §5.7): returns, verge members, the
 * fascia bands of balconies and portal heads, balcony slabs and railings, read
 * on the registered renders and stated as ASSEMBLIES of members with the
 * continuity relations between them.
 *
 * A member is built only with depth evidence: a return wall the plan draws,
 * a verge band that runs along the rake beyond the recessed wall behind it
 * (the recess is its depth), a fascia band at a balcony slab's level spanning
 * the recess mouth. A tone band with none of that — cladding, a shadow, a
 * colour change — is a SURFACE region and never a volume, and §15's stripe
 * test holds the reader to that.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { ElevationFrameV2 } from './frame.js'
import type { RecessTopology } from './recesses.js'
import { dominantTone, lumaAt, toneClass, rgbAt } from './scan.js'
import type { ToneClass } from './scan.js'

export type FacadeMemberKind = 'RETURN_WALL' | 'VERGE_MEMBER' | 'FASCIA_BAND' | 'PARAPET' | 'BALCONY_SLAB' | 'RAILING'
export type FacadeMember = {
  id: string
  kind: FacadeMemberKind
  facade: 'FRONT' | 'REAR' | 'WEST' | 'EAST'
  /** The outer plane it stands in. */
  planeAt: number
  /** Along the facade and up: its extent. A raking member has two ends. */
  along: [number, number]
  y: [number, number]
  /** For a raking member: the y at each end of `along`. */
  yAtEnds?: [number, number]
  /** How far it stands proud of the wall behind it (the recess depth for a return, the fascia's depth is unresolved). */
  depthM?: number
  /** Face width perpendicular to its run. */
  widthM?: number
  frameIds: string[]
  evidence: 'PLAN_INK' | 'RENDER_BAND' | 'PLAN_AND_RENDER'
  continuity: string[]
  confidence: number
  why: string
}

export type FacadeAssemblyHypothesis = {
  id: string
  facadeId: string
  kind: 'PORTAL_FRAME' | 'GABLE_FRAME' | 'BALCONY_FRAME' | 'FASCIA' | 'CUSTOM_FRAME'
  memberHypothesisIds: string[]
  planeOffsets: Record<string, number>
  evidenceIds: string[]
  continuityRelations: Array<{ from: string; to: string; kind: 'CONTINUES_AS' | 'TERMINATES_AT' | 'SUPPORTS' }>
  confidence: number
  why: string
}

export type SurfaceBand = { id: string; facade: FacadeMember['facade']; along: [number, number]; y: [number, number]; tone: ToneClass; why: string }

/** A horizontal band of one tone across a column range: the rows where the tone runs unbroken. */
function toneBandsAlongColumn(raster: Raster, px: number, yTopPx: number, yBottomPx: number): Array<{ from: number; to: number; tone: ToneClass }> {
  const out: Array<{ from: number; to: number; tone: ToneClass }> = []
  let current: ToneClass | undefined
  let start = yTopPx
  for (let y = yTopPx; y <= yBottomPx; y += 1) {
    const t = toneClass(rgbAt(raster, px, y))
    if (t !== current) {
      if (current !== undefined) out.push({ from: start, to: y - 1, tone: current })
      current = t
      start = y
    }
  }
  if (current !== undefined) out.push({ from: start, to: yBottomPx, tone: current })
  return out
}

/**
 * The verge member along a gable rake: the band of wall-coloured tone that
 * runs just under the roof edge, between the silhouette's top and the
 * recessed wall behind it, measured at several columns across the gable.
 */
export function readVergeMember(raster: Raster, view: ElevationFrameV2, gable: { along0: number; along1: number; ridgeAlong: number; eaveY: number; ridgeY: number }, recess: RecessTopology | undefined, wallTone: ToneClass = 'LIGHT'): FacadeMember | undefined {
  const samples: Array<{ along: number; top: number; bottom: number }> = []
  const tan = (gable.ridgeY - gable.eaveY) / Math.max(1e-6, Math.abs(gable.ridgeAlong - gable.along0))
  for (const f of [0.2, 0.3, 0.4, 0.6, 0.7, 0.8]) {
    const along = gable.along0 + (gable.along1 - gable.along0) * f
    const roofY = gable.eaveY + (Math.abs(gable.ridgeAlong - gable.along0) - Math.abs(along - gable.ridgeAlong)) * tan
    const px = Math.round(view.pxOf(along))
    const yTop = Math.round(view.pyOf(roofY + 0.3))
    const yBottom = Math.round(view.pyOf(Math.max(gable.eaveY - 1.5, roofY - 2.0)))
    const bands = toneBandsAlongColumn(raster, px, Math.min(yTop, yBottom), Math.max(yTop, yBottom))
    // The first wall-tone band below the roof line (skipping thin dark edge lines).
    const roofRow = view.pyOf(roofY)
    const band = bands.find((b) => b.tone === wallTone && b.from >= roofRow - 6 && b.to - b.from + 1 >= 3)
    if (!band) continue
    samples.push({ along, top: view.yOf(band.from), bottom: view.yOf(band.to + 1) })
  }
  if (samples.length < 3) return undefined
  const heights = samples.map((s) => s.top - s.bottom).sort((a, b) => a - b)
  const verticalM = heights[Math.floor(heights.length / 2)]
  if (verticalM < 0.25 || verticalM > 1.5) return undefined
  const spread = heights[heights.length - 1] - heights[0]
  const pitch = Math.atan(tan)
  const perpendicular = verticalM * Math.cos(pitch)
  return {
    id: `verge-${view.side.toLowerCase()}`,
    kind: 'VERGE_MEMBER',
    facade: view.side === 'LEFT' ? 'WEST' : view.side === 'RIGHT' ? 'EAST' : view.side,
    planeAt: view.planeAt,
    along: [round6(gable.along0), round6(gable.along1)],
    y: [round6(gable.eaveY), round6(gable.ridgeY)],
    yAtEnds: [round6(gable.eaveY), round6(gable.eaveY)],
    depthM: recess?.depthM,
    widthM: round6(perpendicular),
    frameIds: [view.registration.frameId],
    evidence: recess ? 'PLAN_AND_RENDER' : 'RENDER_BAND',
    continuity: [],
    confidence: round6(Math.min(0.85, 0.5 + (recess ? 0.2 : 0) + (spread < 0.25 ? 0.15 : 0))),
    why: `a ${verticalM.toFixed(2)} m tall band of ${wallTone.toLowerCase()} tone runs under the roof edge on ${samples.length} columns across the gable (spread ${spread.toFixed(2)} m)${recess ? `, standing in the outer plane ${recess.depthM.toFixed(2)} m in front of the recessed wall` : ''}`,
  }
}

/**
 * A horizontal band at a slab level across a recess mouth: a balcony fascia
 * or a portal head. Measured as the rows of one tone across the mouth's
 * columns, near the expected slab level.
 */
export function readFasciaBand(raster: Raster, view: ElevationFrameV2, mouth: { along0: number; along1: number }, nearY: number, planeAt: number, onDebug?: (s: string) => void): FacadeMember | undefined {
  const cols: number[] = []
  for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) cols.push(Math.round(view.pxOf(mouth.along0 + (mouth.along1 - mouth.along0) * f)))
  const yTop = Math.round(view.pyOf(nearY + 0.9))
  const yBottom = Math.round(view.pyOf(nearY - 1.2))
  const reads: Array<{ top: number; bottom: number; tone: ToneClass }> = []
  for (const px of cols) {
    const bands = toneBandsAlongColumn(raster, px, Math.min(yTop, yBottom), Math.max(yTop, yBottom))
    // The DARK or MID band whose top is nearest the slab level.
    const cand = bands
      .filter((b) => (b.tone === 'DARK' || b.tone === 'MID') && b.to - b.from + 1 >= 0.25 / view.registration.metresPerPixelV && Math.abs(view.yOf(b.from) - nearY) <= 0.4)
      .sort((a, b) => Math.abs(view.yOf(a.from) - nearY) - Math.abs(view.yOf(b.from) - nearY))[0]
    onDebug?.(`fascia col ${px}: ${bands.map((b) => `${b.tone}${view.yOf(b.from).toFixed(2)}..${view.yOf(b.to + 1).toFixed(2)}`).join(' ')} -> ${cand ? `${view.yOf(cand.from).toFixed(2)}..${view.yOf(cand.to + 1).toFixed(2)}` : 'none'}`)
    if (!cand) continue
    reads.push({ top: view.yOf(cand.from), bottom: view.yOf(cand.to + 1), tone: cand.tone })
  }
  if (reads.length < 4) return undefined
  const tops = reads.map((r) => r.top).sort((a, b) => a - b)
  const bottoms = reads.map((r) => r.bottom).sort((a, b) => a - b)
  const top = tops[Math.floor(tops.length / 2)]
  const bottom = bottoms[Math.floor(bottoms.length / 2)]
  if (top - bottom < 0.25 || top - bottom > 1.2) return undefined
  const spread = Math.max(tops[tops.length - 1] - tops[0], bottoms[bottoms.length - 1] - bottoms[0])
  if (spread > 0.35) return undefined
  return {
    id: `fascia-${view.side.toLowerCase()}-${Math.round(mouth.along0 * 100)}`,
    kind: 'FASCIA_BAND',
    facade: view.side === 'LEFT' ? 'WEST' : view.side === 'RIGHT' ? 'EAST' : view.side,
    planeAt,
    along: [round6(mouth.along0), round6(mouth.along1)],
    y: [round6(bottom), round6(top)],
    frameIds: [view.registration.frameId],
    evidence: 'RENDER_BAND',
    continuity: [],
    confidence: round6(Math.min(0.8, 0.45 + reads.length * 0.05)),
    why: `a ${(top - bottom).toFixed(2)} m band of dark tone at ${bottom.toFixed(2)}..${top.toFixed(2)} across ${reads.length} columns of the recess mouth (spread ${spread.toFixed(2)} m)`,
  }
}

/** A glass balustrade above a slab: a COOL/LIGHT band standing on the fascia's top across most of the mouth. */
export function readRailing(raster: Raster, view: ElevationFrameV2, mouth: { along0: number; along1: number }, slabTopY: number, planeAt: number, onDebug?: (s: string) => void): FacadeMember | undefined {
  const cols: number[] = []
  for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) cols.push(Math.round(view.pxOf(mouth.along0 + (mouth.along1 - mouth.along0) * f)))
  const tops: number[] = []
  const mppV = view.registration.metresPerPixelV
  for (const px of cols) {
    // From the slab level upward through the glass: the first thin darker
    // line after at least half a metre of panel is the handrail or the
    // frame's top edge. What stands above it (a wall, more glass) does not
    // matter; the line does.
    const base = Math.round(view.pyOf(slabTopY + 0.12))
    const limit = Math.round(view.pyOf(slabTopY + 1.6))
    let found: number | undefined
    let panel = 0
    for (let y = base; y > limit; y -= 1) {
      const l = lumaAt(raster, px, y)
      const above = lumaAt(raster, px, y - 3)
      const below = lumaAt(raster, px, y + 3)
      const line = l < Math.min(above, below) - 25 && l < 200
      if (line && panel * mppV >= 0.5) {
        found = y
        break
      }
      panel += 1
    }
    onDebug?.(`railing col ${px}: ${found === undefined ? 'no rail line' : `rail line at ${view.yOf(found).toFixed(2)}`}`)
    if (found !== undefined) tops.push(view.yOf(found))
  }
  if (tops.length < 3) return undefined
  tops.sort((a, b) => a - b)
  const top = tops[Math.floor(tops.length / 2)]
  const height = top - slabTopY
  if (height < 0.5 || height > 1.4) return undefined
  return {
    id: `railing-${view.side.toLowerCase()}-${Math.round(mouth.along0 * 100)}`,
    kind: 'RAILING',
    facade: view.side === 'LEFT' ? 'WEST' : view.side === 'RIGHT' ? 'EAST' : view.side,
    planeAt,
    along: [round6(mouth.along0), round6(mouth.along1)],
    y: [round6(slabTopY), round6(top)],
    frameIds: [view.registration.frameId],
    evidence: 'RENDER_BAND',
    continuity: [],
    confidence: 0.6,
    why: `a ${height.toFixed(2)} m tall light band stands on the slab across ${tops.length} columns of the recess mouth`,
  }
}

/**
 * §15's stripe test: a band is a VOLUME only with depth evidence. Given a set
 * of horizontal tone bands on a facade (as a cladding field would produce),
 * returns those that qualify as members — which, with no plan return, no
 * recess and no slab level behind them, is none.
 */
export function stripesToMembers(stripes: ReadonlyArray<{ y: [number, number]; along: [number, number] }>, depthEvidence: ReadonlyArray<{ y: [number, number]; kind: 'RECESS' | 'SLAB_LEVEL' | 'PLAN_RETURN' }>): number[] {
  const out: number[] = []
  stripes.forEach((s, i) => {
    const backed = depthEvidence.some((d) => Math.max(d.y[0], s.y[0]) <= Math.min(d.y[1], s.y[1]) + 0.05)
    if (backed) out.push(i)
  })
  return out
}

/** The tone of a facade region, for a material record (never geometry). */
export function facadeTone(raster: Raster, view: ElevationFrameV2, along: [number, number], y: [number, number]): { tone: ToneClass; share: number } {
  const x0 = view.pxOf(along[0])
  const x1 = view.pxOf(along[1])
  const y0 = view.pyOf(y[1])
  const y1 = view.pyOf(y[0])
  return dominantTone(raster, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), 2)
}
