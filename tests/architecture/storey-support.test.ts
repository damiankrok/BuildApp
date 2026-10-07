/**
 * BUILDPLAN-ANALYZER-005L §14 / §22 M4 — storey registration and support read the drawings, never the answer.
 *
 * Where another storey's plan sits, and which body below carries each of its walled regions, may be read from the
 * plans' walls, their chains and registrations, and the decomposition's walled regions. A registration that preferred
 * the placement under which the model gets the published number of storeys, a support rule that stacked a body
 * because the page lists rooms upstairs, or a special case for one house, would make the storey count agree with the
 * figure it is later checked against. These tests hold, by the code itself and by running it, that it cannot:
 *
 *  - the registration and support code imports nothing that holds a published fact, a package, a model or a verdict;
 *  - its code names no published figure, room list, storey count, expected value, verdict, holdout, publisher or house;
 *  - its numbers are a frozen set: a threshold that fits one sheet is a new literal, and fails here until argued for;
 *  - run on the same drawings with the publisher's footprint as printed, as a decoy, or absent, and with a room list
 *    claiming another storey, it decides the same storeys, the same support and the same per-storey footprints.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeImage } from '@buildapp/source-package'
import { composeStructuralLayout, levelsFrom, reconstructV2 } from '@buildapp/reconstruction'
import { buildFixture } from '../../packages/reconstruction/test/pipeline.js'
import { HOUSE_AND_GARAGE, INSET_REAR, ringsByLevel } from '../../packages/reconstruction/test/storey-houses.js'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')
const codeOf = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')
const importsOf = (source: string): string[] => [...source.matchAll(/^\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])
const bodyOf = (source: string, name: string): string => {
  const start = source.search(new RegExp(`(?:function|const) ${name}\\b`))
  if (start < 0) throw new Error(`no ${name}`)
  const next = source.slice(start + 1).search(/\n(?:export )?(?:function|const|type) /)
  return source.slice(start, next < 0 ? undefined : start + 1 + next)
}
const withoutStrings = (code: string): string => code.replace(/`[^`]*`/g, '""').replace(/'[^']*'/g, '""')
const numbersIn = (code: string): string[] => [...new Set([...withoutStrings(code).matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?!\w)/g)].map((m) => m[1]))].sort()

const LAYOUT = 'packages/reconstruction/src/layout.ts'
/** The functions that register a plan onto another and decide what each of its walled regions stands on. */
const REGISTRATION = ['alignPlans', 'matchedLength', 'axisMatch', 'outerWallAxes', 'largestBuilt', 'upperBodiesOf', 'storeySupportOf', 'sameSupport', 'wallsBeyond']
/** The support decision inside the layout pass. */
const supportSection = (): string => {
  const code = codeOf(read(LAYOUT))
  return code.slice(code.indexOf('const minSpanM = minBodySpanM(wallM)'), code.indexOf('assignRoles(masses'))
}

/** What a registration or a support decision may never be read from (§14). Matched on code, comments and strings removed. */
const FORBIDDEN = /publish|footprint_area|rooms?List|publishedRooms|storeyCount|expected|verdict|truth|oracle|holdout|blind|benchmark|archon|dobredomy|projektydomow|\bslug\b|sourcePackage|modelHash|labelled|levels\.floors|gate\.status/i
/** Development and blind houses by name, the 005K fresh projects by id included. */
const HOUSES = /gozdzik|cyklamen|marcowk|rarytas|kosac|jarzab|arkadi|azali|helikon|morel|zurawk|miranda|modrzew|modrzyk|jablonk|dabecj|tunbergi|milorzeb|\baster\b|galaktyk|eoze|bratk|willa|jarzmian|arlet|\b[AD]0\d\b/i

describe('005L §14 registration and support read the drawings only', () => {
  it('the layout pass imports pixel types, the common helpers, the metric shapes and its own reconstruction modules — nothing published', () => {
    const imports = [...new Set(importsOf(read(LAYOUT)))].sort()
    expect(imports).toEqual(['./boundary-completion.js', './plan-decomposition.js', './plan-extent.js', './structural-layout.js', '@buildapp/source-common', '@buildapp/source-cv', '@buildapp/source-metrics', '@buildapp/source-observations'])
  })

  it('no registration or support code names a published figure, a room list, a storey count, a verdict or a house (M4)', () => {
    const code = codeOf(read(LAYOUT))
    for (const name of REGISTRATION) {
      expect(withoutStrings(bodyOf(code, name)).match(FORBIDDEN), name).toBeNull()
      expect(bodyOf(code, name).match(HOUSES), name).toBeNull()
    }
    expect(withoutStrings(supportSection()).match(FORBIDDEN)).toBeNull()
    expect(supportSection().match(HOUSES)).toBeNull()
  })

  it('the layout pass is never handed a published figure: its options carry the drawings and the evidence only', () => {
    const code = read(LAYOUT)
    const options = code.slice(code.indexOf('export type StructuralLayoutOptions'), code.indexOf('/** The ink, wall bands and wall thickness of one plan copy'))
    expect(codeOf(options).match(/publish|footprint|area|room|storeyCount|expected|verdict/i)).toBeNull()
  })
})

