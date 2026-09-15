/**
 * Structural validation of an observation graph.
 *
 * This is the layer that refuses to let an extractor — deterministic or
 * multimodal — put something into the record that cannot be true of the
 * sources it claims to have read. It is deliberately about internal
 * consistency and nothing else: whether a roof edge is in the RIGHT place is
 * a question for the benchmark, but whether it is on a frame that exists, at
 * coordinates inside that frame's decoded image, with a normalized copy that
 * agrees with its pixels, is a question with a yes-or-no answer here.
 *
 * Two of the checks exist because of specific failure modes a language model
 * produces and a human reviewer does not:
 *
 *  - a provider returning coordinates outside the image it was shown (it
 *    imagined a wider picture, or answered about a different one);
 *  - a provider returning zero positional uncertainty, which no reading of a
 *    raster ever deserves and which would let a later solver weight a guess
 *    like a measurement.
 *
 * Severity matters: ERROR means the graph is not admissible and sealing
 * fails; WARN means it is admissible but a reader should know. Nothing here
 * silently repairs anything.
 */
import { angleDeltaDeg, round6 } from '@buildapp/source-common'
import { SourceObservationGraphSchema } from './schema.js'
import type { NormGeometry, ObservationRelation, PixelGeometry, SourceCoordinateFrame, SourceObservation, SourceObservationGraph } from './schema.js'
import { normPoints, normalizeGeometry, pixelCentroid, pixelPoints, isOriented } from './geometry.js'
import { frameId as computeFrameId, recomputeObservationId, recomputeRelationId } from './ids.js'
import { graphHashIsIntact } from './hash.js'

export type ValidationSeverity = 'ERROR' | 'WARN'

export type ValidationIssue = {
  severity: ValidationSeverity
  code: string
  subject: string
  message: string
}

/** How far outside its frame a coordinate may stray before it is a fabrication rather than an edge-hugging reading. */
export const OUT_OF_BOUNDS_MARGIN = 0.02

/** How far a supplied normalized copy may differ from the one derived from the pixels, in normalized units. */
export const NORM_AGREEMENT_TOLERANCE = 1e-5

/** Relations whose two ends must be in the same view. */
const WITHIN_VIEW: ReadonlySet<ObservationRelation['kind']> = new Set(['PROUD_OF', 'RECESSED_BEHIND', 'COPLANAR_WITH', 'OCCLUDES', 'INSIDE_RECESS', 'SPANS_BETWEEN', 'CONTINUES_ACROSS', 'ALIGNS_WITH', 'SUPPORTS', 'CONTAINS', 'ABOVE', 'BELOW', 'LEFT_OF', 'RIGHT_OF'])

/** Relations that assert one feature was seen twice, and therefore must span two views. */
const CROSS_VIEW: ReadonlySet<ObservationRelation['kind']> = new Set(['POSSIBLY_SAME_FEATURE', 'SAME_FEATURE'])

const geometryKind = (g: PixelGeometry | NormGeometry): string => g.type

function checkGeometryAgreement(o: SourceObservation, frame: SourceCoordinateFrame, issues: ValidationIssue[]): void {
  if (geometryKind(o.pixelGeometry) !== geometryKind(o.normGeometry)) {
    issues.push({ severity: 'ERROR', code: 'GEOMETRY_TYPE_MISMATCH', subject: o.id, message: `pixel geometry is ${o.pixelGeometry.type} but normalized geometry is ${o.normGeometry.type}` })
    return
  }
  const derived = normalizeGeometry(o.pixelGeometry, frame.size)
  const want = normPoints(derived)
  const got = normPoints(o.normGeometry)
  if (want.length !== got.length) {
    issues.push({ severity: 'ERROR', code: 'GEOMETRY_ARITY_MISMATCH', subject: o.id, message: `pixel geometry has ${want.length} points, normalized geometry has ${got.length}` })
    return
  }
  for (let i = 0; i < want.length; i += 1) {
    const dx = Math.abs(want[i].x - got[i].x)
    const dy = Math.abs(want[i].y - got[i].y)
    if (dx > NORM_AGREEMENT_TOLERANCE || dy > NORM_AGREEMENT_TOLERANCE) {
      issues.push({
        severity: 'ERROR',
        code: 'NORMALIZED_DISAGREES_WITH_PIXELS',
        subject: o.id,
        message: `point ${i} normalizes to (${want[i].x}, ${want[i].y}) on a ${frame.size.width}x${frame.size.height} frame but the graph says (${got[i].x}, ${got[i].y})`,
      })
      return
    }
  }
}

