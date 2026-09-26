/**
 * Owner-review screenshots of sealed candidates from CONSISTENT cameras, and
 * side-by-side comparison sheets, so a reviewer sees an improvement without
 * hunting for angles (stage brief §24).
 *
 *   npm run review:shots -- --candidates marcowki-auto-v2,marcowki-auto \
 *     [--out stage-reports/artifacts/exterior-closure/review] \
 *     [--style construction|clay|architectural] \
 *     [--port 4175 | --url http://127.0.0.1:4173] [--no-build] [--full] [--compose-only]
 *
 * The run drives the PRODUCTION build (`vite build` + `vite preview`, as the
 * e2e config does) in headless Chromium through the same toolbar the owner
 * uses — model selector, style selector, view presets, roof toggle — with
 * Playwright's browser API directly rather than the test runner, so it is a
 * plain script with an exit code. The build goes to `.cache/review-shots/dist`
 * (git-ignored), NOT `apps/web/dist`, so a run never swaps the bundle under an
 * e2e run that is serving `apps/web/dist` at the same time. The preview server
 * starts on --port (default 4175) or, if that port is taken, the next free one.
 *
 * Candidates are selected as the e2e tests do (reconstruction.spec.ts): the
 * `model-select` option, then wait for the selector and `status-model` to show
 * it and `status-diagnostics` to read "geometry ok". A candidate that fails to
 * load (its sealed program no longer replays, say) is reported with the page's
 * own error and skipped; the run carries on and exits 1.
 *
 * For every candidate it writes eight shots into `<out>/<id>/`:
 *
 *   01-front  02-rear  03-left  04-right   the orthographic preset buttons (Front / Rear / Left / Right), then
 *                                          ONE wheel event at the canvas centre (see "Ortho zoom" below)
 *   05-front-34                            the Persp preset (the viewport's default camera: a front-RIGHT
 *                                          three-quarter), then ONE wheel event of ΔY = +360 px at the canvas
 *                                          centre, which OrbitControls turns into distance × 0.95^−3.6 = ×1.2027
 *                                          (dolly is applied at once, not damped)
 *   06-rear-34                             05's camera, then ONE left-button drag of Δx = −round(H/2) px, Δy = 0
 *                                          (H = canvas CSS height, 838 → Δx = −419; 24 pointer-move steps,
 *                                          centred on the canvas): OrbitControls turns Δx into 2π·Δx/H of
 *                                          azimuth, so this is 180° — the rear-LEFT three-quarter, opposite 05
 *   07-top                                 the orthographic Top preset (roof plan), then the ortho wheel event
 *   08-roof-off                            roofs hidden with the toolbar button, then 05's camera exactly
 *
 * With the presets in `src/viewport/camera-presets.ts` (camera at centre +
 * 2.6·r·(0.62, 0.42, 0.70), r = half the compiled bounding-box diagonal) that
 * puts 05/08 at azimuth 41.5° (from the front axis towards +x), elevation
 * 24.2°, distance 3.205·r, and 06 at azimuth 221.5°, same elevation and
 * distance. At 3.205·r the bounding sphere subtends asin(1/3.205) = 18.2°,
 * inside the 21° half field of view, so no candidate is cropped; the preset's
 * own 2.665·r (22.0°) can crop a gable. The run imports those presets and
 * records each shot's numeric pose (position, target, distance, azimuth,
 * elevation, zoom) in manifest.json and the contact sheet, so an edit to the
 * presets shows up in the poses rather than silently moving the cameras.
 *
 * Ortho zoom: the ortho presets frame the bounding SPHERE, which leaves an
 * elevation at about half the frame. A first pass loads every candidate and
 * measures its compiled box; the run then picks ONE wheel ΔY for all ortho
 * views of all candidates — the largest zoom (capped at ×2.5) at which every
 * candidate's box, in every ortho view, keeps its larger half-extent within
 * 1/1.14 of the frame's. Elevations and roof plans therefore share one scale
 * within a candidate and across the candidates side by side. (Adding a larger
 * candidate to a run lowers the zoom for all of them.)
 *
 * Determinism: the controls are damped (factor 0.12 per frame), so after the
 * drag the run waits 300 animation frames — the damped remainder is then
 * 0.88^300 ≈ 2e-17 of the delta, below double precision, whatever the frame
 * rate — and every shot is taken only once two consecutive captures a few
 * frames apart are byte-identical. Repeated runs give byte-identical PNGs.
 *
 * Framing: every preset re-frames on the WHOLE compiled building (hidden parts
 * included), so the roof-off shot has the same camera as the roof-on one. The
 * toolbar's Frame button frames a SELECTED object, so the run makes sure
 * nothing is selected or focused before it shoots.
 *
 * Crop: the app has no control to hide the outliner and inspector columns, so
 * each shot is the viewport canvas of the 1400×900 window — 840×838 with
 * today's layout, the same rectangle for every shot and candidate (checked
 * before every capture) — read from the canvas's own drawing buffer (the
 * renderer keeps it), so the hint line and axes legend drawn over the canvas
 * in the DOM are not in it. `--full` screenshots the whole window instead.
 * The toolbar is wider than 1400 px (Show all, Grid, Axes and the style
 * selector lie off-screen), so buttons are pressed with a dispatched click:
 * a Playwright click would scroll the app sideways to reach them.
 *
 * Style: `--style` picks the toolbar's `style-select` value; without it the run
 * picks `architectural` when the build has that selector, and otherwise shoots
 * the build's only look.
 *
 * Then `compare/<view>.png` puts every candidate's shot of that view side by
 * side (in --candidates order, A, B, C, ...) under a caption bar naming each —
 * with two candidates that is the pair; with more, each pair ALSO gets
 * `compare/<a>--vs--<b>/<view>.png`. Composited with pngjs (the only raster
 * library in node_modules; no sharp or jimp). `<out>/index.html` is a contact
 * sheet of everything and `<out>/manifest.json` the same as data.
 *
 * Blank check: a shot fails the run (exit 1) if it is one colour, or if the
 * building covers under 1% of the frame — measured on a second capture of
 * the same camera with the Grid and Axes toggles off, where every pixel off
 * the clear colour is building. The brief's "> 20 kB" is reported for every
 * shot but does not fail it: a flat-shaded orthographic side elevation
 * compresses to under 20 kB while the building fills 40% of the frame.
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import { PNG } from 'pngjs'
import * as THREE from 'three'
import { framingOf, isOrthographic, presetPosition } from '../src/viewport/camera-presets.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const WEB = resolve(HERE, '..')
const ROOT = resolve(WEB, '../..')
/** Where this run's build goes: git-ignored, and never the apps/web/dist an e2e run may be serving. */
const REVIEW_DIST = resolve(ROOT, '.cache', 'review-shots', 'dist')

// --- arguments --------------------------------------------------------------

const argv = process.argv.slice(2).filter((a) => a !== '--')
const value = (name: string): string | undefined => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined
}
const flag = (name: string): boolean => argv.includes(`--${name}`)

const STYLES = ['construction', 'clay', 'architectural'] as const
type StyleId = (typeof STYLES)[number]
const PREFERRED_STYLE: StyleId = 'architectural'

const usage = [
  'usage: npm run review:shots -- --candidates <id>[,<id>...] [options]',
  '',
  '  --candidates a,b     sealed candidate ids as the toolbar model selector lists them (required)',
  '  --out <dir>          output directory, relative to the repo root (default stage-reports/artifacts/exterior-closure/review)',
  `  --style <s>          ${STYLES.join('|')} (default ${PREFERRED_STYLE} if the build has a style selector)`,
  '  --port <n>           first port to try for the vite preview server this run starts (default 4175; a busy port is skipped)',
  '  --url <url>          use an already running BuildWorld instead of building and starting one',
  '  --no-build           skip `vite build` (serve the last review build in .cache/review-shots/dist, else apps/web/dist)',
  '  --source-note <text> what the app was built from, recorded in the index and manifest (useful with --url)',
  '  --full               shoot the whole 1400x900 window instead of the viewport canvas',
  '  --settle <ms>        extra wait after a preset before the stillness check (default 300)',
  '  --compose-only       no browser: rebuild the compare sheets and index from shots already in <out>',
  '',
].join('\n')

