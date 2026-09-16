/**
 * The gate a structural layout has to pass before anything is built from it.
 *
 * §9: a candidate must be rejected, or marked partial, when it violates a
 * high-authority fact — an overall dimension, a chain, a stated pitch, a
 * storey datum, a mass relation corroborated by a technical view. The point is
 * not to catch small errors. It is that a solver which has found a numeric
 * optimum will emit it with complete confidence, and a wrong building emitted
 * confidently is worse than a right building emitted with holes in it.
 *
 * So the checks here are deliberately about AGREEMENT BETWEEN SOURCES rather
 * than about plausibility. Each one takes something the layout says and
 * something a source states, and asks whether they are the same. A layout that
 * no source contradicts is ACCEPTED. One that a source contradicts on
 * something it could reasonably be wrong about is PARTIAL. One that
 * contradicts a printed number, or that is internally impossible, is REJECTED
 * and never reaches the model.
 *
 * §21's pre-emission projection audit lives here too, and it is the same idea
 * applied across views: the structure is projected back onto what the other
 * drawings measured — a ridge height against a pitch and a span, a width
 * against a second plan's own chain, a footprint area against the publisher's
 * own figure — before a single wall is emitted.
 */
import { hashArtifact, round6 } from '@buildapp/source-common'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import { LAYOUT_SET_SCHEMA, LAYOUT_SET_SCHEMA_VERSION, ringArea, ringBounds } from './structural-layout.js'
import type {
  LayoutGate,
  LayoutGateReason,
  MassHypothesis,
  RoofSupportHypothesis,
  StructuralLayoutHypothesisSet,
  LayoutConflict,
  LayoutGap,
  StoreyLayoutHypothesis,
  FootprintRegionHypothesis,
  RecessHypothesis,
  AttachmentRelation,
  FacadePlaneHypothesis,
  AlternativeGroup,
  LayoutTrace,
} from './structural-layout.js'

export type PublishedArea = { key: string; label: string; value: number; unit: string }

export type LayoutGateOptions = {
  masses: readonly MassHypothesis[]
  roofs: readonly RoofSupportHypothesis[]
  storeys: readonly StoreyLayoutHypothesis[]
  regions: readonly FootprintRegionHypothesis[]
  conflicts: readonly LayoutConflict[]
  unresolved: readonly LayoutGap[]
  metrics: MetricEvidenceSet
  /** The frame the layout's coordinates came from, so its own chains are not counted as a second view. */
  baseFrameId: string
  /** Figures the publisher printed, used ONLY as a check and never as a source of geometry. */
  publishedAreas?: readonly PublishedArea[]
  /** How far a metric check may be out and still count as agreement, in metres. */
  toleranceM?: number
}

/**
 * The longest span any chain on a frame states, in metres.
 *
 * Used to ask a second drawing what it thinks the building measures. A site
 * plan and a floor plan are drawn at different scales by different hands, and
 * when their longest dimensions agree to a few centimetres that is genuine
 * corroboration rather than the same reading counted twice.
 */
function statedSpans(metrics: MetricEvidenceSet, exceptFrameId: string): Array<{ frameId: string; axis: 'HORIZONTAL' | 'VERTICAL'; metres: number; chainId: string }> {
  const out: Array<{ frameId: string; axis: 'HORIZONTAL' | 'VERTICAL'; metres: number; chainId: string }> = []
  for (const chain of metrics.chains) {
    if (chain.frameId === exceptFrameId) continue
    const read = chain.segments.filter((s) => s.origin === 'READ' || s.origin === 'CHAIN_CORRECTED')
    if (read.length === 0) continue
    const total = chain.printedTotal?.valueCm ?? chain.derivedTotalCm
    if (total === undefined) continue
    out.push({ frameId: chain.frameId, axis: chain.axis, metres: round6(total / 100), chainId: chain.id })
  }
  return out
}

/** True when a second drawing states a span within tolerance of this one. */
const corroborates = (spans: ReturnType<typeof statedSpans>, metres: number, tolerance: number): { frameId: string; chainId: string; metres: number } | undefined =>
  spans.filter((s) => Math.abs(s.metres - metres) <= tolerance).sort((a, b) => Math.abs(a.metres - metres) - Math.abs(b.metres - metres))[0]

/**
 * Judge a layout.
 *
 * Reasons are always returned, whatever the verdict: an ACCEPTED layout with
 * three NOTED reasons is a different thing from an ACCEPTED layout with none,
 * and a reader deciding whether to trust it needs to see which.
 */
