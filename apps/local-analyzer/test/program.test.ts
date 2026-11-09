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
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashesOf, runAnalysis } from '@buildapp/analysis-service'
import { LOCAL_ANALYZER_PROTOCOL } from '../src/program.js'
import type { LinkAnalysisSummary } from '@buildapp/analysis-service'
import { memoryByteCache } from '@buildapp/source-package'
import { FIXTURE_PROJECTS, fixturePageUrl, fixtureWiring } from '../fixture/fixture.js'
import { inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
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

/** `noIcu`: run as Android's runtime does — V8's behaviour without ICU (test/support/no-icu.cjs). */
const NO_ICU = ['--require', join(import.meta.dirname, 'support/no-icu.cjs')]

function host(url: string, options: { node?: string; noIcu?: boolean; onEvent?: (e: Event, child: unknown) => void } = {}): HostRun {
  return runHost({ dir: bundleDir, url, fixture: true, node: options.node ?? process.execPath, nodeArgs: options.noIcu ? NO_ICU : [], ...dirs(), onEvent: options.onEvent }) as HostRun
}

/**
 * The desktop's answer: `runAnalysis` from the sources with the external recogniser (005H) — its engine in this
 * process — as the bundle's launcher reads with it in a worker. Equal hashes say the two readers agreed label for label.
 */
const desktopHashes = async (code: string): Promise<Record<string, string>> => {
  const wiring = fixtureWiring()
  const recogniser = inlineRecogniser({ paths: workspaceAssetPaths() })
  try {
    const run = await runAnalysis({ kind: 'URL', url: fixturePageUrl(code) }, { adapters: wiring.adapters, deps: wiring.deps, cache: memoryByteCache(), recogniser })
    expect(run.result.recogniser?.crops ?? 0).toBeGreaterThan(0)
    return hashesOf(run.result)
  } finally {
    await recogniser.release()
  }
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

async function expectParity(code: string, node?: string, noIcu = false): Promise<HostResult> {
  const [desktop, result] = await Promise.all([desktopHashes(code), host(fixturePageUrl(code), { node, noIcu }).done])
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

  it('Sliverton (N7-P1): a refused attached body is delivered as the last valid model, every hash equal to the desktop', async () => {
    const result = await expectParity(FIXTURE_PROJECTS.sliverton)
    const summary = JSON.parse(readFileSync(join(result.outDir, 'result.json'), 'utf8')) as LinkAnalysisSummary
    expect(summary.preview.outcome).toBe('PARTIAL_3D_PREVIEW')
    // EXTERIOR-COMPLETE: one more material (the gate's, `mat-gate`) is defined before the rings: 21 → 22;
    // v3.51 C1b: the upper slab states the basis of its thickness in one more evidence command: 22 → 23.
    // What is refused is named by its id; the index only says where the program stopped.
    expect(summary.preview.partial?.failure).toMatchObject({ commandIndex: 23, type: 'createWallRing', id: 'ring-attached-0-0', codes: ['WALLS_OVERLAP'] })
    expect(summary.preview.built.wallRings).toBe(2)
    expect(summary.warningDetails.map((w) => w.code)).toContain('PARTIAL_3D_PREVIEW')
    expect((result.terminal as unknown as { summary: LinkAnalysisSummary }).summary.preview.outcome).toBe('PARTIAL_3D_PREVIEW')
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
    expect(hello.protocol).toBe(LOCAL_ANALYZER_PROTOCOL)
    expect(hello.runtime.node).toBe(process.version)
  })
})

describe('SHAPE-LIVE-01: the live source preview, as the phone receives it', () => {
  it('source events name a job-private copy of the exact bytes read, verified by their hash; the copies go with the run', async () => {
    let verified = 0
    let mismatched = 0
    const steps: string[] = []
    const { work: workDir, out } = dirs()
    const run = runHost({
      dir: bundleDir,
      url: fixturePageUrl(FIXTURE_PROJECTS.larchfield),
      fixture: true,
      node: process.execPath,
      nodeArgs: [],
      work: workDir,
      out,
      onEvent: (e: Event) => {
        if (e.type !== 'source') return
        const ev = (e as unknown as { event: { step: string; sheet: { byteHash: string; file: string | null } | null } }).event
        steps.push(ev.step)
        if (!ev.sheet?.file) return
        const f = join(workDir, ev.sheet.file)
        if (!existsSync(f)) return
        if (sha256(readFileSync(f)) === ev.sheet.byteHash) verified += 1
        else mismatched += 1
      },
    }) as HostRun
    const result = await run.done
    const types = result.events.map((x) => x.type)
    expect(types.filter((t) => t === 'source').length).toBeGreaterThan(3)
    // the first source event comes before the terminal one, and sheets before the solver
    expect(types.indexOf('source')).toBeLessThan(types.indexOf('done'))
    expect(steps.findIndex((s) => s === 'READING_DRAWING' || s === 'CONTENT_CHECK')).toBeLessThan(steps.indexOf('SOLVING'))
    const named = result.events.filter((x) => x.type === 'source').map((x) => (x as unknown as { event: { sheet: { file: string | null; byteHash: string } | null } }).event.sheet).filter((x): x is { file: string | null; byteHash: string } => !!x)
    expect(named.length).toBeGreaterThan(0)
    for (const sh of named) if (sh.file) expect(sh.file).toBe(`live/${sh.byteHash}`)
    expect(mismatched).toBe(0)
    expect(verified).toBeGreaterThan(0)
    expect(existsSync(join(result.workDir, 'live'))).toBe(false)
    expect(existsSync(join(result.workDir, 'bytes'))).toBe(false)
  }, 240_000)
})

describe('as on Android: V8 without ICU, the text adapter standing in for it', () => {
  it('Larchfield: every hash equal to the desktop runAnalysis', async () => {
    const result = await expectParity(FIXTURE_PROJECTS.larchfield, undefined, true)
    const hello = result.events[0] as unknown as { runtime: { text: string; collatorLocale: string } }
    expect(hello.runtime.text).toBe('embedded-tables')
    expect(hello.runtime.collatorLocale).toBe('none (no Intl)')
  })

  it('Holloway: every hash equal to the desktop runAnalysis', async () => {
    await expectParity(FIXTURE_PROJECTS.holloway, undefined, true)
  })

  it('with ICU present, the adapter stays out of the way', async () => {
    const result = await host(fixturePageUrl(FIXTURE_PROJECTS.larchfield)).done
    expect((result.events[0] as unknown as { runtime: { text: string } }).runtime.text).toBe('icu')
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
    // no delivery file; only the run's trace, which ends CANCELLED in the stage it was cancelled in, and what its phases cost
    expect(existsSync(result.outDir) ? readdirSync(result.outDir) : []).toEqual(['diagnostics'])
    expect(readdirSync(join(result.outDir, 'diagnostics'))).toEqual(['performance.json', 'trace.json'])
    const trace = JSON.parse(readFileSync(join(result.outDir, 'diagnostics', 'trace.json'), 'utf8')) as { outcome: string; entries: Array<{ stage: string; status: string }> }
    expect(trace.outcome).toBe('CANCELLED')
    expect(trace.entries.at(-1)).toMatchObject({ stage: 'ACQUIRING_SOURCE', status: 'CANCELLED' })
    expect((result.terminal as { diagnostics?: { files: string[] } }).diagnostics?.files).toEqual(['trace.json', 'performance.json'])
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

  it('a cancel while the analyzer computes lands at the next loop boundary, not when the computation ends', async () => {
    // From the metric pass on, the run is one long synchronous computation: the event loop does
    // not turn, so only the poll the loops make at their boundaries can see the cancel.
    let sent = false
    const events: Event[] = []
    const run = host(fixturePageUrl(FIXTURE_PROJECTS.larchfield), {
      onEvent: (e) => {
        events.push(e)
        const t = e.event as { phaseId?: string } | undefined
        if (!sent && e.type === 'telemetry' && t?.phaseId === 'METRIC_FRAMES') {
          sent = true
          run.cancel()
        }
      },
    })
    const result = await run.done
    expect(sent).toBe(true)
    expect(result.code).toBe(2)
    expect(result.terminal?.type).toBe('cancelled')
    const trace = JSON.parse(readFileSync(join(result.outDir, 'diagnostics', 'trace.json'), 'utf8')) as { outcome: string; entries: Array<{ stage: string; status: string }> }
    expect(trace.outcome).toBe('CANCELLED')
    expect(trace.entries.at(-1)?.status).toBe('CANCELLED')
    // in the stage it was sent from: polling only at stage boundaries would land it in the next one
    expect(trace.entries.at(-1)?.stage).toBe('EXTRACTING_OBSERVATIONS')
    // the runtime said it could, and every telemetry line before the end has a heartbeat one past the last
    const hello = events.find((e) => e.type === 'hello') as { capabilities?: string[] } | undefined
    expect(hello?.capabilities).toContain('control.poll')
    const seqs = events.filter((e) => e.type === 'telemetry').map((e) => (e.event as { heartbeatSeq: number }).heartbeatSeq)
    expect(seqs).toEqual(seqs.map((_, i) => i + 1))
    // what each phase cost is on the cancelled event too
    const phases = ((result.terminal as { metrics?: { phases?: Array<{ phaseId: string }> } }).metrics?.phases ?? []).map((p) => p.phaseId)
    expect(phases).toContain('METRIC_FRAMES')
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
    expect(result.terminal).toMatchObject({ type: 'failed', code: 'SOURCE_UNREACHABLE', failure: { code: 'SOURCE_UNREACHABLE', stage: 'ACQUIRING_SOURCE' } })
    // the diagnostics bundle names what failed and where, and carries the trace
    const diagnostics = JSON.parse(readFileSync(join(result.outDir, 'diagnostics', 'diagnostics.json'), 'utf8')) as { failure: { code: string }; trace: { outcome: string }; runtime: { node: string } }
    expect(diagnostics.failure.code).toBe('SOURCE_UNREACHABLE')
    expect(diagnostics.trace.outcome).toBe('FAILED')
    expect(diagnostics.runtime.node).toBe(process.version)
    expect(JSON.stringify(diagnostics)).not.toContain(result.workDir)
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

  it('Node 18 WITHOUT ICU (exactly the phone’s runtime, but on x86-64 Linux): both buildings equal to the desktop', async () => {
    await expectParity(FIXTURE_PROJECTS.larchfield, NODE18, true)
    await expectParity(FIXTURE_PROJECTS.holloway, NODE18, true)
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

/**
 * v3.51: the decoders that need WebAssembly, in the bundle as the phone runs it — a folder of files with no
 * `node_modules` anywhere above it. The WebP decoder used to resolve its `.wasm` in the package, so it started in a
 * checkout and never in the app: a publisher that serves WebP had no plan there, and no host test saw it.
 */
describe('the bundle decodes WebP and SVG where it runs', () => {
  const probe = join(scratch, 'decoder-probe.mjs')
  const check = (analyzer: string): { webp: boolean; svg: boolean; detail?: string } => {
    writeFileSync(probe, 'const m = await import(process.argv[2]); process.stdout.write(JSON.stringify(await m.decoderSelfCheck()))\n')
    const run = spawnSync(process.execPath, [probe, analyzer], { encoding: 'utf8' })
    expect(run.status).toBe(0)
    return JSON.parse(run.stdout) as { webp: boolean; svg: boolean; detail?: string }
  }

  it('lists libwebp\'s WebAssembly in the manifest the app installs from, with the bytes beside the bundle', () => {
    const manifest = JSON.parse(readFileSync(join(bundleDir, 'manifest.json'), 'utf8')) as { files: Record<string, { sha256: string; bytes: number }> }
    const listed = manifest.files['webp_dec.wasm']
    expect(listed).toBeDefined()
    expect(sha256(readFileSync(join(bundleDir, 'webp_dec.wasm')))).toBe(listed.sha256)
    expect(sha256(readFileSync(join(bundleDir, 'resvg.wasm')))).toBe(manifest.files['resvg.wasm']?.sha256)
  })

  it('decodes a WebP and rasterises an SVG from the installed folder alone', () => {
    expect(check(join(bundleDir, 'analyzer.mjs'))).toEqual({ webp: true, svg: true })
  })

  it('counter-case: the same bundle without the file beside it cannot (the state every earlier APK shipped in)', () => {
    const bare = join(scratch, 'bundle-without-webp')
    mkdirSync(bare, { recursive: true })
    copyFileSync(join(bundleDir, 'analyzer.mjs'), join(bare, 'analyzer.mjs'))
    const answer = check(join(bare, 'analyzer.mjs'))
    expect(answer.webp).toBe(false)
    expect(answer.svg).toBe(false)
    expect(answer.detail).toMatch(/webp_dec\.wasm/)
  })
})
