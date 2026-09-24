/**
 * The whole pipeline, run on a house that exists only in this repository.
 *
 * Every test in this package works from here rather than from a published
 * project, for one reason: the answer is known. A reconstruction measured
 * against a hand-built reference tells you how close two people's judgement
 * are; a reconstruction measured against the spec its own drawings were
 * rendered from tells you whether the pipeline reads drawings.
 *
 * The sheets go in as PNG BYTES through a real source package, so nothing is
 * injected halfway down: the acquisition contract, the analyzer, the metric
 * reader and the solver all run exactly as they do on a real project.
 */
import { sha256Bytes } from '@buildapp/source-common'
import { decodeImage } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { analyzeSourcePackage } from '@buildapp/source-analyzer'
import { extractMetricEvidence } from '@buildapp/source-metrics'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import { LARCHFIELD, renderSheets } from '@buildapp/synthetic-drawings'
import type { SheetOptions, SyntheticHouse } from '@buildapp/synthetic-drawings'
import { reconstruct } from '../src/index.js'
import type { ReconstructionResult } from '../src/index.js'

export type Fixture = {
  pkg: SourcePackage
  graph: SourceObservationGraph
  metrics: MetricEvidenceSet
  bytesByUrl: Map<string, Uint8Array>
}

const PROJECTION: Record<string, string> = { FLOOR_PLAN: 'ORTHOGRAPHIC_PLAN', SECTION: 'ORTHOGRAPHIC_SECTION', ELEVATION: 'ORTHOGRAPHIC_ELEVATION' }

/** Build the package, analyse it and read its metrics. Everything downstream starts from the result. */
export async function buildFixture(house: SyntheticHouse = LARCHFIELD, options: SheetOptions = {}, only?: (slug: string) => boolean, published: PublishedFacts = {}): Promise<Fixture> {
  return buildFixtureFrom(renderSheets(house, options).filter((s) => (only ? only(s.slug) : true)), published)
}

/** What the publisher's page says besides the drawings: for now the room list, which the v2 interior pass corroborates its rooms against. */
export type PublishedFacts = { rooms?: SourcePackage['publishedRooms'] }

/**
 * The same, from a sheet list somebody else assembled.
 *
 * A mutation is very often ONE sheet drawn differently — an upper plan that
 * shows a garage the ground plan does not, an elevation printed back to front
 * — and expressing that means building the package from sheets that did not
 * all come from the same spec.
 */
export async function buildFixtureFrom(sheets: ReturnType<typeof renderSheets>, published: PublishedFacts = {}): Promise<Fixture> {
  const bytesByUrl = new Map<string, Uint8Array>()
  const assets = sheets.map((s) => {
    const url = `https://synthetic.invalid/${s.slug}.png`
    bytesByUrl.set(url, s.bytes)
    return {
      id: `asset-${s.slug}`,
      roles: { document: s.document, storey: s.storey, annotation: s.document === 'FLOOR_PLAN' ? 'DIMENSIONED' : 'UNKNOWN', view: s.view, projection: PROJECTION[s.document] },
      roleEvidence: [{ field: 'document', value: s.document, why: 'the fixture states it', source: 'FIXTURE', confidence: 1 }],
      variants: [{ id: `v-${s.slug}`, url, discoveredVia: 'fixture', mediaType: 'image/png', byteLength: s.bytes.length, byteHash: s.byteHash, decoded: { width: s.width, height: s.height }, declaredMismatch: false, aspect: Number((s.width / s.height).toFixed(6)) }],
      selectedVariantId: `v-${s.slug}`,
      selectionReason: 'the only rendering',
    }
  })
  const pkg = {
    schema: 'buildapp.source-package',
    schemaVersion: '1.0.0',
    id: 'pkg-larchfield',
    canonicalUrl: 'https://synthetic.invalid/larchfield',
    pageHash: sha256Bytes(new Uint8Array([1])),
    project: { publisher: 'synthetic-fixture', name: 'synthetic' },
    adapter: { id: 'fixture', version: '1' },
    assets,
    publishedFacts: [],
    publishedSpecifications: [],
    publishedRooms: published.rooms ?? [],
    failures: [],
    contentHash: sha256Bytes(new Uint8Array([2])),
  } as unknown as SourcePackage

  const analysis = await analyzeSourcePackage(pkg, { bytes: async (url: string) => { const b = bytesByUrl.get(url); return b ? { bytes: b, mediaType: 'image/png' } : null } })
  const metrics = extractMetricEvidence({
    sourcePackageId: pkg.id,
    sourcePackageHash: pkg.contentHash,
    graph: analysis.graph,
    slug: 'larchfield',
    raster: (frame) => {
      const asset = pkg.assets.find((a) => a.id === frame.assetId)
      const bytes = asset ? bytesByUrl.get(asset.variants[0].url) : undefined
      return bytes ? decodeImage(bytes) : undefined
    },
  })
  return { pkg, graph: analysis.graph, metrics, bytesByUrl }
}

/** Reconstruct from a fixture, optionally after mutating what it saw. */
export function solve(fixture: Fixture, mutate?: (f: Fixture) => Fixture): ReconstructionResult {
  const f = mutate ? mutate(fixture) : fixture
  return reconstruct({
    label: 'Larchfield (auto)',
    slug: 'larchfield',
    sourcePackageId: f.pkg.id,
    sourcePackageHash: f.pkg.contentHash,
    graph: f.graph,
    metrics: f.metrics,
    raster: (frame) => {
      const asset = f.pkg.assets.find((a) => a.id === frame.assetId)
      const bytes = asset ? f.bytesByUrl.get(asset.variants[0].url) : undefined
      return bytes ? decodeImage(bytes) : undefined
    },
  })
}

/** The value of one solved quantity, for a test that cares about a number. */
export const quantity = (result: ReconstructionResult, parameter: string): { value: number; class: string } | undefined => {
  const q = result.candidate.quantities.find((x) => x.parameter === parameter)
  return q ? { value: q.value, class: q.class } : undefined
}

export const deepCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
