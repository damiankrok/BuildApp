/**
 * The OCR parity self-test (BUILDPLAN-ANALYZER-005H): the committed desktop answer (`src/self-test-expected.json`)
 * recomputed from the sources, then the BUILT bundle run as the phone runs it — `main.mjs --self-test ocr`, events on
 * descriptor 3, the control pipe on 4 — under this Node, without ICU, and under Node 18 when `LOCAL_ANALYZER_NODE18`
 * names one. Every run must give the same corpus hash and the same output hash: the same pixels read the same way.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MODEL, RECOGNISER_ID, WASM_FILE, inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
import { OCR_PARITY_CORPUS, OCR_PARITY_EXPECTED, cropsHash, ocrSelfTest, parityCorpus, readingsHash } from '../src/self-test.js'
import type { SelfTestRecord } from '../src/self-test.js'
// @ts-expect-error — plain ES modules without type declarations
import { bundleLocalAnalyzer } from '../build.mjs'

type Event = { type: string; [k: string]: unknown }

const scratch = mkdtempSync(join(tmpdir(), 'local-analyzer-self-test-'))
const bundleDir = join(scratch, 'bundle')
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
beforeAll(async () => {
  await bundleLocalAnalyzer(bundleDir, { fixture: false })
}, 120_000)

const NO_ICU = ['--require', join(import.meta.dirname, 'support/no-icu.cjs')]
let n = 0

/** `main.mjs --self-test ocr` with the phone's pipes; `cancelAfter` sends a cancel after that many progress events. */
function selfTest(options: { node?: string; nodeArgs?: string[]; cancelAfter?: number } = {}): Promise<{ code: number | null; events: Event[]; outDir: string }> {
  n += 1
  const outDir = join(scratch, `out-${n}`)
  const child = spawn(options.node ?? process.execPath, [...(options.nodeArgs ?? []), join(bundleDir, 'main.mjs'), '--self-test', 'ocr', '--job', `${n}`.padStart(32, '0'), '--out', outDir, '--events-fd', '3', '--control-fd', '4'], { stdio: ['ignore', 'inherit', 'inherit', 'pipe', 'pipe'] })
  const events: Event[] = []
  let buffer = ''
  let progress = 0
  const events3 = child.stdio[3] as NodeJS.ReadableStream
  const control = child.stdio[4] as NodeJS.WritableStream
  events3.setEncoding('utf8')
  events3.on('data', (chunk: string) => {
    buffer += chunk
    let nl
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      if (!line.trim()) continue
      const event = JSON.parse(line) as Event
      events.push(event)
      if (event.type === 'self-test-progress') {
        progress += 1
        if (progress === options.cancelAfter) control.write('cancel\n')
      }
    }
  })
  return new Promise((resolve) => child.on('exit', (code) => resolve({ code, events, outDir })))
}

const terminalOf = (events: Event[]): Event | undefined => events.find((e) => e.type === 'self-test' || e.type === 'failed' || e.type === 'cancelled')

function expectMatch(result: { code: number | null; events: Event[]; outDir: string }): SelfTestRecord {
  expect(result.code, JSON.stringify(terminalOf(result.events))).toBe(0)
  const record = (terminalOf(result.events) as unknown as { record: SelfTestRecord }).record
  expect(record).toMatchObject({
    kind: 'ocr-parity',
    parity: 'MATCH',
    recogniser: { id: OCR_PARITY_EXPECTED.recogniser, modelSha256: OCR_PARITY_EXPECTED.modelSha256 },
    wasmSha256: OCR_PARITY_EXPECTED.wasmSha256,
    corpus: { name: OCR_PARITY_CORPUS.name, version: OCR_PARITY_CORPUS.version, labels: OCR_PARITY_EXPECTED.labels, sha256: OCR_PARITY_EXPECTED.corpusSha256 },
    outputSha256: OCR_PARITY_EXPECTED.outputSha256,
    exact: OCR_PARITY_EXPECTED.exact,
  })
  expect(record.peakRssBytes).toBeGreaterThan(0)
  // the record on disk is the record on the pipe
  expect(JSON.parse(readFileSync(join(result.outDir, 'self-test.json'), 'utf8'))).toEqual(record)
  // progress counts every label once, forward
  // the worker says it is loading (done 0) before the first label; after that every label once, forward
  const done = result.events.filter((e) => e.type === 'self-test-progress' && (e.done as number) > 0).map((e) => e.done as number)
  expect(done).toEqual(done.map((_, i) => i + 1))
  expect(done.at(-1)).toBe(OCR_PARITY_EXPECTED.labels)
  return record
}

