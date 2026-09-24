# MARCÓWKI REFERENCE AUDIT

Stage BUILDAPP-03X §6. Truth v2 (`MARCOWKI_SOURCE_TRUTH_V2.md`, sealed first) compared with (a) the transcribed reference `packages/reference-marcowki` ("v1": `facts.ts`, `expected.ts`, `structure.ts`, the old gold JSON) and (b) the **current Marcówki Auto** as reproduced at the stage start (`npm run reconstruct:marcowki` at HEAD d5d6375d…; model hash `5f57e568c0fed565`, 44 commands, 2 masses, 13 openings, 1 linear solid, 0 rooms/doors/stairs/balconies/chimneys/rooflights/railings). The machine diff of v1 is `source-truth-diff-v1.json` (104 rows: 87 SAME, 5 V1_WRONG, 1 CHANGED, 8 V1_MISSING, 1 V1_UNCERTAIN_V2_RESOLVED, 2 unresolved on one side).

Verdict vocabulary: CORRECT (v1/Auto agrees with v2 within the v2 uncertainty), MISSING, WRONG, UNCERTAIN (v2 itself does not resolve it), CHANGED (a reading that v2 revises within tolerance).

## 1. Stairs

| | reference v1 | current Auto | truth v2 | verdict |
| --- | --- | --- | --- | --- |
| topology | dog-leg: flight east 4 risers, 4 winders in the corner, flight north 9 risers arriving at z 7.94 | none (a stair is "refused") | U-stair: 5 east, quarter landing, 7 north, quarter landing, 5 west, arriving at x 5.36 in the north band | v1 **WRONG** (the corner squares are level landings; the third flight is drawn on both plans with its arrow); Auto **MISSING** |
| shaft / first riser / width | x 5.37..7.45, z 4.83..7.94, width 0.99 | — | x 5.36..7.45, z 4.81..8.44, width 1.00 | v1 CORRECT on the shaft start and width, WRONG on the north extent |
| risers / riser | 17 / 0.18 (4 winders inferred to make the count) | — | 17 / 0.18 (all straight, section-corroborated) | v1 count CORRECT for the wrong reason |
| well | L-shaped void 4.16 m² | — | rectangular well x 5.36..6.45 z 5.84..7.46 + the two landings are floor | v1 WRONG |

The owner's suspicion about the stair was right. Evaluation fixtures built on `EXPECTED_STAIR`/`EXPECTED_STAIR_VOID` (4 + 4 + 9, L-void) must not be used to grade Auto v2; §23 of the brief applies and the fixture is superseded by `T2-STAIR-TOPOLOGY`.

## 2. 14.60 topology (recesses, returns, characteristic depth)

| | v1 | current Auto | v2 | verdict |
| --- | --- | --- | --- | --- |
| characteristic depth | 14.60 (z 0..14.60) | detected as `zone-min_z` (−1..0, the loggia zone in its mirrored frame) and `zone-max_z` (12.61..13.60, the portal zone), **recesses: []**, masses 0..12.61 | 14.60, re-proved from the chain, four row-scan sets and both side silhouettes | v1 CORRECT; Auto **WRONG** (a diagnostic zone, no geometry; frame shifted 1.00) |
| front recess | mouth 0, back 1.00, x 0.61..11.44 | — | mouth 0, back 1.00, x 0.61..11.42 (ground), 0.61..7.26 (attic) | v1 CORRECT; Auto MISSING |
| east front return | above the balcony only (base 2.96) | — | above the balcony only, base 3.06 | v1 CORRECT (CHANGED base by 0.10) |
| rear recess | mouth 14.60, back 13.60, x 0.61..7.29, both storeys | — | same | v1 CORRECT; Auto MISSING |
| return thickness | 0.61 | — | 0.61 | CORRECT |
| roof over the recesses | roof to z 0 and 14.60 | roof footprint 0..12.61 (the walled body only) | roof z 0..14.60 | v1 CORRECT; Auto WRONG |

## 3. Facade frames (the characteristic assembly)

