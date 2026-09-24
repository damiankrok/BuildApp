/**
 * BuildWorld shows the automatic candidate the same way it shows every other
 * model — one store, one compiler, one viewport — and shows, beside it, what
 * kind of building it is.
 *
 * The second half of that matters as much as the first. A candidate drawn in
 * the same viewport as a surveyed reference looks exactly as confident as one,
 * so the run below checks that the panel which says otherwise is actually
 * there, carries the four input hashes, and counts the holes.
 */
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ART = resolve(HERE, '../../../stage-reports/artifacts')
mkdirSync(ART, { recursive: true })

/** The sealed analyzer-v2 data the app bundles, read from the same files so the run asserts against what shipped. */
const SEALED_V2 = resolve(HERE, '../../../packages/candidates/src')
const sealedV2 = JSON.parse(readFileSync(resolve(SEALED_V2, 'marcowki-auto-v2.json'), 'utf8')) as { modelId: string; contentHash: string }
const sealedV2Residuals = JSON.parse(readFileSync(resolve(SEALED_V2, 'marcowki-auto-v2-residuals.json'), 'utf8')) as { candidateHash: string; residuals: Array<{ withinTolerance: boolean }> }

type Handle = { store: { model: { id: string; name: string; walls: Array<{ id: string }>; linearSolids: Array<{ id: string }>; stairs: unknown[] } }; meshCount: number; objectIds: string[] }

const handle = (page: Page) =>
  page.evaluate(() => {
    const h = (window as unknown as { __buildworld: Handle }).__buildworld
    return { meshCount: h.meshCount, objectIds: h.objectIds, id: h.store.model.id, name: h.store.model.name, walls: h.store.model.walls.length, solids: h.store.model.linearSolids.length, stairs: h.store.model.stairs.length }
  })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('viewport-canvas')).toBeVisible()
})

test('the automatic candidate loads from its sealed program and compiles like any other model', async ({ page }) => {
  await page.getByTestId('model-select').selectOption('marcowki-auto')
  await expect(page.getByTestId('status-model')).toHaveText('Marcówki (auto)')
  await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')
  const m = await handle(page)
  expect(m.walls).toBeGreaterThan(0)
  expect(m.solids).toBeGreaterThan(0)
  // The stair was refused, not invented, and the viewer shows what the
  // candidate contains rather than what a house usually has.
  expect(m.stairs).toBe(0)
  expect(Number(await page.getByTestId('status-triangles').textContent())).toBeGreaterThan(500)
  await page.screenshot({ path: resolve(ART, 'buildworld-marcowki-auto.png'), fullPage: false })
})

test('the reconstruction panel says what kind of building this is, and ties it to the bytes it came from', async ({ page }) => {
  await page.getByTestId('model-select').selectOption('marcowki-auto')
  await page.getByTestId('panel-sources').click()
  const panel = page.getByTestId('reconstruction')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('reconstruction-auto')).toHaveText('automatic · not final')
  // The four hashes are shown, and they are hashes.
  for (const id of ['recon-package-hash', 'recon-candidate-hash']) await expect(page.getByTestId(id)).toHaveText(/^[0-9a-f]{16}$/)
  // The holes are counted, and there are some: a candidate with none would be
  // making a claim nobody has earned.
  const holes = Number(await page.getByTestId('recon-unresolved').textContent())
  expect(holes).toBeGreaterThan(0)
  await expect(panel).toContainText('stated by a drawing')
  await expect(panel).toContainText('left to a building convention')
  await page.screenshot({ path: resolve(ART, 'buildworld-reconstruction-panel.png'), fullPage: false })
})

test('the reference model shows no reconstruction panel: it was not reconstructed', async ({ page }) => {
  await page.getByTestId('model-select').selectOption('marcowki-ge')
  await page.getByTestId('panel-sources').click()
  await expect(page.getByTestId('reconstruction')).toHaveCount(0)
})

/**
 * §23's recognizability audit, in the viewer the owner actually looks at.
 *
 * The condition the stage sets is that the source-view renders visibly show a
 * main body distinct from the garage, the roof split between them, and
 * plausible openings — and that nobody looking at them would call the result
 * a forest of strips. A screenshot cannot be asserted about, so the run below
 * does two things with each view: it SAVES it, for a person to look at, and it
 * checks the property that makes the picture worth looking at — that the
 * geometry drawn in it has the features the structure claims.
 */
