/**
 * `npm run evaluate:v2` — evaluate the analyzer-v2 output for Marcówki against the sealed truth v2.
 *
 * Reads every input as JSON by path (never through a reference or truth package):
 *   --building   stage-reports/artifacts/analyzer-v2/marcowki-building.json   (BuildingV2)
 *   --model      stage-reports/artifacts/analyzer-v2/marcowki-model.json      (compiled CanonicalBuildingModel)
 *   --quality    stage-reports/artifacts/analyzer-v2/feature-quality.json
 *   --lineage    stage-reports/artifacts/analyzer-v2/feature-lineage.json
 *   --residuals  stage-reports/artifacts/analyzer-v2/source-view-residuals.json
 *   --registrations stage-reports/artifacts/analyzer-v2/registrations.json    (optional: elevation sides)
 *   --truth      research/marcowki-v2/marcowki-source-truth-v2.json
 *   --out        stage-reports/artifacts/analyzer-v2   (writes marcowki-v2-evaluation.json and .md)
 *
 * Method (stage brief §21–22): per truth item, find the matching feature in the building by family and
 * position, then compare every numeric property present in both with a stated tolerance rule. No aggregate
 * score and no percentage: the summary is per-family counts of MATCH / PARTIAL / MISSING plus the worst deltas.
 * UNRESOLVED truth items are reported as "truth unresolved; auto says X" without a verdict.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { BuildingV2 } from '../src/v2/building.js'

// ---------------------------------------------------------------------------------------------------------
// Types of what we read (loose: the script must tolerate fields it does not know).
// ---------------------------------------------------------------------------------------------------------

type Dict = Record<string, unknown>
type Uncertainty = { m?: number; deg?: number; m2?: number; risers?: number; mPerPx?: number }
type TruthItem = { id: string; kind: string; name: string; value: unknown; uncertainty?: Uncertainty; status: string; notes?: string; conflict?: string; method?: string; sourceAssetIds?: string[] }
type TruthFile = { schema: string; schemaVersion: string; sealed: string; sourcePackageId: string; frame: Record<string, string>; itemCount: number; items: TruthItem[] }

type QualityLevel = 'L0' | 'L1' | 'L2'
type QualityRecord = { family: string; featureId: string; level: QualityLevel; provenance: string; unresolvedProperties: string[]; objectIds: string[] }
type QualityFile = { records: QualityRecord[]; contentHash: string; summary?: Record<string, Record<string, number>> }
type LineageFile = { contentHash: string; solved: Array<{ id: string; family: string; provenance: string; quality: string; unresolvedProperties: string[] }>; relations: Array<{ fromId: string; toId: string; kind: string }> }
type Residual = { featureId: string; objectId: string; kind: string; modelM: number; observedM: number; residualM: number; toleranceM: number; withinTolerance: boolean }
type ResidualFile = { candidateHash: string; residuals: Residual[] }
type ModelLite = {
  roofs: Array<{ id: string; kind: string; pitchDeg?: number }>
  railings: Array<{ id: string; infill?: string; height?: number }>
  walls: Array<{ id: string; kind: string; levelId: string; height: number; topProfile?: { kind: string } }>
  levels: Array<{ id: string; index: number; elevation: number; height: number }>
}
type Registrations = { elevations?: Array<{ frameId: string; side: string; assetId: string; mpp?: number }>; plans?: unknown[] }

type Opening = BuildingV2['openings'][number]
type SharedDoor = BuildingV2['sharedDoors'][number]
type Interior = BuildingV2['interior'][number]
type WallPiece = Interior['walls'][number]
type DoorGap = Interior['doors'][number]
type Room = Interior['rooms'][number]
type Block = Interior['blocks'][number]
type Recess = BuildingV2['recesses'][number]
type Chimney = BuildingV2['chimneys'][number]
type Rooflight = BuildingV2['rooflights'][number]
type Balcony = BuildingV2['balconies'][number]
type Railing = BuildingV2['railings'][number]
type ReturnWall = BuildingV2['returns'][number]
type Assembly = BuildingV2['assemblies'][number]

// ---------------------------------------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------------------------------------

type Unit = 'm' | 'deg' | 'm2' | 'count' | ''
type Rule = 'general' | 'plan' | 'angle' | 'area' | 'exact'
type PropVerdict = 'WITHIN' | 'OUTSIDE' | 'MISSING' | 'UNRESOLVED_IN_AUTO'
type ItemVerdict = 'MATCH' | 'PARTIAL' | 'MISSING'
type Scope = 'FEATURE' | 'NOT_A_FEATURE' | 'UNRESOLVED'

type Prop = { name: string; truth: unknown; auto: unknown; tolerance: number | null; rule: Rule; unit: Unit; delta: number | null; verdict: PropVerdict; note?: string }
type Item = {
  truthId: string
  kind: string
  name: string
  status: string
  scope: Scope
  matchedFeature: string | null
  matchedFeatureId: string | null
  properties: Prop[]
  verdict: ItemVerdict | null
  autoQuality: QualityLevel | null
  autoProvenance: string | null
  notes: string[]
}
type Extra = { family: string; id: string; featureId: string | null; quality: QualityLevel | null; summary: string }
type WorstDelta = { truthId: string; kind: string; name: string; property: string; truth: unknown; auto: unknown; delta: number; tolerance: number | null; unit: Unit; ratio: number | null }

const RULES: Record<Rule, string> = {
  general: 'max(truth.uncertainty.m, 0.05) m — levels, heights, sills/heads, image-registered verticals, tread goings',
  plan: 'max(truth.uncertainty.m, 0.10) m — plan-derived lengths and positions (footprints, intervals, widths, wall centres and spans, thicknesses, plan rectangles)',
  angle: 'max(truth.uncertainty.deg, 0.5)°',
  area: 'max(truth.uncertainty.m2, 0.5) m²',
  exact: 'categorical / count: exact equality',
}

// ---------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------

const argValue = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}
async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const r3 = (v: number): number => Math.round(v * 1000) / 1000
const mid = (a: number, b: number): number => (a + b) / 2
const overlap = (a: readonly [number, number], b: readonly [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0])
const asDict = (v: unknown): Dict => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {})
const num = (d: Dict, k: string): number | undefined => (isNum(d[k]) ? d[k] : undefined)
const str = (d: Dict, k: string): string | undefined => (typeof d[k] === 'string' ? d[k] : undefined)
const bool = (d: Dict, k: string): boolean | undefined => (typeof d[k] === 'boolean' ? d[k] : undefined)
const pair = (d: Dict, k: string): [number, number] | undefined => {
  const v = d[k]
  return Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) ? [v[0], v[1]] : undefined
}
const numbersIn = (text: string | undefined, re: RegExp): number[] => (text ? [...text.matchAll(re)].map((m) => Number(m[1])) : [])
const fmt = (v: unknown): string => {
  if (v === null || v === undefined) return '—'
  if (isNum(v)) return String(r3(v))
  if (Array.isArray(v)) return `[${v.map(fmt).join(', ')}]`
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
const polygonArea = (poly: ReadonlyArray<readonly [number, number]>): number => {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}
const polygonCentroid = (poly: ReadonlyArray<readonly [number, number]>): [number, number] => {
  const a = polygonArea(poly)
  if (Math.abs(a) < 1e-9) {
    const n = poly.length
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n]
  }
  let cx = 0
  let cz = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!
    const q = poly[(i + 1) % poly.length]!
    const w = p[0] * q[1] - q[0] * p[1]
    cx += (p[0] + q[0]) * w
    cz += (p[1] + q[1]) * w
  }
  return [cx / (6 * a), cz / (6 * a)]
}
const pointInPolygon = (pt: readonly [number, number], poly: ReadonlyArray<readonly [number, number]>): boolean => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!
    const pj = poly[j]!
    const cross = pi[1] > pt[1] !== pj[1] > pt[1] && pt[0] < ((pj[0] - pi[0]) * (pt[1] - pi[1])) / (pj[1] - pi[1]) + pi[0]
    if (cross) inside = !inside
  }
  return inside
}
const bounds = (poly: ReadonlyArray<readonly [number, number]>): { x0: number; x1: number; z0: number; z1: number } => ({
  x0: Math.min(...poly.map((p) => p[0])),
  x1: Math.max(...poly.map((p) => p[0])),
  z0: Math.min(...poly.map((p) => p[1])),
  z1: Math.max(...poly.map((p) => p[1])),
})
const truthPolygon = (v: Dict): Array<[number, number]> | undefined => {
  const p = v['polygon']
  if (!Array.isArray(p) || p.length < 3) return undefined
  const out: Array<[number, number]> = []
  for (const q of p) {
    if (!Array.isArray(q) || !isNum(q[0]) || !isNum(q[1])) return undefined
    out.push([q[0], q[1]])
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------
// The evaluation context: the building, the sidecar files, and which auto features a truth item claimed.
// ---------------------------------------------------------------------------------------------------------

class Ctx {
  readonly used = new Map<string, string[]>()
  constructor(
    readonly b: BuildingV2,
    readonly model: ModelLite,
    readonly quality: Map<string, QualityRecord>,
    readonly solved: Map<string, LineageFile['solved'][number]>,
    readonly relations: LineageFile['relations'],
    readonly residuals: Residual[],
    readonly elevationSides: Map<string, string>,
    readonly registrationsByAsset: Map<string, { side: string; mpp?: number }>,
  ) {}
  qualityOf(autoId: string | null, featureId?: string | null): QualityRecord | undefined {
    if (featureId) {
      const q = this.quality.get(featureId)
      if (q) return q
    }
    if (!autoId) return undefined
    return this.quality.get(`feat-${autoId}`) ?? this.quality.get(autoId)
  }
  use(autoId: string | undefined | null, truthId: string): void {
    if (!autoId) return
    const list = this.used.get(autoId) ?? []
    if (!list.includes(truthId)) list.push(truthId)
    this.used.set(autoId, list)
  }
  level(i: number): BuildingV2['levels'][number] | undefined {
    return this.b.levels.find((l) => l.index === i)
  }
  mainMass(): BuildingV2['masses'][number] | undefined {
    return this.b.masses.find((m) => m.role === 'MAIN') ?? this.b.masses[0]
  }
  allOpenings(): Array<Opening | SharedDoor> {
    return [...this.b.openings, ...this.b.sharedDoors]
  }
  walls(storey?: number): WallPiece[] {
    return this.b.interior.flatMap((r) => r.walls).filter((w) => storey === undefined || w.storeyIndex === storey)
  }
  doors(storey?: number): DoorGap[] {
    return this.b.interior.flatMap((r) => r.doors).filter((d) => storey === undefined || d.storeyIndex === storey)
  }
  rooms(storey?: number): Room[] {
    return this.b.interior.flatMap((r) => r.rooms).filter((m) => storey === undefined || m.storeyIndex === storey)
  }
  blocks(storey?: number): Block[] {
    return this.b.interior.flatMap((r) => r.blocks).filter((k) => storey === undefined || k.storeyIndex === storey)
  }
  rooflightSlope(rl: Rooflight): 'WEST' | 'EAST' | 'UNKNOWN' {
    const side = this.elevationSides.get(rl.frameId)
    if (side === 'LEFT' || side === 'WEST') return 'WEST'
    if (side === 'RIGHT' || side === 'EAST') return 'EAST'
    if (/left|west/i.test(rl.id)) return 'WEST'
    if (/right|east/i.test(rl.id)) return 'EAST'
    return 'UNKNOWN'
  }
  chimneySlope(c: Chimney): 'WEST' | 'EAST' | 'UNKNOWN' {
    const mr = this.b.mainRoof
    if (!mr) return 'UNKNOWN'
    const centre = mr.ridgeAxis === 'Z' ? mid(c.x0, c.x1) : mid(c.z0, c.z1)
    if (mr.ridgeAxis === 'Z') return centre < mr.ridgeAt ? 'WEST' : 'EAST'
    return 'UNKNOWN'
  }
}

// ---------------------------------------------------------------------------------------------------------
// One truth item under evaluation
// ---------------------------------------------------------------------------------------------------------

class Eval {
  props: Prop[] = []
  notes: string[] = []
  matched: string | null = null
  matchedFeatureId: string | null = null
  scope: Scope = 'FEATURE'
  constructor(readonly t: TruthItem) {}

  tol(rule: Rule): number | null {
    const u = this.t.uncertainty ?? {}
    switch (rule) {
      case 'general':
        return Math.max(u.m ?? 0, 0.05)
      case 'plan':
        return Math.max(u.m ?? 0, 0.1)
      case 'angle':
        return Math.max(u.deg ?? 0, 0.5)
      case 'area':
        return Math.max(u.m2 ?? 0, 0.5)
      case 'exact':
        return null
    }
  }

  /** Compare a numeric property. Nothing is recorded when the truth lacks it; MISSING when the auto lacks it. */
  num(name: string, truth: number | undefined, auto: number | undefined, rule: Exclude<Rule, 'exact'>, opts: { note?: string; missingNote?: string; unresolved?: string } = {}): void {
    if (!isNum(truth)) return
    const unit: Unit = rule === 'angle' ? 'deg' : rule === 'area' ? 'm2' : 'm'
    const tolerance = this.tol(rule)
    if (!isNum(auto)) {
      this.props.push({ name, truth: r3(truth), auto: null, tolerance, rule, unit, delta: null, verdict: 'MISSING', note: opts.missingNote ?? opts.note })
      return
    }
    const delta = r3(auto - truth)
    const verdict: PropVerdict = opts.unresolved ? 'UNRESOLVED_IN_AUTO' : Math.abs(auto - truth) <= (tolerance ?? 0) + 1e-9 ? 'WITHIN' : 'OUTSIDE'
    this.props.push({ name, truth: r3(truth), auto: r3(auto), tolerance, rule, unit, delta, verdict, note: opts.unresolved ?? opts.note })
  }

  pairs(name: string, truth: [number, number] | undefined, auto: [number, number] | undefined, rule: Exclude<Rule, 'exact'>, opts: { note?: string; missingNote?: string } = {}): void {
    if (!truth) return
    this.num(`${name}[0]`, truth[0], auto?.[0], rule, opts)
    this.num(`${name}[1]`, truth[1], auto?.[1], rule, opts)
  }

  /** Compare a categorical property (string, boolean, integer count, array) exactly. */
  cat(name: string, truth: unknown, auto: unknown, opts: { note?: string; missingNote?: string; unit?: Unit } = {}): void {
    if (truth === undefined) return
    const unit = opts.unit ?? (isNum(truth) ? 'count' : '')
    if (auto === undefined || auto === null) {
      this.props.push({ name, truth, auto: null, tolerance: null, rule: 'exact', unit, delta: null, verdict: 'MISSING', note: opts.missingNote ?? opts.note })
      return
    }
    const same = JSON.stringify(truth) === JSON.stringify(auto)
    const delta = isNum(truth) && isNum(auto) ? auto - truth : null
    this.props.push({ name, truth, auto, tolerance: null, rule: 'exact', unit, delta, verdict: same ? 'WITHIN' : 'OUTSIDE', note: opts.note })
  }

  missing(name: string, truth: unknown, note: string): void {
    if (truth === undefined) return
    this.props.push({ name, truth: isNum(truth) ? r3(truth) : truth, auto: null, tolerance: null, rule: 'general', unit: isNum(truth) ? 'm' : '', delta: null, verdict: 'MISSING', note })
  }

  match(autoId: string | null | undefined, featureId?: string | null): void {
    if (!autoId) return
    if (!this.matched) {
      this.matched = autoId
      this.matchedFeatureId = featureId ?? null
    }
  }

  finish(c: Ctx): Item {
    const q = c.qualityOf(this.matched, this.matchedFeatureId)
    if (q && q.unresolvedProperties.length) this.notes.push(`feature graph marks unresolved: ${q.unresolvedProperties.join('; ')}`)
    let verdict: ItemVerdict | null = null
    if (this.scope === 'FEATURE') {
      if (!this.matched) verdict = 'MISSING'
      else verdict = this.props.every((p) => p.verdict === 'WITHIN') ? 'MATCH' : 'PARTIAL'
    }
    return {
      truthId: this.t.id,
      kind: this.t.kind,
      name: this.t.name,
      status: this.t.status,
      scope: this.scope,
      matchedFeature: this.matched,
      matchedFeatureId: this.matchedFeatureId ?? (q?.featureId ?? null),
      properties: this.props,
      verdict,
      autoQuality: q?.level ?? null,
      autoProvenance: q?.provenance ?? null,
      notes: this.notes,
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Per-kind evaluators
// ---------------------------------------------------------------------------------------------------------

function evalFrame(e: Eval, v: Dict, c: Ctx): void {
  const zs = numbersIn(str(v, 'z'), /z\s*=\s*(-?[\d.]+)/g)
  const main = c.mainMass()
  const front = c.b.recesses.filter((r) => r.side === 'FRONT')
  const rear = c.b.recesses.filter((r) => r.side === 'REAR')
  const frontMouth = front.length ? Math.min(...front.map((r) => r.mouthAt)) : undefined
  const rearMouth = rear.length ? Math.max(...rear.map((r) => r.mouthAt)) : undefined
  e.num('frontOuterPlaneZ', zs[0], frontMouth, 'plan', { note: 'min mouthAt of the FRONT recesses' })
  e.num('mainFrontWallOuterFaceZ', zs[1], main?.z0, 'plan', { note: 'masses[MAIN].z0' })
  e.num('mainRearWallOuterFaceZ', zs[2], main?.z1, 'plan', { note: 'masses[MAIN].z1' })
  e.num('rearOuterPlaneZ', zs[3], rearMouth, 'plan', { note: 'max mouthAt of the REAR recesses' })
  e.num('westOuterFaceX', 0, c.b.masses.length ? Math.min(...c.b.masses.map((m) => m.x0)) : undefined, 'plan', { note: 'min x0 over masses' })
  e.num('groundFinishedFloorY', 0, c.level(0)?.elevation, 'general', { note: 'levels[0].elevation' })
  e.match(main?.id, main?.featureId)
  if (main) c.use(main.id, e.t.id)
  e.notes.push('the building is in the truth frame: x east of the west outer face, y above the ground floor, z north of the front outer plane (no conversion applied)')
}

function evalLevel(e: Eval, v: Dict, c: Ctx): void {
  const id = e.t.id
  const y = num(v, 'y')
  const m = num(v, 'm')
  const mr = c.b.mainRoof
  const l0 = c.level(0)
  const l1 = c.level(1)
  if (id.includes('GROUND_FFL')) {
    e.num('y', y, l0?.elevation, 'general', { note: 'levels[0].elevation' })
    e.match(l0?.id, l0?.featureId)
    c.use(l0?.id, id)
  } else if (id.includes('UPPER_FFL')) {
    e.num('y', y, l1?.elevation, 'general', { note: 'levels[1].elevation' })
    e.match(l1?.id, l1?.featureId)
    c.use(l1?.id, id)
  } else if (id.includes('EAVE')) {
    e.num('y', y, l1?.wallTop, 'general', { note: 'levels[1].wallTop (the auto eave datum)' })
    e.num('roofEavePlaneY', y, mr?.eaveY, 'general', { note: 'mainRoof.eaveY, the plane derived from 40°, 7.90 and 7.95' })
    e.match(l1?.id, l1?.featureId)
    c.use(l1?.id, id)
  } else if (id.includes('RIDGE')) {
    e.num('y', y, mr?.ridgeY, 'general', { note: 'mainRoof.ridgeY' })
    e.match(mr ? 'main-roof' : null, mr?.featureId)
    if (mr) c.use(mr.featureId, id)
  } else if (id.includes('TERRAIN')) {
    e.num('y', y, c.b.terrainY, 'general', { missingNote: 'BuildingV2.terrainY is absent from the building' })
    e.match(c.b.terrainY !== undefined ? 'terrainY' : null)
  } else if (id.includes('KNEEWALL')) {
    e.num('y', y, l1?.wallTop, 'general', { note: 'levels[1].wallTop: BuildingV2 has no masonry-top field, and wallTop (4.67) is the eave datum rather than the knee wall top' })
    e.match(l1?.id, l1?.featureId)
    c.use(l1?.id, id)
  } else if (id.includes('GROUND_CLEAR')) {
    const clear = l0 && isNum(c.b.slabThicknessM) ? l0.height - c.b.slabThicknessM : undefined
    e.num('m', m, clear, 'general', { note: 'levels[0].height − slabThicknessM' })
    e.match(l0?.id, l0?.featureId)
    c.use(l0?.id, id)
  } else if (id.includes('ATTIC_CLEAR')) {
    const attic = c.model.walls.filter((w) => w.kind === 'INTERIOR' && w.levelId === (l1?.id ?? 'lvl-1'))
    const follow = attic.filter((w) => w.topProfile?.kind === 'FOLLOW_ROOF').length
    e.num('m', m, undefined, 'general', { missingNote: `no attic ceiling in BuildingV2 (a ceiling / partition-cap field would carry it); the model's ${attic.length} attic partitions ${follow ? `FOLLOW_ROOF (${follow})` : 'have no cap'}` })
    e.num('ceilingUndersideY', num(v, 'ceilingUndersideY'), undefined, 'general', { missingNote: 'no ceiling feature in BuildingV2' })
    e.num('ceilingTopY', num(v, 'ceilingTopY'), undefined, 'general', { missingNote: 'no ceiling feature in BuildingV2' })
    e.pairs('ceilingSpanX', pair(v, 'ceilingSpanX'), undefined, 'plan', { missingNote: 'no ceiling feature in BuildingV2' })
    e.match(l1?.id, l1?.featureId)
    c.use(l1?.id, id)
  } else if (id.includes('GARAGE_CLEAR')) {
    const ar = c.b.attachedRoofs[0]
    const clear = ar?.reading?.clearHeightM ?? (ar && l0 ? ar.slabSoffitY - l0.elevation : undefined)
    e.num('m', m, clear, 'general', { note: 'attachedRoofs[0].reading.clearHeightM' })
    e.num('roofSlabTopY', num(v, 'roofSlabTopY'), ar?.slabTopY, 'general', { note: 'attachedRoofs[0].slabTopY' })
    e.num('roofSlabSoffitY', num(v, 'roofSlabSoffitY'), ar?.slabSoffitY, 'general', { note: 'attachedRoofs[0].slabSoffitY' })
    e.match(ar ? `roof-${ar.massId}` : null, ar?.featureId)
    if (ar) c.use(ar.featureId, id)
  } else {
    e.num('y', y, undefined, 'general', { missingNote: 'no level in the building answers this item' })
  }
}

function evalMass(e: Eval, v: Dict, c: Ctx): void {
  const x = pair(v, 'x')
  const z = pair(v, 'z')
  const storeys = Array.isArray(v['storeys']) ? (v['storeys'] as number[]) : undefined
  if (x && z && storeys) {
    const cx = mid(x[0], x[1])
    const cz = mid(z[0], z[1])
    const mass = [...c.b.masses].sort((a, b) => Math.hypot(mid(a.x0, a.x1) - cx, mid(a.z0, a.z1) - cz) - Math.hypot(mid(b.x0, b.x1) - cx, mid(b.z0, b.z1) - cz))[0]
    if (!mass) return
    e.match(mass.id, mass.featureId)
    c.use(mass.id, e.t.id)
    e.pairs('x', x, [mass.x0, mass.x1], 'plan')
    e.pairs('z', z, [mass.z0, mass.z1], 'plan')
    e.num('widthM', num(v, 'widthM'), mass.x1 - mass.x0, 'plan', { note: 'x1 − x0' })
    e.num('depthM', num(v, 'depthM'), mass.z1 - mass.z0, 'plan', { note: 'z1 − z0' })
    e.cat('storeys', storeys, mass.storeys)
    e.num('wallThicknessM', num(v, 'wallThicknessM'), c.b.wallThicknessM, 'plan', { note: 'BuildingV2.wallThicknessM (one value for every external wall)' })
    e.num('sharedWallX', num(v, 'sharedWallX'), mass.x0, 'plan', { note: 'the attached mass x0 (the shared wall line)' })
    e.num('sharedWallThicknessM', num(v, 'sharedWallThicknessM'), undefined, 'plan', { missingNote: 'BuildingV2 carries one wallThicknessM for all walls; no per-wall (shared wall) thickness' })
    return
  }
  if (x && z) {
    // the characteristic envelope: masses plus the recess zones the roof covers
    const mr = c.b.mainRoof
    const front = c.b.recesses.filter((r) => r.side === 'FRONT').map((r) => r.mouthAt)
    const rear = c.b.recesses.filter((r) => r.side === 'REAR').map((r) => r.mouthAt)
    const ex0 = Math.min(...c.b.masses.map((m) => m.x0))
    const ex1 = Math.max(...c.b.masses.map((m) => m.x1))
    const ez0 = Math.min(...c.b.masses.map((m) => m.z0), ...front, ...(mr ? [mr.footprint.z0] : []))
    const ez1 = Math.max(...c.b.masses.map((m) => m.z1), ...rear, ...(mr ? [mr.footprint.z1] : []))
    const main = c.mainMass()
    e.match(main?.id, main?.featureId)
    e.pairs('x', x, [ex0, ex1], 'plan', { note: 'derived: min/max over masses' })
    e.pairs('z', z, [ez0, ez1], 'plan', { note: 'derived: masses ∪ recess mouths ∪ mainRoof.footprint' })
    e.num('widthM', num(v, 'widthM'), ex1 - ex0, 'plan')
    e.num('depthM', num(v, 'depthM'), ez1 - ez0, 'plan')
    e.notes.push('derived envelope, no single feature: masses + recess mouths + main roof footprint')
    return
  }
  if (Array.isArray(v['storey0']) || Array.isArray(v['storey1'])) {
    const main = c.mainMass()
    e.match(main?.id, main?.featureId)
    for (const s of [0, 1, 2, 3]) {
      const truth = v[`storey${s}`]
      if (!Array.isArray(truth)) continue
      const auto = c.b.masses.filter((m) => m.storeys.includes(s)).map((m) => m.id)
      e.cat(`storey${s}.massCount`, truth.length, auto.length, { note: `truth ${JSON.stringify(truth)} vs auto ${JSON.stringify(auto)}` })
    }
    return
  }
  if (isNum(v['walledM2'])) {
    const main = c.mainMass()
    e.match(main?.id, main?.featureId)
    const area = c.b.masses.filter((m) => m.storeys.includes(0)).reduce((s, m) => s + (m.x1 - m.x0) * (m.z1 - m.z0), 0)
    e.num('walledM2', num(v, 'walledM2'), area, 'area', { note: 'Σ (x1−x0)(z1−z0) over the masses on storey 0' })
    e.notes.push(`published ${fmt(v['publishedM2'])} m² is a page fact, not compared`)
    return
  }
  e.notes.push('no numeric mass value understood')
}

function evalRecess(e: Eval, v: Dict, c: Ctx): void {
  const mouthZ = num(v, 'mouthZ')
  const side: 'FRONT' | 'REAR' = mouthZ !== undefined && mouthZ > 5 ? 'REAR' : 'FRONT'
  const storeys: number[] = Array.isArray(v['storeys']) ? (v['storeys'] as number[]) : isNum(v['storey']) ? [v['storey']] : [0]
  const truthReturns = asDict(v['returns'])
  const x = pair(v, 'x')
  for (const s of storeys) {
    const rec = c.b.recesses.find((r) => r.side === side && r.storeyIndex === s)
    const p = storeys.length > 1 ? `storey${s}.` : ''
    if (!rec) {
      e.missing(`${p}recess`, `${side} storey ${s}`, `no ${side} recess on storey ${s} in building.recesses`)
      continue
    }
    e.match(rec.id, `feat-${rec.id}`)
    c.use(rec.id, e.t.id)
    for (const rw of c.b.returns.filter((r) => r.recessId === rec.id)) c.use(rw.id, e.t.id)
    e.num(`${p}mouthZ`, mouthZ, rec.mouthAt, 'plan')
    e.num(`${p}backZ`, num(v, 'backZ'), rec.backAt, 'plan')
    e.num(`${p}depthM`, num(v, 'depthM'), rec.depthM, 'plan')
    const open: [number, number] | undefined = rec.open.length ? [Math.min(...rec.open.map((o) => o.from)), Math.max(...rec.open.map((o) => o.to))] : undefined
    e.pairs(`${p}x`, x, open, 'plan', { note: 'the recess open interval (union of rec.open)' })
    const autoReturns = [...rec.returns].sort((a, b) => a.from - b.from)
    const truthCount = Object.values(truthReturns).filter((r) => Array.isArray(r)).length
    e.cat(`${p}returnCount`, truthCount, autoReturns.length, { note: `auto returns at ${autoReturns.map((r) => `${r3(r.from)}..${r3(r.to)}`).join(', ') || 'none'}` })
    for (const [key, tr] of Object.entries(truthReturns)) {
      if (Array.isArray(tr) && isNum(tr[0]) && isNum(tr[1])) {
        const centre = mid(tr[0], tr[1])
        const best = [...autoReturns].sort((a, b) => Math.abs(mid(a.from, a.to) - centre) - Math.abs(mid(b.from, b.to) - centre))[0]
        const near = best && Math.abs(mid(best.from, best.to) - centre) <= 0.6 ? best : undefined
        e.pairs(`${p}returns.${key}`, [tr[0], tr[1]], near ? [near.from, near.to] : undefined, 'plan', { missingNote: `no auto return near x ${r3(centre)} on ${rec.id}` })
        if (near) e.num(`${p}returns.${key}.thicknessM`, tr[1] - tr[0], near.thicknessM, 'plan', { note: 'ReturnWall.thicknessM' })
      } else if (tr === null) {
        // the truth says there is NO return at this edge of the main body (e.g. the house/garage line at ground level)
        const main = c.mainMass()
        const edge: [number, number] | undefined = main ? (/west/i.test(key) ? [main.x0, main.x0 + 0.8] : [main.x1 - 0.8, main.x1]) : undefined
        const present = edge ? autoReturns.some((r) => overlap([r.from, r.to], edge) > 0.05) : false
        e.cat(`${p}returns.${key}`, 'none', present ? 'present' : 'none', { note: `truth: no return at the main body's ${key} edge${edge ? ` (x ${r3(edge[0])}..${r3(edge[1])})` : ''}` })
      }
    }
    const baseY = num(v, 'eastReturnBaseY')
    if (baseY !== undefined) e.num(`${p}eastReturnBaseY`, baseY, c.level(s)?.elevation, 'general', { note: 'derived: levels[storey].elevation — ReturnWallV2 has no base field' })
  }
}

function evalReturn(e: Eval, v: Dict, c: Ctx): void {
  const returns = c.b.returns
  const first = returns[0]
  e.match(first?.id, first?.featureId)
  for (const r of returns) c.use(r.id, e.t.id)
  const thickness = num(v, 'm')
  if (thickness !== undefined) {
    for (const r of returns) e.num(`thicknessM[${r.id}]`, thickness, r.thicknessM, 'plan')
    e.notes.push(`${returns.length} return walls in the building`)
  }
  const topY = v['topY']
  if (topY !== undefined) {
    const derived = typeof topY === 'string' ? numbersIn(topY, /([\d.]+)\s*derived/g)[0] : isNum(topY) ? topY : undefined
    e.missing('topY', typeof topY === 'string' ? topY : derived, 'ReturnWallV2 has no top/height field (the emitter runs the return up to the roof); mainRoof.eaveY is the roof plane at the outer plane')
    if (derived !== undefined) e.num('roofUndersideAtOuterPlaneY (derived)', derived, c.b.mainRoof?.eaveY, 'general', { note: 'truth "4.64 derived" vs mainRoof.eaveY' })
  }
}

function evalRoof(e: Eval, v: Dict, c: Ctx): void {
  const mr = c.b.mainRoof
  const kind = str(v, 'kind')
  const main = c.mainMass()
  if (kind === 'FLAT') {
    const x = pair(v, 'x')
    const z = pair(v, 'z')
    const cx = x ? mid(x[0], x[1]) : 0
    const cz = z ? mid(z[0], z[1]) : 0
    const ar = [...c.b.attachedRoofs].sort((a, b) => Math.hypot(mid(a.footprint.x0, a.footprint.x1) - cx, mid(a.footprint.z0, a.footprint.z1) - cz) - Math.hypot(mid(b.footprint.x0, b.footprint.x1) - cx, mid(b.footprint.z0, b.footprint.z1) - cz))[0]
    if (!ar) {
      e.notes.push('no attachedRoofs in the building')
      return
    }
    e.match(`roof-${ar.massId}`, ar.featureId)
    c.use(ar.featureId, e.t.id)
    const modelRoof = c.model.roofs.find((r) => r.id === `roof-${ar.massId}`) ?? c.model.roofs.find((r) => r.kind === 'FLAT')
    e.cat('kind', kind, modelRoof?.kind, { note: 'AttachedRoofV2 has no kind; taken from model.roofs', missingNote: 'AttachedRoofV2 has no kind field and the model has no FLAT roof' })
    e.pairs('x', x, [ar.footprint.x0, ar.footprint.x1], 'plan')
    e.pairs('z', z, [ar.footprint.z0, ar.footprint.z1], 'plan')
    e.num('slabTopY', num(v, 'slabTopY'), ar.slabTopY, 'general')
    e.num('parapetTopY', num(v, 'parapetTopY'), ar.parapetTopY, 'general', { missingNote: 'AttachedRoofV2.parapetTopY absent' })
    e.cat('coversPortalRecess', bool(v, 'coversPortalRecess'), ar.projectsOverZone, { note: 'AttachedRoofV2.projectsOverZone' })
    return
  }
  if (!mr) {
    e.notes.push('BuildingV2.mainRoof is absent')
    return
  }
  e.match('main-roof', mr.featureId)
  c.use(mr.featureId, e.t.id)
  if (kind) e.cat('kind', kind, mr.kind)
  e.num('pitchDeg', num(v, 'pitchDeg'), mr.pitchDeg, 'angle')
  if (v['ridgeAxis'] !== undefined) e.cat('ridgeAxis', v['ridgeAxis'], mr.ridgeAxis)
  e.num('ridgeX', num(v, 'ridgeX'), mr.ridgeAxis === 'Z' ? mr.ridgeAt : undefined, 'plan', { note: 'mainRoof.ridgeAt', missingNote: 'ridgeAt is along the other axis' })
  e.num('eaveY', num(v, 'eaveY'), mr.eaveY, 'general', { note: 'the truth keeps both the printed 4.67 and the derived 4.636' })
  e.num('ridgeY', num(v, 'ridgeY'), mr.ridgeY, 'general')
  e.pairs('supportX', pair(v, 'supportX'), [mr.footprint.x0, mr.footprint.x1], 'plan', { note: 'mainRoof.footprint x' })
  if (num(v, 'sideEavesOverhangM') !== undefined && main) {
    e.num('sideEavesOverhangM', num(v, 'sideEavesOverhangM'), Math.max(main.x0 - mr.footprint.x0, mr.footprint.x1 - main.x1), 'plan', { note: 'derived: footprint beyond the main mass on x' })
  }
  const z = pair(v, 'z')
  if (z) {
    e.pairs('z', z, [mr.footprint.z0, mr.footprint.z1], 'plan', { note: 'mainRoof.footprint z' })
    e.cat('coversZones', true, mr.coversZones, { note: mr.coversZonesWhy })
  }
  const gable = num(v, 'gableOverhangBeyondWallM')
  if (gable !== undefined && main) {
    e.num('gableOverhangFrontM', gable, main.z0 - mr.footprint.z0, 'plan', { note: 'derived: masses[MAIN].z0 − footprint.z0' })
    e.num('gableOverhangRearM', gable, mr.footprint.z1 - main.z1, 'plan', { note: 'derived: footprint.z1 − masses[MAIN].z1' })
  }
  const vertical = num(v, 'verticalM')
  if (vertical !== undefined) {
    e.num('verticalM', vertical, mr.buildUpVerticalM, 'general', { note: 'mainRoof.buildUpVerticalM' })
    e.num('perpendicularM', num(v, 'perpendicularM'), mr.buildUpVerticalM * Math.cos((mr.pitchDeg * Math.PI) / 180), 'general', { note: 'derived: buildUpVerticalM · cos(pitch)' })
    e.num('fromPrintedDatumVerticalM', num(v, 'fromPrintedDatumVerticalM'), undefined, 'general', { missingNote: 'no knee-wall top in BuildingV2 to measure from (levels[1].wallTop is the eave datum itself)' })
  }
}

function evalRoofMember(e: Eval, v: Dict, c: Ctx): void {
  const verges = c.b.verges
  const front = verges.find((g) => g.side === 'FRONT')
  const rear = verges.find((g) => g.side === 'REAR')
  const first = front ?? verges[0]
  if (!first) {
    e.notes.push('no verges in the building')
    return
  }
  e.match(first.id, first.featureId)
  for (const g of verges) c.use(g.id, e.t.id)
  const pitch = c.b.mainRoof?.pitchDeg
  const width = first.member.widthM
  e.num('perpendicularWidthM', num(v, 'perpendicularWidthM'), width, 'general', { note: 'verges[FRONT].member.widthM', missingNote: 'FacadeMember.widthM absent on the verge' })
  e.num('verticalExtentM', num(v, 'verticalExtentM'), width !== undefined && pitch !== undefined ? width / Math.cos((pitch * Math.PI) / 180) : undefined, 'general', { note: 'derived: member.widthM / cos(pitch); member.y spans the whole rake, not the band' })
  const planes = numbersIn(str(v, 'plane'), /z\s*=\s*(-?[\d.]+)/g)
  if (planes.length >= 1) e.num('plane.front', planes[0], front?.planeAt, 'plan', { note: 'verges[FRONT].planeAt' })
  if (planes.length >= 2) e.num('plane.rear', planes[1], rear?.planeAt, 'plan', { note: 'verges[REAR].planeAt' })
  const cont = bool(v, 'continuousWithReturns')
  if (cont !== undefined) {
    const vergeIds = new Set(verges.map((g) => g.featureId))
    const continuous = c.b.assemblies.some((a) => a.kind === 'GABLE_FRAME' && a.continuityRelations.some((r) => r.kind === 'CONTINUES_AS' && vergeIds.has(r.to)))
    e.cat('continuousWithReturns', cont, continuous, { note: 'assemblies[GABLE_FRAME].continuityRelations CONTINUES_AS → verge' })
  }
  e.num('depthM', num(v, 'depthM'), first.depthM, 'plan')
  e.notes.push(`auto verge depthM ${fmt(first.depthM)} (the truth leaves the depth unresolved)`)
}

function evalChimney(e: Eval, v: Dict, c: Ctx): void {
  const x = pair(v, 'x')
  const z = pair(v, 'z')
  if (!x || !z) return
  const cx = mid(x[0], x[1])
  const cz = mid(z[0], z[1])
  const best = [...c.b.chimneys].sort((a, b) => Math.hypot(mid(a.x0, a.x1) - cx, mid(a.z0, a.z1) - cz) - Math.hypot(mid(b.x0, b.x1) - cx, mid(b.z0, b.z1) - cz))[0]
  const d = best ? Math.hypot(mid(best.x0, best.x1) - cx, mid(best.z0, best.z1) - cz) : Infinity
  if (!best || d > 1.5) {
    e.notes.push(best ? `nearest chimney ${best.id} is ${r3(d)} m away` : 'no chimneys in the building')
    return
  }
  e.match(best.id, best.featureId)
  c.use(best.id, e.t.id)
  e.pairs('x', x, [best.x0, best.x1], 'plan')
  e.pairs('z', z, [best.z0, best.z1], 'plan')
  e.num('topY', num(v, 'topY'), best.topY, 'general', { missingNote: 'ChimneyReading.topY absent (no render sighting)' })
  if (v['slope'] !== undefined) e.cat('slope', v['slope'], c.chimneySlope(best), { note: 'derived: plan centre against mainRoof.ridgeAt' })
}

function evalRooflight(e: Eval, v: Dict, c: Ctx): void {
  const slope = str(v, 'slope')
  const zc = num(v, 'zCentre')
  const pool = c.b.rooflights.filter((rl) => slope === undefined || c.rooflightSlope(rl) === slope)
  const best = zc === undefined ? pool[0] : [...pool].sort((a, b) => Math.abs(mid(a.alongFrom, a.alongTo) - zc) - Math.abs(mid(b.alongFrom, b.alongTo) - zc))[0]
  const d = best && zc !== undefined ? Math.abs(mid(best.alongFrom, best.alongTo) - zc) : Infinity
  if (!best || d > 1.0) {
    e.notes.push(pool.length ? `nearest ${slope ?? ''} rooflight ${best?.id} centre is ${r3(d)} m away` : `no rooflight on the ${slope ?? 'given'} slope in the building (${c.b.rooflights.length} rooflights total)`)
    return
  }
  e.match(best.id, best.featureId)
  c.use(best.id, e.t.id)
  if (slope !== undefined) e.cat('slope', slope, c.rooflightSlope(best), { note: 'derived from the registration side of rooflight.frameId (LEFT→WEST, RIGHT→EAST)' })
  e.num('widthAlongRidgeM', num(v, 'widthAlongRidgeM'), best.widthM, 'general', { note: 'rooflight.widthM' })
  e.num('lengthAlongSlopeM', num(v, 'lengthAlongSlopeM'), best.lengthM, 'general', { note: 'rooflight.lengthM' })
  e.num('zCentre', zc, mid(best.alongFrom, best.alongTo), 'plan', { note: 'mid(alongFrom, alongTo)' })
  const sx = pair(v, 'slopeXFromEave')
  if (sx) {
    // Both sides may state the position either as a horizontal offset from that slope's eave or as absolute x
    // (the truth writes absolute x for the east slope). Normalise both to "horizontal distance from the eave".
    const mr = c.b.mainRoof
    const autoSlope = c.rooflightSlope(best)
    const fromEave = (x: number): number => {
      if (!mr || mr.ridgeAxis !== 'Z') return x
      if (autoSlope === 'EAST' && x > mr.ridgeAt) return mr.footprint.x1 - x
      if (autoSlope === 'WEST' && x > mr.ridgeAt) return x - mr.footprint.x0
      return x
    }
    const t: [number, number] = [fromEave(sx[0]), fromEave(sx[1])].sort((p, q) => p - q) as [number, number]
    const a: [number, number] = [fromEave(best.slopeFrom), fromEave(best.slopeTo)].sort((p, q) => p - q) as [number, number]
    e.pairs('slopeFromEave', t, a, 'plan', { note: `horizontal distance from the ${autoSlope} eave; truth ${fmt(sx)}, auto slopeFrom/slopeTo ${fmt([best.slopeFrom, best.slopeTo])}` })
  }
  e.num('yBottom', num(v, 'yBottom'), best.yFrom, 'general', { note: 'rooflight.yFrom' })
}

function evalOpening(e: Eval, v: Dict, c: Ctx): void {
  const facade = str(v, 'facade')
  const storey = num(v, 'storey')
  const iv = pair(v, 'interval')
  if (!facade || storey === undefined || !iv) {
    e.notes.push('truth opening lacks facade/storey/interval')
    return
  }
  const interior = facade === 'INTERIOR'
  const pool: Array<Opening | SharedDoor> = interior ? c.b.sharedDoors : c.b.openings.filter((o) => o.facade === facade)
  const cands = pool.filter((o) => o.storeyIndex === storey && overlap(o.interval, iv) > 0)
  const best = [...cands].sort((a, b) => overlap(b.interval, iv) - overlap(a.interval, iv) || Math.abs(mid(a.interval[0], a.interval[1]) - mid(iv[0], iv[1])) - Math.abs(mid(b.interval[0], b.interval[1]) - mid(iv[0], iv[1])))[0]
  if (!best) {
    const same = pool.filter((o) => o.storeyIndex === storey)
    e.notes.push(same.length ? `no ${facade} storey-${storey} opening overlaps ${fmt(iv)}; auto has ${same.map((o) => `${o.id} ${fmt(o.interval)}`).join(', ')}` : `no ${facade} opening on storey ${storey} in the building`)
    return
  }
  e.match(best.id, `feat-${best.id}`)
  c.use(best.id, e.t.id)
  const autoFacade = interior ? ('otherMassId' in best ? 'INTERIOR' : best.facade) : best.facade
  e.cat('facade', facade, autoFacade, { note: interior ? `sharedDoors: ${best.facade} wall of ${best.massId} shared with ${(best as SharedDoor).otherMassId}` : undefined })
  e.cat('storey', storey, best.storeyIndex)
  e.pairs('interval', iv, best.interval, 'plan')
  e.num('widthM', num(v, 'widthM'), best.widthM, 'plan')
  const unresolvedSill = best.provenance.sill === 'ASSUMED_FOR_RENDERING' ? `auto sill is ASSUMED_FOR_RENDERING (${best.unresolved.join('; ') || 'no elevation shows this wall'})` : undefined
  const unresolvedHead = best.provenance.head === 'ASSUMED_FOR_RENDERING' ? `auto head is ASSUMED_FOR_RENDERING (${best.unresolved.join('; ') || 'no elevation shows this wall'})` : undefined
  e.num('sillY', num(v, 'sillY'), best.sillY, 'general', { unresolved: unresolvedSill })
  e.num('headY', num(v, 'headY'), best.headY, 'general', { unresolved: unresolvedHead })
  if (num(v, 'headFarY') !== undefined) e.num('headFarY', num(v, 'headFarY'), best.headFarY, 'general', { missingNote: `OpeningV2.headFarY absent: the auto read the profile as ${best.profile}` })
  if (v['profile'] !== undefined) e.cat('profile', v['profile'], best.profile)
  if (v['family'] !== undefined) e.cat('family', v['family'], best.family)
  const callout = str(v, 'printedCallout')
  if (callout) e.notes.push(best.callout ? `printed callout ${callout}; auto read ${best.callout.widthCm}/${best.callout.heightCm} at ${r3(best.callout.distanceM)} m` : `printed callout ${callout}; the auto read no callout for this opening (OpeningV2.callout absent), its width comes from the plan gap`)
  const res = c.residuals.filter((r) => r.featureId === best.id || r.objectId === best.id)
  if (res.length) e.notes.push(`view residuals: ${res.map((r) => `${r.kind} ${r3(r.residualM)} m${r.withinTolerance ? '' : ' (OUT)'}`).join(', ')}`)
  if (best.unresolved.length) e.notes.push(`auto unresolved: ${best.unresolved.join('; ')}`)
}

function evalInteriorWall(e: Eval, v: Dict, c: Ctx): void {
  const capY = num(v, 'capY')
  if (capY !== undefined) {
    const attic = c.walls(1)
    const first = attic[0]
    e.match(first?.id, first ? `feat-${first.id}` : null)
    const modelAttic = c.model.walls.filter((w) => w.kind === 'INTERIOR' && w.levelId === (c.level(1)?.id ?? 'lvl-1'))
    const follow = modelAttic.filter((w) => w.topProfile?.kind === 'FOLLOW_ROOF')
    e.num('capY', capY, undefined, 'general', { missingNote: `InteriorWallPiece has no top/cap field; the model's ${modelAttic.length} attic partitions are ${follow.length ? `FOLLOW_ROOF (${follow.length}) with height ${fmt(follow[0]?.height)}` : 'uncapped'}` })
    e.notes.push(`truth: partitions below the cap ${fmt(v['belowCap'])}`)
    return
  }
  const storey = num(v, 'storey')
  const axis = str(v, 'axis')
  const centre = num(v, 'centre')
  const span = pair(v, 'span')
  if (storey === undefined || !axis || centre === undefined || !span) {
    e.notes.push('truth wall lacks storey/axis/centre/span')
    return
  }
  const pieces = c.walls(storey).filter((w) => w.axis === axis && Math.abs(w.at - centre) <= 0.2 && overlap([w.from, w.to], span) > 0)
  if (pieces.length) {
    const primary = [...pieces].sort((a, b) => overlap([b.from, b.to], span) - overlap([a.from, a.to], span))[0]!
    e.match(primary.id, `feat-${primary.id}`)
    for (const p of pieces) c.use(p.id, e.t.id)
    if (pieces.length > 1) e.notes.push(`${pieces.length} pieces: ${pieces.map((p) => p.id).join(', ')} (union taken for the span)`)
    const weight = pieces.reduce((s, p) => s + (p.to - p.from), 0)
    const at = pieces.reduce((s, p) => s + p.at * (p.to - p.from), 0) / weight
    e.num('centre', centre, at, 'plan', { note: 'length-weighted mean of piece.at' })
    e.num('span[0]', span[0], Math.min(...pieces.map((p) => p.from)), 'plan')
    e.num('span[1]', span[1], Math.max(...pieces.map((p) => p.to)), 'plan')
    e.num('thicknessM', num(v, 'thicknessM'), primary.thicknessM, 'plan', { note: 'the primary piece' })
  } else {
    // a chimney block or a thick flue reads as a solid block in the auto, not as partition ink
    const blocks = c.blocks(storey).filter((k) => {
      const at = axis === 'X' ? mid(k.z0, k.z1) : mid(k.x0, k.x1)
      const along: [number, number] = axis === 'X' ? [k.x0, k.x1] : [k.z0, k.z1]
      return Math.abs(at - centre) <= 0.2 && overlap(along, span) > 0
    })
    const k = blocks[0]
    if (!k) {
      const near = c.walls(storey).filter((w) => w.axis === axis && Math.abs(w.at - centre) <= 0.5)
      e.notes.push(near.length ? `no piece within ±0.2 m of ${axis} ${centre}; nearest on this axis: ${near.map((w) => `${w.id} at ${r3(w.at)} (${r3(w.from)}..${r3(w.to)})`).join(', ')}` : `no ${axis}-axis piece within ±0.5 m of ${centre} on storey ${storey}`)
      return
    }
    e.match(k.id, `feat-${k.id}`)
    c.use(k.id, e.t.id)
    e.notes.push(`matched a solid block (interior[].blocks), not a wall piece`)
    e.num('centre', centre, axis === 'X' ? mid(k.z0, k.z1) : mid(k.x0, k.x1), 'plan', { note: 'block centre across the axis' })
    e.num('span[0]', span[0], axis === 'X' ? k.x0 : k.z0, 'plan')
    e.num('span[1]', span[1], axis === 'X' ? k.x1 : k.z1, 'plan')
    e.num('thicknessM', num(v, 'thicknessM'), axis === 'X' ? k.z1 - k.z0 : k.x1 - k.x0, 'plan', { note: 'block extent across the axis' })
  }
  const doors = Array.isArray(v['doors']) ? (v['doors'] as unknown[]) : []
  const autoDoors = c.doors(storey).filter((d) => d.wallAxis === axis && Math.abs(d.at - centre) <= 0.2 && overlap([d.from, d.to], [span[0] - 0.2, span[1] + 0.2]) > 0)
  e.cat('doors.count', doors.length, autoDoors.length, { note: autoDoors.length ? `auto doors ${autoDoors.map((d) => `${d.id} ${r3(d.from)}..${r3(d.to)}`).join(', ')}` : undefined })
  doors.forEach((dRaw, i) => {
    const d = asDict(dRaw)
    const div = pair(d, 'interval')
    if (!div) return
    const name = str(d, 'id') ?? `doors[${i}]`
    const best = [...autoDoors].sort((a, b) => Math.abs(mid(a.from, a.to) - mid(div[0], div[1])) - Math.abs(mid(b.from, b.to) - mid(div[0], div[1])))[0]
    const near = best && overlap([best.from, best.to], div) > -0.3 ? best : undefined
    if (near) c.use(near.id, e.t.id)
    e.pairs(`${name}.interval`, div, near ? [near.from, near.to] : undefined, 'plan', { missingNote: 'no InteriorDoorGap on this wall line near the truth door' })
    if (near) e.num(`${name}.widthM`, div[1] - div[0], near.widthM, 'plan')
  })
}

function evalRoom(e: Eval, v: Dict, c: Ctx): void {
  const storey = num(v, 'storey')
  const poly = truthPolygon(v)
  if (storey === undefined || !poly) {
    e.notes.push('truth room lacks storey/polygon')
    return
  }
  const centroid = polygonCentroid(poly)
  const rooms = c.rooms(storey)
  const toPoly = (m: Room): Array<[number, number]> => m.polygon.map((p) => [p.x, p.z])
  const containing = rooms.filter((m) => pointInPolygon(centroid, toPoly(m))).sort((a, b) => a.areaM2 - b.areaM2)
  let best = containing[0]
  let how = 'auto polygon contains the truth centroid'
  // Sampled overlap: the share of the truth polygon's interior that falls inside each auto polygon (0.05 m grid).
  const tb = bounds(poly)
  const samples: Array<[number, number]> = []
  for (let x = tb.x0 + 0.025; x < tb.x1; x += 0.05) for (let z = tb.z0 + 0.025; z < tb.z1; z += 0.05) if (pointInPolygon([x, z], poly)) samples.push([x, z])
  const overlapOf = (m: Room): number => (samples.length ? samples.filter((s) => pointInPolygon(s, toPoly(m))).length / samples.length : 0)
  if (!best) {
    const byOverlap = rooms.map((m) => ({ m, f: overlapOf(m) })).sort((a, b) => b.f - a.f)[0]
    if (byOverlap && byOverlap.f >= 0.25) {
      best = byOverlap.m
      how = `the centroid lies in no auto room (an L-shape or a void); ${Math.round(byOverlap.f * 100)} % of the truth polygon falls inside this auto room`
    }
  }
  if (!best) {
    const byDist = [...rooms].sort((a, b) => Math.hypot(...diff(polygonCentroid(toPoly(a)), centroid)) - Math.hypot(...diff(polygonCentroid(toPoly(b)), centroid)))
    const cand = byDist[0]
    const d = cand ? Math.hypot(...diff(polygonCentroid(toPoly(cand)), centroid)) : Infinity
    if (cand && d <= 1.5) {
      best = cand
      how = `nearest auto centroid ${r3(d)} m away`
    }
  }
  if (!best) {
    const nearest = rooms.map((m) => ({ m, f: overlapOf(m) })).sort((a, b) => b.f - a.f)[0]
    e.notes.push(`no auto room on storey ${storey} contains the truth centroid (${r3(centroid[0])}, ${r3(centroid[1])}), covers ≥ 25 % of the truth polygon or has its centroid within 1.5 m${nearest ? `; best overlap ${Math.round(nearest.f * 100)} % with ${nearest.m.id}` : ''}`)
    return
  }
  const share = overlapOf(best)
  e.notes.push(`${Math.round(share * 100)} % of the truth polygon lies inside the auto polygon`)
  e.match(best.id, `feat-${best.id}`)
  c.use(best.id, e.t.id)
  e.notes.push(how)
  e.num('bounds.x0', tb.x0, best.bounds.x0, 'plan')
  e.num('bounds.x1', tb.x1, best.bounds.x1, 'plan')
  e.num('bounds.z0', tb.z0, best.bounds.z0, 'plan')
  e.num('bounds.z1', tb.z1, best.bounds.z1, 'plan')
  e.num('polygonAreaM2', num(v, 'polygonAreaM2') ?? Math.abs(polygonArea(poly)), best.areaM2, 'area', { note: 'room.areaM2' })
  if (v['label'] !== undefined) e.cat('label', v['label'], best.label, { missingNote: 'RoomPolygon.label absent: the plan label was not read for this room' })
  if (v['number'] !== undefined) e.cat('number', v['number'], best.number, { missingNote: 'RoomPolygon.number absent: the plan label was not read for this room' })
  if (isNum(v['publishedAreaM2']) && isNum(best.publishedAreaM2)) e.cat('publishedAreaM2', v['publishedAreaM2'], best.publishedAreaM2)
  if (best.openPlan) e.notes.push(`auto room is openPlan (${r3(best.areaM2)} m²): several published rooms share it`)
}
const diff = (a: readonly [number, number], b: readonly [number, number]): [number, number] => [a[0] - b[0], a[1] - b[1]]

function evalStair(e: Eval, v: Dict, c: Ctx): void {
  const st = c.b.stair
  if (!st) {
    e.notes.push('BuildingV2.stair is absent')
    return
  }
  const h = st.hypothesis
  e.match(h.id, st.featureId)
  c.use(h.id, e.t.id)
  c.use(st.featureId, e.t.id)
  const flightsRaw = Array.isArray(v['flights']) ? (v['flights'] as unknown[]).map(asDict) : []
  const tFlights = flightsRaw.filter((f) => isNum(f['index']) && isNum(f['risers']))
  const tLandings = flightsRaw.filter((f) => str(f, 'kind')?.includes('LANDING'))
  e.cat('flightCount', tFlights.length, h.flights.length)
  e.cat('landingCount', tLandings.length, h.landings.length)
  e.cat('risersPerFlight', tFlights.map((f) => f['risers']), h.flights.map((f) => f.risers))
  e.cat('risersTotal', num(v, 'risersTotal'), h.risersTotal)
  const turn = str(v, 'turnKind')
  if (turn) e.cat('turnKind', turn.split(/[\s(]/)[0], h.turnKind, { note: `truth "${turn}"` })
  e.cat('winders', num(v, 'winders'), h.winderRegions.length, { note: 'winderRegions.length' })
  e.num('widthM', num(v, 'widthM'), h.widthM, 'plan')
  const shaft = asDict(v['shaft'])
  e.pairs('shaft.x', pair(shaft, 'x'), [h.shaft.x0, h.shaft.x1], 'plan')
  e.pairs('shaft.z', pair(shaft, 'z'), [h.shaft.z0, h.shaft.z1], 'plan')
  const start = asDict(v['start'])
  e.num('start.x', num(start, 'x'), h.start.x, 'plan')
  const startZ = pair(start, 'z')
  if (startZ) e.num('start.z (band start)', startZ[0], h.start.z, 'plan', { note: 'truth gives the start band z; auto start.z' })
  const from = c.level(st.fromLevel)
  const to = c.level(st.toLevel)
  const rise = from && to ? to.elevation - from.elevation : undefined
  e.num('totalRiseM', num(v, 'totalRiseM'), rise, 'general', { note: 'levels[toLevel].elevation − levels[fromLevel].elevation' })
  e.num('riserM', num(v, 'riserM'), rise !== undefined && h.risersTotal ? rise / h.risersTotal : undefined, 'general', { note: 'derived: rise / risersTotal' })
  tFlights.forEach((f, i) => {
    const a = h.flights[i]
    const p = `flight${i + 1}`
    e.cat(`${p}.direction`, f['direction'], a?.direction)
    e.cat(`${p}.risers`, f['risers'], a?.risers)
    e.num(`${p}.goingM`, num(f, 'goingM'), a?.goingM, 'general', { note: 'a tread going is too small for the 0.10 plan rule; general rule used' })
    const lines = (f['riserLinesX'] ?? f['riserLinesZ']) as unknown
    if (Array.isArray(lines) && lines.length >= 2 && isNum(lines[0]) && isNum(lines[lines.length - 1])) {
      e.num(`${p}.firstRiserAt`, lines[0], a?.from, 'plan', { note: 'auto flight.from' })
      e.num(`${p}.lastRiserAt`, lines[lines.length - 1] as number, a?.to, 'plan', { note: 'auto flight.to' })
      e.cat(`${p}.riserLineCount`, lines.length, a?.riserLines.length)
    }
    const band = asDict(f['band'])
    const bz = pair(band, 'z') ?? pair(band, 'x')
    if (bz && a) e.pairs(`${p}.band`, bz, [a.band.from, a.band.to], 'plan')
  })
  const riserM = rise !== undefined && h.risersTotal ? rise / h.risersTotal : undefined
  tLandings.forEach((l, i) => {
    const a = h.landings[i]
    const p = `landing${i + 1}`
    const turn = str(l, 'turn')
    if (turn) e.cat(`${p}.turn`, turn.split(/[\s(]/)[0], a?.turn, { note: `truth "${turn}"` })
    e.pairs(`${p}.x`, pair(l, 'x'), a ? [a.x0, a.x1] : undefined, 'plan')
    e.pairs(`${p}.z`, pair(l, 'z'), a ? [a.z0, a.z1] : undefined, 'plan')
    // a landing sits after flights 0..i: its level is the risers climbed so far times the riser
    const climbed = h.flights.slice(0, i + 1).reduce((s, f) => s + f.risers, 0)
    const levelY = riserM !== undefined && from && a ? from.elevation + climbed * riserM : undefined
    e.num(`${p}.levelY`, num(l, 'levelY'), levelY, 'general', { note: `derived: ${climbed} risers climbed × rise/risersTotal (StairLandingHypothesis carries no level)`, missingNote: 'StairLandingHypothesis has no level and the building has no landing to derive one for' })
  })
  const well = asDict(v['well'])
  if (pair(well, 'x')) e.missing('well', v['well'], `StairTopologyHypothesis has no well; the slabHole ${fmt([st.slabHole.x0, st.slabHole.x1])} × ${fmt([st.slabHole.z0, st.slabHole.z1])} is the floor opening, a different thing`)
  e.notes.push(`auto: ${h.why}`)
  if (h.unresolved.length) e.notes.push(`auto unresolved: ${h.unresolved.join('; ')}`)
}

function nearestRect<T extends { x0: number; x1: number; z0: number; z1: number }>(items: readonly T[], x: [number, number] | undefined, z: [number, number] | undefined): T | undefined {
  if (!x || !z) return items[0]
  const cx = mid(x[0], x[1])
  const cz = mid(z[0], z[1])
  return [...items].sort((a, b) => Math.hypot(mid(a.x0, a.x1) - cx, mid(a.z0, a.z1) - cz) - Math.hypot(mid(b.x0, b.x1) - cx, mid(b.z0, b.z1) - cz))[0]
}

function evalBalcony(e: Eval, v: Dict, c: Ctx): void {
  const x = pair(v, 'x')
  const z = pair(v, 'z')
  const pool = c.b.balconies.filter((b) => b.kind === 'BALCONY')
  const best = nearestRect(pool.length ? pool : c.b.balconies, x, z)
  if (!best) {
    e.notes.push('no balconies in the building')
    return
  }
  e.match(best.id, best.featureId)
  c.use(best.id, e.t.id)
  e.pairs('x', x, [best.x0, best.x1], 'plan')
  e.pairs('z', z, [best.z0, best.z1], 'plan')
  e.num('topY', num(v, 'topY'), best.topY, 'general')
  e.num('fasciaTopY', num(v, 'fasciaTopY'), best.fascia?.y[1], 'general', { note: 'balcony.fascia.y[1]', missingNote: 'BalconyV2.fascia absent' })
  e.num('fasciaSoffitY', num(v, 'fasciaSoffitY'), best.fascia?.y[0], 'general', { note: 'balcony.fascia.y[0]', missingNote: 'BalconyV2.fascia absent' })
  e.num('fasciaThicknessM', num(v, 'fasciaThicknessM'), best.thicknessM, 'general', { note: 'balcony.thicknessM (the band)' })
}

function evalPortal(e: Eval, v: Dict, c: Ctx): void {
  const x = pair(v, 'x')
  const z = pair(v, 'z')
  const best = nearestRect(c.b.portalHeads, x, z)
  if (!best) {
    e.notes.push('no portalHeads in the building')
    return
  }
  e.match(best.id, best.featureId)
  c.use(best.id, e.t.id)
  e.pairs('x', x, [best.x0, best.x1], 'plan')
  e.pairs('z', z, [best.z0, best.z1], 'plan')
  e.num('fasciaTopY', num(v, 'fasciaTopY'), best.y1, 'general', { note: 'portalHead.y1' })
  e.num('fasciaSoffitY', num(v, 'fasciaSoffitY'), best.y0, 'general', { note: 'portalHead.y0' })
  if (v['soffitFinish'] !== undefined) e.notes.push(`truth soffit finish "${fmt(v['soffitFinish'])}" is visual; PortalHeadV2 carries no finish`)
}

function evalFacadeMember(e: Eval, v: Dict, c: Ctx): void {
  const x = pair(v, 'x')
  const y = pair(v, 'y')
  const portal = nearestRect(c.b.portalHeads, x, pair(v, 'z') ?? [0, 1])
  const balcony = c.b.balconies.filter((b) => b.kind === 'BALCONY' && b.fascia && b.z0 <= 1).sort((a, b) => a.x0 - b.x0)[0]
  if (!portal && !balcony) {
    e.notes.push('neither a portal head nor a front balcony fascia in the building')
    return
  }
  e.match(portal?.id ?? balcony?.id, portal?.featureId ?? balcony?.featureId)
  c.use(portal?.id, e.t.id)
  c.use(balcony?.id, e.t.id)
  const xs = [portal?.x0, portal?.x1, balcony?.x0, balcony?.x1].filter(isNum)
  e.pairs('x', x, xs.length ? [Math.min(...xs), Math.max(...xs)] : undefined, 'plan', { note: 'derived: balcony fascia ∪ portal head on x' })
  const ys = [portal?.y0, portal?.y1, balcony?.fascia?.y[0], balcony?.fascia?.y[1]].filter(isNum)
  e.pairs('y', y, ys.length ? [Math.min(...ys), Math.max(...ys)] : undefined, 'general', { note: 'derived: balcony fascia ∪ portal head on y' })
  const planes = numbersIn(str(v, 'plane'), /z\s*=\s*(-?[\d.]+)/g)
  if (planes.length) e.num('plane.z', planes[0], portal?.z0 ?? balcony?.z0, 'plan')
  const continuous = c.b.assemblies.some((a) => a.kind === 'PORTAL_FRAME' && a.continuityRelations.some((r) => r.kind === 'CONTINUES_AS' && ((r.from === balcony?.featureId && r.to === portal?.featureId) || (r.to === balcony?.featureId && r.from === portal?.featureId))))
  e.cat('continuousFasciaAndHead', true, continuous, { note: 'assemblies[PORTAL_FRAME] CONTINUES_AS balcony ↔ portal head' })
  if (v['kind'] !== undefined) e.notes.push(`truth kind "${fmt(v['kind'])}"; auto members: ${[balcony?.fascia?.kind, portal ? 'PORTAL_HEAD' : undefined].filter(Boolean).join(' + ')}`)
}

function evalRailing(e: Eval, v: Dict, c: Ctx): void {
  const x = pair(v, 'x')
  const z = num(v, 'z')
  const cx = x ? mid(x[0], x[1]) : 0
  const best = [...c.b.railings].sort((a, b) => Math.hypot(mid(a.start.x, a.end.x) - cx, mid(a.start.z, a.end.z) - (z ?? 0)) - Math.hypot(mid(b.start.x, b.end.x) - cx, mid(b.start.z, b.end.z) - (z ?? 0)))[0]
  if (!best) {
    e.notes.push('no railings in the building')
    return
  }
  e.match(best.id, best.featureId)
  c.use(best.id, e.t.id)
  const ax: [number, number] = [Math.min(best.start.x, best.end.x), Math.max(best.start.x, best.end.x)]
  e.pairs('x', x, ax, 'plan')
  e.num('z', z, mid(best.start.z, best.end.z), 'plan')
  e.num('baseY', num(v, 'baseY'), best.baseY, 'general')
  e.num('topY', num(v, 'topY'), best.baseY + best.heightM, 'general', { note: 'baseY + heightM' })
  e.num('heightM', num(v, 'heightM'), best.heightM, 'general')
  if (v['infill'] !== undefined) {
    const mr = c.model.railings.find((r) => r.id === best.id)
    e.cat('infill', v['infill'], mr?.infill, { note: 'RailingV2 has no infill; taken from model.railings[].infill', missingNote: 'RailingV2 has no infill and the model railing carries none' })
  }
}

function evalFacadeAssembly(e: Eval, v: Dict, c: Ctx): void {
  const kind = str(v, 'kind')
  const planes = numbersIn(str(v, 'plane'), /z\s*=\s*(-?[\d.]+)/g)
  const side: 'FRONT' | 'REAR' | undefined = planes.length ? (planes[0]! > 5 ? 'REAR' : 'FRONT') : /rear/i.test(e.t.name) ? 'REAR' : /front/i.test(e.t.name) ? 'FRONT' : undefined
  if (kind === 'GABLE_FRAME') {
    const a = c.b.assemblies.find((s) => s.kind === 'GABLE_FRAME' && (!side || s.facadeId === side))
    if (!a) {
      e.notes.push(`no GABLE_FRAME assembly for ${side ?? 'either side'}`)
      return
    }
    e.match(a.id, `feat-${a.id}`)
    c.use(a.id, e.t.id)
    e.cat('kind', kind, a.kind)
    const members = Array.isArray(v['members']) ? (v['members'] as unknown[]) : []
    e.cat('memberCount', members.length, a.memberHypothesisIds.length, { note: `truth counts a full-height return once and the verge per rake; auto lists ${a.memberHypothesisIds.join(', ')}` })
    const cont = Array.isArray(v['continuity']) ? (v['continuity'] as unknown[]) : undefined
    if (cont) e.cat('continuityCount', cont.length, a.continuityRelations.length, { note: `auto: ${a.continuityRelations.map((r) => `${r.from} ${r.kind} ${r.to}`).join('; ')}` })
    const verge = c.b.verges.find((g) => g.side === side)
    if (planes.length) e.num('plane.z', planes[0], verge?.planeAt, 'plan', { note: 'verge.planeAt' })
    return
  }
  if (kind === 'PORTAL_FRAME') {
    const a = c.b.assemblies.find((s) => s.kind === 'PORTAL_FRAME')
    if (!a) {
      e.notes.push('no PORTAL_FRAME assembly in the building')
      return
    }
    e.match(a.id, `feat-${a.id}`)
    c.use(a.id, e.t.id)
    e.cat('kind', kind, a.kind)
    const mouth = asDict(v['mouth'])
    const rec = c.b.recesses.find((r) => r.side === 'FRONT' && r.storeyIndex === 0)
    const open: [number, number] | undefined = rec && rec.open.length ? [Math.min(...rec.open.map((o) => o.from)), Math.max(...rec.open.map((o) => o.to))] : undefined
    e.pairs('mouth.x', pair(mouth, 'x'), open, 'plan', { note: 'recess-front (storey 0) open interval' })
    const head = c.b.portalHeads[0]
    e.pairs('mouth.y', pair(mouth, 'y'), head ? [c.level(0)?.elevation ?? 0, head.y0] : undefined, 'general', { note: '[levels[0].elevation, portalHead.y0]' })
    e.num('depthM', num(v, 'depthM'), rec?.depthM, 'plan', { note: 'recess.depthM' })
    e.cat('memberCount', 2 + (Array.isArray(v['jambs']) ? (v['jambs'] as unknown[]).length : 0), a.memberHypothesisIds.length, { note: `truth: head + fascia + jambs; auto lists ${a.memberHypothesisIds.join(', ')}` })
    return
  }
  if (kind === 'FASCIA') {
    const ar = c.b.attachedRoofs[0]
    const a = c.b.assemblies.find((s) => s.kind === 'FASCIA')
    e.match(a?.id ?? (ar ? `roof-${ar.massId}` : null), a ? `feat-${a.id}` : ar?.featureId)
    c.use(a?.id, e.t.id)
    e.cat('kind', kind, a?.kind, { missingNote: 'no FASCIA assembly in BuildingV2.assemblies; the garage parapet lives in attachedRoofs[0].parapetTopY' })
    e.num('parapetTopY', num(v, 'parapetTopY'), ar?.parapetTopY, 'general', { note: 'attachedRoofs[0].parapetTopY' })
    e.num('slabTopY', num(v, 'slabTopY'), ar?.slabTopY, 'general', { note: 'attachedRoofs[0].slabTopY' })
    if (v['finish'] !== undefined) e.notes.push(`truth finish "${fmt(v['finish'])}" is visual`)
    return
  }
  e.notes.push(`assembly kind ${kind ?? '?'} not understood`)
}

function evalPageSpec(e: Eval, v: Dict, c: Ctx): void {
  const mr = c.b.mainRoof
  if (str(v, 'kind') && mr) {
    e.match('main-roof', mr.featureId)
    e.cat('kind', v['kind'], mr.kind)
    e.num('pitchDeg', num(v, 'pitchDeg'), mr.pitchDeg, 'angle')
    if (v['rooflights'] !== undefined) e.notes.push(`page names ${fmt(v['rooflights'])} rooflights; auto has ${c.b.rooflights.length}`)
    return
  }
  if (num(v, 'm') !== undefined && /knee/i.test(e.t.name)) {
    const l1 = c.level(1)
    e.match(l1?.id, l1?.featureId)
    e.num('m', num(v, 'm'), l1 ? l1.wallTop - l1.elevation : undefined, 'general', { note: 'levels[1].wallTop − levels[1].elevation (the auto has no separate knee-wall top; wallTop is the eave datum)' })
    return
  }
  if (v['eavesOverhang'] !== undefined && mr) {
    const main = c.mainMass()
    e.match('main-roof', mr.featureId)
    const over = main ? Math.max(main.x0 - mr.footprint.x0, mr.footprint.x1 - main.x1) : undefined
    e.cat('sideEavesOverhang', 'NONE', over === undefined ? undefined : over <= 0.05 ? 'NONE' : `PRESENT (${r3(over)} m)`, { note: 'derived: mainRoof.footprint beyond masses[MAIN] on x' })
    return
  }
  e.scope = 'NOT_A_FEATURE'
  e.notes.push('publisher text with no building counterpart')
}

function autoSays(t: TruthItem, c: Ctx): string {
  const b = c.b
  const id = t.id
  const rl = b.rooflights[0]
  const bf = b.balconies.find((x) => x.kind === 'BALCONY' && x.z0 <= 1)
  const ar = b.attachedRoofs[0]
  const pantry = c.rooms(0).find((m) => m.areaM2 < 3)
  if (id.includes('140-220')) return `no feature at x 1.40 / 2.47 on the rear outer plane; the rear railing runs ${fmt(b.railings.find((r) => r.start.z > 10)?.start.x)}..${fmt(b.railings.find((r) => r.start.z > 10)?.end.x)}`
  if (id.includes('ENTRANCE')) {
    const o = b.openings.find((x) => x.family === 'DOOR' && x.facade === 'FRONT')
    return o ? `a single ${r3(o.widthM)} m ${o.family} at ${fmt(o.interval)} with no leaf/sidelight split (mullions ${fmt(o.mullions)})` : 'no front DOOR read'
  }
  if (id.includes('FASCIA-SECTION')) return bf ? `a slab band ${r3(bf.thicknessM)} m thick, fascia y ${fmt(bf.fascia?.y)} (${bf.fascia?.evidence ?? 'no fascia'})` : 'no front balcony'
  if (id.includes('VERGE-DEPTH')) return b.verges.length ? `verge depthM ${b.verges.map((g) => r3(g.depthM)).join(' / ')} (assumed)` : 'no verges'
  if (id.includes('EAVE-DATUM')) return `mainRoof.eaveY ${fmt(b.mainRoof?.eaveY)} (derived plane), levels[1].wallTop ${fmt(c.level(1)?.wallTop)} (printed datum)`
  if (id.includes('GARAGE-ROOF')) return ar ? `a level slab top at ${r3(ar.slabTopY)} with the parapet at ${fmt(ar.parapetTopY)}` : 'no attached roof'
  if (id.includes('ROOFLIGHT')) return rl ? `${rl.id} at ${r3(rl.slopeFrom)}..${r3(rl.slopeTo)} from the eave, y ${r3(rl.yFrom)}..${r3(rl.yTo)}` : 'no rooflight'
  if (id.includes('RAILING')) return b.railings.length ? `railing heights ${b.railings.map((r) => r3(r.heightM)).join(' / ')} m on a base at ${b.railings.map((r) => r3(r.baseY)).join(' / ')}` : 'no railings'
  if (id.includes('PANTRY')) return pantry ? `${pantry.id} ${r3(pantry.areaM2)} m² bounded x ${r3(pantry.bounds.x0)}..${r3(pantry.bounds.x1)}, z ${r3(pantry.bounds.z0)}..${r3(pantry.bounds.z1)}` : 'no small ground room'
  if (id.includes('CORRIDOR')) {
    const w = c.walls(1).filter((x) => x.axis === 'X' && Math.abs(x.at - 4.7) < 0.2)
    return w.length ? `corridor south wall pieces ${w.map((x) => `${r3(x.from)}..${r3(x.to)}`).join(', ')} (no gap read at x 6.02..6.31)` : 'no corridor south wall'
  }
  if (id.includes('ATTIC-NET')) return `auto room areas are gross polygons (${c.rooms(1).map((m) => r3(m.areaM2)).join(', ')} m²)`
  if (id.includes('CHIMNEY')) return b.chimneys.map((ch) => `${ch.id} ${r3(ch.x1 - ch.x0)} × ${r3(ch.z1 - ch.z0)} m`).join('; ') || 'no chimneys'
  return 'no auto counterpart'
}

function evaluateItem(t: TruthItem, c: Ctx): Item {
  const e = new Eval(t)
  const v = asDict(t.value)
  switch (t.kind) {
    case 'FRAME':
      evalFrame(e, v, c)
      break
    case 'LEVEL':
      evalLevel(e, v, c)
      break
    case 'MASS':
      evalMass(e, v, c)
      break
    case 'RECESS':
      evalRecess(e, v, c)
      break
    case 'RETURN':
      evalReturn(e, v, c)
      break
    case 'ROOF':
      evalRoof(e, v, c)
      break
    case 'ROOF_MEMBER':
      evalRoofMember(e, v, c)
      break
    case 'CHIMNEY':
      evalChimney(e, v, c)
      break
    case 'ROOFLIGHT':
      evalRooflight(e, v, c)
      break
    case 'OPENING':
      evalOpening(e, v, c)
      break
    case 'INTERIOR_WALL':
      evalInteriorWall(e, v, c)
      break
    case 'ROOM':
      evalRoom(e, v, c)
      break
    case 'STAIR':
      evalStair(e, v, c)
      break
    case 'BALCONY':
      evalBalcony(e, v, c)
      break
    case 'PORTAL':
      evalPortal(e, v, c)
      break
    case 'FACADE_MEMBER':
      evalFacadeMember(e, v, c)
      break
    case 'RAILING':
      evalRailing(e, v, c)
      break
    case 'FACADE_ASSEMBLY':
      evalFacadeAssembly(e, v, c)
      break
    case 'PAGE_SPEC':
      evalPageSpec(e, v, c)
      break
    case 'UNRESOLVED':
      e.scope = 'UNRESOLVED'
      e.notes.push(`truth unresolved; auto says: ${autoSays(t, c)}`)
      if (v['handling'] !== undefined && v['handling'] !== '') e.notes.push(`truth handling: ${fmt(v['handling'])}`)
      break
    case 'REGISTRATION': {
      e.scope = 'NOT_A_FEATURE'
      const asset = t.sourceAssetIds?.[0]
      const reg = asset ? c.registrationsByAsset.get(asset) : undefined
      e.notes.push(reg ? `pixel→metre map, not a feature; the auto registered this asset as ${reg.side}${reg.mpp ? ` at ${r3(reg.mpp)} m/px` : ''}` : 'pixel→metre map, not a feature')
      break
    }
    case 'PAGE_FACT':
      e.scope = 'NOT_A_FEATURE'
      e.notes.push(`published aggregate ${fmt(v['value'])} ${fmt(v['unit'])}: a page fact, no geometry to compare`)
      break
    case 'PAGE_ROOM_TABLE': {
      e.scope = 'NOT_A_FEATURE'
      const rooms = c.rooms()
      e.notes.push(`page table, not a feature; the auto labelled ${rooms.filter((m) => m.label).length} of its ${rooms.length} rooms (${rooms.filter((m) => m.label).map((m) => `${m.id}=${m.number ?? ''} ${m.label}`).join(', ') || 'none'})`)
      break
    }
    case 'SHADOW':
      e.scope = 'NOT_A_FEATURE'
      e.notes.push('shading, not geometry; the auto has no feature for it, which is correct')
      break
    case 'MATERIAL_REGION':
      e.scope = 'NOT_A_FEATURE'
      e.notes.push(`finish region without geometry; the auto has ${c.b.surfaceRegions.length} surfaceRegions (${c.b.surfaceRegions.map((s) => `${s.id} ${s.wallRef.side} s${s.wallRef.storeyIndex} ${s.tone}`).join(', ') || 'none'})`)
      break
    default:
      e.scope = 'NOT_A_FEATURE'
      e.notes.push(`kind ${t.kind} has no evaluator`)
  }
  return e.finish(c)
}

// ---------------------------------------------------------------------------------------------------------
// EXTRA auto features (matched by no truth item)
// ---------------------------------------------------------------------------------------------------------

function extras(c: Ctx): Extra[] {
  const out: Extra[] = []
  const b = c.b
  const add = (family: string, id: string, featureId: string | null | undefined, summary: string): void => {
    if (c.used.has(id) || (featureId && c.used.has(featureId))) return
    const q = c.qualityOf(id, featureId)
    out.push({ family, id, featureId: featureId ?? q?.featureId ?? null, quality: q?.level ?? null, summary })
  }
  for (const l of b.levels) add('LEVEL', l.id, l.featureId, `index ${l.index} at ${r3(l.elevation)}, height ${r3(l.height)}`)
  for (const m of b.masses) add('MASS', m.id, m.featureId, `${m.role} x ${r3(m.x0)}..${r3(m.x1)}, z ${r3(m.z0)}..${r3(m.z1)}, storeys ${fmt(m.storeys)}`)
  if (b.mainRoof) add('ROOF', 'main-roof', b.mainRoof.featureId, `${b.mainRoof.kind} ${b.mainRoof.pitchDeg}° ridge ${b.mainRoof.ridgeAxis} at ${r3(b.mainRoof.ridgeAt)}`)
  for (const r of b.attachedRoofs) add('ATTACHED_ROOF', `roof-${r.massId}`, r.featureId, `slab top ${r3(r.slabTopY)}, parapet ${fmt(r.parapetTopY)}`)
  for (const r of b.recesses) add('RECESS', r.id, `feat-${r.id}`, `${r.side} storey ${r.storeyIndex}, open ${r.open.map((o) => `${r3(o.from)}..${r3(o.to)}`).join(', ')}`)
  for (const r of b.returns) add('RETURN_WALL', r.id, r.featureId, `${r.side} storey ${r.storeyIndex} at x ${r3(r.start.x)}, ${r3(r.thicknessM)} m`)
  for (const x of b.balconies) add('BALCONY', x.id, x.featureId, `${x.kind} storey ${x.storeyIndex} x ${r3(x.x0)}..${r3(x.x1)}, z ${r3(x.z0)}..${r3(x.z1)}, top ${r3(x.topY)} (${x.provenance})`)
  for (const x of b.railings) add('RAILING', x.id, x.featureId, `storey ${x.storeyIndex} x ${r3(x.start.x)}..${r3(x.end.x)}, ${r3(x.heightM)} m`)
  for (const x of b.portalHeads) add('PORTAL_HEAD', x.id, x.featureId, `x ${r3(x.x0)}..${r3(x.x1)}, y ${r3(x.y0)}..${r3(x.y1)}`)
  for (const x of b.verges) add('ROOF_MEMBER', x.id, x.featureId, `${x.side} verge at z ${r3(x.planeAt)}, width ${fmt(x.member.widthM)}`)
  for (const x of b.chimneys) add('CHIMNEY', x.id, x.featureId, `x ${r3(x.x0)}..${r3(x.x1)}, z ${r3(x.z0)}..${r3(x.z1)}, top ${fmt(x.topY)}`)
  for (const x of b.rooflights) add('ROOFLIGHT', x.id, x.featureId, `${c.rooflightSlope(x)} slope, along ${r3(x.alongFrom)}..${r3(x.alongTo)}, ${r3(x.widthM)} × ${r3(x.lengthM)}`)
  for (const o of c.allOpenings()) add('OPENING', o.id, `feat-${o.id}`, `${o.facade} storey ${o.storeyIndex} ${o.family} ${fmt(o.interval)} sill ${r3(o.sillY)} head ${r3(o.headY)}`)
  for (const r of b.interior) {
    for (const w of r.walls) add('INTERIOR_WALL', w.id, `feat-${w.id}`, `storey ${w.storeyIndex} ${w.axis} at ${r3(w.at)}, ${r3(w.from)}..${r3(w.to)}, ${r3(w.thicknessM)} m (conf ${w.confidence})`)
    for (const d of r.doors) add('INTERIOR_DOOR', d.id, `feat-${d.id}`, `storey ${d.storeyIndex} ${d.wallAxis} at ${r3(d.at)}, ${r3(d.from)}..${r3(d.to)}`)
    for (const m of r.rooms) add('ROOM', m.id, `feat-${m.id}`, `storey ${m.storeyIndex} ${r3(m.areaM2)} m² x ${r3(m.bounds.x0)}..${r3(m.bounds.x1)}, z ${r3(m.bounds.z0)}..${r3(m.bounds.z1)}${m.label ? ` "${m.number ?? ''} ${m.label}"` : ''}${m.openPlan ? ' openPlan' : ''}`)
    for (const k of r.blocks) add('BLOCK', k.id, `feat-${k.id}`, `storey ${k.storeyIndex} x ${r3(k.x0)}..${r3(k.x1)}, z ${r3(k.z0)}..${r3(k.z1)}`)
  }
  if (b.stair) add('STAIR', b.stair.hypothesis.id, b.stair.featureId, `${b.stair.hypothesis.turnKind} ${b.stair.hypothesis.risersTotal} risers`)
  for (const a of b.assemblies) add('FACADE_ASSEMBLY', a.id, `feat-${a.id}`, `${a.kind} on ${a.facadeId}, ${a.memberHypothesisIds.length} members`)
  for (const s of b.surfaceRegions) add('SURFACE_REGION', s.id, s.featureId, `${s.wallRef.side} storey ${s.wallRef.storeyIndex} ${s.tone} along ${fmt(s.along)}, y ${fmt(s.y)}`)
  return out
}

// ---------------------------------------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------------------------------------

const esc = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')

function markdown(report: Report): string {
  const L: string[] = []
  L.push(`# Marcówki analyzer-v2 evaluation against source truth v2`)
  L.push('')
  L.push(`Building \`${report.inputs.building}\` (${report.building.label}) against \`${report.inputs.truth}\` (sealed ${report.truth.sealed}, ${report.truth.itemCount} items). No aggregate score: per-family counts and the worst deltas only.`)
  L.push('')
  L.push(`## Frame`)
  L.push('')
  L.push(`Truth: ${report.frame.truth.z}`)
  L.push('')
  L.push(`Building: front recess mouth z = ${fmt(report.frame.building.frontOuterPlaneZ)}, main mass z ${fmt(report.frame.building.mainZ0)}..${fmt(report.frame.building.mainZ1)}, rear recess mouth z = ${fmt(report.frame.building.rearOuterPlaneZ)}, x ${fmt(report.frame.building.x0)}..${fmt(report.frame.building.x1)} → **${report.frame.agrees ? 'same frame, no conversion applied' : 'FRAME DIFFERS — see notes'}**.`)
  L.push('')
  L.push(`## Tolerance rules`)
  L.push('')
  for (const [k, txt] of Object.entries(report.toleranceRules)) L.push(`- \`${k}\`: ${txt}`)
  L.push('')
  L.push(`## Per-family summary`)
  L.push('')
  L.push(`| family | truth items | MATCH | PARTIAL | MISSING | unresolved | not a feature |`)
  L.push(`|---|---:|---:|---:|---:|---:|---:|`)
  for (const [fam, s] of Object.entries(report.summary.perFamily)) L.push(`| ${fam} | ${s.truthItems} | ${s.MATCH} | ${s.PARTIAL} | ${s.MISSING} | ${s.unresolved} | ${s.notEvaluated} |`)
  L.push('')
  L.push(`## Worst deltas (numeric properties OUTSIDE tolerance, by |Δ|)`)
  L.push('')
  L.push(`| truth item | property | truth | auto | Δ | tol | unit |`)
  L.push(`|---|---|---:|---:|---:|---:|---|`)
  for (const w of report.summary.worstDeltas.slice(0, 20)) L.push(`| ${w.truthId} — ${esc(w.name)} | ${w.property} | ${fmt(w.truth)} | ${fmt(w.auto)} | ${fmt(w.delta)} | ${fmt(w.tolerance)} | ${w.unit} |`)
  L.push('')
  L.push(`## Worst deltas in metres (positions and heights only; areas excluded)`)
  L.push('')
  L.push(`| truth item | property | truth | auto | Δ m | tol m |`)
  L.push(`|---|---|---:|---:|---:|---:|`)
  for (const w of report.summary.worstDeltasM.slice(0, 20)) L.push(`| ${w.truthId} — ${esc(w.name)} | ${w.property} | ${fmt(w.truth)} | ${fmt(w.auto)} | ${fmt(w.delta)} | ${fmt(w.tolerance)} |`)
  L.push('')
  const families = [...new Set(report.items.map((i) => i.kind))]
  for (const fam of families) {
    const items = report.items.filter((i) => i.kind === fam)
    L.push(`## ${fam}`)
    L.push('')
    const withProps = items.filter((i) => i.properties.length)
    if (withProps.length) {
      L.push(`| truth | matched | property | truth value | auto value | Δ | tol | verdict |`)
      L.push(`|---|---|---|---:|---:|---:|---:|---|`)
      for (const it of withProps) {
        it.properties.forEach((p, idx) => {
          const head = idx === 0 ? `**${it.truthId}** ${esc(it.name)} → **${it.verdict ?? '—'}**` : ''
          const matched = idx === 0 ? `${it.matchedFeature ?? '—'}${it.autoQuality ? ` (${it.autoQuality})` : ''}` : ''
          L.push(`| ${head} | ${matched} | ${p.name}${p.note ? ` — ${esc(p.note)}` : ''} | ${fmt(p.truth)} | ${fmt(p.auto)} | ${fmt(p.delta)} | ${fmt(p.tolerance)} | ${p.verdict} |`)
        })
      }
      L.push('')
    }
    const noProps = items.filter((i) => !i.properties.length)
    for (const it of noProps) L.push(`- **${it.truthId}** ${esc(it.name)} → ${it.verdict ?? (it.scope === 'UNRESOLVED' ? 'no verdict (truth unresolved)' : 'not evaluated')}${it.matchedFeature ? ` (${it.matchedFeature})` : ''}: ${it.notes.map(esc).join(' · ')}`)
    const noted = withProps.filter((i) => i.notes.length)
    if (noted.length) {
      L.push('')
      for (const it of noted) L.push(`- ${it.truthId}: ${it.notes.map(esc).join(' · ')}`)
    }
    L.push('')
  }
  L.push(`## MISSING truth items (no auto feature matched)`)
  L.push('')
  const missing = report.items.filter((i) => i.verdict === 'MISSING')
  if (!missing.length) L.push('none')
  for (const it of missing) L.push(`- **${it.truthId}** (${it.kind}) ${esc(it.name)}: ${[...it.notes, ...it.properties.filter((p) => p.verdict === 'MISSING' && p.note).map((p) => `${p.name}: ${p.note}`)].map(esc).join(' · ') || 'no note'}`)
  L.push('')
  L.push(`## MISSING properties on matched items (the building lacks a field the truth has)`)
  L.push('')
  const missingProps = report.items.flatMap((i) => i.properties.filter((p) => p.verdict === 'MISSING').map((p) => ({ it: i, p })))
  if (!missingProps.length) L.push('none')
  for (const { it, p } of missingProps) L.push(`- ${it.truthId} \`${p.name}\` = ${fmt(p.truth)}: ${esc(p.note ?? '')}`)
  L.push('')
  L.push(`## EXTRA auto features (matched by no truth item; ignored in the verdicts)`)
  L.push('')
  const byFam = new Map<string, Extra[]>()
  for (const x of report.extras) byFam.set(x.family, [...(byFam.get(x.family) ?? []), x])
  if (!report.extras.length) L.push('none')
  for (const [fam, list] of byFam) {
    L.push(`- **${fam}** (${list.length})`)
    for (const x of list) L.push(`  - ${x.id}${x.quality ? ` (${x.quality})` : ''}: ${esc(x.summary)}`)
  }
  L.push('')
  L.push(`## Truth items left unresolved (no verdict)`)
  L.push('')
  for (const it of report.items.filter((i) => i.scope === 'UNRESOLVED')) L.push(`- **${it.truthId}** ${esc(it.name)}: ${it.notes.map(esc).join(' · ')}`)
  L.push('')
  return L.join('\n')
}

// ---------------------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------------------

type FamilySummary = { truthItems: number; MATCH: number; PARTIAL: number; MISSING: number; unresolved: number; notEvaluated: number }
type Report = {
  schema: string
  schemaVersion: string
  inputs: Record<string, string>
  building: { label: string; wallThicknessM: number; slabThicknessM: number; counts: Record<string, number> }
  truth: { schema: string; sealed: string; sourcePackageId: string; itemCount: number }
  sidecars: { featureQualityHash: string | null; featureLineageHash: string | null; residualCandidateHash: string | null }
  frame: { truth: Record<string, string>; building: Record<string, number | null>; agrees: boolean; notes: string[] }
  toleranceRules: Record<Rule, string>
  summary: { perFamily: Record<string, FamilySummary>; worstDeltas: WorstDelta[]; worstDeltasM: WorstDelta[]; extrasPerFamily: Record<string, number> }
  items: Item[]
  extras: Extra[]
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const cwd = process.cwd()
  const art = join('stage-reports', 'artifacts', 'analyzer-v2')
  const inputs = {
    building: argValue(argv, 'building') ?? join(art, 'marcowki-building.json'),
    model: argValue(argv, 'model') ?? join(art, 'marcowki-model.json'),
    quality: argValue(argv, 'quality') ?? join(art, 'feature-quality.json'),
    lineage: argValue(argv, 'lineage') ?? join(art, 'feature-lineage.json'),
    residuals: argValue(argv, 'residuals') ?? join(art, 'source-view-residuals.json'),
    registrations: argValue(argv, 'registrations') ?? join(art, 'registrations.json'),
    truth: argValue(argv, 'truth') ?? join('research', 'marcowki-v2', 'marcowki-source-truth-v2.json'),
  }
  const outDir = argValue(argv, 'out') ?? art
  const slug = argValue(argv, 'slug') ?? 'marcowki'

  const building = await readJson<BuildingV2>(join(cwd, inputs.building))
  const truth = await readJson<TruthFile>(join(cwd, inputs.truth))
  const model = existsSync(join(cwd, inputs.model)) ? await readJson<ModelLite>(join(cwd, inputs.model)) : { roofs: [], railings: [], walls: [], levels: [] }
  const quality = existsSync(join(cwd, inputs.quality)) ? await readJson<QualityFile>(join(cwd, inputs.quality)) : { records: [], contentHash: '' }
  const lineage = existsSync(join(cwd, inputs.lineage)) ? await readJson<LineageFile>(join(cwd, inputs.lineage)) : { contentHash: '', solved: [], relations: [] }
  const residuals = existsSync(join(cwd, inputs.residuals)) ? await readJson<ResidualFile>(join(cwd, inputs.residuals)) : { candidateHash: '', residuals: [] }
  const registrations = existsSync(join(cwd, inputs.registrations)) ? await readJson<Registrations>(join(cwd, inputs.registrations)) : {}

  // Print the frame-bearing features before assuming anything about the frame.
  process.stdout.write(`building: ${building.label}\n`)
  process.stdout.write(`masses:\n${building.masses.map((m) => `  ${m.id} ${m.role} x ${r3(m.x0)}..${r3(m.x1)} z ${r3(m.z0)}..${r3(m.z1)} storeys ${fmt(m.storeys)}`).join('\n')}\n`)
  process.stdout.write(`recesses:\n${building.recesses.map((r) => `  ${r.id} ${r.side} storey ${r.storeyIndex} mouth ${r3(r.mouthAt)} back ${r3(r.backAt)} open ${r.open.map((o) => `${r3(o.from)}..${r3(o.to)}`).join(', ')} returns ${r.returns.map((w) => `${r3(w.from)}..${r3(w.to)}`).join(', ')}`).join('\n')}\n`)
  process.stdout.write(`truth: ${truth.items.length} items, sealed ${truth.sealed}; frame z: ${truth.frame['z']}\n`)

  const elevationSides = new Map<string, string>()
  const registrationsByAsset = new Map<string, { side: string; mpp?: number }>()
  for (const el of registrations.elevations ?? []) {
    elevationSides.set(el.frameId, el.side)
    registrationsByAsset.set(el.assetId, { side: el.side, mpp: el.mpp })
  }
  const c = new Ctx(
    building,
    model,
    new Map(quality.records.map((r) => [r.featureId, r])),
    new Map(lineage.solved.map((s) => [s.id, s])),
    lineage.relations ?? [],
    residuals.residuals,
    elevationSides,
    registrationsByAsset,
  )

  const items = truth.items.map((t) => evaluateItem(t, c))

  // Open-plan note: which auto rooms were claimed by several truth rooms.
  const roomClaims = new Map<string, string[]>()
  for (const it of items.filter((i) => i.kind === 'ROOM' && i.matchedFeature)) roomClaims.set(it.matchedFeature!, [...(roomClaims.get(it.matchedFeature!) ?? []), it.truthId])
  for (const it of items.filter((i) => i.kind === 'ROOM' && i.matchedFeature)) {
    const others = (roomClaims.get(it.matchedFeature!) ?? []).filter((id) => id !== it.truthId)
    if (others.length) it.notes.push(`the same auto room is also matched by ${others.join(', ')}`)
  }

  // Frame check from the FRAME item.
  const frameItem = items.find((i) => i.kind === 'FRAME')
  const main = c.mainMass()
  const front = building.recesses.filter((r) => r.side === 'FRONT')
  const rear = building.recesses.filter((r) => r.side === 'REAR')
  const frameBuilding: Record<string, number | null> = {
    x0: building.masses.length ? r3(Math.min(...building.masses.map((m) => m.x0))) : null,
    x1: building.masses.length ? r3(Math.max(...building.masses.map((m) => m.x1))) : null,
    frontOuterPlaneZ: front.length ? r3(Math.min(...front.map((r) => r.mouthAt))) : null,
    mainZ0: main ? r3(main.z0) : null,
    mainZ1: main ? r3(main.z1) : null,
    rearOuterPlaneZ: rear.length ? r3(Math.max(...rear.map((r) => r.mouthAt))) : null,
    groundY: c.level(0)?.elevation ?? null,
  }
  const agrees = !!frameItem && frameItem.properties.length > 0 && frameItem.properties.every((p) => p.verdict === 'WITHIN')
  const frameNotes = agrees ? ['the building and the truth share the frame: x east of the west outer face, y above ±0,00, z north of the front outer plane'] : ['the building frame does NOT reproduce the truth frame; deltas are reported as found, nothing was converted', ...(frameItem?.properties.filter((p) => p.verdict !== 'WITHIN').map((p) => `${p.name}: truth ${fmt(p.truth)} auto ${fmt(p.auto)}`) ?? [])]
  if (!agrees) process.stdout.write(`WARNING: ${frameNotes.join('; ')}\n`)

  const perFamily: Record<string, FamilySummary> = {}
  for (const it of items) {
    const s = (perFamily[it.kind] ??= { truthItems: 0, MATCH: 0, PARTIAL: 0, MISSING: 0, unresolved: 0, notEvaluated: 0 })
    s.truthItems++
    if (it.scope === 'UNRESOLVED') s.unresolved++
    else if (it.scope === 'NOT_A_FEATURE') s.notEvaluated++
    else if (it.verdict) s[it.verdict]++
  }
  const worstDeltas: WorstDelta[] = items
    .flatMap((it) => it.properties.filter((p) => p.verdict === 'OUTSIDE' && isNum(p.delta) && p.rule !== 'exact').map((p) => ({ truthId: it.truthId, kind: it.kind, name: it.name, property: p.name, truth: p.truth, auto: p.auto, delta: p.delta as number, tolerance: p.tolerance, unit: p.unit, ratio: p.tolerance ? r3(Math.abs(p.delta as number) / p.tolerance) : null })))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  // Positions and heights only (metres): the all-units list is dominated by open-plan room areas.
  const worstDeltasM = worstDeltas.filter((w) => w.unit === 'm')
  const extraList = extras(c)
  const extrasPerFamily: Record<string, number> = {}
  for (const x of extraList) extrasPerFamily[x.family] = (extrasPerFamily[x.family] ?? 0) + 1

  const counts: Record<string, number> = {}
  for (const [k, v] of Object.entries(building)) if (Array.isArray(v)) counts[k] = v.length
  counts['interiorWalls'] = c.walls().length
  counts['interiorDoors'] = c.doors().length
  counts['rooms'] = c.rooms().length

  const report: Report = {
    schema: 'buildapp.analyzer-v2.evaluation',
    schemaVersion: '1',
    inputs,
    building: { label: building.label, wallThicknessM: building.wallThicknessM, slabThicknessM: building.slabThicknessM, counts },
    truth: { schema: truth.schema, sealed: truth.sealed, sourcePackageId: truth.sourcePackageId, itemCount: truth.items.length },
    sidecars: { featureQualityHash: quality.contentHash || null, featureLineageHash: lineage.contentHash || null, residualCandidateHash: residuals.candidateHash || null },
    frame: { truth: truth.frame, building: frameBuilding, agrees, notes: frameNotes },
    toleranceRules: RULES,
    summary: { perFamily, worstDeltas, worstDeltasM, extrasPerFamily },
    items,
    extras: extraList,
  }

  await mkdir(join(cwd, outDir), { recursive: true })
  const jsonPath = join(outDir, `${slug}-v2-evaluation.json`)
  const mdPath = join(outDir, `${slug}-v2-evaluation.md`)
  await writeFile(join(cwd, jsonPath), JSON.stringify(report, null, 2) + '\n')
  await writeFile(join(cwd, mdPath), markdown(report))

  process.stdout.write(`\nper family:\n`)
  for (const [fam, s] of Object.entries(perFamily)) process.stdout.write(`  ${fam.padEnd(16)} items ${String(s.truthItems).padStart(2)}  MATCH ${String(s.MATCH).padStart(2)}  PARTIAL ${String(s.PARTIAL).padStart(2)}  MISSING ${String(s.MISSING).padStart(2)}  unresolved ${s.unresolved}  not-a-feature ${s.notEvaluated}\n`)
  process.stdout.write(`\nworst deltas:\n`)
  for (const w of worstDeltas.slice(0, 10)) process.stdout.write(`  ${w.truthId} ${w.property}: truth ${fmt(w.truth)} auto ${fmt(w.auto)} Δ ${fmt(w.delta)} ${w.unit} (tol ${fmt(w.tolerance)})\n`)
  process.stdout.write(`\nworst deltas in metres (areas excluded):\n`)
  for (const w of worstDeltasM.slice(0, 10)) process.stdout.write(`  ${w.truthId} ${w.property}: truth ${fmt(w.truth)} auto ${fmt(w.auto)} Δ ${fmt(w.delta)} m (tol ${fmt(w.tolerance)})\n`)
  process.stdout.write(`\nMISSING: ${items.filter((i) => i.verdict === 'MISSING').map((i) => i.truthId).join(', ') || 'none'}\n`)
  process.stdout.write(`EXTRA: ${Object.entries(extrasPerFamily).map(([f, n]) => `${f} ${n}`).join(', ') || 'none'}\n`)
  process.stdout.write(`\nwrote ${jsonPath}\nwrote ${mdPath}\n`)
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`)
  process.exitCode = 1
})
