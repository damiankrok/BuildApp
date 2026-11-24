/**
 * v3.54.19 (0 USD) — the delivered model's ground-storey walls drawn on the publisher's ground-floor plan, in the frame the
 * run itself recorded (`PLAN_FRAME_OF_MODEL`), and the share of the model's interior walls that lies on the sheet's wall ink.
 *
 *   npx vite-node research/source-to-model/v35419/plan-overlay.ts -- --run <run dir> --cache <byte cache> --out <dir> --name <n>
 *        [--frame-from <run dir>]   take the plan frame another run of the SAME model frame recorded (a baseline LOCAL model
 *                                   whose code recorded none: LOCAL's registration is the same in both runs)
 *        [--fit-from <run dir>]     no recorded frame at all: the model's exterior box laid on the outline that run traced
 *                                   (REGISTERED_BY_BOUNDING_BOXES — named in the output, never silent)
 *
 * Writes <name>-plan-overlay.png and <name>-plan-overlay.json. A model without a ground-floor plan frame, or without a
 * model, writes the JSON alone with the reason. The number is a help, not the verdict: the reference for "what the plan
 * draws" is the plan skeleton reader, which the new code also builds from — the overlay picture is what a grader judges.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeImage, fileByteCache, startDecoders } from '@buildapp/source-package'
import { frameRasters } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { parseModel } from '@buildapp/model'
import { encodePng } from '../../../packages/analysis-service/src/diagnostics.js'
import { paintWalls, wallInkOf } from '../../../packages/analysis-service/src/consult/plan-skeleton.js'
import { pointWithFront } from '../../../packages/analysis-service/src/consult/massing/massing.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const [runDir, cacheDir, outDir, name] = [opt('run') as string, opt('cache') as string, opt('out') as string, opt('name') as string]
mkdirSync(outDir, { recursive: true })
type P = { x: number; z: number }
type Frame = { frameId: string; basis: string; o: P; x1000: P; y1000: P }
const J = <T>(dir: string, f: string): T | undefined => (existsSync(join(dir, f)) ? (JSON.parse(readFileSync(join(dir, f), 'utf8')) as T) : undefined)
const done = (o: Record<string, unknown>): never => { writeFileSync(join(outDir, `${name}-plan-overlay.json`), `${JSON.stringify({ name, run: runDir, ...o }, null, 1)}\n`); process.stdout.write(`${name}: ${JSON.stringify(o).slice(0, 300)}\n`); process.exit(0) }

const recordedFrame = (dir: string): Frame | undefined => {
  const ev = J<Array<Record<string, unknown>>>(dir, 'events.json') ?? []
  const e = [...ev].reverse().find((x) => x.kind === 'PLAN_FRAME_OF_MODEL')
  return e ? (e as unknown as Frame) : undefined
}
type Massing = { plan?: { frameId: string; outlinePx?: Array<[number, number]>; observation?: { outline: P[] } }; records?: Array<{ massing?: { hypothesis?: { planFront?: 'LEFT' | 'RIGHT' | 'REAR' | 'FRONT' } } }>; decision?: string }
/** A body built from the plan outline by a code that recorded no frame: the same map, from what its run did record. */
const massingFrame = (dir: string): Frame | undefined => {
  const ms = J<Massing>(dir, 'massing.json')
  const pl = ms?.plan
  if (!ms || ms.decision !== 'BUILT' || !pl?.outlinePx || !pl.observation) return undefined
  const s = Math.max(...pl.observation.outline.map((q) => q.x)) / (Math.max(...pl.outlinePx.map((q) => q[0])) - Math.min(...pl.outlinePx.map((q) => q[0])))
  const [minX, maxY] = [Math.min(...pl.outlinePx.map((q) => q[0])), Math.max(...pl.outlinePx.map((q) => q[1]))]
  const front = ms.records?.[0]?.massing?.hypothesis?.planFront
  const at = (px: number, py: number): P => { const p = { x: (px - minX) * s, z: (maxY - py) * s }; return front ? pointWithFront(p, front, (pl.observation as { outline: P[] }).outline) : p }
  return { frameId: pl.frameId, basis: 'OUTLINE_SCALE (from the run\'s massing record)', o: at(0, 0), x1000: at(1000, 0), y1000: at(0, 1000) }
}

