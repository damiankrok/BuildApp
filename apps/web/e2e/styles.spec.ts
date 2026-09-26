import { expect, test, type Page } from '@playwright/test'

/**
 * Render styles on the candidate under review (and on the one it replaces).
 *
 * A style is how the viewer draws, never what it draws: each one must leave
 * the compiled geometry as it is (the diagnostics stay "geometry ok", the
 * canvas shows the building), Construction must be what a fresh viewer
 * opens in, and the choice belongs to the viewer rather than to the model,
 * so it survives a model switch. Architectural adds the rules the owner
 * review set: glazing stays translucent, every semantic group is drawn in
 * one colour (no per-object colours), and the thin feature-edge overlay sits
 * on structural groups only.
 */

const MODEL = 'marcowki-auto-v3'
const BASELINE = 'marcowki-auto-v2'
const OTHER_MODEL = 'demo-house'
const STYLES = ['construction', 'clay', 'architectural'] as const

/** The palette groups that ask for a soft feature edge (`edge: 'SOFT'` in the shared palette). */
const STRUCTURAL = new Set(['WALL_MAIN', 'WALL_SECONDARY', 'WALL_INTERIOR', 'WALL_CLADDING', 'ROOF_MAIN', 'FLAT_ROOF', 'ROOF_TRIM', 'SLAB', 'BALCONY_SLAB', 'FACADE_FRAME', 'TERRACE_SURFACE', 'CHIMNEY'])

type GroupProbe = { meshes: number; transparent: number; minOpacity: number; maxOpacity: number; colors: string[]; edges: number }
type Probe = { style: string; edgeOverlays: number; groups: Record<string, GroupProbe> }
type Handle = { probe: () => Probe; memory: () => { geometries: number; textures: number } }

const probe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as { __buildworld: Handle }).__buildworld.probe())
const memory = (page: Page): Promise<{ geometries: number; textures: number }> => page.evaluate(() => (window as unknown as { __buildworld: Handle }).__buildworld.memory())

/** Two animation frames: the render loop has drawn whatever was just set. */
const settle = (page: Page): Promise<void> => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))

/** The centre of the canvas: how many distinct colours it holds, and their mean, so two renders can be compared. */
const sample = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector('[data-testid="viewport-canvas"]') as HTMLCanvasElement
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    if (!gl) return null
    const size = 128
    const px = new Uint8Array(4 * size * size)
    gl.readPixels(Math.floor(c.width / 2) - size / 2, Math.floor(c.height / 2) - size / 2, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const distinct = new Set<string>()
    const mean = [0, 0, 0]
    for (let i = 0; i < px.length; i += 4) {
      distinct.add(`${px[i]},${px[i + 1]},${px[i + 2]}`)
      mean[0] += px[i]
      mean[1] += px[i + 1]
      mean[2] += px[i + 2]
    }
    const n = px.length / 4
    return { distinct: distinct.size, mean: mean.map((v) => Math.round(v / n)) }
  })

async function chooseStyle(page: Page, style: string): Promise<void> {
  await page.getByTestId('style-select').selectOption(style)
  await expect(page.getByTestId('style-select')).toHaveValue(style)
  await expect.poll(async () => (await probe(page)).style).toBe(style)
  await settle(page)
}

async function chooseModel(page: Page, id: string): Promise<void> {
  await page.getByTestId('model-select').selectOption(id)
  await expect(page.getByTestId('model-select')).toHaveValue(id)
  await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')
  await expect(page.getByTestId('status-triangles')).not.toHaveText('0')
  await settle(page)
}

/** The viewport draws a building, not the clear colour. */
async function expectDrawn(page: Page, where: string): Promise<{ distinct: number; mean: number[] }> {
  const s = await sample(page)
  expect(s, `${where}: no WebGL context`).not.toBeNull()
  expect(s!.distinct, `${where}: the canvas is blank`).toBeGreaterThan(3)
  return s!
}

