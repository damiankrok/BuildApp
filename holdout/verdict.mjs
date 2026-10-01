#!/usr/bin/env node
// BUILDPLAN-005A blind holdout: the verdict (T4), by the predicates in README §5, as code committed before the
// draw. It reads one run's output directory (analysis:second-house --url … --out <dir>) and nothing else.
//   node holdout/verdict.mjs <run dir>
// Prints one JSON object: the verdict, every condition with the number behind it, and the source checklist.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) {
  process.stderr.write('usage: node holdout/verdict.mjs <run dir>\n')
  process.exit(2)
}
const read = (name) => (existsSync(join(dir, name)) ? JSON.parse(readFileSync(join(dir, name), 'utf8')) : undefined)
const pkg = read('source-package.json')
const summary = read('result-summary.json')
const failure = read('failure.json')
const trace = read('analysis-trace.json')
const digest = read('plan-diagnostics/digest.json')
const metrics = read('metric-evidence.json')
const graph = read('observation-graph.json')
const model = read('model.json')

const floorPlans = (pkg?.assets ?? []).filter((a) => a.roles?.document === 'FLOOR_PLAN')
const labelled = new Set(floorPlans.map((a) => a.roles.storey).filter((s) => s && s !== 'UNKNOWN' && s !== 'NOT_APPLICABLE'))
const published = pkg?.publishedFacts?.find((f) => f.key === 'footprint_area' && f.unit === 'm2')?.value
const resolution = trace?.entries?.find((e) => e.substage === 'PLAN_RESOLUTION')?.counts
// 005D (R9): a first reading the drawing itself contradicted may be replaced by a reading it states
// (METRIC_CHALLENGE REPLACED); the published figure may only have verified it, never chosen it.
const challenge = trace?.entries?.find((e) => e.substage === 'METRIC_CHALLENGE')?.counts

const ringArea = (poly) => Math.abs(poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + p.x * q.z - q.x * p.z }, 0)) / 2

// --- the source checklist (README §5): each item measured, or named as needing a measurement ------------------
const groundStorey = labelled.has('GROUND') ? 'GROUND' : 'UNKNOWN'
const groundFrames = new Set((graph?.coordinateFrames ?? []).filter((f) => f.roles.document === 'FLOOR_PLAN' && f.roles.projection === 'ORTHOGRAPHIC_PLAN' && f.roles.storey === groundStorey).map((f) => f.id))
const overall = (metrics?.ocrTokens ?? []).filter((t) => groundFrames.has(t.frameId) && /^\d{3,5}$/.test(t.text))
const groundPlansRead = (digest?.plans ?? []).filter((p) => groundFrames.has(p.frameId))
const lostPlans = (pkg?.failures ?? []).filter((f) => f.claim?.document === 'FLOOR_PLAN' && !['BYTE_IDENTICAL', 'DIFFERENT_CROP'].includes(f.code) && !(f.claim?.channel === 'VARIANT_CONVENTION' && ((f.code === 'HTTP_STATUS' && [404, 410].includes(f.status)) || f.code === 'OFFLINE_CACHE_MISS')))
const checklist = {
  noFloorPlan: floorPlans.length === 0,
  // Legibility is measured on the raw copy; the OCR's own tokens can only nominate it (README §5).
  legibleOverallDimension: {
    ocrTokensOnGroundCopies: overall.length,
    tallestPx: overall.reduce((m, t) => Math.max(m, t.heightPx ?? 0), 0),
    needsRawMeasurement: overall.every((t) => (t.heightPx ?? 0) < 10),
  },
  wallsUnder4pxOnEveryGroundCopy: groundPlansRead.length > 0 && groundPlansRead.every((p) => p.wallPx < 4),
  groundWallPx: groundPlansRead.map((p) => ({ frameId: p.frameId, sizePx: p.sizePx, wallPx: p.wallPx })),
  floorPlanAssetsLost: lostPlans.map((f) => ({ code: f.code, status: f.status, target: f.target })),
}
const sourceLimited = checklist.noFloorPlan || checklist.wallsUnder4pxOnEveryGroundCopy || lostPlans.length > 0

// --- the verdict ------------------------------------------------------------------------------------------------
const out = { run: dir, completed: Boolean(summary), labelledPlanStoreys: [...labelled].sort(), publishedFootprintM2: published ?? null, checklist }
if (summary && model) {
  const lowest = [...model.levels].sort((a, b) => a.index - b.index)[0]
  const footprint = model.slabs.filter((s) => s.levelId === lowest?.id).reduce((a, s) => a + ringArea(s.polygon), 0)
  const warnings = summary.warningDetails ?? []
  const resolved = warnings.some((w) => w.code === 'LAYOUT_PLAN_RESOLVED_BY_HYPOTHESIS')
  const conditions = {
    storeys: { model: model.levels.length, plans: labelled.size, holds: model.levels.length === labelled.size },
    openingsAllBuilt: { holds: !warnings.some((w) => w.code === 'OPENINGS_NOT_BUILT'), message: warnings.find((w) => w.code === 'OPENINGS_NOT_BUILT')?.message ?? null },
    footprint: published === undefined ? { holds: true, builtM2: +footprint.toFixed(2), note: 'no footprint published' } : { builtM2: +footprint.toFixed(2), publishedM2: published, residualPct: +((footprint / published - 1) * 100).toFixed(2), holds: Math.abs(footprint / published - 1) <= 0.06 },
    resolvedWithAWitness: resolved ? { chosen: resolution?.chosen ?? null, corroborations: resolution?.chosenCorroborations ?? '', holds: Boolean(resolution?.chosenCorroborations) } : { holds: true, note: 'the first reading held' },
    replacedByTheDrawing:
      challenge?.outcome === 'REPLACED'
        ? {
            chosen: challenge.chosen ?? null,
            sourceConflict: challenge.sourceConflict ?? null,
            publishedFigure: challenge.publishedFigure ?? null,
            corroborations: challenge.chosenCorroborations ?? '',
            // Replaced because the drawing contradicted the first reading (a named source conflict), the figure
            // only verifying the replacement; or, without a conflict, chosen with a witness besides the figure.
            holds: challenge.sourceConflict ? ['VERIFIED', 'NONE'].includes(challenge.publishedFigure) : Boolean(challenge.chosenCorroborations),
          }
        : { holds: true, note: challenge ? `the challenge ${challenge.outcome === 'KEPT' ? 'kept' : 'did not replace'} the first reading` : 'no challenge' },
  }
  out.conditions = conditions
  out.bodies = summary.counts?.masses ?? null
  out.unresolved = summary.unresolved?.length ?? null
  out.warnings = warnings.map((w) => `${w.severity}:${w.code}`)
  out.verdict = Object.values(conditions).every((c) => c.holds) ? 'PASS' : 'ALGORITHMIC_FAIL'
} else {
  out.failure = failure ? { code: failure.code, reasonCode: failure.reasonCode ?? null, message: failure.message } : null
  out.resolution = resolution ?? null
  out.challenge = challenge ?? null
  // a typed reason, and a checklist item confirmed; legibility alone waits for its raw measurement
  out.verdict = failure && sourceLimited ? 'SOURCE_LIMITED_PARTIAL' : failure && checklist.legibleOverallDimension.needsRawMeasurement ? 'PENDING_RAW_LEGIBILITY_MEASUREMENT' : 'ALGORITHMIC_FAIL'
}
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
