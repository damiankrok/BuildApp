/**
 * v3.54.20 freeze 3 check (0 USD): arbitration 1.5.0 holds the AGREED storeys and ridge direction against a body. For
 * every recorded run given, LOCAL's own body (local-model.json) is measured against the structure that run agreed
 * (STRUCTURE_READ.agreed): a run where nothing is held against LOCAL is decided exactly as before.
 *   vite-node arbitration-neutral.ts -- <run dir>...
 */
import { existsSync, readFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import { readbackStructure } from '../../../packages/analysis-service/src/consult/readback.js'
import { structureAgainstBody } from '../../../packages/analysis-service/src/consult/structure.js'
import type { AgreedStructure } from '../../../packages/analysis-service/src/consult/structure.js'
import { STOREY_WALLS } from '../../../packages/analysis-service/src/consult/massing/massing.js'

let held = 0
for (const dir of process.argv.slice(2).filter((a) => a !== '--')) {
  const name = dir.split('/').filter(Boolean).slice(-2).join('/')
  const events = existsSync(`${dir}/events.json`) ? (JSON.parse(readFileSync(`${dir}/events.json`, 'utf8')) as unknown) : []
  const list = (Array.isArray(events) ? events : ((events as { events?: unknown[] }).events ?? [])) as Array<{ kind?: string; agreed?: AgreedStructure }>
  const agreed = list.filter((e) => e.kind === 'STRUCTURE_READ').pop()?.agreed
  const arb = existsSync(`${dir}/body-arbitration.json`) ? (JSON.parse(readFileSync(`${dir}/body-arbitration.json`, 'utf8')) as { decision?: string }).decision : undefined
  if (!agreed) { console.log(`${name}: no structure read — arbitration unchanged`); continue }
  if (!existsSync(`${dir}/local-model.json`)) { console.log(`${name}: LOCAL built no body — no arbitration (${arb ?? 'body built from the sources'})`); continue }
  const raw = JSON.parse(readFileSync(`${dir}/local-model.json`, 'utf8')) as { model?: unknown }
  const rb = readbackStructure(parseModel(JSON.stringify(raw.model ?? raw)), undefined, STOREY_WALLS)
  const main = [...rb.bodies].sort((p, q) => q.widthM * q.depthM - p.widthM * p.depthM)[0]
  const against = structureAgainstBody(agreed, main, STOREY_WALLS)
  if (against.length > 0 && arb !== 'REPLACED_BY_SOURCE_BODY') held += 1
  console.log(`${name}: recorded decision ${arb ?? '—'}; held against LOCAL now: ${against.length === 0 ? 'nothing' : against.join(' | ')}${against.length > 0 ? (arb === 'REPLACED_BY_SOURCE_BODY' ? ' (LOCAL was replaced already: the decision stands)' : ' — THE DECISION MAY CHANGE') : ''}`)
}
console.log(`runs whose recorded decision may change: ${held}`)