describe('005L §22 M4/M7 registration and support have no special cases', () => {
  it('their numbers are a frozen set: conventions and named constants, nothing that fits a sheet', () => {
    const code = codeOf(read(LAYOUT))
    // (1e-6 and 1e-9 read as their digits: the floor below which two scores or areas are one)
    const frozen: Record<string, string[]> = {
      alignPlans: ['0', '0.01', '0.03', '0.15', '1', '1.15', '2', '2.5', '3', '9'],
      matchedLength: ['0', '0.5', '1'],
      axisMatch: ['0'],
      outerWallAxes: ['0', '1', '2'],
      largestBuilt: ['0'],
      upperBodiesOf: ['0', '1'],
      storeySupportOf: ['0', '1', '2', '6', '9'],
      sameSupport: ['0'],
      wallsBeyond: ['0', '2'],
    }
    for (const name of REGISTRATION) expect(numbersIn(bodyOf(code, name)), name).toEqual(frozen[name])
    expect(numbersIn(supportSection())).toEqual(['0', '0.3', '0.7', '0.9', '1', '2', '4'])
    // the named constants, by value: changing one is a decision the report has to argue
    const constant = (n: string): string => (code.match(new RegExp(`const ${n} = ([\\d.e-]+)`)) ?? [])[1]
    expect(Object.fromEntries(['FACADE_WALL_SHARE', 'OUTER_WALLS_PER_END', 'MIN_WALL_PAIR_SPAN_WALLS', 'MAX_WALL_PAIR_SCALE', 'WALL_PAIR_SCALE_AGREEMENT', 'SAME_SCALE_OFFSETS_PER_AXIS', 'STATED_HOLDS_SHARE', 'STOREY_RIVAL_WINDOW', 'STOREY_RIVALS_WEIGHED', 'STOREY_TIE', 'SAME_SUPPORT_IOU', 'MIN_MASS_WALL_FRACTION'].map((n) => [n, constant(n)]))).toEqual({
      FACADE_WALL_SHARE: '0.25',
      OUTER_WALLS_PER_END: '4',
      MIN_WALL_PAIR_SPAN_WALLS: '4',
      MAX_WALL_PAIR_SCALE: '3',
      WALL_PAIR_SCALE_AGREEMENT: '0.02',
      SAME_SCALE_OFFSETS_PER_AXIS: '6',
      STATED_HOLDS_SHARE: '0.5',
      STOREY_RIVAL_WINDOW: '0.1',
      STOREY_RIVALS_WEIGHED: '24',
      STOREY_TIE: '1e-6',
      SAME_SUPPORT_IOU: '0.7',
      MIN_MASS_WALL_FRACTION: '0.35',
    })
  })

  it('no frame id, region id or house is a literal in the registration or the support code', () => {
    const code = codeOf(read(LAYOUT))
    expect(code.match(/['"`](?:frame|region-built|asset)-[a-z0-9-]{6,}['"`]/i)).toBeNull()
    expect(code.match(HOUSES)).toBeNull()
  })
})

describe('005L §14 a published figure or a room list cannot move a storey (executed)', () => {
  const raster = (fx: Awaited<ReturnType<typeof buildFixture>>) => (frame: { assetId: string }) => {
    const asset = fx.pkg.assets.find((a) => a.id === frame.assetId)
    const bytes = asset ? fx.bytesByUrl.get(asset.variants[0].url) : undefined
    return bytes ? decodeImage(bytes) : undefined
  }

  it('the published footprint as printed, as a 1.25× decoy, or absent: the same storeys, support and footprints', async () => {
    const fx = await buildFixture(HOUSE_AND_GARAGE)
    const section = fx.graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION')
    const runWith = (value: number | undefined) =>
      composeStructuralLayout({ slug: 'decoy', sourcePackageId: fx.pkg.id, sourcePackageHash: fx.pkg.contentHash, graph: fx.graph, metrics: fx.metrics, raster: raster(fx), levels: levelsFrom(fx.metrics, section?.id), ...(value === undefined ? {} : { publishedAreas: [{ key: 'footprint_area', label: 'footprint', unit: 'm2', value }] }) })
    const decided = (r: ReturnType<typeof runWith>): string => JSON.stringify({ spans: r.draft.masses.map((m) => [m.id, m.storeySpan]), regs: r.draft.storeyRegistrations, footprints: r.draft.footprintRegions.map((f) => [f.id, f.ring]) })
    const truth = 8.4 * 7.6 + 4.0 * 5.2
    expect(decided(runWith(truth * 1.25))).toBe(decided(runWith(truth)))
    expect(decided(runWith(undefined))).toBe(decided(runWith(truth)))
  }, 120_000)

  it('a room list claiming a third storey, or none at all, leaves the emitted storeys and their rings as they were', async () => {
    const fx = await buildFixture(INSET_REAR)
    const runWith = (rooms: ReadonlyArray<{ storey: string; index: number; label: string; area: number }>) =>
      reconstructV2({ label: 'decoy', slug: 'decoy', sourcePackageId: fx.pkg.id, sourcePackageHash: fx.pkg.contentHash, graph: fx.graph, metrics: fx.metrics, raster: raster(fx), publishedRooms: rooms })
    const shape = (r: ReturnType<typeof runWith>): string => JSON.stringify({ levels: r.model.levels.map((l) => l.index), rings: [...ringsByLevel(r.model)] })
    const plain = shape(runWith([]))
    expect(shape(runWith([{ storey: 'GROUND', index: 1, label: 'Pokój', area: 20 }, { storey: 'UPPER', index: 2, label: 'Pokój', area: 20 }, { storey: 'ATTIC', index: 3, label: 'Pokój', area: 20 }]))).toBe(plain)
  }, 120_000)
})
