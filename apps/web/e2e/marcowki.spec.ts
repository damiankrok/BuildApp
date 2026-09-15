/**
 * BuildWorld shows the Marcówki reference model through the SAME pipeline as
 * the demo house: the toolbar's model selector replaces the model in the one
 * EditorStore, the compiler runs, the viewport draws the result. These runs
 * also produce the visual audit screenshots the stage report lists.
 */
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ART = resolve(HERE, '../../../stage-reports/artifacts')
const FIXTURE = resolve(HERE, '../../../packages/model/test/fixtures/marcowki-ge-1.3.0.json')
mkdirSync(ART, { recursive: true })

type Handle = {
  store: { model: { id: string; name: string; walls: Array<{ id: string }>; roofOpenings: Array<{ id: string }>; surfaceRegions: Array<{ id: string }>; stairs: Array<{ kind: string }> } }
  meshCount: number
  objectIds: string[]
  parts?: string[]
}
const handle = (page: Page) =>
  page.evaluate(() => {
    const h = (window as unknown as { __buildworld: Handle }).__buildworld
    return {
      meshCount: h.meshCount,
      objectIds: h.objectIds,
      id: h.store.model.id,
      name: h.store.model.name,
      walls: h.store.model.walls.length,
      roofOpenings: h.store.model.roofOpenings.length,
      surfaceRegions: h.store.model.surfaceRegions.length,
      stairKind: h.store.model.stairs[0]?.kind,
    }
  })

const MARCOWKI = 'Dom w marcówkach (GE)'

async function selectMarcowki(page: Page): Promise<void> {
  await page.getByTestId('model-select').selectOption('marcowki-ge')
  await expect(page.getByTestId('status-model')).toHaveText(MARCOWKI)
  await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  ;(page as unknown as { __errors: string[] }).__errors = errors
  await page.goto('/')
  await expect(page.getByTestId('viewport-canvas')).toBeVisible()
  await expect(page.getByTestId('status-triangles')).not.toHaveText('0')
})

test('the model selector replaces the demo house with the Marcówki reference in the same store, compiled by the same compiler', async ({ page }) => {
  await expect(page.getByTestId('status-model')).toHaveText('BuildApp demo house')
  const demo = await handle(page)
  await selectMarcowki(page)
  const m = await handle(page)
  expect(m.id).toBe('marcowki-ge')
  expect(m.walls).toBe(35)
  expect(m.roofOpenings).toBe(5)
  expect(m.surfaceRegions).toBe(6)
  expect(m.stairKind).toBe('FLIGHTS')
  expect(m.meshCount).toBeGreaterThan(demo.meshCount)
  expect(Number(await page.getByTestId('status-triangles').textContent())).toBeGreaterThan(3000)
  for (const id of ['g-front', 'ret-west-front', 'portal-head', 'roof-main', 'rl-pralnia-w-unit', 'og-front-gable-glazing', 'chimney-salon']) expect(m.objectIds, id).toContain(id)
  await expect(page.getByTestId('status-revision')).toHaveText('1')
  // and back: the selector is a plain model swap, nothing is remembered between models
  await page.getByTestId('model-select').selectOption('demo-house')
  await expect(page.getByTestId('status-model')).toHaveText('BuildApp demo house')
  expect((await handle(page)).meshCount).toBe(demo.meshCount)
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([])
})

test('visual audit: the six preset views of the reference model', async ({ page }) => {
  await selectMarcowki(page)
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(ART, 'marcowki-01-perspective.png') })
  // the canvas drew a building, not a blank: the perspective view's centre holds several shades
  // (an orthographic top view would show one flat-shaded roof colour there, so the probe is taken here)
  const drawn = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="viewport-canvas"]') as HTMLCanvasElement
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    if (!gl) return 0
    const px = new Uint8Array(4 * 64 * 64)
    gl.readPixels(Math.floor(c.width / 2) - 32, Math.floor(c.height / 2) - 32, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const distinct = new Set<string>()
    for (let i = 0; i < px.length; i += 4) distinct.add(`${px[i]},${px[i + 1]},${px[i + 2]}`)
    return distinct.size
  })
  expect(drawn).toBeGreaterThan(3)
  // the four facades and the roof plan, each an ORTHOGRAPHIC view (the viewport swaps cameras for every preset but
  // 'perspective'); 'left' looks from −x, which is the WEST elevation, and 'right' from +x, the EAST one
  for (const [n, v, compass] of [
    ['02', 'front', 'front'],
    ['03', 'rear', 'rear'],
    ['04', 'left', 'west'],
    ['05', 'right', 'east'],
    ['06', 'top', 'top'],
  ] as const) {
    await page.getByTestId(`view-${v}`).click()
    await expect(page.getByTestId(`view-${v}`)).toHaveClass(/active/)
    await page.waitForTimeout(300)
    await page.screenshot({ path: resolve(ART, `marcowki-${n}-${compass}.png`) })
  }
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([])
})

