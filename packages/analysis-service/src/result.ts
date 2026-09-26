/**
 * What one link analysis hands back.
 *
 * Two shapes: the full result (candidate, model and scene included), and the
 * summary a client polls and shows — the same record without the three heavy
 * members, which a client downloads separately and checks against the hashes
 * the summary carries.
 *
 * Nothing here is truth. There is no reference model, no benchmark score, no
 * "expected" anything: a result says what the analyzer made of the sources
 * and how sure it is, and nothing about how close that is to any answer.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { MobileSceneBundle } from '@buildapp/mobile-scene'
import type { ReconstructionCandidate } from '@buildapp/reconstruction'

/** Whether a vision provider contributed, stated rather than implied. */
export type VisionMode = 'DETERMINISTIC_ONLY' | 'LIVE_PROVIDER' | 'REPLAYED_GRAPH'

export type LinkAnalysisSummary = {
  schema: 'buildapp.link-analysis-result'
  schemaVersion: '1.0.0'
  jobId: string | null
  sourceUrl: string
  canonicalUrl: string
  title: string
  label: string
  modelId: string
  publisher: string
  adapter: { id: string; version: string }
  sourcePackageId: string
  sourcePackageHash: string
  observationGraphHash: string
  metricEvidenceHash: string
  candidateHash: string
  modelHash: string
  /** sha256 of the model JSON a client downloads. */
  modelSha256: string
  sceneContentHash: string
  /** sha256 of the exact scene bytes a client downloads; a client refuses anything else. */
  sceneSha256: string
  sceneBytes: number
  counts: {
    assets: number
    assetsByDocument: Record<string, number>
    observations: number
    frames: number
    metricEvidence: number
    callouts: number
    commands: number
    masses: number
    openings: number
    rooms: number
    balconies: number
    terraces: number
    railings: number
    chimneys: number
    rooflights: number
    meshes: number
    triangles: number
  }
  quality: {
    /** Solved features by the level they earned: L0 topology only, L1 metric, L2 metric and corroborated. */
    levels: { L0: number; L1: number; L2: number }
    byFamily: Record<string, Record<string, number>>
  }
  /** What the analyzer could not settle, named. */
  unresolved: Array<{ what: string; reason: string; status: string }>
  warnings: string[]
  vision: { mode: VisionMode; provider: string | null; attempted: number; accepted: number }
  verification: {
    replay: 'BYTE_IDENTICAL'
    residuals: number
    residualsOutsideTolerance: number
    closure: { exteriorErrors: number; exteriorFindings: number; interiorFindings: number }
  }
  analyzer: { service: string; solver: string }
  startedAt: string
  completedAt: string
}

export type LinkAnalysisResult = LinkAnalysisSummary & {
  candidate: ReconstructionCandidate
  model: CanonicalBuildingModel
  scene: MobileSceneBundle
}

export function summaryOf(result: LinkAnalysisResult): LinkAnalysisSummary {
  const { candidate: _c, model: _m, scene: _s, ...summary } = result
  return summary
}
