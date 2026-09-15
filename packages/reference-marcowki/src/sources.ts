/**
 * Evidence sources for Dom w marcówkach (GE): the published drawings and
 * renders, the published facts table, and the reference repository's gold
 * transcriptions this package was transcribed from. Every semantic object
 * the package creates cites one or more of these through `evidence.sourceIds`.
 */
import type { Evidence, EvidenceStatus } from '@buildapp/model'
import type { BuildingCommand } from '@buildapp/commands'

export const PROJECT_URL = 'https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca'
export const REFERENCE_REPO = 'https://github.com/damiankrok/Web-analizer-builder @ claude/new-session-pvd4ik'

export const SRC = {
  groundPlan: 'src-ground-plan',
  atticPlan: 'src-attic-plan',
  section: 'src-section',
  elevFront: 'src-elev-front',
  elevRear: 'src-elev-rear',
  elevEast: 'src-elev-east',
  elevWest: 'src-elev-west',
  renderHero: 'src-render-hero',
  renderGarden: 'src-render-garden',
  facts: 'src-published-facts',
  goldShell: 'src-gold-shell',
  goldInterior: 'src-gold-interior',
  goldFacade: 'src-gold-facade',
  goldRoof: 'src-gold-roof-features',
  transform: 'src-frame-transform',
  author: 'src-stage-author',
} as const

export type SourceId = (typeof SRC)[keyof typeof SRC]

/** The `addEvidenceSource` commands, in a fixed order. */
export function evidenceSourceCommands(): BuildingCommand[] {
  const drawing = (id: string, label: string, note: string): BuildingCommand => ({ type: 'addEvidenceSource', id, kind: 'DRAWING', label, uri: PROJECT_URL, note })
  return [
    drawing(SRC.groundPlan, 'Ground floor plan, dimensioned (rzut parteru)', 'asset_8fda78f8654c, 853×853 px; 37.76 px/m; the 1205 / 1260 chains, the 100|510|750|100 depth column, every ground wall, room and opening gap'),
    drawing(SRC.atticPlan, 'Attic floor plan, dimensioned (rzut poddasza)', 'asset_8460d17163a4, 853×853 px; 37.74 px/m; the attic partitions and rooms, the 270/320 and 234/303 callouts, the three 78/118 rooflight callouts, the balustrade post marks, the two chimney blocks'),
    drawing(SRC.section, 'Building section (przekrój)', 'asset_b1e8c064c1ba, 1138×854 px; 72.59 px/m; datums +7,95 / +4,67 / +3,06 / ±0,00 / −0,32, the printed 40°, the 130 knee wall, the 272 / 266 / 252 clear heights, the slab and roof build-ups'),
    drawing(SRC.elevFront, 'Front elevation (published render)', 'asset_3c991e46a7e7, 1280×597 px; registered x 0 at px 376, 59.34 px/m; sill and head heights, the portal band, the balustrade glass; heights read from it are VISUAL_INFERRED'),
    drawing(SRC.elevRear, 'Rear elevation (published render)', 'asset_863c2909651e, 1280×598 px; registered x 0 at px 970, 58.73 px/m leftwards; the balcony fascia 2.41..2.96, the rear gable rake, the garage north wall'),
    drawing(SRC.elevEast, 'East elevation (published side elevation, identified by content)', 'asset_fcb1602240db, 1280×597 px; the 14.60 m silhouette px 212..1072 at 58.9 px/m; the 300/230 window; the published LEFT/RIGHT labels do not say which side this is'),
    drawing(SRC.elevWest, 'West elevation (published side elevation, identified by content)', 'asset_3915ee416ac4, 1280×598 px; the 90/230 and 140/140 windows, two rooflights in the slope, the dark render band'),
    { type: 'addEvidenceSource', id: SRC.renderHero, kind: 'RENDER', label: 'Hero perspective render', uri: PROJECT_URL, note: 'asset_a26220a6e905, 1600×900 px; depth ordering and appearance only, never a metric source' },
    { type: 'addEvidenceSource', id: SRC.renderGarden, kind: 'RENDER', label: 'Garden perspective render', uri: PROJECT_URL, note: 'asset_ac9a07c288f1, 800×600 px; depth ordering only' },
    { type: 'addEvidenceSource', id: SRC.facts, kind: 'PUBLISHED_FACT', label: 'Published facts table', uri: PROJECT_URL, note: 'building height 8.27 m, footprint area 131.16 m², room table with areas' },
    { type: 'addEvidenceSource', id: SRC.goldShell, kind: 'DERIVATION', label: 'Reference gold: exterior shell (marcowki-exterior-shell-v1.json)', uri: REFERENCE_REPO, note: '32 observations transcribed by hand from the drawings and measured off the rasters with scripts/source-measure.ts; docs/MARCOWKI_STRUCTURAL_SHELL_ROOF_PROOF.md' },
    { type: 'addEvidenceSource', id: SRC.goldInterior, kind: 'DERIVATION', label: 'Reference gold: interior (marcowki-interior-v1.json)', uri: REFERENCE_REPO, note: '21 walls, 12 openings, 18 rooms, the stair and the slab void, from both dimensioned plans; docs/MARCOWKI_INTERIOR_ARCHITECTURALSPEC_REPORT.md' },
    { type: 'addEvidenceSource', id: SRC.goldFacade, kind: 'DERIVATION', label: 'Reference gold: characteristic facade (marcowki-facade-v1.json)', uri: REFERENCE_REPO, note: 'two recesses, five returns, three slabs, one portal, two balustrades, the roof extent, twelve openings; docs/MARCOWKI_CHARACTERISTIC_FACADE_REPORT.md' },
    { type: 'addEvidenceSource', id: SRC.goldRoof, kind: 'DERIVATION', label: 'Reference gold: roof features (marcowki-roof-features-v1.json)', uri: REFERENCE_REPO, note: 'three 78/118 rooflights, two chimney stacks, the upper slab reconciliation' },
    { type: 'addEvidenceSource', id: SRC.transform, kind: 'DERIVATION', label: 'Frame transform reference → BuildApp', note: 'x_app = x_ref, y_app = y_ref, z_app = 13.60 − z_ref (packages/reference-marcowki/src/transform.ts); x orientation verified against the plans: east stays on the right of the front view' },
    { type: 'addEvidenceSource', id: SRC.author, kind: 'MANUAL', label: 'STAGE BUILDAPP-01 modelling decisions', note: 'choices no source settles, each stated in the unresolved ledger (packages/reference-marcowki/src/ledger.ts)' },
  ]
}

/** Build an `Evidence` record. */
export const ev = (status: EvidenceStatus, sourceIds: readonly SourceId[], locator: string, note?: string, properties?: Record<string, EvidenceStatus>): Evidence => ({
  status,
  source: sourceIds.join(' + '),
  locator,
  ...(note ? { note } : {}),
  ...(properties ? { properties } : {}),
  sourceIds: [...sourceIds],
})
