/**
 * A roof per mass, at the pitch the sources state.
 *
 * The reconstruction this replaces took one roof over the building's overall
 * bounds and fitted its pitch to a silhouette. Both halves of that are wrong.
 * A house with a garage attached has two roofs, at two heights, of two kinds;
 * and a pitch that is printed in a specification or implied by a section's
 * level datums is a STATEMENT, which a silhouette fit does not get to
 * overrule. §8 fixes the order of authority and this module obeys it:
 *
 *   1. a printed angle — in a specification, on a section, on a drawing;
 *   2. geometry corroborated across technical views;
 *   3. a perspective's appearance;
 *   4. a building convention, said out loud as one.
 *
 * The most useful thing here is the RIDGE AXIS, and it is not a convention at
 * all. A section's ladder of level datums gives the eaves and the ridge, and
 * their difference is the rise. A gable's rise is half its span times the
 * tangent of its pitch — so of a mass's two axes, only one of them reproduces
 * the measured rise at the stated pitch, and that is the one the ridge runs
 * along. Where the two axes are close enough that both fit, the module says so
 * rather than choosing.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { MetricEvidence, MetricEvidenceSet, SpecificationFinding } from '@buildapp/source-metrics'
import { ringArea, ringBounds } from './structural-layout.js'
import type { LayoutConflict, LayoutGap, LayoutQuantity, MassHypothesis, RoofKind, RoofSupportHypothesis } from './structural-layout.js'

export const ROOF_INFERENCE_NAME = 'roof-systems'
export const ROOF_INFERENCE_VERSION = '1.0.0'

/** Level facts the section states: where the floors are, where the walls stop, and where the highest point is. */
export type RoofLevels = {
  floors: readonly number[]
  heights: readonly number[]
  eaves?: number
  topDatum?: number
  evidenceIds: readonly string[]
  measured: boolean
}

export type RoofInferenceOptions = {
  masses: readonly MassHypothesis[]
  metrics: MetricEvidenceSet
  levels: RoofLevels
  /** Storey elevations by index, so a mass's own top can be worked out. */
  storeyTop: (index: number) => number | undefined
  /** How far the measured rise may be from the predicted one and still count as the same roof, in metres. */
  riseTolerance?: number
}

export type RoofInference = {
  roofs: RoofSupportHypothesis[]
  conflicts: LayoutConflict[]
  unresolved: LayoutGap[]
}

const ROOF_KINDS: Record<string, RoofKind> = { GABLE: 'GABLE', HIP: 'HIP', FLAT: 'FLAT', MONOPITCH: 'MONOPITCH', MULTI_PITCH: 'HIP', MANSARD: 'GABLE' }

const quantity = (value: number, low: number, high: number, unit: LayoutQuantity['unit'], basis: LayoutQuantity['basis'], evidenceIds: string[], why: string): LayoutQuantity => ({
  value: round6(value),
  low: round6(low),
  high: round6(high),
  unit,
  basis,
  evidenceIds,
  why,
})

/**
 * The pitch the sources state, and how loudly.
 *
 * An angle printed beside a roof on a section is the same number as an angle
 * printed in a specification, and both of them beat an angle measured off a
 * raster by several degrees. A number that is neither is not returned at all:
 * a roof with no stated pitch is a roof with no stated pitch.
 */
export function statedPitch(metrics: MetricEvidenceSet): { evidence: MetricEvidence; authority: RoofSupportHypothesis['authority'] } | undefined {
  const angles = metrics.evidence.filter((e) => e.kind === 'ANGLE' && e.value >= 5 && e.value <= 70)
  const ranked = angles
    .map((evidence) => ({
      evidence,
      authority:
        evidence.association.kind === 'PUBLISHED_SPECIFICATION'
          ? ('PUBLISHED_SPECIFICATION' as const)
          : evidence.association.kind === 'ANGLE_MARKER'
            ? ('PRINTED_ANGLE' as const)
            : ('NONE' as const),
    }))
    .filter((a) => a.authority !== 'NONE')
    .sort((a, b) => rankOfAuthority(b.authority) - rankOfAuthority(a.authority) || b.evidence.confidence - a.evidence.confidence || a.evidence.id.localeCompare(b.evidence.id))
  return ranked[0]
}

