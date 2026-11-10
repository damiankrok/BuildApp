/**
 * A job's status record, and the pure transitions that move it.
 *
 * The record is what `GET /v1/analyses/:id` returns (plus links). Every change
 * to it is one of the functions below, so the rules — stages only move
 * forward, progress never decreases, a finished job never changes again — are
 * stated once and tested once.
 */
import { randomBytes } from 'node:crypto'
import { ANALYSIS_STAGES, STAGE_LABELS, isTerminal } from '@buildapp/analysis-service'
import type { AnalysisProgress, AnalysisStage, AnalysisStatus, AnalysisTelemetry, DescribingEvent, LinkAnalysisSummary } from '@buildapp/analysis-service'

export type StageState = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED'

export type StageRecord = { id: AnalysisStage; label: string; state: StageState; startedAt?: string; completedAt?: string }

/**
 * Why a job failed, as the client sees it: the service's code and sentence and,
 * since BUILDAPP-03Y2G, the solver's own reason code, the stage and step it
 * stopped in, a heading and flat counts — never a path or a stack.
 */
export type JobError = {
  code: string
  message: string
  reasonCode?: string
  stage?: string
  substage?: string
  title?: string
  diagnostics?: Record<string, number | string | boolean>
}

/** What the status record says about a finished analysis; the full summary is `/result`. */
export type JobResultBrief = {
  title: string
  label: string
  candidateHash: string
  modelHash: string
  sceneSha256: string
  sceneContentHash: string
  sceneBytes: number
  quality: { L0: number; L1: number; L2: number }
  unresolved: number
  warnings: number
  vision: string
}

export type JobRecord = {
  schema: 'buildapp.analysis-job'
  schemaVersion: '1.0.0'
  jobId: string
  status: AnalysisStatus
  progress: number
  stage: { id: AnalysisStage; label: string; index: number; count: number; fraction: number; detail?: string } | null
  stages: StageRecord[]
  sourceUrl: string
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  error: JobError | null
  result: JobResultBrief | null
  /**
   * What the analyzer is doing inside its stage, by counts (005A), with when
   * its last heartbeat arrived. Present while a job runs and telemetry has
   * arrived; dropped when the job ends.
   */
  activity?: JobActivityRecord
  /**
   * v3.53.1: present from the moment the house is being read as a whole from the page's pictures — the phase, why it
   * started, and the pictures actually being interpreted: for each, the original the page published (address, hash,
   * size) and what was sent to the reader (a smaller JPEG: its own hash, size and byte count). It stays on the
   * finished record. There are no marks on these pictures: the reader returns a description, not positions.
   */
  describing?: JobDescribingRecord
}

export type JobDescribingRecord = {
  phase: DescribingEvent['phase']
  startedAt: string
  updatedAt: string
  after: DescribingEvent['after']
  provider: DescribingEvent['provider']
  picturesOnPage: number
  pictures: Array<{ number: number; kind: string; assetId: string; original: { url: string | null; sha256: string | null; widthPx: number; heightPx: number }; sent: { sha256: string; mediaType: string; widthPx: number; heightPx: number; bytes: number } }>
}

export type JobActivityRecord = Omit<AnalysisTelemetry, 'kind' | 'stage' | 'stageIndex' | 'stageCount' | 'timestamp' | 'overall'> & { heartbeatAt: string }

export const JOB_ID_PATTERN = /^[0-9a-f]{32}$/

/** 128 random bits. Unguessable, and says nothing about when or by whom a job was made. */
export const newJobId = (): string => randomBytes(16).toString('hex')

export function newJob(jobId: string, sourceUrl: string, now: string): JobRecord {
  return {
    schema: 'buildapp.analysis-job',
    schemaVersion: '1.0.0',
    jobId,
    status: 'QUEUED',
    progress: 0,
    stage: null,
    stages: ANALYSIS_STAGES.map((id) => ({ id, label: STAGE_LABELS[id], state: 'PENDING' })),
    sourceUrl,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    error: null,
    result: null,
  }
}

