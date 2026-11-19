/**
 * v3.54.13 — per-property arbitration between an accepted base model (read on the original sources) and a candidate
 * read with an auxiliary picture standing in for one or more elevations (an OWNER's sketch, a rendered reading).
 *
 * An auxiliary picture is a hypothesis about appearance and outline; it is not a witness to a dimension. So, opening by
 * opening and property by property:
 *
 * - RETAINED: the base's value stays — the two agree, or the candidate's differing value rests on what only the
 *   auxiliary picture could have said (anything weaker than a printed source fact) while the base's is corroborated;
 * - CORRECTED: the candidate's value replaces the base's — it is a printed source fact (SOURCE_EXACT) the base lacked
 *   or contradicted, which no picture of the elevation could have produced;
 * - UNSUPPORTED: the candidate claims a change (a door's leaf assembly, its hinge) the auxiliary picture cannot carry;
 *   the base's stays and the claim is named;
 * - UNRESOLVED: no decision is safe — the opening moved to another host or interval, or the base is not a witness for
 *   these sources (another revision of the original elevation, another package's cache): the candidate's value stands
 *   unchanged and the property is named.
 *
 * A colour never raises a measurement: nothing here reads finishes, and UNKNOWN never means a zero or a blind wall.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'

export const ARBITRATION_VERSION = '1.0.0' as const

export type Decision = 'RETAINED' | 'CORRECTED' | 'UNSUPPORTED' | 'UNRESOLVED'
export type PropertyRecord = { elementId: string; property: string; decision: Decision; base: unknown; candidate: unknown; applied: unknown; why: string }

/** What the two runs were read from: asset id → the byte hash of the variant read, and, for the candidate, its stand-ins. */
export type RunSources = { packageId: string; assets: Record<string, string> }
export type Auxiliary = { assetId: string; facade: 'FRONT' | 'REAR' | 'EAST' | 'WEST'; originalByteHash: string; auxiliaryByteHash: string }

const RANK: Record<string, number> = { SOURCE_EXACT: 5, SOURCE_CORROBORATED: 4, SOURCE_DERIVED: 3, VISUAL_INFERRED: 2, ESTIMATED: 2, ASSUMED: 1, UNRESOLVED: 0 }
const rank = (s: string | undefined): number => (s === undefined ? 0 : RANK[s] ?? 1)

type Opening = CanonicalBuildingModel['openings'][number]
type Door = CanonicalBuildingModel['doors'][number]

const facadeOfWall = (model: CanonicalBuildingModel, wallId: string): 'FRONT' | 'REAR' | 'EAST' | 'WEST' | undefined => {
  const w = model.walls.find((x) => x.id === wallId)
  if (!w) return undefined
  const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
  if (L < 1e-9) return undefined
  const nx = (w.end.z - w.start.z) / L
  const nz = -(w.end.x - w.start.x) / L
  if (nz < -0.9) return 'FRONT'
  if (nz > 0.9) return 'REAR'
  if (nx > 0.9) return 'EAST'
  if (nx < -0.9) return 'WEST'
  return undefined
}

export type ArbitrationResult = { model: CanonicalBuildingModel; records: PropertyRecord[]; witness: { ok: boolean; why: string } }