const AUTHORITY_RANK: Record<RoofSupportHypothesis['authority'], number> = {
  PUBLISHED_SPECIFICATION: 5,
  PRINTED_ANGLE: 4,
  SECTION: 3,
  ELEVATION_GEOMETRY: 2,
  PERSPECTIVE: 1,
  CONVENTION: 0,
  NONE: -1,
}
const rankOfAuthority = (a: RoofSupportHypothesis['authority']): number => AUTHORITY_RANK[a]

/** The roof kind the publisher's own words state, when they state one. */
export function statedKind(findings: readonly SpecificationFinding[]): { kind: RoofKind; finding: SpecificationFinding } | undefined {
  const found = findings.filter((f) => f.subject === 'ROOF_KIND').sort((a, b) => b.confidence - a.confidence || a.key.localeCompare(b.key))[0]
  if (!found) return undefined
  const kind = ROOF_KINDS[found.value]
  return kind ? { kind, finding: found } : undefined
}

/**
 * Which way the ridge runs, from the height the section measured.
 *
 * Not a convention. A gable of span `s` at pitch `p` rises `s/2 * tan(p)` above
 * its eaves, and a section states the eaves and the ridge, so the rise is
 * known. Of a rectangular mass's two spans only one of them produces that rise
 * — for a 9 by 15 body at 35 degrees the two candidates are 3.15 m and 5.25 m,
 * two metres apart, which no measurement error covers — and that is the span
 * the slopes fall across, so the ridge runs along the other axis.
 */
export function ridgeAxisFromRise(
  widthM: number,
  depthM: number,
  pitchDeg: number,
  riseM: number,
  tolerance: number,
): { axis: 'X' | 'Z'; predicted: number; residual: number; ambiguous: boolean } | undefined {
  const tan = Math.tan((pitchDeg * Math.PI) / 180)
  if (!Number.isFinite(tan) || tan <= 0) return undefined
  // A ridge along X means the slopes fall across the DEPTH, and the other way round.
  const candidates = [
    { axis: 'X' as const, span: depthM },
    { axis: 'Z' as const, span: widthM },
  ].map((c) => ({ ...c, predicted: (c.span / 2) * tan }))
  const scored = candidates.map((c) => ({ ...c, residual: Math.abs(c.predicted - riseM) })).sort((a, b) => a.residual - b.residual)
  const best = scored[0]
  if (best.residual > tolerance) return undefined
  return { axis: best.axis, predicted: round6(best.predicted), residual: round6(best.residual), ambiguous: scored.length > 1 && scored[1].residual <= tolerance }
}

/**
 * A roof system for every mass.
 *
 * The mass that reaches highest gets the roof the sources describe. The rest
 * get one of their own, because a body that stops two storeys below the main
 * ridge is not under the main roof — and where nothing says what shape it is,
 * the convention used is said out loud rather than passed off as a reading.
 */