export function evaluateLayoutGate(options: LayoutGateOptions): LayoutGate {
  const tolerance = options.toleranceM ?? 0.25
  const reasons: LayoutGateReason[] = []
  const { masses, roofs, storeys, regions, metrics } = options
  const say = (code: string, severity: LayoutGateReason['severity'], what: string, why: string, itemIds: string[] = []): void => {
    reasons.push({ code, severity, what, why, itemIds })
  }

  // --- is there a building at all? -----------------------------------------
  if (masses.length === 0) {
    say('NO_MASS', 'BLOCKING', 'the layout contains no building mass', 'nothing on any plan is enclosed by walls, so there is nothing to build')
    return { status: 'STRUCTURAL_LAYOUT_REJECTED', reasons }
  }

  // --- can it exist? --------------------------------------------------------
  for (let i = 0; i < masses.length; i += 1) {
    for (let j = i + 1; j < masses.length; j += 1) {
      const a = ringBounds(masses[i].ring)
      const b = ringBounds(masses[j].ring)
      const overlap = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0))
      if (overlap > 0.5) {
        say('MASS_OVERLAP', 'BLOCKING', `${masses[i].id} and ${masses[j].id} occupy the same ${overlap.toFixed(2)} m² of plan`, 'two bodies cannot stand in the same place, so at least one of them is a misreading of the other', [masses[i].id, masses[j].id])
      }
    }
  }

  // --- does it agree with the drawing it came from? -------------------------
  const bounds = masses.map((m) => ringBounds(m.ring))
  const overallWidth = round6(Math.max(...bounds.map((b) => b.x1)) - Math.min(...bounds.map((b) => b.x0)))
  const overallDepth = round6(Math.max(...bounds.map((b) => b.z1)) - Math.min(...bounds.map((b) => b.z0)))
  const spans = statedSpans(metrics, options.baseFrameId)
  const widthElsewhere = corroborates(spans, overallWidth, Math.max(tolerance, overallWidth * 0.02))
  const depthElsewhere = corroborates(spans, overallDepth, Math.max(tolerance, overallDepth * 0.02))
  if (widthElsewhere) say('WIDTH_CORROBORATED', 'NOTED', `a second drawing states ${widthElsewhere.metres.toFixed(2)} m across`, `chain ${widthElsewhere.chainId} on ${widthElsewhere.frameId} agrees with the ${overallWidth.toFixed(2)} m the walls measure`)
  if (depthElsewhere) say('DEPTH_CORROBORATED', 'NOTED', `a second drawing states ${depthElsewhere.metres.toFixed(2)} m deep`, `chain ${depthElsewhere.chainId} on ${depthElsewhere.frameId} agrees with the ${overallDepth.toFixed(2)} m the walls measure`)
  if (!widthElsewhere && !depthElsewhere && spans.length > 0) {
    say('NO_SECOND_VIEW', 'NOTED', 'no second drawing states either of the building’s overall dimensions', `${spans.length} chains were read on other frames and none of them comes within ${tolerance} m of ${overallWidth.toFixed(2)} m or ${overallDepth.toFixed(2)} m`)
  }

  // --- does it agree with what the publisher printed? -----------------------
  const builtArea = round6(regions.filter((r) => r.kind === 'BUILT' && storeys.find((s) => s.id === r.storeyId)?.index === Math.min(...storeys.map((s) => s.index))).reduce((a, r) => a + ringArea(r.ring), 0))
  const published = options.publishedAreas?.find((f) => f.key === 'footprint_area' && f.unit === 'm2')
  if (published && builtArea > 0) {
    const error = Math.abs(builtArea - published.value) / published.value
    if (error <= 0.06) say('FOOTPRINT_AREA_AGREES', 'NOTED', `the lowest storey covers ${builtArea.toFixed(2)} m² against the ${published.value} m² the publisher prints`, `${(error * 100).toFixed(1)}% apart, which is closer than a rounded published figure can distinguish`)
    else if (error <= 0.2) say('FOOTPRINT_AREA_NEAR', 'DEGRADING', `the lowest storey covers ${builtArea.toFixed(2)} m² against the ${published.value} m² the publisher prints`, `${(error * 100).toFixed(1)}% apart: something the plans show is not in the layout, or something in the layout is not built`)
    else say('FOOTPRINT_AREA_WRONG', 'BLOCKING', `the lowest storey covers ${builtArea.toFixed(2)} m² against the ${published.value} m² the publisher prints`, `${(error * 100).toFixed(1)}% apart: the decomposition is not of this building`)
  }

  // --- does the structure stand up to its own storeys? ----------------------
  if (storeys.length === 0) say('NO_STOREY', 'BLOCKING', 'the layout has no storeys', 'no plan was read, so there is no level to put anything on')
  const spanned = masses.filter((m) => m.storeySpan.toIndex > m.storeySpan.fromIndex)
  if (storeys.length > 1 && spanned.length === 0) {
    say('NO_MASS_REACHES_UP', 'DEGRADING', 'more than one storey was read and no body reaches past the first', 'either the upper plan did not register onto anything, or the building is being read as single-storey when it is not', storeys.map((s) => s.id))
  }
  if (storeys.length > 1 && masses.length > 1 && spanned.length === masses.length) {
    say('EVERY_MASS_FULL_HEIGHT', 'NOTED', 'every body reaches every storey', 'which is possible, and is also what a layout looks like when the storey registration has simply copied the ground floor upwards', masses.map((m) => m.id))
  }

  // --- the roofs ------------------------------------------------------------
  for (const mass of masses) {
    const roof = roofs.find((r) => r.massId === mass.id)
    if (!roof) {
      say('NO_ROOF', 'DEGRADING', `${mass.id} has no roof system`, 'a body with no roof is a body the sources said nothing about above its walls', [mass.id])
      continue
    }
    if (roof.kind === 'UNKNOWN') say('ROOF_KIND_UNKNOWN', 'DEGRADING', `nothing states what kind of roof stands over ${mass.id}`, 'no printed angle, specification line or section settles it', [roof.id])
    else if (roof.authority === 'CONVENTION') say('ROOF_BY_CONVENTION', 'NOTED', `the roof over ${mass.id} is a convention rather than a reading`, roof.why, [roof.id])
  }
  if (masses.length > 1) {
    const kinds = new Set(roofs.map((r) => r.kind))
    if (kinds.size === 1 && roofs.length > 1) {
      say('ONE_ROOF_KIND', 'NOTED', 'every body carries the same kind of roof', 'which may be right, and is also what one roof over the whole building looks like after it has been split up', roofs.map((r) => r.id))
    }
  }

  // --- what the layout itself reported --------------------------------------
  for (const conflict of options.conflicts) {
    say(conflict.kind, conflict.kind === 'MASS_OVERLAP' ? 'BLOCKING' : 'DEGRADING', conflict.what, 'two sources disagree and neither was averaged into the other', conflict.itemIds)
  }
  const missing = options.unresolved.filter((u) => u.status === 'MISSING')
  if (missing.length > 0) {
    say('NAMED_HOLES', 'NOTED', `${missing.length} structural thing${missing.length === 1 ? '' : 's'} the sources do not settle`, missing.map((m) => m.what).join('; '), [])
  }

  const status: LayoutGate['status'] = reasons.some((r) => r.severity === 'BLOCKING')
    ? 'STRUCTURAL_LAYOUT_REJECTED'
    : reasons.some((r) => r.severity === 'DEGRADING')
      ? 'STRUCTURAL_LAYOUT_PARTIAL'
      : 'STRUCTURAL_LAYOUT_ACCEPTED'
  return { status, reasons }
}

