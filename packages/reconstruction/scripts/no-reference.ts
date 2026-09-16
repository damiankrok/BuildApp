/**
 * `npm run reconstruct:no-reference`
 *
 * §24's proof, executed rather than argued: move the reference package out of
 * the tree, run the whole candidate path, and put it back.
 *
 * The architecture tests already read every production source and fail on an
 * import of `@buildapp/reference-*`. This does the same thing from the other
 * end — if anything in the path reaches for the reference at RUN time, through
 * a dynamic import, a lazy require, or a JSON file read off disk, the module
 * simply will not be there and the run fails loudly.
 *
 * Running is not enough, though. A pass that reached for the reference and
 * silently fell back to a bounding box would also "run". So the layout the run
 * produced is read back afterwards and held to the STRUCTURE it is supposed to
 * find: more than one body, storeys that do not all cover the same footprint,
 * a roof per body. Those are properties of a decomposition, not figures from
 * any particular building, and they are exactly what is lost when a solver
 * gives up and draws one rectangle.
 *
 * The move is restored in a `finally`, and the script refuses to start if a
 * previous run left the tree in a half-moved state.
 */
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../../..')
const REFERENCE = join(ROOT, 'packages/reference-marcowki')
const HIDDEN = join(ROOT, 'packages/.reference-marcowki.hidden')

function main(): void {
  if (existsSync(HIDDEN)) throw new Error(`${HIDDEN} already exists: a previous run did not restore the tree, and this script will not guess which copy is current`)
  if (!existsSync(REFERENCE)) throw new Error(`${REFERENCE} is not there to hide`)

  process.stdout.write('hiding packages/reference-marcowki\n')
  renameSync(REFERENCE, HIDDEN)
  let code = 1
  try {
    const args = process.argv.slice(2)
    const result = spawnSync(
      'npx',
      [
        'vite-node',
        'packages/reconstruction/scripts/reconstruct.ts',
        '--',
        ...(args.length > 0
          ? args
          : [
              '--package',
              'stage-reports/artifacts/source-observations/marcowki-source-package.json',
              '--graph',
              'stage-reports/artifacts/source-observations/marcowki-observation-graph.json',
              '--slug',
              'no-reference',
              '--label',
              'Candidate built with no reference package present',
              '--out',
              join(ROOT, '.cache', 'no-reference'),
            ]),
      ],
      { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' },
    )
    code = result.status ?? 1
  } finally {
    renameSync(HIDDEN, REFERENCE)
    process.stdout.write('restored packages/reference-marcowki\n')
  }
  if (code !== 0) throw new Error(`the candidate path failed with the reference package absent (exit ${code})`)
  process.stdout.write('\nthe candidate was produced with no reference package in the tree\n')

  // --- and what it produced is a decomposition, not a box --------------------
  const layoutPath = join(ROOT, '.cache', 'no-reference', 'no-reference-layout.json')
  if (!existsSync(layoutPath)) throw new Error(`the run wrote no layout to ${layoutPath}`)
  const layout = JSON.parse(readFileSync(layoutPath, 'utf8')) as {
    gate: { status: string; reasons: Array<{ severity: string; code: string; what: string }> }
    masses: Array<{ id: string; role: string; ring: { points: Array<{ x: number; z: number }> }; storeySpan: { fromIndex: number; toIndex: number } }>
    roofSupports: Array<{ id: string; massId: string; kind: string }>
    storeys: Array<{ id: string; index: number }>
  }
  const size = (mass: (typeof layout.masses)[number]): [number, number] => {
    const xs = mass.ring.points.map((p) => p.x)
    const zs = mass.ring.points.map((p) => p.z)
    return [Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)]
  }
  process.stdout.write(`gate ${layout.gate.status}\n`)
  for (const mass of layout.masses) {
    const [w, d] = size(mass)
    process.stdout.write(`  ${mass.id} ${mass.role} ${w.toFixed(2)} x ${d.toFixed(2)} m, storeys ${mass.storeySpan.fromIndex}..${mass.storeySpan.toIndex}, roof ${layout.roofSupports.find((r) => r.massId === mass.id)?.kind ?? 'NONE'}\n`)
  }
  const complaints: string[] = []
  if (layout.masses.length < 2) complaints.push(`only ${layout.masses.length} body was found: the pass collapsed to a single mass`)
  if (layout.roofSupports.length !== layout.masses.length) complaints.push(`${layout.roofSupports.length} roofs over ${layout.masses.length} bodies: a roof belongs to a body`)
  if (new Set(layout.masses.map((m) => `${m.storeySpan.fromIndex}-${m.storeySpan.toIndex}`)).size < 2) complaints.push('every body reaches the same storeys, so no storey-specific footprint was recovered')
  if (new Set(layout.roofSupports.map((r) => r.kind)).size < 2) complaints.push('every body carries the same kind of roof, so no separate roof system was recovered')
  if (layout.gate.status === 'STRUCTURAL_LAYOUT_REJECTED') complaints.push(`the gate rejected the layout: ${layout.gate.reasons.map((r) => `${r.severity} ${r.code}`).join(', ')}`)
  if (complaints.length > 0) throw new Error(`the reference was absent and so was the structure:\n  - ${complaints.join('\n  - ')}`)
  process.stdout.write(`${layout.masses.length} bodies, ${new Set(layout.roofSupports.map((r) => r.kind)).size} kinds of roof, ${layout.storeys.length} storeys — all of it read with no reference in the tree\n`)
}

try {
  main()
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
