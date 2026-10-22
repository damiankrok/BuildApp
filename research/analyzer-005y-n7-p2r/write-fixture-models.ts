/** N7-P2R: the synthetic fixtures' models, written outside the repository for the viewer. RESEARCH ONLY. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { memoryByteCache } from '@buildapp/source-package'
import { serializeModel } from '@buildapp/model'
import { SLIVERTON, SLIVERTON_DIMENSIONED, THINWALL, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../packages/analysis-service/src/index.js'
const out = resolve(process.argv[2])
if (out.startsWith(resolve(import.meta.dirname, '../..'))) throw new Error('outside the repository only')
mkdirSync(out, { recursive: true })
const houses = { sliverton: SLIVERTON, 'sliverton-dimensioned': SLIVERTON_DIMENSIONED, thinwall: THINWALL }
const publisher = syntheticPublisher({ projects: Object.entries(houses).map(([code, house]) => ({ code, title: code, house })) })
for (const code of Object.keys(houses)) {
  const { result, reconstruction } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
  const text = serializeModel(result.model)
  writeFileSync(join(out, `${code}.model.json`), text)
  writeFileSync(join(out, `${code}.thin-bodies.json`), JSON.stringify(reconstruction.thinBodies, null, 1) + '\n')
  console.log(code, result.preview.outcome, createHash('sha256').update(text).digest('hex').slice(0, 8))
}
