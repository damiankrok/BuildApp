/**
 * `npm run reconstruct:no-benchmark`
 *
 * §26's proof for the v2 analyzer, executed rather than argued: move every
 * benchmark package out of the tree — the reference package, any package
 * whose name says `source-truth` or `reference-`, and the `research/`
 * directory — run the whole v2 candidate path, and put them back.
 *
 * The architecture tests already read every production source and fail on an
 * import of a reference package, a source-truth package or anything under
 * `research/`. This does the same thing from the other end: if anything on
 * the v2 path reaches for a benchmark at RUN time, through a dynamic import,
 * a lazy require or a JSON file read off disk, the module simply will not be
 * there and the run fails loudly.
 *
 * Running is not enough, though. A pass that reached for the benchmark and
 * silently fell back to a box would also "run". So the building the run
 * produced is read back afterwards and held to the STRUCTURE it is supposed
 * to find: more than one body, a recess with a return, a storey of
 * partitions with a door and rooms, a stair, an opening with a callout, a
 * main roof, and a candidate that replays. Those are properties of a
 * decomposition, not figures from any particular building.
 *
 * The moves are restored in a `finally`, and the script refuses to start if a
 * previous run left the tree in a half-moved state.
 */
import { existsSync, readFileSync, readdirSync, renameSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { basename, dirname, join, resolve } from 'node:path'
import { verifyReplay } from '@buildapp/reconstruction'
import type { BuildingV2, ReconstructionCandidate } from '@buildapp/reconstruction'

const ROOT = resolve(import.meta.dirname, '../../..')
const PACKAGES = join(ROOT, 'packages')
const OUT = join(ROOT, '.cache', 'no-benchmark')

type Hideable = { path: string; hidden: string; label: string; required: boolean }

/** Everything that may know the benchmark: the reference package by name, every package named for it, and the research tree. */
function benchmarkDirs(): Hideable[] {
  const out: Hideable[] = []
  const seen = new Set<string>()
  const add = (path: string, required: boolean): void => {
    if (seen.has(path)) return
    seen.add(path)
    out.push({ path, hidden: join(dirname(path), `.${basename(path)}.hidden`), label: path.slice(ROOT.length + 1), required })
  }
  add(join(PACKAGES, 'reference-marcowki'), true)
  for (const name of readdirSync(PACKAGES).sort()) {
    if (name.startsWith('.')) continue
    if (!(name.includes('source-truth') || name.includes('reference-'))) continue
    if (statSync(join(PACKAGES, name)).isDirectory()) add(join(PACKAGES, name), false)
  }
  add(join(ROOT, 'research'), false)
  return out
}

function main(): void {
  const all = benchmarkDirs()
  const stale = all.filter((d) => existsSync(d.hidden))
  if (stale.length > 0) throw new Error(`${stale.map((d) => d.hidden).join(', ')} already exist${stale.length === 1 ? 's' : ''}: a previous run did not restore the tree, and this script will not guess which copy is current`)
  const missingRequired = all.filter((d) => d.required && !existsSync(d.path))
  if (missingRequired.length > 0) throw new Error(`${missingRequired.map((d) => d.path).join(', ')} is not there to hide`)
  const toHide = all.filter((d) => existsSync(d.path))
  for (const d of all.filter((x) => !existsSync(x.path))) process.stdout.write(`${d.label} is not in the tree; nothing to hide\n`)

  const hidden: Hideable[] = []
  let code = 1
  try {
    for (const d of toHide) {
      process.stdout.write(`hiding ${d.label}\n`)
      renameSync(d.path, d.hidden)
      hidden.push(d)
    }
    const args = process.argv.slice(2)
    const result = spawnSync(
      'npx',
      [
        'vite-node',
        'packages/analysis-service/scripts/reconstruct-v2.ts',
        '--',
        ...(args.length > 0
          ? args
          : [
              '--package',
              'stage-reports/artifacts/source-observations/marcowki-source-package.json',
              '--graph',
              'stage-reports/artifacts/source-observations/marcowki-observation-graph.json',
              '--slug',
              'no-benchmark',
              '--label',
              'Candidate built with no benchmark packages present',
              '--out',
              OUT,
            ]),
      ],
      { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' },
    )
    code = result.status ?? 1
  } finally {
    const unrestored: string[] = []
    for (const d of [...hidden].reverse()) {
      try {
        renameSync(d.hidden, d.path)
        process.stdout.write(`restored ${d.label}\n`)
      } catch (error: unknown) {
        unrestored.push(`${d.hidden} → ${d.path}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    if (unrestored.length > 0) {
      process.stderr.write(`COULD NOT RESTORE THE TREE:\n  ${unrestored.join('\n  ')}\n`)
      process.exitCode = 1
    }
  }
  if (code !== 0) throw new Error(`the v2 candidate path failed with the benchmark packages absent (exit ${code})`)
  process.stdout.write(`\nthe v2 candidate was produced with ${hidden.length} benchmark director${hidden.length === 1 ? 'y' : 'ies'} out of the tree: ${hidden.map((d) => d.label).join(', ')}\n`)

  // --- and what it produced is a building, not a box --------------------------
  const buildingPath = join(OUT, 'no-benchmark-building.json')
  const candidatePath = join(OUT, 'no-benchmark-auto-v2.json')
  if (!existsSync(buildingPath)) throw new Error(`the run wrote no building to ${buildingPath}`)
  if (!existsSync(candidatePath)) throw new Error(`the run wrote no candidate to ${candidatePath}`)
  const b = JSON.parse(readFileSync(buildingPath, 'utf8')) as BuildingV2
  const candidate = JSON.parse(readFileSync(candidatePath, 'utf8')) as ReconstructionCandidate

  const recessesWithReturns = b.recesses.filter((r) => r.returns.length >= 1)
  const storeysWithInterior = b.interior.filter((i) => i.walls.length >= 1 && i.doors.length >= 1 && i.rooms.length >= 2)
  const calloutOpenings = [...b.openings, ...b.sharedDoors].filter((o) => o.callout !== undefined)
  const replay = verifyReplay(candidate)

  for (const mass of b.masses) process.stdout.write(`  ${mass.id} ${mass.role} ${(mass.x1 - mass.x0).toFixed(2)} x ${(mass.z1 - mass.z0).toFixed(2)} m, storeys ${mass.storeys.join(',')}\n`)
  process.stdout.write(`  ${b.recesses.length} recesses (${recessesWithReturns.length} with returns), ${b.returns.length} return walls\n`)
  for (const i of b.interior) process.stdout.write(`  storey ${i.storeyIndex}: ${i.walls.length} partitions, ${i.doors.length} doors, ${i.rooms.length} rooms\n`)
  process.stdout.write(`  stair ${b.stair ? `${b.stair.hypothesis.turnKind}, ${b.stair.hypothesis.flights.length} flights, emitted as ${b.stair.emit}` : 'NONE'}\n`)
  process.stdout.write(`  ${b.openings.length} openings (+${b.sharedDoors.length} shared), ${calloutOpenings.length} carrying a callout\n`)
  process.stdout.write(`  main roof ${b.mainRoof ? `${b.mainRoof.kind} along ${b.mainRoof.ridgeAxis}${b.mainRoof.coversZones ? ', covering the zones' : ''}` : 'NONE'}, ${b.attachedRoofs.length} attached\n`)
  process.stdout.write(`  candidate ${candidate.program.length} commands, replay ${replay.ok ? 'byte-identical' : `FAILED: ${replay.reason}`}\n`)

  const complaints: string[] = []
  if (b.masses.length < 2) complaints.push(`only ${b.masses.length} body was found: the pass collapsed to a single mass`)
  if (recessesWithReturns.length === 0) complaints.push(`${b.recesses.length} recess readings and none with a return wall: no recess topology was recovered`)
  if (storeysWithInterior.length === 0) complaints.push('no storey has partitions with a door and at least two rooms: no interior was read')
  if (!b.stair) complaints.push('no stair hypothesis: the tread ladders were not found')
  if (calloutOpenings.length === 0) complaints.push('no opening carries a callout: the printed sizes were not matched to the plan gaps')
  if (!b.mainRoof) complaints.push('no main roof was solved')
  if (!replay.ok) complaints.push(`the candidate does not replay: ${replay.reason}`)
  if (complaints.length > 0) throw new Error(`the benchmark was absent and so was the structure:\n  - ${complaints.join('\n  - ')}`)
  process.stdout.write(`${b.masses.length} bodies, ${recessesWithReturns.length} recesses with returns, ${storeysWithInterior.length} storeys of interior, a stair, ${calloutOpenings.length} called-out openings, a main roof and a replaying candidate — all of it read with no benchmark package in the tree\n`)
}

try {
  main()
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
