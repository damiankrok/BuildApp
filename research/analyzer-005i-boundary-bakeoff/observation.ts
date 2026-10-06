/**
 * RESEARCH-ONLY observation schema (BUILDPLAN-ANALYZER-005I Track B, boundary bake-off).
 *
 * NOT production architecture. Nothing in `packages/` or `apps/` may import this file; it exists so that BuildPlan's
 * own `source-cv` boundary observations and three external vision systems can be scored on the same footing. Every
 * coordinate is in the SOURCE FRAME's pixels (origin top-left, x right, y down), i.e. the decoded raster the
 * production decoder returns for the frame's variant bytes.
 *
 * The same schema is written by the Python provider runners (providers/common.py).
 */
export type ObservationKind = 'LINE_SEGMENT' | 'WALL_CONTINUATION' | 'REGION_MASK' | 'CLOSED_REGION'

export type SegmentGeometry = { type: 'SEGMENT'; a: [number, number]; b: [number, number]; thicknessPx?: number }
export type PolygonGeometry = { type: 'POLYGON'; rings: Array<Array<[number, number]>> }
/** A binary mask kept OUTSIDE the repository (it is rendered from publisher pixels); only its hash and summary travel. */
export type MaskGeometry = { type: 'MASK'; file: string; sha256: string; widthPx: number; heightPx: number; areaPx: number; bbox: [number, number, number, number]; components: number }

export type BoundaryObservationCandidate = {
  id: string
  provider: 'SOURCE_CV' | 'DEEPLSD' | 'ELSED' | 'MOBILESAM'
  /** The provider configuration (e.g. `DEEPLSD-MD`, `MSAM-BOX`); scored separately, never merged. */
  configId: string
  sourceFrameId: string
  kind: ObservationKind
  geometry: SegmentGeometry | PolygonGeometry | MaskGeometry
  /** The provider's own score when it has one (ELSED salience, SAM predicted IoU, a support ratio); null otherwise. */
  confidence: number | null
  /** Which layer / function produced it and anything it carries (gap class, piece kind, band thickness, …). */
  provenance: Record<string, unknown>
  /** What was done to the pixels before the provider saw them. */
  preprocessing: string
  /** SHA-256 of the provider config (and, for a learned model, of its checkpoint). */
  configHash: string
}

export const RESEARCH_ONLY = 'BUILDPLAN-ANALYZER-005I research-only observation schema; not production architecture'