export function inferRoofSystems(options: RoofInferenceOptions): RoofInference {
  const { masses, metrics, levels } = options
  const tolerance = options.riseTolerance ?? 0.45
  const roofs: RoofSupportHypothesis[] = []
  const conflicts: LayoutConflict[] = []
  const unresolved: LayoutGap[] = []
  if (masses.length === 0) return { roofs, conflicts, unresolved }

  const pitch = statedPitch(metrics)
  const kind = statedKind(metrics.specificationFindings)
  const eavesFinding = metrics.specificationFindings.find((f) => f.subject === 'ROOF_EAVES')
  const tallest = [...masses].sort((a, b) => b.storeySpan.toIndex - a.storeySpan.toIndex || ringArea(b.ring) - ringArea(a.ring) || a.id.localeCompare(b.id))[0]

  for (const mass of masses) {
    const bounds = ringBounds(mass.ring)
    const widthM = bounds.x1 - bounds.x0
    const depthM = bounds.z1 - bounds.z0
    const isMain = mass.id === tallest.id
    const top = options.storeyTop(mass.storeySpan.toIndex)
    const id = `roof-${mass.id}`

    if (!isMain) {
      // A lower attached body carries its own roof. Nothing in the sources
      // describes it, so the convention is stated as a convention: level, at
      // the top of its own walls, and marked as the assumption it is.
      roofs.push({
        id,
        massId: mass.id,
        kind: 'FLAT',
        ring: mass.ring,
        eaveLevelM: top === undefined ? undefined : quantity(top, top - 0.2, top + 0.2, 'm', 'DERIVED', [...levels.evidenceIds], 'the top of this body’s own walls, from the section’s level datums'),
        ridgeLevelM: top === undefined ? undefined : quantity(top, top - 0.2, top + 0.2, 'm', 'ASSUMED', [], 'a level roof has no ridge above its eaves'),
        overhangM: quantity(0, 0, 0.3, 'm', 'ASSUMED', [], 'nothing states an eaves projection for this body'),
        adjacentRoofIds: masses.filter((m) => m.id !== mass.id).map((m) => `roof-${m.id}`),
        authority: 'CONVENTION',
        observationIds: [],
        evidenceIds: [...levels.evidenceIds],
        confidence: 0.55,
        why: `a body reaching only storey ${mass.storeySpan.toIndex}, below the main roof, with nothing in the sources describing its own: taken as level, which is the commonest roof over an attached single-storey body and is recorded here as a convention rather than a reading`,
      })
      unresolved.push({
        id: stableId('gap', `roof-kind-${mass.id}`, { massId: mass.id }),
        what: `the kind of roof over ${mass.id}`,
        reason: 'no printed angle, specification line or technical view describes a roof over this body separately from the main one',
        status: 'MISSING',
        frameIds: [],
      })
      continue
    }

    const eaves = levels.eaves
    const ridgeDatum = levels.topDatum
    const rise = eaves !== undefined && ridgeDatum !== undefined ? ridgeDatum - eaves : undefined
    let roofKind: RoofKind = kind?.kind ?? 'UNKNOWN'
    let authority: RoofSupportHypothesis['authority'] = kind ? 'PUBLISHED_SPECIFICATION' : 'NONE'
    if (pitch) authority = rankOfAuthority(pitch.authority) > rankOfAuthority(authority) ? pitch.authority : authority
    if (roofKind === 'UNKNOWN' && rise !== undefined && rise > 0.4) {
      roofKind = 'GABLE'
      authority = rankOfAuthority(authority) > rankOfAuthority('SECTION') ? authority : 'SECTION'
    }
    if (roofKind === 'UNKNOWN' && rise !== undefined && rise <= 0.4) {
      roofKind = 'FLAT'
      authority = 'SECTION'
    }

    let ridgeAxis: 'X' | 'Z' | undefined
    let ridgeWhy = ''
    if (roofKind === 'GABLE' || roofKind === 'MONOPITCH') {
      const fromRise = pitch && rise !== undefined ? ridgeAxisFromRise(widthM, depthM, pitch.evidence.value, rise, tolerance) : undefined
      if (fromRise) {
        ridgeAxis = fromRise.axis
        ridgeWhy = `a ${pitch?.evidence.value}° roof over the ${(fromRise.axis === 'X' ? depthM : widthM).toFixed(2)} m span rises ${fromRise.predicted.toFixed(2)} m, and the section measures ${rise?.toFixed(2)} m from eaves to ridge — ${fromRise.residual.toFixed(2)} m apart`
        if (fromRise.ambiguous) {
          conflicts.push({
            id: stableId('conflict', `ridge-${mass.id}`, { massId: mass.id }),
            kind: 'ROOF_EVIDENCE_DISAGREES',
            what: 'both of this body’s spans reproduce the measured ridge height at the stated pitch, so the section does not say which way the ridge runs',
            itemIds: [id, mass.id],
            evidenceIds: [...levels.evidenceIds],
            magnitude: round6(Math.abs(widthM - depthM)),
            unit: 'm',
          })
        }
      } else {
        // The ridge runs the long way unless something says otherwise, which
        // is what a builder would assume and what a catalogue drawing almost
        // always shows. Stated as the assumption it is.
        ridgeAxis = depthM >= widthM ? 'Z' : 'X'
        ridgeWhy = `nothing measures the ridge height against the pitch, so the ridge is taken to run the long way, along ${ridgeAxis}`
        unresolved.push({
          id: stableId('gap', `ridge-${mass.id}`, { massId: mass.id }),
          what: `which way the ridge runs over ${mass.id}`,
          reason: rise === undefined ? 'no section states an eaves level and a ridge level, so there is no rise to test a span against' : 'neither span reproduces the measured rise at the stated pitch',
          status: 'AMBIGUOUS',
          frameIds: [],
        })
      }
    }

    const span = ridgeAxis === 'X' ? depthM : widthM
    const predictedRidge = pitch && eaves !== undefined ? eaves + (span / 2) * Math.tan((pitch.evidence.value * Math.PI) / 180) : undefined
    if (predictedRidge !== undefined && ridgeDatum !== undefined && Math.abs(predictedRidge - ridgeDatum) > tolerance) {
      // §8: keep the printed value and report the residual. Never quietly
      // adjust an angle somebody wrote down to make a height come out.
      conflicts.push({
        id: stableId('conflict', `pitch-${mass.id}`, { massId: mass.id }),
        kind: 'ROOF_EVIDENCE_DISAGREES',
        what: `the stated ${pitch?.evidence.value}° pitch over ${span.toFixed(2)} m puts the ridge at ${predictedRidge.toFixed(2)} m, and the section's datums put it at ${ridgeDatum.toFixed(2)} m`,
        itemIds: [id, mass.id],
        evidenceIds: [pitch ? pitch.evidence.id : '', ...levels.evidenceIds].filter((e) => e.length > 0),
        magnitude: round6(Math.abs(predictedRidge - ridgeDatum)),
        unit: 'm',
      })
    }

    const noEaves = eavesFinding?.value === 'NONE'
    roofs.push({
      id,
      massId: mass.id,
      kind: roofKind,
      ring: mass.ring,
      pitchDeg: pitch
        ? quantity(pitch.evidence.value, pitch.evidence.value - 0.5, pitch.evidence.value + 0.5, 'deg', 'MEASURED', [pitch.evidence.id], `printed as "${pitch.evidence.rawText}": ${pitch.evidence.association.why}`)
        : rise !== undefined && span > 0
          ? quantity(
              (Math.atan((2 * rise) / span) * 180) / Math.PI,
              (Math.atan((2 * (rise - 0.1)) / span) * 180) / Math.PI,
              (Math.atan((2 * (rise + 0.1)) / span) * 180) / Math.PI,
              'deg',
              'DERIVED',
              [...levels.evidenceIds],
              'from the rise the section measures over the span the plan measures',
            )
          : undefined,
      ridgeAxis,
      eaveLevelM: eaves === undefined ? undefined : quantity(eaves, eaves - 0.1, eaves + 0.1, 'm', 'MEASURED', [...levels.evidenceIds], 'the level datum where the walls stop'),
      ridgeLevelM: ridgeDatum === undefined ? undefined : quantity(ridgeDatum, ridgeDatum - 0.1, ridgeDatum + 0.1, 'm', 'MEASURED', [...levels.evidenceIds], 'the highest level datum the section prints'),
      overhangM: noEaves
        ? quantity(0, 0, 0.05, 'm', 'MEASURED', [], `the publisher states the roof has no eaves: "${eavesFinding?.quote.slice(0, 80)}"`)
        : quantity(0, 0, 0.8, 'm', 'ASSUMED', [], 'nothing states an eaves projection, and inventing one adds roof that may not exist'),
      adjacentRoofIds: masses.filter((m) => m.id !== mass.id).map((m) => `roof-${m.id}`),
      authority,
      observationIds: [],
      evidenceIds: [...(pitch ? [pitch.evidence.id] : []), ...levels.evidenceIds],
      confidence: round6(Math.min(0.95, 0.4 + rankOfAuthority(authority) * 0.1 + (ridgeAxis ? 0.1 : 0))),
      why: [
        kind ? `${kind.finding.why}` : 'no specification names the roof kind',
        pitch ? `pitch printed as "${pitch.evidence.rawText}"` : 'no printed pitch',
        ridgeWhy,
      ]
        .filter((p) => p.length > 0)
        .join('; '),
    })
    if (!pitch) {
      unresolved.push({
        id: stableId('gap', `pitch-${mass.id}`, { massId: mass.id }),
        what: `the pitch of the roof over ${mass.id}`,
        reason: 'no angle is printed on any drawing and no specification states one',
        status: rise === undefined ? 'MISSING' : 'AMBIGUOUS',
        frameIds: [],
      })
    }
  }
  return { roofs: roofs.sort((a, b) => a.id.localeCompare(b.id)), conflicts, unresolved }
}
