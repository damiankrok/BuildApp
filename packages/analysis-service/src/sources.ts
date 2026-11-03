/**
 * SOURCE-01: the source inspection — for every image the page published, what the publisher said it is, what its
 * pixels show, what the analyzer did with it and why, and every number read off it: where it is printed, what line it
 * measures, whether it was printed or worked out, and what the model made of it (the solver's evidence ledger).
 *
 * It is a READ-ONLY account built after the run from records the run already keeps (the package's roles, the content
 * verdicts, the analyzer's skips, the solver's registrations and view audit, the metric evidence and the ledger). It
 * decides nothing and feeds nothing back; no hash depends on it.
 */
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { ContentVerdict } from '@buildapp/source-analyzer'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import { selectedVariant } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'

export type SourceReading = {
  id: string
  /** What the number is: an overall dimension, one cell of a chain, an opening's size, a level, an angle, an area. */
  measure: 'OVERALL' | 'CHAIN_SEGMENT' | 'DIMENSION' | 'OPENING' | 'LEVEL' | 'ANGLE' | 'AREA' | 'OTHER'
  /** Exactly what was read (empty for a value nothing printed). */
  rawText: string
  value: number
  unit: string
  /** PRINTED: a number on the drawing (as read, or re-read against its chain); DERIVED: worked out, never printed. */
  printed: boolean
  origin: string
  /** Where the characters are printed, in the sheet's pixels. */
  box?: { x0: number; y0: number; x1: number; y1: number }
  /** The line it measures and its two ends, in the sheet's pixels. */
  line?: { x0: number; y0: number; x1: number; y1: number }
  /** What the model did with it: the solver's disposition, the feature it went into, and why. */
  use: string
  featureId?: string
  why: string
}

export type SourceSheet = {
  assetId: string
  url: string
  width: number
  height: number
  byteHash: string
  /** The publisher's claim (caption, file name, gallery), as the roles. */
  claimed: { document: string; storey: string; view: string; annotation: string; projection: string; basis: string }
  /** What the pixels show; null when no encoder ran. */
  content: { top: string; probability: number; projection: string; decision: string } | null
  /** What the analyzer did with the sheet. */
  outcome: 'READ' | 'REFUSED_BY_CONTENT' | 'NOT_READ' | 'NO_READER'
  /** The reader it reached, the facade side when it is an elevation, and one sentence why. */
  reader: string
  side?: string
  sideBasis?: string
  why: string
  readings: SourceReading[]
}

export type SourceInspection = {
  classifier: { id: string; modelSha256: string; headVersion: string } | null
  sheets: SourceSheet[]
  counts: { sheets: number; read: number; refusedByContent: number; readings: number; printedUsed: number; derived: number }
}

type Ledger = ReadonlyArray<{ evidenceId: string; disposition: string; featureId?: string; reason: string }>
type ViewAudit = ReadonlyArray<{ assetId: string; frameId: string; use: string; side?: string; sideBasis?: string; why: string }>

const measureOf = (kind: string, chainRole: string | undefined): SourceReading['measure'] => {
  if (kind === 'LINEAR_DIMENSION') return chainRole === 'OVERALL' ? 'OVERALL' : chainRole ? 'CHAIN_SEGMENT' : 'DIMENSION'
  if (kind === 'OPENING_CALLOUT') return 'OPENING'
  if (kind === 'LEVEL_DATUM') return 'LEVEL'
  if (kind === 'ANGLE') return 'ANGLE'
  if (kind === 'ROOM_AREA') return 'AREA'
  return 'OTHER'
}

const READER: Record<string, string> = { FLOOR_PLAN: 'plan', ELEVATION: 'facade', SECTION: 'section', SITE_PLAN: 'site', PERSPECTIVE_RENDER: 'exterior camera', DETAIL: 'none', CHROME: 'none', UNKNOWN: 'none' }

