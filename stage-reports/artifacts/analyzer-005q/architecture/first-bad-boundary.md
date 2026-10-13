# 005Q — first bad boundary decision per house (Phase A, before any production change)

Base `04d5568` (005P, plan resolver 1.5.0). Line numbers are `packages/reconstruction/src/*` at the base
(PD = `plan-decomposition.ts`). Evidence: the frozen replays (B0 = 005P PROD4 on 44/44; S0 = B0 on 46/46), the
instrumented PROBE replays (byte-identical outputs plus a decision log: raw and thinned grid lines, bands, long-band
box, snapped envelope, boundary record, layout zones), and per-house counterfactual replays in scratch copies of the
reconstruction package (one variable each, same sealed inputs). Publisher rasters were decoded and measured in scratch
outside the repository; nothing derived from them is committed except numbers.

Labels: **KNOWN** = reproduced from code, data or a replay here, with numbers; **INFERRED** = reasoned or measured on
the raster but not replayed; **UNAVAILABLE** = not determinable from what is here.

## Summary

| house | baseline | earliest incorrect operation | family | 005P story |
| --- | --- | --- | --- | --- |
| dom-w-glogownikach | COMPLETED, −8.04 %, 3 PAVED terraces, ring SOURCE_EXACT 18.83 × 8.70 | **Y**: band claim PD:509 breaks an exact tie (span 350 = 350, axis distance 8.5 = 8.5) by `a.px − b.px`, giving the band to the inner face 536; thinning (PD:564) then drops the outer face 553 (17.000 < minCellPx 17.136); the snap (PD:1246) moves the box's correct outer face 553.5 to 536 (17.5 < 18). **X**: the line 797.69 is not a face at all — the solver-placed end tick of a CHAIN_CORRECTED substitution ("150" → "250" on a printed 350), counted as printed (PD:478), wins the band by axis distance (5.81 < 8.5); 812 (DERIVED) is thinned (14.31 px, not a near-tie) and the snap moves 812.5 → 797.69 | FACE (one wall, two face lines) | 0.136 px is the Y story only; the "minCellM 0.44 restores Y" falsifier is **refuted end to end** (emission failure) |
| dom-w-krasnokwiatach | refused (PLAN_LAYOUT_REJECTED, 11.67 m²) | the long-band box (PD:1238-1241) has no long band on either stepped facade — the N face is a 400 cm window between piers, the S face a 285 cm garage door between piers, both shorter than 2.5 walls — and `sideWallReach` (PD:1302) cannot span a stepped plan (the W side wall starts inside the box); the boundary outline then leaks through six facade gaps whose corner piers read as POST jambs (`boundary-evidence.ts:614`, `:621`), so the living room is never a completion part | PIER (junction-cut facade pieces) + STEPPED PLAN | "780 of 1610" correct; "snapped to the fireplace partition" true but not causal (without that band the box is the same) |
| dom-w-akebiach | refused (FOOTPRINT_AREA_WRONG, 96.93 m²) | the band reader drops the S facade's junction-cut stubs (`runLengthBands`, minLength 26 px; door wall 17/24 px, bay wall 9/9 px, garage piers 20/20 px), so no grid line sits on the bay's W face or the door wall and the core column floods from the porch | PIER | 005P's "S face carries no wall-thick ink" is **falsified** (it measured the kitchen rows 580–629; the face is at 620–635 / 641–656 with 0.97–1.00 dark pieces) |
| dom-w-helikoniach | COMPLETED, −18.88 % | W: `gridLines` admits a line on the W wall's inner face 181 from a 1-px split band (coverage 0.1814 ≥ 0.18, PD:525), thinning keeps it (23 px ≥ 19.5), the wall becomes its own region and layout drops it as a sliver (layout.ts:1807). N/S: junction stubs, a glazed corner, a shallow porch | FACE (W) + PIER (N, S) | the E "≈ 1.4 m²" loss is inert in the model |

## dom-w-glogownikach

**What the drawing shows (INFERRED from the raster, measured in scratch).** Outer faces x 78 / 812.5, y 203 / 553.5;
the E wall is one continuous wall-thick band (795–812, y 221–535, plus the SE pier to 553); the S facade is **stepped**:
wall band 536–553 for x 96–421, a 0.47 m entrance niche set back to y 517–535 for x 438–645, garage piers 645–672 and
785–812 down to 553 with the 300 cm garage door between. Printed: 920 over 203→553 (outer), 870 over 203→536 and 50
over 536→553; 949 | 541 | 440 and 1930 along the S. At the truth scale the outer box is 19.29 × 9.20 m.