// ---------------------------------------------------------------------------
// Sealing
// ---------------------------------------------------------------------------

export type StructuralLayoutDraftInput = {
  sourcePackageId: string
  sourcePackageHash: string
  observationGraphId: string
  observationGraphHash: string
  metricEvidenceId: string
  metricEvidenceHash: string
  storeys: readonly StoreyLayoutHypothesis[]
  masses: readonly MassHypothesis[]
  footprintRegions: readonly FootprintRegionHypothesis[]
  recesses: readonly RecessHypothesis[]
  attachments: readonly AttachmentRelation[]
  roofSupports: readonly RoofSupportHypothesis[]
  facadePlanes: readonly FacadePlaneHypothesis[]
  alternatives: readonly AlternativeGroup[]
  conflicts: readonly LayoutConflict[]
  unresolved: readonly LayoutGap[]
  traces: readonly LayoutTrace[]
  gate: LayoutGate
}

/**
 * Give a layout its content hash.
 *
 * The hash covers the STRUCTURE — which bodies, how big, how far up, what
 * roof, what verdict — and not the prose. Two runs that reach the same
 * building must hash the same even if a sentence explaining one of them was
 * reworded, and two runs that reach different buildings must not.
 */
export function structuralLayoutContentHash(draft: StructuralLayoutDraftInput): string {
  return hashArtifact(LAYOUT_SET_SCHEMA, LAYOUT_SET_SCHEMA_VERSION, [
    { label: 'package', ordered: { id: draft.sourcePackageId, hash: draft.sourcePackageHash } },
    { label: 'observations', ordered: { id: draft.observationGraphId, hash: draft.observationGraphHash } },
    { label: 'metrics', ordered: { id: draft.metricEvidenceId, hash: draft.metricEvidenceHash } },
    { label: 'storeys', unordered: draft.storeys.map((s) => ({ index: s.index, frames: [...s.frameIds].sort(), regions: [...s.footprintRegionIds].sort() })) },
    {
      label: 'masses',
      unordered: draft.masses.map((m) => ({ id: m.id, role: m.role, ring: m.ring.points, from: m.storeySpan.fromIndex, to: m.storeySpan.toIndex, width: m.widthM.value, depth: m.depthM.value })),
    },
    { label: 'regions', unordered: draft.footprintRegions.map((r) => ({ id: r.id, kind: r.kind, storey: r.storeyId, ring: r.ring.points, area: r.areaM2 })) },
    { label: 'recesses', unordered: draft.recesses.map((r) => ({ id: r.id, mass: r.massId, side: r.mouthSide, mouth: r.mouth, back: r.backAt, depth: r.depthM.value })) },
    { label: 'attachments', unordered: draft.attachments.map((a) => ({ kind: a.kind, from: a.fromId, to: a.toId, contact: a.contact ?? null })) },
    {
      label: 'roofs',
      unordered: draft.roofSupports.map((r) => ({ id: r.id, mass: r.massId, kind: r.kind, pitch: r.pitchDeg?.value ?? null, ridge: r.ridgeAxis ?? null, eave: r.eaveLevelM?.value ?? null, authority: r.authority })),
    },
    { label: 'facades', unordered: draft.facadePlanes.map((f) => ({ id: f.id, mass: f.massId, side: f.side, at: f.at, from: f.from, to: f.to, exterior: f.exterior })) },
    { label: 'alternatives', unordered: draft.alternatives.map((a) => ({ what: a.what, chosen: a.chosenId, margin: a.margin })) },
    { label: 'conflicts', unordered: draft.conflicts.map((c) => ({ kind: c.kind, what: c.what, magnitude: c.magnitude ?? null })) },
    { label: 'unresolved', unordered: draft.unresolved.map((u) => ({ what: u.what, status: u.status })) },
    { label: 'gate', ordered: { status: draft.gate.status, reasons: draft.gate.reasons.map((r) => `${r.severity}:${r.code}`).sort() } },
  ])
}