function checkBounds(o: SourceObservation, frame: SourceCoordinateFrame, issues: ValidationIssue[]): void {
  const lo = -OUT_OF_BOUNDS_MARGIN
  const hi = 1 + OUT_OF_BOUNDS_MARGIN
  for (const p of normPoints(o.normGeometry)) {
    if (p.x < lo || p.x > hi || p.y < lo || p.y > hi) {
      issues.push({
        severity: 'ERROR',
        code: 'OUT_OF_BOUNDS',
        subject: o.id,
        message: `normalized point (${p.x}, ${p.y}) lies outside the ${frame.size.width}x${frame.size.height} image it claims to be on (margin ${OUT_OF_BOUNDS_MARGIN})`,
      })
      return
    }
  }
  for (const p of pixelPoints(o.pixelGeometry)) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      issues.push({ severity: 'ERROR', code: 'NON_FINITE_COORDINATE', subject: o.id, message: `pixel point (${p.x}, ${p.y}) is not finite` })
      return
    }
  }
}

function checkUncertainty(o: SourceObservation, frame: SourceCoordinateFrame, issues: ValidationIssue[]): void {
  const diagonal = Math.hypot(frame.size.width, frame.size.height)
  if (!Number.isFinite(o.uncertainty.positionPx) || o.uncertainty.positionPx < 0) {
    issues.push({ severity: 'ERROR', code: 'UNCERTAINTY_INVALID', subject: o.id, message: `positional uncertainty ${o.uncertainty.positionPx} is not a non-negative number` })
    return
  }
  if (o.uncertainty.positionPx > diagonal / 2) {
    issues.push({
      severity: 'ERROR',
      code: 'UNCERTAINTY_EXCEEDS_IMAGE',
      subject: o.id,
      message: `positional uncertainty ${round6(o.uncertainty.positionPx)}px exceeds half the ${round6(diagonal)}px image diagonal, so the observation locates nothing`,
    })
  }
  if (o.provenance.extractor === 'VISION_MODEL' && o.uncertainty.positionPx <= 0) {
    issues.push({ severity: 'ERROR', code: 'VISION_CLAIMS_EXACT_POSITION', subject: o.id, message: 'a vision model may not claim zero positional uncertainty: its coordinates are an estimate, and a solver must be able to weight them as one' })
  }
  if (o.uncertainty.angleDeg !== undefined && (o.uncertainty.angleDeg < 0 || o.uncertainty.angleDeg > 180)) {
    issues.push({ severity: 'ERROR', code: 'UNCERTAINTY_ANGLE_INVALID', subject: o.id, message: `angular uncertainty ${o.uncertainty.angleDeg} is outside [0, 180]` })
  }
  if (isOriented(o.pixelGeometry) && o.uncertainty.angleDeg === undefined) {
    issues.push({ severity: 'WARN', code: 'ORIENTED_WITHOUT_ANGLE_UNCERTAINTY', subject: o.id, message: `a ${o.pixelGeometry.type} has a direction but states no angular tolerance` })
  }
  for (const alt of o.alternatives) {
    if (alt.confidence > o.confidence) {
      issues.push({ severity: 'WARN', code: 'ALTERNATIVE_BEATS_PRIMARY', subject: o.id, message: `an alternative reading is offered at confidence ${alt.confidence}, above the primary's ${o.confidence}` })
    }
  }
}