if (flag('help') || argv.length === 0) {
  process.stdout.write(usage)
  process.exit(argv.length === 0 ? 2 : 0)
}

const fail = (msg: string): never => {
  process.stderr.write(`review-shots: ${msg}\n\n${usage}`)
  process.exit(2)
}

const candidates = [
  ...new Set(
    (value('candidates') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ),
]
if (candidates.length === 0) fail('--candidates is required (comma-separated sealed candidate ids)')
for (const id of candidates) if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) fail(`"${id}" is not a candidate id (letters, digits, ".", "_", "-")`)
const styleArg = value('style')?.toLowerCase()
if (styleArg !== undefined && !(STYLES as readonly string[]).includes(styleArg)) fail(`--style must be one of ${STYLES.join(', ')}`)
const outArg = value('out') ?? 'stage-reports/artifacts/exterior-closure/review'
const OUT = isAbsolute(outArg) ? outArg : resolve(ROOT, outArg)
const PORT = Number(value('port') ?? 4175)
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) fail('--port must be an integer in 1024..65535')
const URL_GIVEN = value('url')
const SOURCE_NOTE = value('source-note')
const BUILD = !flag('no-build') && !URL_GIVEN
const FULL = flag('full')
const SETTLE = Number(value('settle') ?? 300)
const COMPOSE_ONLY = flag('compose-only')
const VIEWPORT = { width: 1400, height: 900 }

// --- the camera moves ---------------------------------------------------------

/**
 * The Persp preset is dollied out by one wheel event before the three-quarter shots: on the 840×838 canvas the
 * 1400×900 window leaves, the preset alone crops a gable. OrbitControls scales the camera distance by
 * 0.95^(|ΔY|/100) per wheel event (out for ΔY > 0), applied at once (dolly is not damped): ΔY = +360 is ×1.2027.
 */
const PERSPECTIVE_WHEEL_DY = 360
const DOLLY_FACTOR = Math.pow(0.95, -PERSPECTIVE_WHEEL_DY / 100)
/**
 * Animation frames to wait after a drag: the damped remainder is 0.88^n of the delta. 0.88^300 ≈ 2e-17 is below double
 * precision, so the camera has stopped exactly; a shorter wait (0.88^100 ≈ 3e-6) leaves a ~0.01 px drift that already
 * changes antialiased edge pixels between runs.
 */
const ORBIT_FRAMES = 300
/** The viewport's perspective camera (Viewport.tsx), for the record only. */
const PERSPECTIVE_FOV_DEG = 42
/** The orthographic half-height the viewport gives a framing of radius r (Viewport.tsx). */
const ORTHO_HALF_PER_RADIUS = 1.15
/**
 * The orthographic presets frame the bounding SPHERE, which leaves an elevation at about half the frame. So after
 * each ortho preset the run sends ONE wheel event of ΔY < 0 at the canvas centre, which OrbitControls turns into
 * camera.zoom × 0.95^(ΔY/100) (applied at once; the camera stays centred on the building). ΔY is the same for every
 * ortho view and every candidate in the run — so the four elevations and the roof plan share a scale, and so do
 * the candidates side by side — and is the largest that leaves each candidate's compiled bounding box, projected in
 * each ortho view, with its larger half-extent at most 1/ORTHO_MARGIN of the frame's. Capped at ORTHO_ZOOM_CAP.
 */
const ORTHO_MARGIN = 1.14
const ORTHO_ZOOM_CAP = 2.5
/** The wheel ΔY (≤ 0, whole px) whose zoom is the largest not above `zoom`. */
const wheelForZoom = (zoom: number): number => (zoom <= 1 ? 0 : -Math.floor((100 * Math.log(zoom)) / -Math.log(0.95) + 1e-9))
const zoomOfWheel = (dy: number): number => Math.pow(0.95, dy / 100)

// --- the blank check -----------------------------------------------------------

/** The renderer's clear colour (0x0f1113). */
const CLEAR: [number, number, number] = [15, 17, 19]
/**
 * "Building" coverage is measured on a SECOND capture of the same camera with the toolbar's Grid and Axes turned
 * off, where every pixel further than this from the clear colour is the building (a dark roof included).
 */
const COVERAGE_TOLERANCE = 6
/** Blank (fails the run): one colour, or the building covers under 1% of the frame. */
const MIN_COVERAGE = 0.01
/** The brief's size bar, reported for every shot; flat-shaded orthographic views fall under it without being blank. */
const BRIEF_MIN_BYTES = 20 * 1024


// --- the shot list -----------------------------------------------------------

type Shot = {
  file: string
  view: string
  title: string
  preset: 'front' | 'rear' | 'left' | 'right' | 'top' | 'perspective'
  /** Wheel ΔY at the canvas centre after the preset (perspective only). */
  wheelDY?: number
  /** A left-button drag after the wheel, as a fraction of a full turn of azimuth / polar angle. */
  orbitDeg?: { azimuth: number; polar: number }
  roofsHidden?: boolean
}
const SHOTS: readonly Shot[] = [
  { file: '01-front.png', view: 'front', title: 'Front elevation (orthographic)', preset: 'front' },
  { file: '02-rear.png', view: 'rear', title: 'Rear elevation (orthographic)', preset: 'rear' },
  { file: '03-left.png', view: 'left', title: 'Left elevation, from −x (orthographic)', preset: 'left' },
  { file: '04-right.png', view: 'right', title: 'Right elevation, from +x (orthographic)', preset: 'right' },
  { file: '05-front-34.png', view: 'front-34', title: 'Front-right three-quarter (perspective)', preset: 'perspective', wheelDY: PERSPECTIVE_WHEEL_DY },
  { file: '06-rear-34.png', view: 'rear-34', title: 'Rear-left three-quarter (perspective, 05 orbited 180°)', preset: 'perspective', wheelDY: PERSPECTIVE_WHEEL_DY, orbitDeg: { azimuth: 180, polar: 0 } },
  { file: '07-top.png', view: 'top', title: 'Roof plan (orthographic, from above)', preset: 'top' },
  { file: '08-roof-off.png', view: 'roof-off', title: 'Front-right three-quarter, roofs hidden (perspective)', preset: 'perspective', wheelDY: PERSPECTIVE_WHEEL_DY, roofsHidden: true },
]

type Pose = {
  projection: 'perspective' | 'orthographic'
  position: [number, number, number]
  target: [number, number, number]
  distance: number
  /** Degrees about +y from the front axis (+z, three space) towards +x (the building's right). */
  azimuthDeg: number
  /** Degrees above the horizontal. */
  elevationDeg: number
  /** Perspective: vertical field of view. Orthographic: the zoom after the wheel, and half the visible height in metres. */
  fovDeg?: number
  zoom?: number
  halfHeight?: number
}
type ShotResult = {
  file: string
  view: string
  title: string
  path: string
  bytes: number
  width: number
  height: number
  distinctColours: number
  /** Share of the frame the building covers (from the grid-off capture). */
  coverage: number
  blank: boolean
  /** Larger than the brief's 20 kB. */
  overBriefSize: boolean
  camera: string
  pose: Pose | null
}
type CandidateResult = {
  id: string
  label: string
  modelId: string
  modelName: string
  triangles: number
  meshCount: number
  style: string
  diagnostics: string
  framing: { center: [number, number, number]; radius: number } | null
  shots: ShotResult[]
  pageErrors: string[]
}

// --- small helpers ----------------------------------------------------------

const log = (s: string): void => {
  process.stdout.write(`${s}\n`)
}
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const kb = (n: number): string => `${(n / 1024).toFixed(1)} kB`
const round = (n: number, d = 3): number => Math.round(n * 10 ** d) / 10 ** d
const vec = (v: THREE.Vector3): [number, number, number] => [round(v.x), round(v.y), round(v.z)]

