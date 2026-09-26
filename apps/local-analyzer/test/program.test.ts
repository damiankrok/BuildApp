/**
 * The BUILT bundle, run as the phone runs it: a separate Node process started
 * with the program's arguments, events on descriptor 3 and the control pipe
 * on 4 (`scripts/run-host.mjs`, the same protocol the Android service speaks).
 *
 * Parity (the stage's tests A and B): the delivery files the bundle writes
 * carry exactly the hashes the desktop pipeline — `runAnalysis` from the
 * TypeScript sources, in this process — produces for the same sealed input,
 * for two different synthetic buildings reached through a URL.
 *
 * When `LOCAL_ANALYZER_NODE18` names a Node 18 binary (CI installs 18.20.4,
 * the version of the runtime in the APK), the same bundle is also run under
 * it and must give the same hashes again.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashesOf, runAnalysis } from '@buildapp/analysis-service'
import type { LinkAnalysisSummary } from '@buildapp/analysis-service'
import { memoryByteCache } from '@buildapp/source-package'
import { FIXTURE_PROJECTS, fixturePageUrl, fixtureWiring } from '../fixture/fixture.js'
// @ts-expect-error — plain ES modules without type declarations
import { bundleLocalAnalyzer } from '../build.mjs'
// @ts-expect-error — plain ES modules without type declarations
import { runHost } from '../scripts/run-host.mjs'

type Event = { type: string; [k: string]: unknown }
type HostResult = { code: number | null; events: Event[]; workDir: string; outDir: string; terminal: Event | null }
type HostRun = { done: Promise<HostResult>; cancel: () => void; closeControl: () => void }

const scratch = mkdtempSync(join(tmpdir(), 'local-analyzer-program-'))
const bundleDir = join(scratch, 'bundle')
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
beforeAll(async () => {
  await bundleLocalAnalyzer(bundleDir, { fixture: true })
}, 120_000)

let n = 0
const dirs = (): { work: string; out: string } => {
  n += 1
  return { work: join(scratch, `work-${n}`), out: join(scratch, `out-${n}`) }
}
const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex')

function host(url: string, options: { node?: string; onEvent?: (e: Event, child: unknown) => void } = {}): HostRun {
  return runHost({ dir: bundleDir, url, fixture: true, node: options.node ?? process.execPath, ...dirs(), onEvent: options.onEvent }) as HostRun
}

const desktopHashes = async (code: string): Promise<Record<string, string>> => {
  const wiring = fixtureWiring()
  const run = await runAnalysis({ kind: 'URL', url: fixturePageUrl(code) }, { adapters: wiring.adapters, deps: wiring.deps, cache: memoryByteCache() })
  return hashesOf(run.result)
}

const summaryHashes = (s: LinkAnalysisSummary): Record<string, string> => ({
  sourcePackageHash: s.sourcePackageHash,
  observationGraphHash: s.observationGraphHash,
  metricEvidenceHash: s.metricEvidenceHash,
  candidateHash: s.candidateHash,
  modelHash: s.modelHash,
  sceneContentHash: s.sceneContentHash,
  sceneSha256: s.sceneSha256,
})

async function expectParity(code: string, node?: string): Promise<HostResult> {
  const [desktop, result] = await Promise.all([desktopHashes(code), host(fixturePageUrl(code), { node }).done])
  expect(result.code, JSON.stringify(result.terminal)).toBe(0)
  expect(result.terminal?.type).toBe('done')
  const summary = JSON.parse(readFileSync(join(result.outDir, 'result.json'), 'utf8')) as LinkAnalysisSummary
  expect(summaryHashes(summary)).toEqual(desktop)
  // the files are the bytes the hashes name
  expect(sha256(readFileSync(join(result.outDir, 'scene.json')))).toBe(summary.sceneSha256)
  expect(sha256(readFileSync(join(result.outDir, 'model.json')))).toBe(summary.modelSha256)
  expect(summary.verification.replay).toBe('BYTE_IDENTICAL')
  // and the fetched bytes are gone
  expect(existsSync(join(result.workDir, 'bytes'))).toBe(false)
  return result
}

describe('the bundle, run as the phone runs it, gives the desktop pipeline’s building', () => {
  it('Larchfield: every hash equal to the desktop runAnalysis', async () => {
    const result = await expectParity(FIXTURE_PROJECTS.larchfield)
    const done = result.terminal as unknown as { summary: LinkAnalysisSummary; metrics: { timings: Record<string, number>; memory: { peakRssBytes: number } }; sources: { assets: unknown[]; pageHash: string } }
    expect(done.metrics.timings.totalMs).toBeGreaterThan(0)
    expect(done.metrics.memory.peakRssBytes).toBeGreaterThan(0)
    expect(done.sources.assets.length).toBe(done.summary.counts.assets)
    expect(done.sources.pageHash).toMatch(/^[0-9a-f]{64}$/)
    // and it is the very scene the analyzer API served for this link (captured in BUILDAPP-03Y1)
    const served = readFileSync(join(import.meta.dirname, '../../android/app/src/test/resources/analyzer-contract/scene.json'))
    expect(readFileSync(join(result.outDir, 'scene.json')).equals(served)).toBe(true)
  })

  it('Holloway: a second building, every hash equal to the desktop runAnalysis', async () => {
    await expectParity(FIXTURE_PROJECTS.holloway)
  })

  it('reports hello first, progress that only moves forward, then exactly one terminal event', async () => {
    const result = await host(fixturePageUrl(FIXTURE_PROJECTS.larchfield)).done
    const types = result.events.map((e) => e.type)
    expect(types[0]).toBe('hello')
    expect(types.filter((t) => t === 'done' || t === 'failed' || t === 'cancelled')).toEqual(['done'])
    expect(types[types.length - 1]).toBe('done')
    const progress = result.events.filter((e) => e.type === 'progress').map((e) => (e.event as { progress: number }).progress)
    for (let i = 1; i < progress.length; i++) expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1])
    const hello = result.events[0] as unknown as { protocol: number; runtime: { node: string } }
    expect(hello.protocol).toBe(1)
    expect(hello.runtime.node).toBe(process.version)
  })
})

describe('the program stops when it is told to, and leaves nothing', () => {
  it('a cancel on the control pipe stops a download in flight: exit 2, one cancelled event, no bytes left', async () => {
    let sent = false
    const run = host(fixturePageUrl(FIXTURE_PROJECTS.hangs), {
      onEvent: (e) => {
        const detail = (e.event as { detail?: string } | undefined)?.detail ?? ''
        if (!sent && e.type === 'progress' && /fetched/.test(detail)) {
          sent = true
          setTimeout(() => run.cancel(), 50)
        }
      },
    })
    const result = await run.done
    expect(result.code).toBe(2)
    expect(result.terminal?.type).toBe('cancelled')
    expect(existsSync(join(result.workDir, 'bytes'))).toBe(false)
    expect(existsSync(result.outDir) ? readdirSync(result.outDir) : []).toEqual([])
  })

  it('the control pipe closing (the app went away) counts as a cancel', async () => {
    let closed = false
    const run = host(fixturePageUrl(FIXTURE_PROJECTS.hangs), {
      onEvent: (e) => {
        if (!closed && e.type === 'progress' && /fetched/.test(((e.event as { detail?: string }).detail ?? ''))) {
          closed = true
          setTimeout(() => run.closeControl(), 50)
        }
      },
    })
    const result = await run.done
    expect(result.code).toBe(2)
    expect(result.terminal?.type).toBe('cancelled')
  })

  it('refuses unusable arguments before it does anything', () => {
    const r = spawnSync(process.execPath, [join(bundleDir, 'main.mjs'), '--job', 'not-hex', '--url', 'https://x.test/', '--work', '/tmp/a', '--out', '/tmp/b'], { encoding: 'utf8' })
    expect(r.status).toBe(3)
    expect(r.stdout).toBe('')
    const relative = spawnSync(process.execPath, [join(bundleDir, 'main.mjs'), '--job', 'a'.repeat(32), '--url', 'https://x.test/', '--work', 'rel', '--out', '/tmp/b'], { encoding: 'utf8' })
    expect(relative.status).toBe(3)
  })

  it('reports a source it cannot fetch as a named failure: exit 1, SOURCE_UNREACHABLE', async () => {
    const result = await host(fixturePageUrl('no-such-project')).done
    expect(result.code).toBe(1)
    expect(result.terminal).toMatchObject({ type: 'failed', code: 'SOURCE_UNREACHABLE' })
  })
})

const NODE18 = process.env.LOCAL_ANALYZER_NODE18
describe.skipIf(!NODE18)('under Node 18 — the runtime version in the APK (LOCAL_ANALYZER_NODE18)', () => {
  it('is Node 18', () => {
    expect(spawnSync(NODE18!, ['--version'], { encoding: 'utf8' }).stdout.trim()).toMatch(/^v18\./)
  })

  it('Larchfield: every hash equal to the desktop runAnalysis under Node 22', async () => {
    const result = await expectParity(FIXTURE_PROJECTS.larchfield, NODE18)
    expect((result.events[0] as unknown as { runtime: { node: string } }).runtime.node).toMatch(/^v18\./)
  })

  it('Holloway: every hash equal to the desktop runAnalysis under Node 22', async () => {
    await expectParity(FIXTURE_PROJECTS.holloway, NODE18)
  })

  it('cancel works without AbortSignal.any (added in Node 20.3)', async () => {
    let sent = false
    const run = host(fixturePageUrl(FIXTURE_PROJECTS.hangs), {
      node: NODE18,
      onEvent: (e) => {
        if (!sent && e.type === 'progress' && /fetched/.test(((e.event as { detail?: string }).detail ?? ''))) {
          sent = true
          setTimeout(() => run.cancel(), 50)
        }
      },
    })
    const result = await run.done
    expect(result.code).toBe(2)
    expect(result.terminal?.type).toBe('cancelled')
  })
})
