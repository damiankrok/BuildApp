/**
 * `npm run overlays:v2` — the v2 analyzer's visual debugger.
 *
 * With no arguments it reads the Marcówki artifacts under
 * `stage-reports/artifacts/analyzer-v2/` (and the sealed source package and
 * observation graph under `stage-reports/artifacts/source-observations/`),
 * and writes self-contained SVG overlays beside them: the drawing embedded
 * once as the publisher's own bytes, and what the analyzer believes drawn on
 * top in vector.
 *
 *   source-atlas/<frame>.svg         every source frame: its pixel grid, the research atlas' view
 *                                    for it and the analyzer's sightings on it, as labelled boxes
 *   plan-overlays/<storey>.svg       every registered plan with the BuildingV2 projected back to pixels
 *   elevation-overlays/<side>.svg    every registered render with the metric grid, the openings, roof,
 *                                    members and the source-view residuals
 *   perspective-overlays/<frame>.svg every camera the solver attempted, with the envelope projected
 *                                    through the camera when one can be had
 *   overlays-index.json              every file written, with its frame
 *
 * Options: --package --graph --artifacts --slug --atlas --cache --out --no-cameras
 *
 * Reads JSON by path only: no reference package, no source truth, nothing
 * under research/ is imported. Nothing is re-encoded: the embedded image is
 * the cached publisher bytes, whatever their size.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { SourcePackageSchema, decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { SourceObservationGraphSchema } from '@buildapp/source-observations'
import type { BuildingV2 } from '../src/v2/building.js'
import type { ElevationRegistrationV2, PlanFrameV2, WorldFrameV2 } from '../src/v2/frame.js'
import type { SourceViewResidual } from '../src/v2/verify.js'
import type { EnvelopeForCamera, PerspectiveCameraV2 } from '../src/v2/camera.js'

// ---------------------------------------------------------------------------
// What the artifacts carry
// ---------------------------------------------------------------------------

type Graph = ReturnType<typeof SourceObservationGraphSchema.parse>
type Frame = Graph['coordinateFrames'][number]
type Raster = ReturnType<typeof decodeImage>

/** `registrations.json` writes a plan frame without its closures (and without `wallPx`). */
type SerialisedPlan = Pick<PlanFrameV2, 'frameId' | 'assetId' | 'storeyIndex' | 'mppX' | 'mppY' | 'originPx' | 'why'> & { wallPx?: number }
type CameraSummary = { frameId: string; solved: boolean; residualPx?: number; why: string }
type Registrations = {
  plans: SerialisedPlan[]
  elevations: ElevationRegistrationV2[]
  section?: { frameId: string; mpp: number; originCol: number; zeroRow: number }
  cameras: CameraSummary[]
  world: WorldFrameV2
}
type Residuals = { candidateHash: string; residuals: SourceViewResidual[] }
type Lineage = { sightings?: Array<{ id: string; frameId: string; what: string; confidence?: number; pixelRect?: { x0: number; y0: number; x1: number; y1: number } }> }
type AtlasView = {
  viewId: string
  sourceFamily?: string
  projectionModel?: string
  renderingCharacter?: string
  annotationMode?: string
  storeyRelevance?: string
  orientationHypothesis?: string
  caption?: string | null
  packageAssetIds?: string[]
  packageRoles?: Record<string, string>
  selectedVariant?: { assetId?: string; byteHash?: string; variantId?: string }
  siblingVariants?: Array<{ assetId?: string; byteHash?: string; variantId?: string }>
  [key: string]: unknown
}
type Atlas = { schema?: string; schemaVersion?: string; method?: string; views: AtlasView[] }

type Side = 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT'
type Box = { x0: number; z0: number; x1: number; z1: number }
type Rect = { x0: number; y0: number; x1: number; y1: number }
type IndexEntry = { kind: 'source-atlas' | 'plan' | 'elevation' | 'perspective'; path: string; frameId: string; assetId?: string; storeyIndex?: number; side?: Side; solved?: boolean; note?: string }

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (v: number): string => (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '0')
const HALO = 'stroke="#ffffff" stroke-width="3" paint-order="stroke"'

const C = {
  grid: '#0ea5e9',
  mass: '#0369a1',
  envelope: '#64748b',
  recess: '#0d9488',
  ret: '#7c3aed',
  iwall: '#1d4ed8',
  door: '#16a34a',
  room: '#f59e0b',
  block: '#475569',
  chimney: '#dc2626',
  stair: '#db2777',
  opening: '#16a34a',
  gap: '#0f766e',
  roof: '#ea580c',
  attached: '#c2410c',
  balcony: '#a16207',
  railing: '#4f46e5',
  verge: '#c026d3',
  rooflight: '#0891b2',
  level: '#94a3b8',
  ok: '#16a34a',
  bad: '#dc2626',
  anchor: '#facc15',
  atlas: '#9333ea',
  sighting: '#0f766e',
} as const

const svgOpen = (width: number, height: number, title: string, href?: string): string =>
  [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-monospace, Menlo, monospace">`,
    `<title>${esc(title)}</title>`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${C.stair}"/></marker></defs>`,
    href ? `<image href="${href}" x="0" y="0" width="${width}" height="${height}"/>` : `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`,
  ].join('\n')

