/**
 * v3.54.19 diagnostic (0 USD): the gaps the ground-floor plan draws in the exterior walls (plan skeleton) against the
 * exterior openings of the delivered model's ground storey — per side, how many plan gaps the model covers and how many
 * of its openings stand where the plan draws wall. usage: vite-node gap-coverage.ts -- <run dir>...
 */
import { existsSync, readFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import { pointWithFront } from '../../../packages/analysis-service/src/consult/massing/massing.js'
import { planGapsFromSkeleton, skeletonInModel } from '../../../packages/analysis-service/src/consult/correct/interior.js'
import { openingSpan } from '../../../packages/analysis-service/src/consult/correct/execute.js'
import type { PlanSkeleton } from '../../../packages/analysis-service/src/consult/plan-skeleton.js'

for (const dir of process.argv.slice(2).filter((a) => a !== '--')) {
  const name = dir.split('/').filter(Boolean).pop()
  if (!existsSync(`${dir}/massing.json`) || !existsSync(`${dir}/model.json`)) { console.log(`${name}: no massing record or no model`); continue }
  const ms = JSON.parse(readFileSync(`${dir}/massing.json`, 'utf8')) as { skeleton?: PlanSkeleton; plan?: { outlinePx?: Array<[number, number]>; observation?: { outline: Array<{ x: number; z: number }> } }; records?: Array<{ massing?: { hypothesis?: { planFront?: 'LEFT' | 'RIGHT' | 'REAR' | 'FRONT' } } }> }
  const arb = existsSync(`${dir}/body-arbitration.json`) ? (JSON.parse(readFileSync(`${dir}/body-arbitration.json`, 'utf8')) as { decision?: string }).decision : undefined
  if (!ms.skeleton || !ms.plan?.outlinePx || !ms.plan.observation || arb === 'LOCAL_STANDS') { console.log(`${name}: no skeleton on the body that stands`); continue }
  const raw = JSON.parse(readFileSync(`${dir}/model.json`, 'utf8')) as { model?: unknown }
  const m = parseModel(JSON.stringify(raw.model ?? raw))
  const sk = ms.skeleton
  const [minX, maxY] = [Math.min(...ms.plan.outlinePx.map((q) => q[0])), Math.max(...ms.plan.outlinePx.map((q) => q[1]))]
  const front = ms.records?.[0]?.massing?.hypothesis?.planFront
  const o = ms.plan.observation.outline
  const obs = skeletonInModel(sk, (px, py) => { const p = { x: (px - minX) * sk.mPerPx, z: (maxY - py) * sk.mPerPx }; return front ? pointWithFront(p, front, o) : p })
  const gaps = planGapsFromSkeleton(m, obs)
  const level = [...m.levels].sort((a, b) => a.elevation - b.elevation)[0]
  const ops = m.openings.flatMap((x) => { const s = openingSpan(m, x); return s && s.y0 < level.elevation + 2.2 ? [{ id: x.id, ...s }] : [] })
  const share = (a0: number, a1: number, b0: number, b1: number): number => (Math.min(a1, b1) - Math.max(a0, b0)) / Math.max(a1 - a0, b1 - b0)
  const bySide = (['FRONT', 'RIGHT', 'REAR', 'LEFT'] as const).map((side) => {
    const g = gaps.filter((q) => q.side === side)
    const p = ops.filter((q) => q.side === side)
    const covered = g.filter((q) => p.some((x) => share(q.a0, q.a1, x.a0, x.a1) >= 0.4)).length
    const onWall = p.filter((x) => !g.some((q) => share(q.a0, q.a1, x.a0, x.a1) >= 0.4)).length
    return `${side} gaps ${g.length} covered ${covered} | model openings ${p.length}, ${onWall} where the plan draws wall`
  })
  console.log(`${name}: ${sk.gaps.length} plan gap(s), ${gaps.length} on a wall of the model\n   ${bySide.join('\n   ')}`)
}
