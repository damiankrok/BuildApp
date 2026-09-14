import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ART = resolve(dirname(fileURLToPath(import.meta.url)), '../../../stage-reports/artifacts')
mkdirSync(ART, { recursive: true })

type Handle = {
  store: {
    model: { walls: Array<{ id: string; height: number }>; roofs: Array<{ id: string; pitchDeg: number }>; wallJunctions: Array<{ id: string }>; wallRings: Array<{ id: string }>; name: string }
    describe(id: string): { topology?: { extent?: { start: { outer: number }; end: { outer: number } }; ringClosed?: boolean } } | undefined
  }
  meshCount: number
  objectIds: string[]
}

const handle = (page: Page) => page.evaluate(() => {
  const h = (window as unknown as { __buildworld: Handle }).__buildworld
  return { meshCount: h.meshCount, objectIds: h.objectIds, walls: h.store.model.walls.map((w) => ({ id: w.id, height: w.height })), roofs: h.store.model.roofs.map((r) => ({ id: r.id, pitchDeg: r.pitchDeg })), name: h.store.model.name }
})

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

test('renders the demo building compiled from the model', async ({ page }) => {
  await expect(page.getByTestId('status-model')).toHaveText('BuildApp demo house')
  const tris = Number(await page.getByTestId('status-triangles').textContent())
  expect(tris).toBeGreaterThan(1000)
  await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')
  const h = await handle(page)
  expect(h.meshCount).toBeGreaterThan(50)
  expect(h.objectIds).toContain('g-front')
  expect(h.objectIds).toContain('roof-main')
  // WebGL actually drew something: the canvas is not uniformly the clear colour.
  const drawn = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="viewport-canvas"]') as HTMLCanvasElement
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    if (!gl) return 'no-webgl'
    const px = new Uint8Array(4 * 64 * 64)
    gl.readPixels(Math.floor(c.width / 2) - 32, Math.floor(c.height / 2) - 32, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const distinct = new Set<string>()
    for (let i = 0; i < px.length; i += 4) distinct.add(`${px[i]},${px[i + 1]},${px[i + 2]}`)
    return distinct.size
  })
  expect(typeof drawn).toBe('number')
  expect(drawn as number).toBeGreaterThan(3)
  await page.screenshot({ path: resolve(ART, '01-perspective.png') })
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([])
})

test('scene tree selection drives the inspector; inspector edits update the model and regenerate geometry', async ({ page }) => {
  await page.getByTestId('tree-row-g-front').click()
  await expect(page.getByTestId('inspector-id')).toHaveText('g-front')
  await expect(page.getByTestId('inspector-kind')).toHaveText('wall')
  await expect(page.getByTestId('status-selection')).toHaveText('g-front')
  const before = await handle(page)
  const trisBefore = Number(await page.getByTestId('status-triangles').textContent())
  const height = page.getByTestId('prop-height')
  await expect(height).toHaveValue('3')
  await height.fill('2.7')
  await height.press('Enter')
  await expect(page.getByTestId('status-revision')).toHaveText('1')
  const after = await handle(page)
  expect(after.walls.find((w) => w.id === 'g-front')!.height).toBe(2.7)
  expect(before.walls.find((w) => w.id === 'g-front')!.height).toBe(3)
  // geometry was regenerated from the model (the wall got shorter; triangle count is stable, bounds moved)
  expect(Number(await page.getByTestId('status-triangles').textContent())).toBe(trisBefore)
  // an invalid edit is rejected with an error and the model is unchanged
  await page.getByTestId('tree-row-op-gf-1').click()
  await expect(page.getByTestId('inspector-id')).toHaveText('op-gf-1')
  await expect(page.getByTestId('inspector-host-wall')).toHaveText('g-front')
  await page.getByTestId('prop-width').fill('30')
  await page.getByTestId('prop-width').press('Enter')
  await expect(page.getByTestId('inspector-error')).toContainText('OPENING_OUTSIDE_HOST')
  await expect(page.getByTestId('status-revision')).toHaveText('1')
  // undo restores the wall height
  await page.getByTestId('undo').click()
  const undone = await handle(page)
  expect(undone.walls.find((w) => w.id === 'g-front')!.height).toBe(3)
  await page.getByTestId('redo').click()
  expect((await handle(page)).walls.find((w) => w.id === 'g-front')!.height).toBe(2.7)
})