const rectEl = (r: Rect, attrs: string, title?: string): string => {
  const x0 = Math.min(r.x0, r.x1)
  const y0 = Math.min(r.y0, r.y1)
  const w = Math.abs(r.x1 - r.x0)
  const h = Math.abs(r.y1 - r.y0)
  return `<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}" ${attrs}>${title ? `<title>${esc(title)}</title>` : ''}</rect>`
}
const lineEl = (x1: number, y1: number, x2: number, y2: number, attrs: string, title?: string): string =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${attrs}>${title ? `<title>${esc(title)}</title>` : ''}</line>`
const polyEl = (points: ReadonlyArray<{ x: number; y: number }>, attrs: string, title?: string, closed = true): string =>
  `<${closed ? 'polygon' : 'polyline'} points="${points.map((p) => `${n(p.x)},${n(p.y)}`).join(' ')}" ${attrs}>${title ? `<title>${esc(title)}</title>` : ''}</${closed ? 'polygon' : 'polyline'}>`
const label = (x: number, y: number, text: string, colour: string, size = 11, anchor: 'start' | 'middle' | 'end' = 'start'): string =>
  `<text x="${n(x)}" y="${n(y)}" font-size="${size}" text-anchor="${anchor}" fill="${colour}" ${HALO}>${esc(text)}</text>`

/** Break a line at spaces so it fits `maxChars` columns of monospace; a continuation is indented. */
function wrap(line: string, maxChars: number): string[] {
  const out: string[] = []
  let rest = line
  while (rest.length > maxChars) {
    const cut = rest.lastIndexOf(' ', maxChars)
    const at = cut > maxChars * 0.4 ? cut : maxChars
    out.push(rest.slice(0, at))
    rest = `  ${rest.slice(at).trimStart()}`
  }
  out.push(rest)
  return out
}

/** A translucent box of lines, top-left, that says what the sheet is. Long lines wrap; small frames get small type. */
const legend = (width: number, lines: readonly string[], colour: string, at: { x: number; y: number } = { x: 8, y: 8 }): string => {
  const w = Math.min(width - 16, 760)
  const size = width < 600 ? 8 : 11
  const lead = size + 5
  const rows = lines.flatMap((l) => wrap(l, Math.floor((w - 16) / (size * 0.62))))
  const out = [`<rect x="${at.x}" y="${at.y}" width="${w}" height="${lead * rows.length + 10}" fill="#ffffff" fill-opacity="0.88" stroke="${colour}" stroke-width="1.5"/>`]
  rows.forEach((l, i) => out.push(`<text x="${at.x + 8}" y="${at.y + size + 6 + i * lead}" font-size="${size}" fill="#0f172a">${esc(l)}</text>`))
  return out.join('\n')
}

/** The pixel grid of a frame: fine lines every `step`, heavy and labelled every fifth. */
function pixelGrid(width: number, height: number): string {
  const longest = Math.max(width, height)
  const step = [5, 10, 20, 25, 50, 100, 200, 250, 500].find((s) => longest / s <= 40) ?? 500
  const out: string[] = []
  for (let x = 0; x <= width; x += step) {
    const heavy = (x / step) % 5 === 0
    out.push(lineEl(x, 0, x, height, `stroke="${C.grid}" stroke-opacity="${heavy ? 0.5 : 0.2}" stroke-width="${heavy ? 1 : 0.5}"`))
    if (heavy && x > 0) out.push(label(x + 2, 11, String(x), C.grid, 9))
  }
  for (let y = 0; y <= height; y += step) {
    const heavy = (y / step) % 5 === 0
    out.push(lineEl(0, y, width, y, `stroke="${C.grid}" stroke-opacity="${heavy ? 0.5 : 0.2}" stroke-width="${heavy ? 1 : 0.5}"`))
    if (heavy && y > 0) out.push(label(2, y - 2, String(y), C.grid, 9))
  }
  return out.join('\n')
}

// ---------------------------------------------------------------------------
// The frames' mappings, rebuilt from what was serialised
// ---------------------------------------------------------------------------

/**
 * `registrations.json` keeps a plan's `mppX`, `mppY` and `originPx` — the
 * pixel of world (x = 0, z = 0), the west outer face on the front outer plane.
 * Both v2 registrations (`planFrameV2`, `planFrameByOuterFaces`) put the sheet's
 * bottom at the front, so z grows UP the sheet: px = ox + x / mppX, py = oy − z / mppY.
 * That inverts exactly; only `wallPx` is missing and is taken from the wall thickness.
 */
type PlanMap = { toPixel: (x: number, z: number) => { x: number; y: number }; mpp: number; wallPx: number; wallPxWhy: string }
const planMapOf = (p: SerialisedPlan, wallThicknessM: number): PlanMap => {
  const mpp = (p.mppX + p.mppY) / 2
  const derived = p.wallPx === undefined
  return {
    toPixel: (x, z) => ({ x: p.originPx.x + x / p.mppX, y: p.originPx.y - z / p.mppY }),
    mpp,
    wallPx: p.wallPx ?? wallThicknessM / mpp,
    wallPxWhy: derived ? `wallPx not serialised; ${wallThicknessM.toFixed(3)} m of wall at ${(mpp * 1000).toFixed(2)} mm/px` : 'wallPx from the registration',
  }
}

/** The metric helpers of `elevationFrameFromV2`, from the serialised registration alone. */
type ElevationMap = { pxOf: (along: number) => number; pyOf: (y: number) => number; alongOf: (px: number) => number; yOf: (py: number) => number }
const elevationMapOf = (r: ElevationRegistrationV2): ElevationMap => ({
  pxOf: (along) => r.extent.x0 + (r.alongSign * (along - r.alongAtLeft)) / r.mpp,
  pyOf: (y) => r.zeroRow - y / r.mpp,
  alongOf: (px) => r.alongAtLeft + r.alongSign * (px - r.extent.x0) * r.mpp,
  yOf: (py) => (r.zeroRow - py) * r.mpp,
})

const sideOfFacade = (f: 'FRONT' | 'REAR' | 'WEST' | 'EAST'): Side => (f === 'WEST' ? 'LEFT' : f === 'EAST' ? 'RIGHT' : f)
const alongAxis = (side: Side): 'x' | 'z' => (side === 'FRONT' || side === 'REAR' ? 'x' : 'z')
/** Which facade a box on the plan belongs to: the envelope plane its centre is nearest. */
function sideOfBox(b: Box, e: Box): Side {
  const cx = (b.x0 + b.x1) / 2
  const cz = (b.z0 + b.z1) / 2
  const d: Array<[Side, number]> = [
    ['FRONT', Math.abs(cz - e.z0)],
    ['REAR', Math.abs(e.z1 - cz)],
    ['LEFT', Math.abs(cx - e.x0)],
    ['RIGHT', Math.abs(e.x1 - cx)],
  ]
  d.sort((a, b) => a[1] - b[1])
  return d[0][0]
}
const alongRange = (b: Box, side: Side): [number, number] => (alongAxis(side) === 'x' ? [b.x0, b.x1] : [b.z0, b.z1])

/** The main roof's top surface over a plan point, as `reconstruct-v2` defines it for the chimneys. */
function roofTopY(b: BuildingV2, x: number, z: number): number {
  const roof = b.mainRoof
  const main = b.masses.find((m) => m.role === 'MAIN') ?? b.masses[0]
  if (!roof || !main) return Math.max(...b.levels.map((l) => l.wallTop))
  const tan = Math.tan((roof.pitchDeg * Math.PI) / 180)
  const across = roof.ridgeAxis === 'Z' ? x : z
  const half = roof.ridgeAxis === 'Z' ? (main.x1 - main.x0) / 2 : (main.z1 - main.z0) / 2
  return roof.ridgeY - Math.min(half, Math.abs(across - roof.ridgeAt)) * tan
}

const frameSlug = (frameId: string): string => frameId.replace(/^frame-/, '')
const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

// ---------------------------------------------------------------------------
// 1. Source atlas sheets
// ---------------------------------------------------------------------------

/** Any object in the atlas view shaped like a pixel box, wherever it sits, with the best label it carries. */
function atlasRects(view: AtlasView): Array<{ rect: Rect; label: string }> {
  const out: Array<{ rect: Rect; label: string }> = []
  const skip = new Set(['selectedVariant', 'siblingVariants', 'facts', 'specifications', 'rooms', 'packageRoles'])
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  const walk = (o: unknown, path: string): void => {
    if (Array.isArray(o)) {
      o.forEach((v, i) => walk(v, `${path}[${i}]`))
      return
    }
    if (!o || typeof o !== 'object') return
    const r = o as Record<string, unknown>
    const name = [r.label, r.id, r.name, r.kind, r.role].find((v): v is string => typeof v === 'string') ?? path
    if (isNum(r.x0) && isNum(r.y0) && isNum(r.x1) && isNum(r.y1)) out.push({ rect: { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 }, label: name })
    else if (isNum(r.x) && isNum(r.y) && isNum(r.width) && isNum(r.height)) out.push({ rect: { x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height }, label: name })
    for (const [k, v] of Object.entries(r)) if (!skip.has(k) && typeof v === 'object') walk(v, path ? `${path}.${k}` : k)
  }
  walk(view, '')
  return out
}

function sourceAtlasSheet(frame: Frame, href: string | undefined, decoded: Raster | undefined, atlas: Atlas | undefined, lineage: Lineage | undefined, registered: string[]): string {
  const { width, height } = frame.size
  const parts = [svgOpen(width, height, `${frame.assetId} — source atlas`, href), pixelGrid(width, height)]
  const views = (atlas?.views ?? []).filter((v) => v.selectedVariant?.byteHash === frame.variantByteHash || (v.packageAssetIds ?? []).includes(frame.assetId) || (v.siblingVariants ?? []).some((s) => s.byteHash === frame.variantByteHash))
  let boxes = 0
  for (const v of views) {
    for (const { rect, label: what } of atlasRects(v)) {
      boxes += 1
      parts.push(rectEl(rect, `fill="${C.atlas}" fill-opacity="0.08" stroke="${C.atlas}" stroke-width="1.5"`, `${v.viewId}: ${what}`))
      parts.push(label(Math.min(rect.x0, rect.x1) + 3, Math.min(rect.y0, rect.y1) + 12, what, C.atlas))
    }
  }
  const sightings = (lineage?.sightings ?? []).filter((s) => s.frameId === frame.id && s.pixelRect)
  for (const s of sightings) {
    const r = s.pixelRect as Rect
    parts.push(rectEl(r, `fill="${C.sighting}" fill-opacity="0.1" stroke="${C.sighting}" stroke-width="1.2" stroke-dasharray="4 3"`, `${s.id}: ${s.what}`))
    parts.push(label(Math.min(r.x0, r.x1) + 2, Math.max(r.y0, r.y1) + 11, s.what, C.sighting, 9))
  }
  const lines = [
    `${frame.id} — ${frame.assetId}`,
    `${width}×${height} px (${decoded ? `decoded ${decoded.width}×${decoded.height}` : 'bytes not in cache'}); roles ${frame.roles.document}/${frame.roles.storey}/${frame.roles.view}/${frame.roles.projection}`,
    ...(registered.length > 0 ? registered.map((r) => `registered: ${r}`) : ['not registered by the v2 analyzer']),
    ...(views.length > 0
      ? views.flatMap((v) => [
          `atlas ${v.viewId}: ${v.sourceFamily ?? '?'} / ${v.projectionModel ?? '?'} / ${v.renderingCharacter ?? '?'} / ${v.annotationMode ?? '?'} / ${v.storeyRelevance ?? '?'}${v.selectedVariant?.byteHash === frame.variantByteHash ? ' (selected variant)' : ' (sibling)'}`,
          `  orientation: ${v.orientationHypothesis ?? '—'}`,
        ])
      : [atlas ? 'no atlas view lists this frame' : 'no atlas given']),
    `${boxes} atlas box${boxes === 1 ? '' : 'es'}, ${sightings.length} analyzer sighting${sightings.length === 1 ? '' : 's'} with a pixel rect (dashed)`,
  ]
  parts.push(legend(width, lines, C.atlas))
  parts.push('</svg>')
  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// 2. Plan overlays
// ---------------------------------------------------------------------------

function planSheet(plan: SerialisedPlan, frame: Frame, href: string | undefined, b: BuildingV2, world: WorldFrameV2): { svg: string; note?: string } {
  const { width, height } = frame.size
  const s = plan.storeyIndex
  const m = planMapOf(plan, b.wallThicknessM)
  const P = m.toPixel
  const boxRect = (box: Box): Rect => {
    const a = P(box.x0, box.z1)
    const c = P(box.x1, box.z0)
    return { x0: a.x, y0: a.y, x1: c.x, y1: c.y }
  }
  const parts = [svgOpen(width, height, `storey ${s} — ${frame.assetId}`, href)]
  const e = world.envelope

  // The world grid, one metre, clipped to the envelope and a metre around it.
  const clip = boxRect({ x0: e.x0 - 1, x1: e.x1 + 1, z0: e.z0 - 1, z1: e.z1 + 1 })
  parts.push(`<clipPath id="env"><rect x="${n(clip.x0)}" y="${n(clip.y0)}" width="${n(clip.x1 - clip.x0)}" height="${n(clip.y1 - clip.y0)}"/></clipPath>`)
  const grid: string[] = []
  for (let x = Math.floor(e.x0 - 1); x <= Math.ceil(e.x1 + 1); x += 1) {
    const a = P(x, e.z0 - 1)
    const c = P(x, e.z1 + 1)
    grid.push(lineEl(a.x, a.y, c.x, c.y, `stroke="${C.grid}" stroke-opacity="${x % 5 === 0 ? 0.45 : 0.2}" stroke-width="${x % 5 === 0 ? 1 : 0.6}"`))
    grid.push(label(a.x + 2, a.y - 2, `x${x}`, C.grid, 9))
  }
  for (let z = Math.floor(e.z0 - 1); z <= Math.ceil(e.z1 + 1); z += 1) {
    const a = P(e.x0 - 1, z)
    const c = P(e.x1 + 1, z)
    grid.push(lineEl(a.x, a.y, c.x, c.y, `stroke="${C.grid}" stroke-opacity="${z % 5 === 0 ? 0.45 : 0.2}" stroke-width="${z % 5 === 0 ? 1 : 0.6}"`))
    grid.push(label(a.x + 2, a.y - 2, `z${z}`, C.grid, 9))
  }
  parts.push(`<g clip-path="url(#env)">${grid.join('')}</g>`)
  const o = P(0, 0)
  parts.push(lineEl(o.x - 10, o.y, o.x + 10, o.y, `stroke="${C.envelope}" stroke-width="1.5"`), lineEl(o.x, o.y - 10, o.x, o.y + 10, `stroke="${C.envelope}" stroke-width="1.5"`), label(o.x + 4, o.y + 14, 'x=0 z=0 (front outer plane)', C.envelope, 9))
  parts.push(rectEl(boxRect(e), `fill="none" stroke="${C.envelope}" stroke-width="1" stroke-dasharray="8 4"`, `envelope ${e.x0}..${e.x1} × ${e.z0}..${e.z1}`))
  parts.push(rectEl(boxRect(world.walled), `fill="none" stroke="${C.envelope}" stroke-width="1" stroke-dasharray="3 3"`, `walled ${world.walled.x0}..${world.walled.x1} × ${world.walled.z0}..${world.walled.z1}`))

  // Masses on this storey.
  for (const mass of b.masses.filter((x) => x.storeys.includes(s))) {
    const r = boxRect(mass)
    parts.push(rectEl(r, `fill="none" stroke="${C.mass}" stroke-width="2"`, `${mass.id} (${mass.role}) ${mass.x0}..${mass.x1} × ${mass.z0}..${mass.z1}`))
    parts.push(label(r.x0 + 4, r.y0 + 14, `${mass.id} ${(mass.x1 - mass.x0).toFixed(2)}×${(mass.z1 - mass.z0).toFixed(2)} m`, C.mass))
  }
  // Recess zones: the mouth and the back, and where the recess is open.
  for (const rec of b.recesses.filter((x) => x.storeyIndex === s)) {
    const depthAxis = rec.side === 'FRONT' || rec.side === 'REAR' ? 'z' : 'x'
    const lo = Math.min(rec.mouthAt, rec.backAt)
    const hi = Math.max(rec.mouthAt, rec.backAt)
    const box: Box = depthAxis === 'z' ? { x0: rec.spanFrom, x1: rec.spanTo, z0: lo, z1: hi } : { x0: lo, x1: hi, z0: rec.spanFrom, z1: rec.spanTo }
    parts.push(rectEl(boxRect(box), `fill="${C.recess}" fill-opacity="0.06" stroke="${C.recess}" stroke-width="1" stroke-dasharray="5 3"`, `${rec.id}: ${rec.why}`))
    for (const op of rec.open) {
      const a = depthAxis === 'z' ? P(op.from, rec.mouthAt) : P(rec.mouthAt, op.from)
      const c = depthAxis === 'z' ? P(op.to, rec.mouthAt) : P(rec.mouthAt, op.to)
      parts.push(lineEl(a.x, a.y, c.x, c.y, `stroke="${C.recess}" stroke-width="3" stroke-opacity="0.7"`, `${rec.id} open ${op.from.toFixed(2)}..${op.to.toFixed(2)}`))
    }
  }
  // Return walls: the segment, thickened towards the inside of the envelope.
  for (const ret of b.returns.filter((x) => x.storeyIndex === s)) {
    const dx = ret.end.x - ret.start.x
    const dz = ret.end.z - ret.start.z
    const len = Math.hypot(dx, dz) || 1
    const nx = -dz / len
    const nz = dx / len
    const mid = { x: (ret.start.x + ret.end.x) / 2, z: (ret.start.z + ret.end.z) / 2 }
    const towards = (e.x0 + e.x1) / 2 - mid.x
    const towardsZ = (e.z0 + e.z1) / 2 - mid.z
    const sign = nx * towards + nz * towardsZ >= 0 ? 1 : -1
    const t = ret.thicknessM
    const poly = [ret.start, ret.end, { x: ret.end.x + sign * nx * t, z: ret.end.z + sign * nz * t }, { x: ret.start.x + sign * nx * t, z: ret.start.z + sign * nz * t }].map((p) => P(p.x, p.z))
    parts.push(polyEl(poly, `fill="${C.ret}" fill-opacity="0.25" stroke="${C.ret}" stroke-width="1.2"`, `${ret.id}: ${ret.why}`))
    parts.push(label(poly[0].x + 2, poly[0].y - 3, ret.id.replace('return-', 'ret '), C.ret, 9))
  }
  // Interior: partitions, door gaps, solid blocks, rooms.
  for (const interior of b.interior.filter((x) => x.storeyIndex === s)) {
    for (const w of interior.walls) {
      const box: Box = w.axis === 'Z' ? { x0: w.at - w.thicknessM / 2, x1: w.at + w.thicknessM / 2, z0: w.from, z1: w.to } : { x0: w.from, x1: w.to, z0: w.at - w.thicknessM / 2, z1: w.at + w.thicknessM / 2 }
      parts.push(rectEl(boxRect(box), `fill="${C.iwall}" fill-opacity="0.35" stroke="${C.iwall}" stroke-width="0.8"`, `${w.id}: ${w.why} (ends ${w.ends.start}/${w.ends.end})`))
    }
    for (const d of interior.doors) {
      const t = Math.max(...d.betweenIds.map((id) => interior.walls.find((w) => w.id === id)?.thicknessM ?? 0), 0.12)
      const box: Box = d.wallAxis === 'Z' ? { x0: d.at - t / 2, x1: d.at + t / 2, z0: d.from, z1: d.to } : { x0: d.from, x1: d.to, z0: d.at - t / 2, z1: d.at + t / 2 }
      const r = boxRect(box)
      parts.push(rectEl(r, `fill="${C.door}" fill-opacity="0.35" stroke="${C.door}" stroke-width="1" stroke-dasharray="3 2"`, `${d.id}: ${d.why}`))
      parts.push(label((r.x0 + r.x1) / 2, Math.min(r.y0, r.y1) - 2, `door ${d.widthM.toFixed(2)}`, C.door, 8, 'middle'))
    }
    for (const bl of interior.blocks) {
      const r = boxRect(bl)
      parts.push(rectEl(r, `fill="${C.block}" fill-opacity="0.45" stroke="${C.block}" stroke-width="1"`, `${bl.id}: ${bl.why}`))
    }
    for (const room of interior.rooms) {
      const poly = room.polygon.map((p) => P(p.x, p.z))
      parts.push(polyEl(poly, `fill="${C.room}" fill-opacity="${room.openPlan ? 0.06 : 0.12}" stroke="${C.room}" stroke-width="1.2"${room.openPlan ? ' stroke-dasharray="6 3"' : ''}`, `${room.id}: ${room.why}`))
      const cx = (room.bounds.x0 + room.bounds.x1) / 2
      const cz = (room.bounds.z0 + room.bounds.z1) / 2
      const c = P(cx, cz)
      const name = room.label ?? (room.number !== undefined ? `#${room.number}` : room.id)
      parts.push(label(c.x, c.y - 2, name, C.balcony, 11, 'middle'))
      parts.push(label(c.x, c.y + 11, `${room.areaM2.toFixed(2)} m²${room.publishedAreaM2 !== undefined ? ` (pub ${room.publishedAreaM2})` : ''}`, C.balcony, 9, 'middle'))
    }
  }
  // Chimneys drawn on the storeys that show them.
  for (const ch of b.chimneys.filter((x) => x.storeysSeen.includes(s))) {
    const r = boxRect(ch)
    parts.push(rectEl(r, `fill="${C.chimney}" fill-opacity="0.35" stroke="${C.chimney}" stroke-width="1.5"`, `${ch.id}: ${ch.why}`))
    parts.push(label(r.x1 + 3, (r.y0 + r.y1) / 2 + 4, ch.id, C.chimney, 9))
  }
  // The stair: shaft, flights with their risers and direction, landings; the slab hole on the storey above.
  if (b.stair && b.stair.hypothesis.storeyIndex === s) {
    const h = b.stair.hypothesis
    parts.push(rectEl(boxRect(h.shaft), `fill="none" stroke="${C.stair}" stroke-width="1.5" stroke-dasharray="6 3"`, `${h.id} shaft: ${h.why}`))
    for (const f of h.flights) {
      const alongX = f.direction === 'PLUS_X' || f.direction === 'MINUS_X'
      const lo = Math.min(f.from, f.to)
      const hi = Math.max(f.from, f.to)
      const box: Box = alongX ? { x0: lo, x1: hi, z0: f.band.from, z1: f.band.to } : { x0: f.band.from, x1: f.band.to, z0: lo, z1: hi }
      parts.push(rectEl(boxRect(box), `fill="${C.stair}" fill-opacity="0.1" stroke="${C.stair}" stroke-width="1"`, `flight ${f.index} ${f.direction}: ${f.risers} risers, going ${f.goingM.toFixed(3)} m`))
      for (const riser of f.riserLines) {
        const a = alongX ? P(riser, f.band.from) : P(f.band.from, riser)
        const c = alongX ? P(riser, f.band.to) : P(f.band.to, riser)
        parts.push(lineEl(a.x, a.y, c.x, c.y, `stroke="${C.stair}" stroke-width="1"`))
      }
      const mid = (f.band.from + f.band.to) / 2
      const a = alongX ? P(f.from, mid) : P(mid, f.from)
      const c = alongX ? P(f.to, mid) : P(mid, f.to)
      parts.push(lineEl(a.x, a.y, c.x, c.y, `stroke="${C.stair}" stroke-width="2" marker-end="url(#arrow)"`))
      parts.push(label(a.x + 3, a.y - 4, `F${f.index} ${f.risers}r`, C.stair, 9))
    }
    for (const l of h.landings) {
      const r = boxRect(l)
      parts.push(rectEl(r, `fill="${C.stair}" fill-opacity="0.2" stroke="${C.stair}" stroke-width="1"`, `landing ${l.index}, turn ${l.turn}`))
      parts.push(label((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2 + 4, `L${l.index}`, C.stair, 9, 'middle'))
    }
    if (h.arrow) {
      const a = P(h.arrow.x, h.arrow.z)
      parts.push(`<circle cx="${n(a.x)}" cy="${n(a.y)}" r="4" fill="${C.stair}"><title>arrowhead (${h.directionEvidence})</title></circle>`)
    }
    const start = P(h.start.x, h.start.z)
    parts.push(label(start.x, start.y + 12, `${h.id} ${h.turnKind} ${h.risersTotal} risers, ${h.widthM.toFixed(2)} m wide`, C.stair, 9))
  }
  if (b.stair && b.stair.toLevel === s) {
    parts.push(rectEl(boxRect(b.stair.slabHole), `fill="none" stroke="${C.stair}" stroke-width="1.5" stroke-dasharray="6 3"`, 'stair slab hole'))
    const r = boxRect(b.stair.slabHole)
    parts.push(label(r.x0 + 3, r.y0 + 12, 'slab hole', C.stair, 9))
  }
  // Openings: the gap as detected on this sheet (pixels), and the solved interval on the wall's outer face.
  const openings = [...b.openings, ...b.sharedDoors].filter((op) => op.storeyIndex === s)
  for (const op of openings) {
    if (op.planGap.frameId === plan.frameId) parts.push(rectEl(op.planGap.pixelRect, `fill="${C.gap}" fill-opacity="0.2" stroke="${C.gap}" stroke-width="1"`, `${op.id} plan gap as detected`))
    const t = b.wallThicknessM
    const alongX = op.facade === 'FRONT' || op.facade === 'REAR'
    const inward = op.facade === 'FRONT' || op.facade === 'WEST' ? 1 : -1
    const box: Box = alongX
      ? { x0: op.interval[0], x1: op.interval[1], z0: Math.min(op.planeAt, op.planeAt + inward * t), z1: Math.max(op.planeAt, op.planeAt + inward * t) }
      : { x0: Math.min(op.planeAt, op.planeAt + inward * t), x1: Math.max(op.planeAt, op.planeAt + inward * t), z0: op.interval[0], z1: op.interval[1] }
    const r = boxRect(box)
    parts.push(rectEl(r, `fill="none" stroke="${C.opening}" stroke-width="1.5"`, `${op.id}: ${op.why}`))
    parts.push(label(alongX ? (r.x0 + r.x1) / 2 : r.x1 + 3, alongX ? (op.facade === 'FRONT' ? r.y1 + 11 : r.y0 - 3) : (r.y0 + r.y1) / 2 + 3, `${op.family.toLowerCase()} ${op.widthM.toFixed(2)}`, C.opening, 9, alongX ? 'middle' : 'start'))
  }
  // Balconies, terraces and railings of this storey.
  for (const bal of b.balconies.filter((x) => x.storeyIndex === s)) {
    const r = boxRect(bal)
    parts.push(rectEl(r, `fill="${C.balcony}" fill-opacity="0.12" stroke="${C.balcony}" stroke-width="1"`, `${bal.id}: ${bal.why}`))
    parts.push(label(r.x0 + 3, r.y1 - 3, bal.kind.toLowerCase(), C.balcony, 9))
  }
  for (const rail of b.railings.filter((x) => x.storeyIndex === s)) {
    const a = P(rail.start.x, rail.start.z)
    const c = P(rail.end.x, rail.end.z)
    parts.push(lineEl(a.x, a.y, c.x, c.y, `stroke="${C.railing}" stroke-width="2" stroke-dasharray="2 2"`, `${rail.id}: ${rail.why}`))
  }
  const lines = [
    `storey ${s} — ${plan.frameId} (${plan.assetId})`,
    `${(plan.mppX * 1000).toFixed(3)} × ${(plan.mppY * 1000).toFixed(3)} mm/px; world origin at px (${plan.originPx.x.toFixed(1)}, ${plan.originPx.y.toFixed(1)}); wall ${m.wallPx.toFixed(1)} px (${m.wallPxWhy})`,
    `px = ox + x / mppX, py = oy − z / mppY (front at the sheet's bottom, z up the sheet); envelope dashed, walled dotted`,
    `why: ${plan.why}`,
    `${b.masses.filter((x) => x.storeys.includes(s)).length} masses, ${b.returns.filter((x) => x.storeyIndex === s).length} returns, ${b.interior.filter((x) => x.storeyIndex === s).reduce((a, i) => a + i.walls.length, 0)} partitions, ${b.interior.filter((x) => x.storeyIndex === s).reduce((a, i) => a + i.rooms.length, 0)} rooms, ${openings.length} openings, ${b.chimneys.filter((x) => x.storeysSeen.includes(s)).length} chimneys`,
  ]
  parts.push(legend(width, lines, C.mass))
  parts.push('</svg>')
  return { svg: parts.join('\n'), note: plan.wallPx === undefined ? 'wallPx is not serialised in registrations.json; derived from wallThicknessM' : undefined }
}