/** Poll `read` until `ok`; `abort`, when it returns a reason, ends the wait early with that reason. */
async function waitFor<T>(what: string, read: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 30_000, abort?: () => string | undefined): Promise<T> {
  const t0 = Date.now()
  let last: T | undefined
  for (;;) {
    last = await read()
    if (ok(last)) return last
    const why = abort?.()
    if (why) throw new Error(`gave up waiting for ${what}: ${why}`)
    if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`)
    await sleep(50)
  }
}

const textOf = async (page: Page, testId: string): Promise<string> => ((await page.getByTestId(testId).textContent()) ?? '').trim()

type PngInfo = { bytes: number; width: number; height: number; distinct: number }

/** Size, and how many distinct colours a sample of the pixels holds. */
function inspectPng(path: string): PngInfo {
  const bytes = statSync(path).size
  const png = PNG.sync.read(readFileSync(path))
  const seen = new Set<number>()
  const d = png.data
  for (let i = 0; i < d.length; i += 4 * 3) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])
  return { bytes, width: png.width, height: png.height, distinct: seen.size }
}

/** The share of pixels off the clear colour, in a capture with the grid and axes off: the building's share of the frame. */
function coverageOf(png: Buffer): number {
  const d = PNG.sync.read(png).data
  let n = 0
  let fg = 0
  for (let i = 0; i < d.length; i += 4) {
    n++
    if (Math.max(Math.abs(d[i] - CLEAR[0]), Math.abs(d[i + 1] - CLEAR[1]), Math.abs(d[i + 2] - CLEAR[2])) > COVERAGE_TOLERANCE) fg++
  }
  return n ? fg / n : 0
}

const isBlank = (i: PngInfo, coverage: number): boolean => i.distinct <= 1 || !(coverage >= MIN_COVERAGE)

const describePng = (i: PngInfo, coverage: number, blank: boolean): string =>
  `${kb(i.bytes).padStart(9)}  ${i.width}×${i.height}  ${String(i.distinct).padStart(5)} colours  building ${Number.isFinite(coverage) ? `${(100 * coverage).toFixed(1).padStart(4)}%` : '   ?'}${blank ? '  <-- BLANK' : i.bytes <= BRIEF_MIN_BYTES ? '  (≤ 20 kB)' : ''}`

// --- the build and the preview server, as the e2e config runs them ---------

const viteBin = resolve(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite')

function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd, stdio: 'inherit' })
    p.on('error', rej)
    p.on('exit', (code) => (code === 0 ? res() : rej(new Error(`${cmd} ${args.join(' ')} exited with ${code}`))))
  })
}

/** Whether nothing listens on 127.0.0.1:port right now. */
function portFree(port: number): Promise<boolean> {
  return new Promise((res) => {
    const srv = createServer()
    srv.once('error', () => res(false))
    srv.listen({ port, host: '127.0.0.1', exclusive: true }, () => srv.close(() => res(true)))
  })
}

type Server = { url: string; stop: () => void }

/**
 * `vite preview` of `distDir` on the first free port from `first`. A port can be taken between the check and vite's
 * bind, so a preview that exits saying so moves on to the next port too. The server counts as up only when vite has
 * printed its own URL with that port AND the URL answers — so a different server that grabbed the port is not
 * mistaken for this one.
 */
async function startPreview(first: number, distDir: string): Promise<Server> {
  const tried: number[] = []
  for (let port = first; port < first + 40 && port <= 65535; port++) {
    if (!(await portFree(port))) {
      tried.push(port)
      continue
    }
    const url = `http://127.0.0.1:${port}`
    const proc: ChildProcess = spawn(viteBin, ['preview', '--outDir', distDir, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: WEB, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    proc.stdout?.on('data', (b: Buffer) => (output += b.toString()))
    proc.stderr?.on('data', (b: Buffer) => (output += b.toString()))
    let exited: number | null | undefined
    proc.on('exit', (code) => (exited = code))
    const stop = (): void => {
      if (exited === undefined) proc.kill('SIGTERM')
    }
    process.on('exit', stop)
    const t0 = Date.now()
    let up = false
    while (!up) {
      if (exited !== undefined) break
      // eslint-disable-next-line no-control-regex
      if (output.replace(/\x1b\[[0-9;]*m/g, '').includes(`:${port}/`)) {
        try {
          up = (await fetch(url)).ok
        } catch {
          /* not answering yet */
        }
      }
      if (up) break
      if (Date.now() - t0 > 60_000) {
        stop()
        throw new Error(`vite preview did not answer on ${url} within 60 s:\n${output}`)
      }
      await sleep(200)
    }
    if (up) {
      if (tried.length) log(`ports ${tried.join(', ')} busy; using ${port}`)
      return { url, stop }
    }
    if (/already in use|EADDRINUSE/i.test(output)) {
      tried.push(port)
      continue
    }
    throw new Error(`vite preview exited with ${exited}:\n${output}`)
  }
  throw new Error(`no free port in ${first}..${first + 39} for vite preview (busy: ${tried.join(', ')})`)
}

/** What the shots were taken from: the commit, how many files in the tree differ from it, and what served the app. */
function describeSource(distDir: string | null): { commit: string; dirtyFiles: number; app: string; note?: string } {
  let commit = 'unknown'
  let dirtyFiles = -1
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
    dirtyFiles = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).length
  } catch {
    /* not a git checkout: the manifest says "unknown" */
  }
  const where = distDir ? relative(ROOT, distDir) : ''
  const app = URL_GIVEN ? `served at ${URL_GIVEN} (not built by this run)` : BUILD ? `built by this run from the working tree into ${where}` : `the existing build in ${where}`
  return { commit, dirtyFiles, app, ...(SOURCE_NOTE ? { note: SOURCE_NOTE } : {}) }
}

// --- driving the app ---------------------------------------------------------

type Box = { x: number; y: number; width: number; height: number }

async function canvasBox(page: Page): Promise<Box> {
  const box = await page.getByTestId('viewport-canvas').boundingBox()
  if (!box) throw new Error('the viewport canvas has no bounding box')
  return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) }
}

/** The canvas's CSS height, which is what OrbitControls divides a drag by. */
const canvasClientHeight = (page: Page): Promise<number> => page.getByTestId('viewport-canvas').evaluate((c) => (c as HTMLCanvasElement).clientHeight)

/** Resolve after `n` animation frames; the viewport runs its controls' update and a render on every one. */
const frames = (page: Page, n: number): Promise<void> =>
  page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        let i = 0
        const tick = (): void => {
          i += 1
          if (i >= count) done()
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    n,
  )

/**
 * Orbit the perspective camera with ONE left-button drag of a fixed delta. OrbitControls turns a horizontal drag of
 * Δx px into 2π·Δx/clientHeight of azimuth (and a vertical one into the same fraction of polar angle), independent of
 * the canvas width, so Δx = clientHeight·deg/360 is an exact angle. The drag is centred on the canvas so both ends stay
 * on it. Returns the deltas used and the angles they amount to.
 */
async function orbit(page: Page, box: Box, clientHeight: number, azimuthDeg: number, polarDeg: number): Promise<{ dx: number; dy: number; azimuthDeg: number; polarDeg: number }> {
  const dx = -Math.round((azimuthDeg / 360) * clientHeight)
  const dy = -Math.round((polarDeg / 360) * clientHeight)
  const x0 = Math.round(box.x + box.width / 2 - dx / 2)
  const y0 = Math.round(box.y + box.height / 2 - dy / 2)
  await page.mouse.move(x0, y0)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(x0 + dx, y0 + dy, { steps: 24 })
  await page.mouse.up({ button: 'left' })
  return { dx, dy, azimuthDeg: (-360 * dx) / clientHeight, polarDeg: (-360 * dy) / clientHeight }
}

/** One wheel event at the canvas centre (see PERSPECTIVE_WHEEL_DY). */
async function wheel(page: Page, box: Box, deltaY: number): Promise<void> {
  await page.mouse.move(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2))
  await page.mouse.wheel(0, deltaY)
}

