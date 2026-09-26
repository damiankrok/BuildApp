/**
 * Where jobs and their results live.
 *
 * `AnalysisJobStore` is the interface; `FileJobStore` keeps each job in a
 * directory of its own under the data root:
 *
 *   jobs/<jobId>/job.json        the status record
 *   jobs/<jobId>/result.json     the summary           (on success)
 *   jobs/<jobId>/scene.json      the scene bundle      (on success)
 *   jobs/<jobId>/model.json      the model             (on success)
 *   jobs/<jobId>/candidate.json  the sealed candidate  (on success)
 *   jobs/<jobId>/work/           scratch while running (source bytes); removed when the job ends
 *
 * Every write goes to a temporary file and is renamed into place, so a reader
 * never sees half a record and a crash never leaves one. A job id reaches a
 * path only after it matched `JOB_ID_PATTERN`; no other string ever does.
 *
 * What is NOT here: source images after a job ends, the source package, any
 * reference model, benchmark or sealed candidate. A result is what the
 * analyzer made, and the hashes that identify what it made it from.
 */
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import type { ReadStream } from 'node:fs'
import { join } from 'node:path'
import { isTerminal } from '@buildapp/analysis-service'
import { JOB_ID_PATTERN, failJob } from './job.js'
import type { JobRecord } from './job.js'

export type ResultPart = 'summary' | 'scene' | 'model' | 'candidate'

export type ResultFiles = { summary: string; scene: string; model: string; candidate: string }

export interface AnalysisJobStore {
  create(job: JobRecord): Promise<void>
  get(jobId: string): Promise<JobRecord | null>
  /** Apply `change` to the stored record; null when there is none. Changes to one job are applied in call order. */
  update(jobId: string, change: (job: JobRecord) => JobRecord): Promise<JobRecord | null>
  saveResult(jobId: string, files: ResultFiles): Promise<void>
  loadResult(jobId: string, part: ResultPart): Promise<string | null>
  /** A stream of a stored part and its size, for serving it without reading it whole. */
  openResult(jobId: string, part: ResultPart): Promise<{ stream: ReadStream; size: number } | null>
  list(): Promise<JobRecord[]>
  delete(jobId: string): Promise<void>
  /** A scratch directory that belongs to this job alone. */
  workspace(jobId: string): Promise<string>
  clearWorkspace(jobId: string): Promise<void>
}

const FILE_OF: Record<ResultPart, string> = { summary: 'result.json', scene: 'scene.json', model: 'model.json', candidate: 'candidate.json' }

const checkId = (jobId: string): string => {
  if (!JOB_ID_PATTERN.test(jobId)) throw new Error('invalid job id')
  return jobId
}

export class FileJobStore implements AnalysisJobStore {
  private readonly records = new Map<string, JobRecord>()
  private readonly chains = new Map<string, Promise<unknown>>()
  private tmpCounter = 0

  constructor(private readonly root: string) {}

  private dirOf(jobId: string): string {
    return join(this.root, 'jobs', checkId(jobId))
  }

  private async writeAtomic(path: string, text: string): Promise<void> {
    const tmp = `${path}.${process.pid}.${(this.tmpCounter += 1)}.tmp`
    await writeFile(tmp, text, 'utf8')
    await rename(tmp, path)
  }

  /** Serialise the writes to one job, so a late progress update can never overwrite a later one. */
  private serial<T>(jobId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(jobId) ?? Promise.resolve()
    const next = previous.then(task, task)
    this.chains.set(
      jobId,
      next.catch(() => undefined),
    )
    return next
  }

  /**
   * Load what a previous process left. A job that was running when it stopped
   * cannot be resumed — its worker is gone — so it is marked failed, honestly,
   * and its scratch is removed.
   */
  async init(now: () => string = () => new Date().toISOString()): Promise<{ loaded: number; interrupted: number }> {
    const jobsDir = join(this.root, 'jobs')
    await mkdir(jobsDir, { recursive: true })
    let interrupted = 0
    for (const name of await readdir(jobsDir)) {
      if (!JOB_ID_PATTERN.test(name)) continue
      let record: JobRecord
      try {
        record = JSON.parse(await readFile(join(jobsDir, name, 'job.json'), 'utf8')) as JobRecord
      } catch {
        await rm(join(jobsDir, name), { recursive: true, force: true })
        continue
      }
      if (record.jobId !== name) continue
      if (!isTerminal(record.status)) {
        record = failJob(record, { code: 'SERVICE_RESTARTED', message: 'the service restarted while this analysis was running; submit it again' }, now())
        await this.writeAtomic(join(jobsDir, name, 'job.json'), `${JSON.stringify(record)}\n`)
        interrupted += 1
      }
      await rm(join(jobsDir, name, 'work'), { recursive: true, force: true })
      this.records.set(name, record)
    }
    return { loaded: this.records.size, interrupted }
  }

  async create(job: JobRecord): Promise<void> {
    const dir = this.dirOf(job.jobId)
    await mkdir(dir, { recursive: true })
    this.records.set(job.jobId, job)
    await this.serial(job.jobId, () => this.writeAtomic(join(dir, 'job.json'), `${JSON.stringify(job)}\n`))
  }

  async get(jobId: string): Promise<JobRecord | null> {
    return JOB_ID_PATTERN.test(jobId) ? (this.records.get(jobId) ?? null) : null
  }

  async update(jobId: string, change: (job: JobRecord) => JobRecord): Promise<JobRecord | null> {
    if (!JOB_ID_PATTERN.test(jobId)) return null
    return this.serial(jobId, async () => {
      const current = this.records.get(jobId)
      if (!current) return null
      const next = change(current)
      if (next === current) return current
      this.records.set(jobId, next)
      await this.writeAtomic(join(this.dirOf(jobId), 'job.json'), `${JSON.stringify(next)}\n`)
      return next
    })
  }

  async saveResult(jobId: string, files: ResultFiles): Promise<void> {
    const dir = this.dirOf(jobId)
    await this.serial(jobId, async () => {
      for (const part of ['scene', 'model', 'candidate', 'summary'] as const) await this.writeAtomic(join(dir, FILE_OF[part]), files[part])
    })
  }

  async loadResult(jobId: string, part: ResultPart): Promise<string | null> {
    if (!JOB_ID_PATTERN.test(jobId) || !this.records.has(jobId)) return null
    try {
      return await readFile(join(this.dirOf(jobId), FILE_OF[part]), 'utf8')
    } catch {
      return null
    }
  }

  async openResult(jobId: string, part: ResultPart): Promise<{ stream: ReadStream; size: number } | null> {
    if (!JOB_ID_PATTERN.test(jobId) || !this.records.has(jobId)) return null
    const path = join(this.dirOf(jobId), FILE_OF[part])
    try {
      const { size } = await stat(path)
      return { stream: createReadStream(path), size }
    } catch {
      return null
    }
  }

  async list(): Promise<JobRecord[]> {
    return [...this.records.values()]
  }

  async delete(jobId: string): Promise<void> {
    if (!JOB_ID_PATTERN.test(jobId)) return
    await this.serial(jobId, async () => {
      this.records.delete(jobId)
      await rm(this.dirOf(jobId), { recursive: true, force: true })
    })
    this.chains.delete(jobId)
  }

  async workspace(jobId: string): Promise<string> {
    const dir = join(this.dirOf(jobId), 'work')
    await mkdir(dir, { recursive: true })
    return dir
  }

  async clearWorkspace(jobId: string): Promise<void> {
    await rm(join(this.dirOf(jobId), 'work'), { recursive: true, force: true })
  }
}
