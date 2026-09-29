/**
 * The same house on two web sites?
 *
 * Two publishers may print the same project: the same name, the same
 * figures, the same drawings at different resolutions. Whether two source
 * packages describe one building is a question with four honest answers,
 * and none of them is decided by the title alone:
 *
 *   SOURCE_EQUIVALENT          the reconstructed geometry is identical
 *   SOURCE_PARTIAL_EQUIVALENT  what both state agrees, and nothing disagrees,
 *                              but the geometry differs or one side has none
 *   SOURCE_CONFLICT            something both state disagrees
 *   NOT_ENOUGH_EVIDENCE        too little is comparable to say
 *
 * The comparison is evidence-first and symmetric. Source identity — the
 * publisher, the adapter, the URL, the package id — is never compared: it is
 * what makes the two records DIFFERENT sources, not what makes them the same
 * house. Nothing here merges anything: one logical building with several
 * source records is a later stage's decision, and this report is its input.
 */
import { canonicalJson, sha256Hex } from '@buildapp/source-common'
import type { PublishedFact, PublishedRoom, PublishedSpecification, SourcePackage } from '@buildapp/source-package'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { CompiledScene } from '@buildapp/geometry'
import { deaccent } from '@buildapp/source-package'

export type SourceEquivalence = 'SOURCE_EQUIVALENT' | 'SOURCE_PARTIAL_EQUIVALENT' | 'SOURCE_CONFLICT' | 'NOT_ENOUGH_EVIDENCE'

/** What one source record offers to a comparison. Everything optional: a source that failed to reconstruct still has its page. */
export type SourceComparable = {
  title?: string
  externalId?: string
  facts: readonly PublishedFact[]
  rooms: readonly PublishedRoom[]
  specifications: readonly PublishedSpecification[]
  /** Drawings by document role, counted. */
  drawings: Record<string, number>
  /** The compiled geometry, hashed without any id, label or provenance. */
  geometryFingerprint?: string
  /** The reconstructed footprint's extent in metres, from the compiled scene's bounds. */
  footprint?: { width: number; depth: number; height: number }
  counts?: { walls: number; openings: number; rooms: number; roofs: number }
  roofPitchDeg?: number
}

export type ComparisonRow = { aspect: string; a: string; b: string; verdict: 'MATCH' | 'DIFFER' | 'ONE_SIDED' | 'ABSENT'; note?: string }

export type SourceComparison = {
  schema: 'buildapp.cross-source-comparison'
  schemaVersion: '1.0.0'
  equivalence: SourceEquivalence
  rows: ComparisonRow[]
  /** How many aspects both sides stated. */
  comparable: number
  matches: number
  conflicts: number
  why: string
}

const round = (value: unknown, places: number): unknown => {
  if (typeof value === 'number') return Number(value.toFixed(places))
  if (Array.isArray(value)) return value.map((v) => round(v, places))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, round(v, places)]))
  return value
}

/**
 * A fingerprint of what a scene IS in space: every structural mesh's
 * triangles, rounded to the millimetre, hashed and sorted so neither mesh
 * order nor any id, label, material or provenance takes part. Two scenes
 * compiled from the same geometry under different names fingerprint the
 * same; two that differ by one wall never do.
 */
export function geometryFingerprint(scene: Pick<CompiledScene, 'meshes'>): string {
  const perMesh = scene.meshes
    .filter((m) => m.structural)
    .map((m) => sha256Hex(canonicalJson({ part: m.part, kind: m.objectKind, triangles: round(m.triangles, 3) })))
    .sort()
  return sha256Hex(canonicalJson(perMesh))
}