/**
 * Press a toolbar button. The toolbar is wider than a 1400 px window (its right end — Show all, Grid, Axes, style —
 * lies off-screen), and a Playwright click scrolls an off-screen button into view by scrolling the app's
 * `overflow: hidden` root sideways, which moves the canvas. A dispatched click reaches React's handler the same way
 * and scrolls nothing.
 */
async function press(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).dispatchEvent('click')
}

/** Undo any scrolling of the page or its containers, so the layout is the one the window opened with. */
const unscroll = (page: Page): Promise<void> =>
  page.evaluate(() => {
    for (const el of [document.scrollingElement, ...Array.from(document.querySelectorAll('*'))])
      if (el && (el.scrollLeft !== 0 || el.scrollTop !== 0)) {
        el.scrollLeft = 0
        el.scrollTop = 0
      }
  })

async function selectPreset(page: Page, preset: string): Promise<void> {
  const btn = page.getByTestId(`view-${preset}`)
  await press(page, `view-${preset}`)
  await waitFor(`view-${preset} to be active`, () => btn.getAttribute('class'), (c) => /\bactive\b/.test(c ?? ''))
}

/** The canvas box and drawing-buffer size the run started with; every capture checks they still hold. */
let referenceCanvas: { box: Box; width: number; height: number } | null = null
const canvasBuffer = (page: Page): Promise<{ width: number; height: number }> => page.getByTestId('viewport-canvas').evaluate((c) => ({ width: (c as HTMLCanvasElement).width, height: (c as HTMLCanvasElement).height }))

async function checkLayout(page: Page): Promise<void> {
  await unscroll(page)
  const box = await canvasBox(page)
  const buf = await canvasBuffer(page)
  if (!referenceCanvas) referenceCanvas = { box, ...buf }
  const r = referenceCanvas
  if (box.x !== r.box.x || box.y !== r.box.y || box.width !== r.box.width || box.height !== r.box.height || buf.width !== r.width || buf.height !== r.height)
    throw new Error(`the viewport canvas moved or resized: ${JSON.stringify({ box, ...buf })}, expected ${JSON.stringify(r)}`)
}

/** The canvas's own drawing buffer as a PNG (the viewport renders with preserveDrawingBuffer): no DOM overlay, no page position. */
async function canvasPng(page: Page): Promise<Buffer> {
  const url = await page.getByTestId('viewport-canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL('image/png'))
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
}

/**
 * Capture until two consecutive captures, a few frames apart, are byte-identical: the camera and the scene are at
 * rest. The viewport canvas's pixels, or with --full a screenshot of the whole window unless `canvasOnly`.
 */
async function captureStill(page: Page, canvasOnly = false): Promise<Buffer> {
  await checkLayout(page)
  const grab = (): Promise<Buffer> => (FULL && !canvasOnly ? page.screenshot() : canvasPng(page))
  let prev = await grab()
  const t0 = Date.now()
  for (;;) {
    await frames(page, 3)
    const next = await grab()
    if (next.equals(prev)) return next
    if (Date.now() - t0 > 15_000) throw new Error('the viewport did not come to rest within 15 s')
    prev = next
  }
}

/** Turn a toolbar toggle button (Grid, Axes: "active" when on) on or off. */
async function setToggle(page: Page, testId: string, on: boolean): Promise<void> {
  const btn = page.getByTestId(testId)
  const isOn = async (): Promise<boolean> => /\bactive\b/.test((await btn.getAttribute('class')) ?? '')
  if ((await isOn()) === on) return
  await press(page, testId)
  await waitFor(`${testId} to be ${on ? 'on' : 'off'}`, isOn, (v) => v === on, 5_000)
}

/** The building's share of the frame: the same camera captured again with the grid and axes off, then both back on. */
async function measureCoverage(page: Page): Promise<number> {
  await setToggle(page, 'toggle-grid', false)
  await setToggle(page, 'toggle-axes', false)
  const bare = await captureStill(page, true)
  await setToggle(page, 'toggle-grid', true)
  await setToggle(page, 'toggle-axes', true)
  return coverageOf(bare)
}

/** What the viewport drew (meshCount: set by its geometry effect) next to what the store says is visible now. */
type Handle = { meshCount: number; visible: number; id: string; name: string }
const handle = (page: Page): Promise<Handle> =>
  page.evaluate(() => {
    const h = (window as unknown as { __buildworld: { store: { model: { id: string; name: string }; visibleMeshes: () => unknown[] }; meshCount: number } }).__buildworld
    return { meshCount: h.meshCount, visible: h.store.visibleMeshes().length, id: h.store.model.id, name: h.store.model.name }
  })

/** The box the viewport frames every preset on: every compiled mesh (hidden ones too), in three space (z mirrored). */
const compiledBounds = (page: Page): Promise<{ min: [number, number, number]; max: [number, number, number] } | null> =>
  page.evaluate(() => {
    type P = { x: number; y: number; z: number }
    const h = (window as unknown as { __buildworld: { store: { getSnapshot: () => { scene: { meshes: Array<{ triangles: Array<{ a: P; b: P; c: P }> }> } } } } }).__buildworld
    const min: [number, number, number] = [Infinity, Infinity, Infinity]
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
    for (const m of h.store.getSnapshot().scene.meshes)
      for (const t of m.triangles)
        for (const p of [t.a, t.b, t.c]) {
          const q = [p.x, p.y, -p.z]
          for (let k = 0; k < 3; k++) {
            if (q[k] < min[k]) min[k] = q[k]
            if (q[k] > max[k]) max[k] = q[k]
          }
        }
    return Number.isFinite(min[0]) ? { min, max } : null
  })

type Bounds = { min: [number, number, number]; max: [number, number, number] }

/**
 * The largest orthographic zoom at which the box, centred as the presets centre it, fits every ortho view with
 * ORTHO_MARGIN to spare: front/rear see x by y, left/right z by y, top x by z. `aspect` is the canvas width / height.
 */
function orthoFit(b: Bounds, radius: number, aspect: number): number {
  const half = (k: number): number => Math.max(1e-6, (b.max[k] - b.min[k]) / 2)
  const availV = ORTHO_HALF_PER_RADIUS * radius
  const availH = availV * aspect
  const views: Array<[number, number]> = [
    [half(0), half(1)],
    [half(2), half(1)],
    [half(0), half(2)],
  ]
  return Math.min(...views.map(([h, v]) => Math.min(availH / (h * ORTHO_MARGIN), availV / (v * ORTHO_MARGIN))))
}

/**
 * The pose a shot's camera ends in, from the app's own preset function: the preset position, the wheel's dolly
 * about the target, then the drag's spherical rotation (OrbitControls: θ += −2π·Δx/H, φ += −2π·Δy/H).
 */
function poseOf(shot: Shot, framing: { center: THREE.Vector3; radius: number }, orbitRad: { theta: number; phi: number } | null, orthoZoom: number): Pose {
  const { position } = presetPosition(shot.preset, framing)
  const offset = position.clone().sub(framing.center)
  if (shot.wheelDY) offset.multiplyScalar(Math.pow(0.95, -shot.wheelDY / 100))
  if (orbitRad) {
    const s = new THREE.Spherical().setFromVector3(offset)
    s.theta += orbitRad.theta
    s.phi = Math.min(Math.PI - 1e-6, Math.max(1e-6, s.phi + orbitRad.phi))
    offset.setFromSpherical(s)
  }
  const cam = framing.center.clone().add(offset)
  const distance = offset.length()
  const azimuth = ((THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z)) % 360) + 360) % 360
  const elevation = THREE.MathUtils.radToDeg(Math.asin(offset.y / distance))
  const ortho = isOrthographic(shot.preset)
  return {
    projection: ortho ? 'orthographic' : 'perspective',
    position: vec(cam),
    target: vec(framing.center),
    distance: round(distance),
    azimuthDeg: round(azimuth, 2),
    elevationDeg: round(elevation, 2),
    ...(ortho ? { zoom: round(orthoZoom, 4), halfHeight: round((framing.radius * ORTHO_HALF_PER_RADIUS) / orthoZoom) } : { fovDeg: PERSPECTIVE_FOV_DEG }),
  }
}