export function arbitrateOpenings(base: CanonicalBuildingModel, candidate: CanonicalBuildingModel, sources: { base: RunSources; candidate: RunSources; auxiliary: Auxiliary[] }): ArbitrationResult {
  const out = structuredClone(candidate) as CanonicalBuildingModel
  const records: PropertyRecord[] = []
  // the base is a witness only for the same house read from the same sources, the stand-ins aside
  const aux = new Map(sources.auxiliary.map((a) => [a.assetId, a]))
  const problems: string[] = []
  if (sources.base.packageId !== sources.candidate.packageId) problems.push(`another package (${sources.base.packageId} vs ${sources.candidate.packageId})`)
  for (const [asset, h] of Object.entries(sources.candidate.assets)) {
    const a = aux.get(asset)
    const expect = a ? a.originalByteHash : h
    if (a && h !== a.auxiliaryByteHash) problems.push(`${asset}: the candidate read ${h.slice(0, 12)}, not its stated stand-in ${a.auxiliaryByteHash.slice(0, 12)}`)
    if (sources.base.assets[asset] !== expect) problems.push(`${asset}: the base read ${String(sources.base.assets[asset]).slice(0, 12)}, the original is ${expect.slice(0, 12)}`)
  }
  const witness = problems.length === 0 ? { ok: true, why: 'same package, every source the same bytes, the stand-ins aside' } : { ok: false, why: `the base is not a witness for these sources: ${problems.slice(0, 3).join('; ')}` }
  const auxFacades = new Set(sources.auxiliary.map((a) => a.facade))
  const baseOpenings = new Map(base.openings.map((o) => [o.id, o]))
  const props = ['height', 'sill', 'width', 'offset'] as const
  out.openings = out.openings.map((c) => {
    const b = baseOpenings.get(c.id)
    const facade = facadeOfWall(out, c.wallId)
    if (!b) return c
    const pc = (c.evidence?.properties ?? {}) as Record<string, string>
    const pb = (b.evidence?.properties ?? {}) as Record<string, string>
    const moved = b.wallId !== c.wallId || Math.abs(b.offset - c.offset) > 0.01 || Math.abs(b.width - c.width) > 0.01
    let next: Opening = c
    for (const p of props) {
      const cv = c[p]
      const bv = b[p]
      const sameValue = Math.abs(cv - bv) <= 0.005
      if (sameValue) {
        records.push({ elementId: c.id, property: p, decision: 'RETAINED', base: bv, candidate: cv, applied: cv, why: 'the two agree' })
        continue
      }
      if (!witness.ok || (moved && p !== 'height' && p !== 'sill')) {
        records.push({ elementId: c.id, property: p, decision: 'UNRESOLVED', base: bv, candidate: cv, applied: cv, why: witness.ok ? 'the opening moved (host or interval): its properties must be reconciled again, not carried over' : witness.why })
        continue
      }
      const viaAux = facade !== undefined && auxFacades.has(facade)
      const keyOf = (q: string): string => (q === 'height' ? 'height' : q)
      const cr = rank(pc[keyOf(p)])
      const br = rank(pb[keyOf(p)])
      if (viaAux && cr < RANK.SOURCE_EXACT && br >= RANK.SOURCE_DERIVED) {
        next = { ...next, [p]: bv }
        records.push({ elementId: c.id, property: p, decision: 'RETAINED', base: bv, candidate: cv, applied: bv, why: `on the ${facade?.toLowerCase()} facade the candidate's elevation was an auxiliary picture; its ${p} (${pc[keyOf(p)] ?? 'no provenance'}) cannot replace the base's ${pb[keyOf(p)]} value` })
      } else if (cr === RANK.SOURCE_EXACT && cr > br) {
        records.push({ elementId: c.id, property: p, decision: 'CORRECTED', base: bv, candidate: cv, applied: cv, why: `a printed source fact (SOURCE_EXACT) the base held only as ${pb[keyOf(p)] ?? 'nothing'}` })
      } else {
        records.push({ elementId: c.id, property: p, decision: 'UNRESOLVED', base: bv, candidate: cv, applied: cv, why: `neither side decides: candidate ${pc[keyOf(p)] ?? '—'}, base ${pb[keyOf(p)] ?? '—'}` })
      }
    }
    // the evidence of what was retained is the base's: its provenance and interpretation travel with the value
    if (next !== c) {
      const retained = records.filter((r) => r.elementId === c.id && r.decision === 'RETAINED' && r.applied !== r.candidate).map((r) => r.property)
      const evidence = c.evidence ? { ...c.evidence, properties: { ...(c.evidence.properties ?? {}) } } : undefined
      if (evidence && b.evidence) {
        for (const p of retained) (evidence.properties as Record<string, string>)[p] = (b.evidence.properties as Record<string, string> | undefined)?.[p] ?? 'SOURCE_DERIVED'
        if (retained.includes('height')) (evidence.properties as Record<string, string>).head = (b.evidence.properties as Record<string, string> | undefined)?.head ?? (evidence.properties as Record<string, string>).head
        evidence.status = b.evidence.status
        evidence.interpretation = `${c.evidence?.interpretation ?? ''}; retained from the accepted base (${retained.join(', ')}): ${b.evidence.interpretation ?? ''}`.slice(0, 1000)
      }
      next = { ...next, ...(evidence ? { evidence } : {}) } as Opening
    }
    return next
  })
  // doors: a leaf's assembly and hinge are not something an auxiliary picture can carry
  const baseDoors = new Map(base.doors.map((d) => [d.id, d]))
  out.doors = out.doors.map((c) => {
    const b = baseDoors.get(c.id)
    if (!b) return c
    const opening = out.openings.find((o) => o.id === c.openingId)
    const facade = opening ? facadeOfWall(out, opening.wallId) : undefined
    const viaAux = facade !== undefined && auxFacades.has(facade)
    let next: Door = c
    for (const p of ['assembly', 'hinge', 'materialId', 'swing'] as const) {
      const cv = (c as Record<string, unknown>)[p]
      const bv = (b as Record<string, unknown>)[p]
      if (JSON.stringify(cv) === JSON.stringify(bv)) continue
      if (!witness.ok) {
        records.push({ elementId: c.id, property: p, decision: 'UNRESOLVED', base: bv, candidate: cv, applied: cv, why: witness.why })
        continue
      }
      if (viaAux) {
        next = { ...next, [p]: bv } as Door
        records.push({ elementId: c.id, property: p, decision: p === 'materialId' ? 'RETAINED' : 'UNSUPPORTED', base: bv, candidate: cv, applied: bv, why: p === 'materialId' ? 'a leaf material read on an auxiliary picture is a colour, not a door: kept as the base read it (an appearance hypothesis, named)' : `a door ${p} cannot be read from a colour on an auxiliary picture: the base's stays, the claim is named` })
      } else {
        records.push({ elementId: c.id, property: p, decision: 'UNRESOLVED', base: bv, candidate: cv, applied: cv, why: 'differs on a facade read from its original: not this arbitration\'s to decide' })
      }
    }
    return next
  })
  return { model: out, records, witness }
}
