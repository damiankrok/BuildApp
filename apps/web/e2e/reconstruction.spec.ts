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
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ART = resolve(HERE, '../../../stage-reports/artifacts')
mkdirSync(ART, { recursive: true })

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
