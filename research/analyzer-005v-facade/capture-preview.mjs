/**
 * BUILDPLAN-ANALYZER-005V: the before/after preview, reproducible. Renders building models (the analyzer's
 * model.json, as `research/analyzer-005t-n2/replay-solver.ts` writes them) in the production web viewer (`apps/web`,
 * BuildWorld, Three.js) from the same app camera presets, and captions each frame with the house, the model and the
 * view. No publisher image is read or written: the inputs are the analyzer's own models, the outputs PNGs of the
 * viewer, and both stay outside the repository.
 *
 *   npx vite build apps/web --outDir <out>/dist && npx vite preview --outDir <out>/dist --port 4182 &
 *   node research/analyzer-005v-facade/capture-preview.mjs <models.json> <outDir> [url]
 *
 * models.json: [{ "key", "house", "label", "sha", "file" }] — `file` the model.json to load, `sha` its short SHA-256.
 * Chromium comes from Playwright (PLAYWRIGHT_BROWSERS_PATH), drawn by SwiftShader.
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const require = createRequire(fileURLToPath(new URL('../../package.json', import.meta.url)))
const { chromium } = require('playwright')
const [modelsPath, OUT, PAGE = 'http://127.0.0.1:4182/'] = process.argv.slice(2)
if (!modelsPath || !OUT) throw new Error('usage: capture-preview.mjs <models.json> <outDir> [url]')
const COMMIT = process.env.CAPTION_COMMIT ?? 'working tree'
const MODELS = JSON.parse(readFileSync(modelsPath, 'utf8'))
const VIEWS = [
  { id: '1-przod', preset: 'front', name: 'przód', roofs: true },
  { id: '2-tyl', preset: 'rear', name: 'tył', roofs: true },
  { id: '3-lewa', preset: 'left', name: 'lewa strona', roofs: true },
  { id: '4-prawa', preset: 'right', name: 'prawa strona', roofs: true },
  { id: '5-gora-bez-dachu', preset: 'top', name: 'z góry, bez dachu', roofs: false },
  { id: '6-perspektywa', preset: 'perspective', name: 'perspektywa ¾ (preset aplikacji)', roofs: true },
  { id: '7-gora-parter', preset: 'top', name: 'z góry, bez dachu, tylko parter (izolacja kondygnacji)', roofs: false, isolate: 'lvl-0' },
]
const click = (page, id) => page.evaluate((id) => { const el = document.querySelector(`[data-testid="${id}"]`); if (!el) throw new Error('no ' + id); el.dispatchEvent(new MouseEvent('click', { bubbles: true })) }, id)
const frames = (page, n) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f) }), n)
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const manifest = []
for (const m of MODELS) {
  await page.goto(PAGE, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="load-input"]').setInputFiles(m.file)
  await page.waitForFunction(() => document.querySelector('[data-testid="status-diagnostics"]') !== null)
  await frames(page, 30)
  const status = { model: await page.locator('[data-testid="status-model"]').innerText(), diagnostics: await page.locator('[data-testid="status-diagnostics"]').innerText() }
  const gridOn = await page.evaluate(() => document.querySelector('[data-testid="toggle-grid"]')?.classList.contains('active'))
  mkdirSync(`${OUT}/${m.key}`, { recursive: true })
  let roofsVisible = true
  for (const v of VIEWS) {
    if (v.roofs !== roofsVisible) { await click(page, 'toggle-roofs'); roofsVisible = v.roofs }
    if (v.isolate) await page.locator('[data-testid="isolate-level"]').selectOption(v.isolate, { force: true })
    await click(page, `view-${v.preset}`)
    await frames(page, 240)
    await page.evaluate(({ text }) => {
      document.getElementById('n5-caption')?.remove()
      const host = document.querySelector('[data-testid="viewport"]')
      const d = document.createElement('div')
      d.id = 'n5-caption'
      d.textContent = text
      Object.assign(d.style, { position: 'absolute', left: '0', right: '0', top: '0', padding: '6px 10px', font: '600 14px sans-serif', background: 'rgba(0,0,0,0.72)', color: '#fff', zIndex: 50, whiteSpace: 'pre-line', pointerEvents: 'none' })
      host.style.position = host.style.position || 'relative'
      host.appendChild(d)
    }, { text: `${m.house}\n${m.label} · model ${m.sha}… · widok: ${v.name} · renderer: BuildWorld web (Three.js), commit ${COMMIT}` })
    await frames(page, 5)
    const path = `${OUT}/${m.key}/${v.id}.png`
    await page.locator('[data-testid="viewport"]').screenshot({ path })
    manifest.push({ model: m.key, modelSha: m.sha, view: v.id, preset: v.preset, roofsVisible: v.roofs, path })
  }
  if (!roofsVisible) await click(page, 'toggle-roofs')
  await page.locator('[data-testid="isolate-level"]').selectOption('', { force: true })
  manifest.push({ model: m.key, status, gridOn })
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ commit: COMMIT, errors, manifest }, null, 1))
console.log(JSON.stringify({ errors, statuses: manifest.filter((x) => x.status) }))
await browser.close()
