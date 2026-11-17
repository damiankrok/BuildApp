import { readFileSync, writeFileSync } from 'node:fs'
import { compileHouse } from '/home/user/BuildApp/packages/analysis-service/src/house/describe.js'
import { renderSideInFrame } from '/home/user/BuildApp/packages/analysis-service/src/consult/model-views.js'
const [houseJson, elev, out, w, h, scale] = process.argv.slice(2).filter((a) => a !== '--')
const doc = JSON.parse(readFileSync(houseJson, 'utf8'))
delete doc.geometry; delete doc.verification
const c = compileHouse(doc, 'x')
const v = c.document.verification.views.find((x) => x.elevation === elev)!
const tf = v.transform!
const k = Number(scale)
const r = renderSideInFrame(c.bundle!, v.side as never, c.measured!.exteriorWalls!, { width: Number(w), height: Number(h), mPerPx: tf.mPerPx / k, alongAtPx0: tf.alongAtPx0, zeroRowPx: (tf.zeroRowPx ?? tf.groundRowPx) * k })
writeFileSync(out, r.png)