const describePose = (p: Pose): string =>
  `${p.projection} · camera (${p.position.join(', ')}) → target (${p.target.join(', ')}) · distance ${p.distance} m · azimuth ${p.azimuthDeg}° · elevation ${p.elevationDeg}°${p.fovDeg ? ` · fov ${p.fovDeg}°` : ` · zoom ${p.zoom} · half-height ${p.halfHeight} m`}`

/** Nothing selected, nothing focused, everything visible: the state every preset frames from. */
async function resetViewState(page: Page): Promise<void> {
  await press(page, 'show-all')
  // Escape clears the selection; the key handler ignores it while a <select> has focus, so take focus off the selectors first
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('Escape')
  if ((await textOf(page, 'frame-selection')) === 'Unframe') await press(page, 'frame-selection')
  if ((await textOf(page, 'toggle-roofs')) === 'Show roofs') await press(page, 'toggle-roofs')
  await setToggle(page, 'toggle-grid', true)
  await setToggle(page, 'toggle-axes', true)
  await waitFor('nothing selected', () => textOf(page, 'status-selection'), (t) => t === '—' || t === '', 5_000).catch(() => undefined)
}

/** The toolbar's style selector, if the build has one: set it to the requested style, or the preferred one. */
async function applyStyle(page: Page): Promise<string> {
  const sel = page.getByTestId('style-select')
  if ((await sel.count()) === 0) {
    if (styleArg) log(`warning: --style ${styleArg} ignored: this build has no style selector`)
    return 'default (this build has no style selector)'
  }
  const offered = await sel.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))
  const want = styleArg ?? (offered.includes(PREFERRED_STYLE) ? PREFERRED_STYLE : undefined)
  if (!want) return `${await sel.inputValue()} (the selector's default; it offers no ${PREFERRED_STYLE})`
  if (!offered.includes(want)) throw new Error(`the style selector offers no "${want}"; it lists: ${offered.join(', ')}`)
  await sel.selectOption(want)
  await waitFor(`style-select to read "${want}"`, () => sel.inputValue(), (v) => v === want, 5_000)
  return want
}

type Loaded = { id: string; label: string; modelId: string; modelName: string; triangles: number; meshCount: number; diagnostics: string; bounds: Bounds | null; framing: { center: THREE.Vector3; radius: number } | null }

/**
 * Select a candidate in the toolbar's model selector and wait until the viewport draws it, as the e2e tests do:
 * the selector shows it, the status bar names it and reads "geometry ok". Then reset the view state and measure
 * the compiled box every preset frames on.
 */
async function loadCandidate(page: Page, id: string, style: string, warnings: string[], pageErrors: readonly string[], quiet = false): Promise<Loaded> {
  const say = (s: string): void => {
    if (!quiet) log(s)
  }
  const select = page.getByTestId('model-select')
  const option = select.locator(`option[value="${id}"]`)
  if ((await option.count()) === 0) {
    const values = await select.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== '__file'))
    throw new Error(`the model selector offers no "${id}"; it lists: ${values.join(', ')}`)
  }
  const label = ((await option.textContent()) ?? '').trim()
  say(`\n== ${id}  (${label})`)
  const n0 = pageErrors.length
  await select.selectOption(id)
  // The selector's value follows the model on screen (it falls back to the previous model when a candidate fails to
  // load), so this is the candidate loaded rather than the click registered; then the status bar names it, as the
  // e2e tests wait for. A candidate that throws while loading says so on the page; that ends the wait at once.
  await waitFor(`the model selector to show ${id}`, () => select.inputValue(), (v) => v === id, 30_000, () => (pageErrors.length > n0 ? `the page reported: ${pageErrors.slice(n0).join(' | ')}` : undefined))
  const drawn = await waitFor(`the viewport to draw ${id}`, () => handle(page), (h) => h.meshCount > 0 && h.meshCount === h.visible)
  await waitFor(`status-model to read "${drawn.name}"`, () => textOf(page, 'status-model'), (t) => t === drawn.name)
  if (drawn.name !== label) say(`   (the model is named "${drawn.name}", the selector says "${label}")`)
  let diagnostics = ''
  try {
    diagnostics = await waitFor('status-diagnostics to read "geometry ok"', () => textOf(page, 'status-diagnostics'), (t) => t === 'geometry ok', 15_000)
  } catch {
    diagnostics = await textOf(page, 'status-diagnostics')
    if (!quiet) warnings.push(`${id}: the status bar reads "${diagnostics}", not "geometry ok"; shot anyway`)
  }
  await waitFor('status-triangles > 0', () => textOf(page, 'status-triangles'), (t) => Number(t) > 0)
  if ((await page.getByTestId('style-select').count()) > 0 && !style.startsWith('default')) {
    const now = await page.getByTestId('style-select').inputValue()
    if (!style.startsWith(now)) throw new Error(`the style selector reads "${now}" after loading ${id}, not "${style}"`)
  }
  await resetViewState(page)
  const all = await handle(page)
  const bounds = await compiledBounds(page)
  const framing = bounds ? framingOf(new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max))) : null
  say(`   style ${style} · ${diagnostics} · ${all.meshCount} meshes`)
  if (framing && bounds)
    say(`   framed on centre (${vec(framing.center).join(', ')}), radius ${round(framing.radius)} m; box ${round(bounds.max[0] - bounds.min[0], 2)} × ${round(bounds.max[1] - bounds.min[1], 2)} × ${round(bounds.max[2] - bounds.min[2], 2)} m (x × y × z)`)
  return { id, label, modelId: all.id, modelName: all.name, triangles: Number(await textOf(page, 'status-triangles')), meshCount: all.meshCount, diagnostics, bounds, framing }
}

async function shootCandidate(page: Page, id: string, style: string, ortho: { dy: number; zoom: number }, warnings: string[], pageErrors: readonly string[]): Promise<Omit<CandidateResult, 'pageErrors'>> {
  const dir = resolve(OUT, id)
  mkdirSync(dir, { recursive: true })
  // this run's shots replace the last run's; a candidate that fails below leaves none behind to be mistaken for current
  for (const s of SHOTS) rmSync(resolve(dir, s.file), { force: true })
  const c = await loadCandidate(page, id, style, warnings, pageErrors)
  const shots: ShotResult[] = []

  for (const s of SHOTS) {
    const t0 = Date.now()
    const path = resolve(dir, s.file)
    const steps: string[] = []
    if (s.roofsHidden) {
      // roofs go BEFORE the preset is applied, so nothing re-frames after the wheel below
      if ((await textOf(page, 'toggle-roofs')) === 'Hide roofs') await press(page, 'toggle-roofs')
      try {
        await waitFor('the roof meshes to go', () => handle(page), (h) => h.meshCount < c.meshCount, 5_000)
      } catch {
        warnings.push(`${id}: hiding roofs removed no meshes (the candidate may have no roof objects)`)
      }
      steps.push('"Hide roofs"')
    }
    await selectPreset(page, s.preset)
    steps.push(`preset ${s.preset} (re-frames on the whole building)`)
    await frames(page, 2)
    await sleep(SETTLE)
    const ortho3 = isOrthographic(s.preset)
    const wheelDY = ortho3 ? ortho.dy : (s.wheelDY ?? 0)
    let orbitRad: { theta: number; phi: number } | null = null
    if (wheelDY || s.orbitDeg) {
      await checkLayout(page)
      const box = await canvasBox(page)
      if (wheelDY) {
        await wheel(page, box, wheelDY)
        steps.push(`wheel ΔY=${wheelDY > 0 ? '+' : ''}${wheelDY} at the canvas centre (${ortho3 ? `zoom ×${zoomOfWheel(wheelDY).toFixed(4)}` : `distance ×${Math.pow(0.95, -wheelDY / 100).toFixed(4)}`})`)
      }
      if (s.orbitDeg) {
        const h = await canvasClientHeight(page)
        const o = await orbit(page, box, h, s.orbitDeg.azimuth, s.orbitDeg.polar)
        orbitRad = { theta: THREE.MathUtils.degToRad(o.azimuthDeg), phi: THREE.MathUtils.degToRad(o.polarDeg) }
        steps.push(`left-drag Δx=${o.dx} px, Δy=${o.dy} px on the ${box.width}×${h} px canvas (${round(o.azimuthDeg, 2)}° azimuth, ${round(o.polarDeg, 2)}° polar)`)
        await frames(page, ORBIT_FRAMES)
      } else {
        await frames(page, 4)
      }
    }
    const tMove = Date.now()
    writeFileSync(path, await captureStill(page))
    const tShot = Date.now()
    const coverage = await measureCoverage(page)
    const info = inspectPng(path)
    const blank = isBlank(info, coverage)
    const pose = c.framing ? poseOf({ ...s, wheelDY: ortho3 ? undefined : s.wheelDY }, c.framing, orbitRad, ortho3 ? zoomOfWheel(ortho.dy) : 1) : null
    shots.push({
      file: s.file,
      view: s.view,
      title: s.title,
      path,
      bytes: info.bytes,
      width: info.width,
      height: info.height,
      distinctColours: info.distinct,
      coverage,
      blank,
      overBriefSize: info.bytes > BRIEF_MIN_BYTES,
      camera: steps.join(', then '),
      pose,
    })
    log(`   ${s.file.padEnd(16)} ${describePng(info, coverage, blank)}   [${((tMove - t0) / 1000).toFixed(1)} + ${((tShot - tMove) / 1000).toFixed(1)} + ${((Date.now() - tShot) / 1000).toFixed(1)} s]`)
    if (s.roofsHidden) {
      await press(page, 'show-all')
      await waitFor('the roofs to come back', () => handle(page), (h) => h.meshCount === c.meshCount, 5_000)
    }
  }
  return {
    id,
    label: c.label,
    modelId: c.modelId,
    modelName: c.modelName,
    triangles: c.triangles,
    meshCount: c.meshCount,
    style,
    diagnostics: c.diagnostics,
    framing: c.framing ? { center: vec(c.framing.center), radius: round(c.framing.radius) } : null,
    shots,
  }
}

