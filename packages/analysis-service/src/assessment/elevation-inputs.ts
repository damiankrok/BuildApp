/**
 * N9-02A: the printed datums an elevation is hung from, read as the solver reads them (`reconstruct-v2.ts`): the
 * section's highest datum is the ridge (`levelsFrom(...).topDatum`), and the terrain is the most confident small
 * negative level datum.
 */
import { levelsFrom } from '@buildapp/reconstruction'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'

export function terrainDatumOf(metrics: Pick<MetricEvidenceSet, 'evidence'>): number | undefined {
  return metrics.evidence.filter((e) => e.kind === 'LEVEL_DATUM' && e.value < 0 && e.value > -1.5).sort((a, b) => b.confidence - a.confidence)[0]?.value
}

export function printedDatumsOf(metrics: MetricEvidenceSet, frames: readonly SourceCoordinateFrame[]): { ridgeY?: number; terrainY?: number } {
  const section = frames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION')
  const ridgeY = levelsFrom(metrics, section?.id).topDatum
  const terrainY = terrainDatumOf(metrics)
  return { ...(ridgeY !== undefined ? { ridgeY } : {}), ...(terrainY !== undefined ? { terrainY } : {}) }
}