**Chain statements on the four contested lines (KNOWN, metric evidence).** 536: CHAIN_CORRECTED 870 (raw "810"); 553:
CHAIN_CORRECTED 920 (raw "420") and a DERIVED 44.55 for the printed "50"; 797.69: CHAIN_CORRECTED 250 (raw "150"),
fractional solver-placed tick; 812: DERIVED 44.64; 1930 never reconciled. No statement on these lines is READ.

**The three terraces (KNOWN).** `layout.ts:2182-2215` `zonesOutsideEnvelope` makes the strips between the snapped
envelope and the extent into ZONE regions (17 px and 14.31 px deep); `v2/reconstruct-v2.ts:649-720` finds wall-thick
ink across the front strip as two "returns" (the garage pier and the E wall's foot); `:1093-1121` makes one terrace per
open interval: `terrace-front-0` (the W part of the S wall and the niche), `terrace-front-1560` (the garage door) and
`terrace-east-45` (the E wall itself), PAVED because the drawn share ≥ 0.3 — the poché of the wall reads as paving.

**The SOURCE_EXACT ring (KNOWN).** `layout.ts:1853-1859`: the ladder's `span(203, 536)` finds chain-41's CHAIN_CORRECTED
870 and calls the span MEASURED; `span(78, 797.69)` sums 7 DERIVED segments and one substitution and is MEASURED too.
`v2/reconstruct-v2.ts:406` makes the MASS SOURCE_EXACT from the width basis; `v2/emit.ts:191` labels **every** ring
SOURCE_EXACT regardless of basis.

**Counterfactuals (KNOWN, each one replay on the sealed inputs).**

| change | result |
| --- | --- |
| keep the outer-face line beside the inner one (minCellM 0.44, minCellM 0.37, or re-adding thinned lines) | **FAILED at emission** (WALL_CONSUMED: the 0.45 m wall row becomes sliver regions and a sliver body) |
| snap tolerance half a wall | footprint unchanged (−8.04 %); all three terraces and both false returns vanish; one room merges, one window becomes a door (unexplained) |
| face claim tie-break toward the outer face (Y only) | −18.0 %, three rings: the niche's set-back wall lost its probe line, the hall leaks |
| outer line replaces inner and inherits its probes, on **both** sides | PASS −1.04 % — but the niche is built inside the house and its mouth becomes one 5.38 m "window" swallowing the kitchen window and the entrance door; X is a DERIVED sum and Z = 870 + DERIVED 44.55. **Not a source-grounded model** (compensating errors) |
| CHAIN_CORRECTED not counted as printed | byte-identical to B0 (797.69 still wins the band by distance) |

**Falsifiable statement.** "The −8.04 % is the loss of one wall's thickness on the E and S sides, by two different
mechanisms, at a correct extent." Flip test: making the E side one line on its outer face must move the width to
≈ 19.21 m without touching S (run in Phase B as C1).

## dom-w-krasnokwiatach

**Drawing (INFERRED, raster).** Stepped plan: N wing = living room 262..535 × 77..248 (29.4 m²) with the 400/170 window
in its N face; NW covered terrace 155..262 × 77..248 (post at the NW corner); middle strip = the box; S = garage
365..535 × 559..718 (285/229 door between piers) and the entrance porch 262..365 × 559..718 (post, open S and W); a
planting strip ≈ 226..262 drawn as dark shrub symbols. Walled ≈ 121.0 m² (−15.5 % of the published 143.18); with the
terrace and the porch 142.9 m². **The published figure includes roofed open areas (INFERRED), so a correct walled
reconstruction does not reach the ±6 % verdict, while a false scale (2.750 cm/px, +9.5 %) fits it to 1.6 % (KNOWN,
CFa5).**

**Readings (KNOWN).** 47 readings over 3 copies × extents × scales × tilings × faces; every one footprint-WRONG, so no
composition. The envelope is 155..535 × 248..559 on every reading of both dimensioned copies: the resolver's axes do
not include the envelope, so no reading can escape it. The incumbent's west wing is then dropped by admission at wall
fraction 0.245 < 0.35 (layout.ts:1794).

**Why the living room is never judged (KNOWN).** `completeBoundary` judges only outline-enclosed components
(`boundary-completion.ts:639`); the outline leaks into the living room through the terrace door (jambs WALL/POST, the
dining room's corner pier read as a POST) and the dining room's N glazing between two piers both read as POSTs. The
N conflict's INCONCLUSIVE comes from a wall sliver (E wall, 2.26 m², WALL_SLIVER), not from a judged room — its text
"something enclosed … fails the attached-room guards" is misleading.

**Counterfactuals (KNOWN).** Size cap relative to the chain extent: byte-identical (the cap is never reached). Bridging
all six facade leaks: the living room and the garage become PROJECTING_WINGs, the terrace and porch stay
COVERED_TERRACE, STRICT disagrees → BOUNDARY_RESOLUTION_INCONCLUSIVE; best reading −16.0 %. Box forced to the STRONG
extent: the shrub strip becomes a **fabricated 4.2 m² body** and admission drops the walled wings (−40.6 %).

## dom-w-akebiach

**KNOWN.** The S facade is inked wall-thick and stepped (pieces with dark share 0.97–1.00); none becomes a band
because each is cut short at its junctions. Injecting only the S-facade stubs: enclosed cells 344 → 35/50 on a coarser
grid, storey 96.93 → 181.04 m² (still refused); adding the garage S piers: COMPLETED −12.18 % with a **false planted
courtyard** (≈ 8.4 m²) and the porch built, the living room's N half still a RECESS. Adding a band over the N sliding
door (not source-backed) gives a PASS +1.67 % by compensation. The N piers change nothing (cfS = cfNS).

**Consequence.** A chain-proposed S strip is supported only on two sub-stretches (garage to 759, bay to 656); the
courtyard, the porch and the E yard must stay outside. On the production band set no band lies on either face, so a
band-based acceptance must refuse; a solid-layer acceptance could accept the two sub-stretches but would then turn a
correct refusal into a completed wrong model unless the N side and the face-accurate grid come with it.

## dom-w-helikoniach

**KNOWN.** W: the line on the W wall's inner face (181) survives (23 px ≥ minCellPx 19.5) and the wall becomes a
sliver dropped by admission; dropping that one line moves −18.88 % → −12.23 % (model `db0b17ca…`). E: inert (the width
is chain-stated). N: junction stubs (the N wall is two pieces 38 and 27 px long, not long bands); the boundary recovers
most of it. S: the porch and a corner window. Several families at once.

## Cross-cutting

1. **FACE family** (glogownikach both sides, helikoniach W): one exterior wall yields two grid lines on its two faces;
   which survives depends on tie-breaks, chain-correction status and the cell size, not on which is the building's
   outside. Keeping both breaks emission; keeping the inner one loses a wall. Any fix must make **one line per wall, on
   the outer face**, and only where the side is one continuous wall: a stepped facade (glogownikach S) needs per-piece
   faces the grid cannot express.
2. **PIER family** (krasnokwiatach N/S, akebiach S, jarzabem S, helikoniach N): facades made of piers and openings
   leave no long band. Fixing it at extraction is source-backed (akebiach 344 → 447 cells) but globally lowering the
   long-band length makes shrubs into walls and fabricates a porch PASS on jarzabem (KNOWN, ADV_LONG 1.6) — out of
   scope for a narrow 005Q change.
3. **Strong dimensions do not imply enclosure** (KNOWN on the B0 digests + raster): rarytasy-g2e S (55.7 m² open
   ground beside the garage), zurawkach S (open porch), willa-miranda N/S (porch, planter terrace), jarzabem S
   (recessed porch between two projecting rooms), dabecjach W/N/S (covered terrace, garden), krasnokwiatach W halves.
4. **Footprint-only verdicts are gameable** (KNOWN): compensated models PASS (glogownikach both-sides replacement,
   akebiach with a false N wall, jarzabem with walled porch); adoption must be judged per feature, not on area.
5. **Sliver terraces are a class, not a Głogowniki symptom** (KNOWN, `exterior-feature-interface.md` §4.2): of the 29
   terraces production emits on the 24 completed rows, 17 are no deeper than one wall (0.17–0.48 m). Every one comes
   from `layout.ts:2182` `zonesOutsideEnvelope` (any strip ≥ max(2, wallPx/2) px between the walled envelope and the
   extent becomes a ZONE) → `v2/reconstruct-v2.ts:651-685` (a recess, its "returns") → `:1093-1118` (a terrace per open
   interval, PAVED when ≥ 30 % of it is drawn — wall poché counts). Raster-checked: glogownikach's three are the S and E
   walls; on the **known-good** eoze-legacy-area (and by the same drawing eoze-legacy-every) the three front ones are the
   outer half of the S wall (61 % dark); on the known-good cieszyniankach the W one is blank paper (1 % ink); D00's are
   half a wall. 10 of the 25 emitted "return" walls are ≤ 0.5 m long in the same strips. Only glogownikach's strips are
   the *whole* wall band (faces on both strip edges); the others are half bands or paper.
6. **Existing semantic defects outside the target** (KNOWN, not repaired here; recorded as residuals): `emit.ts:191`
   labels every ring SOURCE_EXACT (five known-good rows carry SOURCE_DERIVED masses under SOURCE_EXACT rings);
   rarytasy-g2e (known-good) ships a 55.71 m² "front recess" terrace over open ground; CHAIN_CORRECTED substitutions are
   counted as printed at PD:478 and DERIVED segment sums as MEASURED in the layout ladder.
