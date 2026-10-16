# 005R-EXTERIOR — truth limitations (exact counts)

**There is no human truth in this stage (`HUMAN_TRUTH: NOT_RUN`).** No publisher image was shown to any person or model,
me included. Every label below comes from one of three sources, and none is an independent gold set:

| source | what it is | why it is not truth |
| --- | --- | --- |
| publisher page structure | hero gallery / elevations tab / interiors carousel, carousel caption CLASS | the publisher's own layout; 005R found 15 exterior views in the interiors carousel (B-1) |
| publisher claims | product categories, description keywords | edition-level marketing text; says the house has it, not that an image shows it |
| technical text + production | plan room schedule, printed parameters (same page), sealed N1v production features from plans/sections/elevations | the schedule is still the publisher's page; production features are an unvalidated reader |

So "TECHNICALLY_CORROBORATED" (B1's preregistered status) means **two channels agree**, one of them labelled
technical. It does not mean verified, and the audit showed the label is too generous (addendum E): the strict recount
`results/addendum-e-strict.json` keeps **2** of the 15.

## Corpus

12 families, 14 editions (OWNER's anchor `m3ea28300f9b3e` and Rarytasy 5 (G2E) `m84f2903cb8e14` kept apart), 36
unique lineage groups, 76 byte assets, 71 (asset, edition) frames; extended interior negatives: 159 assets
(178 asset–edition pairs; 113 of them are structural interiors without an exterior-named caption, all routed INTERIOR;
2 are exterior-named, both abstained; the other 63 are non-interior variants of those lineage groups). 1 lineage group is byte-shared by three Rarytasy editions.

## Edition-level classes (B1; 14 editions)

| class | verified (TECHNICALLY_CORROBORATED) | weak | unresolved / not stated |
| --- | --- | --- | --- |
| TERRACE | B1: 6 editions / 6 families (production TERRACE "recess floor at the threshold" + description token). **Strict: 2** (`dom-pod-jarzabem`, `dom-w-jablonkach`: sighted, undenied recess, category claim) | 8 PUBLISHER_CLAIM_ONLY + 4 strict-WEAK (2 derived where production denied the recess, 1 MODEL_ONLY, 1 description-only) | covered vs uncovered: technically 0; publisher says SOLID_COVER for 6 |
| GARAGE_ENCLOSED | B1: 9 editions / 8 families. **Strict: 0** — schedule, printed area and door spec are the same publisher page: PUBLISHER_SPEC_SHEET_CONSISTENCY | 9 spec-sheet consistent | 5 absent by the same page (schedule lists no garage + `bez-garazu`); garage door in the model: NOT_MEASURED (no usage field) |
| PERGOLA | 0 | 6 PUBLISHER_CLAIM_ONLY (4 families), OPEN_COVER by claim | no technical reader exists |
| CARPORT | 0 | 0 | not claimed by any edition; 16 vestibule entries correctly not read as carport |
| ENTRANCE_CANOPY | 0 | 5 PUBLISHER_CLAIM_ONLY | — |
| BALCONY | 0 | 2 PUBLISHER_CLAIM_ONLY, 1 VISUAL_ONLY (Marcówki elevation tone band) | — |
| RAILING | 0 | 1 PUBLISHER_CLAIM_ONLY, 1 VISUAL_ONLY | — |
| LOGGIA | 0 | 0 | recesses → UNKNOWN_ASSEMBLY |
| COLUMNS_SUPPORTS | 0 | 0 | 7 production sentences say "columns" = scan columns, refused |
| LARGE_GLAZING | 0 | 7 PUBLISHER_CLAIM_ONLY | no threshold the source states |
| UNKNOWN_ASSEMBLY | — | 10 TECHNICAL_ONLY (8 recesses, 2 attached roof slabs), 4 families, with alternatives | class not determined by design |

## Frame-level

| item | count | reference |
| --- | --- | --- |
| scene role decided by B1 | 33 of 71 (16 elevation, 12 interior, 5 exterior) | 005R structure only → CONSISTENCY, not accuracy |
| scene role abstained by B1 | 38 (32 no structural channel, 6 structure conflict) | — |
| feature visibility on exterior perspectives | 19 proposals, **19 abstain** | NOT_MEASURED: no pixel reader qualifies, no reviewer |
| features bound to an elevation frame | 1 (VISUAL_ONLY) | production sighting by byte hash |
| pixel regions | 0 | none may be stated |

## What is NOT measured

Frame-level visibility of any feature; precision/recall of any class on images; open vs solid cover from pixels; view
side of perspectives; any metric value from a perspective; ARM64 runtime; a second publisher.