test('visual audit: roof hidden with the attic interior, and the ground storey alone', async ({ page }) => {
  await selectMarcowki(page)
  const all = (await handle(page)).meshCount
  await page.getByTestId('toggle-roofs').click()
  const noRoof = await handle(page)
  // hiding roofs hides the roof solids, their reveals and the rooflight units: nothing of the roof family remains
  expect(noRoof.objectIds).not.toContain('roof-main')
  expect(noRoof.objectIds).not.toContain('roof-garage')
  expect(noRoof.objectIds).not.toContain('rl-pralnia-w')
  expect(noRoof.objectIds).not.toContain('rl-pralnia-w-unit')
  expect(noRoof.objectIds).toContain('chimney-salon')
  expect(noRoof.meshCount).toBeLessThan(all)
  await page.getByTestId('view-perspective').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(ART, 'marcowki-07-roof-hidden.png') })
  await page.getByTestId('view-top').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(ART, 'marcowki-08-attic-plan-roof-hidden.png') })
  await page.getByTestId('isolate-level').selectOption('ground')
  const ground = await handle(page)
  expect(ground.objectIds).toContain('g-front')
  expect(ground.objectIds).toContain('gw-kitchen-south')
  expect(ground.objectIds).not.toContain('u-front')
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(ART, 'marcowki-09-ground-plan-interior.png') })
  await page.getByTestId('show-all').click()
  expect((await handle(page)).meshCount).toBe(all)
})

test('visual audit: the staircase and the entrance assembly, framed close', async ({ page }) => {
  await selectMarcowki(page)
  // the stair lives on the ground storey and climbs through the slab void: hide the roofs, isolate the ground
  // storey (which drops the upper slab and the attic), then frame the stair itself
  await page.getByTestId('toggle-roofs').click()
  await page.getByTestId('isolate-level').selectOption('ground')
  await page.getByTestId('tree-row-stair-main').click()
  await expect(page.getByTestId('inspector-id')).toHaveText('stair-main')
  await expect(page.getByTestId('inspector-kind')).toHaveText('stair')
  await page.getByTestId('frame-selection').click()
  await expect(page.getByTestId('frame-selection')).toHaveClass(/active/)
  await page.waitForTimeout(400)
  // in context the pantry partitions stand in front of the flights, so the close view isolates the stair itself:
  // the two flights and the winder fan have to be visible as geometry, not inferred from a footprint
  await page.screenshot({ path: resolve(ART, 'marcowki-11b-stair-in-context.png') })
  await page.getByTestId('btn-isolate').click()
  await expect(page.getByTestId('btn-isolate')).toHaveClass(/active/)
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(ART, 'marcowki-11-stair-close.png') })
  // only the stair is drawn, and it is one object of many meshes, not a placeholder block
  expect((await handle(page)).objectIds).toEqual(['stair-main'])
  // the inspector states the stair's real parameters, not a footprint
  await expect(page.getByTestId('detail-kind')).toContainText('FLIGHTS')
  await expect(page.getByTestId('detail-risers')).toContainText('17 × 0.180 m')
  await expect(page.getByTestId('detail-rise')).toContainText('3.060 m')
  await expect(page.getByTestId('detail-segment-1')).toContainText('FLIGHT: 4 risers, going 0.273 m')
  await expect(page.getByTestId('detail-segment-2')).toContainText('WINDER: 4 winders, LEFT 90°')
  await expect(page.getByTestId('detail-segment-3')).toContainText('FLIGHT: 9 risers, going 0.265 m')
  // and it names the slab void the stair rises through, as a link
  await expect(page.getByTestId('detail-slab-void')).toContainText('slab-upper')

  // the entrance: a leaf with a glazed sidelight, framed close on the front facade
  await page.getByTestId('show-all').click()
  await page.getByTestId('tree-row-og-front-entrance-leaf').click()
  await expect(page.getByTestId('inspector-kind')).toHaveText('door')
  await page.getByTestId('frame-selection').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(ART, 'marcowki-12-entrance-close.png') })
  await expect(page.getByTestId('detail-assembly')).toContainText('2 panels, mullions 0.040 m')
  await expect(page.getByTestId('detail-panel-1')).toContainText('LEAF: 0..0.720 of the width')
  await expect(page.getByTestId('detail-panel-2')).toContainText('GLAZED: 0.720..1 of the width')
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([])
})