test('door open angle and roof pitch are editable semantic parameters', async ({ page }) => {
  await page.getByTestId('tree-row-door-entrance').click()
  await expect(page.getByTestId('inspector-kind')).toHaveText('door')
  await page.getByTestId('prop-openAngle').fill('70')
  await page.getByTestId('prop-openAngle').press('Enter')
  await expect(page.getByTestId('status-revision')).toHaveText('1')
  await page.getByTestId('view-front').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(ART, '02-front-door-open.png') })
  await page.getByTestId('tree-row-roof-main').click()
  await page.getByTestId('prop-pitchDeg').fill('50')
  await page.getByTestId('prop-pitchDeg').press('Enter')
  await expect(page.getByTestId('status-revision')).toHaveText('2')
  expect((await handle(page)).roofs.find((r) => r.id === 'roof-main')!.pitchDeg).toBe(50)
  await page.getByTestId('view-left').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(ART, '03-left-pitch-50.png') })
})

test('camera presets, hide/show, isolate, storey isolation, roof toggle and grid/axes work', async ({ page }) => {
  for (const v of ['front', 'rear', 'left', 'right', 'top', 'perspective']) {
    await page.getByTestId(`view-${v}`).click()
    await expect(page.getByTestId(`view-${v}`)).toHaveClass(/active/)
  }
  await page.getByTestId('view-top').click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: resolve(ART, '04-top.png') })
  await page.getByTestId('view-perspective').click()

  const all = (await handle(page)).meshCount
  await page.getByTestId('toggle-roofs').click()
  const noRoof = (await handle(page)).meshCount
  expect(noRoof).toBe(all - 2)
  await expect(page.getByTestId('status-meshes')).toHaveText(`${noRoof}/${all}`)
  await page.getByTestId('toggle-roofs').click()

  await page.getByTestId('isolate-level').selectOption('upper')
  const upperOnly = await handle(page)
  expect(upperOnly.meshCount).toBeLessThan(all)
  expect(upperOnly.objectIds).toContain('u-front')
  expect(upperOnly.objectIds).not.toContain('g-front')
  await page.waitForTimeout(200)
  await page.screenshot({ path: resolve(ART, '05-upper-storey-isolated.png') })
  await page.getByTestId('show-all').click()
  expect((await handle(page)).meshCount).toBe(all)

  await page.getByTestId('eye-g-front').click()
  const hidden = await handle(page)
  expect(hidden.objectIds).not.toContain('g-front')
  expect(hidden.objectIds).not.toContain('door-entrance')
  await page.getByTestId('eye-g-front').click()
  expect((await handle(page)).objectIds).toContain('g-front')

  await page.getByTestId('tree-row-u-left').click()
  await page.getByTestId('btn-isolate').click()
  const iso = await handle(page)
  expect(iso.objectIds.sort()).toEqual(['op-ul-gable', 'u-left', 'win-ul-gable'])
  await page.getByTestId('show-all').click()

  await page.getByTestId('toggle-grid').click()
  await expect(page.getByTestId('toggle-grid')).not.toHaveClass(/active/)
  await page.getByTestId('toggle-axes').click()
  await expect(page.getByTestId('toggle-axes')).not.toHaveClass(/active/)
})

test('clicking geometry in the viewport selects its semantic object', async ({ page }) => {
  await page.getByTestId('view-front').click()
  await page.waitForTimeout(300)
  const canvas = page.getByTestId('viewport-canvas')
  const box = (await canvas.boundingBox())!
  // The front elevation fills the middle of the view; a click there hits the front facade or something on it.
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6)
  await expect(page.getByTestId('status-selection')).not.toHaveText('—')
  const selected = await page.getByTestId('status-selection').textContent()
  await expect(page.getByTestId('inspector-id')).toHaveText(selected!)
  // clicking empty sky clears the selection
  await page.mouse.click(box.x + box.width * 0.5, box.y + 8)
  await expect(page.getByTestId('status-selection')).toHaveText('—')
})