const normalizeTitle = (title: string | undefined): string | undefined => {
  if (!title) return undefined
  const t = deaccent(title)
    .replace(/^(nowoczesny\s+)?projekt(u)?\s+(domu\s+)?/, '')
    .replace(/\s+dane\s+projektu$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  return t || undefined
}

/** Build the comparable view of one source: its package, and its result when it reconstructed. */
export function comparableOf(pkg: SourcePackage, reconstructed?: { model: CanonicalBuildingModel; scene: CompiledScene }): SourceComparable {
  const drawings: Record<string, number> = {}
  for (const a of pkg.assets) drawings[a.roles.document] = (drawings[a.roles.document] ?? 0) + 1
  const out: SourceComparable = { title: pkg.project.name, externalId: pkg.project.externalId, facts: pkg.publishedFacts, rooms: pkg.publishedRooms, specifications: pkg.publishedSpecifications, drawings }
  if (reconstructed) {
    const { model, scene } = reconstructed
    out.geometryFingerprint = geometryFingerprint(scene)
    if (scene.bounds) out.footprint = { width: Number((scene.bounds.max.x - scene.bounds.min.x).toFixed(2)), depth: Number((scene.bounds.max.z - scene.bounds.min.z).toFixed(2)), height: Number((scene.bounds.max.y - scene.bounds.min.y).toFixed(2)) }
    const m = model as unknown as { walls?: unknown[]; openings?: unknown[]; rooms?: unknown[]; roofs?: Array<{ pitchDeg?: number }> }
    out.counts = { walls: m.walls?.length ?? 0, openings: m.openings?.length ?? 0, rooms: m.rooms?.length ?? 0, roofs: m.roofs?.length ?? 0 }
    // the main roof's pitch: the steepest, since an attached flat roof is 0°
    const pitches = (m.roofs ?? []).map((r) => r.pitchDeg).filter((p): p is number => typeof p === 'number' && p > 0)
    if (pitches.length > 0) out.roofPitchDeg = Math.max(...pitches)
  }
  return out
}

const within = (a: number, b: number, relative: number): boolean => Math.abs(a - b) <= relative * Math.max(Math.abs(a), Math.abs(b), 1e-9)

/** Compare two sources aspect by aspect and classify. Symmetric: swapping the arguments swaps the columns and nothing else. */
export function compareSources(a: SourceComparable, b: SourceComparable): SourceComparison {
  const rows: ComparisonRow[] = []
  const row = (aspect: string, va: string | undefined, vb: string | undefined, same: (() => boolean) | undefined, note?: string): void => {
    if (va === undefined && vb === undefined) rows.push({ aspect, a: '—', b: '—', verdict: 'ABSENT' })
    else if (va === undefined || vb === undefined) rows.push({ aspect, a: va ?? '—', b: vb ?? '—', verdict: 'ONE_SIDED', ...(note ? { note } : {}) })
    else rows.push({ aspect, a: va, b: vb, verdict: same && same() ? 'MATCH' : 'DIFFER', ...(note ? { note } : {}) })
  }

  // A title is weak evidence: publishers add and drop "Dom", "Projekt", codes and
  // suffixes. It matches when one contains the other, and it never decides a conflict.
  const ta = normalizeTitle(a.title)
  const tb = normalizeTitle(b.title)
  row('title (normalized)', ta, tb, () => !!ta && !!tb && (ta === tb || ta.includes(tb) || tb.includes(ta)), 'weak evidence')
  row('project code', a.externalId, b.externalId, () => a.externalId === b.externalId)

  const factKeys = [...new Set([...a.facts.map((f) => f.key), ...b.facts.map((f) => f.key)])].sort()
  for (const key of factKeys) {
    const fa = a.facts.find((f) => f.key === key)
    const fb = b.facts.find((f) => f.key === key)
    row(`fact ${key}`, fa ? `${fa.value} ${fa.unit}` : undefined, fb ? `${fb.value} ${fb.unit}` : undefined, () => !!fa && !!fb && fa.unit === fb.unit && within(fa.value, fb.value, 0.01))
  }

  const roofA = a.specifications.find((s) => s.key === 'roof')?.text
  const roofB = b.specifications.find((s) => s.key === 'roof')?.text
  const pitchOf = (text: string | undefined): number | undefined => {
    const m = text ? /(\d{1,2}(?:[.,]\d)?)\s*(?:°|st\b|stopni|deg)/.exec(deaccent(text)) : null
    return m ? Number(m[1].replace(',', '.')) : undefined
  }
  // what each side PRINTS about the pitch, and separately what each reconstructed
  const sa = pitchOf(roofA)
  const sb = pitchOf(roofB)
  row('roof pitch (stated)', sa === undefined ? undefined : `${sa}°`, sb === undefined ? undefined : `${sb}°`, () => sa !== undefined && sb !== undefined && Math.abs(sa - sb) <= 0.5)
  row('roof pitch (reconstructed)', a.roofPitchDeg === undefined ? undefined : `${a.roofPitchDeg}°`, b.roofPitchDeg === undefined ? undefined : `${b.roofPitchDeg}°`, () => a.roofPitchDeg !== undefined && b.roofPitchDeg !== undefined && Math.abs(a.roofPitchDeg - b.roofPitchDeg) <= 0.5)
  const kindOf = (text: string | undefined): string | undefined => {
    const t = text ? deaccent(text) : ''
    return /dwuspadow|gable/.test(t) ? 'GABLE' : /czterospadow|kopertow|hip/.test(t) ? 'HIP' : /plask|flat/.test(t) ? 'FLAT' : /wielospadow|multi/.test(t) ? 'MULTI' : undefined
  }
  const ka = kindOf(roofA)
  const kb = kindOf(roofB)
  row('roof kind (stated)', ka, kb, () => ka === kb)

  const roomKey = (r: PublishedRoom): string => `${r.storey}:${deaccent(r.label).replace(/[^a-z0-9]+/g, ' ').trim()}:${r.area.toFixed(2)}`
  const ra = a.rooms.map(roomKey).sort()
  const rb = b.rooms.map(roomKey).sort()
  const shared = ra.filter((k) => rb.includes(k)).length
  row('room schedule', a.rooms.length > 0 ? `${a.rooms.length} rooms` : undefined, b.rooms.length > 0 ? `${b.rooms.length} rooms` : undefined, () => ra.length === rb.length && shared === ra.length, a.rooms.length > 0 && b.rooms.length > 0 ? `${shared} identical (storey, label, area)` : undefined)

  for (const doc of ['FLOOR_PLAN', 'ELEVATION', 'SECTION', 'SITE_PLAN', 'PERSPECTIVE_RENDER'] as const) {
    const ca = a.drawings[doc] ?? 0
    const cb = b.drawings[doc] ?? 0
    // coverage is descriptive: a site that publishes one elevation fewer has not described another house
    rows.push({ aspect: `drawings ${doc.toLowerCase().replace('_', ' ')}`, a: String(ca), b: String(cb), verdict: ca === cb ? 'MATCH' : ca === 0 || cb === 0 ? 'ONE_SIDED' : 'DIFFER', note: 'coverage, not identity' })
  }

  row('footprint (reconstructed)', a.footprint ? `${a.footprint.width} × ${a.footprint.depth} × ${a.footprint.height} m` : undefined, b.footprint ? `${b.footprint.width} × ${b.footprint.depth} × ${b.footprint.height} m` : undefined, () => !!a.footprint && !!b.footprint && within(a.footprint.width, b.footprint.width, 0.02) && within(a.footprint.depth, b.footprint.depth, 0.02) && within(a.footprint.height, b.footprint.height, 0.03))
  row('wall topology (count)', a.counts ? `${a.counts.walls} walls` : undefined, b.counts ? `${b.counts.walls} walls` : undefined, () => !!a.counts && !!b.counts && a.counts.walls === b.counts.walls)
  row('openings (count)', a.counts ? `${a.counts.openings}` : undefined, b.counts ? `${b.counts.openings}` : undefined, () => !!a.counts && !!b.counts && a.counts.openings === b.counts.openings)
  row('roofs (count)', a.counts ? `${a.counts.roofs}` : undefined, b.counts ? `${b.counts.roofs}` : undefined, () => !!a.counts && !!b.counts && a.counts.roofs === b.counts.roofs)
  row('geometry fingerprint', a.geometryFingerprint?.slice(0, 16), b.geometryFingerprint?.slice(0, 16), () => a.geometryFingerprint === b.geometryFingerprint)

  const identityRows = rows.filter((r) => !r.note?.startsWith('coverage'))
  const decisive = (r: ComparisonRow): boolean => r.note !== 'weak evidence'
  const comparable = identityRows.filter((r) => r.verdict === 'MATCH' || r.verdict === 'DIFFER').length
  const matches = identityRows.filter((r) => r.verdict === 'MATCH').length
  const conflicts = identityRows.filter((r) => r.verdict === 'DIFFER').length
  const fingerprintsEqual = !!a.geometryFingerprint && a.geometryFingerprint === b.geometryFingerprint

  let equivalence: SourceEquivalence
  let why: string
  if (fingerprintsEqual && identityRows.filter((r) => r.verdict === 'DIFFER' && decisive(r)).length === 0) {
    equivalence = 'SOURCE_EQUIVALENT'
    why = 'the reconstructed geometry is identical and nothing both sources state disagrees'
  } else if (comparable < 3) {
    equivalence = 'NOT_ENOUGH_EVIDENCE'
    why = `only ${comparable} aspect${comparable === 1 ? '' : 's'} both sources state; three are needed`
  } else if (conflicts > 0) {
    // geometry that differs is not by itself a conflict: two resolutions of the same drawings
    // reconstruct differently. A conflict is something both PRINT and disagree on.
    const printed = identityRows.filter((r) => r.verdict === 'DIFFER' && decisive(r) && !/reconstructed|count|fingerprint/.test(r.aspect))
    if (printed.length > 0) {
      equivalence = 'SOURCE_CONFLICT'
      why = `both sources state ${printed.map((r) => r.aspect).join(', ')} and disagree`
    } else {
      equivalence = 'SOURCE_PARTIAL_EQUIVALENT'
      why = `everything both sources print agrees (${matches} aspects); the reconstructions differ (${identityRows.filter((r) => r.verdict === 'DIFFER').map((r) => r.aspect).join(', ')})`
    }
  } else {
    equivalence = 'SOURCE_PARTIAL_EQUIVALENT'
    why = `${matches} aspects agree and none disagrees, but the geometry is not identical${a.geometryFingerprint && b.geometryFingerprint ? '' : ' (one side has no reconstruction)'}`
  }
  return { schema: 'buildapp.cross-source-comparison', schemaVersion: '1.0.0', equivalence, rows, comparable, matches, conflicts, why }
}

/** The comparison as a Markdown table, for a report. */
export function comparisonMarkdown(c: SourceComparison, labels: [string, string] = ['A', 'B']): string {
  const lines = [`| aspect | ${labels[0]} | ${labels[1]} | verdict |`, '| --- | --- | --- | --- |']
  for (const r of c.rows) lines.push(`| ${r.aspect} | ${r.a} | ${r.b} | ${r.verdict}${r.note ? ` (${r.note})` : ''} |`)
  lines.push('', `**${c.equivalence}** — ${c.why}`)
  return lines.join('\n')
}
