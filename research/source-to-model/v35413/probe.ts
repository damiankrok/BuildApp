import { readFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { visibilityMap, elevationToCell } from '/home/user/BuildApp/packages/analysis-service/src/appearance/index.js'
const align = JSON.parse(readFileSync('/home/user/rd/v35413/trace-A/facade-alignment.json', 'utf8'))
for (const [label, path] of [['A', '/home/user/rd/v35411/local/marcowki-ge-A/model.json'], ['C', '/home/user/rd/v35413/C-offline/model.json']]) {
  const m = parseModel(readFileSync(path, 'utf8'))
  const sc = compileBuilding(m)
  for (const [side, xs, ys] of [['FRONT', [650, 650], [300, 440]], ['FRONT', [760, 760], [300, 440]], ['FRONT', [580, 580], [380, 580]]] as const) {
    const p = align.views.find((v: { facade: string }) => v.facade === side).projection
    const vis = visibilityMap(sc, side, 0.01, { withRegions: true })
    let last = ''
    const out: string[] = []
    for (let x = xs[0]; x <= xs[1]; x++) for (let y = ys[0]; y <= ys[1]; y++) {
      const [ci, cj] = elevationToCell(vis, p.alongAtPx0 + p.alongSign * p.mpp * (x + 0.5), (p.zeroRow - y - 0.5) * p.mpp)
      const mi = vis.mesh[Math.floor(cj) * vis.w + Math.floor(ci)]
      const mm = vis.meshes[mi]
      const key = mm ? `${mm.part}:${mm.materialId}` : 'none'
      if (key !== last) { out.push(`${xs[0]===xs[1]?y:x}:${key}`); last = key }
    }
    console.log(label, side, ys[0], out.join(' | '))
  }
}
