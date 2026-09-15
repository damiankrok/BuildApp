/**
 * `npm run reconstruct:marcowki`
 *
 * Evaluation, and nothing else.
 *
 * This script runs AFTER the candidate has been sealed. It reads the sealed
 * artifact off disk, builds the hand-authored reference model beside it, and
 * measures the distance between them. That ordering is the whole point of §2:
 * the reference may be imported here because nothing here can reach the
 * solver, and the candidate it scores was produced without any of it.
 *
 * The two headline numbers are reported SEPARATELY and always will be. A
 * reconstruction that builds a quarter of a house perfectly and a
 * reconstruction that builds all of it badly are different failures, and one
 * number cannot tell them apart.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stableJson } from '@buildapp/source-common'
import { createMarcowkiReferenceBuilding } from '@buildapp/reference-marcowki'
import { ReconstructionCandidateSchema, evaluateCandidate, verifyReplay } from '../src/index.js'
import type { ReconstructionCandidate } from '../src/index.js'

const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const dir = value(argv, 'dir') ?? join(process.cwd(), 'stage-reports', 'artifacts', 'reconstruction')
  const slug = value(argv, 'slug') ?? 'marcowki'
  await mkdir(dir, { recursive: true })

  const raw = JSON.parse(await readFile(join(dir, `${slug}-candidate.json`), 'utf8')) as unknown
  const parsed = ReconstructionCandidateSchema.safeParse(raw)
  if (!parsed.success) throw new Error(`the sealed candidate does not validate: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
  const candidate = raw as ReconstructionCandidate

  // The candidate's own program is the only way to its model, here as anywhere.
  const replay = verifyReplay(candidate)
  if (!replay.ok) throw new Error(`the sealed candidate does not replay: ${replay.reason}`)
  const reference = createMarcowkiReferenceBuilding()

  const evaluation = evaluateCandidate(candidate, replay.model, reference)
  await writeFile(join(dir, `${slug}-evaluation.json`), `${stableJson(evaluation)}\n`, 'utf8')

  const lines: string[] = []
  lines.push(`candidate    ${candidate.id}`)
  lines.push(`model        ${candidate.modelHash.slice(0, 16)} (replayed byte-identically)`)
  lines.push(`reference    ${reference.id}`)
  lines.push('')
  lines.push('SHELL')
  for (const s of evaluation.shell) {
    const got = s.candidate === undefined ? '—' : s.candidate.toFixed(3)
    const err = s.error === undefined ? '' : ` (${s.error >= 0 ? '+' : ''}${s.error.toFixed(3)} ${s.unit}${s.relative === undefined ? '' : `, ${pct(s.relative)}`})`
    lines.push(`  ${s.name.padEnd(18)} ${got.padStart(9)} vs ${s.reference.toFixed(3).padStart(9)} ${s.unit}${err}${s.class ? `  [${s.class}]` : ''}`)
  }
  lines.push('')
  lines.push('TOPOLOGY')
  lines.push(`  levels   ${evaluation.topology.candidateLevels} vs ${evaluation.topology.referenceLevels}`)
  lines.push(`  walls    ${evaluation.topology.candidateWalls} vs ${evaluation.topology.referenceWalls}`)
  lines.push(`  roofs    ${evaluation.topology.candidateRoofs} vs ${evaluation.topology.referenceRoofs}`)
  lines.push('')
  lines.push('OPENINGS')
  lines.push(`  ${evaluation.openings.matched} of ${evaluation.openings.reference} reference openings matched; ${evaluation.openings.spurious} built that the reference has nothing for`)
  lines.push(`  position ${evaluation.openings.positionRmsM.toFixed(3)} m rms, size ${evaluation.openings.sizeRmsM.toFixed(3)} m rms`)
  lines.push('')
  lines.push('FACADE LINEAR SOLIDS')
  if (evaluation.linearSolids.notComparable) lines.push(`  the reference carries no linear solids, so the candidate's ${evaluation.linearSolids.candidate} cannot be scored against it — they are judged against the source observations and the owner's findings instead`)
  else lines.push(`  ${evaluation.linearSolids.matched} of ${evaluation.linearSolids.reference} reference solids matched; ${evaluation.linearSolids.spurious} spurious; centres ${evaluation.linearSolids.centreRmsM.toFixed(3)} m rms`)
  lines.push('')
  lines.push('HONESTY')
  lines.push(`  ${evaluation.honesty.unresolvedCount} named holes, ${evaluation.honesty.justified} of them MISSING or REFUSED outright`)
  lines.push(`  ${evaluation.honesty.hardCorrect} of ${evaluation.honesty.hardQuantities} quantities settled as HARD are within a centimetre of the reference`)
  lines.push(`  ${evaluation.honesty.assumed} quantities fell back on a building convention`)
  lines.push('')
  lines.push('SCORES, reported separately and never combined')
  lines.push(`  geometric accuracy               ${pct(evaluation.scores.geometricAccuracy)}  — of what it built, how close it is`)
  lines.push(`  evidence-supported completeness  ${pct(evaluation.scores.evidenceSupportedCompleteness)}  — of the building, how much it built at all`)
  const report = `${lines.join('\n')}\n`
  process.stdout.write(report)
  await writeFile(join(dir, `${slug}-evaluation.txt`), report, 'utf8')
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
