/**
 * ASSEMBLY GRAPH export — a developer artifact.
 *
 * `assemblyTree` writes each assembly with its components indented under it
 * (nested assemblies expanded: a dormer shows its walls, its local roof and
 * that roof's planes), then the primitives no assembly holds; `assemblyGraph`
 * writes the same as nodes and edges (COMPONENT, HOST and every typed
 * relationship) for a machine to read.
 */
import { HOST_REFERENCE_FIELDS, assemblyComponents, assemblyReferences, findObject, type Assembly, type CanonicalBuildingModel } from '@buildapp/model'
import { primitivesOf } from '../registry/primitives.js'

export function assemblyTree(m: CanonicalBuildingModel): string {
  const byId = new Map(m.assemblies.map((a) => [a.id, a]))
  const types = new Map<string, string>()
  for (const p of primitivesOf(m)) if (p.id === p.objectId && !types.has(p.id)) types.set(p.id, p.type)
  const lines: string[] = []
  const nested = new Set(m.assemblies.flatMap((a) => assemblyComponents(a).filter((r) => byId.has(r.id)).map((r) => r.id)))
  const write = (a: Assembly, depth: number, seen: Set<string>): void => {
    const pad = '  '.repeat(depth)
    lines.push(`${pad}${a.id} [${a.kind}${a.kind === 'ROOF' ? ` ${a.classification}` : ''}, ${a.quality}${a.missing?.length ? `; missing ${a.missing.join(', ')}` : ''}${a.alternatives?.length ? `; or ${a.alternatives.map((x) => `${x.kind} ${x.confidence}`).join(', ')}` : ''}]`)
    if (seen.has(a.id)) return
    seen.add(a.id)
    for (const r of assemblyReferences(a)) {
      const inner = byId.get(r.id)
      const host = HOST_REFERENCE_FIELDS.has(r.field)
      if (inner && !host) {
        write(inner, depth + 1, seen)
        continue
      }
      const kind = findObject(m, r.id)?.kind ?? '?'
      lines.push(`${pad}  ${r.id} (${host ? `host: ${r.field}` : types.get(r.id) ?? kind})`)
    }
    if (a.kind === 'UNKNOWN') lines.push(`${pad}  ! ${a.unresolvedReason}`)
  }
  for (const a of [...m.assemblies].sort((x, y) => (x.id < y.id ? -1 : 1))) if (!nested.has(a.id)) write(a, 0, new Set())
  const inAssembly = new Set(m.assemblies.flatMap((a) => assemblyComponents(a).map((r) => r.id)))
  const loose = primitivesOf(m).filter((p) => p.id === p.objectId && !inAssembly.has(p.id))
  if (loose.length > 0) {
    lines.push('')
    lines.push(`(in no assembly: ${loose.length} primitives)`)
    for (const p of loose) lines.push(`  ${p.id} (${p.type})`)
  }
  return `${lines.join('\n')}\n`
}

export type AssemblyGraph = {
  nodes: Array<{ id: string; kind: string; type?: string }>
  edges: Array<{ from: string; to: string; kind: string; field?: string }>
}

export function assemblyGraph(m: CanonicalBuildingModel): AssemblyGraph {
  const nodes = new Map<string, { id: string; kind: string; type?: string }>()
  const edges: AssemblyGraph['edges'] = []
  const node = (id: string): void => {
    if (nodes.has(id)) return
    const hit = findObject(m, id)
    const a = m.assemblies.find((x) => x.id === id)
    nodes.set(id, { id, kind: hit?.kind ?? 'unknown', ...(a ? { type: a.kind } : {}) })
  }
  const types = new Map<string, string>()
  for (const p of primitivesOf(m)) if (p.id === p.objectId && !types.has(p.id)) types.set(p.id, p.type)
  for (const a of m.assemblies) {
    node(a.id)
    for (const r of assemblyReferences(a)) {
      node(r.id)
      edges.push({ from: a.id, to: r.id, kind: HOST_REFERENCE_FIELDS.has(r.field) ? 'HOST' : 'COMPONENT', field: r.field })
    }
  }
  for (const r of m.relationships) {
    node(r.from)
    node(r.to)
    edges.push({ from: r.from, to: r.to, kind: r.kind })
  }
  for (const n of nodes.values()) if (!n.type && types.has(n.id)) n.type = types.get(n.id)
  return {
    nodes: [...nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
    edges: edges.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : a.to > b.to ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0)),
  }
}
