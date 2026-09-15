/**
 * `npm run reconstruct:trace -- --slug marcowki [--object <id>]`
 *
 * The §22 audit trail, printed: from a primitive in the model back to the
 * bytes it came from.
 *
 * Everything here is already in the sealed artefacts — the candidate's traces,
 * the hypothesis set's sightings, the metric evidence's tokens and boxes. What
 * this adds is the joining, which is tedious to do by hand and is exactly what
 * anyone checking a disputed dimension needs to do first.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MetricEvidenceSet, OcrToken } from '@buildapp/source-metrics'
import type { PrimitiveHypothesisSet } from '../src/index.js'
import type { ReconstructionCandidate } from '../src/index.js'

const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

const box = (r: { x0: number; y0: number; x1: number; y1: number } | undefined): string => (r ? `[${Math.round(r.x0)},${Math.round(r.y0)} → ${Math.round(r.x1)},${Math.round(r.y1)}]` : '—')

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const dir = value(argv, 'dir') ?? join(process.cwd(), 'stage-reports', 'artifacts', 'reconstruction')
  const slug = value(argv, 'slug') ?? 'marcowki'
  const only = value(argv, 'object')
  await mkdir(dir, { recursive: true })

  const candidate = JSON.parse(await readFile(join(dir, `${slug}-candidate.json`), 'utf8')) as ReconstructionCandidate
  const hypotheses = JSON.parse(await readFile(join(dir, `${slug}-hypotheses.json`), 'utf8')) as PrimitiveHypothesisSet
  const metrics = JSON.parse(await readFile(join(dir, `${slug}-metrics.json`), 'utf8')) as MetricEvidenceSet

  const hypothesisById = new Map(hypotheses.hypotheses.map((h) => [h.id, h]))
  const evidenceById = new Map(metrics.evidence.map((e) => [e.id, e]))
  const tokenById = new Map<string, OcrToken>(metrics.ocrTokens.map((t) => [t.id, t]))
  const registrationFor = new Map(metrics.coordinateRegistrations.map((r) => [r.frameId, r]))

  const lines: string[] = []
  const say = (line = ''): void => {
    lines.push(line)
  }

  say(`TRACE  ${candidate.id}`)
  say(`  source package   ${candidate.sourcePackageHash}`)
  say(`  observations     ${candidate.observationGraphHash}`)
  say(`  metric evidence  ${candidate.metricEvidenceHash}`)
  say(`  hypotheses       ${candidate.hypothesisSetHash}`)
  say(`  model            ${candidate.modelHash}`)
  say()

  // --- every hard dimension, back to the characters it was read from --------
  say('HARD DIMENSIONS — what was read, where, and how far off the sheet scale it landed')
  const hard = candidate.quantities.filter((q) => q.class === 'HARD')
  if (hard.length === 0) say('  (none: nothing in this candidate is settled by an exact statement)')
  for (const q of hard) {
    say(`  ${q.hypothesisId}.${q.parameter} = ${q.value} ${q.unit}`)
    say(`    ${q.why}`)
    const hypothesis = hypothesisById.get(q.hypothesisId)
    const fromTraces = candidate.traces.filter((t) => t.hypothesisId === q.hypothesisId).flatMap((t) => t.evidenceIds)
    const ids = new Set([...(hypothesis?.evidenceIds ?? []), ...fromTraces, ...q.constraintIds])
    for (const id of ids) {
      const evidence = evidenceById.get(id)
      if (!evidence) continue
      const registration = registrationFor.get(evidence.frameId)
      say(`    ← ${evidence.value} ${evidence.unit} (${evidence.origin}) on ${evidence.assetId}`)
      say(`        read as "${evidence.rawText}" at ${box(evidence.textBox)}, ${evidence.association.kind}: ${evidence.association.why}`)
      for (const tokenId of evidence.ocrTokenIds) {
        const token = tokenById.get(tokenId)
        if (!token) continue
        say(`        glyphs ${token.glyphs.map((g) => `${g.char}(${g.score.toFixed(2)}/${g.confidence.toFixed(2)}${g.alternatives.length > 0 ? ` alt ${g.alternatives.map((a) => a.char).join('')}` : ''})`).join(' ')}`)
        say(`        token box ${box(token.box)} at ${token.heightPx} px, slant ${token.shearDeg}°, bytes ${token.variantByteHash.slice(0, 16)}`)
      }
      for (const alternative of evidence.alternatives.slice(0, 3)) say(`        rejected "${alternative.rawText}" = ${alternative.value} ${alternative.unit}: ${alternative.why}`)
      if (registration) say(`        sheet registered at ${registration.metresPerPixelX} m/px, residual ${registration.residual.rmsM} m rms over ${registration.anchors.length} anchors, ${registration.rejected.length} rejected`)
    }
    say()
  }

  // --- every facade solid, back to the sightings that proposed it -----------
  say('FACADE LINEAR SOLIDS — the candidates, the depth cues, and what was rejected')
  const solids = candidate.traces.filter((t) => t.kind === 'linearSolid' && (only === undefined || t.objectId === only))
  if (solids.length === 0) say('  (none)')
  for (const trace of solids) {
    const hypothesis = hypothesisById.get(trace.hypothesisId)
    say(`  ${trace.objectId}`)
    say(`    ${trace.why}`)
    if (!hypothesis) continue
    say(`    seen on ${hypothesis.viewSupport} drawing${hypothesis.viewSupport === 1 ? '' : 's'}, ${hypothesis.sightings.length} sighting${hypothesis.sightings.length === 1 ? '' : 's'}, fused from ${hypothesis.provenance.merged}`)
    say(`    rule ${hypothesis.provenance.rule}: ${hypothesis.provenance.detail}`)
    for (const sighting of hypothesis.sightings) say(`      ${sighting.frameId.slice(0, 44)} ${box(sighting.box)} depth ${sighting.depthLayer} confidence ${sighting.confidence}`)
    for (const parameter of hypothesis.parameters) say(`      ${parameter.name} = ${parameter.value} ${parameter.unit} [${parameter.basis}] ${parameter.low}..${parameter.high} — ${parameter.why}`)
    for (const rejected of trace.rejected) say(`      rejected ${rejected.hypothesisId}: ${rejected.why}`)
    say()
  }

  // --- and the holes -------------------------------------------------------
  say('NAMED HOLES — what the sources do not determine')
  const byStatus = new Map<string, number>()
  for (const hole of candidate.unresolved) byStatus.set(hole.status, (byStatus.get(hole.status) ?? 0) + 1)
  say(`  ${[...byStatus].map(([status, count]) => `${count} ${status}`).join(', ')}`)
  for (const hole of candidate.unresolved.filter((h) => h.status !== 'AMBIGUOUS')) say(`  [${hole.status}] ${hole.what}: ${hole.reason}`)

  const report = `${lines.join('\n')}\n`
  process.stdout.write(report)
  await writeFile(join(dir, `${slug}-trace.txt`), report, 'utf8')
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
