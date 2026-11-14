/**
 * s5311 evidence questions: the replay path, scoring and local verification, on SYNTHETIC pictures made here.
 * No private file is read, nothing is sent, and no ledger or book is touched. Run explicitly (research/ is outside the
 * repository's vitest include):
 *   npx vitest run -c research/source-to-model/s5311/evidence-questions/vitest.config.ts
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HouseReaderUnavailable } from '@buildapp/source-vision'
import { askAll, checkSeal, encodePng, fixtureReader, loadRequest, makeFixture, sha256 } from './harness.js'
import type { FixtureKind, MetricEvidence, Observation, QuestionSet } from './harness.js'
import { executeRun, loadPayloads, writePayloads } from './runner.js'

const repoRoot = resolve(import.meta.dirname, '../../../..')

/** A 200 x 120 sheet: a wall with a glazed stretch, and a dimension line with two end ticks at x 20 and x 160. */
function syntheticSheet(): Uint8Array {
  const w = 200
  const h = 120
  const data = new Uint8ClampedArray(w * h * 4).fill(255)
  const ink = (x: number, y: number, v = 0): void => {
    const i = (y * w + x) * 4
    data[i] = data[i + 1] = data[i + 2] = v
  }
  for (let y = 10; y < 80; y += 1) for (let x = 20; x < 26; x += 1) if (y < 30 || y > 60 || x === 20 || x === 25) ink(x, y)
  for (let x = 20; x <= 160; x += 1) ink(x, 100, 90)
  for (const t of [20, 160]) for (let d = -4; d <= 4; d += 1) ink(t + d, 100 - d)
  return encodePng({ width: w, height: h, data })
}

let dir: string
let set: QuestionSet
let questionsPath: string
let sealPath: string
let payloads: string
let ledgerPath: string
let ledgerBytes: string
let books: string
const fixtures: Partial<Record<FixtureKind, string>> = {}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 's5311-eq-'))
  const bytes = syntheticSheet()
  set = {
    schema: 'buildapp.evidence-questions',
    version: 1,
    sheets: { syn: { packageId: 'synthetic', assetId: 'asset-syn', byteHash: sha256(bytes), mediaType: 'image/png', width: 200, height: 120 } },
    questions: [
      { id: 'Q1', sheet: 'syn', kind: 'CLASS', pointer: 'CROP', region: { x0: 18, y0: 30, x1: 28, y1: 60 }, classes: ['WALL', 'GLAZING', 'GATE', 'OPEN_GAP', 'UNKNOWN'], extraFields: [], prompt: 'What fills the stretch?', scoredFields: ['answerClass'], reference: { answerClass: 'GLAZING' }, verification: { method: 'NONE' } },
      { id: 'Q2', sheet: 'syn', kind: 'CLASS', pointer: 'MASK', region: { x0: 100, y0: 10, x1: 190, y1: 40 }, classes: ['BUILDING_OR_WALL', 'LOGO_OR_WATERMARK', 'UNKNOWN'], extraFields: ['relation'], prompt: 'Building or logo?', scoredFields: ['answerClass', 'relation'], reference: { answerClass: 'LOGO_OR_WATERMARK', relation: 'SEPARATE' }, verification: { method: 'NONE' } },
      { id: 'Q3', sheet: 'syn', kind: 'DIMENSION', pointer: 'CROP', axis: 'HORIZONTAL', region: { x0: 14, y0: 90, x1: 166, y1: 110 }, classes: ['DIMENSION_LINE', 'OTHER', 'UNKNOWN'], extraFields: ['spanFrom', 'spanTo'], prompt: 'The number on the line?', scoredFields: ['answerClass', 'printedText', 'spanFrom', 'spanTo'], reference: { answerClass: 'DIMENSION_LINE', printedText: '1400', unit: 'cm', spanFrom: 'LEFT_OUTER_FACE', spanTo: 'RIGHT_OUTER_FACE' }, verification: { method: 'CHAIN_SPAN' } },
    ],
  }
  const text = `${JSON.stringify(set, null, 1)}\n`
  questionsPath = join(dir, 'questions.json')
  sealPath = join(dir, 'questions.seal.json')
  writeFileSync(questionsPath, text)
  writeFileSync(sealPath, JSON.stringify({ sha256: sha256(text) }))
  // 140 px between the ticks at 10 cm/px is 1400 cm; 1100 would be 7.86 cm/px, 21 % off
  const metric: MetricEvidence = {
    chains: [{ id: 'chain-syn', assetId: 'asset-syn', axis: 'HORIZONTAL', baselinePx: 100, ticksPx: [20, 160] }],
    coordinateRegistrations: [{ id: 'reg-syn', assetId: 'asset-syn', plane: 'PLAN_XZ', metresPerPixelX: 0.1, metresPerPixelY: 0.1 }],
    calloutRings: [],
  }
  writeFileSync(join(dir, 'metric-evidence.json'), JSON.stringify(metric))
  payloads = join(dir, 'payloads')
  const { requests } = writePayloads({ set, questionsSha256: sha256(text), originals: { syn: bytes }, sheets: { syn: { packageDir: null, metricEvidence: join(dir, 'metric-evidence.json') } }, out: payloads, repoRoot })
  for (const kind of ['all-correct', 'wrong-hint', 'all-unknown'] as FixtureKind[]) {
    fixtures[kind] = join(dir, `${kind}.json`)
    writeFileSync(fixtures[kind] as string, JSON.stringify(makeFixture(set, sha256(text), requests, kind)))
  }
  ledgerPath = join(dir, 'spend-ledger.json')
  ledgerBytes = JSON.stringify({ schema: 'buildapp.ai-spend-ledger', limitUsd: 5, entries: [{ countedUsd: 1.25 }] }, null, 1)
  writeFileSync(ledgerPath, ledgerBytes)
  books = join(dir, 'books')
})

