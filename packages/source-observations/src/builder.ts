/**
 * The one way to build an observation graph.
 *
 * Extractors do not construct `SourceObservation` objects. They describe what
 * they saw to a builder, which supplies everything an extractor must not be
 * trusted to supply itself: the frame, the normalized geometry derived from
 * the frame's real decoded size, the deterministic id, and the declaration
 * that this extractor and version contributed at all.
 *
 * Two consequences worth naming:
 *
 *  - an extractor cannot hand in normalized coordinates that disagree with
 *    its pixels, because it never hands in normalized coordinates;
 *  - an extractor cannot contribute anonymously, because `observe` takes the
 *    extractor handle returned by `declareExtractor` and that handle carries
 *    the version that goes into the hash.
 *
 * Sealing sorts every collection by id and validates. The sort is for the
 * serialized form only — the content hash is already order-independent — but
 * a canonical file makes a diff between two runs readable.
 */
import type { PixelRect, PixelSize } from '@buildapp/source-common'
import { OBSERVATION_GRAPH_SCHEMA, OBSERVATION_GRAPH_SCHEMA_VERSION } from './schema.js'
import type {
  DepthLayer,
  ExtractorKind,
  ObservationAlternative,
  ObservationConflict,
  ObservationKind,
  ObservationRelation,
  ObservationValue,
  PixelGeometry,
  Provenance,
  RelationKind,
  SemanticHint,
  SourceCoordinateFrame,
  SourceObservation,
  SourceObservationGraph,
  Uncertainty,
  UnresolvedObservation,
} from './schema.js'
import { normalizeGeometry } from './geometry.js'
import { conflictId, frameId, graphId, observationId, relationId, unresolvedId } from './ids.js'
import { observationGraphContentHash } from './hash.js'
import { errorsOnly, validateObservationGraph } from './validate.js'

/** A registered extractor. Observations are made THROUGH one, never beside one. */
export type ExtractorHandle = { readonly name: string; readonly version: string; readonly kind: ExtractorKind }

export type FrameRoles = { document: string; storey: string; annotation: string; view: string; projection: string }

export type ObserveInput = {
  frame: SourceCoordinateFrame
  kind: ObservationKind
  pixelGeometry: PixelGeometry
  /** Sorted and de-duplicated by the builder, so hint order never reaches an id or a hash. */
  semanticHints?: readonly SemanticHint[]
  value?: ObservationValue
  depthLayer?: DepthLayer
  confidence: number
  uncertainty: Uncertainty
  /** A short, checkable statement of the evidence. Prose: it is not hashed and not part of the id. */
  detail: string
  region?: PixelRect
  alternatives?: readonly ObservationAlternative[]
  note?: string
}

export type RelateInput = {
  kind: RelationKind
  from: SourceObservation | string
  to: SourceObservation | string
  confidence: number
  why: string
  detail?: string
}

export type ConflictInput = {
  observations: readonly (SourceObservation | string)[]
  kind: ObservationConflict['kind']
  what: string
  magnitude?: number
  unit?: ObservationConflict['unit']
  note?: string
}

const idOf = (o: SourceObservation | string): string => (typeof o === 'string' ? o : o.id)

const uniqueSortedHints = (hints: readonly SemanticHint[] | undefined): SemanticHint[] => [...new Set(hints ?? [])].sort()

export class ObservationGraphBuilder {
  private readonly frames = new Map<string, SourceCoordinateFrame>()
  private readonly extractors = new Map<string, ExtractorHandle>()
  private readonly observations = new Map<string, SourceObservation>()
  private readonly relations = new Map<string, ObservationRelation>()
  private readonly conflicts = new Map<string, ObservationConflict>()
  private readonly gaps = new Map<string, UnresolvedObservation>()

  constructor(
    private readonly sourcePackageId: string,
    private readonly sourcePackageHash: string,
  ) {}

  /**
   * Register an extractor and its version. Calling twice with the same name
   * and a different version is a programming error: the graph would then
   * record one version in its hash while another produced half the
   * observations.
   */
  declareExtractor(name: string, version: string, kind: ExtractorKind): ExtractorHandle {
    const existing = this.extractors.get(name)
    if (existing) {
      if (existing.version !== version || existing.kind !== kind) throw new Error(`extractor ${name} was already declared at version ${existing.version} (${existing.kind}); it cannot also be ${version} (${kind}) in one graph`)
      return existing
    }
    const handle: ExtractorHandle = { name, version, kind }
    this.extractors.set(name, handle)
    return handle
  }

  /** The coordinate frame for one asset variant's decoded bytes. Idempotent. */
  declareFrame(assetId: string, variantByteHash: string, size: PixelSize, roles: FrameRoles): SourceCoordinateFrame {
    const id = frameId(assetId, variantByteHash)
    const existing = this.frames.get(id)
    if (existing) return existing
    const frame: SourceCoordinateFrame = { id, assetId, variantByteHash, size: { width: size.width, height: size.height }, roles: { ...roles } }
    this.frames.set(id, frame)
    return frame
  }