describe('the committed answer is what the sources give', () => {
  it('pins the recogniser the analysis uses', () => {
    expect(OCR_PARITY_EXPECTED.recogniser).toBe(RECOGNISER_ID)
    expect(OCR_PARITY_EXPECTED.modelSha256).toBe(MODEL.sha256)
  })

  it('the corpus: every seventh of the 672, drawn here, the same pixels every time', () => {
    const corpus = parityCorpus()
    expect(corpus).toHaveLength(Math.ceil(OCR_PARITY_CORPUS.of / OCR_PARITY_CORPUS.stride))
    expect(cropsHash(corpus)).toBe(OCR_PARITY_EXPECTED.corpusSha256)
    expect(cropsHash(parityCorpus())).toBe(OCR_PARITY_EXPECTED.corpusSha256)
  })

  it('in this process, with the engine inline: MATCH, the committed hashes and count', async () => {
    const paths = workspaceAssetPaths()
    const recogniser = inlineRecogniser({ paths })
    try {
      const record = await ocrSelfTest(recogniser, { wasmPath: paths.wasm })
      expect(record.parity).toBe('MATCH')
      expect(record.outputSha256).toBe(OCR_PARITY_EXPECTED.outputSha256)
      expect(readingsHash(record.readings)).toBe(OCR_PARITY_EXPECTED.outputSha256)
      expect(record.exact).toBe(OCR_PARITY_EXPECTED.exact)
    } finally {
      await recogniser.release()
    }
  }, 120_000)

  it('another output is a MISMATCH, never a MATCH', async () => {
    const paths = workspaceAssetPaths()
    const real = inlineRecogniser({ paths })
    const liar = { ...real, recognise: async (...args: Parameters<typeof real.recognise>) => (await real.recognise(...args)).map((r, i) => (i === 3 ? { ...r, greedy: { ...r.greedy, text: `${r.greedy.text}1` } } : r)) }
    try {
      expect((await ocrSelfTest(liar, { wasmPath: paths.wasm })).parity).toBe('MISMATCH')
    } finally {
      await real.release()
    }
  }, 120_000)
})

describe('the bundle, as the phone runs it', () => {
  it('ships the worker, the WebAssembly, the model and the self-test beside the analyzer — and the analyzer carries none of them', () => {
    for (const f of ['main.mjs', 'analyzer.mjs', 'ocr-worker.mjs', 'ocr-self-test.mjs', WASM_FILE, `models/${MODEL.file}`]) expect(existsSync(join(bundleDir, f)), f).toBe(true)
    const analyzer = readFileSync(join(bundleDir, 'analyzer.mjs'), 'utf8')
    expect(analyzer).not.toContain(OCR_PARITY_CORPUS.name)
    expect(analyzer).not.toContain('InferenceSession')
  })

  it(`main.mjs --self-test ocr: MATCH (${process.version})`, async () => {
    const record = expectMatch(await selfTest())
    expect(record.runtime.node).toBe(process.version)
  }, 120_000)

  it('without ICU, as Android’s runtime: MATCH', async () => {
    expectMatch(await selfTest({ nodeArgs: NO_ICU }))
  }, 120_000)

  it('a cancel on the control pipe stops it: exit 2, one cancelled event, no record', async () => {
    const result = await selfTest({ cancelAfter: 3 })
    expect(result.code).toBe(2)
    expect(result.events.filter((e) => ['self-test', 'failed', 'cancelled'].includes(e.type)).map((e) => e.type)).toEqual(['cancelled'])
    expect(existsSync(join(result.outDir, 'self-test.json'))).toBe(false)
    expect(result.events.filter((e) => e.type === 'self-test-progress').length).toBeLessThan(OCR_PARITY_EXPECTED.labels)
  }, 120_000)

  it('refuses unusable arguments: exit 3', () => {
    const r = spawnSync(process.execPath, [join(bundleDir, 'main.mjs'), '--self-test', 'ocr', '--job', 'nope', '--out', '/tmp/x'], { encoding: 'utf8' })
    expect(r.status).toBe(3)
    const other = spawnSync(process.execPath, [join(bundleDir, 'main.mjs'), '--self-test', 'something-else', '--job', 'a'.repeat(32), '--out', '/tmp/x'], { encoding: 'utf8' })
    expect(other.status).toBe(3)
  })
})

const NODE18 = process.env.LOCAL_ANALYZER_NODE18
describe.skipIf(!NODE18)('under Node 18 — the runtime version in the APK (LOCAL_ANALYZER_NODE18)', () => {
  it('Node 18: MATCH, the desktop’s hashes', async () => {
    expect(expectMatch(await selfTest({ node: NODE18 })).runtime.node).toMatch(/^v18\./)
  })

  it('Node 18 WITHOUT ICU (the phone’s runtime, on x86-64 Linux): MATCH', async () => {
    expectMatch(await selfTest({ node: NODE18, nodeArgs: NO_ICU }))
  })
})