// ---------------------------------------------------------------------------
// 3. Elevation overlays
// ---------------------------------------------------------------------------

function elevationSheet(reg: ElevationRegistrationV2, frame: Frame, href: string | undefined, b: BuildingV2, world: WorldFrameV2, residuals: SourceViewResidual[]): string {
  const { width, height } = frame.size
  const side = reg.side
  const axis = alongAxis(side)
  const v = elevationMapOf(reg)
  const e = world.envelope
  const parts = [svgOpen(width, height, `${side} — ${frame.assetId}`, href)]
  const ext = reg.extent
  const rectOf = (along: [number, number], y: [number, number]): Rect => ({ x0: v.pxOf(along[0]), x1: v.pxOf(along[1]), y0: v.pyOf(y[0]), y1: v.pyOf(y[1]) })

  // The silhouette extent and the metric grid, half-metre ticks, metre labels.
  parts.push(rectEl(ext, `fill="none" stroke="${C.envelope}" stroke-width="1.2" stroke-dasharray="8 4"`, `silhouette extent ${ext.x0},${ext.y0} – ${ext.x1},${ext.y1}`))
  const pad = 24
  parts.push(`<clipPath id="ext"><rect x="${n(ext.x0 - pad)}" y="${n(ext.y0 - pad)}" width="${n(ext.x1 - ext.x0 + 2 * pad)}" height="${n(ext.y1 - ext.y0 + 2 * pad)}"/></clipPath>`)
  const grid: string[] = []
  const a0 = v.alongOf(ext.x0 - pad)
  const a1 = v.alongOf(ext.x1 + pad)
  const alongLo = Math.floor(Math.min(a0, a1) * 2) / 2
  const alongHi = Math.ceil(Math.max(a0, a1) * 2) / 2
  const yTop = Math.ceil((v.yOf(ext.y0 - pad) + 0.5) * 2) / 2
  const yBottom = Math.floor(v.yOf(ext.y1 + pad) * 2) / 2
  for (let along = alongLo; along <= alongHi + 1e-9; along += 0.5) {
    const heavy = Math.abs(along - Math.round(along)) < 1e-6
    const px = v.pxOf(along)
    grid.push(lineEl(px, v.pyOf(yBottom), px, v.pyOf(yTop), `stroke="${C.grid}" stroke-opacity="${heavy ? 0.5 : 0.22}" stroke-width="${heavy ? 1 : 0.6}"`))
    if (heavy) grid.push(label(px + 2, ext.y1 + pad - 3, `${axis}${Math.round(along)}`, C.grid, 9))
  }
  for (let y = yBottom; y <= yTop + 1e-9; y += 0.5) {
    const heavy = Math.abs(y - Math.round(y)) < 1e-6
    const py = v.pyOf(y)
    grid.push(lineEl(v.pxOf(alongLo), py, v.pxOf(alongHi), py, `stroke="${C.grid}" stroke-opacity="${heavy ? 0.5 : 0.22}" stroke-width="${heavy ? 1 : 0.6}"`))
    if (heavy) grid.push(label(ext.x0 - pad + 2, py - 2, `y${Math.round(y)}`, C.grid, 9))
  }
  parts.push(`<g clip-path="url(#ext)">${grid.join('')}</g>`)
  // Ground and the level lines.
  const gy = v.pyOf(0)
  parts.push(lineEl(ext.x0 - pad, gy, ext.x1 + pad, gy, `stroke="${C.level}" stroke-width="1.5"`), label(ext.x1 + pad - 2, gy - 3, 'y = 0', C.level, 9, 'end'))
  for (const l of b.levels) {
    for (const [what, y] of [['floor', l.elevation], ['wall top', l.wallTop]] as Array<[string, number]>) {
      const py = v.pyOf(y)
      parts.push(lineEl(ext.x0, py, ext.x1, py, `stroke="${C.level}" stroke-width="0.8" stroke-dasharray="6 4"`), label(ext.x1 + 2, py + 3, `${l.id} ${what} ${y.toFixed(2)}`, C.level, 8))
    }
  }
  // Masses as the wall boxes they show on this side.
  const topOf = (massId: string, storeys: number[]): number => {
    const attached = b.attachedRoofs.find((r) => r.massId === massId)
    if (attached) return attached.parapetTopY ?? attached.slabTopY
    return Math.max(...b.levels.filter((l) => storeys.includes(l.index)).map((l) => l.wallTop))
  }
  for (const mass of b.masses) {
    const r = rectOf(alongRange(mass, side), [0, topOf(mass.id, mass.storeys)])
    parts.push(rectEl(r, `fill="none" stroke="${C.mass}" stroke-width="1.5" stroke-opacity="0.8"`, `${mass.id} (${mass.role}) to ${topOf(mass.id, mass.storeys).toFixed(2)} m`))
    parts.push(label(Math.min(r.x0, r.x1) + 3, Math.min(r.y0, r.y1) - 3, mass.id, C.mass, 9))
  }
  // The main roof: a gable on the views across the ridge, eave and ridge lines on the views along it.
  const roof = b.mainRoof
  if (roof) {
    const acrossRidge = (roof.ridgeAxis === 'Z') === (axis === 'x')
    if (acrossRidge) {
      const fp: [number, number] = axis === 'x' ? [roof.footprint.x0, roof.footprint.x1] : [roof.footprint.z0, roof.footprint.z1]
      const pts = [{ x: v.pxOf(fp[0]), y: v.pyOf(roof.eaveY) }, { x: v.pxOf(roof.ridgeAt), y: v.pyOf(roof.ridgeY) }, { x: v.pxOf(fp[1]), y: v.pyOf(roof.eaveY) }]
      parts.push(polyEl(pts, `fill="none" stroke="${C.roof}" stroke-width="2"`, `main roof gable: eave ${roof.eaveY.toFixed(2)}, ridge ${roof.ridgeY.toFixed(2)} at ${axis} = ${roof.ridgeAt}, pitch ${roof.pitchDeg}°`, false))
      parts.push(lineEl(pts[0].x, pts[0].y, pts[2].x, pts[2].y, `stroke="${C.roof}" stroke-width="1" stroke-dasharray="4 3"`))
      parts.push(label(pts[1].x, pts[1].y - 6, `ridge ${roof.ridgeY.toFixed(2)}`, C.roof, 10, 'middle'))
      parts.push(label(pts[0].x, pts[0].y + 12, `eave ${roof.eaveY.toFixed(2)}`, C.roof, 9))
    } else {
      const fp: [number, number] = axis === 'x' ? [roof.footprint.x0, roof.footprint.x1] : [roof.footprint.z0, roof.footprint.z1]
      const ridge = rectOf(fp, [roof.ridgeY, roof.ridgeY])
      const eave = rectOf(fp, [roof.eaveY, roof.eaveY])
      parts.push(lineEl(ridge.x0, ridge.y0, ridge.x1, ridge.y1, `stroke="${C.roof}" stroke-width="2"`, `ridge ${roof.ridgeY.toFixed(2)} m over ${fp[0].toFixed(2)}..${fp[1].toFixed(2)}`))
      parts.push(lineEl(eave.x0, eave.y0, eave.x1, eave.y1, `stroke="${C.roof}" stroke-width="2"`, `eave ${roof.eaveY.toFixed(2)} m`))
      parts.push(lineEl(ridge.x0, ridge.y0, eave.x0, eave.y0, `stroke="${C.roof}" stroke-width="1.5"`), lineEl(ridge.x1, ridge.y1, eave.x1, eave.y1, `stroke="${C.roof}" stroke-width="1.5"`))
      parts.push(label((ridge.x0 + ridge.x1) / 2, ridge.y0 - 6, `ridge ${roof.ridgeY.toFixed(2)} (${roof.coversZones ? 'covers the zones' : 'walled only'})`, C.roof, 10, 'middle'))
      parts.push(label(Math.min(eave.x0, eave.x1) + 3, eave.y0 + 12, `eave ${roof.eaveY.toFixed(2)}`, C.roof, 9))
    }
  }
  // Attached (flat) roofs: slab top and parapet across the body's extent on this side.
  for (const ar of b.attachedRoofs) {
    const along = alongRange(ar.footprint, side)
    const slab = rectOf(along, [ar.slabTopY, ar.slabTopY])
    parts.push(lineEl(slab.x0, slab.y0, slab.x1, slab.y1, `stroke="${C.attached}" stroke-width="1.5" stroke-dasharray="6 3"`, `${ar.massId} slab top ${ar.slabTopY.toFixed(2)}`))
    if (ar.parapetTopY !== undefined) {
      const par = rectOf(along, [ar.parapetTopY, ar.parapetTopY])
      parts.push(lineEl(par.x0, par.y0, par.x1, par.y1, `stroke="${C.attached}" stroke-width="2"`, `${ar.massId} parapet top ${ar.parapetTopY.toFixed(2)}`))
      parts.push(label(Math.min(par.x0, par.x1) + 3, par.y0 - 4, `${ar.massId} parapet ${ar.parapetTopY.toFixed(2)}`, C.attached, 9))
    }
  }
  // Openings on this facade: sill/head/interval, a raked head as a slanted top edge, mullions.
  for (const op of b.openings.filter((x) => sideOfFacade(x.facade) === side)) {
    const [i0, i1] = op.interval
    const headAt = (end: 'LOW' | 'HIGH'): number => (op.profile === 'RAKED_SINGLE' && op.headFarY !== undefined ? ((op.tallEdge ?? 'HIGH') === end ? op.headY : op.headFarY) : op.headY)
    const pts = [
      { x: v.pxOf(i0), y: v.pyOf(op.sillY) },
      { x: v.pxOf(i1), y: v.pyOf(op.sillY) },
      { x: v.pxOf(i1), y: v.pyOf(headAt('HIGH')) },
      { x: v.pxOf(i0), y: v.pyOf(headAt('LOW')) },
    ]
    parts.push(polyEl(pts, `fill="${C.opening}" fill-opacity="0.12" stroke="${C.opening}" stroke-width="1.8"`, `${op.id}: ${op.why}${op.unresolved.length > 0 ? `; unresolved: ${op.unresolved.join('; ')}` : ''}`))
    for (const f of op.mullions) {
      const x = v.pxOf(i0 + (i1 - i0) * f)
      parts.push(lineEl(x, pts[0].y, x, Math.min(pts[2].y, pts[3].y), `stroke="${C.opening}" stroke-width="1" stroke-dasharray="3 2"`))
    }
    const top = Math.min(pts[2].y, pts[3].y)
    parts.push(label((pts[0].x + pts[1].x) / 2, top - 4, `${op.family.toLowerCase()} ${op.widthM.toFixed(2)}×${(op.headY - op.sillY).toFixed(2)}${op.profile !== 'RECTANGULAR' ? ` ${op.profile.toLowerCase()}` : ''}`, C.opening, 9, 'middle'))
    parts.push(label(pts[1].x + 2, pts[0].y + 3, `sill ${op.sillY.toFixed(2)}`, C.opening, 8), label(pts[1].x + 2, pts[2].y + 3, `head ${headAt('HIGH').toFixed(2)}`, C.opening, 8))
  }
  // Balconies with their fascia bands, railings and portal heads on this facade.
  for (const bal of b.balconies.filter((x) => sideOfBox(x, e) === side)) {
    const r = rectOf(alongRange(bal, side), [bal.topY - bal.thicknessM, bal.topY])
    parts.push(rectEl(r, `fill="${C.balcony}" fill-opacity="0.15" stroke="${C.balcony}" stroke-width="1.5"`, `${bal.id} (${bal.kind}): ${bal.why}`))
    parts.push(label(Math.min(r.x0, r.x1) + 3, Math.max(r.y0, r.y1) + 11, `${bal.kind.toLowerCase()} top ${bal.topY.toFixed(2)}`, C.balcony, 9))
    if (bal.fascia) {
      const f = rectOf(bal.fascia.along, bal.fascia.y)
      parts.push(rectEl(f, `fill="none" stroke="${C.balcony}" stroke-width="1" stroke-dasharray="4 2"`, `${bal.fascia.id}: ${bal.fascia.why}`))
      parts.push(label(Math.max(f.x0, f.x1) - 3, Math.min(f.y0, f.y1) - 3, `fascia ${bal.fascia.y[0].toFixed(2)}..${bal.fascia.y[1].toFixed(2)}`, C.balcony, 8, 'end'))
    }
  }
  for (const rail of b.railings) {
    const box: Box = { x0: Math.min(rail.start.x, rail.end.x), x1: Math.max(rail.start.x, rail.end.x), z0: Math.min(rail.start.z, rail.end.z), z1: Math.max(rail.start.z, rail.end.z) }
    if (sideOfBox(box, e) !== side) continue
    const r = rectOf(alongRange(box, side), [rail.baseY, rail.baseY + rail.heightM])
    parts.push(rectEl(r, `fill="${C.railing}" fill-opacity="0.1" stroke="${C.railing}" stroke-width="1.2" stroke-dasharray="2 2"`, `${rail.id}: ${rail.why}`))
    parts.push(label(Math.min(r.x0, r.x1) + 3, Math.min(r.y0, r.y1) - 3, `railing ${rail.heightM.toFixed(2)}`, C.railing, 8))
  }
  for (const ph of b.portalHeads.filter((x) => sideOfBox(x, e) === side)) {
    const r = rectOf(alongRange(ph, side), [ph.y0, ph.y1])
    parts.push(rectEl(r, `fill="${C.attached}" fill-opacity="0.15" stroke="${C.attached}" stroke-width="1.5"`, `${ph.id}: ${ph.why}`))
    parts.push(label(Math.max(r.x0, r.x1) - 3, Math.min(r.y0, r.y1) - 3, `portal head ${ph.y0.toFixed(2)}..${ph.y1.toFixed(2)}`, C.attached, 8, 'end'))
  }
  // Verges: the rake members along the gable, as wide as they were read.
  for (const vg of b.verges.filter((x) => x.side === side)) {
    const m = vg.member
    const ends = m.yAtEnds ?? [m.y[0], m.y[0]]
    const apexAlong = roof ? roof.ridgeAt : (m.along[0] + m.along[1]) / 2
    const pts = [{ x: v.pxOf(m.along[0]), y: v.pyOf(ends[0]) }, { x: v.pxOf(apexAlong), y: v.pyOf(m.y[1]) }, { x: v.pxOf(m.along[1]), y: v.pyOf(ends[1]) }]
    const w = Math.max(2, (m.widthM ?? 0.3) / reg.mpp)
    parts.push(polyEl(pts, `fill="none" stroke="${C.verge}" stroke-opacity="0.45" stroke-width="${n(w)}" stroke-linejoin="round"`, `${vg.id}: ${m.why}`, false))
    parts.push(label(pts[0].x + 4, pts[0].y - 4, `verge ${(m.widthM ?? 0).toFixed(2)} m face, ${vg.depthM} m deep`, C.verge, 9))
  }
  // Chimneys: seen from every side, from where they pierce the roof up to their top.
  for (const ch of b.chimneys) {
    const base = Math.min(roofTopY(b, ch.x0, ch.z0), roofTopY(b, ch.x1, ch.z1), roofTopY(b, ch.x0, ch.z1), roofTopY(b, ch.x1, ch.z0))
    const top = ch.topY ?? base + 0.5
    const r = rectOf(alongRange(ch, side), [base, top])
    parts.push(rectEl(r, `fill="${C.chimney}" fill-opacity="0.25" stroke="${C.chimney}" stroke-width="1.5"${ch.topY === undefined ? ' stroke-dasharray="3 2"' : ''}`, `${ch.id}: ${ch.why}`))
    parts.push(label((r.x0 + r.x1) / 2, Math.min(r.y0, r.y1) - 4, `${ch.id}${ch.topY !== undefined ? ` top ${ch.topY.toFixed(2)}` : ' (no top seen)'}`, C.chimney, 9, 'middle'))
  }
  // Rooflights read on this very render.
  for (const rl of b.rooflights.filter((x) => x.frameId === reg.frameId)) {
    const r = rectOf([rl.alongFrom, rl.alongTo], [rl.yFrom, rl.yTo])
    parts.push(rectEl(r, `fill="${C.rooflight}" fill-opacity="0.2" stroke="${C.rooflight}" stroke-width="1.5"`, `${rl.id}: ${rl.why}`))
    parts.push(label(Math.min(r.x0, r.x1), Math.min(r.y0, r.y1) - 4, `rooflight ${rl.widthM.toFixed(2)}×${rl.lengthM.toFixed(2)} (${rl.slope.toLowerCase()} slope)`, C.rooflight, 9))
  }
  // The source-view residuals of this frame: model against what the render shows, as a bar.
  const mine = residuals.filter((r) => r.frameId === reg.frameId)
  let unplaced = 0
  for (const r of mine) {
    let along: number | undefined
    let nudge = 0
    if (r.kind === 'OPENING_SILL' || r.kind === 'OPENING_HEAD') {
      const op = [...b.openings, ...b.sharedDoors].find((x) => x.id === (r.objectId ?? r.featureId))
      if (op) {
        along = (op.interval[0] + op.interval[1]) / 2
        nudge = r.kind === 'OPENING_SILL' ? -7 : 7
      }
    } else {
      const m = /at (-?\d+(?:\.\d+)?) m along/.exec(r.why)
      if (m) along = Number(m[1])
    }
    if (along === undefined) {
      unplaced += 1
      along = v.alongOf((ext.x0 + ext.x1) / 2)
    }
    const px = v.pxOf(along) + nudge
    const yModel = v.pyOf(r.modelM)
    const yObserved = v.pyOf(r.observedM)
    const colour = r.withinTolerance ? C.ok : C.bad
    const text = `${r.kind.replace('OPENING_', '').replace('ROOF_EDGE', 'roof').toLowerCase()} ${r.residualM >= 0 ? '+' : '−'}${Math.abs(r.residualM).toFixed(2)} m`
    const title = `${r.kind} ${r.objectId ?? r.featureId}: model ${r.modelM.toFixed(3)}, observed ${r.observedM.toFixed(3)}, residual ${r.residualM.toFixed(3)} (tol ${r.toleranceM}) — ${r.why}`
    parts.push(`<g>`)
    parts.push(`<title>${esc(title)}</title>`)
    if (Math.abs(yModel - yObserved) >= 2) {
      parts.push(lineEl(px, yModel, px, yObserved, `stroke="${colour}" stroke-width="3"`))
      parts.push(lineEl(px - 5, yObserved, px + 5, yObserved, `stroke="${colour}" stroke-width="2"`))
    }
    parts.push(`<circle cx="${n(px)}" cy="${n(yModel)}" r="3.5" fill="${colour}" stroke="#ffffff" stroke-width="1"/>`)
    parts.push(label(px + 6, (yModel + yObserved) / 2 + 4, text, colour, 9))
    parts.push(`</g>`)
  }
  const lines = [
    `${side} — ${reg.frameId} (${reg.assetId}); side ${reg.sideConfidence.toFixed(2)}: ${reg.sideWhy}`,
    `${(reg.mpp * 1000).toFixed(3)} mm/px isotropic; extent ${ext.x0},${ext.y0} – ${ext.x1},${ext.y1}; y = 0 at row ${reg.zeroRow.toFixed(1)}; along = ${axis} from ${reg.alongAtLeft.toFixed(2)} ${reg.alongSign > 0 ? 'rising' : 'falling'} to the right`,
    `span ${reg.spanM.toFixed(2)} m (${reg.spanWhy}); bottom lands at ${reg.bottomY.toFixed(2)} m; confidence ${reg.confidence.toFixed(2)}`,
    `grid 0.5 m; ${mine.length} residuals (${mine.filter((r) => r.withinTolerance).length} within tolerance, green; ${mine.filter((r) => !r.withinTolerance).length} out, red)${unplaced > 0 ? `; ${unplaced} placed at the centre for want of an along position` : ''}`,
    `why: ${reg.why}`,
  ]
  parts.push(legend(width, lines, reg.confidence >= 0.6 ? C.ok : C.balcony))
  parts.push('</svg>')
  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// 4. Perspective overlays
// ---------------------------------------------------------------------------

type Vec3 = { x: number; y: number; z: number }
type Edge = [Vec3, Vec3]

/** Project through a row-major 3×4, keeping the projective depth so a point behind the camera can be dropped. */
const through = (p: readonly number[], w: Vec3): { u: number; v: number; s: number } | null => {
  const s = p[8] * w.x + p[9] * w.y + p[10] * w.z + p[11]
  if (!Number.isFinite(s) || Math.abs(s) < 1e-12) return null
  return { u: (p[0] * w.x + p[1] * w.y + p[2] * w.z + p[3]) / s, v: (p[4] * w.x + p[5] * w.y + p[6] * w.z + p[7]) / s, s }
}

/** The gabled body's footprint as the solver derives it: symmetric about the ridge, unless given. */
function bodyOf(env: EnvelopeForCamera): Box {
  if (env.body) return env.body
  const lo = env.ridgeAxis === 'X' ? env.z0 : env.x0
  const hi = env.ridgeAxis === 'X' ? env.z1 : env.x1
  const half = Math.min(env.ridgeAt - lo, hi - env.ridgeAt)
  if (!(half > 0)) return { x0: env.x0, x1: env.x1, z0: env.z0, z1: env.z1 }
  return env.ridgeAxis === 'X' ? { x0: env.x0, x1: env.x1, z0: env.ridgeAt - half, z1: env.ridgeAt + half } : { x0: env.ridgeAt - half, x1: env.ridgeAt + half, z0: env.z0, z1: env.z1 }
}

const boxEdges = (b: Box, y0: number, y1: number): Edge[] => {
  const c = [
    { x: b.x0, z: b.z0 },
    { x: b.x1, z: b.z0 },
    { x: b.x1, z: b.z1 },
    { x: b.x0, z: b.z1 },
  ]
  const out: Edge[] = []
  for (let i = 0; i < 4; i += 1) {
    const a = c[i]
    const d = c[(i + 1) % 4]
    out.push([{ x: a.x, y: y0, z: a.z }, { x: d.x, y: y0, z: d.z }])
    out.push([{ x: a.x, y: y1, z: a.z }, { x: d.x, y: y1, z: d.z }])
    out.push([{ x: a.x, y: y0, z: a.z }, { x: a.x, y: y1, z: a.z }])
  }
  return out
}

const gableEdges = (env: EnvelopeForCamera, body: Box): Edge[] => {
  const e = env.eaveY
  const r = env.ridgeY
  if (env.ridgeAxis === 'X') {
    const out: Edge[] = [[{ x: body.x0, y: r, z: env.ridgeAt }, { x: body.x1, y: r, z: env.ridgeAt }]]
    for (const x of [body.x0, body.x1]) out.push([{ x, y: e, z: body.z0 }, { x, y: r, z: env.ridgeAt }], [{ x, y: e, z: body.z1 }, { x, y: r, z: env.ridgeAt }])
    return out
  }
  const out: Edge[] = [[{ x: env.ridgeAt, y: r, z: body.z0 }, { x: env.ridgeAt, y: r, z: body.z1 }]]
  for (const z of [body.z0, body.z1]) out.push([{ x: body.x0, y: e, z }, { x: env.ridgeAt, y: r, z }], [{ x: body.x1, y: e, z }, { x: env.ridgeAt, y: r, z }])
  return out
}

function perspectiveSheet(summary: CameraSummary, frame: Frame, href: string | undefined, cam: PerspectiveCameraV2 | null | undefined, env: EnvelopeForCamera | undefined, lineage: Lineage | undefined, resolveNote: string | undefined): { svg: string; note?: string } {
  const { width, height } = frame.size
  const parts = [svgOpen(width, height, `perspective — ${frame.assetId}`, href)]
  const notes: string[] = []
  for (const s of (lineage?.sightings ?? []).filter((x) => x.frameId === frame.id && x.pixelRect)) {
    parts.push(rectEl(s.pixelRect as Rect, `fill="none" stroke="${C.sighting}" stroke-width="1.2" stroke-dasharray="4 3"`, `${s.id}: ${s.what}`))
  }
  const fromWhy = /stands at \((-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\) m with a (-?[\d.]+) px focal length/.exec(summary.why)
  if (cam && env) {
    const p = cam.solution.projection
    const body = bodyOf(env)
    const centre = { x: (env.x0 + env.x1) / 2, y: (env.groundY + env.ridgeY) / 2, z: (env.z0 + env.z1) / 2 }
    const sign = (through(p, centre)?.s ?? 1) < 0 ? -1 : 1
    const limit = 10 * Math.max(width, height)
    const draw = (edges: readonly Edge[], attrs: string, title: string): number => {
      let drawn = 0
      for (const [a, c] of edges) {
        const pa = through(p, a)
        const pc = through(p, c)
        if (!pa || !pc || pa.s * sign <= 0 || pc.s * sign <= 0) continue
        if (Math.abs(pa.u) > limit || Math.abs(pa.v) > limit || Math.abs(pc.u) > limit || Math.abs(pc.v) > limit) continue
        parts.push(lineEl(pa.u, pa.v, pc.u, pc.v, attrs, title))
        drawn += 1
      }
      return drawn
    }
    draw(boxEdges({ x0: env.x0, x1: env.x1, z0: env.z0, z1: env.z1 }, env.groundY, env.eaveY), `stroke="${C.envelope}" stroke-width="1" stroke-dasharray="6 4" stroke-opacity="0.8"`, 'characteristic envelope, ground to eave')
    draw(boxEdges(body, env.groundY, env.eaveY), `stroke="${C.mass}" stroke-width="2"`, 'main body: ground corners and eave corners')
    draw(gableEdges(env, body), `stroke="${C.roof}" stroke-width="2"`, 'main roof: ridge and the gable rakes')
    ;(env.attached ?? []).forEach((box, i) => draw(boxEdges(box, env.groundY, box.topY), `stroke="${C.attached}" stroke-width="1.8"`, `attached body ${i + 1}, top ${box.topY.toFixed(2)} m`))
    // The anchors the camera was resected from, with each one's reprojection error.
    const ids = [...cam.anchors.map((a) => a.id)].sort((a, b) => a.localeCompare(b))
    const errorOf = (id: string): number => cam.solution.errorsPx[ids.indexOf(id)] ?? Number.NaN
    for (const a of cam.anchors) {
      const q = through(p, a.world)
      parts.push(`<circle cx="${n(a.image.u)}" cy="${n(a.image.v)}" r="4" fill="none" stroke="${C.anchor}" stroke-width="2"><title>${esc(`${a.id} (${a.kind}) ${a.why}`)}</title></circle>`)
      if (q) parts.push(lineEl(a.image.u, a.image.v, q.u, q.v, `stroke="${C.bad}" stroke-width="1.5"`), `<circle cx="${n(q.u)}" cy="${n(q.v)}" r="2" fill="${C.bad}"/>`)
      parts.push(label(a.image.u + 6, a.image.v - 6, `${a.id} ${Number.isFinite(errorOf(a.id)) ? `${errorOf(a.id).toFixed(1)} px` : ''}`, C.anchor, 9))
    }
    for (const r of cam.rejected) parts.push(label(8, height - 8 - 12 * cam.rejected.indexOf(r), `rejected ${r.anchorId}: ${r.why}`, C.bad, 9))
    const c = cam.solution.centre
    const same = summary.residualPx !== undefined && Math.abs(summary.residualPx - cam.residualPx.rms) < 0.01
    if (!same) notes.push(`re-solved camera (${cam.residualPx.rms.toFixed(3)} px rms) differs from the sealed run (${summary.residualPx?.toFixed(3) ?? '?'} px rms)`)
    parts.push(
      legend(
        width,
        [
          `${frame.id} (${frame.assetId}) — camera re-solved from the silhouette${same ? ', matching the sealed run' : ' (DIFFERS from the sealed run)'}`,
          `camera at (${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}) m, focal ${cam.solution.focalPx.x.toFixed(0)}×${cam.solution.focalPx.y.toFixed(0)} px, principal (${cam.solution.principal.u.toFixed(0)}, ${cam.solution.principal.v.toFixed(0)}); sees ${cam.visibleSides.join('+')}`,
          `${cam.anchors.length} anchors (yellow; red tick to where the camera puts each), ${cam.residualPx.rms.toFixed(2)} px rms, ${cam.residualPx.max.toFixed(2)} px worst, ${cam.rejected.length} rejected; confidence ${cam.confidence.toFixed(2)}`,
          `envelope dashed grey, main body blue, roof orange, attached bodies brown`,
          // A thumbnail has no room for the sealed run's account; it is in registrations.json.
          ...(width >= 600 ? [`sealed: ${summary.why}`] : []),
        ],
        same ? C.ok : C.balcony,
      ),
    )
  } else {
    const gap = summary.solved
      ? `the sealed run solved this camera but registrations.json and feature-lineage.json carry only its residual and a summary (no projection matrix, no anchors)${resolveNote ? `; ${resolveNote}` : ''}`
      : 'the sealed run solved no camera for this render'
    notes.push(gap)
    const lines = [`${frame.id} (${frame.assetId}) — ${summary.solved ? 'solved (summary only)' : 'unsolved'}`, gap]
    if (fromWhy) lines.push(`from the summary: camera at (${fromWhy[1]}, ${fromWhy[2]}, ${fromWhy[3]}) m, focal ${fromWhy[4]} px — orientation and principal point are not recorded, so nothing can be projected`)
    if (width >= 600) lines.push(`sealed: ${summary.why}`)
    parts.push(legend(width, lines, summary.solved ? C.balcony : C.bad))
  }
  parts.push('</svg>')
  return { svg: parts.join('\n'), note: notes.length > 0 ? notes.join('; ') : undefined }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const cwd = process.cwd()
  const artifactsDir = value(argv, 'artifacts') ?? join(cwd, 'stage-reports', 'artifacts', 'analyzer-v2')
  const slug = value(argv, 'slug') ?? 'marcowki'
  const packagePath = value(argv, 'package') ?? join(cwd, 'stage-reports', 'artifacts', 'source-observations', `${slug}-source-package.json`)
  const graphPath = value(argv, 'graph') ?? join(cwd, 'stage-reports', 'artifacts', 'source-observations', `${slug}-observation-graph.json`)
  const atlasPath = value(argv, 'atlas') ?? join(cwd, 'research', 'marcowki-v2', 'source-atlas.json')
  const cacheDir = value(argv, 'cache') ?? join(cwd, '.cache', 'source-bytes')
  const outDir = value(argv, 'out') ?? artifactsDir
  const withCameras = !argv.includes('--no-cameras')
  for (const [what, path] of [['package', packagePath], ['graph', graphPath], ['registrations', join(artifactsDir, 'registrations.json')], ['building', join(artifactsDir, `${slug}-building.json`)]]) {
    if (!existsSync(path)) throw new Error(`no ${what} at ${path}; run the v2 reconstruction first (npm run reconstruct:v2:marcowki)`)
  }

  const pkg: SourcePackage = SourcePackageSchema.parse(await readJson<unknown>(packagePath))
  const graph = SourceObservationGraphSchema.parse(await readJson<unknown>(graphPath))
  const registrations = await readJson<Registrations>(join(artifactsDir, 'registrations.json'))
  const building = await readJson<BuildingV2>(join(artifactsDir, `${slug}-building.json`))
  const residualsPath = join(artifactsDir, 'source-view-residuals.json')
  const residuals = existsSync(residualsPath) ? (await readJson<Residuals>(residualsPath)).residuals : []
  const lineagePath = join(artifactsDir, 'feature-lineage.json')
  const lineage = existsSync(lineagePath) ? await readJson<Lineage>(lineagePath) : undefined
  const atlas = existsSync(atlasPath) ? await readJson<Atlas>(atlasPath) : undefined
  process.stdout.write(`package ${pkg.id}: ${pkg.assets.length} assets; graph ${graph.coordinateFrames.length} frames; ${registrations.plans.length} plans, ${registrations.elevations.length} elevations, ${registrations.cameras.length} cameras; atlas ${atlas ? `${atlas.views.length} views` : 'none'}\n`)

  // The publisher's bytes, by variant hash, from the cache — never re-encoded.
  const cache = fileByteCache(cacheDir)
  const bytesByHash = new Map<string, { bytes: Uint8Array; mediaType: string }>()
  for (const asset of pkg.assets) {
    for (const variant of asset.variants) {
      if (bytesByHash.has(variant.byteHash)) continue
      const got = await cache.get(variant.url)
      if (got) bytesByHash.set(variant.byteHash, got)
    }
  }
  const hrefs = new Map<string, string>()
  const rasters = new Map<string, Raster | undefined>()
  const hrefOf = (frame: Frame): string | undefined => {
    const got = bytesByHash.get(frame.variantByteHash)
    if (!got) return undefined
    if (!hrefs.has(frame.variantByteHash)) hrefs.set(frame.variantByteHash, `data:${got.mediaType};base64,${Buffer.from(got.bytes).toString('base64')}`)
    return hrefs.get(frame.variantByteHash)
  }
  const rasterOf = (frame: Frame): Raster | undefined => {
    if (!rasters.has(frame.variantByteHash)) {
      const got = bytesByHash.get(frame.variantByteHash)
      let raster: Raster | undefined
      try {
        raster = got ? decodeImage(got.bytes) : undefined
      } catch {
        raster = undefined
      }
      rasters.set(frame.variantByteHash, raster)
    }
    return rasters.get(frame.variantByteHash)
  }
  const frameById = new Map(graph.coordinateFrames.map((f) => [f.id, f] as const))

  const index: IndexEntry[] = []
  const gaps = new Set<string>()
  const write = async (sub: string, name: string, svg: string, entry: Omit<IndexEntry, 'path'>): Promise<void> => {
    await mkdir(join(outDir, sub), { recursive: true })
    const rel = `${sub}/${name}`
    await writeFile(join(outDir, rel), `${svg}\n`, 'utf8')
    index.push({ ...entry, path: rel })
    if (entry.note) gaps.add(entry.note)
    process.stdout.write(`  ${rel}${entry.note ? `  (${entry.note})` : ''}\n`)
  }
  const unique = (used: Set<string>, base: string, frameId: string): string => {
    const name = used.has(base) ? `${base}-${frameId.slice(-8)}` : base
    used.add(name)
    return `${name}.svg`
  }

  // 1. Source atlas: one sheet per frame the graph knows.
  process.stdout.write('source-atlas\n')
  const registeredOn = (frameId: string): string[] => [
    ...registrations.plans.filter((p) => p.frameId === frameId).map((p) => `plan of storey ${p.storeyIndex}`),
    ...registrations.elevations.filter((e) => e.frameId === frameId).map((e) => `${e.side} elevation at ${(e.mpp * 1000).toFixed(2)} mm/px`),
    ...(registrations.section?.frameId === frameId ? [`section at ${(registrations.section.mpp * 1000).toFixed(2)} mm/px`] : []),
    ...registrations.cameras.filter((c) => c.frameId === frameId).map((c) => `camera ${c.solved ? `solved, ${c.residualPx?.toFixed(2)} px rms` : 'unsolved'}`),
  ]
  for (const frame of graph.coordinateFrames) {
    const raster = rasterOf(frame)
    const svg = sourceAtlasSheet(frame, hrefOf(frame), raster, atlas, lineage, registeredOn(frame.id))
    await write('source-atlas', `${frameSlug(frame.id)}.svg`, svg, { kind: 'source-atlas', frameId: frame.id, assetId: frame.assetId, note: bytesByHash.has(frame.variantByteHash) ? undefined : `no cached bytes for ${frame.id}: sheet drawn without the image` })
  }
  if (atlas && !atlas.views.some((v) => atlasRects(v).length > 0)) gaps.add(`the atlas at ${atlasPath} carries view metadata (family, projection, orientation, variants) but no pixel regions or zones, so the source-atlas sheets show its metadata and the analyzer's sightings instead`)

  // 2. Plans.
  process.stdout.write('plan-overlays\n')
  const usedPlans = new Set<string>()
  for (const plan of [...registrations.plans].sort((a, b) => a.storeyIndex - b.storeyIndex)) {
    const frame = frameById.get(plan.frameId)
    if (!frame) {
      gaps.add(`plan ${plan.frameId} is not a frame of the graph`)
      continue
    }
    const { svg, note } = planSheet(plan, frame, hrefOf(frame), building, registrations.world)
    await write('plan-overlays', unique(usedPlans, `storey-${plan.storeyIndex}`, plan.frameId), svg, { kind: 'plan', frameId: plan.frameId, assetId: plan.assetId, storeyIndex: plan.storeyIndex, note })
  }

  // 3. Elevations.
  process.stdout.write('elevation-overlays\n')
  const usedSides = new Set<string>()
  for (const reg of registrations.elevations) {
    const frame = frameById.get(reg.frameId)
    if (!frame) {
      gaps.add(`elevation ${reg.frameId} is not a frame of the graph`)
      continue
    }
    const svg = elevationSheet(reg, frame, hrefOf(frame), building, registrations.world, residuals)
    await write('elevation-overlays', unique(usedSides, reg.side.toLowerCase(), reg.frameId), svg, { kind: 'elevation', frameId: reg.frameId, assetId: reg.assetId, side: reg.side })
  }

  // 4. Perspectives: the sealed artifacts carry a summary only, so the camera is re-solved from the same
  //    raster and envelope where the solver can be loaded; the sheet says which it got.
  process.stdout.write('perspective-overlays\n')
  let solver: ((raster: Raster, frameId: string, envelope: EnvelopeForCamera) => PerspectiveCameraV2 | null) | undefined
  let resolveNote: string | undefined
  if (withCameras) {
    try {
      solver = (await import('../src/v2/camera.js')).solvePerspectiveCamera
    } catch (error) {
      resolveNote = `the v2 camera solver could not be loaded (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`
    }
  } else resolveNote = 'camera re-solving disabled by --no-cameras'
  const roof = building.mainRoof
  const envelope: EnvelopeForCamera | undefined = roof
    ? {
        x0: registrations.world.envelope.x0,
        x1: registrations.world.envelope.x1,
        z0: registrations.world.envelope.z0,
        z1: registrations.world.envelope.z1,
        eaveY: roof.eaveY,
        ridgeY: roof.ridgeY,
        ridgeAxis: roof.ridgeAxis,
        ridgeAt: roof.ridgeAt,
        groundY: 0,
        attached: building.attachedRoofs.map((r) => ({ x0: r.footprint.x0, x1: r.footprint.x1, z0: r.footprint.z0, z1: r.footprint.z1, topY: r.parapetTopY ?? r.slabTopY })),
      }
    : undefined
  if (!envelope) resolveNote = `${resolveNote ? `${resolveNote}; ` : ''}the building has no main roof, so there is no envelope to project`
  for (const summary of registrations.cameras) {
    const frame = frameById.get(summary.frameId)
    if (!frame) {
      gaps.add(`camera ${summary.frameId} is not a frame of the graph`)
      continue
    }
    let cam: PerspectiveCameraV2 | null | undefined
    let note = resolveNote
    if (summary.solved && solver && envelope) {
      const raster = rasterOf(frame)
      if (raster) {
        try {
          cam = solver(raster, frame.id, envelope)
          if (!cam) note = 're-solving from the same raster and envelope found no camera this time'
        } catch (error) {
          note = `the camera solver threw: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
        }
      } else note = 'no cached bytes to re-solve the camera from'
    }
    const { svg, note: sheetNote } = perspectiveSheet(summary, frame, hrefOf(frame), cam, envelope, lineage, note)
    await write('perspective-overlays', `${frameSlug(frame.id)}.svg`, svg, { kind: 'perspective', frameId: frame.id, assetId: frame.assetId, solved: summary.solved, note: sheetNote })
  }

  const indexPath = join(outDir, 'overlays-index.json')
  const bigDecoded = graph.coordinateFrames.filter((f) => (rasters.get(f.variantByteHash)?.width ?? 0) * (rasters.get(f.variantByteHash)?.height ?? 0) * 4 > 4 * 1024 * 1024).map((f) => f.id)
  await writeFile(
    indexPath,
    `${JSON.stringify(
      {
        schema: 'buildapp.analyzer-v2.overlays-index',
        schemaVersion: '1.0.0',
        sourcePackageId: pkg.id,
        observationGraphId: graph.id,
        inputs: { package: packagePath, graph: graphPath, artifacts: artifactsDir, atlas: atlas ? atlasPath : null, cache: cacheDir },
        embedding: `the publisher's cached bytes, base64, once per sheet; never re-encoded${bigDecoded.length > 0 ? ` (${bigDecoded.length} frames decode to more than 4 MB and are still the original bytes)` : ''}`,
        files: index,
        gaps: [...gaps],
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  process.stdout.write(`\nwrote ${index.length} overlays and overlays-index.json to ${outDir}\n`)
  for (const g of gaps) process.stdout.write(`  gap: ${g}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