| | v1 | current Auto | v2 | verdict |
| --- | --- | --- | --- | --- |
| returns as frame uprights | modelled as walls | none | members of `GABLE_FRAME` assemblies | v1 CORRECT as geometry, MISSING as an assembly |
| verge (rake) member | **absent** (roof overhang 0, no gable-edge band) | absent | white band 0.64 perpendicular along both rakes, continuous with the returns; depth UNRESOLVED | v1 **MISSING** (the geometry the owner reported), Auto MISSING |
| balcony fascia + portal head | two solids: balcony 0.55 thick (top 2.96), portal head 0.67 (top 3.08, soffit 2.41) | one `LINEAR_SOLID` 0.31 × 0.31 at y 0.04, z −0.23, x 0..9.93 (a plinth-level strip that is not on the building) | one continuous band 2.28..3.07 from x 3.25 to 12.05, 0.79 tall | v1 WRONG on the front thickness (the rear 0.55 was applied to both) and the portal soffit; Auto **WRONG** (a random strip) |
| garage box / parapet | flat roof 2.88 + "unresolved ~0.2 band" | flat roof at 3.06 with overhang 0.84 | slab 2.88, parapet 3.09 (section upstand + three renders), roof projecting to z 0 | v1 UNCERTAIN → resolved; Auto WRONG (height, overhang, no projection over the portal) |
| cladding / shadow bands | finish regions (VISUAL) | none | VISUAL_SEMANTIC and SHADOW, no geometry | v1 CORRECT |

## 4. Balcony / loggia

| | v1 | Auto | v2 | verdict |
| --- | --- | --- | --- | --- |
| front balcony | x 3.338..7.90, z 0..1, top 2.96, 0.55 thick | none | x 3.25..7.90, top 3.06, fascia 0.79 | v1 CHANGED (top +0.10, thickness), Auto MISSING |
| rear balcony | x 0.61..7.29, top 2.96, 0.55 | none | same extent, top 3.06, fascia 0.56 | v1 CHANGED (top), Auto MISSING |
| railings | glass, 0.90, runs 3.44..7.15 / 0.69..7.15 | none | glass, 0.87, runs 3.30..7.26 / 0.64..7.26 | v1 CORRECT, Auto MISSING |
| loggia / portal floors | plinth to −0.32 | none | same | v1 CORRECT |

## 5. Openings

The current Auto's z axis runs from the rear wall (z 0) to the front (12.61), so its openings are converted with `z_v2 = 13.60 − z_auto`; wall `w0` of a ring is its min-z (rear) wall, `w2` its max-z (front) wall traversed from +x to −x, `w1` the +x wall, `w3` the −x wall traversed from max z to min z.

| opening | v1 | current Auto (converted) | v2 | verdict |
| --- | --- | --- | --- | --- |
| 110/230 front room | 1.397..2.497, 0/2.30 | opening-11: x 1.41..2.23, 0/2.20 | 1.40..2.50, 0/2.30 | v1 CORRECT; Auto position CORRECT, width 0.82 WRONG (0.28 short), head 2.20 |
| 105/210 entrance | 4.176..5.226 | opening-8: x 3.97..5.09, 0/2.20, no door family | 4.18..5.23; leaf split UNRESOLVED | v1 CORRECT; Auto CORRECT within 0.2 |
| 275/225 garage door | 8.556..11.306, 0/2.25 | opening-4: x 8.53..11.33, 0/2.20 | 8.55..11.30, 0/2.25 | CORRECT (Auto head 2.20) |
| 270/320 gable glazing | 3.94..6.64, raked | opening-1: x 2.98..7.31, 0/1.68 LEVEL on the attic front wall; opening-12: x 0.5..1.0, sill 0.9 (spurious) | 3.95..6.65, sill 3.06, head 6.26→4.02 RAKED_SINGLE | v1 CORRECT; Auto **WRONG** (1.6 m too wide, level, 1.68 tall) |
| 470/230 rear glazing | 2.258..6.958 | opening-0: x 2.26..6.93, 0/2.20 | 2.25..6.95 | CORRECT (Auto head 2.20) |
| 234/303 rear gable W | 0.94..3.28, raked, tall edge to the ridge | opening-5: x 0.57..3.23, 0/1.66 LEVEL | 0.95..3.29 raked | v1 CORRECT; Auto position roughly right, profile **WRONG** |
| 234/303 rear gable E | 4.59..6.93, raked | opening-3: x 4.46..7.31, 0/1.68 LEVEL | 4.61..6.95 raked | as above |
| 90/230 west living | z 9.05..9.95 | opening-10: z 9.04..9.94, 0/2.20 | 9.07..9.97 | CORRECT |
| 140/140 west kitchen | z 6.80..8.20, sill 0.9 | opening-6: z 6.81..8.21, sill 0, 2.20 tall | 6.80..8.20, sill 0.90 | v1 CORRECT; Auto sill **WRONG** (no callout read) |
| 300/230 east living | z 9.70..12.70 | opening-2: z 9.72..12.70, 0/2.20 | 9.70..12.70 | CORRECT |
| 100/210 garage side | 9.92..10.92 in the garage rear wall | opening-9: x 9.94..10.89 in the garage rear wall | 9.90..10.90 | CORRECT |
| boiler→garage | z 2.22..3.15 | opening-7: z 2.01..3.15 on the main east wall (cut as an exterior opening, the garage covers it) | z 2.24..3.06 | CORRECT position; Auto exposes it as a facade opening |
| profiles / families / heights | 3 raked; fills window/door; heights from callouts | all LEVEL; every head 2.20 (convention), every sill 0; no families, no callout read | RAKED_SINGLE ×3 with families and printed heights | Auto **WRONG** on every height and profile |