// --- compositing with pngjs --------------------------------------------------

/** A 5×7 bitmap font: enough for candidate ids and view names in a caption bar. Lower case is drawn as upper. */
const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '(': ['..#..', '.#...', '#....', '#....', '#....', '.#...', '..#..'],
  ')': ['..#..', '...#.', '....#', '....#', '....#', '...#.', '..#..'],
  '/': ['.....', '....#', '...#.', '..#..', '.#...', '#....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
}
const ADVANCE = 6 // 5 columns + 1 of spacing, in font cells

const asciiUpper = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toUpperCase()

function fillRect(png: PNG, x: number, y: number, w: number, h: number, rgb: [number, number, number]): void {
  for (let yy = Math.max(0, y); yy < Math.min(png.height, y + h); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(png.width, x + w); xx++) {
      const i = (yy * png.width + xx) * 4
      png.data[i] = rgb[0]
      png.data[i + 1] = rgb[1]
      png.data[i + 2] = rgb[2]
      png.data[i + 3] = 255
    }
}

const textWidth = (text: string, scale: number): number => Math.max(0, text.length * ADVANCE * scale - scale)

/** Draw `text`, cut with ".." to fit `maxWidth` px. Returns the width drawn. */
function drawText(png: PNG, x: number, y: number, text: string, scale: number, rgb: [number, number, number], maxWidth = Infinity): number {
  let t = asciiUpper(text)
  if (textWidth(t, scale) > maxWidth) {
    const fit = Math.max(0, Math.floor((maxWidth + scale) / (ADVANCE * scale)) - 2)
    t = `${t.slice(0, fit)}..`
  }
  let cx = x
  for (const ch of t) {
    const g = GLYPHS[ch] ?? GLYPHS['?']
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '#') fillRect(png, cx + c * scale, y + r * scale, scale, scale, rgb)
    cx += ADVANCE * scale
  }
  return textWidth(t, scale)
}

const BG: [number, number, number] = [15, 17, 19]
const BAR: [number, number, number] = [27, 31, 36]
const INK: [number, number, number] = [230, 233, 238]
const DIM: [number, number, number] = [150, 158, 168]
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** The shots side by side, left to right, under a caption bar naming each candidate, and the view at the bar's right end. */
function composeRow(items: Array<{ path: string; id: string; letter: string }>, view: string, outPath: string): { bytes: number; width: number; height: number } {
  const imgs = items.map((it) => PNG.sync.read(readFileSync(it.path)))
  const gap = 8
  const bar = 48
  const cellW = Math.max(...imgs.map((i) => i.width))
  const cellH = Math.max(...imgs.map((i) => i.height))
  const width = cellW * imgs.length + gap * (imgs.length - 1)
  const height = bar + cellH
  const out = new PNG({ width, height })
  fillRect(out, 0, 0, width, height, BG)
  fillRect(out, 0, 0, width, bar, BAR)
  const scale = 3
  const tagScale = 2
  const ty = Math.floor((bar - 7 * scale) / 2)
  let lastCaptionEnd = 0
  imgs.forEach((img, k) => {
    const x = k * (cellW + gap)
    PNG.bitblt(img, out, 0, 0, img.width, img.height, x, bar)
    const w = drawText(out, x + 16, ty, `${items[k].letter}  ${items[k].id}`, scale, INK, cellW - 32)
    lastCaptionEnd = x + 16 + w
  })
  // the view name at the right end of the bar, clear of the last caption
  const tagX = width - 16 - textWidth(view, tagScale)
  if (tagX > lastCaptionEnd + 24) drawText(out, tagX, Math.floor((bar - 7 * tagScale) / 2), view, tagScale, DIM)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, PNG.sync.write(out))
  return { bytes: statSync(outPath).size, width, height }
}

// --- the contact sheet -------------------------------------------------------

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const rel = (p: string): string => relative(OUT, p).split('\\').join('/')

type CompareSheet = { ids: string[]; view: string; title: string; path: string; bytes: number; width: number; height: number }

