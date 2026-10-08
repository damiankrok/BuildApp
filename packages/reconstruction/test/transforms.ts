/**
 * One synthetic plan drawn five ways: as drawn, mirrored left–right and top–bottom, and turned a quarter either way
 * (005F post-review C). The plan is a list of drawing operations in its own coordinates; each transform redraws it
 * pixel-exactly and carries the dimension chains' ticks with it, so a rule that depends on which way up the plan is
 * drawn shows as a probe that answers differently.
 */
import { BLACK, drawLine, fillRect, whiteRaster } from '../../source-cv/test/draw.js'
import type { Raster } from '@buildapp/source-cv'
import type { DimensionChain } from '@buildapp/source-metrics'
import { WHITE, builtAt, run } from './boundary-plan.js'
import { chain } from './plan.js'
import type { PlanCallout, PlanDecomposition } from '../src/index.js'

type Op = { k: 'fill' | 'clear' | 'line'; x0: number; y0: number; x1: number; y1: number }

/** A plan as drawing operations (12 px walls, the `boundary-plan.ts` conventions). */
export class PlanDrawing {
  readonly ops: Op[] = []
  constructor(
    readonly W: number,
    readonly H: number,
  ) {}
  wall(x0: number, y0: number, x1: number, y1: number): this {
    this.ops.push({ k: 'fill', x0, y0, x1, y1 })
    return this
  }
  clear(x0: number, y0: number, x1: number, y1: number): this {
    this.ops.push({ k: 'clear', x0, y0, x1, y1 })
    return this
  }
  line(x0: number, y0: number, x1: number, y1: number): this {
    this.ops.push({ k: 'line', x0, y0, x1, y1 })
    return this
  }
  ring(x0: number, y0: number, x1: number, y1: number, t = 12): this {
    return this.wall(x0, y0, x1, y0 + t - 1).wall(x0, y1 - t + 1, x1, y1).wall(x0, y0, x0 + t - 1, y1).wall(x1 - t + 1, y0, x1, y1)
  }
  /** Glazing in a vertical wall whose left face is column `left`: two lines inside its thickness. */
  glazeV(left: number, from: number, to: number, t = 12): this {
    const q = Math.floor(t / 4)
    return this.line(left + q, from, left + q, to).line(left + t - 1 - q, from, left + t - 1 - q, to)
  }
  dashedV(x: number, from: number, to: number): this {
    for (let y = from; y <= to; y += 13) this.line(x, y, x, Math.min(y + 9, to))
    return this
  }
  /** A door: a gap in a vertical wall at column `left` with a leaf drawn on its axis. */
  doorV(left: number, from: number, to: number, t = 12): this {
    return this.clear(left, from, left + t - 1, to).line(left + Math.floor(t / 2) - 1, from, left + Math.floor(t / 2) - 1, to)
  }
}

export type Transform = 'id' | 'mirrorX' | 'mirrorY' | 'turn90' | 'turn270'
export const TRANSFORMS: readonly Transform[] = ['id', 'mirrorX', 'mirrorY', 'turn90', 'turn270']

function transformOf(t: Transform, W: number, H: number) {
  const point = (x: number, y: number): [number, number] =>
    t === 'id' ? [x, y] : t === 'mirrorX' ? [W - 1 - x, y] : t === 'mirrorY' ? [x, H - 1 - y] : t === 'turn90' ? [H - 1 - y, x] : [y, W - 1 - x]
  const size: [number, number] = t === 'turn90' || t === 'turn270' ? [H, W] : [W, H]
  /** Ticks on the plan's x and y chains, as x and y ticks of the transformed plan. */
  const ticks = (xs: readonly number[], ys: readonly number[]): { xs: number[]; ys: number[] } =>
    t === 'id' ? { xs: [...xs], ys: [...ys] } : t === 'mirrorX' ? { xs: xs.map((v) => W - v), ys: [...ys] } : t === 'mirrorY' ? { xs: [...xs], ys: ys.map((v) => H - v) } : t === 'turn90' ? { xs: ys.map((v) => H - v), ys: [...xs] } : { xs: [...ys], ys: xs.map((v) => W - v) }
  return { point, size, ticks }
}

function render(p: PlanDrawing, t: Transform): Raster {
  const { point, size } = transformOf(t, p.W, p.H)
  const r = whiteRaster(size[0], size[1])
  for (const o of p.ops) {
    const [a, b] = point(o.x0, o.y0)
    const [c, d] = point(o.x1, o.y1)
    if (o.k === 'line') drawLine(r, a, b, c, d, BLACK)
    else fillRect(r, Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d), o.k === 'fill' ? BLACK : WHITE)
  }
  return r
}

export type Scene = {
  p: PlanDrawing
  /** The plan's overall chain ticks along x and y. */
  xs: number[]
  ys: number[]
  /** Ticks of an unread exterior chain: the shadow grid takes them, the incumbent grid does not. */
  unread?: { x?: number[]; y?: number[] }
  /** A further chain, vertical in the plan's own frame: its baseline x and its ticks along y. */
  verticalChain?: { baselineX: number; ticksY: number[] }
  /** 005N: printed opening callouts, in the plan's own coordinates; each transform carries them with the drawing. */
  callouts?: PlanCallout[]
}

/** The scene drawn under `t`, decomposed; `builtAt` answers in the plan's own coordinates. */
export function runScene(s: Scene, t: Transform): { d: PlanDecomposition; builtM2: number; builtAt: (x: number, y: number) => boolean; classAt: (x: number, y: number) => string } {
  const { point, ticks } = transformOf(t, s.p.W, s.p.H)
  const tk = ticks(s.xs, s.ys)
  const unreadTicks = s.unread ? { x: [...ticks(s.unread.x ?? [], []).xs, ...ticks([], s.unread.y ?? []).xs], y: [...ticks(s.unread.x ?? [], []).ys, ...ticks([], s.unread.y ?? []).ys] } : undefined
  const extraChains: DimensionChain[] = []
  if (s.verticalChain) {
    const c = ticks([s.verticalChain.baselineX], s.verticalChain.ticksY)
    const vertical = t === 'id' || t === 'mirrorX' || t === 'mirrorY'
    extraChains.push(vertical ? chain('extra', 'VERTICAL', [...c.ys].sort((a, b) => a - b), { baselinePx: c.xs[0] }) : chain('extra', 'HORIZONTAL', [...c.xs].sort((a, b) => a - b), { baselinePx: c.ys[0] }))
  }
  const callouts = (s.callouts ?? []).map((c) => {
    const [x, y] = point(c.at.x, c.at.y)
    return { ...c, at: { x, y } }
  })
  const { d, builtM2 } = run(render(s.p, t), tk.xs, tk.ys, callouts, { ...(unreadTicks ? { unreadTicks } : {}), extraChains })
  return {
    d,
    builtM2,
    builtAt: (x, y) => {
      const [u, v] = point(x, y)
      return builtAt(d, u, v)
    },
    classAt: (x, y) => {
      const [u, v] = point(x, y)
      return d.cells.find((c) => u >= c.rect.x0 && u < c.rect.x1 && v >= c.rect.y0 && v < c.rect.y1)?.classification ?? 'NONE'
    },
  }
}
