/**
 * `npm run observations:audit -- <graph.json>`
 *
 * Reads a sealed observation graph and says whether it is internally
 * consistent, what it covers, and what it admits it does not know. Exits
 * non-zero on any ERROR, so it is usable as a gate.
 *
 * This is deliberately a check on the RECORD, not on the building: it asks
 * whether every observation is on a frame that exists, at coordinates inside
 * the image it names, with a tolerance a solver can use and an id derived from
 * its own content — never whether a roof edge is in the right place. That is
 * the benchmark's question, and it needs the reference model to answer it.
 */
import { readFile } from 'node:fs/promises'
import { SourceObservationGraphSchema, graphHashIsIntact, validateObservationGraph } from '@buildapp/source-observations'
import type { SourceObservationGraph, ValidationIssue } from '@buildapp/source-observations'

export function report(graph: SourceObservationGraph, issues: readonly ValidationIssue[]): string {
  const lines: string[] = []
  const errors = issues.filter((i) => i.severity === 'ERROR')
  const warnings = issues.filter((i) => i.severity === 'WARN')
  lines.push(`graph         ${graph.id}`)
  lines.push(`schema        ${graph.schema} ${graph.schemaVersion}`)
  lines.push(`package       ${graph.sourcePackageId} (${graph.sourcePackageHash.slice(0, 12)})`)
  lines.push(`content hash  ${graph.contentHash}  ${graphHashIsIntact(graph) ? 'intact' : 'STALE'}`)
  lines.push(`extractors    ${graph.extractors.length}`)
  for (const e of graph.extractors) lines.push(`    ${e.kind.padEnd(18)} ${e.name}@${e.version}`)
  lines.push('')
  lines.push(`frames ${graph.coordinateFrames.length}  observations ${graph.observations.length}  relations ${graph.relations.length}  conflicts ${graph.conflicts.length}  gaps ${graph.unresolved.length}`)

  const byExtractorKind = new Map<string, number>()
  for (const o of graph.observations) byExtractorKind.set(o.provenance.extractor, (byExtractorKind.get(o.provenance.extractor) ?? 0) + 1)
  lines.push('')
  lines.push('  who saw what')
  for (const [kind, n] of [...byExtractorKind].sort((a, b) => b[1] - a[1])) lines.push(`    ${kind.padEnd(20)} ${String(n).padStart(5)}`)

  lines.push('')
  lines.push('  coverage, by frame')
  for (const frame of graph.coordinateFrames) {
    const own = graph.observations.filter((o) => o.frameId === frame.id)
    const kinds = new Set(own.map((o) => o.kind))
    lines.push(`    ${`${frame.roles.document}/${frame.roles.view}/${frame.roles.storey}`.padEnd(46)} ${String(own.length).padStart(5)} observations, ${kinds.size} kinds, ${frame.size.width}x${frame.size.height}`)
  }

  const gapsByStatus = new Map<string, number>()
  for (const g of graph.unresolved) gapsByStatus.set(g.status, (gapsByStatus.get(g.status) ?? 0) + 1)
  lines.push('')
  lines.push('  what it says it does not know')
  for (const [status, n] of [...gapsByStatus].sort()) lines.push(`    ${status.padEnd(16)} ${String(n).padStart(4)}`)
  for (const g of graph.unresolved.slice(0, 12)) lines.push(`      [${g.status}] ${g.what} — ${g.reason}`)
  if (graph.unresolved.length > 12) lines.push(`      … and ${graph.unresolved.length - 12} more`)

  if (graph.conflicts.length > 0) {
    lines.push('')
    lines.push('  readings that cannot both be right (recorded, never averaged)')
    for (const c of graph.conflicts) lines.push(`    [${c.kind}] ${c.what}${c.magnitude !== undefined ? ` — ${c.magnitude} ${c.unit ?? ''}` : ''}`)
  }

  lines.push('')
  lines.push(`  validation: ${errors.length} error(s), ${warnings.length} warning(s)`)
  for (const i of [...errors, ...warnings].slice(0, 30)) lines.push(`    ${i.severity.padEnd(5)} [${i.code}] ${i.subject}: ${i.message}`)
  return lines.join('\n')
}

export async function main(argv: readonly string[]): Promise<number> {
  const path = argv.find((a) => a.endsWith('.json'))
  if (!path) {
    process.stderr.write('usage: observations:audit -- <graph.json>\n')
    return 2
  }
  const graph = SourceObservationGraphSchema.parse(JSON.parse(await readFile(path, 'utf8')))
  const issues = validateObservationGraph(graph, { checkIds: true, checkHash: true })
  process.stdout.write(`${report(graph, issues)}\n`)
  return issues.some((i) => i.severity === 'ERROR') ? 1 : 0
}

// Run directly: `vite-node <this file> -- <args>`. Under vitest the module is
// imported for its exports and must not run.
if (!process.env.VITEST) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: Error) => {
      process.stderr.write(`${err.stack ?? err.message}\n`)
      process.exit(1)
    },
  )
}