function writeIndex(
  results: CandidateResult[],
  failed: ReadonlyArray<{ id: string; error: string }>,
  sheets: CompareSheet[],
  commandLine: string,
  source: { commit: string; dirtyFiles: number; app: string; note?: string },
  warnings: string[],
  orthoZoom: { dy: number; zoom: number } | null,
): string {
  const path = resolve(OUT, 'index.html')
  const letter = new Map(results.map((c, k) => [c.id, LETTERS[k] ?? String(k + 1)]))
  const candidateSections = results
    .map(
      (c) => `
<section class="candidate" id="${esc(c.id)}">
  <h2>${esc(letter.get(c.id) ?? '')} · ${esc(c.id)} <small>${esc(c.label)} · model ${esc(c.modelId)} · ${c.triangles.toLocaleString('en')} triangles · ${c.meshCount} meshes · style ${esc(c.style)} · ${esc(c.diagnostics)}${c.framing ? ` · framed on centre (${c.framing.center.join(', ')}), r ${c.framing.radius} m` : ''}</small></h2>
  <div class="grid">
${c.shots
  .map(
    (s) => `    <figure class="${s.blank ? 'blank' : ''}">
      <a href="${esc(rel(s.path))}"><img loading="lazy" src="${esc(rel(s.path))}" alt="${esc(c.id)} ${esc(s.view)}" width="${s.width}" height="${s.height}"></a>
      <figcaption><b>${esc(s.file.replace('.png', ''))}</b> ${esc(s.title)}<br><span class="meta">${kb(s.bytes)}${s.overBriefSize ? '' : ' (≤ 20 kB)'} · ${s.distinctColours} colours · building ${Number.isFinite(s.coverage) ? `${(100 * s.coverage).toFixed(0)}%` : '?'} of the frame${s.blank ? ' · BLANK' : ''}</span><br><span class="camera">${esc(s.camera)}${s.pose ? `<br>${esc(describePose(s.pose))}` : ''}</span></figcaption>
    </figure>`,
  )
  .join('\n')}
  </div>
</section>`,
    )
    .join('\n')
  const groups = new Map<string, CompareSheet[]>()
  for (const s of sheets) {
    const key = s.ids.join(' · ')
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const compareSections = [...groups.values()]
    .map(
      (group) => `
<section class="compare">
  <h2>Side by side <small>${group[0].ids.map((id) => `${esc(letter.get(id) ?? '')} ${esc(id)}`).join(' · ')} — left to right, same camera</small></h2>
${group
  .map(
    (s) => `  <figure>
    <figcaption><b>${esc(s.view)}</b> ${esc(s.title)} <span class="meta">${esc(rel(s.path))} · ${kb(s.bytes)}</span></figcaption>
    <a href="${esc(rel(s.path))}"><img loading="lazy" src="${esc(rel(s.path))}" alt="${esc(s.ids.join(' vs '))} ${esc(s.view)}" width="${s.width}" height="${s.height}"></a>
  </figure>`,
  )
  .join('\n')}
</section>`,
    )
    .join('\n')
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Candidate review shots</title>
<style>
  :root { color-scheme: dark; --bg: #0f1113; --panel: #1b1f24; --ink: #e6e9ee; --dim: #969ea8; --line: #2a3038; --warn: #e5645a; }
  body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 32px 0 12px; }
  small { font-weight: normal; color: var(--dim); }
  .meta, .camera { color: var(--dim); font-size: 12px; }
  .camera { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; overflow-wrap: anywhere; }
  p.lead { color: var(--dim); margin: 0 0 8px; max-width: 90ch; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--panel); padding: 1px 5px; border-radius: 3px; overflow-wrap: anywhere; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr)); gap: 14px; }
  figure { margin: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px; }
  figure.blank { border-color: var(--warn); }
  figure img { display: block; width: 100%; height: auto; background: var(--bg); border-radius: 3px; }
  figcaption { margin-top: 6px; }
  .compare figure { margin-bottom: 18px; }
  .compare figcaption { margin: 0 0 6px; }
  ul.notes { color: var(--dim); font-size: 13px; padding-left: 18px; max-width: 110ch; }
  ul.warnings { color: var(--warn); font-size: 13px; padding-left: 18px; }
</style>
</head>
<body>
<h1>Candidate review shots</h1>
<p class="lead">Eight owner-review views of ${results.length === 1 ? 'one sealed candidate' : `${results.length} sealed candidates`} (${results.map((c) => `${esc(letter.get(c.id) ?? '')} ${esc(c.id)}`).join(', ')}), each from the same cameras: the four orthographic elevations (at one shared scale), the front-right three-quarter (the Persp preset dollied out by one fixed wheel step), the rear-left three-quarter (that camera orbited 180° by one fixed drag), the roof plan, and the front-right three-quarter with roofs hidden. Every preset re-frames on the whole building, so the views line up across the roof-on/roof-off pair, and across candidates of similar size.</p>
<p class="lead">Generated ${new Date().toISOString()} by <code>${esc(commandLine)}</code>. Window ${VIEWPORT.width}×${VIEWPORT.height}; shots are ${FULL ? 'the whole window' : 'the viewport canvas (the app cannot hide its side panels), text overlays hidden'}. The script ran in a tree at commit <code>${esc(source.commit)}</code>${source.dirtyFiles > 0 ? ` with ${source.dirtyFiles} uncommitted file${source.dirtyFiles === 1 ? '' : 's'}` : ''}; the app was ${esc(source.app)}.${source.note ? ` <b>Source:</b> ${esc(source.note)}` : ''}</p>
${failed.length ? `<ul class="warnings">\n${failed.map((f) => `  <li><b>${esc(f.id)} was not shot:</b> ${esc(f.error)}</li>`).join('\n')}\n</ul>` : ''}
${warnings.length ? `<ul class="warnings">\n${warnings.map((w) => `  <li>${esc(w)}</li>`).join('\n')}\n</ul>` : ''}
<ul class="notes">
  <li>Under each shot: how it was taken (toolbar steps and exact mouse deltas), then the camera pose that works out to from the app's preset function. Azimuth is measured about +y from the front axis towards the building's right (+x); elevation above the horizontal; lengths in metres, three space (z mirrored from the model).</li>
  <li>"Building" is the share of the frame the building covers, measured on a second capture of the same camera with the Grid and Axes toggles off. A shot outlined in red is blank (one colour, or the building under 1% of the frame) and the run exited non-zero. "≤ 20 kB" marks a shot under the brief's size bar: flat-shaded orthographic views compress that far while full of building.</li>
  <li>Orthographic views: the preset, then one wheel event of ΔY = ${orthoZoom ? orthoZoom.dy : '?'} (zoom ×${orthoZoom ? orthoZoom.zoom.toFixed(4) : '?'}), the same for every ortho view and candidate in this run, so elevations share one scale.</li>