test('§23 recognizability: the five source views of the automatic candidate', async ({ page }) => {
  await page.getByTestId('model-select').selectOption('marcowki-auto')
  await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(ART, 'auto-01-perspective.png') })

  // The canvas drew a building rather than a blank: several shades in the
  // middle of the perspective view, which a flat background does not have.
  const shades = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="viewport-canvas"]') as HTMLCanvasElement
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    if (!gl) return 0
    const px = new Uint8Array(4 * 64 * 64)
    gl.readPixels(Math.floor(c.width / 2) - 32, Math.floor(c.height / 2) - 32, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const distinct = new Set<string>()
    for (let i = 0; i < px.length; i += 4) distinct.add(`${px[i]},${px[i + 1]},${px[i + 2]}`)
    return distinct.size
  })
  expect(shades).toBeGreaterThan(3)

  for (const [n, view] of [
    ['02', 'front'],
    ['03', 'rear'],
    ['04', 'top'],
  ] as const) {
    await page.getByTestId(`view-${view}`).click()
    await expect(page.getByTestId(`view-${view}`)).toHaveClass(/active/)
    await page.waitForTimeout(300)
    await page.screenshot({ path: resolve(ART, `auto-${n}-${view}.png`) })
  }

  // Roof off: the two roofs go and the walls stay, which is what makes the
  // garage's separate roof visible as a separate thing at all.
  const all = await handle(page)
  await page.getByTestId('view-perspective').click()
  await page.getByTestId('toggle-roofs').click()
  const noRoof = await handle(page)
  expect(noRoof.meshCount).toBeLessThan(all.meshCount)
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(ART, 'auto-05-roof-off.png') })
  await page.getByTestId('show-all').click()

  // And the structure the pictures are supposed to show: two bodies at
  // different heights, each with its own roof, and openings rather than a
  // barcode of strips.
  const structure = await page.evaluate(() => {
    const h = (window as unknown as { __buildworld: { store: { model: { roofs: Array<{ id: string; kind: string; eaveOffset: number; levelId: string }>; levels: Array<{ id: string; elevation: number }>; openings: unknown[]; linearSolids: unknown[]; slabs: unknown[] } } } }).__buildworld
    const m = h.store.model
    return {
      roofs: m.roofs.map((r) => ({ kind: r.kind, top: (m.levels.find((l) => l.id === r.levelId)?.elevation ?? 0) + r.eaveOffset })),
      openings: m.openings.length,
      solids: m.linearSolids.length,
      slabs: m.slabs.length,
    }
  })
  expect(structure.roofs.length).toBeGreaterThanOrEqual(2)
  expect(new Set(structure.roofs.map((r) => r.kind)).size).toBeGreaterThanOrEqual(2)
  const tops = structure.roofs.map((r) => r.top)
  expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThan(1)
  expect(structure.openings).toBeGreaterThanOrEqual(8)
  // The BUILDAPP-03 candidate carried twenty-four of these. A facade is not a
  // barcode.
  expect(structure.solids).toBeLessThanOrEqual(8)
  expect(structure.slabs).toBeGreaterThanOrEqual(3)
})

/**
 * The second sealed candidate, from analyzer v2, sits beside the first in the
 * same selector and loads the same way. What is new is the comparison against
 * the source views: the verifier's residuals ship with the candidate, and the
 * panel shows them as a table a reviewer can read row by row.
 */
test('both sealed candidates are offered in the model selector', async ({ page }) => {
  const labels = await page.getByTestId('model-select').locator('option').allTextContents()
  expect(labels).toContain('Marcówki (auto)')
  expect(labels).toContain('Marcówki (auto v2)')
  const values = await page.getByTestId('model-select').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))
  expect(values).toContain('marcowki-auto')
  expect(values).toContain('marcowki-auto-v2')
})

test('the analyzer-v2 candidate loads from its sealed program and compiles like any other model', async ({ page }) => {
  await page.getByTestId('model-select').selectOption('marcowki-auto-v2')
  await expect(page.getByTestId('status-model')).toHaveText('Marcówki (auto v2)')
  // The selector says which candidate is on screen rather than falling back to "(file)".
  await expect(page.getByTestId('model-select')).toHaveValue('marcowki-auto-v2')
  await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')
  const m = await handle(page)
  expect(m.id).toBe(sealedV2.modelId)
  expect(m.walls).toBeGreaterThan(0)
  expect(m.solids).toBeGreaterThan(0)
  expect(Number(await page.getByTestId('status-triangles').textContent())).toBeGreaterThan(500)
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(ART, 'buildworld-marcowki-auto-v2.png'), fullPage: false })
})

test('the analyzer-v2 candidate shows its comparison against the source views, tied to the candidate by hash', async ({ page }) => {
  await page.getByTestId('model-select').selectOption('marcowki-auto-v2')
  await page.getByTestId('panel-sources').click()
  await expect(page.getByTestId('reconstruction')).toBeVisible()
  await expect(page.getByTestId('recon-candidate-hash')).toHaveText(sealedV2.contentHash.slice(0, 16))
  expect(sealedV2Residuals.candidateHash).toBe(sealedV2.contentHash)

  const panel = page.getByTestId('source-view-comparison')
  await expect(panel).toBeVisible()
  const rows = page.getByTestId('source-view-row')
  await expect(rows).toHaveCount(sealedV2Residuals.residuals.length)
  const within = sealedV2Residuals.residuals.filter((r) => r.withinTolerance).length
  await expect(page.getByTestId('source-view-summary')).toHaveText(`${within} of ${sealedV2Residuals.residuals.length} within tolerance`)
  await expect(panel.locator('.svc-ok')).toHaveCount(within)
  await expect(panel.locator('.svc-off')).toHaveCount(sealedV2Residuals.residuals.length - within)
  await expect(panel).toContainText('sill')
  await page.screenshot({ path: resolve(ART, 'buildworld-source-view-comparison.png'), fullPage: false })
})

test('the first candidate shows no source-view comparison: its solver never verified against the views', async ({ page }) => {
  await page.getByTestId('model-select').selectOption('marcowki-auto')
  await page.getByTestId('panel-sources').click()
  await expect(page.getByTestId('reconstruction')).toBeVisible()
  await expect(page.getByTestId('source-view-comparison')).toHaveCount(0)
})
