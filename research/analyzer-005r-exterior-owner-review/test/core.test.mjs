/*
 * core.test.mjs — T3–T6 on the review rules (node --test). Synthetic pack only; no publisher picture is read.
 *   node --test research/analyzer-005r-exterior-owner-review/test/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPack } from '../tool/validate-labels.mjs'

const require = createRequire(import.meta.url)
const core = require('../tool/review-core.js')
const sha = require('../tool/sha256.js')
const HERE = dirname(fileURLToPath(import.meta.url))
const { queue, queueSha } = loadPack('synthetic')
const real = loadPack('real')
const HUMAN = { humanAction: true }
const q = (pred) => queue.questions.find(pred)
const pergolaA = q((x) => x.featureClass === 'PERGOLA' && x.projectEditionId === 'synthetic:edition-a')
const pergolaB = q((x) => x.featureClass === 'PERGOLA' && x.projectEditionId === 'synthetic:edition-b')
const sceneA = q((x) => x.kind === 'SCENE_SCOPE' && x.lineageGroup === 'lg-syn-house')
const local = (x, h = x.anchorByteHash) => ({ ...HUMAN, viewingMode: 'LOCAL_BYTES_HASH_MATCHED', reviewedByteHash: h })
const example = () => readFileSync(join(HERE, '..', 'examples', 'example-labels-SYNTHETIC.json'), 'utf8')

test('pure SHA-256 equals the platform digest', async () => {
  for (const s of ['', 'abc', 'ąę'.repeat(100), 'x'.repeat(1000)]) {
    const bytes = new TextEncoder().encode(s)
    const d = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex')
    assert.equal(sha.sha256Hex(bytes), d)
  }
})

test('queue integrity: both packs hash to their recorded SHA-256; a byte change is caught', async () => {
  assert.ok((await core.checkQueue(queue, queueSha)).ok)
  assert.ok((await core.checkQueue(real.queue, real.queueSha)).ok)
  const bad = JSON.parse(JSON.stringify(real.queue))
  bad.questions[0].featureClass = 'CARPORT'
  assert.deepEqual((await core.checkQueue(bad, real.queueSha)).errors, ['QUEUE_HASH_MISMATCH'])
})

test('T4 the blind queue carries no phase-2 key, URL, claim or B1 status', () => {
  for (const pack of [real.queue, queue]) {
    const hits = JSON.stringify(pack).match(/https?:|publisher|b1Scene|b1Edition|strictRecount|caption|viewHint|projectPageUrl|channel|TECHNICALLY_CORROBORATED|PUBLISHER_CLAIM|pageAccess|productionFeatures/gi)
    assert.equal(hits, null)
  }
})

test('T3 no answer without an explicit human action; nothing is pre-filled', () => {
  const s = core.newState(queue, queueSha)
  assert.ok(Object.values(s.labels).every((l) => l.status === 'UNREVIEWED' && l.phase1 === null && l.reviewerOrigin === null))
  assert.deepEqual(core.answerPhase1(s, queue, pergolaA.questionId, { answer: 'PRESENT' }, { viewingMode: 'LOCAL_BYTES_HASH_MATCHED', reviewedByteHash: pergolaA.anchorByteHash }).errors, ['HUMAN_ACTION_REQUIRED'])
  const out = JSON.parse(core.exportJSON(s, queue))
  assert.equal(out.counts.UNREVIEWED, queue.questions.length)
  assert.ok(out.labels.every((l) => l.phase1 === null))
})

test('T3 NOT_SHOWN / CANNOT_TELL stay what they are; sub-answers only with PRESENT', () => {
  const s = core.newState(queue, queueSha)
  for (const a of ['NOT_SHOWN', 'CANNOT_TELL']) {
    assert.ok(core.answerPhase1(s, queue, pergolaA.questionId, { answer: a }, local(pergolaA)).ok)
    assert.equal(s.labels[pergolaA.questionId].phase1.answer, a)
    assert.equal(s.labels[pergolaA.questionId].status, 'REVIEWED_VISUAL')
  }
  assert.ok(core.answerPhase1(s, queue, pergolaA.questionId, { answer: 'ABSENT', cover: 'OPEN_MEMBERS' }, local(pergolaA)).errors[0].includes('COVER_NOT_ALLOWED'))
  assert.ok(core.answerPhase1(s, queue, sceneA.questionId, { answer: 'PRESENT' }, local(sceneA)).errors[0].includes('ANSWER_OUT_OF_VOCABULARY'))
  assert.ok(core.answerPhase1(s, queue, pergolaA.questionId, { answer: 'MAYBE' }, local(pergolaA)).errors[0].includes('ANSWER_OUT_OF_VOCABULARY'))
})

test('T5 region normalisation and refusal of malformed regions; notes cannot carry URLs', () => {
  const s = core.newState(queue, queueSha)
  assert.ok(core.answerPhase1(s, queue, pergolaA.questionId, { answer: 'PRESENT', region: [0.1, 0.2, 0.5, 0.9] }, local(pergolaA)).ok)
  for (const r of [[0.5, 0.2, 0.1, 0.9], [0, 0, 1.2, 1], [0.1234, 0, 1, 1], [0, 0, 1], [NaN, 0, 1, 1]])
    assert.ok(!core.answerPhase1(s, queue, pergolaA.questionId, { answer: 'PRESENT', region: r }, local(pergolaA)).ok, JSON.stringify(r))
  assert.ok(!core.answerPhase1(s, queue, pergolaA.questionId, { answer: 'PRESENT', notes: 'see https://x.y/z.jpg' }, local(pergolaA)).ok)
})

test('T2 bytes of another edition never unlock a question, even one pixel apart', () => {
  const s = core.newState(queue, queueSha)
  const r = core.answerPhase1(s, queue, pergolaB.questionId, { answer: 'PRESENT' }, local(pergolaB, pergolaA.anchorByteHash))
  assert.deepEqual(r.errors, ['SOURCE_IMAGE_UNAVAILABLE'])
  const m = core.matchFiles(queue, [{ sha256: pergolaA.anchorByteHash }, { sha256: pergolaA.anchorByteHash }, { sha256: 'f'.repeat(64) }])
  assert.deepEqual(Object.keys(m.byImage), [pergolaA.imageId])
  assert.equal(m.duplicates, 1)
  assert.equal(m.unmatched, 1)
  // an accepted re-encoding of the same picture of the same edition does unlock it
  const variant = pergolaA.acceptedByteHashes.find((h) => h !== pergolaA.anchorByteHash)
  assert.ok(core.answerPhase1(s, queue, pergolaA.questionId, { answer: 'PRESENT' }, local(pergolaA, variant)).ok)
})

test('T4 seal freezes phase 1; phase 2 needs a seal and never overwrites phase 1', async () => {
  const s = core.newState(queue, queueSha)
  core.answerPhase1(s, queue, pergolaA.questionId, { answer: 'PRESENT' }, local(pergolaA))
  assert.ok(core.answerPhase2(s, queue, pergolaA.questionId, { technicalEvidence: 'TECHNICAL_SHOWS', evidenceSource: 'OTHER' }, HUMAN).errors[0].startsWith('NOT_SEALED'))
  assert.ok((await core.seal(s, queue, HUMAN)).ok)
  assert.ok(core.answerPhase1(s, queue, pergolaA.questionId, { answer: 'ABSENT' }, local(pergolaA)).errors[0].startsWith('SEALED'))
  assert.ok(core.answerPhase2(s, queue, pergolaB.questionId, { technicalEvidence: 'NO_TECHNICAL_EVIDENCE' }, HUMAN).errors[0].startsWith('NO_BLIND_ANSWER'))
  assert.ok(core.answerPhase2(s, queue, pergolaA.questionId, { technicalEvidence: 'TECHNICAL_SHOWS' }, HUMAN).errors[0].includes('EVIDENCE_SOURCE_REQUIRED'))
  assert.ok(core.answerPhase2(s, queue, pergolaA.questionId, { technicalEvidence: 'TECHNICAL_DOES_NOT_SHOW', evidenceSource: 'ELEVATION_IN_PACK' }, HUMAN).ok)
  const l = s.labels[pergolaA.questionId]
  assert.equal(l.phase1.answer, 'PRESENT')
  assert.equal(l.conflict, true)
  assert.equal(l.status, 'TECHNICALLY_CROSSCHECKED')
  core.answerPhase1(s, queue, sceneA.questionId, { answer: 'EXTERIOR' }, local(sceneA)) // refused: sealed
  assert.equal(s.labels[sceneA.questionId].status, 'UNREVIEWED')
})

test('scene questions: source context only, never TECHNICALLY_CROSSCHECKED', async () => {
  const s = core.newState(queue, queueSha)
  core.answerPhase1(s, queue, sceneA.questionId, { answer: 'EXTERIOR' }, local(sceneA))
  await core.seal(s, queue, HUMAN)
  assert.ok(!core.answerPhase2(s, queue, sceneA.questionId, { technicalEvidence: 'TECHNICAL_SHOWS', evidenceSource: 'OTHER' }, HUMAN).ok)
  assert.ok(core.answerPhase2(s, queue, sceneA.questionId, { sourceContext: 'DISAGREES' }, HUMAN).ok)
  assert.equal(s.labels[sceneA.questionId].status, 'REVIEWED_VISUAL')
  assert.equal(s.labels[sceneA.questionId].conflict, true)
  assert.equal(s.labels[sceneA.questionId].phase1.answer, 'EXTERIOR')
})

test('T5 export is deterministic and round-trips; the SYNTHETIC example (written by Python) validates in JS', async () => {
  const r = await core.importLabels(example(), queue, queueSha)
  assert.ok(r.ok, JSON.stringify(r.errors))
  assert.equal(core.exportJSON(r.state, queue), example())
  const csv = core.exportCSV(r.state, queue)
  assert.equal(csv, core.exportCSV(r.state, queue))
  assert.equal(csv.trim().split('\n').length, queue.questions.length + 1)
})

test('T5/T6 import refuses tampering, forgery, reordering of anchors and smuggled content', async () => {
  const base = JSON.parse(example())
  const mut = []
  const m = (name, f) => { const d = JSON.parse(JSON.stringify(base)); f(d); mut.push([name, d]) }
  const L = (d, pred) => d.labels.find(pred)
  m('blind answer changed after seal', (d) => { L(d, (l) => l.featureClass === 'CARPORT').phase1.answer = 'PRESENT' })
  m('unreviewed promoted to ABSENT', (d) => { const l = L(d, (l) => l.status === 'UNREVIEWED'); l.status = 'REVIEWED_VISUAL'; l.phase1 = { answer: 'ABSENT' } })
  m('CANNOT_TELL promoted to PRESENT', (d) => { L(d, (l) => l.phase1 && l.phase1.answer === 'CANNOT_TELL').phase1.answer = 'PRESENT' })
  m('answer moved to the other edition', (d) => { const a = L(d, (l) => l.projectEditionId === 'synthetic:edition-a' && l.featureClass === 'PERGOLA'); const b = L(d, (l) => l.projectEditionId === 'synthetic:edition-b' && l.featureClass === 'PERGOLA'); b.projectEditionId = a.projectEditionId; b.anchorByteHash = a.anchorByteHash })
  m('reviewed bytes of the other edition', (d) => { const b = L(d, (l) => l.projectEditionId === 'synthetic:edition-b' && l.featureClass === 'PERGOLA'); b.reviewedByteHash = L(d, (l) => l.projectEditionId === 'synthetic:edition-a' && l.featureClass === 'PERGOLA').anchorByteHash })
  m('origin claims a real OWNER on the synthetic pack', (d) => { L(d, (l) => l.phase1).reviewerOrigin = 'OWNER_LOCAL_REVIEW' })
  m('metric value smuggled', (d) => { L(d, (l) => l.phase1).metricAuthority = 'SOURCE_EXACT' })
  m('extra key with an image', (d) => { L(d, (l) => l.phase1).image = 'data:image/png;base64,AAAA' })
  m('URL in notes', (d) => { L(d, (l) => l.phase1).phase1.notes = 'http://example.org' })
  m('conflict flag cleared', (d) => { L(d, (l) => l.conflict === true).conflict = false })
  m('status inflated', (d) => { L(d, (l) => l.status === 'REVIEWED_VISUAL').status = 'TECHNICALLY_CROSSCHECKED' })
  m('phase 2 without seal', (d) => { d.phase1Seal = null })
  m('wrong queue hash', (d) => { d.queueSha256 = '0'.repeat(64) })
  m('duplicate question', (d) => { d.labels.push(d.labels[0]) })
  m('missing question', (d) => { d.labels.pop() })
  m('counts edited', (d) => { d.counts.conflicts = 0 })
  for (const [name, d] of mut) {
    const r = await core.importLabels(JSON.stringify(d), queue, queueSha)
    assert.ok(!r.ok, name)
  }
  // reordering rows is not tampering: the importer re-sorts to queue order
  const re = JSON.parse(JSON.stringify(base)); re.labels.reverse()
  assert.ok((await core.importLabels(JSON.stringify(re), queue, queueSha)).ok)
  // a synthetic labels file can never be loaded into the real pack
  assert.ok(!(await core.importLabels(example(), real.queue, real.queueSha)).ok)
})

test('audit fixes: NO_TECHNICAL_EVIDENCE is not a cross-check; host-like notes refused; CSV never starts a formula', async () => {
  const s = core.newState(queue, queueSha)
  assert.ok(!core.answerPhase1(s, queue, pergolaA.questionId, { answer: 'PRESENT', notes: 'cdn1.archon.pl/x/y' }, local(pergolaA)).ok)
  assert.ok(!core.answerPhase1(s, queue, pergolaA.questionId, { answer: 'PRESENT', notes: 'zdjecie widok-1.jpg' }, local(pergolaA)).ok)
  assert.ok(core.answerPhase1(s, queue, pergolaA.questionId, { answer: 'PRESENT', notes: '=HYPERLINK(1)' }, local(pergolaA)).ok)
  await core.seal(s, queue, HUMAN)
  core.answerPhase2(s, queue, pergolaA.questionId, { technicalEvidence: 'NO_TECHNICAL_EVIDENCE' }, HUMAN)
  assert.equal(s.labels[pergolaA.questionId].status, 'REVIEWED_VISUAL')
  assert.match(core.exportCSV(s, queue), /,'=HYPERLINK\(1\),/)
})
