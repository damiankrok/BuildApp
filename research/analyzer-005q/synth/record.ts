/**
 * record.ts — BUILDPLAN-ANALYZER-005Q: the wall-strip fixtures' outcome through whichever reconstruction module
 * `@buildapp/reconstruction` resolves to (RESEARCH ONLY; never imported by production).
 *
 * From the repository root:
 *
 *   node research/analyzer-005q/variant.mjs setup --work <dir outside the repository>     (default rev: the 005Q base)
 *   node research/analyzer-005q/synth/oracle-config.mjs --work <that dir>
 *   npx vite-node --config <that dir>/oracle.config.mjs research/analyzer-005q/synth/record.ts -- --format table --extras --fixtures twoBodies
 *       the frozen solver's outcome, printed as `FROZEN` entries of packages/reconstruction/test/wall-strip.test.ts
 *   npx vite-node research/analyzer-005q/synth/record.ts -- --format json --fixtures twoBodies
 *       the working tree's (no config: the workspace's own module), as `outcomeOf` JSON
 *
 *   --fixtures a,b       the FIXTURES of wall-strip-plans.ts to run (default: all)
 *   --transforms t,u     the redraws (transforms.ts: id, mirrorX, mirrorY, turn90, turn270; default id)
 *   --format json|table  outcomeOf as JSON (default), or one `'name:t': { … }` FROZEN line per run
 *   --extras             table only: also every body's basis, ring and MASS feature and each terrace's reach (the
 *                        fields family 15 asserts beyond the first ring)
 *
 * The fixtures and `outcomeOf` are the test's own (`wall-strip-plans.ts`); with oracle.config.mjs every helper's
 * `../src/index.js` resolves to the variant as well. Nothing here is a drawing of a real building.
 */
import { reconstructV2 } from '@buildapp/reconstruction'
import { TRANSFORMS } from '../../../packages/reconstruction/test/transforms.js'
import type { Transform } from '../../../packages/reconstruction/test/transforms.js'
import { FIXTURES, compileFixture, outcomeOf } from '../../../packages/reconstruction/test/wall-strip-plans.js'
import type { FixtureName, Outcome } from '../../../packages/reconstruction/test/wall-strip-plans.js'

const argv = process.argv.slice(2)
const value = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const names = (value('fixtures')?.split(',') ?? Object.keys(FIXTURES)) as FixtureName[]
const transforms = (value('transforms')?.split(',') ?? ['id']) as Transform[]
for (const n of names) if (!(n in FIXTURES)) throw new Error(`no fixture ${n}`)
for (const t of transforms) if (!TRANSFORMS.includes(t)) throw new Error(`no transform ${t}`)
const format = value('format') ?? 'json'
const extras = argv.includes('--extras')

/** A value as the FROZEN table writes it: bare keys, single-quoted strings, spaced. */
const literal = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(literal).join(', ')}]`
  if (v === null) return 'null'
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  if (typeof v === 'object') return `{ ${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${/^[A-Za-z_]\w*$/.test(k) ? k : literal(k)}: ${literal(x)}`).join(', ')} }`
  return String(v)
}
/** The FROZEN entry of one outcome (wall-strip.test.ts's `Frozen`). */
const frozenOf = (o: Outcome): Record<string, unknown> => ({
  masses: o.masses,
  world: o.world,
  zones: o.zones,
  walls: o.modelWalls,
  layoutRecesses: o.layoutRecesses,
  recessRegions: o.recessRegions,
  ring: o.ringStatus,
  terraces: o.terraces,
  recesses: o.recesses,
  ...(extras ? { massBasis: o.massBasis, rings: o.ringStatuses, massFeatures: o.massFeatures, terraceReach: o.terraceReach } : {}),
})

const out: Record<string, Outcome> = {}
for (const n of names) for (const t of transforms) out[`${n}:${t}`] = outcomeOf(compileFixture(reconstructV2 as never, FIXTURES[n](), t))
if (format === 'table') for (const [k, o] of Object.entries(out)) process.stdout.write(`  '${k}': ${literal(frozenOf(o))},\n`)
else process.stdout.write(`${JSON.stringify(out)}\n`)
