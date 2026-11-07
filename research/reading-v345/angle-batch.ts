/** v3.45 DEV batch: the section pitch reader on every case (roof edges from the run's observation graph). args: <cases.json> */
import { readFileSync } from 'node:fs'
import { decodeImage } from '@buildapp/source-package'
import { toGray } from '@buildapp/source-cv'
import { inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
import { angleLabels, judgeAngles } from '@buildapp/source-metrics'
const cases = JSON.parse(readFileSync(process.argv[process.argv.length - 1], 'utf8')) as Array<{ project: string; path: string; evidence: string; sha256: string }>
const rec = inlineRecogniser({ paths: workspaceAssetPaths() })
for (const c of cases) {
  const g = JSON.parse(readFileSync(c.evidence.replace('metric-evidence.json', 'observation-graph.json'), 'utf8'))
  const frame = g.coordinateFrames.find((f: { variantByteHash: string }) => f.variantByteHash === c.sha256)
  const edges = g.observations.filter((o: { frameId: string; kind: string; pixelGeometry: { type: string } }) => o.frameId === frame.id && o.kind === 'ROOF_EDGE' && o.pixelGeometry.type === 'SEGMENT').map((o: { id: string; pixelGeometry: { a: { x: number; y: number }; b: { x: number; y: number } } }) => ({ id: o.id, a: o.pixelGeometry.a, b: o.pixelGeometry.b }))
  const gray = toGray(decodeImage(new Uint8Array(readFileSync(c.path))))
  const { labels, crops } = angleLabels(gray, edges)
  const v = judgeAngles(labels, await rec.recognise(crops))
  const ok = v.filter((x) => x.value !== undefined)
  console.log(c.project.slice(0, 26).padEnd(26), 'edges', edges.length, 'labels', labels.length, 'ADMITTED', JSON.stringify(ok.map((x) => x.value)), '|', v.filter((x) => x.value === undefined).map((x) => x.why.slice(0, 50)).slice(0, 3).join(' ; '))
}
await rec.release?.()
