/**
 * v3.54.17 R3 — the before/after board of one run, 0 USD: per side the original elevation (the cached bytes, private),
 * the sketch drawn from the run's REAL read, the model before the corrections (LOCAL) and the delivered model, each as
 * that side's tile of the SIDES picture. Writes into a private directory; nothing here goes into Git.
 *   npx vite-node research/source-to-model/v35417/r3/boards-r3.ts -- --run <run dir> --cache <dir> --out <dir> --house <name>
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import { parseModel } from '@buildapp/model'
import { renderModelViews } from '../../../../packages/analysis-service/src/consult/model-views.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string => argv[argv.indexOf(`--${n}`) + 1] as string
const run = opt('run')
const out = join(opt('out'), opt('house'))
mkdirSync(out, { recursive: true })
const sha = (b: string): string => createHash('sha256').update(b).digest('hex')

const sides = (file: string, name: string): string | null => {
  if (!existsSync(file)) return null
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { model?: unknown }
  const model = parseModel(JSON.stringify(raw.model ?? raw))
  const v = renderModelViews(buildMobileSceneBundle(model)).find((x) => x.name === 'SIDES')
  if (!v) return null
  writeFileSync(join(out, `${name}-SIDES.png`), v.png)
  return `${name}-SIDES.png`
}
const before = sides(join(run, 'local-model.json'), 'before')
const final = sides(join(run, 'model.json'), 'final')

type Asset = { id: string; variants: Array<{ url: string; byteHash?: string }> }
const pkg = JSON.parse(readFileSync(join(run, 'source-package.json'), 'utf8')) as { assets: Asset[] }
// a frame id is "frame-" + its asset id (possibly shortened) + "-" + a hash: the asset whose id it starts with
const assetOf = (frameId: string): Asset | undefined => {
  const stem = frameId.replace(/^frame-/, '').replace(/-[0-9a-f]{10}$/, '')
  return pkg.assets.filter((a) => a.id.startsWith(stem) || stem.startsWith(a.id)).sort((a, b) => b.id.length - a.id.length)[0]
}
const index: { house: string; before: string | null; final: string | null; sides: Array<Record<string, unknown>> } = { house: opt('house'), before, final, sides: [] }
const skDir = join(run, 'sketches')
const named = readdirSync(skDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
for (const side of [...new Set(['FRONT', 'RIGHT', 'REAR', 'LEFT', ...named])]) {
  const f = join(skDir, `${side}.json`)
  if (!existsSync(f)) {
    index.sides.push({ side, status: 'NOT_SKETCHED', why: 'the run drew no sketch of this side (no orthographic elevation assigned to it)' })
    continue
  }
  const j = JSON.parse(readFileSync(f, 'utf8')) as { sketch?: { frameId?: string }; failed?: unknown }
  const frameId = j.sketch?.frameId
  const a = frameId ? assetOf(frameId) : undefined
  let source: string | null = null
  for (const v of a?.variants ?? []) {
    const p = join(opt('cache'), `${sha(v.url).slice(0, 32)}.bin`)
    if (!existsSync(p)) continue
    const bytes = readFileSync(p)
    const ext = bytes[0] === 0x89 ? 'png' : 'jpg'
    source = `${side}-source.${ext}`
    writeFileSync(join(out, source), bytes)
    break
  }
  const png = join(skDir, `${side}.png`)
  if (existsSync(png)) writeFileSync(join(out, `${side}-sketch.png`), readFileSync(png))
  index.sides.push({ side, status: j.sketch ? 'SKETCHED' : 'FAILED', frameId: frameId ?? null, source, sketch: existsSync(png) ? `${side}-sketch.png` : null, why: j.sketch ? '' : JSON.stringify(j.failed ?? '').slice(0, 300) })
}
writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1))
process.stdout.write(`${opt('house')}: before ${before ?? '—'} final ${final ?? '—'} sides ${index.sides.map((s) => `${String(s.side)}:${String(s.status)}`).join(' ')} (files: ${readdirSync(out).length})\n`)
