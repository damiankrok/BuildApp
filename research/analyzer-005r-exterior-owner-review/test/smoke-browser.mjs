#!/usr/bin/env node
/*
 * smoke-browser.mjs — T7/T8: the portable pack in a clean directory, driven in Chromium with SYNTHETIC images only.
 *
 *   node research/analyzer-005r-exterior-owner-review/test/smoke-browser.mjs <work dir OUTSIDE the repo>
 *
 * Copies only what the OWNER gets (review.html, tool/, pack/, examples/) into <work>/pack-copy, writes the synthetic
 * pictures with make_synthetic_demo.py into <work>/synthetic-images, then: opens the synthetic pack, checks that a
 * question without matching bytes is SOURCE_IMAGE_UNAVAILABLE and unanswerable, loads the pictures, answers, draws a
 * region, checks that no phase-2 data exists before the seal, seals, cross-checks (one conflict), exports JSON + CSV,
 * reloads (resume), re-imports the export, refuses a tampered and a cross-edition-forged import, and opens the real
 * pack without any picture. Every request the browser makes is logged; anything but file:/blob:/data: fails the run.
 * No publisher image is used or opened.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const HERE = dirname(fileURLToPath(import.meta.url))
const PACK = resolve(HERE, '..')
const REPO = resolve(PACK, '..', '..')
const work = resolve(process.argv[2] || '')
if (!process.argv[2] || work === REPO || work.startsWith(REPO + '/')) throw new Error('give a work directory outside the repository')
const { chromium } = require(join(REPO, 'node_modules', 'playwright'))
const core = require(join(PACK, 'tool', 'review-core.js'))

rmSync(work, { recursive: true, force: true })
const copy = join(work, 'pack-copy')
for (const d of ['tool', 'pack', 'examples']) cpSync(join(PACK, d), join(copy, d), { recursive: true })
cpSync(join(PACK, 'review.html'), join(copy, 'review.html'))
const imgs = join(work, 'synthetic-images')
const gen = spawnSync('python3', ['-I', join(PACK, 'make_synthetic_demo.py'), imgs], { encoding: 'utf8' })
assert.equal(gen.status, 0, gen.stderr)
const files = readdirSync(imgs).map((f) => join(imgs, f)).sort()
assert.equal(files.length, 5) // the sixth picture is never written: its question must stay unavailable

const log = { requests: [], external: [], consoleErrors: [], steps: [] }
const step = (s) => { log.steps.push(s); console.log('·', s) }
let browser
try {
  browser = await chromium.launch()
} catch (e) {
  browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
}
const context = await browser.newContext({ acceptDownloads: true })
context.on('request', (r) => {
  log.requests.push(r.url().slice(0, 60))
  if (!/^(file|blob|data):/.test(r.url())) log.external.push(r.url())
})
await context.route(/^(?!file:|blob:|data:)/, (route) => { log.external.push('BLOCKED ' + route.request().url()); route.abort() })
const page = await context.newPage()
page.on('console', (m) => { if (m.type() === 'error') log.consoleErrors.push(m.text()) })
page.on('pageerror', (e) => log.consoleErrors.push(String(e)))
const dialogs = []
page.on('dialog', (d) => { dialogs.push(d.message().slice(0, 120)); d.accept() })
const url = pathToFileURL(join(copy, 'review.html')).href

// ---------- synthetic pack ----------
await page.goto(url + '?pack=synthetic')
await page.getByText('PAKIET SYNTETYCZNY').waitFor()
step('synthetic pack opened from file:// with the CSP in force')
assert.equal(await page.getByTestId('unavailable').count(), 1)
assert.equal(await page.getByTestId('answer-PRESENT').isDisabled(), true)
step('before any picture: SOURCE_IMAGE_UNAVAILABLE, answers disabled')
const queue = await page.evaluate(() => window.OWNER_REVIEW_QUEUE)
assert.equal(await page.evaluate(() => typeof window.OWNER_REVIEW_CROSSCHECK), 'undefined')

await page.locator('input[type=file][accept="image/*"]').setInputFiles(files)
await page.getByTestId('file-status').filter({ hasText: 'Dopasowano 4 z 5' }).waitFor()
step('5 local files hashed in the page: 4 of 5 pack images matched (one variant pair, one never written)')

const answers = {
  PERGOLA_lg_syn_house: 'PRESENT', CARPORT_lg_syn_house: 'ABSENT', SCENE_lg_syn_house: 'EXTERIOR', PERGOLA_lg_syn_house_b: 'NOT_SHOWN',
  UNKNOWN_ASSEMBLY_lg_syn_elev: 'PRESENT', SCENE_lg_syn_interior: 'INTERIOR', COLUMN_lg_syn_interior: 'CANNOT_TELL',
}
let unavailableSeen = 0
for (const q of queue.questions) {
  await page.getByRole('button', { name: String(q.order), exact: true }).first().click()
  const key = `${q.featureClass || 'SCENE'}_${q.lineageGroup.replace(/-/g, '_')}`
  if (!(key in answers)) {
    assert.equal(await page.getByTestId('unavailable').count(), 1, key)
    assert.equal(await page.getByTestId(`answer-${q.kind === 'SCENE_SCOPE' ? 'EXTERIOR' : 'PRESENT'}`).isDisabled(), true)
    unavailableSeen++
    continue
  }
  await page.getByTestId(`answer-${answers[key]}`).click()
  if (key === 'PERGOLA_lg_syn_house') {
    await page.getByTestId('cover-OPEN_MEMBERS').click()
    await page.getByTestId('draw').click()
    const box = await page.getByTestId('overlay').boundingBox()
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.44)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.88, box.y + box.height * 0.76, { steps: 4 })
    await page.mouse.up()
  }
  assert.equal(await page.getByTestId('status').textContent(), 'REVIEWED_VISUAL', key)
  if (key === 'PERGOLA_lg_syn_house') assert.equal(await page.getByTestId('region').count(), 1)
}
assert.equal(unavailableSeen, 1)
step('7 blind answers by click (cover + region on one); the unavailable question stayed unanswerable')
assert.equal(await page.evaluate(() => typeof window.OWNER_REVIEW_CROSSCHECK), 'undefined')
assert.equal(await page.getByText('Kanał wydawcy').count(), 0)
step('no cross-check data in the page before the seal')

await page.reload()
await page.getByTestId('seal').waitFor()
assert.match(await page.locator('.bar').textContent(), /odpowiedzi 7\/8/)
step('reload: the session resumed from browser storage (7/8), re-validated by the import rules')
await page.getByTestId('seal').click()
await page.getByTestId('seal-status').waitFor()
assert.equal(await page.evaluate(() => typeof window.OWNER_REVIEW_CROSSCHECK), 'object')
step('sealed; cross-check loaded only now')

await page.locator('input[type=file][accept="image/*"]').setInputFiles(files)
const pergola = queue.questions.find((q) => q.featureClass === 'PERGOLA' && q.lineageGroup === 'lg-syn-house')
await page.getByRole('button', { name: String(pergola.order), exact: true }).first().click()
assert.equal(await page.getByTestId('answer-ABSENT').isDisabled(), true)
await page.getByTestId('tech-TECHNICAL_DOES_NOT_SHOW').click()
await page.getByTestId('evidence-source').selectOption('ELEVATION_IN_PACK')
await page.getByTestId('conflict').waitFor()
assert.equal(await page.getByTestId('status').textContent(), 'TECHNICALLY_CROSSCHECKED')
assert.equal(await page.getByTestId('answer-PRESENT').getAttribute('aria-pressed'), 'true')
step('phase 2: technical evidence contradicts the blind PRESENT → conflict kept, blind answer unchanged and read-only')

const dl = async (testId) => {
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testId).click()])
  const p = join(work, d.suggestedFilename())
  await d.saveAs(p)
  return p
}
const jsonPath = await dl('export-json')
const csvPath = await dl('export-csv')
const exported = readFileSync(jsonPath, 'utf8')
const r = await core.importLabels(exported, queue, await page.evaluate(() => window.OWNER_REVIEW_QUEUE_SHA256))
assert.ok(r.ok, JSON.stringify(r.errors))
assert.doesNotMatch(exported, /https?:|data:|blob:|base64|\/home\/|\/tmp\//)
const doc = JSON.parse(exported)
assert.equal(doc.counts.UNREVIEWED, 1)
assert.equal(doc.counts.conflicts, 1)
assert.equal(doc.labels.filter((l) => l.reviewerOrigin === 'SYNTHETIC_EXAMPLE').length, 7)
assert.ok(doc.labels.every((l) => l.status !== 'UNREVIEWED' || (l.phase1 === null && l.reviewerOrigin === null)))
assert.deepEqual(doc.labels.find((l) => l.questionId === pergola.questionId).phase1.region, [0.62, 0.44, 0.88, 0.76])
const csv = readFileSync(csvPath, 'utf8')
assert.equal(csv.trim().split('\n').length, 9)
step('export JSON (validated by the same core in Node; no URL/pixels) and CSV (8 rows); region normalised to [0,1]')
const exportedAgain = readFileSync(await dl('export-json'), 'utf8')
assert.equal(exportedAgain, exported)
step('a second export is byte-identical')

// tampered and forged imports are refused in the page
const tampered = JSON.parse(exported)
tampered.labels.find((l) => l.questionId === pergola.questionId).phase1.answer = 'ABSENT'
writeFileSync(join(work, 'tampered.json'), JSON.stringify(tampered))
const forged = JSON.parse(exported)
const other = forged.labels.find((l) => l.projectEditionId === 'synthetic:edition-b' && l.featureClass === 'PERGOLA')
const fromA = forged.labels.find((l) => l.questionId === pergola.questionId)
Object.assign(other, { ...fromA, questionId: other.questionId }) // move edition-a's answer onto edition-b's question
writeFileSync(join(work, 'forged.json'), JSON.stringify(forged))
for (const f of ['tampered.json', 'forged.json']) {
  const before = dialogs.length
  await page.getByTestId('import').setInputFiles(join(work, f))
  await page.waitForTimeout(400)
  assert.match(dialogs.slice(before).join('|'), /Import odrzucony/, f)
}
step('page refused a tampered blind answer (seal digest) and an answer moved to another edition (anchor mismatch)')
await page.getByRole('button', { name: 'Wyczyść sesję w tej przeglądarce' }).click()
assert.match(await page.locator('.bar').textContent(), /odpowiedzi 0\/8/)
await page.getByTestId('import').setInputFiles(jsonPath)
await page.getByTestId('seal-status').waitFor()
assert.match(await page.locator('.bar').textContent(), /odpowiedzi 7\/8/)
step('cleared, then re-imported the export: round trip restores 7/8 sealed answers')

// ---------- real pack without any picture ----------
const real = await context.newPage()
real.on('pageerror', (e) => log.consoleErrors.push(String(e)))
await real.goto(url)
await real.getByTestId('unavailable').waitFor()
assert.match(await real.locator('.bar').textContent(), /odpowiedzi 0\/60/)
assert.match(await real.locator('.bar').textContent(), /priorytet 0\/34/)
assert.equal(await real.getByText('PAKIET SYNTETYCZNY').count(), 0)
assert.equal(await real.evaluate(() => typeof window.OWNER_REVIEW_CROSSCHECK), 'undefined')
step('real pack: integrity check passed, 60 questions (34 priority), every one SOURCE_IMAGE_UNAVAILABLE without local bytes')
await page.screenshot({ path: join(work, 'synthetic-phase2.png'), fullPage: true })
await real.screenshot({ path: join(work, 'real-no-images.png'), fullPage: true })

await browser.close()
assert.deepEqual(log.external, [])
assert.deepEqual(log.consoleErrors, [])
const schemes = {}
for (const u of log.requests) schemes[u.split(':')[0]] = (schemes[u.split(':')[0]] || 0) + 1
const summary = { ok: true, steps: log.steps.length, requestsByScheme: schemes, externalRequests: log.external.length, dialogs: dialogs.length }
writeFileSync(join(work, 'smoke-summary.json'), JSON.stringify(summary, null, 1) + '\n')
console.log('OK', JSON.stringify(summary))