export function applyProgress(job: JobRecord, event: AnalysisProgress, now: string): JobRecord {
  if (isTerminal(job.status)) return job
  const stages = job.stages.map((s, i): StageRecord => {
    if (i < event.stageIndex) return s.state === 'DONE' ? s : { ...s, state: 'DONE', startedAt: s.startedAt ?? now, completedAt: s.completedAt ?? now }
    if (i === event.stageIndex) return s.state === 'RUNNING' ? s : { ...s, state: 'RUNNING', startedAt: s.startedAt ?? now }
    return s
  })
  return {
    ...job,
    status: event.stage,
    progress: Math.max(job.progress, event.progress),
    stage: { id: event.stage, label: STAGE_LABELS[event.stage], index: event.stageIndex, count: event.stageCount, fraction: event.stageFraction, ...(event.detail ? { detail: event.detail } : {}) },
    stages,
    startedAt: job.startedAt ?? now,
    updatedAt: now,
  }
}

/** Record a telemetry event: where the analyzer is inside its stage, and that it is alive. A finished job never changes. */
export function applyTelemetry(job: JobRecord, event: AnalysisTelemetry, now: string): JobRecord {
  if (isTerminal(job.status)) return job
  const { kind: _kind, stage: _stage, stageIndex: _index, stageCount: _count, timestamp: _timestamp, overall: _overall, ...activity } = event
  return { ...job, activity: { ...activity, heartbeatAt: now }, updatedAt: now }
}

/** Record what the described path is doing and which pictures it reads. A finished job never changes. */
export function applyDescribing(job: JobRecord, event: DescribingEvent, now: string): JobRecord {
  if (isTerminal(job.status)) return job
  return {
    ...job,
    describing: {
      phase: event.phase,
      startedAt: job.describing?.startedAt ?? now,
      updatedAt: now,
      after: event.after,
      provider: event.provider,
      picturesOnPage: event.picturesOnPage,
      pictures: event.pictures.map((p) => ({ number: p.number, kind: p.kind, assetId: p.assetId, original: { url: p.sourceUrl, sha256: p.byteHash, widthPx: p.originalWidthPx, heightPx: p.originalHeightPx }, sent: { sha256: p.sentSha256, mediaType: p.sentMediaType, widthPx: p.widthPx, heightPx: p.heightPx, bytes: p.sentBytes } })),
    },
    updatedAt: now,
  }
}

const withoutActivity = (job: JobRecord): JobRecord => {
  const { activity: _activity, ...rest } = job
  return rest
}

export function completeJob(job: JobRecord, summary: LinkAnalysisSummary, now: string): JobRecord {
  if (isTerminal(job.status)) return job
  return {
    ...withoutActivity(job),
    status: 'COMPLETED',
    progress: 1,
    stage: null,
    stages: job.stages.map((s) => ({ ...s, state: 'DONE', startedAt: s.startedAt ?? now, completedAt: s.completedAt ?? now })),
    startedAt: job.startedAt ?? now,
    completedAt: now,
    updatedAt: now,
    result: {
      title: summary.title,
      label: summary.label,
      candidateHash: summary.candidateHash,
      modelHash: summary.modelHash,
      sceneSha256: summary.sceneSha256,
      sceneContentHash: summary.sceneContentHash,
      sceneBytes: summary.sceneBytes,
      quality: summary.quality.levels,
      unresolved: summary.unresolved.length,
      warnings: summary.warnings.length,
      vision: summary.vision.mode,
    },
  }
}

export function failJob(job: JobRecord, error: JobError, now: string): JobRecord {
  if (isTerminal(job.status)) return job
  const cancelled = error.code === 'CANCELLED'
  return {
    ...withoutActivity(job),
    status: cancelled ? 'CANCELLED' : 'FAILED',
    stage: null,
    stages: job.stages.map((s) => (s.state === 'RUNNING' ? { ...s, state: cancelled ? 'CANCELLED' : 'FAILED', completedAt: now } : s)),
    completedAt: now,
    updatedAt: now,
    error,
  }
}
