import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The Sources / Observations surface, in a real browser.
 *
 * Two things are being verified and the second is the important one: that the
 * panel shows what the analyzer saw, and that opening, filtering and reading
 * it changes NOTHING about the building. An observation is a claim about a
 * picture; a model is a building; the whole stage is arranged so that one
 * cannot become the other by clicking on it.
 */
const ART = resolve(dirname(fileURLToPath(import.meta.url)), '../../../stage-reports/artifacts/source-observations')
mkdirSync(ART, { recursive: true })

type Handle = { store: { model: { id: string; walls: unknown[]; roofs: unknown[] } }; meshCount: number }

const modelState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const h = (window as unknown as { __buildworld: Handle }).__buildworld
    return { id: h.store.model.id, walls: h.store.model.walls.length, roofs: h.store.model.roofs.length, meshes: h.meshCount, triangles: Number(document.querySelector('[data-testid="status-triangles"]')?.textContent ?? '0') }
  })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('viewport-canvas')).toBeVisible()
  await expect(page.getByTestId('status-triangles')).not.toHaveText('0')
})

test('shows the sealed observation graph the analyzer produced', async ({ page }) => {
  await page.getByTestId('panel-sources').click()
  await expect(page.getByTestId('sources')).toBeVisible()
  await expect(page.getByTestId('sources-readonly')).toHaveText('read-only')
  await expect(page.getByTestId('sources-graph-id')).toContainText('obsgraph-')
  await expect(page.getByTestId('sources-hash')).toContainText('intact')
  await expect(page.getByTestId('sources-validation')).toHaveText('0 errors, 0 warnings')
  await expect(page.getByTestId('observation').first()).toBeVisible()
  const observations = await page.getByTestId('observation').count()
  expect(observations).toBeGreaterThan(5)
  await page.screenshot({ path: resolve(ART, 'buildworld-sources-panel.png'), fullPage: false })
})

test('lets a reader walk the drawings and the kinds, and opens one reading in full', async ({ page }) => {
  await page.getByTestId('panel-sources').click()
  const frames = page.getByTestId('sources-frame')
  const options = await frames.locator('option').allTextContents()
  expect(options.length).toBeGreaterThan(1)
  expect(options.join(' ')).toContain('ELEVATION')

  // pick the elevation and narrow to the members the stage exists to find
  const elevation = options.find((o) => o.startsWith('ELEVATION'))
  await frames.selectOption({ label: elevation })
  const kinds = await page.getByTestId('sources-kind').locator('option').allTextContents()
  expect(kinds.join(' ')).toContain('LINEAR_VOLUME_CANDIDATE')
  await page.getByTestId('sources-kind').selectOption({ label: kinds.find((k) => k.startsWith('LINEAR_VOLUME_CANDIDATE')) })
  const first = page.getByTestId('observation').first()
  await expect(first).toBeVisible()
  await first.getByRole('button').click()
  await expect(first).toContainText('evidence')
  await expect(first).toContainText('depth cues')
  await page.screenshot({ path: resolve(ART, 'buildworld-sources-linear-volume.png'), fullPage: false })
})

test('names what the analyzer does not know instead of leaving it blank', async ({ page }) => {
  await page.getByTestId('panel-sources').click()
  await expect(page.getByTestId('sources-gaps-title')).toContainText('does not know')
  await expect(page.getByTestId('sources')).toContainText('NOT_ATTEMPTED')
})

test('changes nothing about the building', async ({ page }) => {
  const before = await modelState(page)
  await page.getByTestId('panel-sources').click()
  const frames = page.getByTestId('sources-frame')
  const options = await frames.locator('option').allTextContents()
  for (const option of options) await frames.selectOption({ label: option })
  const first = page.getByTestId('observation').first()
  await first.getByRole('button').click()
  await first.getByRole('button').click()
  await page.getByTestId('panel-inspector').click()
  await expect(page.getByTestId('inspector')).toBeVisible()
  const after = await modelState(page)
  expect(after).toEqual(before)
  // and undo has nothing to undo, because nothing was done
  await expect(page.getByTestId('undo')).toBeDisabled()
})