test('the inspector exposes every capability the stage added: hole, cut mode, assembly, region', async ({ page }) => {
  await selectMarcowki(page)
  // a slab with a hole states the hole and the stair that rises through it
  await page.getByTestId('tree-row-slab-upper').click()
  await expect(page.getByTestId('inspector-kind')).toHaveText('slab')
  await expect(page.getByTestId('detail-holes')).toContainText('1, 4.158 m² removed')
  await expect(page.getByTestId('detail-hole-1')).toContainText('6 vertices')
  await expect(page.getByTestId('detail-stair-through')).toContainText('stair-main')
  // a rooflight opening states its cut mode and where the underside outline lands
  await page.getByTestId('tree-row-rl-schody-e').click()
  await expect(page.getByTestId('inspector-kind')).toHaveText('roofOpening')
  await expect(page.getByTestId('detail-cut')).toContainText('NORMAL_TO_ROOF')
  await expect(page.getByTestId('detail-underside-outline')).toContainText('uphill')
  // the cut mode is an ordinary editable property, and editing it goes through the command path
  await page.getByTestId('prop-cut').selectOption('VERTICAL')
  await expect(page.getByTestId('status-revision')).toHaveText('2')
  await expect(page.getByTestId('detail-underside-outline')).toContainText('vertical cut')
  await page.getByTestId('undo').click()
  await expect(page.getByTestId('detail-cut')).toContainText('NORMAL_TO_ROOF')
  // a surface region is a first-class object in the tree, under the wall it finishes
  await page.getByTestId('tree-row-sr-west-dark').click()
  await expect(page.getByTestId('inspector-kind')).toHaveText('surfaceRegion')
  await expect(page.getByTestId('inspector-host')).toContainText('g-left')
  await expect(page.getByTestId('inspector-evidence-status')).toHaveText('VISUAL_INFERRED')
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([])
})

test('a selected return shows its kind, id, parameters, host and evidence with sources and locator', async ({ page }) => {
  await selectMarcowki(page)
  await page.getByTestId('tree-row-ret-west-front').click()
  await expect(page.getByTestId('inspector-id')).toHaveText('ret-west-front')
  await expect(page.getByTestId('inspector-kind')).toHaveText('wall')
  await expect(page.getByTestId('prop-thickness')).toHaveValue('0.61')
  await expect(page.getByTestId('inspector-host')).toContainText('ground')
  await expect(page.getByTestId('inspector-evidence-status')).toHaveText(/SOURCE_/)
  await expect(page.getByTestId('inspector-evidence-sources')).toContainText('Ground floor plan')
  await expect(page.getByTestId('inspector-evidence-locator')).toContainText('locator:')
  await page.getByTestId('view-perspective').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(ART, 'marcowki-10-selected-return-evidence.png') })
  // a fill's host chain: rooflight → roof opening → roof; a facade opening → its wall; the inspector links each parent
  await page.getByTestId('tree-row-rl-pralnia-w-unit').click()
  await expect(page.getByTestId('inspector-kind')).toHaveText('rooflight')
  await expect(page.getByTestId('inspector-host')).toContainText('rl-pralnia-w')
  await page.getByTestId('inspector-host').getByRole('link').click()
  await expect(page.getByTestId('inspector-id')).toHaveText('rl-pralnia-w')
  await expect(page.getByTestId('inspector-kind')).toHaveText('roofOpening')
  await expect(page.getByTestId('inspector-host')).toContainText('roof-main')
  await page.getByTestId('tree-row-og-front-gable-glazing').click()
  await expect(page.getByTestId('inspector-kind')).toHaveText('opening')
  await expect(page.getByTestId('inspector-host-wall')).toHaveText('u-front')
  await expect(page.getByTestId('inspector-evidence-status')).toHaveText(/SOURCE_/)
  // an ordinary semantic edit on the reference: the roof pitch through the inspector, undone again
  await page.getByTestId('tree-row-roof-main').click()
  await page.getByTestId('prop-pitchDeg').fill('45')
  await page.getByTestId('prop-pitchDeg').press('Enter')
  await expect(page.getByTestId('status-revision')).toHaveText('2')
  await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')
  await page.getByTestId('undo').click()
  await expect(page.getByTestId('status-revision')).toHaveText('3')
})

test('save writes the reference through the normal serializer, byte-equal to the frozen fixture, and load restores it', async ({ page }) => {
  await selectMarcowki(page)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save').click()])
  const text = readFileSync((await download.path())!, 'utf8')
  expect(text).toBe(readFileSync(FIXTURE, 'utf8'))
  writeFileSync(resolve(ART, 'marcowki-ge.json'), text)
  const tris = await page.getByTestId('status-triangles').textContent()
  // switch away, then load the file back: the same model, the same geometry, no reference package involved in loading
  await page.getByTestId('model-select').selectOption('demo-house')
  await expect(page.getByTestId('status-model')).toHaveText('BuildApp demo house')
  await page.getByTestId('load-input').setInputFiles(resolve(ART, 'marcowki-ge.json'))
  await expect(page.getByTestId('status-model')).toHaveText(MARCOWKI)
  await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')
  await expect(page.getByTestId('status-triangles')).toHaveText(tris!)
  await expect(page.getByTestId('model-select')).toHaveValue('marcowki-ge')
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([])
})