test('save writes canonical JSON and load restores it', async ({ page }) => {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save').click()])
  expect(download.suggestedFilename()).toBe('building-model.json')
  const path = await download.path()
  const text = readFileSync(path!, 'utf8')
  const json = JSON.parse(text) as { schema: string; walls: Array<{ id: string; height: number }>; name: string }
  expect(json.schema).toBe('buildapp.canonical-building-model')
  expect(json.walls.some((w) => w.id === 'g-front')).toBe(true)
  writeFileSync(resolve(ART, 'building-model.json'), text)

  // modify and load back
  json.name = 'Loaded from file'
  json.walls.find((w) => w.id === 'g-front')!.height = 2.8
  const tmp = resolve(ART, 'building-model.modified.json')
  writeFileSync(tmp, JSON.stringify(json))
  await page.getByTestId('load-input').setInputFiles(tmp)
  await expect(page.getByTestId('status-model')).toHaveText('Loaded from file')
  expect((await handle(page)).walls.find((w) => w.id === 'g-front')!.height).toBe(2.8)
  await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')

  // a broken file is refused with an error and nothing changes
  const bad = resolve(ART, 'building-model.bad.json')
  writeFileSync(bad, '{"schema":"nope"}')
  await page.getByTestId('load-input').setInputFiles(bad)
  await expect(page.getByTestId('inspector-error')).toBeVisible()
  await expect(page.getByTestId('status-model')).toHaveText('Loaded from file')
})

test('wall topology is visible and re-resolved after an edit: rings and junctions in the tree, physical extents in the inspector', async ({ page }) => {
  const h = await page.evaluate(() => {
    const w = (window as unknown as { __buildworld: Handle }).__buildworld
    return { junctions: w.store.model.wallJunctions.length, rings: w.store.model.wallRings.map((r) => r.id), right: w.store.describe('g-right')?.topology?.extent }
  })
  expect(h.rings).toEqual(['ring-ground', 'ring-upper'])
  expect(h.junctions).toBeGreaterThanOrEqual(13)
  expect(h.right!.start.outer).toBeCloseTo(0.3, 9)
  expect(h.right!.end.outer).toBeCloseTo(7.7, 9)
  // the ring and its corners are in the scene tree under the level's Topology group (expanded by default); a corner has no meshes
  await expect(page.getByTestId('tree-row-ground:topology')).toBeVisible()
  await page.getByTestId('tree-row-ring-ground').click()
  await expect(page.getByTestId('inspector-kind')).toHaveText('wallRing')
  await expect(page.getByTestId('topology-ring-closed')).toHaveText('yes')
  await page.getByTestId('tree-row-ring-ground-j1').click()
  await expect(page.getByTestId('inspector-kind')).toHaveText('wallJunction')
  await expect(page.getByTestId('topology-junction-ok')).toHaveText('yes')
  expect((await handle(page)).objectIds).toContain('g-front')
  // a wall shows its physical extent; making the front wall thicker moves the right wall's physical start
  await page.getByTestId('tree-row-g-right').click()
  await expect(page.getByTestId('topology-outer')).toHaveText('0.300 – 7.700 m')
  await page.getByTestId('tree-row-g-front').click()
  await page.getByTestId('prop-thickness').fill('0.45')
  await page.getByTestId('prop-thickness').press('Enter')
  await expect(page.getByTestId('status-revision')).toHaveText('1')
  await page.getByTestId('tree-row-g-right').click()
  await expect(page.getByTestId('topology-outer')).toHaveText('0.450 – 7.700 m')
  await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')
  // moving a ring wall on its own is refused by name and nothing changes
  await page.evaluate(() => {
    const w = (window as unknown as { __buildworld: { store: { execute(c: unknown): unknown } } }).__buildworld
    w.store.execute({ type: 'moveFeature', targetId: 'g-front', dz: -1 })
  })
  await expect(page.getByTestId('inspector-error')).toContainText('JUNCTION_GAP')
  await expect(page.getByTestId('status-revision')).toHaveText('1')
})
