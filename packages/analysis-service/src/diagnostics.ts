/**
 * A compact, shareable account of one run: what failed and where, what the
 * run established on the way, and the plan decomposition drawn over the plan.
 *
 * Made for the case the phone cannot otherwise explain — a failure far from a
 * debugger — and small on purpose: the digest of the decomposition, the
 * trace, and ONE overlay picture, never the source images themselves. It
 * names what the sources were by hash, so the same bytes can be fetched and
 * the run repeated on a desktop, and it carries nothing about the machine it
 * ran on beyond what the caller adds.
 */
import { PNG } from 'pngjs'
import { renderPlanOverlay } from '@buildapp/reconstruction'
import type { PlanDiagnosticsReport, PlanOverlayLayer } from '@buildapp/reconstruction'
import type { Raster } from '@buildapp/source-cv'
import type { SourcePackage } from '@buildapp/source-package'
import { selectedVariant } from '@buildapp/source-package'
import type { AnalysisFailure } from './errors.js'
import type { AnalysisTrace } from './trace.js'

export const DIAGNOSTICS_SCHEMA = 'buildapp.analysis-diagnostics' as const

export type AnalysisDiagnostics = {
  schema: typeof DIAGNOSTICS_SCHEMA
  schemaVersion: '1.0.0'
  outcome: AnalysisTrace['outcome']
  failure: AnalysisFailure | null
  /** What was read, by hash only. */
  source: {
    canonicalUrl: string
    packageHash: string
    pageHash: string
    assets: Array<{ id: string; document: string; storey: string; annotation: string; sizePx: string; byteHash: string }>
    /** Addresses not used, by code: a phone's partial download shows up here. */
    failures: Record<string, number>
    /**
     * Addresses the page EXPOSED as floor plans that never arrived (a guessed
     * larger copy that does not exist is not one of them). A plan read from
     * the one copy that survived is read from less than the page offered, and
     * this is where that shows.
     */
    planAddressesLost: LostPlanAddress[]
  } | null
  plans: PlanDiagnosticsReport | null
  trace: AnalysisTrace
}

export type DiagnosticsBundle = {
  diagnostics: AnalysisDiagnostics
  /** The chosen plan's decomposition over the plan, PNG, when a plan was read. */
  overlay: { name: string; png: Uint8Array } | null
}

const units = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * One exposed floor-plan address acquisition lost: the roles its name claimed,
 * which copy it was — the file the publisher named, never a path on the device
 * — at which stage it was lost and what the failure said (005B: so a phone run
 * that keeps one copy of four says which three it dropped, and why).
 */
export type LostPlanAddress = { code: string; storey?: string; annotation?: string; file?: string; stage?: string; detail?: string }

const fileOf = (target: string): string | undefined => {
  try {
    return new URL(target).pathname.split('/').filter(Boolean).at(-1)
  } catch {
    return undefined
  }
}

/** The exposed floor-plan addresses acquisition lost, by the roles their names claimed. Deterministic order. */
export function lostPlanAddresses(pkg: SourcePackage): LostPlanAddress[] {
  return pkg.failures
    .filter((f) => f.claim?.document === 'FLOOR_PLAN' && f.claim.channel !== 'VARIANT_CONVENTION')
    .map((f) => {
      const file = fileOf(f.target)
      return {
        code: f.code,
        ...(f.claim?.storey ? { storey: f.claim.storey } : {}),
        ...(f.claim?.annotation ? { annotation: f.claim.annotation } : {}),
        ...(file ? { file } : {}),
        stage: f.stage,
        detail: f.message.slice(0, 160),
      }
    })
    .sort((a, b) => units(a.storey ?? '', b.storey ?? '') || units(a.annotation ?? '', b.annotation ?? '') || units(a.code, b.code) || units(a.file ?? '', b.file ?? ''))
}

export function sourceSummaryOf(pkg: SourcePackage): NonNullable<AnalysisDiagnostics['source']> {
  const failures: Record<string, number> = {}
  for (const f of pkg.failures) failures[f.code] = (failures[f.code] ?? 0) + 1
  return {
    canonicalUrl: pkg.canonicalUrl,
    packageHash: pkg.contentHash,
    pageHash: pkg.pageHash,
    assets: pkg.assets
      .map((a) => {
        const v = selectedVariant(a)
        return { id: a.id, document: a.roles.document, storey: a.roles.storey, annotation: a.roles.annotation, sizePx: `${v.decoded.width}x${v.decoded.height}`, byteHash: v.byteHash }
      })
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    failures,
    planAddressesLost: lostPlanAddresses(pkg),
  }
}

/** PNG bytes for an RGBA raster. */
export function encodePng(raster: Raster): Uint8Array {
  const png = new PNG({ width: raster.width, height: raster.height })
  png.data = Buffer.from(raster.data.buffer, raster.data.byteOffset, raster.data.byteLength)
  return new Uint8Array(PNG.sync.write(png, { colorType: 6 }))
}

/** One plan's overlay, as PNG bytes, or null when its pixels are not at hand. */
export function planOverlayPng(plans: PlanDiagnosticsReport, frameId: string, raster: Raster | undefined, layer: PlanOverlayLayer, maxSide?: number): Uint8Array | null {
  const plan = plans.plans.find((p) => p.frameId === frameId)
  if (!plan || !raster) return null
  return encodePng(renderPlanOverlay(raster, plan, layer, maxSide))
}

export function diagnosticsBundle(options: {
  outcome: AnalysisTrace['outcome']
  failure: AnalysisFailure | null
  pkg?: SourcePackage
  plans?: PlanDiagnosticsReport
  trace: AnalysisTrace
  rasterOf?: (variantByteHash: string) => Raster | undefined
}): DiagnosticsBundle {
  const plans = options.plans ?? null
  const chosen = plans ? (plans.plans.find((p) => p.frameId === plans.selectedPlanFrameId) ?? plans.plans[0]) : undefined
  let overlay: DiagnosticsBundle['overlay'] = null
  if (plans && chosen && options.rasterOf) {
    try {
      // 1000 px on the long side: enough to read a wall band, small enough to share.
      const png = planOverlayPng(plans, chosen.frameId, options.rasterOf(chosen.variantByteHash), 'ALL', 1000)
      if (png) overlay = { name: 'plan-overlay.png', png }
    } catch {
      overlay = null
    }
  }
  return {
    diagnostics: {
      schema: DIAGNOSTICS_SCHEMA,
      schemaVersion: '1.0.0',
      outcome: options.outcome,
      failure: options.failure,
      source: options.pkg ? sourceSummaryOf(options.pkg) : null,
      plans,
      trace: options.trace,
    },
    overlay,
  }
}
