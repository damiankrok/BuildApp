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
import type { AnalysisProgress, AnalysisStage, AnalysisStatus, LinkAnalysisSummary } from '@buildapp/analysis-service'

export type StageState = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED'

export type StageRecord = { id: AnalysisStage; label: string; state: StageState; startedAt?: string; completedAt?: string }

export type JobError = { code: string; message: string }

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
}

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

export function completeJob(job: JobRecord, summary: LinkAnalysisSummary, now: string): JobRecord {
  if (isTerminal(job.status)) return job
  return {
    ...job,
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
    ...job,
    status: cancelled ? 'CANCELLED' : 'FAILED',
    stage: null,
    stages: job.stages.map((s) => (s.state === 'RUNNING' ? { ...s, state: cancelled ? 'CANCELLED' : 'FAILED', completedAt: now } : s)),
    completedAt: now,
    updatedAt: now,
    error,
  }
}