</ul>
${candidateSections}
${compareSections}
</body>
</html>
`
  writeFileSync(path, html)
  return path
}

// --- main ---------------------------------------------------------------------

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  const commandLine = `npm run review:shots -- ${argv.join(' ')}`
  const warnings: string[] = []
  const results: CandidateResult[] = []
  /** Candidates that could not be shot: the run goes on with the others and exits non-zero. */
  const failed: Array<{ id: string; error: string }> = []
  let distDir: string | null = null
  let orthoZoom: { dy: number; zoom: number; fits: Array<{ id: string; fit: number }> } | null = null

  if (COMPOSE_ONLY) {
    // Rebuild the sheets and the index from what is already on disk; the manifest, if there, carries the metadata.
    const manifestPath = resolve(OUT, 'manifest.json')
    const prior = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { candidates?: CandidateResult[]; cameraMoves?: { ortho?: typeof orthoZoom } }) : {}
    const previous = prior.candidates ?? []
    orthoZoom = prior.cameraMoves?.ortho ?? null
    for (const id of candidates) {
      const known = previous.find((c) => c.id === id)
      const shots: ShotResult[] = SHOTS.map((s) => {
        const path = resolve(OUT, id, s.file)
        if (!existsSync(path)) throw new Error(`--compose-only: ${path} is missing; run without --compose-only first`)
        const info = inspectPng(path)
        const was = known?.shots.find((k) => k.file === s.file)
        const coverage = was?.coverage ?? Number.NaN // measured on the grid-off capture, which only a shooting run makes
        return {
          file: s.file,
          view: s.view,
          title: s.title,
          path,
          bytes: info.bytes,
          width: info.width,
          height: info.height,
          distinctColours: info.distinct,
          coverage,
          blank: isBlank(info, coverage),
          overBriefSize: info.bytes > BRIEF_MIN_BYTES,
          camera: was?.camera ?? '(from a previous run)',
          pose: was?.pose ?? null,
        }
      })
      results.push({
        id,
        label: known?.label ?? id,
        modelId: known?.modelId ?? '?',
        modelName: known?.modelName ?? '?',
        triangles: known?.triangles ?? 0,
        meshCount: known?.meshCount ?? 0,
        style: known?.style ?? '?',
        diagnostics: known?.diagnostics ?? '?',
        framing: known?.framing ?? null,
        shots,
        pageErrors: known?.pageErrors ?? [],
      })
    }
  } else {
    if (!URL_GIVEN) {
      if (BUILD) {
        log(`building apps/web (vite build) into ${relative(ROOT, REVIEW_DIST)} ...`)
        await run(viteBin, ['build', '--outDir', REVIEW_DIST, '--emptyOutDir', '--logLevel', 'warn'], WEB)
        distDir = REVIEW_DIST
      } else {
        distDir = [REVIEW_DIST, resolve(WEB, 'dist')].find((d) => existsSync(resolve(d, 'index.html'))) ?? null
        if (!distDir) throw new Error(`--no-build: neither ${relative(ROOT, REVIEW_DIST)} nor apps/web/dist holds a build; run without --no-build`)
      }
    }
    const server: Server = URL_GIVEN ? { url: URL_GIVEN, stop: (): void => {} } : await startPreview(PORT, distDir!)
    const onSignal = (): void => {
      server.stop()
      process.exit(130)
    }
    process.once('SIGINT', onSignal)
    process.once('SIGTERM', onSignal)
    log(`BuildWorld at ${server.url}`)
    let browser: Browser | null = null
    try {
      browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
      const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
      const page = await context.newPage()
      const pageErrors: string[] = []
      page.on('pageerror', (e) => pageErrors.push(e.message))
      page.on('console', (m) => {
        if (m.type() === 'error') pageErrors.push(m.text())
      })
      await page.goto(server.url)
      await waitFor('the viewport canvas', () => page.getByTestId('viewport-canvas').isVisible(), (v) => v)
      await waitFor('the first model to draw', () => textOf(page, 'status-triangles'), (t) => Number(t) > 0)
      await checkLayout(page) // the first call records the layout every later capture must match
      const box = await canvasBox(page)
      log(`canvas ${box.width}×${box.height} at (${box.x}, ${box.y}) in the ${VIEWPORT.width}×${VIEWPORT.height} window`)
      const style = await applyStyle(page)
      const fail1 = async (id: string, e: unknown, n0: number): Promise<void> => {
        // say what the page said: a candidate that will not load usually explains itself in the console
        const error = e instanceof Error ? e.message : String(e)
        for (const pe of pageErrors.slice(n0)) log(`   page error: ${pe}`)
        log(`   FAILED ${id}: ${error}`)
        failed.push({ id, error })
        for (const s of SHOTS) rmSync(resolve(OUT, id, s.file), { force: true })
        await page.keyboard.press('Escape').catch(() => undefined)
      }
      // Pass 1: load every candidate once to measure it, so the orthographic zoom can be one for the whole run.
      log(`\nmeasuring ${candidates.join(', ')} ...`)
      const measured: Loaded[] = []
      for (const id of candidates) {
        const n0 = pageErrors.length
        try {
          measured.push(await loadCandidate(page, id, style, warnings, pageErrors, true))
        } catch (e) {
          await fail1(id, e, n0)
        }
      }
      const aspect = box.width / box.height
      const fits = measured.filter((m) => m.bounds && m.framing).map((m) => ({ id: m.id, fit: orthoFit(m.bounds!, m.framing!.radius, aspect) }))
      const zoomWanted = Math.max(1, Math.min(ORTHO_ZOOM_CAP, ...fits.map((f) => f.fit)))
      const dy = wheelForZoom(zoomWanted)
      orthoZoom = { dy, zoom: zoomOfWheel(dy), fits: fits.map((f) => ({ id: f.id, fit: round(f.fit, 4) })) }
      log(`orthographic zoom for this run: wheel ΔY=${dy} → ×${orthoZoom.zoom.toFixed(4)} (largest that fits: ${fits.map((f) => `${f.id} ×${f.fit.toFixed(3)}`).join(', ') || 'none'}; cap ×${ORTHO_ZOOM_CAP})`)
      // Pass 2: shoot.
      for (const m of measured) {
        const n0 = pageErrors.length
        try {
          const r = await shootCandidate(page, m.id, style, orthoZoom, warnings, pageErrors)
          results.push({ ...r, pageErrors: pageErrors.slice(n0) })
        } catch (e) {
          await fail1(m.id, e, n0)
        }
      }
      if (pageErrors.length) warnings.push(...pageErrors.map((e) => `page error: ${e}`))
    } finally {
      await browser?.close()
      server.stop()
    }
  }

  // --- the side-by-side sheets: all candidates per view, and every pair when there are more than two ---
  const sheets: CompareSheet[] = []
  const compareDir = resolve(OUT, 'compare')
  rmSync(compareDir, { recursive: true, force: true }) // everything in it is generated; no sheet from an earlier candidate set survives
  if (results.length < 2 && candidates.length >= 2) warnings.push(`no side-by-side sheets: only ${results.length} of ${candidates.length} candidates were shot`)
  if (results.length >= 2) {
    const groups: Array<{ members: CandidateResult[]; dir: string }> = [{ members: results, dir: compareDir }]
    if (results.length > 2)
      for (let i = 0; i < results.length; i++) for (let j = i + 1; j < results.length; j++) groups.push({ members: [results[i], results[j]], dir: resolve(compareDir, `${results[i].id}--vs--${results[j].id}`) })
    const letterOf = new Map(results.map((c, k) => [c.id, LETTERS[k] ?? String(k + 1)]))
    for (const g of groups) {
      log(`\n== compare ${g.members.map((c) => `${c.id} (${letterOf.get(c.id)})`).join(' | ')} -> ${rel(g.dir)}/`)
      for (const s of SHOTS) {
        const outPath = resolve(g.dir, `${s.view}.png`)
        const items = g.members.map((c) => ({ path: c.shots.find((x) => x.file === s.file)!.path, id: c.id, letter: letterOf.get(c.id)! }))
        const info = composeRow(items, s.view, outPath)
        sheets.push({ ids: g.members.map((c) => c.id), view: s.view, title: s.title, path: outPath, ...info })
        log(`   ${`${s.view}.png`.padEnd(16)} ${kb(info.bytes).padStart(9)}  ${info.width}×${info.height}`)
      }
    }
  }

  const source = describeSource(distDir)
  const index = writeIndex(results, failed, sheets, commandLine, source, warnings, orthoZoom)
  const manifest = {
    generatedAt: new Date().toISOString(),
    commandLine,
    source,
    window: VIEWPORT,
    clip: FULL ? 'window' : 'viewport-canvas (text overlays hidden)',
    cameraMoves: {
      presets: 'apps/web/src/viewport/camera-presets.ts (imported by this run)',
      perspective: { wheelDeltaY: PERSPECTIVE_WHEEL_DY, distanceFactor: round(DOLLY_FACTOR, 5) },
      rearThreeQuarter: { dragDeltaX: '-round(canvas clientHeight / 2)', dragDeltaY: 0, azimuthDeg: 180, framesWaited: ORBIT_FRAMES },
      ortho: orthoZoom ? { ...orthoZoom, zoom: round(orthoZoom.zoom, 5), margin: ORTHO_MARGIN, cap: ORTHO_ZOOM_CAP } : null,
    },
    blankRule: { failsWhen: 'one colour, or building coverage < 1% (measured with grid and axes off)', minCoverage: MIN_COVERAGE, briefMinBytesExclusive: BRIEF_MIN_BYTES, briefSizeIsReportedNotFailed: true },
    shots: SHOTS,
    candidates: results.map((c) => ({ ...c, shots: c.shots.map((s) => ({ ...s, path: rel(s.path) })) })),
    compare: sheets.map((s) => ({ ...s, path: rel(s.path) })),
    failed,
    warnings,
  }
  writeFileSync(resolve(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  const blank = results.flatMap((c) => c.shots.filter((s) => s.blank).map((s) => `${c.id}/${s.file}`))
  const small = results.flatMap((c) => c.shots.filter((s) => !s.overBriefSize).map((s) => `${c.id}/${s.file} (${kb(s.bytes)}, building ${(100 * s.coverage).toFixed(0)}%)`))
  log(`\nindex:    ${index}`)
  log(`manifest: ${resolve(OUT, 'manifest.json')}`)
  for (const w of warnings) log(`warning: ${w}`)
  for (const f of failed) log(`FAILED ${f.id}: ${f.error}`)
  if (failed.length) process.exitCode = 1
  if (small.length) log(`at or under the brief's 20 kB (flat-shaded views compress that far; not blank unless flagged below): ${small.join(', ')}`)
  if (blank.length) {
    log(`BLANK shots (one colour, or the building under ${100 * MIN_COVERAGE}% of the frame): ${blank.join(', ')}`)
    process.exitCode = 1
  } else if (results.length) {
    log(`all ${results.reduce((n, c) => n + c.shots.length, 0)} shots non-blank (> 1 colour, building ≥ ${100 * MIN_COVERAGE}% of the frame); ${results.reduce((n, c) => n + c.shots.filter((s) => s.overBriefSize).length, 0)} over 20 kB`)
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`review-shots: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`)
  process.exit(1)
})