afterAll(() => {
  // the temporary directory is left for the OS; nothing in it is private
})

const replay = async (kind: FixtureKind) => {
  const record = await executeRun({ mode: 'replay', payloads, questionsPath, sealPath, out: join(dir, `run-${kind}`), repoRoot, fixtures: fixtures[kind], books, ledger: ledgerPath, log: () => {} })
  return { record, byId: new Map((record.observations ?? []).map((o) => [o.requestId, o] as [string, Observation])) }
}

describe('s5311 evidence questions — replay', () => {
  it('B and C carry the same question text and schema; C adds one derived picture with its transform', () => {
    const { requests } = loadPayloads(payloads, sha256(readFileSync(questionsPath, 'utf8')))
    for (const q of set.questions) {
      const b = requests.find((r) => r.id === `${q.id}-B`)
      const c = requests.find((r) => r.id === `${q.id}-C`)
      expect(b && c).toBeTruthy()
      expect(c?.text).toBe(b?.text)
      expect(c?.schema).toEqual(b?.schema)
      expect(b?.pictures.map((p) => p.role)).toEqual(['ORIGINAL'])
      expect(c?.pictures.map((p) => p.role)).toEqual(['ORIGINAL', q.pointer])
      expect(c?.pictures[0].sha256).toBe(set.sheets.syn.byteHash)
    }
  })

  it('all-correct answers are CORRECT, and the dimension literal is VERIFIED by the chain', async () => {
    const { record, byId } = await replay('all-correct')
    expect(record.exitCode).toBe(0)
    expect(record.summary?.byVariant.B.CORRECT).toBe(3)
    expect(record.summary?.byVariant.C.CORRECT).toBe(3)
    for (const v of ['B', 'C']) {
      expect(byId.get(`Q3-${v}`)?.verifiedOnOriginal.status).toBe('VERIFIED')
      expect(byId.get(`Q1-${v}`)?.verifiedOnOriginal.status).toBe('UNVERIFIED')
      expect(byId.get(`Q1-${v}`)?.evidenceBox?.overlapsReference).toBe(true)
      expect(byId.get(`Q1-${v}`)?.evidenceBox?.insideImage).toBe(true)
    }
  })

  it('a deliberately wrong hint is scored WRONG and is NOT verified: 1100 contradicts the chain', async () => {
    const { byId } = await replay('wrong-hint')
    for (const v of ['B', 'C']) {
      expect(byId.get(`Q1-${v}`)?.score.result).toBe('WRONG')
      expect(byId.get(`Q1-${v}`)?.verifiedOnOriginal.status).not.toBe('VERIFIED')
      const q3 = byId.get(`Q3-${v}`)
      expect(q3?.score.result).toBe('WRONG')
      expect(q3?.score.fields.printedText).toBe('WRONG')
      expect(q3?.verifiedOnOriginal.status).toBe('CONTRADICTED')
      expect(byId.get(`Q2-${v}`)?.score.result).toBe('CORRECT')
    }
  })

  it('UNKNOWN is never counted correct', async () => {
    const { record } = await replay('all-unknown')
    for (const v of ['B', 'C'] as const) {
      expect(record.summary?.byVariant[v].CORRECT).toBe(0)
      expect(record.summary?.byVariant[v].UNKNOWN).toBe(3)
      expect(record.summary?.byVariant[v].VERIFIED).toBe(0)
    }
  })

  it('other bytes are a FIXTURE_MISS, never an answer about another picture', async () => {
    const sealed = sha256(readFileSync(questionsPath, 'utf8'))
    const { requests, metricBySheet } = loadPayloads(payloads, sealed)
    const altered = requests.map((r) => {
      const one = new Uint8Array(r.bytes[1])
      one[one.length - 20] ^= 0xff
      return { ...r, bytes: { ...r.bytes, 1: one } }
    })
    const fixture = JSON.parse(readFileSync(fixtures['all-correct'] as string, 'utf8'))
    const run = askAll({ set, requests: altered, reader: fixtureReader(fixture), model: 'fixture', metricBySheet })
    await expect(run).rejects.toBeInstanceOf(HouseReaderUnavailable)
    await expect(askAll({ set, requests: altered, reader: fixtureReader(fixture), model: 'fixture', metricBySheet })).rejects.toMatchObject({ reason: 'FIXTURE_MISS' })
  })

  it('a picture changed on disk is refused before anything is asked, and so is an unsealed question set', () => {
    const { manifest } = loadPayloads(payloads, sha256(readFileSync(questionsPath, 'utf8')))
    const r = manifest.requests[1]
    expect(() => loadRequest(r, () => new Uint8Array([1, 2, 3]))).toThrow(/PAYLOAD_ALTERED/)
    expect(() => checkSeal(readFileSync(questionsPath, 'utf8').replace('1400', '1100'), JSON.parse(readFileSync(sealPath, 'utf8')))).toThrow(/QUESTIONS_NOT_SEALED/)
  })

  it('replay appends nothing to any ledger and opens no books, even when it is handed both', async () => {
    await replay('all-correct')
    await replay('wrong-hint')
    await replay('all-unknown')
    expect(readFileSync(ledgerPath, 'utf8')).toBe(ledgerBytes)
    expect(existsSync(books) ? readdirSync(books) : []).toEqual([])
  })

  it('live refuses without a key before anything is asked or booked', async () => {
    const record = await executeRun({ mode: 'live', payloads, questionsPath, sealPath, out: join(dir, 'run-live-nokey'), repoRoot, apiKey: '', model: 'claude-sonnet-5-5', books, ledger: ledgerPath, maxUsd: 0.5, log: () => {} })
    expect(record.code).toBe('NO_CREDENTIALS')
    expect(record.exitCode).toBe(3)
    expect(readFileSync(ledgerPath, 'utf8')).toBe(ledgerBytes)
    expect(existsSync(books) ? readdirSync(books) : []).toEqual([])
  })

  it('live with a stand-in client (no network): reserves, settles, books one campaign entry, and caches answers', async () => {
    const liveLedger = join(dir, 'live-ledger.json')
    writeFileSync(liveLedger, ledgerBytes)
    const liveBooks = join(dir, 'live-books')
    const fixture = JSON.parse(readFileSync(fixtures['all-correct'] as string, 'utf8'))
    let sent = 0
    const createClient = async () => ({
      messages: {
        create: async (body: Record<string, unknown>) => {
          sent += 1
          // answer the question this request carries, as the fixture recorded it
          const text = JSON.stringify(body)
          const answer = Object.values(fixture.answers as Record<string, { questionId: string; evidencePicture: number }>).find((a) => text.includes(`Question ${a.questionId}.`) && (text.match(/Picture \d:/g) ?? []).length === a.evidencePicture)
          return { content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn', usage: { input_tokens: 2000, output_tokens: 300 } }
        },
      },
    })
    const options = { mode: 'live' as const, payloads, questionsPath, sealPath, out: join(dir, 'run-live'), repoRoot, apiKey: 'test-key-not-real', model: 'claude-haiku-5-5', books: liveBooks, ledger: liveLedger, maxUsd: 5, createClient, log: () => {} }
    const record = await executeRun(options)
    expect(record.exitCode).toBe(0)
    expect(sent).toBe(6)
    expect(record.summary?.byVariant.B.CORRECT).toBe(3)
    const ledger = JSON.parse(readFileSync(liveLedger, 'utf8'))
    expect(ledger.entries).toHaveLength(2)
    expect(ledger.entries[1].stage).toBe('S5311 evidence questions (SDK)')
    expect(ledger.entries[1].countedUsd).toBeCloseTo(6 * (2000 * 0.1 + 300 * 0.5) / 1e6, 6)
    // the same run again is answered from the cache: nothing is sent and nothing more is booked
    const again = await executeRun(options)
    expect(again.exitCode).toBe(0)
    expect(sent).toBe(6)
    expect(JSON.parse(readFileSync(liveLedger, 'utf8')).entries).toHaveLength(2)
  })
})
