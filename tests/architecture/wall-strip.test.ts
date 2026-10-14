/**
 * BUILDPLAN-ANALYZER-005Q (N1a) — the wall strip is named, never built, and has one owner.
 *
 * Layout 1.2.0 reads a strip between the walled envelope and the side the chains state as the building's own exterior
 * wall when wall-thick ink fills it (`wallStripsOf`), names the face the body leaves open as an AMBIGUOUS gap, takes
 * MEASURED off the span across it, and v2 reads no recess, return or terrace in it and emits the body's ring and mass
 * as SOURCE_DERIVED. These gates hold, by the code itself, that the change cannot quietly become something else:
 *
 *  - the wall-strip test reads the drawing only: no published figure, slug, house, publishedAreas or footprint area,
 *    and nothing of the plan resolver's;
 *  - the decision has one owner: `layout.ts` decides and names the gap; `v2/reconstruct-v2.ts` only asks
 *    `isWallStripZone` and `openFacesOf` (no second copy of the gap-id convention), and `v2/emit.ts` only reads
 *    `MassV2.outerFacesOpen`;
 *  - the strip stays a ZONE region (every strip is still emitted), so the world frame measured to it is untouched;
 *  - no canonical schema change: `packages/model` and `packages/commands` are as they were at the 005Q base;
 *  - `WALL_STRIP_BOUNDS.cover = 0.25` is the only new numeric bound (the other numbers are conventions the code already
 *    had), and the layout's version says it changed;
 *  - the gap is AMBIGUOUS, never REFUSED or MISSING, and nothing on the N1 path can raise a provenance: it only ever
 *    lowers MEASURED to DERIVED and SOURCE_EXACT to SOURCE_DERIVED.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HARD_EVIDENCE_STATUSES } from '@buildapp/model'
import { LAYOUT_INFERENCE_VERSION, WALL_STRIP_BOUNDS } from '@buildapp/reconstruction'

const ROOT = resolve(import.meta.dirname, '../..')
const BASE = '04d5568a4a36d2b850998f2848d06e2179218872'
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')
const codeOf = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')
const importsOf = (source: string): string[] => [...source.matchAll(/^\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])
const withoutStrings = (code: string): string => code.replace(/`[^`]*`/g, '""').replace(/'[^']*'/g, '""')
const stringsOf = (code: string): string[] => [...code.matchAll(/`[^`]*`|'[^'\n]*'|"[^"\n]*"/g)].map((m) => m[0])
const numbersIn = (code: string): string[] => [...new Set([...withoutStrings(code).matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?!\w)/g)].map((m) => m[1]))].sort()
const bodyOf = (source: string, name: string): string => {
  const start = source.search(new RegExp(`(?:export )?(?:function|const) ${name}\\b`))
  if (start < 0) throw new Error(`no ${name}`)
  const next = source.slice(start + 1).search(/\n(?:export )?(?:function|const|type) /)
  return source.slice(start, next < 0 ? undefined : start + 1 + next)
}
const count = (text: string, re: RegExp): number => (text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? []).length

function filesUnder(dir: string, ext: RegExp): string[] {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (['node_modules', 'dist', 'build'].includes(name)) continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (ext.test(name)) out.push(relative(ROOT, p))
    }
  }
  walk(abs)
  return out.sort()
}
const productionSources = (): string[] => [
  ...readdirSync(join(ROOT, 'packages')).flatMap((p) => filesUnder(`packages/${p}/src`, /\.(ts|tsx|mjs|js)$/)),
  ...readdirSync(join(ROOT, 'apps')).flatMap((a) => filesUnder(`apps/${a}/src`, /\.(ts|tsx|mjs|js)$/)),
]

const LAYOUT = 'packages/reconstruction/src/layout.ts'
const V2 = 'packages/reconstruction/src/v2/reconstruct-v2.ts'
const EMIT = 'packages/reconstruction/src/v2/emit.ts'
const BUILDING = 'packages/reconstruction/src/v2/building.ts'
/** The layout's wall-strip code: the strips, the decision, the gap-id convention and its two readers. */
const N1 = ['envelopeStrips', 'zoneIdOf', 'outerFaceSlug', 'WALL_STRIP_BOUNDS', 'wallStripsOf', 'isWallStripZone', 'openFacesOf']
/** The wall-strip lines of the masses loop in `inferStructuralLayout`: the open faces and the bases they lower. */
const massLines = (): string[] => {
  const code = codeOf(read(LAYOUT))
  const from = code.indexOf('const wallStrips = wallStripsOf(')
  const section = code.slice(from, code.indexOf('masses.push({', from))
  return section.split('\n').filter((l) => /wallStrips|\bopen\b|openX|openZ|facesWhy|basisX|basisZ/.test(l)).map((l) => l.trim())
}