async function main(): Promise<void> {
  const modelFile = join(runDir, 'model.json')
  if (!existsSync(modelFile)) done({ model: null, why: 'the run delivered no model' })
  const raw = JSON.parse(readFileSync(modelFile, 'utf8')) as { model?: unknown }
  const model = parseModel(JSON.stringify(raw.model ?? raw))
  const level = [...model.levels].sort((a, b) => a.elevation - b.elevation)[0]
  const walls = model.walls.filter((w) => w.levelId === level?.id)
  const ext = walls.filter((w) => w.kind === 'EXTERIOR')
  const int = walls.filter((w) => w.kind === 'INTERIOR')
  const massingBuilt = J<Massing>(runDir, 'massing.json')?.decision === 'BUILT' && J<{ decision?: string }>(runDir, 'body-arbitration.json')?.decision !== 'LOCAL_STANDS'
  let frame = recordedFrame(runDir) ?? (massingBuilt ? massingFrame(runDir) : undefined) ?? (opt('frame-from') ? [recordedFrame(opt('frame-from') as string)].find((q) => q?.basis === 'LOCAL_PLAN_REGISTRATION' && !massingBuilt) : undefined)
  const pkg = J<{ assets: Array<{ id: string; variants: Array<{ url: string; byteHash: string }> }> }>(runDir, 'source-package.json') ?? J<{ assets: Array<{ id: string; variants: Array<{ url: string; byteHash: string }> }> }>(opt('frame-from') ?? opt('fit-from') ?? runDir, 'source-package.json')
  const graph = J<{ coordinateFrames: Array<{ id: string; assetId: string; variantByteHash: string }> }>(runDir, 'observation-graph.json') ?? J<{ coordinateFrames: Array<{ id: string; assetId: string; variantByteHash: string }> }>(opt('frame-from') ?? opt('fit-from') ?? runDir, 'observation-graph.json')
  if (!pkg || !graph) done({ why: 'the run kept no source package or observation graph' })
  let fitted = false
  if (!frame && opt('fit-from')) {
    // the model's exterior box on the outline another run traced on the plan: stated, not measured
    const pl = J<Massing>(opt('fit-from') as string, 'massing.json')?.plan
    if (pl?.outlinePx && ext.length > 0) {
      const xs = ext.flatMap((w) => [w.start.x, w.end.x]); const zs = ext.flatMap((w) => [w.start.z, w.end.z])
      const [mx0, mx1, mz0, mz1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]
      const [px0, px1, py0, py1] = [Math.min(...pl.outlinePx.map((q) => q[0])), Math.max(...pl.outlinePx.map((q) => q[0])), Math.min(...pl.outlinePx.map((q) => q[1])), Math.max(...pl.outlinePx.map((q) => q[1]))]
      const [sx, sz] = [(mx1 - mx0) / (px1 - px0), (mz1 - mz0) / (py1 - py0)]
      const at = (px: number, py: number): P => ({ x: mx0 + (px - px0) * sx, z: mz0 + (py1 - py) * sz })
      frame = { frameId: pl.frameId, basis: 'REGISTERED_BY_BOUNDING_BOXES', o: at(0, 0), x1000: at(1000, 0), y1000: at(0, 1000) }
      fitted = true
    }
  }
  if (!frame) done({ counts: { exterior: ext.length, interior: int.length }, why: 'no plan frame is recorded for this model (give --frame-from or --fit-from)' })
  const fr = frame as Frame
  await startDecoders()
  const cf = (graph as NonNullable<typeof graph>).coordinateFrames.find((f) => f.id === fr.frameId)
  const variant = (pkg as NonNullable<typeof pkg>).assets.find((a) => a.id === cf?.assetId)?.variants.find((v) => v.byteHash === cf?.variantByteHash)
  const got = variant ? await fileByteCache(cacheDir).get(variant.url) : undefined
  if (!cf || !variant || !got) done({ why: `the plan frame ${fr.frameId} is not in the byte cache` })
  const rasters = frameRasters()
  rasters.set((variant as { byteHash: string }).byteHash, decodeImage((got as { bytes: Uint8Array }).bytes))
  rasters.useFrames((graph as NonNullable<typeof graph>).coordinateFrames as never)
  const raster = rasters.get((variant as { byteHash: string }).byteHash) as Raster
  // model → sheet: the inverse of the recorded map
  const ax = { x: (fr.x1000.x - fr.o.x) / 1000, z: (fr.x1000.z - fr.o.z) / 1000 }
  const ay = { x: (fr.y1000.x - fr.o.x) / 1000, z: (fr.y1000.z - fr.o.z) / 1000 }
  const det = ax.x * ay.z - ay.x * ax.z
  const toPx = (p: P): [number, number] => { const dx = p.x - fr.o.x; const dz = p.z - fr.o.z; return [(dx * ay.z - ay.x * dz) / det, (ax.x * dz - dx * ax.z) / det] }
  const mPerPx = Math.hypot(ax.x, ax.z)
  // the wall's band: from its stated face, its thickness to the left of its direction of travel
  const bandOf = (w: (typeof walls)[number]): Array<[number, number]> => {
    const d = { x: w.end.x - w.start.x, z: w.end.z - w.start.z }
    const L = Math.hypot(d.x, d.z) || 1
    const n = { x: -d.z / L, z: d.x / L }
    return [w.start, w.end, { x: w.end.x + n.x * w.thickness, z: w.end.z + n.z * w.thickness }, { x: w.start.x + n.x * w.thickness, z: w.start.z + n.z * w.thickness }].map(toPx)
  }
  // the sheet's wall ink, for the number
  const xs = ext.flatMap((w) => bandOf(w).map((q) => q[0])); const ys = ext.flatMap((w) => bandOf(w).map((q) => q[1]))
  const box: Array<[number, number]> = ext.length > 0 ? [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)], [Math.min(...xs), Math.max(...ys)]] : [[0, 0], [raster.width, 0], [raster.width, raster.height], [0, raster.height]]
  const ink = wallInkOf(raster, box)
  const painted = paintWalls(raster, ink)
  const dark = (x: number, y: number): boolean => { const [xi, yi] = [Math.round(x), Math.round(y)]; if (xi < 0 || yi < 0 || xi >= painted.width || yi >= painted.height) return false; const i = (yi * painted.width + xi) * 4; return 0.299 * painted.data[i] + 0.587 * painted.data[i + 1] + 0.114 * painted.data[i + 2] < 95 }
  const tol = Math.max(2, Math.round(0.12 / mPerPx))
  const near = (x: number, y: number): boolean => { for (let dy = -tol; dy <= tol; dy += 1) for (let dx = -tol; dx <= tol; dx += 1) if (dark(x + dx, y + dy)) return true; return false }
  let on = 0; let stations = 0; let lenM = 0
  for (const w of int) {
    const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
    lenM += L
    const d = { x: (w.end.x - w.start.x) / (L || 1), z: (w.end.z - w.start.z) / (L || 1) }
    const n = { x: -d.z, z: d.x }
    const doors = model.openings.filter((o) => o.wallId === w.id)
    for (let u = 0.05; u < L; u += 0.1) {
      if (doors.some((o) => u >= o.offset && u <= o.offset + o.width)) continue
      const [x, y] = toPx({ x: w.start.x + d.x * u + n.x * w.thickness / 2, z: w.start.z + d.z * u + n.z * w.thickness / 2 })
      stations += 1
      if (near(x, y)) on += 1
    }
  }
  // the picture
  const out: Raster = { width: raster.width, height: raster.height, data: new Uint8ClampedArray(raster.data) }
  for (let i = 0; i < out.data.length; i += 4) for (let k = 0; k < 3; k += 1) out.data[i + k] = Math.round(255 - (255 - out.data[i + k]) * 0.55)
  const blend = (x: number, y: number, c: [number, number, number], a: number): void => { if (x < 0 || y < 0 || x >= out.width || y >= out.height) return; const i = (y * out.width + x) * 4; for (let k = 0; k < 3; k += 1) out.data[i + k] = Math.round(out.data[i + k] * (1 - a) + c[k] * a) }
  const fill = (poly: Array<[number, number]>, c: [number, number, number], a: number): void => {
    const [x0, x1, y0, y1] = [Math.floor(Math.min(...poly.map((q) => q[0]))), Math.ceil(Math.max(...poly.map((q) => q[0]))), Math.floor(Math.min(...poly.map((q) => q[1]))), Math.ceil(Math.max(...poly.map((q) => q[1])))]
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
      let inside = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) inside = !inside
      if (inside) blend(x, y, c, a)
    }
  }
  const part = (w: (typeof walls)[number], u0: number, u1: number): Array<[number, number]> => {
    const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) || 1
    const d = { x: (w.end.x - w.start.x) / L, z: (w.end.z - w.start.z) / L }
    const n = { x: -d.z, z: d.x }
    const at = (u: number, v: number): P => ({ x: w.start.x + d.x * u + n.x * v, z: w.start.z + d.z * u + n.z * v })
    return [at(u0, 0), at(u1, 0), at(u1, w.thickness), at(u0, w.thickness)].map(toPx)
  }
  for (const w of ext) fill(bandOf(w), [20, 90, 230], 0.45)
  for (const w of int) fill(bandOf(w), [230, 20, 20], 0.7)
  for (const o of model.openings) {
    const w = walls.find((q) => q.id === o.wallId)
    if (!w) continue
    fill(part(w, o.offset, o.offset + o.width), w.kind === 'INTERIOR' ? [0, 160, 0] : [0, 190, 230], 0.9)
  }
  writeFileSync(join(outDir, `${name}-plan-overlay.png`), encodePng(out))
  done({ frame: { frameId: fr.frameId, basis: fr.basis, cmPerPx: Math.round(mPerPx * 1e5) / 1e3, ...(fitted ? { note: 'the model was laid on the plan by its bounding box: positions inside it are not a recorded registration' } : {}) }, counts: { exterior: ext.length, interior: int.length, interiorDoors: model.openings.filter((o) => int.some((w) => w.id === o.wallId)).length, exteriorOpenings: model.openings.filter((o) => ext.some((w) => w.id === o.wallId)).length }, interiorLengthM: Math.round(lenM * 100) / 100, onWallInk: stations > 0 ? Math.round((on / stations) * 1000) / 1000 : null, ink: { rgb: ink.rgb, filled: ink.filled }, picture: `${name}-plan-overlay.png`, legend: 'blue: exterior walls of the model; red: its interior walls; green: interior doors; cyan: exterior openings; grey underneath: the publisher\'s plan' })
}
void main()
