/**
 * Offline diagnostic (0 USD): the massing solver and the orientation hypothesis re-run on the recorded sketches and
 * plan outline of finished runs, so a change of a reading rule is seen on every house before any picture is sent.
 * usage: vite-node diag-massing.ts -- <runDir>...
 */
import { existsSync, readFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import { solveMassing, type SilhouetteObservation } from '../../../packages/analysis-service/src/consult/massing/massing.js'
import { orientationOf } from '../../../packages/analysis-service/src/consult/massing/ops.js'
import { sideOfFacade } from '../../../packages/analysis-service/src/consult/correct/execute.js'

type Sk = { facade: string; frameId: string; sketch?: { groundRow?: number | null; walls: Array<{ polygon: Array<[number, number]> }>; roofs: Array<{ polygon: Array<[number, number]> }> } }
for (const dir of process.argv.slice(2).filter((a) => a !== '--')) {
  const sk = JSON.parse(readFileSync(`${dir}/sketches.json`, 'utf8')) as { reading: { sketches: Sk[] } }
  const sketches = sk.reading.sketches.filter((x) => x.sketch)
  console.log(`== ${dir}`)
  if (existsSync(`${dir}/massing.json`)) {
    const ms = JSON.parse(readFileSync(`${dir}/massing.json`, 'utf8')) as { plan?: { observation?: unknown }; records?: Array<{ massing?: { hypothesis?: { views?: Array<{ frameId: string; side: string }> } } }> }
    // the side each sketch was read as in the recorded run (an unlabelled side elevation is assigned by the pipeline)
    const recorded = new Map((ms.records?.[0]?.massing?.hypothesis?.views ?? []).map((v) => [v.frameId, v.side]))
    if (ms.plan?.observation) {
      const silhouettes = sketches.flatMap((x) => {
        const side = (recorded.get(x.frameId) as ReturnType<typeof sideOfFacade>) ?? sideOfFacade(x.facade)
        return side && x.sketch ? [{ observationId: `sk-${x.frameId.slice(-12)}`, side, frameId: x.frameId, sourceByteHash: '', groundRow: x.sketch.groundRow ?? null, walls: x.sketch.walls.map((w) => w.polygon), roofs: x.sketch.roofs.map((r) => r.polygon) } as SilhouetteObservation] : []
      })
      const h = solveMassing({ outline: ms.plan.observation as never, silhouettes })
      console.log(`  massing ${h.status}: ${h.why}`)
      for (const b of h.bodies) console.log(`   ${b.id} roof ${JSON.stringify(b.roof)}\n     height: ${b.provenance.height.why}\n     roof: ${b.provenance.roof.source} | ${b.provenance.roof.why}`)
      for (const m of h.missing) console.log(`   missing ${m.anchor}: ${m.why}`)
    } else console.log('  no plan outline recorded')
  }
  for (const f of ['local-model.json', 'massing-model.json', 'model.json']) {
    if (!existsSync(`${dir}/${f}`)) continue
    const m = parseModel(readFileSync(`${dir}/${f}`, 'utf8'))
    const o = orientationOf(sketches.map((x) => ({ facade: x.facade, frameId: x.frameId, groundRow: x.sketch?.groundRow ?? null, walls: (x.sketch?.walls ?? []).map((w) => w.polygon), roofs: (x.sketch?.roofs ?? []).map((r) => r.polygon) })), m, sideOfFacade)
    console.log(`  orientation on ${f}: ${o.assignment} — ${o.why}`)
  }
}