/** What the wall-strip test may never be read from. Matched on code, comments and strings removed. */
const FORBIDDEN = /publish|footprint_?area|areaM2|\barea\b|rooms?List|storeyCount|expected|verdict|truth|oracle|holdout|blind|benchmark|archon|dobredomy|projektydomow|\bslug\b|sourcePackage|modelHash/i
/** Nothing of the plan resolver's: its readings, re-read evidence, scale lattice or the options that carry them. */
const RESOLVER = /plan-resolution|resolvePlan|rereadEvidenceIds|PlanReadingChoice|options\.plan|\boptions\b|lattice|accus/i
/** Development and blind houses by name, the 005Q forensics' included. */
const HOUSES = /gozdzik|cyklamen|marcowk|rarytas|kosac|jarzab|arkadi|azali|helikon|morel|zurawk|miranda|modrzew|modrzyk|jablonk|dabecj|tunbergi|milorzeb|\baster\b|galaktyk|eoze|muraj|cieszyn|glogown|akebi|krasnokwiat|miniaturk|willa/i

const hasBase = ((): boolean => {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE}^{commit}`], { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch {
    return false // a shallow clone without the 005Q base: the source-reading gates below still hold the same line
  }
})()
const git = (args: string[]): string => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
const atBase = (path: string): string => git(['show', `${BASE}:${path}`])

describe('005Q the wall strip is read from the drawing only', () => {
  const code = codeOf(read(LAYOUT))

  it('no wall-strip function names a published figure, a slug, publishedAreas, a footprint area or a verdict', () => {
    for (const name of N1) expect(withoutStrings(bodyOf(code, name)).match(FORBIDDEN), name).toBeNull()
    expect(withoutStrings(massLines().join('\n')).match(FORBIDDEN)).toBeNull()
  })

  it('no wall-strip function reads the plan resolver or the pass options', () => {
    for (const name of N1) expect(withoutStrings(bodyOf(code, name)).match(RESOLVER), name).toBeNull()
    expect(withoutStrings(massLines().join('\n')).match(RESOLVER)).toBeNull()
    expect(importsOf(read(LAYOUT))).not.toContain('./plan-resolution.js')
  })

  it('wallStripsOf takes the base plan reading and the envelope, and nothing else', () => {
    // exported (review round 2) for the unit-level G10 test, `wall-strip-unit.test.ts`; the signature is unchanged
    expect(bodyOf(code, 'wallStripsOf')).toMatch(/^export function wallStripsOf\(base: PlanReading, envelope: PixelRect\): WallStrip\[\]/)
    expect(bodyOf(code, 'envelopeStrips')).toMatch(/^function envelopeStrips\(base: PlanReading, envelope: PixelRect\)/)
    // what it reads off the plan: its bands, its wall thickness, its extent, its frame and its registration (a gap's depth in metres)
    const reads = [...new Set([...withoutStrings(bodyOf(code, 'wallStripsOf')).matchAll(/\bbase\.(\w+(?:\.\w+)*)/g)].map((m) => m[1]))].sort()
    expect(reads).toEqual(['bands', 'decomposition.wallThickness.px', 'frame.id', 'registration', 'registration.metresPerPixelX', 'registration.metresPerPixelY'])
  })

  it('no house is named in the wall-strip code, the files N1 touched or its synthetic fixture', () => {
    for (const name of N1) expect(bodyOf(read(LAYOUT), name).match(HOUSES), name).toBeNull()
    for (const f of [V2, EMIT, BUILDING]) expect(read(f).match(HOUSES), f).toBeNull()
    expect(read(LAYOUT).match(HOUSES)).toBeNull()
    expect(read('packages/reconstruction/test/wall-strip-invariance.test.ts').match(HOUSES)).toBeNull()
    expect(read('packages/reconstruction/test/wall-strip-unit.test.ts').match(HOUSES)).toBeNull()
  })
})

describe('005Q the N1 decision has one owner', () => {
  it('only layout.ts defines the wall-strip test and the gap-id convention; only reconstruct-v2 asks it', () => {
    const named: Record<string, string[]> = {}
    for (const f of productionSources()) {
      const text = codeOf(read(f))
      for (const n of ['wallStripsOf', 'WALL_STRIP_BOUNDS', 'outerFaceSlug', 'isWallStripZone', 'openFacesOf']) if (new RegExp(`\\b${n}\\b`).test(text)) (named[n] ??= []).push(f)
    }
    expect(named).toEqual({
      wallStripsOf: [LAYOUT],
      WALL_STRIP_BOUNDS: [LAYOUT],
      outerFaceSlug: [LAYOUT],
      isWallStripZone: [LAYOUT, V2],
      openFacesOf: [LAYOUT, V2],
    })
  })

  it('no production string outside layout.ts spells the outer-face gap id', () => {
    // (an outer-face LINE — a wall's drawn face, the model's word — is another thing, and other modules name it)
    const offenders: string[] = []
    for (const f of productionSources()) {
      if (f === LAYOUT) continue
      for (const s of stringsOf(codeOf(read(f)))) if (/outer-face-(zone|\$\{)|gap-outer-face/i.test(s)) offenders.push(`${f}: ${s}`)
    }
    expect(offenders).toEqual([])
    // and in layout.ts it is spelled once — outerFaceSlug writes it; isWallStripZone and openFacesOf both match through
    // it (review round 1: openFacesOf no longer spells its own prefix)
    const layout = codeOf(read(LAYOUT))
    expect(stringsOf(layout).filter((s) => /outer-face/.test(s))).toEqual(['`outer-face-${zoneId}`'])
    expect(bodyOf(layout, 'zoneIdOf')).toMatch(/`zone-\$\{side\.toLowerCase\(\)\}`/)
    expect(bodyOf(layout, 'outerFaceSlug')).toMatch(/`outer-face-\$\{zoneId\}`/)
    expect(bodyOf(layout, 'openFacesOf')).toMatch(/slugify\(outerFaceSlug\('zone-'\)\)/)
    expect(bodyOf(layout, 'isWallStripZone')).toMatch(/slugify\(outerFaceSlug\(zoneId\)\)/)
  })

  it('reconstruct-v2 consumes the two readers, imported from the layout, and decides nothing of its own', () => {
    const code = codeOf(read(V2))
    expect(read(V2)).toMatch(/^import \{ isWallStripZone, openFacesOf \} from '\.\.\/layout\.js'$/m)
    // twice: the zones read as recesses (not a wall strip), and the wall strips probed for a platform to name (review round 1)
    expect(count(code, /\bisWallStripZone\(/)).toBe(2)
    expect(count(code, /\bopenFacesOf\(/)).toBe(1)
    expect(code).toMatch(/const zoneRegions = layout\.footprintRegions\.filter\(\(r\) => r\.kind === 'ZONE' && !isWallStripZone\(r\.id, layout\.unresolved\)\)/)
    expect(code).toMatch(/for \(const zone of layout\.footprintRegions\.filter\(\(r\) => r\.kind === 'ZONE' && isWallStripZone\(r\.id, layout\.unresolved\)\)\)/)
    expect(code).toMatch(/const facesOpen = openFacesOf\(m, layout\.unresolved\)\.map\(\(g\) => g\.what\)/)
    // the wall's bands, thickness and strips are the layout's: v2 reads none of them for this
    expect(code).not.toMatch(/wallStrip|WALL_STRIP|backOn/)
  })

  it('emit.ts only reads MassV2.outerFacesOpen: no layout, no gap, no strip', () => {
    const code = codeOf(read(EMIT))
    expect(importsOf(read(EMIT)).filter((s) => /layout/.test(s))).toEqual([])
    expect(code).not.toMatch(/isWallStripZone|openFacesOf|wallStrip|unresolved\.filter|outer-face/)
    const reads = [...code.matchAll(/(\w+)\??\.outerFacesOpen\b/g)].map((m) => m[1])
    expect(reads.length).toBeGreaterThan(0)
    expect([...new Set(reads)]).toEqual(['m'])
    expect(code).not.toMatch(/outerFacesOpen\s*[:=](?!=)/)
  })

  it('MassV2 carries the open faces as their words, optionally', () => {
    expect(read(BUILDING)).toMatch(/^ {2}outerFacesOpen\?: string\[\]$/m)
    expect(count(codeOf(read(V2)), /outerFacesOpen/)).toBe(1)
    expect(codeOf(read(V2))).toMatch(/\.\.\.\(facesOpen\.length > 0 \? \{ outerFacesOpen: facesOpen \} : \{\}\)/)
  })
})

describe('005Q the strip stays a zone, so the world frame is untouched', () => {
  const code = codeOf(read(LAYOUT))

  it('zonesOutsideEnvelope emits every strip: no skip, and no wall-strip test inside it', () => {
    const body = bodyOf(code, 'zonesOutsideEnvelope')
    expect(body).toMatch(/for \(const strip of envelopeStrips\(base, envelope\)\) \{/)
    expect(body).not.toMatch(/\bcontinue\b|\bbreak\b|\breturn\b(?! out\b)|wallStrip|isWallStripZone|WALL_STRIP|cover|\.filter\(/)
  })

  it('the layout pushes every zone it is given, before and regardless of the wall strips', () => {
    const loop = /for \(const zone of zonesOutsideEnvelope\(base, envelope\.rect, frame\)\) \{([\s\S]*?)\n {2}\}\n/.exec(code)
    expect(loop).not.toBeNull()
    expect(loop?.[1]).not.toMatch(/continue|wallStrip|isWallStripZone|if \(/)
    expect(loop?.[1]).toMatch(/footprintRegions\.push\(\{ \.\.\.zone, storeyId: baseStorey\.id \}\)/)
    // the wall strips add a gap and lower a basis; they remove nothing
    const uses = [...bodyOf(code, 'inferStructuralLayout').matchAll(/^.*\bwallStrips\b.*$/gm)].map((m) => m[0].trim())
    expect(uses).toEqual(['const wallStrips = wallStripsOf(base, envelope.rect)', 'for (const w of wallStrips) unresolved.push(w.gap)', 'const open = wallStrips.filter((w) => w.backOn(region.pixelRect))'])
  })

  it('the strips the zones and the wall test read are one list: envelopeStrips', () => {
    expect(bodyOf(code, 'wallStripsOf')).toMatch(/for \(const \{ side, rect \} of envelopeStrips\(base, envelope\)\)/)
    expect(count(code, /envelopeStrips\(base, envelope\)/)).toBe(2)
  })

  it('v2 drops a wall strip from the recess, return and terrace reading only — never from the regions themselves', () => {
    const v2 = codeOf(read(V2))
    const lines = v2.split('\n').filter((l) => /isWallStripZone/.test(l) && !/^import /.test(l))
    expect(lines.map((l) => l.trim().slice(0, 20))).toEqual(['const zoneRegions = ', 'for (const zone of l'])
    expect(v2).not.toMatch(/layout\.footprintRegions\s*=|footprintRegions\.splice|footprintRegions\.pop/)
    // the wall-strip loop only names a platform: it builds no terrace, recess, return or feature
    const start = v2.indexOf('for (const zone of layout.footprintRegions.filter((r) => r.kind === \'ZONE\' && isWallStripZone(')
    const probe = v2.slice(start, v2.indexOf('\n  }\n', start))
    expect(probe).toMatch(/readTerraceExtension\(/)
    expect(probe).toMatch(/if \(ext\) gap\(\{ what: `the platform the plan outlines beyond the \$\{side\.toLowerCase\(\)\} wall`/)
    expect(probe).toMatch(/status: 'AMBIGUOUS'/)
    expect(probe).not.toMatch(/terraces\.push|recesses\.push|returns\.push|feature\(|relate\(|record\(/)
  })
})

describe('005Q no canonical schema change', () => {
  const N1_NAMES = /outerFacesOpen|wallStrip|WALL_STRIP|isWallStripZone|openFacesOf|outer-face-zone|cut on a wall/i

  it('the canonical model and the commands name nothing of the wall strip', () => {
    for (const f of [...filesUnder('packages/model/src', /\.(ts|mjs|js)$/), ...filesUnder('packages/commands/src', /\.(ts|mjs|js)$/)]) expect(read(f).match(N1_NAMES), f).toBeNull()
  })

  it('the ring the strip leaves open is written in a status the model already had, and not a hard one', () => {
    const emit = codeOf(read(EMIT))
    const status = /if \(m\.outerFacesOpen && m\.outerFacesOpen\.length > 0\) evidence\(`ring-\$\{m\.id\}-\$\{measuredOn\}`, '(\w+)'/.exec(emit)?.[1]
    expect(status).toBe('SOURCE_DERIVED')
    expect(read('packages/model/src/evidence.ts')).toMatch(/'SOURCE_DERIVED',/)
    expect(HARD_EVIDENCE_STATUSES).not.toContain(status)
  })

  it.skipIf(!hasBase)(`packages/model and packages/commands are byte for byte as at the 005Q base (${BASE.slice(0, 7)}; needs the base in the clone)`, () => {
    expect(git(['diff', '--stat', BASE, '--', 'packages/model', 'packages/commands'])).toBe('')
    expect(git(['ls-files', '--others', '--exclude-standard', '--', 'packages/model', 'packages/commands'])).toBe('')
  })
})

describe('005Q one new bound, and the layout says it changed', () => {
  const code = codeOf(read(LAYOUT))

  it('WALL_STRIP_BOUNDS is { cover: 0.25 } and the layout is 1.2.0', () => {
    expect(WALL_STRIP_BOUNDS).toEqual({ cover: 0.25 })
    expect(bodyOf(code, 'WALL_STRIP_BOUNDS').trim()).toBe('export const WALL_STRIP_BOUNDS = { cover: 0.25 } as const')
    expect(LAYOUT_INFERENCE_VERSION).toBe('1.2.0')
  })

  it('the wall-strip code’s numbers are a frozen set: the bound by name, the rest conventions', () => {
    const frozen: Record<string, string[]> = {
      envelopeStrips: ['2'], // minCell: max(2 px, half a wall), as zonesOutsideEnvelope had it
      zoneIdOf: [],
      outerFaceSlug: [],
      WALL_STRIP_BOUNDS: ['0.25'],
      wallStripsOf: ['0', '0.35', '0.7', '1', '2.5', '5'],
      isWallStripZone: [],
      openFacesOf: [],
    }
    for (const name of N1) expect(numbersIn(bodyOf(code, name)), name).toEqual(frozen[name])
    expect(numbersIn(massLines().join('\n'))).toEqual(['0'])
    // the cover is read by name, never as its digits
    expect(bodyOf(code, 'wallStripsOf')).toMatch(/if \(cover < WALL_STRIP_BOUNDS\.cover\) continue/)
    expect(bodyOf(code, 'wallStripsOf')).not.toMatch(/0\.25/)
  })

  it('every other number in wallStripsOf is a convention the code had before 005Q', () => {
    const strip = bodyOf(code, 'wallStripsOf')
    // wall-thick: ≥ 0.7 of a wall, as the decomposition's thick band
    expect(strip).toMatch(/b\.thickness < wallPx \* 0\.7/)
    expect(read('packages/reconstruction/src/plan-decomposition.ts')).toMatch(/b\.thickness >= wallPx \* 0\.7/)
    // long: ≥ 2.5 walls, as the layout's long band
    expect(strip).toMatch(/b\.length < wallPx \* 2\.5/)
    expect(code).toMatch(/const longEnough = \(b: Band, wall: number\): boolean => b\.length >= wall \* 2\.5/)
    // the face window: max(5 px, 0.35 of the band's thickness), the decomposition's face window at its default snap
    expect(strip).toMatch(/const window = Math\.max\(5, b\.thickness \* 0\.35\)/)
    const decomposition = read('packages/reconstruction/src/plan-decomposition.ts')
    expect(decomposition).toMatch(/const faceWindow = Math\.max\(opt\.snapPx, band\.thickness \* 0\.35\)/)
    expect(decomposition).toMatch(/^ {2}snapPx: 5,$/m)
  })

  it.skipIf(!hasBase)('against the 005Q base, WALL_STRIP_BOUNDS is the only new named constant in the layout, and the version moved from 1.1.0', () => {
    const names = (text: string): string[] => [...codeOf(text).matchAll(/^(?:export )?const ([A-Z][A-Z0-9_]+) =/gm)].map((m) => m[1]).sort()
    const before = names(atBase(LAYOUT))
    const after = names(read(LAYOUT))
    expect(after.filter((n) => !before.includes(n))).toEqual(['WALL_STRIP_BOUNDS'])
    expect(before.filter((n) => !after.includes(n))).toEqual([])
    expect(atBase(LAYOUT)).toMatch(/export const LAYOUT_INFERENCE_VERSION = '1\.1\.0'/)
  })
})

describe('005Q the gap is AMBIGUOUS and N1 never raises a provenance', () => {
  const layout = codeOf(read(LAYOUT))

  it('the gap is AMBIGUOUS, never REFUSED or MISSING, and is about the plan frame', () => {
    const strip = bodyOf(layout, 'wallStripsOf')
    expect([...strip.matchAll(/status: '(\w+)'/g)].map((m) => m[1])).toEqual(['AMBIGUOUS'])
    expect(strip).not.toMatch(/REFUSED|MISSING|BLOCKED|CONFLICT/)
    expect(strip).toMatch(/frameIds: \[base\.frame\.id\]/)
  })

  it('the layout’s wall-strip code names no exact provenance and only ever lowers MEASURED to DERIVED', () => {
    for (const name of N1) expect(bodyOf(layout, name), name).not.toMatch(/SOURCE_EXACT|SOURCE_CORROBORATED|'MEASURED'/)
    const lines = massLines()
    expect(lines.filter((l) => /'MEASURED'|SOURCE_/.test(l))).toEqual([
      "const basisX = openX && basisOf(spanX) === 'MEASURED' ? 'DERIVED' : basisOf(spanX)",
      "const basisZ = openZ && basisOf(spanZ) === 'MEASURED' ? 'DERIVED' : basisOf(spanZ)",
    ])
    // and the quantities take those bases, nothing else
    const section = layout.slice(layout.indexOf('const wallStrips = wallStripsOf('), layout.indexOf('assignRoles(masses'))
    expect(section).toMatch(/widthM: quantity\([^\n]*'m', basisX,/)
    expect(section).toMatch(/depthM: quantity\([^\n]*'m', basisZ,/)
  })

  it('reconstruct-v2’s mass is SOURCE_EXACT only when it was before AND no face is open', () => {
    const v2 = codeOf(read(V2))
    expect(v2).toMatch(/const exact = m\.widthM\.basis === 'MEASURED' && facesOpen\.length === 0\n/)
    expect(v2).toMatch(/exact \? 'SOURCE_EXACT' : 'SOURCE_DERIVED', m\.why, \{ printed: exact, uncertaintyM: 0\.02 \}\)/)
  })

  it('emit writes SOURCE_DERIVED for an open ring, and the SOURCE_EXACT ring only on the other branch, as before', () => {
    const lines = codeOf(read(EMIT)).split('\n').map((l) => l.trim())
    const open = lines.filter((l) => /outerFacesOpen/.test(l))
    expect(open).toHaveLength(1)
    expect(open[0]).toMatch(/'SOURCE_DERIVED'/)
    expect(open[0]).not.toMatch(/SOURCE_EXACT/)
    const next = lines[lines.indexOf(open[0]) + 1]
    expect(next).toBe("else evidence(`ring-${m.id}-${measuredOn}`, 'SOURCE_EXACT', `${(m.x1 - m.x0).toFixed(2)} × ${(m.z1 - m.z0).toFixed(2)} m body from the plan's printed chains and wall bands`)")
  })

  it.skipIf(!hasBase)('against the 005Q base, no file N1 touched says SOURCE_EXACT more often than it did', () => {
    for (const f of [LAYOUT, V2, EMIT, BUILDING]) expect(count(codeOf(read(f)), /SOURCE_EXACT/), f).toBeLessThanOrEqual(count(codeOf(atBase(f)), /SOURCE_EXACT/))
    // and the ring emission's SOURCE_EXACT text is the base's own line, now behind the open-face test
    expect(atBase(EMIT)).toContain("evidence(`ring-${m.id}-${measuredOn}`, 'SOURCE_EXACT', `${(m.x1 - m.x0).toFixed(2)} × ${(m.z1 - m.z0).toFixed(2)} m body from the plan's printed chains and wall bands`)")
  })
})
