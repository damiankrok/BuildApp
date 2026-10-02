# STAGE BUILDPLAN-ANALYZER-005F — adaptive glyph-count segmentation and the extent-consistent envelope

| verdict | result |
| --- | --- |
| ADAPTIVE GLYPH-COUNT SEGMENTATION | **PARTIAL**. A label's glyph count is a hypothesis of its own, admitted by its width against the plan's own dimension-font style and by valley and counter topology, never by a template score or a scale (§E–G). The stage's target is cut at the right count: modrzewnicy's condensed `2590` is four cells in all three ink variants, where 005E had three. On reviewer A's grids the right count rose 35 → 87 of 144 condensed labels. A style taken from another face over-cuts ordinary labels (A's open-4 grid: right count 84 → 60); after A's fixes such a count is never trusted (AMBIGUOUS), but it is not undone (§I, §W) |
| CONDENSED NUMERIC LABEL RECALL | **PARTIAL**. The development labels' printed figure is in the lattice for 74 of 81 (005E 72). The count is recovered without the value on the target: `2590` reads `1140`, its `9` read `4` in all 420 exhaustive four-cell cuts (§C, §Q). modrzewnicy is not fixed |
| NUMERIC OCR NON-CIRCULARITY | **PASS**. No scale creates, chooses or promotes a count: re-solves, SCALE_RANKED and STRUCTURAL draw only same-count values, and a value of another digit count never contests a scale (A's fixture: a true 2.0 cm/px replaced STRONG by a wrong 2.5 without the filter; §W). The tail is recorded beside the values and read by no decision (§H) |
| EXTENT-CONSISTENT ENVELOPE | **PARTIAL**. A side the exterior chains state two walls past the box is an `ENVELOPE_EXTENT_CONFLICT`, recorded and judged before the resolver, never by a published figure (§K). Morelach's conflict is accepted and its PASS restored (§R). Blind 2's conflicts are raised and correctly build nothing, but its envelope still ends inside the stated extent: the plan is cut on the 005C outline, which gives up wall and floor the box held (§AB) |
| ATTACHED BODY COMPLETION | **PARTIAL**. Attached rooms and box completions are built only on way-in, walls, room evidence and returns, clipped to their own free floor, the same any way up (§L–N). Exercised on development by one house, the one the rules were iterated on (Morelach: the bay and the garage end); no blind house had an attached body (D5F-3) |
| TERRACE / FALSE-CLOSURE SAFETY | **PASS**. Nothing was invented on 20 development rows or the two blind houses. Terraces, canopies, carports, walled yards (through the house's window, with a facade chain, behind a bay) and thin parapets stay unbuilt in five orientations (§O). Declared limit: a wall-thick parapet with a glazed balustrade is a bay's drawing |
| ANALYZER EVIDENCE PACK | **PASS**. The `GLYPH_COUNT_HYPOTHESES` and `ENVELOPE_EXTENT_CONFLICT` layers hold ON == OFF, byte determinism and manifests; 4 packs committed and verified; first divergences named for every house that moved (§P) |
| CURRENT e-OZE | **PASS**. MUST_COMPLETE: REPLACED/STRONG, +1.51 %, model unchanged (`75c4ea22`) |
| BLIND ROUND 6 / PROJECT 1 (`dom-pod-milorzebem`) | **ALGORITHMIC_FAIL** (numeric reader). Refused, typed `DIMENSION_EVIDENCE_INCONCLUSIVE`, no scale adopted. Both overalls read right; first bad decision `OCR_SEQUENCE_CANDIDATES` `e00047`: `648` read `608` SUPPORTED at the right count, stating a rival scale (§Z, §AA) |
| BLIND ROUND 6 / PROJECT 2 (`dom-w-helikoniach`) | **ALGORITHMIC_FAIL** (upper-plan metric; ground outline). Completed at −18.88 %, 1 storey of 2, on the right ground scale. First bad decision `METRIC_RELATION` `e00319`: the attic plan keeps an unsupported page-vote scale; independently, `ENVELOPE` `e00335` cuts the ground plan on its outline (§AB, §AC) |
| **Stage** | **PARTIAL**: `PARTIAL_BUILDPLAN_ANALYZER_005F_GLYPH_MISREADS_AND_BLIND_ROUND_6_FAILS`. modrzewnicy is not fixed, and both blind houses fail algorithmically; not patched (protocol) |

Branch `analyzer/adaptive-segmentation-envelope-v1` (every push also to `claude/new-session-3kzcgh`), from
`analyzer/numeric-ocr-lattice-v1` @ `9b619ece46abb4316e52cc3b778e8c7599184e4a`. Legacy (`BuildPlan-PC-Legacy`) was
not touched. No drawing, PDF page, crop, glyph bitmap or overlay of any publisher is committed. The repository holds
only text facts, hashes, numbers, and the analyzer's own SVG primitives and model renders in the Evidence Packs. No
cloud OCR, remote model or project-specific constant was used or added.

---

## A. Baseline — 005E PARTIAL accepted

005E ended `PARTIAL_BUILDPLAN_ANALYZER_005E_BLIND_CONDENSED_LABEL_AND_ENVELOPE_FAILS`. Both round-5 blind houses
failed algorithmically and were not patched. Their families entered the development set as this stage's input.

**Single-repository audit.** BuildApp (`damiankrok/BuildApp`) is the canonical repository; every 005F commit is in it.
The Legacy repository (`damiankrok/BuildPlan-PC-Legacy`) is attached to this session read-only. Its checkout's
`HEAD`, `origin/main` and `origin/claude/new-session-3kzcgh` all point at `b0e79675c7ebeacf718cd1392f62272fb400418b`,
with 0 local changes. Its reflog shows only the harness's checkouts. Nothing in 005F reads from it, depends on it, writes
to it, branches in it or pushes to it, and it was not deleted. The 005F branch `analyzer/adaptive-segmentation-envelope-v1`
starts at `analyzer/numeric-ocr-lattice-v1` @ `9b619ece46abb4316e52cc3b778e8c7599184e4a`. Every push also goes to
`claude/new-session-3kzcgh`. The stage did not merge histories, force-push, reset, clean or stash, and did not change
the git identity.

**Baseline reproduced** (offline, the 005E code, from the sealed packages):

- `dom-w-modrzewnicy`: `METRIC_RESOLUTION_INCONCLUSIVE`. Its "what is missing" sentence said the plan prints no
  dimension.
- `dom-w-morelach`: completed at 101.31 m² against the published 114.53 m² (−11.54 %). Scale CONFIRMED/WEAK
  0.019801 m/px on the ground plan. Storeys 2/2.

Both match the sealed blind runs byte for byte in their decisions.

## B. Focused pre-implementation reviews

Four read-only reviewers answered one question each, on the cached bytes (`artifacts/analyzer-005f/pre/`):

- A: condensed segmentation (`segmentation-count-review.md`);
- B: the beam's weak paths (`beam-tail-review.md`);
- C: envelope against extent (`envelope-extent-review.md`);
- D: attached-body completion (`attached-body-review.md`).

The coordinator's synthesis is `implementation-contract.md`. Where reviews disagreed it says which one it followed;
every bound in it is a reviewer's measurement.

The findings that shaped the stage:

- **A P0-1.** `2590` is a count error first. `round(w / 0.55·h)` counts a four-glyph run right only above 0.481 of the
  cap; `2590` measures 0.477.
- **A P0-2.** It is then a classifier error: at the right count, the `9` cell scores `4` 0.50 against `9` 0.26.
- **A P0-3.** The image score cannot choose a count: a forced extra glyph scores at least as well as the truth in 64 of
  165 cases.
- **A P1-1.** The face is not condensed; the cap is small. Isolated width over cap is 0.455 against 0.462–0.571 on the
  development houses, so the plan's own style at the label's cap is the statistic.
- **B P0-1.** `1950` is lost at the count bound (rank 10 of 18), not at the beam's floor.
- **B P0-2.** No tail can flip the modrzewnicy refusal under the 005E protections. The refusal was expected to stay,
  typed honestly.
- **C P0-1.** Nothing compared the chain extent with the box.
- **C P0-2.** Accepting a part re-tiled the masses, and storeys fell from 2 to 1.
- **D P0-1.** The Morelach bay is enclosed but cannot be adopted.
- **D P0-2.** The garage end is inside the box, and `adopt` discards it.

## C. modrzewnicy — root cause

The selected plan (`rzut-8d59c92ec1`) prints its overalls on the left chains (`2590` = 1950 + 640) and the bottom
chain (`1000`). The face is small: a cap of about 10–11 px.

1. **Count.** The 005D reader, and so every 005E anchor, cut the `2590` ink (box x105–115, y427–447, ROTATED_CW) into
   three cells. With three cells no four-glyph value can enter the lattice: as-read `140` LOW_QUALITY, values
   `100,240,…`. This was the first bad decision of the blind run (`OCR_SEQUENCE_CANDIDATES` `e00013`).
2. **Classifier.** At four cells the `9` reads `4` (0.50 against 0.26) — a template confusion at about 5 px glyph
   width, outside segmentation.
3. **A confident misread.** `1950` reads `1410` SUPPORTED (p 0.47, stable). Its total against its child `600` (truth
   `640`) states two scales, 2.895 and 3.75 cm/px. Nothing decides, so the metric refuses.

Points 2 and 3 are not count errors. No generic count rule can make `2590` the reading (A P0-2, B P0-2).

## D. morelach — root cause

The scale is right: CONFIRMED/WEAK at 0.019801 m/px (the printed `1212` over its span gives about 1.996 cm/px).

The first bad decision was `ENVELOPE` `e00427`. The long-band box is x 61–609.5, while the chain extent is x 61–670
(the top chain `1212 = 380 + 732 + 100`, whose last segment is the east kitchen bay). Two parts follow from it:

- **The bay** (x 609.5–670, about y 415–590, glazed on its east face) is enclosed by the outline. Its junction carries
  a counter line drawn across the open side, so `adopt` sees no continuation.
- **The garage end** (x 61–253, y 590–667), with its 2.4 m vehicle door on the south face, is inside the box. The
  outline encloses it, but `adopt` discards in-box gains.

Footprint −11.54 %.

## E. Adaptive glyph-count architecture

`metrics.numeric-lattice` 1.1.0. The glyph count is a hypothesis of its own, decided by width and topology, never by an
image score or a scale (`countHypotheses`, contract A2–A3):

- **Admitted counts.** For each ink run of an ink variant's anchor, the counts one either side of the anchor's are
  considered. A count is admitted when its per-glyph width lies in the band: 0.75–1.30 of the plan's style, or, with no
  style, 0.40–0.70 of the cap. It must also fit the width better than the anchor's count, every boundary must have a
  valley that cuts no counter, and an added boundary needs a valley at least 0.35 deep. At most one count per direction.
- **Decisive.** With a style, when the band rules out the anchor's own count and admits one more, the anchor is cut at
  that count. This is the only way the reader's count changes. A count one fewer is never decisive (post-review A5F-1:
  a style wider than the label, such as a title block at the same cap, merged touching glyphs); it enters as re-cuts,
  as does every admitted count without a style (`countAlt`).
- **Caps.** 16 segmentations per count and 96 cells scored per ink; the 48 per variant and 144 per ink follow from them
  and do not bind. The cell cap bounds the hypotheses, not the ink: every variant's anchor is exempt and the stability
  bracket scores up to 28 cells more (a development label reached 118 scorings, post-review B5F-3). Only the per-ink caps
  are recorded (`segmentation.truncated`); the per-count, count-text and tail caps truncate silently (§AG).
- **Recorded.** On each lattice: `countAmbiguity` (as-read count, alternatives, decisive variants, `widthAmbiguous`,
  `rivalP`) and `segmentation` (per variant: reader, anchor, alternatives, decisive, width-ambiguous; counter cuts moved
  and pruned; segmentations; cells scored).
- **Scale.** A value of another digit count never crosses into the metric: `correctionReadings` (re-solves,
  SCALE_RANKED, STRUCTURAL) and `latticeAlternatives` (contest values, M4 doubt) both drop it (contract A6; the second
  was post-review A5F-3 / D5F-6, where a fixture turned a CONFIRMED 2.0 cm/px into a STRONG wrong 2.5).

## F. Local font-style profile

`dimensionStyleOf(read)` runs once per plan read. Every raw token of 1–6 glyphs is cut by the reader's own DEFAULT mask.
Each column-profile ink run whose width over the token's cap lies in 0.35–0.80 is an isolated-glyph sample.
`styleFor(style, cap)` takes the median over samples whose cap is within ×/÷1.25 of the label's, and needs at least 8 of
them, otherwise the label has no style.

The style sees no value, chain, scale or published figure. The brief asked for a profile built from CLEAR/SUPPORTED
labels. That would be a cycle — a class depends on the count the style decides — so the deviation is stated (contract
A1).

On modrzewnicy the profile is 0.4545 of the cap from 48 samples. The `2590` ink is now cut into four in all three ink
variants (`DEFAULT 3→4, STRICT 3→4, SAUVOLA 3→4`, timeline `GLYPH_COUNT_HYPOTHESES`).

## G. Segmentation scoring

Scoring is unchanged from 005E: cells are matched against the reader's templates, and the as-read string is the
anchor of the variant whose cells match best.

What 005F adds is counter safety. A counter is a hole at least 0.2 of the cap tall that is a hole on at least half its
pixels in every other ink mask. A reader cut through a counter moves to the deepest valley in its window that cuts
none; the count stays. Re-cuts and count hypotheses through a counter are pruned. A `0` or an `8` is not a junction.

## H. Weak joint-path retention (the ambiguity tail)

`TAIL_BOUNDS = { substitutions: 2, glyphRatio: 0.7, glyphShare: 0.2, perInk: 2 }`. A tail value is one an anchor
reaches with exactly two moderate substitutions, each supported by the image on its own — at least 0.7 of the cell's
best and within `T·ln(1/0.2)` of it — that the count bound cut. At most two per ink.

The tail is recorded beside the values (`tail[]`), never among them. It has no probability, is never as-read, and is
never a witness, a contest value, a correction or a structural option. An architecture test forbids the metric solver
from naming it. The beam's floor is not lowered: every tail value is at least 0.04 of its path's best.

As B P0-2 predicted, the tail does not change the modrzewnicy outcome: no decision may read it.

## I. OCR confidence regression

Count ambiguity is reading ambiguity (contract A5). A reading that would be CLEAR or SUPPORTED is AMBIGUOUS when:

- it has a leading zero;
- a value of another digit count holds ≥ 0.10 of the ink's values;
- its width fits a glyph more or fewer as well (`widthAmbiguous`) — under the plan's style the width alone decides,
  without the valley and counter gates that belong to adding a hypothesis (post-review A5F-2: the stage's own `2590`
  geometry at an 11 px cap read `190` SUPPORTED through them);
- it was cut at a count no ink variant's own reader cut — the style's alone (A5F-1: `145` on a condensed page read
  `1115` SUPPORTED);
- the ink variants cut it into different counts (A5F-4: `7525` read `716` SUPPORTED).

Any other value of another count caps CLEAR at SUPPORTED, and so does a count the style chose over the reader's when a
reader agrees (D5F-4). These rules see the counts the lattice raised: an ink cut two away from its glyph count, or
whose width rules out its count with nothing one away to offer, can still read CLEAR at the wrong count (`185` read
`85` on the held-back corpus). That is a declared limit (§AG), not a guarantee the stage gives.

**Class bars.** `supportedP` stays 0.35; both margins move 0.3 → 0.5 (the next value may hold at most half of the
reading). The criterion, the grid, the knife edges, the held-back miss and what it costs are in the calibration record
(`artifacts/analyzer-005f/calibration/README.md`). A bar of 0.40 tried at `dd95020` was fitted to one Morelach label
in no calibration split and was reverted (`d910212`).

Final, on the freeze candidate's lattice: FIT CLEAR 8/8, SUPPORTED 9/12; HELD_BACK 6/6, 4/6; TARGET 4/4, 1/1; corpus
5001 48/51, 38/57; corpus 9017 55/58, 40/59 (005E: 58/87 and 55/80 SUPPORTED).

## J. Refusal-copy correction

A plan whose scale is not settled stops `METRIC_RESOLUTION_INCONCLUSIVE` with `dimensionEvidence` in its diagnostics:

- `NO_DIMENSION_EVIDENCE`: the plan prints no dimension the reader could witness;
- `DIMENSION_EVIDENCE_INCONCLUSIVE`: dimensions were found and read, and as read they settle no one scale, with the
  label and line counts.

Only witnessing labels count: a PRIMARY binding read better than LOW_QUALITY, at least two of them on two lines, or a
legacy chain. Post-review D5F-1 found the first rule counted stray tokens (`01`, `10`, `111`) and told galaktyka and
aster-viii, which print no dimensions, that dimensions were found (fixed at `2e1889a`; both are CI rows expecting
`NO_DIMENSION_EVIDENCE`).

The "what is missing" sentence and the failure's own sentence follow the kind, in v1 `failure.ts` and v2 `metricStop`.
The phone reads `dimensionEvidence` (`FailureDetails.dimensionEvidence()`) and says, for the inconclusive kind: "Nie
udało się ustalić skali rzutu: na rzucie znalazłem wymiary, ale nie udało się z nich jednoznacznie ustalić skali, więc
modelu nie zbudowano." modrzewnicy now refuses with `DIMENSION_EVIDENCE_INCONCLUSIVE`.

## K. Envelope extent conflict

`boundary-evidence` 1.1.0, `boundary-completion.ts`. The extent's sides come from chain geometry (`extentSidesOf`):

- **SUPPORTED**: an EXTERIOR chain covering the wall witness ends on the side within a wall, on a mark not rejected.
- **STRONG**: two such chains on lines more than a wall apart whose ends agree within a wall (C5F-9), or one closed by
  its own readings alone — at least two READ segments and none restated (DERIVED) or chosen (CHAIN_CORRECTED) by a
  scale (D5F-5).
- A side the extent took from wall geometry is stated by nothing.

A stated side two walls or more past the long-band box, with stretches no built cell explains (each at least two walls
long, at most two; the ones dropped are counted, `stretchesOmitted`), is an `ENVELOPE_EXTENT_CONFLICT`. It is always
recorded and fills nothing by itself. Its decision is one of:

- `ZONE`: nothing enclosed reaches it;
- `RECORDED`: SUPPORTED only;
- `ACCEPTED`: an attached room reaches it;
- `INCONCLUSIVE`: a part is a question, or parts went unjudged at the cap.

The decision is made in `decomposePlan`, before the resolver, so the published-footprint scoring never chooses an
envelope (contract B7). The contract's per-stretch component cap and its AMBIGUOUS decision were not implemented: each
part is judged on its own evidence, and two glazed bays on one side are both built (B5F-10, a recorded deviation).

## L. Attached-body (flush body) completion

A part is the floor reached from the house through open edges and door-like openings (C5F-2). A part beyond the box that
the outline encloses and `adopt` did not take is built as an `ATTACHED_ROOM` only when all of these hold:

- it has a way in from the house: open edge or door-like openings at least a door wide;
- its own perimeter is at least the side wall share of wall and under the post share;
- it has evidence of a room of its own: glazing between wall jambs on its own outer walls within its span ± ½ wall,
  symmetrically and never on a line it shares with the house (C5F-1); a chain across it ticking within a wall of both
  its ends (C5F-3); or a vehicle door that is not only a dashed line (C5F-5);
- it has two returns;
- it reaches the conflict's stated side, inside the extent.

Each guard that fails names the rejection: `NO_WAY_IN`, `WALLED_OFF`, `NOT_WALLED`, `POSTS`, `NO_ROOM_EVIDENCE`,
`NO_RETURNS`, `BEYOND_EXTENT`. Too large (over half the box reading's built area) or a disagreement between the jamb
policies is a QUESTION. Parts are judged largest first, at most 16; the ones the cap leaves are counted
(`completionsUnjudged`) and keep the conflict from being a zone (B5F-1).

An accepted room becomes its own mass: only a BOX_COMPLETION extends a body (C5F-7). The incumbent bodies are kept as
they were (`stableRegions`) and never re-tiled; their records are refreshed as built after completions (C5F-8). An
upper plan may stand on the house without its attached rooms: `envelope-without-attached` is a named alignment target
beside the envelope (C P0-2; §R). It is load-bearing on Morelach: without it storeys fall to 1/2 (post-review D's
`morelach-no-ewa` run).

**Only one development house exercises the accepting paths**, the one they were iterated on (D5F-3). Seven of the
guards decide no development part. The rules are tested synthetically under five transforms
(`extent-envelope-orientation.test.ts`); blind round 6 is their only clean check.

## M. Candidate clipping

A part is clipped to its own free floor: the pixels that are not WALL-kind solid ink, in connected components at least
0.75 wall across both ways. Its core cells must hold at least 25 % free floor, and only cells within a wall of the core
are kept. A part that is only wall-thick ink is a `WALL_SLIVER`.

Floor in a part that nothing passable reaches from the house is split off as `WALLED_OFF` when one could stand in it — a
door's width (0.7 m, the existing `doorM`) across both ways — and stays with the part's walls when narrower, such as a
window reveal behind a pier. **This bound was found on Morelach** (D5F-12): the first form of the walled-off rule
(`4fd2f8e`) split a 0.13 m² window reveal off the bay, broke its body's rectangularity and dropped the footprint to
−6.48 %. The door-width bound (`65ebbdd`) restored −3.12 % with the same model hash. It reuses an existing bound and is
tested both ways along either axis, either way round (`walled-off.test.ts`), but its only real evidence is the house it
was found on.

On Morelach the bay's outline component (x 609.5–670 × y 323–716, 4.2 m² before the clip, taller than the bay) is
clipped to y 415–590, 3.46 m², within the bay's own side walls. The §29 test checks the same on a synthetic bay.

## N. Garage-end logic

Inside the box, a part the incumbent grid had no line for — only an unread exterior chain ticks its wall — is a
`BOX_COMPLETION`. It is built only when it continues the built rooms across an open edge (at least half its shared
edge) and both jamb policies close it. Either drawn openings alone close it, or a **vehicle door** does: wall jambs,
2.2–3.2 m wide, a stroke or a dashed line in it (never blank), and a vehicle's length (≥ 4.5 m) of floor behind it,
reached across open edges only, whichever way up the plan is drawn. It stays `occupancy: OPENING` — physically open,
topologically closed (005C semantics).

**Found on Morelach.** The depth behind the door was first grown in one pass in cell order, which reaches all the way
only one way: a garage whose body lies north of its door measured about 2.5 m. A fixpoint fixed that (`177dfca`); it
then grew through walls into the house (C5F-4: a 2.5 m gap in a garage end's side wall became a vehicle door), and the
depth is now a breadth-first walk across open edges (`4fd2f8e`). Morelach's door is 2.38 m wide against the 2.2 m floor,
and its depth clears 4.5 m; at `vehicleMinM` +20 % the garage end would fail (D5F-3).

## O. Terrace / pergola safety

The extent fills nothing by itself. A terrace edge or paving the chains state past the box is a `ZONE` (§30 test). The
following stay unbuilt, in every orientation where the drawing allows it to be drawn five ways:

- a canopy on posts the overall chain dimensions (`POSTS`, §21);
- a walled store or yard with only a door (`NO_ROOM_EVIDENCE`);
- a walled yard seen through the house's own window (C5F-1), and one a facade chain is drawn across (C5F-3);
- a glazed bay with a walled yard behind its side wall: the bay is built, the yard is not (C5F-2);
- a carport with short piers and a dashed roof line (C5F-5);
- a gap in a garage end's side wall with the house behind a solid wall (C5F-4);
- a part walled off from the house (`NO_WAY_IN`), and a bay whose only junction opening is glazing;
- a terrace behind a parapet thinner than a wall, with a glazed balustrade (C5F-6).

**A declared limit** (C5F-6): a terrace whose parapet is as thick as a wall, with a glazed balustrade between its stubs
and a door from the house, is the same drawing as a glazed bay and is built as one; so is a yard whose gate is drawn as
two lines in the wall's thickness. Thickness is the only thing that tells them apart (`STRUCTURAL_LAYOUT.md`).

The 005C terrace, canopy, pergola and wide-opening negatives (`boundary-envelope`, `boundary-post-review`,
`wide-openings`, `attached-bodies`) pass unchanged.

## P. Evidence Pack extensions

Two timeline stages, observational and recorded only where they have something to say, so a pre-005F pack reads
ABSENT there:

- **`GLYPH_COUNT_HYPOTHESES`** (before `OCR_SEQUENCE_CANDIDATES`): `COUNTS:<as-read>|<alternatives>[|DECIDED][|WIDTH_AMBIGUOUS]`,
  per ink whose count the style changed or that kept another count.
- **`ENVELOPE_EXTENT_CONFLICT`** (between `ENVELOPE` and `BODIES`): one event per conflict side (`<side>:<decision>`)
  and per completion.

Files:

- `07-ocr-labels.json` gains `countHypotheses`, `style`, `segmentation`, and `tail`, each tail value marked
  `AMBIGUITY_TAIL`.
- `11-envelope-candidates` draws each conflict's strip and carries `extentConflicts`.
- `13-body-candidates` draws each completion before and after its clip and carries `completions`.

ON == OFF, byte determinism and manifests hold (`evidence-pack.test.ts`, 19 tests, 4 new).

## Q. modrzewnicy — before / after

| | 005E (round-5 blind run, frozen code) | 005F (`41e26be`, offline, sealed package) |
| --- | --- | --- |
| outcome | `METRIC_RESOLUTION_INCONCLUSIVE` | `METRIC_RESOLUTION_INCONCLUSIVE` (`ALGORITHMIC_FAIL`) |
| refusal kind | none; the sentence said the plan prints no dimension | `DIMENSION_EVIDENCE_INCONCLUSIVE`, 9 witnessing labels on 6 lines |
| `2590` ink | three cells; as-read `140` LOW_QUALITY; no four-digit value | four cells in all three variants (style 0.4545 of the cap, 48 samples); as-read `1140` AMBIGUOUS; `2590` absent (the `9` reads `4`) |
| `1950` | `1410` SUPPORTED | still a confident misread (A P0-2: a classifier confusion, not a count) |
| scale hypotheses | 2.895 / 3.75 cm/px, undecided | 1.762 (the `1140` witness, AMBIGUOUS), 2.895, 3.75 — undecided; the page's own consistent statement (≈ 4.0) is not among them |
| model | none | none |

The count is fixed generically; the value is not. Post-review A confirmed the stated reason with 420 exhaustive four-cell
cuts per ink variant, de-skewed or upright: none reads `2590`, because the `9` scores below the `4`. Counting the ink
right turned an unreadable overall into a wrong-valued AMBIGUOUS witness (A5F-7): it refuses the plan, and the refusal
now says which evidence is there and why it does not decide. **modrzewnicy is not fixed.**

## R. morelach — before / after

| | 005E (round-5 blind run) | 005F (`41e26be`) |
| --- | --- | --- |
| verdict | ALGORITHMIC_FAIL, −11.54 % | **PASS, −3.12 %** (110.96 m² against 114.53) |
| bodies, storeys | 2 bodies, 2/2 | 3 bodies (the house, the garage with its end, the bay), 2/2 |
| scale | CONFIRMED/WEAK 0.019801 m/px | CONFIRMED/INCONCLUSIVE, the same scale (1.989 / 1.998 cm/px); confidence lowered by a SUPPORTED misread `602` standing as a better-class rival (calibration record) |
| extent conflict | not compared | E side STRONG, 1.20 m past the box: ACCEPTED |
| completions | none | ATTACHED_ROOM, the kitchen bay, 3.46 m² (clipped from 4.2, within its side walls); BOX_COMPLETION, the garage end to its vehicle door, 5.93 m² |
| exterior closure findings | 4 | 8 (`EXTERIOR_JOINTS`, LIMITING): the completed parts add four joint findings |

The model hash is `c3eb20a9` in every run since `d910212`. **Rules found on Morelach, stated plainly:** the
`envelope-without-attached` alignment target (without it storeys fall to 1/2), the garage-end depth's direction
(`177dfca`), and the walled-off door-width bound (`65ebbdd`). Morelach's PASS was restored after the post-reviews by a
rule chosen on Morelach (D5F-12); it is tested synthetically, and only blind round 6 checks it cleanly.

## S. Known boundary regressions

The five known rows replay the sealed 005A evidence through the 005F solver and are **identical** to the matrix before
the post-reviews (`m-c`) on outcome, model hash, footprint and bodies:

| row | lane | outcome |
| --- | --- | --- |
| eoze-every-copy | LEGACY_EVIDENCE_COMPATIBILITY | COMPLETED, REPLACED, −4.20 % |
| eoze-area-copy-alone | LEGACY_EVIDENCE_COMPATIBILITY | COMPLETED, REPLACED, −4.37 % |
| eoze-decoy-high | DECOY | refused by name, `PLAN_RESOLUTION_INCONCLUSIVE` |
| eoze-decoy-low | DECOY | refused by name, `PLAN_RESOLUTION_INCONCLUSIVE` |
| kosacce-area-copy-alone | KNOWN_MAY_REFUSE | refused, `PLAN_RESOLUTION_INCONCLUSIVE` |

The boundary regressions the stage could have caused were checked where they live:

- the 005C terrace, canopy, pergola and wide-opening negatives (`boundary-envelope` 28, `wide-openings` 15,
  `attached-bodies` 8) pass unchanged;
- every development model pinned before 005F is unchanged (Marcówki `6152770f`, Kosaćce `5b5ffcf1`, G2E `9f5fd342`,
  e-OZE `75c4ea22`, willa-miranda `1ce47cfb`, zurawkach `31ba5eea`, tunbergiach `86580d74`);
- the freeze-candidate matrix caught one regression the post-review fixes had introduced (Marcówki's garage gaining a
  storey through an attic completion, exterior closure 0 → 4 errors; CI's Marcówki row and its no-reference check
  caught it too). It was fixed (`41e26be`) and the matrix re-run (§W).

## T. Full development matrix

`artifacts/analyzer-005f/development-matrix.json`: 17 houses in 20 rows (the tracked Kosaćce link, the legacy e-OZE
lanes), offline from the sealed packages, Evidence Pack on, verdicts by `holdout/verdict.mjs`, at `41e26be`.

| house | 005E | 005F | model | metric (selected plan) |
| --- | --- | --- | --- | --- |
| dom-w-modrzewnicy | FAIL (refused) | FAIL (refused, typed `DIMENSION_EVIDENCE_INCONCLUSIVE`) | — | NO_SCALE |
| dom-w-morelach | FAIL −11.54 % | **PASS −3.12 %** | `c3eb20a9` (was `af9db299`) | CONFIRMED/INCONCLUSIVE |
| marcowki | PASS | PASS | = `6152770f` | CONFIRMED/STRONG |
| rarytasy-g2e | FAIL | FAIL | = | CONFIRMED/WEAK (was STRONG) |
| kosacce-clean, kosacce-tracked | PASS | PASS | = | CONFIRMED/STRONG |
| rarytasy-eoze (MUST_COMPLETE) | PASS | PASS | = | REPLACED/STRONG |
| alt-marcowki | FAIL (refused) | FAIL (refused) | — | LEGACY_UNCONFIRMED |
| dom-w-jablonkach | PASS | PASS | `37c8f6f1` (was `6c8cf347`) | REPLACED/WEAK |
| willa-miranda | FAIL | FAIL | = | CONFIRMED/SUPPORTED |
| dom-w-zurawkach | FAIL | FAIL | = | CONFIRMED/STRONG |
| dom-w-modrzykach | PASS | PASS | `86ed8afd` (was `77b4be1b`) | REPLACED/STRONG |
| dom-w-azaliach | FAIL (refused) | FAIL (refused) | — | REPLACED/WEAK |
| dom-w-dabecjach | FAIL (refused) | FAIL (refused) | — | REPLACED/STRONG |
| dom-w-tunbergiach | FAIL | FAIL | = | REPLACED/WEAK |
| aster-viii | FAIL (refused) | FAIL (refused, now `NO_DIMENSION_EVIDENCE`) | — | NO_SCALE |
| galaktyka | FAIL (refused) | FAIL (refused, now `NO_DIMENSION_EVIDENCE`) | — | NO_SCALE |

**No development verdict is worse; one is better (Morelach).** What moved, and why (D5F-7):

- **Morelach**: the stage's change (§R).
- **dom-w-jablonkach**: the model moved by a registration difference under a millimetre (Y −0.02 %); first divergence
  a decided count, then `REGISTRATION`.
- **dom-w-modrzykach**: two CHAIN_CORRECTED values a scale chose became registration anchors (10 → 12) and the slab
  moved 0.17 m (footprint −0.54 % → +0.16 %). This is 005E's recorded debt B5E-6 (CHAIN_CORRECTED values anchor registrations), now
  exercised.
- **rarytasy-g2e**: CONFIRMED STRONG → WEAK, the class bars' consequence (its witness `1470`, a misread of 1474, falls
  from SUPPORTED at margin 0.492).
- **dom-w-dabecjach**: its N extent side, stated by one chain closed by a scale-restated segment, is SUPPORTED, not
  STRONG (D5F-5); still refused at the boundary.
- Reading classes moved on 11 rows, and on none did the CLEAR+SUPPORTED count rise (`post/resolution.md`).

## U. Tests and metamorphics

New or extended, all passing; the full suite is 2001 tests in 150 files (9 skipped by design), typecheck clean, Android
unit tests green:

| file | tests | what it holds |
| --- | --- | --- |
| `source-metrics/test/adaptive-glyph-count.test.ts` | 27 | the plan's style; condensed counts represented (faces A/B, caps 14/16, four and five digits); normal labels not expanded; no count hallucination (three-digit labels never emit a four-digit value at p ≥ 0.1 unless AMBIGUOUS); counter safety; bounds and the tail; post-review A's attacks (a split under another face's style, a merge under a title-block style, the 11 px cap, ordinary touching labels on condensed pages), each failing on the code before its fix |
| `source-metrics/test/ocr-metric-adversaries.test.ts` | 22 | contract A6: a value of another digit count never contests a scale (A's fixture: CONFIRMED 2.0 → REPLACED 2.5 STRONG without the filter) |
| `source-metrics/test/numeric-lattice.test.ts` | 17 | 005E's lattice gates, unchanged |
| `reconstruction/test/extent-envelope.test.ts` | 23 | §29/§30: the conflict, the attached bay, the garage end both ways up, the yard, the canopy, the terrace, the part cap, a single chain's strength (D5F-5), a thin parapet (C5F-6) |
| `reconstruction/test/extent-envelope-orientation.test.ts` | 7 × 5 | seven scenes, each drawn as is, mirrored both ways and turned a quarter either way |
| `reconstruction/test/walled-off.test.ts` | 10 | the walled-off split both ways in four orientations; the split never makes a part an end of the rooms |
| `reconstruction/test/vehicle-door-depth.test.ts` | 1 | the depth behind a vehicle door never crosses a wall (C5F-4) |
| `reconstruction/test/failure-codes.test.ts` | 12 | the typed refusal, stray tokens counting nothing (D5F-1) |
| `analysis-service/test/evidence-pack.test.ts` | 19 | the two new layers; ON == OFF, determinism, manifests |
| `tests/architecture/generalization.test.ts` | 6 | no house, published figure or registered overall in production |

Metamorphic: the orientation suite (mirror, rotate) for every completion rule; the count tests across two stroke faces
and condense factors; the walled-off rule along either axis, either way round.

## V. Performance and progress

The final matrix (`41e26be`), three rows at a time on four cores, nothing else running (B5F-11: the `m-c` numbers were
taken under reviewers' load and are not used):

| | 005E (its matrix) | 005F |
| --- | --- | --- |
| wall clock per development row | 35–235 s | 46–309 s |
| metric phase | 19–186 s | 26–251 s (+25–35 %: count hypotheses and the plan's style) |
| peak RSS | — | 670–906 MB |
| largest gap between progress ticks | — | 4.1 s (galaktyka), under the 5 s budget from 005A |
| Evidence Pack | — | 83–421 ms per run |

The style statistic is computed once per plan read, before the first label tick, and its time is booked to the CHAINS
subphase (B5F-7, 22–150 ms per plan). `completeBoundary` costs tens of milliseconds on development grids (B5F-9).
Every new loop is bounded; the caps that do not bind or truncate silently are named in `METRIC_EVIDENCE.md` and §AG.

## W. Post-implementation review

Four read-only reviewers tried to falsify the stage (`artifacts/analyzer-005f/post/`; resolution `post/resolution.md`):

| reviewer | question | P0 | P1 | P2 |
| --- | --- | --- | --- | --- |
| A | count hallucination: does condensed recovery hold, are normal labels never expanded, can a scale create a count | 2 | 2 | 4 |
| B | bounded search and performance | 0 | 2 | 9 |
| C | envelope and body false positives | 2 | 3 | 5 |
| D | overfit and generalization | 1 | 3 | 8 |

**Every P0 and P1 is closed before the freeze**, each by a generic rule with a test that fails on the code before it:

- **A5F-1 (P0)**: the decisive count trusted a style that is not the label's face (`145` → `1115` SUPPORTED; `730` →
  `10` SUPPORTED under a title-block style). A count no variant's own reader cut is AMBIGUOUS; a merge is never decisive.
- **A5F-2 (P0)**: width doubt carried the hypothesis gates, so the stage's own `2590` at the blind house's 11 px cap read
  `190` SUPPORTED. Under the style, width doubt is contract A5 as written.
- **A5F-3 / D5F-6 (P1)**: a value of another digit count could contest a scale (A's fixture: a true 2.0 cm/px replaced
  STRONG by a wrong 2.5). It is no alternative any more.
- **A5F-4 (P1)**: variants cutting different counts left the class unaware. The reading is AMBIGUOUS.
- **C5F-1, C5F-2 (P0)**: glazing evidence depended on the way up; a walled yard rode in with a room. Symmetric glazing
  off the junction; a part is the floor reached from the house.
- **C5F-3, C5F-4, C5F-5 (P1)**: chain coverage, vehicle depth through walls, a dashed line alone as room evidence.
- **B5F-1, B5F-2 (P1)**: the part cap dropped a real room silently; glazing on two sides only.
- **D5F-11 (P0)**: a production comment named a development house; the guard failed. **D5F-1 (P1)**: the typed refusal
  counted stray tokens. **D5F-2 (P1)**: the calibration record did not exist. **D5F-12 (P1)**: the boundary loop on
  Morelach continued after the reviews; a test and a full matrix rerun were required.

**The rerun D5F-12 asked for found one more regression**, which the fixes themselves had introduced: on Marcówki's attic
plan the reachability split (C5F-2) kept only a strip's corner at the door, and the continuation test, asked of that
corner, answered itself; the attic's envelope moved and the garage gained a storey (exterior closure 0 → 4 errors). CI's
Marcówki row and its no-reference check failed on the same commit. Continuation is judged on the part as the outline
encloses it (`41e26be`); the matrix was re-run on the fixed code and is clean against the pre-review matrix (§T).

P2s are fixed, documented as declared limits, or carried as debt (§AG); none is silent.

## X. PRE_HOLDOUT_6_SHA

**`65ae015fd1e32e6e0de312b0d78301d9a4d07f03`**, pushed to `analyzer/adaptive-segmentation-envelope-v1` and
`claude/new-session-3kzcgh`. CI run 145 (`37018192503`, push) on it: 37 jobs, 36 green, `preview-latest` skipped by
design; completed 15:01:28Z. The tree was clean. Its production code is `41e26be`'s, on which the final development
matrix ran; the commits after it are the matrix and evidence records. The only commit between the freeze and the blind
runs is the ledger line (`951a4d0`).

## Y. Blind pool and seed

`holdout/README.md` Round 6, fixed before the freeze: two ARCHON families, one pick each, from the committed round-1
pool (`POOL_SHA256 = 800c2a1e…2ed41`), excluding 45 families (`excluded-families-round-6.txt`,
`0f9bb150…ae9d`: round 5's 43 and its two draws, now development houses).

- `seed = SHA256(PRE_HOLDOUT_6_SHA + "BUILDPLAN-005F-ADAPTIVE-SEGMENTATION-ENVELOPE-HOLDOUT")` =
  `7d572d71218e0acaaa3a39de61e25456b2444933359f8aae5c40699c253eea2c`; 2462 drawable addresses, 623 excluded.
- `i1 = seed mod 2462 = 164`: **`dom-pod-milorzebem`** (`…/projekt-dom-pod-milorzebem-21-gb-mdab2497c5cb47`).
- `i2 = 802` (the second pick over the other families): **`dom-w-helikoniach`**
  (`…/projekt-dom-w-helikoniach-3-e-oze-md6026d579e43f`).
- Recomputed independently; neither family appears in any exclusion file, under `stage-reports/`, in the code or in CI.
- Each address ran once, live, at the frozen code, with the Evidence Pack on (`ANALYZER_EVIDENCE=1 TELEMETRY=1`),
  cache and output outside the repository. Nothing was re-run. Run records and packs:
  `artifacts/analyzer-005f/holdout/`, `evidence/blind-*` (verify against their manifests).

## Z. Blind project 1 — `dom-pod-milorzebem`: ALGORITHMIC_FAIL

Refused by name, `RECONSTRUCTION_FAILED / METRIC_RESOLUTION_INCONCLUSIVE`, typed `DIMENSION_EVIDENCE_INCONCLUSIVE` (4
witnessing labels on 4 lines). No scale was adopted, so no wrong building was built. The checklist finds nothing
source-limiting (overalls legible, walls 11 px), so the refusal is algorithmic. 171 s wall, 734 MB, longest tick gap
2.6 s (network).

The plan is a narrow house, 6.5 × 12.7 m (published 82.81 m²): `1270` on the vertical overall, `648` and `650` on the
horizontal.

| label | 005D read | 005F as-read | class |
| --- | --- | --- | --- |
| `1270` (519.5 px) | `1770` | `1270` (right) | SUPPORTED |
| `650` (265.5 px) | `610` | `650` (right) | AMBIGUOUS |
| `648` (265.5 px) | `008` | **`608`** (`648` its next value, at 0.22 of it) | **SUPPORTED** |

Both overalls are read right and state 2.445 cm/px; the misread `608` states a rival 2.290, and the metric refuses
with each at one independent group. The count was right on every label: the stage's count machinery decided nothing
here (no decisive count on the selected plan).

## AA. Blind 1 — first divergence / first bad decision

**`e00047`, `OCR_SEQUENCE_CANDIDATES`, `ink:text-region-280-734-c61c6f0d9b:HORIZONTAL`**: the `648` ink's lattice
`608|000,008,048,108,600,648,808`, as-read `608` SUPPORTED (p 0.487), the truth its next value (0.22 of it). Its twin
copy (`e00053`) reads the same. Then `e00058` `READ:608` → `e00059` `BOUND` PRIMARY (2.290 cm/px) → the metric's
refusal.

The digit count is right (three cells). The `4` is read `0` at the right count: a confident single-glyph misread, the
class's declared limit (calibration record: 005E's CLEAR misreads, `8`→`6` and `9`→`4`, are the same failure). It is the
same kind of error that keeps modrzewnicy unread (§C, §Q: `9`→`4` in the right four cells).

## AB. Blind project 2 — `dom-w-helikoniach`: ALGORITHMIC_FAIL

Completed: 1 body, 77.56 m² against the published 95.61 m² (**−18.88 %**, fails), **1 storey of 2** (fails), every
printed opening built (holds). 188 s wall, 790 MB, longest tick gap 4.6 s (network).

The ground plan prints `1360` (= 1263 + 97) and `700` (= 326 + 374): 7.00 × 13.60 m. **The ground scale is right**:
CONFIRMED/INCONCLUSIVE at 2.305 cm/px (590 px × 2.305 = 13.60 m; 305.5 px × 2.305 = 7.04 m).

Two failures, each independent of the other:

- **Storeys.** The attic plan keeps its page vote, 3.08 cm/px, which no reading supports (LEGACY_UNCONFIRMED); it
  prints no overall, and its room chains (`300` + `300`) and its drawn walls (about 307 px across) state about 2.3. Its
  chain extent is a 3.2 m strip of a 7 m plan, so its registered envelope covers too little of the ground body for any
  mass to reach up (`NO_MASS_REACHES_UP`).
- **Footprint.** The ground box (x 158–459 × y 189–752, about 90 m²) is right, but the plan is cut on its opening-aware
  outline: the body ends at the inner face of the mostly glazed west wall, and at y 710, before the lower end of the
  west room and the recessed entrance the 97 cm segment states.

The 005F extent conflicts were raised on both sides the chains state (N STRONG, 7.31 m past the long-band box; S STRONG,
0.97 m) and judged INCONCLUSIVE: the parts the outline left there are wall-thick ink (`WALL_SLIVER`). Nothing was
invented.

## AC. Blind 2 — first divergence / first bad decision

**`e00319`, `METRIC_RELATION`, the attic plan (`rzut-f6160738fd`)**: LEGACY_UNCONFIRMED at the page vote's 3.08 cm/px —
the first wrong decision in the run's order, and the storey failure's cause through the attic's narrow extent and
registration.

**Second, independent: `e00335`, `ENVELOPE`, the ground plan**: "the outline continues the box's interior past its edge
(2 components): the plan is cut on the outline" — the box (`e00334`) held the west wall band and the south strip; the
mass (`e00350`, x 181–459 × y 189–710) does not. That is the 005C boundary layer's choice between the box and the
outline, not this stage's completion rules, which raised the conflict and correctly built nothing from wall-thick ink.

Neither is patched in 005F.

## AD. CI

| run | event | commit | result |
| --- | --- | --- | --- |
| 140 | push | `a991e6b` | green (the matrix before the post-reviews) |
| 143 | push | `145e3ba` (code `f64fda9`) | **red**: `Analyzer / development house (marcowki)` and `Core / Analyzer / Reconstruction` (the no-reference Marcówki check: "every body reaches the same storeys") — the regression §W describes; cancelled by the next push |
| 144 | push | `9cf798c` (code `41e26be`) | 35 of 35 completed jobs green, the UI evidence gate still running; cancelled by the next push |
| **145** | push | **`65ae015`** = PRE_HOLDOUT_6_SHA | **green**: 37 jobs, 36 green, `preview-latest` skipped by design |
| 149 | `workflow_dispatch` (`owner_apk`) | `05c53c5` (the report) | **red**, OWNER APK job skipped: (1) the production hard-code guard, in five jobs (`Core`, the evidence-pack, opening-aware envelope `Generic source`, dimension-evidence `Production hard-code guard` and generalization `Purity` steps — all run `tests/architecture/generalization.test.ts`). Round 6 sealed `dom-pod-milorzebem`, so the guard's registry took the preposition `pod` for a house word and found it in a generic adapter's example slug and in `podłog` (`ł` has no NFD decomposition, so `\bpod\b` matched). (2) The UI evidence gate: the default-font pass of `ProductFlowDeviceTest` timed out (5 s) waiting for the saved task (`ProductFlowDeviceTest.kt:140`), so its screenshots 03–16 were never taken; the font-1.3 pass of the same test in the same job went through that step, and no Android source, asset or workflow differs from run 145, where the gate was green |
| final | `workflow_dispatch` (`owner_apk`) | the guard fix (below) | §AF |

**After the freeze, one test-only change.** `tests/architecture/generalization.test.ts` adds Polish prepositions (`pod`, `nad`, `przy`, `przed`, `obok`) to the words that name no house. The noun after one still does and stays registered: the blind houses' `helikoniach` and `orzebem` (from `Miłorzębem`) are still caught. No production file changed after `PRE_HOLDOUT_6_SHA`, so the blind runs and their verdicts are untouched. The UI evidence gate's timeout was not patched; the next run shows whether it recurs.

The 005F gates: `Adaptive glyph count`, `Numeric reader (lattice, corpus, metric adversaries) under the 005F class
bars`, `Extent envelope and body completion`, the dimension-evidence and evidence-pack jobs (the 005F packs verified once
committed), and one development-house job per row, with modrzewnicy required to refuse
`DIMENSION_EVIDENCE_INCONCLUSIVE`, Morelach to pass on its printed scale, and aster-viii and galaktyka to refuse
`NO_DIMENSION_EVIDENCE`.

## AE. Commits

27 commits on `analyzer/adaptive-segmentation-envelope-v1` from `9b619ec` to the freeze, each pushed to the branch and to
`claude/new-session-3kzcgh`:

- reviews and contract: `e6f76d2`;
- workstream A: `5eb2a5b` (count hypotheses, style, counter-safe cuts, tail), `8906546` (typed refusal), `dd95020` →
  reverted in part by `d910212` (class bars);
- workstream B: `177dfca` (extent conflict, attached room, box completion);
- Evidence Pack: `489e2b5`; tests, docs, CI, versions, holdout: `e6fe6bc`, `b048b3f`, `7fce34d`, `28c33ae`, `10a958c`,
  `fbc716c`, `f4eb80f`, `a991e6b`;
- post-review fixes: `4fd2f8e`, `65ebbdd` (C, B), `2e1889a`, `ac5c5fc` (D), `f64fda9` (A), `41e26be` (the matrix's
  finding);
- records: `6bfd98d`, `3c50fe2`, `7e58a08`, `145e3ba`, `9cf798c`, `65ae015`.

After the freeze: `951a4d0` (the ledger line), `43c6670` (the runs, packs and verdicts), `05c53c5` (this report and PROJECT_STATUS), then the guard's registry fix (§AD) and the OWNER APK record.

## AF. OWNER APK

The final CI is a `workflow_dispatch` of the BuildApp CI on the guard fix (§AD); it publishes the OWNER APK to
`owner-preview-latest`. Its analyzer code is the frozen code (`PRE_HOLDOUT_6_SHA`; only documents, sealed evidence
and the guard's test registry differ). The downloaded file's verification — ABI, version, run and commit, embedded analyzer versions,
SHA-256 and signer — is recorded in the commit after this one, in this section. No APK binary is committed.

## AG. Residual debt

Reading:

1. **modrzewnicy's `2590`**: the classifier reads the `9` as a `4` at the right count (0 of 420 exhaustive cuts per
   variant read it); the de-skew slope also spoils `2`/`5` on 11 px ink (A5F-6, 005D front end).
2. **A count recovered without its value** can make an unreadable ink a wrong-valued AMBIGUOUS witness (A5F-7).
3. **Wrong-count readings the lattice raised no count for** stay CLEAR (`185` → `85`): a declared limit (A5F-5). A's
   FIX_A was measured and not shipped (it costs every right reading of an off-style face).
4. **The calibration's knife edges**: corpus 5001 exactly at 005E's SUPPORTED precision; the held-back corpus below it
   (.678 against .6875). Not re-tuned.
5. **Bounds the records do not show** (B5F-3..6): the cell cap bounds hypotheses, not the ink (measured 118 scorings);
   the per-count, count-text and tail caps truncate silently; an alternative the cell cap starved is still listed.
6. **Style and completion timing** (B5F-7..9): the style is untickled and booked to CHAINS; `styleFor` and
   `completeBoundary` have super-linear pieces (tens of milliseconds on development plans).
7. **The tail guard is a source scan**, not a type (A5F-8).

Envelope and bodies:

8. **Only Morelach exercises the accepting paths**, the house they were iterated on; `envelope-without-attached` is
   load-bearing there; the garage end sits 8 % above `vehicleMinM` (D5F-3).
9. **Morelach's exterior joint findings rose 4 → 8** with the completed parts (`EXTERIOR_JOINTS`, LIMITING).
10. **A wall-thick parapet with a glazed balustrade is a bay's drawing** and is built as one (C5F-6, declared limit).
11. **The contract's per-stretch component cap and AMBIGUOUS decision** were not implemented (B5F-10); B5's shadow
    lines at wall-band axes were not implemented (D5F-6).
12. **ON == OFF on a house with completions** is observed (D's Morelach run) but not gated (D5F-8).
13. **CHAIN_CORRECTED values anchor registrations** (005E B5E-6), now exercised: modrzykach's slab moved 0.17 m.

Blind round 6:

14. **Confident single-glyph misreads at the right count** (blind 1 `648` → `608` SUPPORTED; modrzewnicy's `9` → `4`):
    the next stage's input (§AH).
15. **An upper plan's page-vote scale is kept with no independent support**, and its narrow chain extent registers onto
    too little of the ground body for a storey (blind 2, `e00319`).
16. **The 005C outline adoption gives up wall and floor the box held**: a mostly glazed wall is read to its inner face,
    and a strip the box held below the rooms is dropped (blind 2, `e00335`).
17. **The extent conflict measures its gap against the long-band box**, not the adopted envelope, so it can report a gap
    (7.31 m on blind 2) the outline has already built: a noisy record, not a decision.

## AH. Next step

**Return to the coordinator with the glyph classifier's confident misreads at the right digit count as the next stage's
input**: blind round 6's first bad decision (`dom-pod-milorzebem`, `648` read `608` SUPPORTED, `e00047`) and the
reason modrzewnicy stays unread (`2590`'s `9` read `4` in all 420 exhaustive four-cell cuts). Both are the same failure
in the matcher on small, condensed digits, after this stage's count fix. `dom-pod-milorzebem` and `dom-w-helikoniach`
join the development set; `dom-w-helikoniach`'s attic-plan scale and ground outline faces (§AC) are recorded for the
stage after. A further claim needs a new blind draw on a new frozen SHA.