So the current Auto places 10 of the 12 major openings within 0.2 m (the reference audit's earlier draft under-counted this by converting the frame wrongly), and gets every height, sill and head profile from a convention because the printed `w/h` callouts are never read. Its own projection audit matched 5 of 13 objects because the rendered elevations were registered against a 14.5 m silhouette that includes the recess zones.

## 6. Rooflights, chimneys

| | v1 | Auto | v2 | verdict |
| --- | --- | --- | --- | --- |
| rooflights | 3 × 78/118, lower edge 0.45 up the slope, rooms pralnia/łazienka/schody | none | same three, positions z 7.63 / 5.43 (west), 5.44 (east) | v1 CORRECT; Auto MISSING |
| chimneys | 2 (positions in the gold JSON only), top 7.88 | none | #1 x 5.46..6.07 z 8.62..9.05; #2 x 5.42..5.99 z 4.15..4.70; top 7.86 | v1 CORRECT (facts table incomplete); Auto MISSING |

## 7. Internal walls and rooms

| | v1 (gold interior) | Auto | v2 | verdict |
| --- | --- | --- | --- | --- |
| ground partitions | present, 0.12 / boiler north 0.26 | none | 12 pieces incl. the well wall and the flue block; the kitchen south wall stops at x 3.49 (hall open to the kitchen) | v1 CORRECT (not re-verified piece by piece; the diff covers the facts table); Auto MISSING |
| attic partitions | present, capped 2.60 above the floor | none | 11 pieces, capped by the ceiling at 5.72 (2.66 above the floor) | v1 CHANGED (cap +0.06); Auto MISSING |
| interior doors | 11 (5 ground, 6 attic) | none | 11 with intervals; wardrobe 8 has no door (opens off room 7) | CORRECT; Auto MISSING |
| rooms | 18 named, level map | none | 19 polygons (18 + the ground stair shaft) with the open-plan boundaries at z 9.01 / 8.69 from the printed 265/414/446 | v1 CORRECT; Auto MISSING |
| pantry | rectangle | — | L-shape under the upper flight UNRESOLVED | UNCERTAIN |

## 8. Main structure, roof, levels

Everything in the v1 facts table that is a printed dimension or a section datum is CORRECT and unchanged in v2 (87 SAME rows). The current Auto is CORRECT on the two masses (7.90 × 12.61 and 4.15 × 7.51), the 40° gable with ridge along z, the attic level 3.06 and the ridge, and WRONG on: the frame (z runs from the rear wall towards the front, so its FRONT is at max z, against MODEL_FRAME), the garage roof height (3.06 instead of 2.88 + parapet 3.09) and overhang (0.84 instead of 0 with a 1.00 projection over the portal), the roof extent (12.61 instead of 14.60), the eave (`eaveOffset` 1.61 above 3.06 = 4.67, acceptable) and the wall thickness (0.468 measured instead of 0.45; acceptable).

## 9. What v2 changes in the evaluation fixtures (§23)

- `EXPECTED_STAIR`, `EXPECTED_STAIR_VOID`, `EXPECTED_STAIR_VOID_AREA`: superseded (U-stair, rectangular well). Tests that grade a candidate against them must be re-based on `T2-STAIR-TOPOLOGY`.
- `balcony.top` 2.96 → 3.06; `balcony.thickness` 0.55 stays for the rear, the front fascia is 0.79; `portal.headThickness` 0.67 → 0.79 (soffit 2.28).
- `garage.bandTop`: resolved as a parapet 3.09 (not "unresolved").
- New expectations with no v1 counterpart: the verge member, the facade assemblies (gable frames, portal), the chimney positions in the facts table, the room polygons with open-plan boundaries, the 140|220 chain as an open question.
- The v1 reading of the rear gable windows (tall edge to the ridge) is confirmed; the 12 opening spans are confirmed within 0.06.

## 10. What stays uncertain in both

Entrance leaf/sidelight split; verge depth; balustrade height; stair waist/soffit; rooflight slope positions to better than ±0.1; garage roof fall; the exact section of the front fascia.