  /**
   * Record one reading.
   *
   * Returns the stored observation. If an identical reading was already
   * recorded by the same extractor — same bytes, same kind, same hints, same
   * normalized geometry, same value — the stored one is returned unchanged:
   * seeing the same edge twice is one edge, and re-running an extractor must
   * not grow the graph.
   */
  observe(extractor: ExtractorHandle, input: ObserveInput): SourceObservation {
    this.requireExtractor(extractor)
    const frame = this.requireFrame(input.frame)
    const semanticHints = uniqueSortedHints(input.semanticHints)
    const normGeometry = normalizeGeometry(input.pixelGeometry, frame.size)
    const provenance: Provenance = { extractor: extractor.kind, name: extractor.name, detail: input.detail, ...(input.region ? { region: input.region } : {}) }
    const id = observationId({ assetId: frame.assetId, variantByteHash: frame.variantByteHash, kind: input.kind, semanticHints, normGeometry, value: input.value, provenance })
    const existing = this.observations.get(id)
    if (existing) return existing
    const observation: SourceObservation = {
      id,
      assetId: frame.assetId,
      variantByteHash: frame.variantByteHash,
      frameId: frame.id,
      kind: input.kind,
      semanticHints,
      pixelGeometry: input.pixelGeometry,
      normGeometry,
      ...(input.value ? { value: input.value } : {}),
      depthLayer: input.depthLayer ?? 'UNKNOWN',
      confidence: input.confidence,
      uncertainty: input.uncertainty,
      provenance,
      alternatives: [...(input.alternatives ?? [])],
      ...(input.note ? { note: input.note } : {}),
    }
    this.observations.set(id, observation)
    return observation
  }

  relate(extractor: ExtractorHandle, input: RelateInput): ObservationRelation {
    this.requireExtractor(extractor)
    const provenance: Provenance = { extractor: extractor.kind, name: extractor.name, detail: input.detail ?? input.why }
    const from = idOf(input.from)
    const to = idOf(input.to)
    const id = relationId(input.kind, from, to, provenance)
    const existing = this.relations.get(id)
    if (existing) return existing
    const relation: ObservationRelation = { id, kind: input.kind, from, to, confidence: input.confidence, provenance, why: input.why }
    this.relations.set(id, relation)
    return relation
  }

  /** Record that two readings cannot both be right. Nothing is averaged and nothing is dropped. */
  conflict(input: ConflictInput): ObservationConflict {
    const observationIds = [...new Set(input.observations.map(idOf))].sort()
    const id = conflictId(input.kind, input.what, observationIds)
    const existing = this.conflicts.get(id)
    if (existing) return existing
    const conflict: ObservationConflict = {
      id,
      observationIds,
      kind: input.kind,
      what: input.what,
      ...(input.magnitude !== undefined ? { magnitude: input.magnitude } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    }
    this.conflicts.set(id, conflict)
    return conflict
  }

  /** Name something that was looked for and not found. A named hole is worth more than silence. */
  unresolved(what: string, reason: string, status: UnresolvedObservation['status'], assetId?: string): UnresolvedObservation {
    const id = unresolvedId(what, assetId)
    const existing = this.gaps.get(id)
    if (existing) return existing
    const gap: UnresolvedObservation = { id, what, reason, status, ...(assetId !== undefined ? { assetId } : {}) }
    this.gaps.set(id, gap)
    return gap
  }

  get observationCount(): number {
    return this.observations.size
  }

  /** Every observation recorded so far, for an extractor that reasons about earlier ones. */
  snapshot(): SourceObservation[] {
    return [...this.observations.values()]
  }

  /**
   * Freeze the graph: canonical order, content hash, derived id, and a full
   * structural validation. Throws rather than sealing something inadmissible.
   */
  seal(): SourceObservationGraph {
    const draft = {
      schema: OBSERVATION_GRAPH_SCHEMA,
      schemaVersion: OBSERVATION_GRAPH_SCHEMA_VERSION,
      sourcePackageId: this.sourcePackageId,
      sourcePackageHash: this.sourcePackageHash,
      extractors: [...this.extractors.values()].map((e) => ({ name: e.name, version: e.version, kind: e.kind })).sort((a, b) => a.name.localeCompare(b.name)),
      coordinateFrames: [...this.frames.values()].sort((a, b) => a.id.localeCompare(b.id)),
      observations: [...this.observations.values()].sort((a, b) => a.id.localeCompare(b.id)),
      relations: [...this.relations.values()].sort((a, b) => a.id.localeCompare(b.id)),
      conflicts: [...this.conflicts.values()].sort((a, b) => a.id.localeCompare(b.id)),
      unresolved: [...this.gaps.values()].sort((a, b) => a.id.localeCompare(b.id)),
    } as const
    const contentHash = observationGraphContentHash(draft)
    const graph: SourceObservationGraph = { ...draft, id: graphId(this.sourcePackageId, contentHash), contentHash }
    const errors = errorsOnly(validateObservationGraph(graph, { checkIds: true }))
    if (errors.length > 0) throw new Error(`refusing to seal an inadmissible observation graph:\n${errors.map((e) => `  [${e.code}] ${e.subject}: ${e.message}`).join('\n')}`)
    return graph
  }

  private requireExtractor(handle: ExtractorHandle): void {
    const known = this.extractors.get(handle.name)
    if (!known || known.version !== handle.version) throw new Error(`extractor ${handle.name}@${handle.version} was not declared on this builder`)
  }

  private requireFrame(frame: SourceCoordinateFrame): SourceCoordinateFrame {
    const known = this.frames.get(frame.id)
    if (!known) throw new Error(`frame ${frame.id} was not declared on this builder`)
    return known
  }
}
