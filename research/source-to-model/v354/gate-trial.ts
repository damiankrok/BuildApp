/**
 * v3.54 controlled trial of the AI follow-up gate: the product's own `drawingsWeaknesses` / `describedFollowUp` applied to
 * saved drawings-path result summaries (no reader, no call). Prints, per run, whether the house reader would be asked.
 * vite-node research/source-to-model/v354/gate-trial.ts -- <run dir>...
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DESCRIBABLE_AFTER, drawingsWeaknesses } from '@buildapp/analysis-service'

for (const dir of process.argv.slice(2).filter((a) => a !== '--')) {
  const name = dir.split('/').filter(Boolean).pop()
  if (existsSync(join(dir, 'failure.json'))) {
    const f = JSON.parse(readFileSync(join(dir, 'failure.json'), 'utf8')) as { code: string }
    console.log(JSON.stringify({ run: name, outcome: 'REFUSAL', code: f.code, readerAsked: DESCRIBABLE_AFTER.has(f.code) }))
    continue
  }
  const r = JSON.parse(readFileSync(join(dir, 'result-summary.json'), 'utf8'))
  const weak = drawingsWeaknesses(r)
  console.log(JSON.stringify({ run: name, outcome: 'MODEL', weaknesses: weak, readerAsked: weak.length > 0, coverage: r.measurement?.coverage?.status ?? null }))
}
