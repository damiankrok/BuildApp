/**
 * BUILDPLAN-ANALYZER-005I post-review D1: from schema 1.7.0 the metric evidence hash covers what reconstruction reads
 * of the dimension topology — each mark's class and reasons, whether a segment carries a bound number, the chain's
 * place among its neighbours — and every frame's topology record. Two sets that would build different frames may not
 * share a hash. A set sealed before 1.7.0 hashes exactly as it always did.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { metricEvidenceContentHash } from '../src/index.js'
import type { MetricEvidenceSet } from '../src/index.js'

const ROOT = resolve(import.meta.dirname, '../../..')
const sealed = (): MetricEvidenceSet => JSON.parse(readFileSync(join(ROOT, 'stage-reports/artifacts/analyzer-005f/holdout/h1-dom-pod-milorzebem/metric-evidence.json'), 'utf8')) as MetricEvidenceSet
const draftOf = (set: MetricEvidenceSet): Omit<MetricEvidenceSet, 'id' | 'contentHash'> => {
  const { id: _id, contentHash: _hash, ...draft } = set
  return draft
}

describe('the metric evidence hash and the dimension topology (post-review D1)', () => {
  it('a set sealed before 1.7.0 hashes as it was sealed', () => {
    const set = sealed()
    expect(set.schemaVersion).toBe('1.5.0')
    expect(metricEvidenceContentHash(draftOf(set))).toBe(set.contentHash)
  })

  it('from 1.7.0, a mark class, a bound number, a chain topology or a topology record each change the hash', () => {
    const base = { ...draftOf(sealed()), schemaVersion: '1.7.0' as const, dimensionTopology: [] }
    const reference = metricEvidenceContentHash(base)
    const chainIndex = base.chains.findIndex((c) => (c.marks?.length ?? 0) > 0 && c.segments.length > 0)
    expect(chainIndex).toBeGreaterThanOrEqual(0)
    const withChain = (f: (c: MetricEvidenceSet['chains'][number]) => MetricEvidenceSet['chains'][number]) => ({ ...base, chains: base.chains.map((c, i) => (i === chainIndex ? f(c) : c)) })
    const mark = withChain((c) => ({ ...c, marks: (c.marks ?? []).map((m, i) => (i === 0 ? { ...m, class: m.class === 'REJECTED' ? ('TICK' as const) : ('REJECTED' as const) } : m)) }))
    const labelled = withChain((c) => ({ ...c, segments: c.segments.map((s, i) => (i === 0 ? (s.labelled ? { ...s, labelled: undefined } : { ...s, labelled: true as const }) : s)) }))
    const topology = withChain((c) => ({ ...c, topology: { groupId: 'g', roles: ['OVERALL' as const], alignedEnds: [true, false] as [boolean, boolean] } }))
    const record = { ...base, dimensionTopology: [{ frameId: 'f', labelHeightPx: 14, labelInkMarks: [], labelInkLines: [], groups: [], assignment: { legacy: [] }, sideConventions: { legacy: { HORIZONTAL: { side: 'BEFORE' as const, basis: 'SILENT' as const, anchors: { before: 0, across: 0, after: 0 } }, VERTICAL: { side: 'BEFORE' as const, basis: 'SILENT' as const, anchors: { before: 0, across: 0, after: 0 } } } } }] }
    for (const changed of [mark, labelled, topology, record]) expect(metricEvidenceContentHash(changed)).not.toBe(reference)
    // and the same content hashes the same
    expect(metricEvidenceContentHash({ ...base })).toBe(reference)
  })
})
