/**
 * The files one finished analysis is delivered as.
 *
 * The analyzer HTTP API stores these four texts per job and serves them; the
 * app's embedded local analyzer writes the same four into its job directory
 * and the phone imports the scene from there. Both call this one function, so
 * "the phone got the same bytes the server would have served" is a property of
 * the code: the scene text is the exact bundle whose sha256 the summary names.
 */
import { stableJson } from '@buildapp/source-common'
import { serializeModel } from '@buildapp/model'
import { summaryOf } from './result.js'
import type { LinkAnalysisSummary } from './result.js'
import type { AnalysisRun } from './run.js'

export type AnalysisFiles = {
  /** `LinkAnalysisSummary` as one JSON line: the result without candidate, model and scene. */
  summary: string
  /** The mobile scene bundle, byte for byte what `result.sceneSha256` names. */
  scene: string
  /** The CanonicalBuildingModel, as `serializeModel` writes it (`result.modelSha256`). */
  model: string
  /** The sealed ReconstructionCandidate, canonical JSON. */
  candidate: string
  parsed: LinkAnalysisSummary
}

export function analysisFilesOf(run: Pick<AnalysisRun, 'result' | 'sceneText'>): AnalysisFiles {
  const summary = summaryOf(run.result)
  return {
    parsed: summary,
    summary: `${JSON.stringify(summary)}\n`,
    scene: run.sceneText,
    model: serializeModel(run.result.model),
    candidate: `${stableJson(run.result.candidate)}\n`,
  }
}
