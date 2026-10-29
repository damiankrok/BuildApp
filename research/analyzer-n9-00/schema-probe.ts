/**
 * N9-00 (research only, read-only): model schema 1.7.0 compatibility. For every frozen fixture of every older schema,
 * and for the eight N8-03D1 regression models (schema 1.6.0): load (migrating), check the issues, serialise, load the
 * result again (idempotence: no further migration, byte-stable), compile it. For the sealed candidates: replay the
 * program and compare with the sealed model hash. Prints JSON; nothing is written.
 *   npx vite-node research/analyzer-n9-00/schema-probe.ts -- [--models <dir with <house>/model.json>]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { loadModel, serializeModel, MODEL_SCHEMA_VERSION } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildCandidateModel } from '@buildapp/reconstruction'

const ROOT = resolve(import.meta.dirname, '../..')
const sha = (t: string): string => createHash('sha256').update(t).digest('hex')
const arg = (n: string): string | undefined => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : undefined)
function check(path: string): Record<string, unknown> {
  const text = readFileSync(path, 'utf8')
  const stated = (JSON.parse(text) as { schemaVersion: string }).schemaVersion
  const first = loadModel(text)
  if (!first.ok) return { path, stated, ok: false, issues: first.issues.map((i) => i.code) }
  const once = serializeModel(first.model)
  const second = loadModel(once)
  const twice = second.ok ? serializeModel(second.model) : ''
  const scene = compileBuilding(first.model)
  return {
    path: path.replace(ROOT + '/', ''),
    stated,
    now: first.model.schemaVersion,
    migrationSteps: first.issues.filter((i) => i.code === 'SCHEMA_MIGRATED').length,
    otherIssues: first.issues.filter((i) => i.code !== 'SCHEMA_MIGRATED').map((i) => `${i.severity}:${i.code}`),
    reloadIssues: second.ok ? second.issues.map((i) => i.code) : ['RELOAD_FAILED'],
    idempotent: second.ok && twice === once,
    compileErrors: scene.diagnostics.filter((d) => d.severity === 'ERROR').length,
    triangles: scene.meshes.reduce((a, m) => a + m.triangles.length, 0),
    roomsWithHoles: first.model.rooms.filter((r) => (r.holes ?? []).length > 0).length,
  }
}
const fixtures = join(ROOT, 'packages/model/test/fixtures')
const out: Record<string, unknown> = { current: MODEL_SCHEMA_VERSION, fixtures: readdirSync(fixtures).filter((f) => f.endsWith('.json')).sort().map((f) => check(join(fixtures, f))) }
const models = arg('models')
if (models) out.regressionModels = readdirSync(models).filter((h) => existsSync(join(models, h, 'model.json'))).map((h) => ({ house: h, ...check(join(models, h, 'model.json')) }))
const src = join(ROOT, 'packages/candidates/src')
out.candidates = ['marcowki-auto', 'marcowki-auto-v2', 'marcowki-auto-v3'].map((id) => {
  const c = JSON.parse(readFileSync(join(src, `${id}.json`), 'utf8')) as { program: never; label: string; modelId: string; modelHash: string }
  const m = buildCandidateModel(c.program, c.label, c.modelId)
  return { id, replaysToSealedHash: sha(serializeModel(m)) === c.modelHash, schema: m.schemaVersion }
})
out.owner005t = ['jarzmianki-005t-visual', 'gozdzikowce-005t-visual'].map((k) => check(join(src, 'owner-005t', `${k}.model.json`)))
console.log(JSON.stringify(out, null, 1))
