/**
 * Source revision policy — the data (docs/MARCOWKI_SOURCE_REVISION_POLICY.md
 * is the prose). ARCHON's public sources for the project show revision
 * drift: the current project page (fetched 2026-09-15) and an older
 * downloadable project card disagree on several published aggregates. The
 * canonical reference never mixes them silently: every conflicting fact is
 * listed here with both values, the one the reference uses, why, and whether
 * the difference touches geometry.
 *
 * Rule: current page values are the reference for published room and area
 * facts; a dimensioned technical drawing is the stronger authority for any
 * geometric dimension; aggregate areas never move a dimension.
 */
export type RevisionConflict = {
  fact: string
  unit: 'm2' | 'm' | 'deg'
  currentPage: number
  olderCard: number | null
  uses: 'CURRENT_PAGE' | 'OLDER_CARD' | 'DRAWING'
  why: string
  affectsGeometry: boolean
}

export const PAGE_FETCHED = '2026-09-15'

export const REVISION_CONFLICTS: readonly RevisionConflict[] = [
  { fact: 'house net area (bez kotłowni, garażu)', unit: 'm2', currentPage: 129.04, olderCard: 129.15, uses: 'CURRENT_PAGE', why: 'a published aggregate; the current page is the live revision', affectsGeometry: false },
  { fact: 'garage area', unit: 'm2', currentPage: 24.1, olderCard: 23.85, uses: 'CURRENT_PAGE', why: 'published aggregate; the model’s garage polygon (7.90..11.60 × 5.55..12.15 = 24.42 gross) closes on the one-leaf house/garage wall either way', affectsGeometry: false },
  { fact: 'stairs area (Schody)', unit: 'm2', currentPage: 5.63, olderCard: 5.62, uses: 'CURRENT_PAGE', why: 'published aggregate; the model’s stair compartment and void are read off the plans, not off this figure', affectsGeometry: false },
  { fact: 'roof area', unit: 'm2', currentPage: 150.57, olderCard: 168.48, uses: 'CURRENT_PAGE', why: 'a published aggregate the model does not use: the roof is built from the printed span, pitch, ridge and the 14.60 m side silhouette; 150.57 lies between the sloped area of the walled envelope and that of the full 14.60 m extent, 168.48 above both — neither moves a dimension', affectsGeometry: false },
  { fact: 'boiler room area', unit: 'm2', currentPage: 5.8, olderCard: null, uses: 'CURRENT_PAGE', why: 'only the current page was readable in the session', affectsGeometry: false },
  { fact: 'building height', unit: 'm', currentPage: 8.27, olderCard: null, uses: 'DRAWING', why: 'the section’s +7,95 ridge over the −0,32 terrain datum gives 8.27 exactly; the page agrees', affectsGeometry: true },
  { fact: 'footprint area', unit: 'm2', currentPage: 131.16, olderCard: null, uses: 'DRAWING', why: 'the printed chains 790 + 415 / 510 + 750 give 130.665 m²; the published 131.16 is 0.38 % above and is not allowed to move a chain', affectsGeometry: true },
  { fact: 'knee wall', unit: 'm', currentPage: 1.3, olderCard: 1.3, uses: 'DRAWING', why: 'printed 130 on the section; the page repeats it', affectsGeometry: true },
  { fact: 'roof pitch', unit: 'deg', currentPage: 40, olderCard: 40, uses: 'DRAWING', why: 'printed 40° on the section; the page repeats it', affectsGeometry: true },
  { fact: 'upper finished floor', unit: 'm', currentPage: 3.06, olderCard: 3.06, uses: 'DRAWING', why: 'the +3,06 datum on the section; the same on the older card’s section', affectsGeometry: true },
  { fact: 'ridge', unit: 'm', currentPage: 7.95, olderCard: 7.95, uses: 'DRAWING', why: 'the +7,95 datum', affectsGeometry: true },
  { fact: 'walled depth', unit: 'm', currentPage: 12.6, olderCard: 12.6, uses: 'DRAWING', why: 'the printed 1260 chain', affectsGeometry: true },
]
