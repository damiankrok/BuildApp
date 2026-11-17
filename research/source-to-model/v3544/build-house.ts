/**
 * v3.54.4 — one house document through the resolver, the builder, the kernel and the compiler.
 *
 *   npx vite-node research/source-to-model/v3544/build-house.ts -- --doc <house.json> --out <dir>
 *
 * Writes house.json (observations + agreed geometry + verification with the trace to program objects), model.json,
 * scene.json, the neutral views the consultant is shown (views-SIDES.png, views-AROUND.png) and measured.json — what the
 * COMPILED scene measures (extents, heights), for the comparison with the source. No picture is read, no API is called.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { serializeModel, parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle, serializeBundle } from '@buildapp/mobile-scene'
import { buildHouse, parseHouseDocument, resolveHouse } from '@buildapp/reconstruction'
import { renderModelViews } from '../../../packages/analysis-service/src/consult/model-views.js'
import { measureScene } from '../../../packages/analysis-service/src/house/measure.js'

const arg = (n: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const out = arg('out') as string
mkdirSync(out, { recursive: true })
const parsed = parseHouseDocument(JSON.parse(readFileSync(arg('doc') as string, 'utf8')))
if (!parsed.ok) {
  process.stdout.write(`REJECTED\n${parsed.issues.join('\n')}\n`)
  process.exit(2)
}
const doc = parsed.document
if (!doc.geometry) {
  const r = resolveHouse(doc)
  if (r.geometry) doc.geometry = r.geometry
  doc.verification = r.verification
}
for (const c of doc.verification.checks) process.stdout.write(`${c.status.padEnd(11)} ${c.scope.padEnd(11)} ${c.what}: ${c.measured}  [expected ${c.expected}]\n`)
for (const h of doc.verification.held) process.stdout.write(`HELD        ${h.code} ${h.ref}: ${h.why}\n`)
if (!doc.geometry) {
  writeFileSync(join(out, 'house.json'), `${JSON.stringify(doc, null, 1)}\n`)
  process.stdout.write('NO GEOMETRY\n')
  process.exit(3)
}
const built = buildHouse(doc, `house-${doc.id}`)
for (const r of built.refusals) process.stdout.write(`REFUSED     ${r.code} ${r.path}: ${r.why}\n`)
for (const r of built.kernelRefusals) process.stdout.write(`KERNEL      ${r.type} ${r.id ?? ''} ${r.codes.join(',')}: ${r.message.slice(0, 240)}${r.dropped.length ? ` (also dropped: ${r.dropped.join(', ')})` : ''}\n`)
const modelText = serializeModel(built.model)
const scene = compileBuilding(parseModel(modelText) as never)
const bundle = buildMobileSceneBundle(built.model, { scene })
const errors = scene.diagnostics.filter((d) => d.severity === 'ERROR')
for (const e of errors.slice(0, 12)) process.stdout.write(`COMPILE     ${e.code} ${(e as { objectId?: string }).objectId ?? ''}: ${String((e as { message?: string }).message ?? '').slice(0, 200)}\n`)
const measured = measureScene(bundle, doc.geometry)
doc.verification.parameters = [...doc.verification.parameters, ...built.trace]
for (const r of built.kernelRefusals) doc.verification.held.push({ ref: r.id ?? r.type, code: 'COMPILE_CONFLICT', why: `${r.codes.join(',')}: ${r.message.slice(0, 200)}` })
writeFileSync(join(out, 'house.json'), `${JSON.stringify(doc, null, 1)}\n`)
writeFileSync(join(out, 'model.json'), modelText)
writeFileSync(join(out, 'scene.json'), serializeBundle(bundle))
writeFileSync(join(out, 'program.json'), `${JSON.stringify(built.fitted, null, 1)}\n`)
writeFileSync(join(out, 'measured.json'), `${JSON.stringify(measured, null, 1)}\n`)
for (const v of renderModelViews(bundle, 520)) writeFileSync(join(out, `views-${v.name}.png`), v.png)
process.stdout.write(`BUILT ${built.complete ? 'COMPLETE' : 'PARTIAL'}: ${built.fitted.length} commands, ${bundle.scene.meshes.length} meshes, ${errors.length} compile errors, ${built.kernelRefusals.length} kernel refusals\n${JSON.stringify(measured)}\n`)