/** The rules every style keeps, and the ones Architectural adds. */
async function expectStyleRules(page: Page, style: string): Promise<void> {
  const p = await probe(page)
  expect(p.style).toBe(style)
  const glass = p.groups.WINDOW_GLASS
  expect(glass, 'the candidate has glazing').toBeDefined()
  expect(glass.transparent, `${style}: every pane is translucent`).toBe(glass.meshes)
  expect(glass.maxOpacity, `${style}: glazing reads through`).toBeLessThanOrEqual(0.5)
  if (style !== 'architectural') return
  expect(p.edgeOverlays, 'architectural draws feature edges').toBeGreaterThan(0)
  for (const [group, g] of Object.entries(p.groups)) {
    expect(g.colors, `${group} is one colour, not one per object`).toHaveLength(1)
    if (!STRUCTURAL.has(group)) expect(g.edges, `${group} is not structural and gets no edge line`).toBe(0)
  }
  expect(glass.minOpacity).toBeCloseTo(0.35, 5)
  expect(p.groups.WALL_MAIN?.edges ?? 0, 'the main walls carry the soft edge').toBeGreaterThan(0)
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

test('each render style draws the analyzer-v2 candidate, and the style survives a model switch', async ({ page }) => {
  test.setTimeout(120_000)
  // A fresh viewer opens in Construction.
  await expect(page.getByTestId('style-select')).toHaveValue('construction')
  expect((await probe(page)).style).toBe('construction')

  await chooseModel(page, MODEL)
  const drawn = new Map<string, number[]>()
  for (const style of STYLES) {
    await chooseStyle(page, style)
    // Styling never changes geometry: the diagnostics and the triangle count stand.
    await expect(page.getByTestId('status-diagnostics')).toHaveText('geometry ok')
    await expectStyleRules(page, style)
    drawn.set(style, (await expectDrawn(page, `${MODEL} in ${style}`)).mean)
  }
  // The styles are really different renders of the same view.
  expect(drawn.get('architectural')).not.toEqual(drawn.get('construction'))
  expect(drawn.get('clay')).not.toEqual(drawn.get('construction'))

  const triangles = await page.getByTestId('status-triangles').textContent()
  for (const style of STYLES) {
    await chooseStyle(page, style)
    await chooseModel(page, OTHER_MODEL)
    await expect(page.getByTestId('style-select'), `${style} survives the switch to ${OTHER_MODEL}`).toHaveValue(style)
    expect((await probe(page)).style).toBe(style)
    await expectDrawn(page, `${OTHER_MODEL} in ${style}`)
    await chooseModel(page, MODEL)
    await expect(page.getByTestId('style-select'), `${style} survives the switch back`).toHaveValue(style)
    await expectStyleRules(page, style)
    await expectDrawn(page, `${MODEL} again in ${style}`)
    await expect(page.getByTestId('status-triangles')).toHaveText(triangles ?? '')
  }
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([])
})

test('switching style and model gives back every edge overlay it built', async ({ page }) => {
  test.setTimeout(120_000)
  await chooseModel(page, MODEL)
  await chooseStyle(page, 'architectural')
  const before = await memory(page)
  expect((await probe(page)).edgeOverlays).toBeGreaterThan(0)
  // Restyle in place, rebuild on a model switch, and come back: what the
  // GPU holds returns to where it was, so no edge overlay leaked.
  await chooseStyle(page, 'clay')
  await chooseStyle(page, 'architectural')
  await chooseModel(page, OTHER_MODEL)
  await chooseModel(page, MODEL)
  await settle(page)
  expect(await memory(page)).toEqual(before)
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([])
})

test('the candidate under review reads as a white body, a dark garage, timber cladding and terraces in Architectural', async ({ page }) => {
  test.setTimeout(120_000)
  await chooseModel(page, MODEL)
  await chooseStyle(page, 'architectural')
  const p = await probe(page)
  for (const group of ['WALL_MAIN', 'WALL_SECONDARY', 'WALL_CLADDING', 'TERRACE_SURFACE', 'ROOF_TRIM', 'FLAT_ROOF', 'RAILING', 'FACADE_FRAME']) {
    expect(p.groups[group], `${MODEL} draws ${group}`).toBeDefined()
  }
  // The garage body is darker than the main body, and both are one colour each.
  const lum = (hex: string): number => {
    const n = parseInt(hex.replace('#', ''), 16)
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const x = v / 255
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  expect(lum(p.groups.WALL_SECONDARY.colors[0])).toBeLessThan(lum(p.groups.WALL_MAIN.colors[0]) - 0.3)
  await expectDrawn(page, `${MODEL} in architectural`)
  // The baseline still loads beside it for comparison.
  await chooseModel(page, BASELINE)
  await expectStyleRules(page, 'architectural')
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([])
})

test('the toolbar fits the window: nothing is pushed off-screen, the page never scrolls sideways', async ({ page }) => {
  const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth - window.innerWidth, toolbar: (() => {
    const t = document.querySelector('[data-testid="toolbar"]') as HTMLElement
    return t.scrollWidth - t.clientWidth
  })() }))
  expect(overflow.page).toBeLessThanOrEqual(0)
  expect(overflow.toolbar).toBeLessThanOrEqual(0)
  for (const id of ['style-select', 'show-all', 'toggle-grid', 'toggle-axes', 'model-select']) {
    const box = await page.getByTestId(id).boundingBox()
    expect(box, id).not.toBeNull()
    expect((box?.x ?? 0) + (box?.width ?? 0), `${id} is inside the window`).toBeLessThanOrEqual(1400)
  }
  // And the canvas below it is still what it was: a real viewport.
  const canvas = await page.getByTestId('viewport-canvas').boundingBox()
  expect(canvas?.height ?? 0).toBeGreaterThan(600)
})