/** Seal a layout: give it its content hash and the id derived from it. */
export function sealStructuralLayout(draft: StructuralLayoutDraftInput, slug: string): StructuralLayoutHypothesisSet {
  const contentHash = structuralLayoutContentHash(draft)
  return {
    schema: LAYOUT_SET_SCHEMA,
    schemaVersion: LAYOUT_SET_SCHEMA_VERSION,
    id: `layout-${slug}-${contentHash.slice(0, 16)}`,
    sourcePackageId: draft.sourcePackageId,
    sourcePackageHash: draft.sourcePackageHash,
    observationGraphId: draft.observationGraphId,
    observationGraphHash: draft.observationGraphHash,
    metricEvidenceId: draft.metricEvidenceId,
    metricEvidenceHash: draft.metricEvidenceHash,
    storeys: [...draft.storeys].sort((a, b) => a.index - b.index),
    masses: [...draft.masses].sort((a, b) => a.id.localeCompare(b.id)),
    footprintRegions: [...draft.footprintRegions].sort((a, b) => a.id.localeCompare(b.id)),
    recesses: [...draft.recesses].sort((a, b) => a.id.localeCompare(b.id)),
    attachments: [...draft.attachments].sort((a, b) => a.id.localeCompare(b.id)),
    roofSupports: [...draft.roofSupports].sort((a, b) => a.id.localeCompare(b.id)),
    facadePlanes: [...draft.facadePlanes].sort((a, b) => a.id.localeCompare(b.id)),
    alternatives: [...draft.alternatives].sort((a, b) => a.id.localeCompare(b.id)),
    conflicts: [...draft.conflicts].sort((a, b) => a.id.localeCompare(b.id)),
    unresolved: [...draft.unresolved].sort((a, b) => a.id.localeCompare(b.id)),
    traces: [...draft.traces].sort((a, b) => a.id.localeCompare(b.id)),
    gate: draft.gate,
    contentHash,
  }
}
