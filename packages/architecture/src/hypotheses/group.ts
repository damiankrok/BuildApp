/**
 * OBSERVATION → groups: which proposals are one physical feature.
 *
 * Proposals that share a `featureKey` are one feature seen from several
 * frames. The rest are grouped by position: two proposals whose plan extents
 * come within `reach` of each other belong together (union-find, so the
 * result does not depend on order). A value (a printed dimension) has no
 * position and joins only through its key; a value with no key belongs to
 * no feature and is reported unused.
 */
import type { SemanticProposal } from '../proposals.js'
import { pointsOf } from './geometry.js'
import type { FeatureGroup } from './types.js'

export function groupProposals(proposals: readonly SemanticProposal[], reach = 0.3): { groups: FeatureGroup[]; unused: string[] } {
  const sorted = [...proposals].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const parent = new Map<string, string>(sorted.map((p) => [p.id, p.id]))
  const find = (id: string): string => {
    let r = id
    while (parent.get(r) !== r) r = parent.get(r) as string
    parent.set(id, r)
    return r
  }
  const union = (a: string, b: string): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    if (ra < rb) parent.set(rb, ra)
    else parent.set(ra, rb)
  }
  const byKey = new Map<string, string>()
  for (const p of sorted) {
    if (!p.featureKey) continue
    const first = byKey.get(p.featureKey)
    if (first) union(first, p.id)
    else byKey.set(p.featureKey, p.id)
  }
  const extent = (p: SemanticProposal): { x0: number; x1: number; z0: number; z1: number } | null => {
    const pts = pointsOf(p.geometry)
    if (pts.length === 0) return null
    return { x0: Math.min(...pts.map((q) => q.x)), x1: Math.max(...pts.map((q) => q.x)), z0: Math.min(...pts.map((q) => q.z)), z1: Math.max(...pts.map((q) => q.z)) }
  }
  const loose = sorted.filter((p) => !p.featureKey)
  for (let i = 0; i < loose.length; i++) {
    const a = extent(loose[i])
    if (!a) continue
    for (let j = i + 1; j < loose.length; j++) {
      const b = extent(loose[j])
      if (!b) continue
      if (a.x0 - reach <= b.x1 && b.x0 - reach <= a.x1 && a.z0 - reach <= b.z1 && b.z0 - reach <= a.z1) union(loose[i].id, loose[j].id)
    }
  }
  const members = new Map<string, SemanticProposal[]>()
  for (const p of sorted) {
    const r = find(p.id)
    members.set(r, [...(members.get(r) ?? []), p])
  }
  const groups: FeatureGroup[] = []
  const unused: string[] = []
  for (const [root, ps] of [...members.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (ps.every((p) => p.geometry.type === 'VALUE') && !ps.some((p) => p.featureKey)) {
      unused.push(...ps.map((p) => p.id))
      continue
    }
    const key = ps.find((p) => p.featureKey)?.featureKey
    groups.push({ id: `g-${key ?? root}`, ...(key ? { featureKey: key } : {}), proposalIds: ps.map((p) => p.id), frames: [...new Set(ps.map((p) => p.sourceFrameId))].sort() })
  }
  return { groups, unused }
}
