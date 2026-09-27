/**
 * BUILDAPP-03G: BuildWorld draws the architectural assemblies of the synthetic
 * diversity fixtures through the same pipeline as every other model — the
 * model file is loaded, the compiler runs, the viewport draws the meshes — and
 * the category filters show and hide them as a whole. The screenshots are the
 * stage's visual record (stage-reports/artifacts/architectural-assemblies/viewer).
 */
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIR = resolve(HERE, '../../../stage-reports/artifacts/architectural-assemblies')
const SHOTS = resolve(DIR, 'viewer')
mkdirSync(SHOTS, { recursive: true })

type Handle = { meshCount: number; objectIds: string[] }
const handle = (page: Page): Promise<Handle> => page.evaluate(() => {
  const h = (window as unknown as { __buildworld: Handle }).__buildworld
  return { meshCount: h.meshCount, objectIds: h.objectIds }
})

async function load(page: Page, fixture: string): Promise<void> {
  const file = resolve(DIR, `models/fixture-${fixture}.json`)
  const { name } = JSON.parse(readFileSync(file, 'utf8')) as { name: string }
  await page.getByTestId('load-input').setInputFiles(file)
  await expect(page.getByTestId('status-model')).toHaveText(name)
  await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByTestId('viewport-canvas')).toBeVisible()
  await expect(page.getByTestId('status-triangles')).not.toHaveText('0')
  ;(page as unknown as { __errors: string[] }).__errors = errors
})

test.afterEach(async ({ page }) => {
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([])
})

const SHOWN = ['roof-intersecting-gables', 'roof-dormer-gable', 'roof-flat-parapet', 'exterior-balcony', 'exterior-entrance-canopy', 'exterior-carport', 'exterior-pergola', 'exterior-open-canopy', 'exterior-entrance-steps', 'unknown-feature']

for (const fixture of SHOWN) {
  test(`draws ${fixture}`, async ({ page }) => {
    await load(page, fixture)
    const h = await handle(page)
    expect(h.meshCount).toBeGreaterThan(10)
    await page.getByTestId('view-perspective').click()
    await page.waitForTimeout(250)
    await page.getByTestId('viewport-canvas').screenshot({ path: resolve(SHOTS, `${fixture}.png`) })
  })
}

test('the category filters hide and show structural members, roof assemblies and unknown assemblies', async ({ page }) => {
  await load(page, 'exterior-pergola')
  await expect(page.getByTestId('category-filters')).toBeVisible()
  const before = await handle(page)
  expect(before.objectIds).toContain('pergola-post-1')
  await page.getByTestId('toggle-category-structural-members').click()
  const members = await handle(page)
  expect(members.objectIds).not.toContain('pergola-post-1')
  expect(members.objectIds).toContain('terrace-rear')
  await page.getByTestId('toggle-category-roof-assemblies').click()
  expect((await handle(page)).objectIds).not.toContain('roof-main-plane-front')
  await page.getByTestId('show-all').click()
  expect((await handle(page)).meshCount).toBe(before.meshCount)

  await load(page, 'unknown-feature')
  expect((await handle(page)).objectIds).toContain('unknown-roof-feature')
  await page.getByTestId('toggle-category-unknown').click()
  expect((await handle(page)).objectIds).not.toContain('unknown-roof-feature')
})

test('a model without assemblies shows no category filters', async ({ page }) => {
  await expect(page.getByTestId('category-filters')).toHaveCount(0)
})
