/**
 * The local analyzer's entry, in process: it is `runAnalysis` and nothing
 * else — the same hashes and the same delivery files as the desktop call — and
 * it never leaves the fetched source bytes behind, however the run ends.
 */
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { analysisFilesOf, anySignal, hashesOf, runAnalysis } from '@buildapp/analysis-service'
import { memoryByteCache } from '@buildapp/source-package'
import { bytesDirOf, localWiring, memorySample, parseProcStatus, runLocalAnalysis } from '../src/index.js'
import { FIXTURE_PROJECTS, fixturePageUrl, fixtureWiring } from '../fixture/fixture.js'
import { productionAdapters } from '../../analyzer-api/src/wiring.js'

const scratch = mkdtempSync(join(tmpdir(), 'local-analyzer-test-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
let n = 0
const workDir = (): string => join(scratch, `job-${(n += 1)}`)
const now = (): Date => new Date('2026-01-01T00:00:00Z')

describe('runLocalAnalysis is the production pipeline', () => {
  it('gives the desktop runAnalysis hashes and delivery files, byte for byte', async () => {
    const url = fixturePageUrl(FIXTURE_PROJECTS.larchfield)
    const wiring = fixtureWiring()
    const desktop = await runAnalysis({ kind: 'URL', url }, { adapters: wiring.adapters, deps: wiring.deps, cache: memoryByteCache(), now, jobId: 'parity' })
    const local = await runLocalAnalysis({ url, workDir: workDir(), wiring: fixtureWiring(), now, jobId: 'parity' })
    expect(hashesOf(local.run.result)).toEqual(hashesOf(desktop.result))
    const files = analysisFilesOf(desktop)
    expect(local.files.scene).toBe(files.scene)
    expect(local.files.model).toBe(files.model)
    expect(local.files.candidate).toBe(files.candidate)
    expect(local.files.summary).toBe(files.summary)
    expect(local.run.result.verification.replay).toBe('BYTE_IDENTICAL')
    expect(local.run.result.vision.mode).toBe('DETERMINISTIC_ONLY')
  })

  it('reports where the time went, phase by phase, and the memory the process used', async () => {
    const local = await runLocalAnalysis({ url: fixturePageUrl(FIXTURE_PROJECTS.larchfield), workDir: workDir(), wiring: fixtureWiring() })
    const t = local.timings
    for (const v of [t.acquisitionMs, t.observationMs, t.metricExtractionMs, t.reconstructionMs, t.compileMs, t.verificationMs]) expect(v).toBeGreaterThanOrEqual(0)
    const sum = t.acquisitionMs + t.observationMs + t.metricExtractionMs + t.reconstructionMs + t.compileMs + t.verificationMs
    // each phase is rounded on its own; the partition can be off the total by the rounding alone
    expect(Math.abs(sum - t.totalMs)).toBeLessThanOrEqual(6)
    expect(local.memory.peakRssBytes).toBeGreaterThanOrEqual(local.memory.rssBytes > 0 ? 1 : 0)
    expect(local.memory.peakRssBytes).toBeGreaterThan(0)
  })

  it('registers exactly the publishers the analyzer API registers in production, and no vision provider', () => {
    expect(localWiring().adapters.map((a) => a.id)).toEqual(productionAdapters().map((a) => a.id))
    expect(Object.keys(localWiring())).toEqual(['adapters'])
  })
})

describe('the fetched source bytes never outlive the run', () => {
  it('are removed after a completed run', async () => {
    const dir = workDir()
    await runLocalAnalysis({ url: fixturePageUrl(FIXTURE_PROJECTS.larchfield), workDir: dir, wiring: fixtureWiring() })
    expect(existsSync(bytesDirOf(dir))).toBe(false)
  })

  it('are removed after a failed run', async () => {
    const dir = workDir()
    await expect(runLocalAnalysis({ url: fixturePageUrl('no-such-project'), workDir: dir, wiring: fixtureWiring() })).rejects.toMatchObject({ code: 'SOURCE_UNREACHABLE' })
    expect(existsSync(bytesDirOf(dir))).toBe(false)
  })

  it('are removed after a cancelled run, and the cancel reaches a download in flight', async () => {
    const dir = workDir()
    const controller = new AbortController()
    const run = runLocalAnalysis({
      url: fixturePageUrl(FIXTURE_PROJECTS.hangs),
      workDir: dir,
      wiring: fixtureWiring(),
      signal: controller.signal,
      progress: (e) => {
        // once the page is in and the drawings are being asked for (they never answer), cancel
        if (e.stage === 'ACQUIRING_SOURCE' && /fetched/.test(e.detail ?? '') && !controller.signal.aborted) setTimeout(() => controller.abort(new DOMException('cancelled', 'AbortError')), 50)
      },
    })
    await expect(run).rejects.toMatchObject({ code: 'CANCELLED' })
    expect(existsSync(bytesDirOf(dir))).toBe(false)
    expect(existsSync(dir) ? readdirSync(dir) : []).toEqual([])
  })
})

describe('anySignal: AbortSignal.any where the runtime has it, the same semantics where it does not', () => {
  for (const native of [true, false]) {
    it(`aborts with the first input's reason (${native ? 'native' : 'fallback'})`, () => {
      if (native && typeof (AbortSignal as unknown as { any?: unknown }).any !== 'function') return
      const a = new AbortController()
      const b = new AbortController()
      const any = anySignal([a.signal, b.signal], native)
      expect(any.aborted).toBe(false)
      b.abort('second')
      expect(any.aborted).toBe(true)
      expect(any.reason).toBe('second')
      a.abort('first')
      expect(any.reason).toBe('second')
    })

    it(`is aborted at once when an input already is (${native ? 'native' : 'fallback'})`, () => {
      if (native && typeof (AbortSignal as unknown as { any?: unknown }).any !== 'function') return
      const a = new AbortController()
      a.abort('early')
      const any = anySignal([new AbortController().signal, a.signal], native)
      expect(any.aborted).toBe(true)
      expect(any.reason).toBe('early')
    })
  }

  it('returns a single input unchanged', () => {
    const a = new AbortController()
    expect(anySignal([a.signal], false)).toBe(a.signal)
  })
})

describe('memory, as the kernel counts it', () => {
  it('reads VmRSS and the high-water mark VmHWM from /proc/<pid>/status', () => {
    const status = 'Name:\tnode\nVmPeak:\t 999 kB\nVmHWM:\t  204800 kB\nVmRSS:\t  102400 kB\n'
    expect(parseProcStatus(status)).toEqual({ rssBytes: 102400 * 1024, peakRssBytes: 204800 * 1024 })
    expect(memorySample(() => status)).toMatchObject({ rssBytes: 102400 * 1024, peakRssBytes: 204800 * 1024, peakSource: 'VmHWM' })
  })

  it('falls back to getrusage where /proc is not readable', () => {
    const sample = memorySample(() => {
      throw new Error('no /proc here')
    })
    expect(sample.peakSource).toBe('getrusage')
    expect(sample.peakRssBytes).toBeGreaterThan(0)
  })
})
