/**
 * N9-02R (research only): scores a wall-end reader on the frozen facade holdout. A reading ACCEPTS both wall ends (two
 * columns) or REFUSES; it is scored against the holdout's truth:
 *   ACCEPT case: both ends within END_TOLERANCE_PX → TRUE_ACCEPT; a wrong end → FALSE_ACCEPT; a refusal → FALSE_REFUSAL
 *   REFUSE case: any acceptance → FALSE_ACCEPT (hard); a refusal → TRUE_REFUSAL
 *   EITHER case: a correct acceptance → TRUE_ACCEPT; a refusal → TRUE_REFUSAL; a wrong one → FALSE_ACCEPT
 *   npx vite-node research/analyzer-n9-02r/eval-holdout.ts -- --reader n9-02a|n9-02r --out <file.json>
 */
import { writeFileSync } from 'node:fs'
import { skyMask } from '@buildapp/reconstruction'
import { WALL_BAND_MIN_SHARE, WALL_BAND_MIN_WIDTH, wallBands } from '../../packages/analysis-service/src/assessment/elevation-axes.js'
import { developmentCases, holdoutCases } from '../../packages/analysis-service/test/fixtures/facade-holdout.js'
import type { HoldoutCase } from '../../packages/analysis-service/test/fixtures/facade-holdout.js'

export const END_TOLERANCE_PX = 3
type Reading = { decision: 'ACCEPT' | 'REFUSE'; x0?: number; x1?: number; why: string }

const readers: Record<string, (c: HoldoutCase) => Promise<Reading> | Reading> = {
  // the N9-02A path: the widest neutral band across five columns of the traced outline, sky excluded, not cut by it
  'n9-02a': (c) => {
    const r = { width: c.raster.width, height: c.raster.height, data: c.raster.data }
    const ext = c.truth.outline
    const bands = wallBands(r as never, ext, undefined, skyMask(r as never)).filter((b) => !b.clipped && b.share >= WALL_BAND_MIN_SHARE && b.x1 - b.x0 >= WALL_BAND_MIN_WIDTH * (ext.x1 - ext.x0)).sort((p, q) => q.rows - p.rows || q.x1 - q.x0 - (p.x1 - p.x0))
    return bands[0] ? { decision: 'ACCEPT', x0: bands[0].x0, x1: bands[0].x1, why: `band over ${bands[0].rows} rows` } : { decision: 'REFUSE', why: 'no unclipped neutral band' }
  },
  'n9-02r': async (c) => {
    const { facadeAnchors } = await import('../../packages/analysis-service/src/assessment/facade-anchors.js')
    const a = facadeAnchors({ width: c.raster.width, height: c.raster.height, data: c.raster.data } as never, c.truth.outline)
    return a.wallEnds.state === 'ACCEPTED' ? { decision: 'ACCEPT', x0: a.wallEnds.x0, x1: a.wallEnds.x1, why: a.wallEnds.why } : { decision: 'REFUSE', why: a.wallEnds.why }
  },
}

export function score(c: HoldoutCase, r: Reading): { outcome: 'TRUE_ACCEPT' | 'FALSE_ACCEPT' | 'FALSE_REFUSAL' | 'TRUE_REFUSAL'; errPx: number | null } {
  const err = r.decision === 'ACCEPT' && r.x0 !== undefined && r.x1 !== undefined ? Math.max(Math.abs(r.x0 - c.truth.wallX0), Math.abs(r.x1 - c.truth.wallX1)) : null
  const right = err !== null && err <= END_TOLERANCE_PX
  if (c.truth.expected === 'ACCEPT') return { outcome: r.decision === 'REFUSE' ? 'FALSE_REFUSAL' : right ? 'TRUE_ACCEPT' : 'FALSE_ACCEPT', errPx: err }
  if (c.truth.expected === 'REFUSE') return { outcome: r.decision === 'REFUSE' ? 'TRUE_REFUSAL' : 'FALSE_ACCEPT', errPx: err }
  return { outcome: r.decision === 'REFUSE' ? 'TRUE_REFUSAL' : right ? 'TRUE_ACCEPT' : 'FALSE_ACCEPT', errPx: err }
}

if (process.argv.includes('--reader')) {
  const name = process.argv[process.argv.indexOf('--reader') + 1]
  const rows = []
  // --dev <seed>: the development set (another seed); without it, the frozen holdout
  const dev = process.argv.includes('--dev') ? Number(process.argv[process.argv.indexOf('--dev') + 1]) : undefined
  for (const c of dev !== undefined ? developmentCases(dev) : holdoutCases()) {
    const r = await readers[name](c)
    const s = score(c, r)
    rows.push({ id: c.truth.id, family: c.truth.family, expected: c.truth.expected, truth: [c.truth.wallX0, c.truth.wallX1], reading: r.decision === 'ACCEPT' ? [r.x0, r.x1] : null, ...s, why: r.why })
  }
  const count = (o: string): number => rows.filter((x) => x.outcome === o).length
  const summary = { reader: name, set: dev !== undefined ? `development seed ${dev}` : 'frozen holdout', TRUE_ACCEPT: count('TRUE_ACCEPT'), FALSE_ACCEPT: count('FALSE_ACCEPT'), FALSE_REFUSAL: count('FALSE_REFUSAL'), TRUE_REFUSAL: count('TRUE_REFUSAL'), hardFalseAcceptOnRefuse: rows.filter((x) => x.expected === 'REFUSE' && x.outcome === 'FALSE_ACCEPT').length }
  writeFileSync(process.argv[process.argv.indexOf('--out') + 1], JSON.stringify({ summary, rows }, null, 1))
  for (const x of rows) console.log(x.outcome.padEnd(14), x.id.padEnd(18), JSON.stringify(x.truth), JSON.stringify(x.reading), x.errPx, x.why.slice(0, 90))
  console.log(JSON.stringify(summary))
}