function checkRelation(r: ObservationRelation, byId: Map<string, SourceObservation>, issues: ValidationIssue[]): void {
  const from = byId.get(r.from)
  const to = byId.get(r.to)
  if (!from) issues.push({ severity: 'ERROR', code: 'RELATION_DANGLING', subject: r.id, message: `relation source ${r.from} is not an observation in this graph` })
  if (!to) issues.push({ severity: 'ERROR', code: 'RELATION_DANGLING', subject: r.id, message: `relation target ${r.to} is not an observation in this graph` })
  if (!from || !to) return
  if (r.from === r.to) {
    issues.push({ severity: 'ERROR', code: 'RELATION_SELF', subject: r.id, message: `${r.kind} relates an observation to itself` })
    return
  }
  const sameFrame = from.frameId === to.frameId
  if (WITHIN_VIEW.has(r.kind) && !sameFrame) {
    issues.push({ severity: 'ERROR', code: 'RELATION_CROSSES_VIEWS', subject: r.id, message: `${r.kind} is a within-view relation but its ends are on different frames (${from.frameId}, ${to.frameId}); pixel coordinates in two views are not comparable` })
    return
  }
  if (CROSS_VIEW.has(r.kind) && sameFrame) {
    issues.push({ severity: 'ERROR', code: 'RELATION_WITHIN_ONE_VIEW', subject: r.id, message: `${r.kind} asserts one feature seen in two views, but both ends are on frame ${from.frameId}` })
    return
  }
  if (r.kind === 'SAME_FEATURE' && r.confidence < 0.9) {
    issues.push({
      severity: 'ERROR',
      code: 'SAME_FEATURE_UNDER_CONFIDENT',
      subject: r.id,
      message: `SAME_FEATURE asserted at confidence ${r.confidence}: a merge this weak must be recorded as POSSIBLY_SAME_FEATURE, because a false merge destroys evidence and a missed merge only leaves work undone`,
    })
  }
  // Directional relations must agree with the picture. A relation that says
  // "above" about something below it is worse than no relation at all.
  if (r.kind === 'ABOVE' || r.kind === 'BELOW' || r.kind === 'LEFT_OF' || r.kind === 'RIGHT_OF') {
    const a = pixelCentroid(from.pixelGeometry)
    const b = pixelCentroid(to.pixelGeometry)
    const ok = r.kind === 'ABOVE' ? a.y < b.y : r.kind === 'BELOW' ? a.y > b.y : r.kind === 'LEFT_OF' ? a.x < b.x : a.x > b.x
    if (!ok) issues.push({ severity: 'ERROR', code: 'DIRECTION_CONTRADICTS_GEOMETRY', subject: r.id, message: `${r.kind} disagrees with the pixels: source centroid (${a.x}, ${a.y}), target centroid (${b.x}, ${b.y})` })
  }
  if (r.kind === 'ALIGNS_WITH' && isOriented(from.pixelGeometry) && isOriented(to.pixelGeometry)) {
    const angleOf = (g: PixelGeometry): number | null => {
      const pts = pixelPoints(g)
      if (pts.length < 2) return null
      const a = pts[0]
      const b = pts[pts.length - 1]
      return ((((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 180) + 180) % 180
    }
    const u = angleOf(from.pixelGeometry)
    const v = angleOf(to.pixelGeometry)
    const tol = Math.max(2, (from.uncertainty.angleDeg ?? 0) + (to.uncertainty.angleDeg ?? 0))
    if (u !== null && v !== null && angleDeltaDeg(u, v) > tol) {
      issues.push({ severity: 'WARN', code: 'ALIGNMENT_ANGLES_DIFFER', subject: r.id, message: `ALIGNS_WITH between directions ${round6(u)}° and ${round6(v)}°, further apart than the ${round6(tol)}° tolerance the two observations state` })
    }
  }
}

/**
 * Validate a graph that is already schema-shaped. Returns every issue found;
 * an empty array means the graph is internally consistent.
 */
export function validateObservationGraph(graph: SourceObservationGraph, options: { checkIds?: boolean; checkHash?: boolean } = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const checkIds = options.checkIds ?? true

  const frames = new Map<string, SourceCoordinateFrame>()
  for (const f of graph.coordinateFrames) {
    if (frames.has(f.id)) issues.push({ severity: 'ERROR', code: 'DUPLICATE_FRAME_ID', subject: f.id, message: 'two coordinate frames share an id' })
    frames.set(f.id, f)
    if (checkIds) {
      const want = computeFrameId(f.assetId, f.variantByteHash)
      if (want !== f.id) issues.push({ severity: 'ERROR', code: 'FRAME_ID_NOT_DERIVED', subject: f.id, message: `frame id is not the deterministic id of its content (expected ${want})` })
    }
  }

  const declaredExtractors = new Set(graph.extractors.map((e) => e.name))
  const byId = new Map<string, SourceObservation>()

  for (const o of graph.observations) {
    if (byId.has(o.id)) issues.push({ severity: 'ERROR', code: 'DUPLICATE_OBSERVATION_ID', subject: o.id, message: 'two observations share an id' })
    byId.set(o.id, o)

    const frame = frames.get(o.frameId)
    if (!frame) {
      issues.push({ severity: 'ERROR', code: 'FRAME_MISSING', subject: o.id, message: `observation names frame ${o.frameId}, which this graph does not define` })
      continue
    }
    if (frame.assetId !== o.assetId) issues.push({ severity: 'ERROR', code: 'FRAME_ASSET_MISMATCH', subject: o.id, message: `observation is on asset ${o.assetId} but frame ${frame.id} belongs to ${frame.assetId}` })
    if (frame.variantByteHash !== o.variantByteHash) {
      issues.push({ severity: 'ERROR', code: 'FRAME_BYTES_MISMATCH', subject: o.id, message: `observation cites bytes ${o.variantByteHash.slice(0, 12)} but its frame was built on ${frame.variantByteHash.slice(0, 12)}` })
    }
    if (!declaredExtractors.has(o.provenance.name)) {
      issues.push({ severity: 'ERROR', code: 'EXTRACTOR_UNDECLARED', subject: o.id, message: `produced by ${o.provenance.name}, which is not listed among the graph's extractors, so its version is not in the hash` })
    }
    checkGeometryAgreement(o, frame, issues)
    checkBounds(o, frame, issues)
    checkUncertainty(o, frame, issues)
    if (checkIds) {
      const want = recomputeObservationId(o)
      if (want !== o.id) issues.push({ severity: 'ERROR', code: 'OBSERVATION_ID_NOT_DERIVED', subject: o.id, message: `observation id is not the deterministic id of its content (expected ${want})` })
    }
  }

  const relationIds = new Set<string>()
  for (const r of graph.relations) {
    if (relationIds.has(r.id)) issues.push({ severity: 'ERROR', code: 'DUPLICATE_RELATION_ID', subject: r.id, message: 'two relations share an id' })
    relationIds.add(r.id)
    if (!declaredExtractors.has(r.provenance.name)) issues.push({ severity: 'ERROR', code: 'EXTRACTOR_UNDECLARED', subject: r.id, message: `asserted by ${r.provenance.name}, which is not listed among the graph's extractors` })
    checkRelation(r, byId, issues)
    if (checkIds) {
      const want = recomputeRelationId(r)
      if (want !== r.id) issues.push({ severity: 'ERROR', code: 'RELATION_ID_NOT_DERIVED', subject: r.id, message: `relation id is not the deterministic id of its content (expected ${want})` })
    }
  }

  for (const c of graph.conflicts) {
    const unique = new Set(c.observationIds)
    if (unique.size < 2) issues.push({ severity: 'ERROR', code: 'CONFLICT_DEGENERATE', subject: c.id, message: 'a conflict needs at least two distinct observations to disagree' })
    for (const id of c.observationIds) {
      if (!byId.has(id)) issues.push({ severity: 'ERROR', code: 'CONFLICT_DANGLING', subject: c.id, message: `conflict cites ${id}, which is not an observation in this graph` })
    }
  }

  const assetIds = new Set(graph.coordinateFrames.map((f) => f.assetId))
  for (const u of graph.unresolved) {
    if (u.assetId !== undefined && !assetIds.has(u.assetId)) issues.push({ severity: 'WARN', code: 'GAP_UNKNOWN_ASSET', subject: u.id, message: `gap is scoped to asset ${u.assetId}, which has no frame in this graph` })
  }

  if (options.checkHash && !graphHashIsIntact(graph)) {
    issues.push({ severity: 'ERROR', code: 'CONTENT_HASH_STALE', subject: graph.id, message: 'the recorded content hash does not match the graph content' })
  }

  return issues
}

export const errorsOnly = (issues: readonly ValidationIssue[]): ValidationIssue[] => issues.filter((i) => i.severity === 'ERROR')

/** Parse and validate in one step. Throws on anything that makes the graph inadmissible. */
export function parseObservationGraph(value: unknown): SourceObservationGraph {
  const graph = SourceObservationGraphSchema.parse(value)
  const errors = errorsOnly(validateObservationGraph(graph, { checkIds: true, checkHash: true }))
  if (errors.length > 0) throw new Error(`observation graph is not admissible:\n${errors.map((e) => `  [${e.code}] ${e.subject}: ${e.message}`).join('\n')}`)
  return graph
}