export function sourceInspectionOf(input: {
  pkg: SourcePackage
  graph: SourceObservationGraph
  metrics: MetricEvidenceSet
  ledger: Ledger
  viewAudit: ViewAudit
  planFrameIds: ReadonlySet<string>
  cameras: ReadonlyArray<{ frameId: string; solved: boolean; why: string }>
  content: readonly ContentVerdict[]
  skipped: ReadonlyArray<{ assetId: string; reason: string }>
  classifier: SourceInspection['classifier']
}): SourceInspection {
  const ledger = new Map<string, Ledger[number]>()
  for (const r of input.ledger) if (!ledger.has(r.evidenceId) || r.disposition === 'USED_IN_MODEL') ledger.set(r.evidenceId, r)
  const content = new Map(input.content.map((c) => [c.assetId, c]))
  const skipped = new Map(input.skipped.map((s) => [s.assetId, s.reason]))
  const frameOf = new Map(input.graph.coordinateFrames.map((f) => [f.assetId, f]))
  const chainRole = new Map(input.metrics.chains.map((c) => [c.id, c.topology?.roles.includes('OVERALL') ? 'OVERALL' : 'SEGMENT']))
  const sheets: SourceSheet[] = []
  for (const asset of [...input.pkg.assets].sort((a, b) => a.id.localeCompare(b.id))) {
    const v = selectedVariant(asset)
    const verdict = content.get(asset.id)
    const frame = frameOf.get(asset.id)
    const basis = asset.roleEvidence.find((e) => e.dimension === 'document')?.detail ?? 'no caption, file name or gallery placement named it'
    const claimed = { document: asset.roles.document, storey: asset.roles.storey, view: asset.roles.view, annotation: asset.roles.annotation, projection: asset.roles.projection, basis }
    let outcome: SourceSheet['outcome']
    let reader = READER[asset.roles.document] ?? 'none'
    let why: string
    let side: string | undefined
    let sideBasis: string | undefined
    if (verdict?.decision === 'VETOED') {
      outcome = 'REFUSED_BY_CONTENT'
      why = verdict.why
      reader = 'none'
    } else if (!frame) {
      outcome = reader === 'none' ? 'NO_READER' : 'NOT_READ'
      why = skipped.get(asset.id) ?? (reader === 'none' ? 'no role sends it to a reader' : 'not read')
      if (reader === 'none') reader = 'none'
    } else {
      outcome = 'READ'
      const audit = input.viewAudit.find((a) => a.frameId === frame.id)
      const cam = input.cameras.find((c) => c.frameId === frame.id)
      if (audit) {
        why = `${audit.use.toLowerCase().replace(/_/g, ' ')}: ${audit.why}`
        side = audit.side
        sideBasis = audit.sideBasis
      } else if (cam) why = cam.solved ? `camera solved: ${cam.why}` : `camera not solved: ${cam.why}`
      else if (asset.roles.document === 'FLOOR_PLAN') why = input.planFrameIds.has(frame.id) ? 'registered as a plan of the model' : 'read, but not registered as a plan of the model'
      else why = `read by the ${reader} reader`
      if (verdict && verdict.decision !== 'NOT_CLASSIFIED') why = `${why} — ${verdict.why}`
    }
    const readings: SourceReading[] = []
    if (frame) {
      for (const e of input.metrics.evidence) {
        if (e.frameId !== frame.id || e.kind === 'DIMENSION_CHAIN' || e.kind === 'SCALE_ANCHOR') continue
        const printed = e.origin === 'READ' || e.origin === 'CHAIN_CORRECTED'
        const l = ledger.get(e.id)
        const g = e.measuredGeometry
        const line = g?.type === 'SEGMENT' ? { x0: g.a.x, y0: g.a.y, x1: g.b.x, y1: g.b.y } : undefined
        readings.push({
          id: e.id,
          measure: measureOf(e.kind, e.chainId ? chainRole.get(e.chainId) : undefined),
          rawText: printed ? e.rawText : '',
          value: e.value,
          unit: e.unit,
          printed,
          origin: e.origin,
          ...(e.textBox ? { box: { x0: e.textBox.x0, y0: e.textBox.y0, x1: e.textBox.x1, y1: e.textBox.y1 } } : {}),
          ...(line ? { line } : {}),
          use: l?.disposition ?? 'NOT_CONSULTED',
          ...(l?.featureId ? { featureId: l.featureId } : {}),
          why: l?.reason ?? (printed ? 'read, but no model decision consulted it' : 'worked out from the chain, never printed'),
        })
      }
    }
    sheets.push({ assetId: asset.id, url: v.url, width: v.decoded.width, height: v.decoded.height, byteHash: v.byteHash, claimed, content: verdict && verdict.decision !== 'NOT_CLASSIFIED' ? { top: verdict.top, probability: verdict.topProbability, projection: verdict.projection, decision: verdict.decision } : null, outcome, reader, ...(side ? { side } : {}), ...(sideBasis ? { sideBasis } : {}), why, readings })
  }
  const all = sheets.flatMap((s) => s.readings)
  return {
    classifier: input.classifier,
    sheets,
    counts: {
      sheets: sheets.length,
      read: sheets.filter((s) => s.outcome === 'READ').length,
      refusedByContent: sheets.filter((s) => s.outcome === 'REFUSED_BY_CONTENT').length,
      readings: all.length,
      printedUsed: all.filter((r) => r.printed && (r.use === 'USED_IN_MODEL' || r.use === 'USED_AS_CORROBORATION')).length,
      derived: all.filter((r) => !r.printed).length,
    },
  }
}
