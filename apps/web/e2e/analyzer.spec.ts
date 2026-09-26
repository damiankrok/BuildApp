/**
 * The Analyze panel, end to end in a real browser, against a real analyzer
 * API process (apps/analyzer-api/scripts/serve-fixture.ts: the production
 * server, runner and pipeline, wired to the in-memory publisher).
 *
 * A URL goes in; the service's stages come back as a checklist with its own
 * progress; the model it made opens in the same viewport as every other
 * model, named by its label, after its bytes were checked against the hash
 * the service published.
 */
import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ART = resolve(HERE, '../../../stage-reports/artifacts/analyzer-api')
mkdirSync(ART, { recursive: true })

const SERVICE = 'http://127.0.0.1:4180'
const PROJECT = 'https://drawings.synthetic-publisher.test/projects/larchfield-lf01'
const STAGES = ['ACQUIRING_SOURCE', 'CLASSIFYING_SOURCES', 'EXTRACTING_OBSERVATIONS', 'REGISTERING_VIEWS', 'SOLVING_TOPOLOGY', 'SOLVING_METRICS', 'BUILDING_MODEL', 'COMPILING_SCENE', 'VERIFYING']

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('viewport-canvas')).toBeVisible()
  await page.getByTestId('panel-analyze').click()
  await expect(page.getByTestId('analyzer-panel')).toBeVisible()
})

test('with no service configured the panel says so, and asks for the address', async ({ page }) => {
  await expect(page.getByTestId('analyzer-not-configured')).toBeVisible()
  await expect(page.getByTestId('analyzer-submit')).toBeDisabled()
  await page.getByTestId('analyzer-service-input').fill('http://analyzer.example.com')
  await page.getByTestId('analyzer-service-save').click()
  await expect(page.getByTestId('analyzer-error')).toContainText('https://')
})

test('a project link becomes a building: stages, progress, result, and the model opened by its label', async ({ page }) => {
  await page.getByTestId('analyzer-service-input').fill(SERVICE)
  await page.getByTestId('analyzer-service-save').click()
  await expect(page.getByTestId('analyzer-service')).toHaveText(SERVICE)

  await page.getByTestId('analyzer-url').fill(PROJECT)
  await page.getByTestId('analyzer-submit').click()
  await expect(page.getByTestId('analyzer-progress')).toBeVisible()
  // every stage the service runs is listed, in its order
  for (const id of STAGES) await expect(page.getByTestId(`analyzer-stage-${id}`)).toBeVisible()

  await expect(page.getByTestId('analyzer-status')).toHaveText('COMPLETED', { timeout: 60_000 })
  for (const id of STAGES) await expect(page.getByTestId(`analyzer-stage-${id}`)).toHaveAttribute('data-state', 'DONE')
  await expect(page.getByTestId('analyzer-progress-bar')).toHaveAttribute('value', '1')

  await expect(page.getByTestId('analyzer-title')).toHaveText('Larchfield')
  await expect(page.getByTestId('analyzer-candidate')).toHaveText(/^[0-9a-f]{12}$/)
  await expect(page.getByTestId('analyzer-quality')).toHaveText(/^L0 \d+ · L1 \d+ · L2 \d+$/)
  await expect(page.getByTestId('analyzer-vision')).toHaveText('deterministic analyzer — no vision provider')
  // diagnostics are rows, never raw JSON
  await page.getByTestId('analyzer-diagnostics').locator('summary').click()
  await expect(page.getByTestId('analyzer-diagnostics')).toContainText('source package')
  await expect(page.getByTestId('analyzer-diagnostics')).not.toContainText('{"')
  await page.screenshot({ path: resolve(ART, 'web-analyzer-completed.png'), fullPage: false })

  await page.getByTestId('analyzer-open').click()
  await expect(page.getByTestId('status-model')).toHaveText('Larchfield (analysis)')
  await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')
  await expect(page.getByTestId('model-select').locator('option:checked')).toHaveText('Larchfield (analysis)')
  expect(Number(await page.getByTestId('status-triangles').textContent())).toBeGreaterThan(100)
  const modelId = await page.evaluate(() => (window as unknown as { __buildworld: { store: { model: { id: string } } } }).__buildworld.store.model.id)
  expect(modelId).toBe('m-analysis-larchfield-lf01')
  await page.screenshot({ path: resolve(ART, 'web-analyzer-opened.png'), fullPage: false })
})

test('a link the service will not read is refused with its reason, before anything runs', async ({ page }) => {
  await page.getByTestId('analyzer-service-input').fill(SERVICE)
  await page.getByTestId('analyzer-service-save').click()
  await page.getByTestId('analyzer-url').fill('https://example.com/some-house')
  await page.getByTestId('analyzer-submit').click()
  await expect(page.getByTestId('analyzer-error')).toHaveAttribute('data-code', 'UNSUPPORTED_PUBLISHER')
  await expect(page.getByTestId('analyzer-progress')).toHaveCount(0)
})

test('a service that cannot be reached is reported as such', async ({ page }) => {
  await page.getByTestId('analyzer-service-input').fill('http://127.0.0.1:4199')
  await page.getByTestId('analyzer-service-save').click()
  await page.getByTestId('analyzer-url').fill(PROJECT)
  await page.getByTestId('analyzer-submit').click()
  await expect(page.getByTestId('analyzer-error')).toHaveAttribute('data-code', 'NETWORK')
  await expect(page.getByTestId('analyzer-error')).toContainText('cannot be reached')
})
