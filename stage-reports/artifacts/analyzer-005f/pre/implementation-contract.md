# 005F implementation contract (coordinator's synthesis of pre-reviews A–D)

Four read-only reviewers answered one question each (`CONTEXT.md`):

- A: `segmentation-count-review.md`
- B: `beam-tail-review.md`
- C: `envelope-extent-review.md`
- D: `attached-body-review.md`

This contract is what the coder implements. Where two reviews disagree, it says which one it follows and why. Every
bound below comes from a reviewer's measurement on the cached bytes. No bound was chosen to make a named house pass.

## 0. What the reviews established (measured)

- **`2590` is a count error, then a classifier error.** The touching per-glyph width on ARCHON plans is 0.405–0.538 of
  the cap height (median 0.49). `round(w / 0.55·h)` counts a 4-glyph run right only above 0.481. `2590` measures
  0.477, so it is cut into 3 (A P0-1). At the right count the `9` cell scores `4` 0.50 against `9` 0.26 (ratio 0.52,
  under the candidate ratio 0.6). `2590` is the top reading of none of 360 exhaustive four-cell cuts (A P0-2). **The
  count rule cannot make `2590` the reading. It makes the count honest.**
- **The face is not condensed: the cap is small.** Isolated glyph width / cap is 0.455 on modrzewnicy against
  0.462–0.571 on the development houses (A P1-1). The plan's own glyph width, filtered by cap, is the style statistic.
- **The image score cannot choose a count.** A forced extra glyph reads a valid dimension in 117 of 165 cases and
  scores at least as well as the truth in 64 (A P0-3). The count comes from width against the page's style plus
  topology gates. **Scale never chooses it.**
- **`1950` is lost at the count bound (rank 10 of 18), not at the floor** (B P0-1). Floor, beam width and non-top
  limits lose no development truth. Lowering any of them recovers 0.
- **No OCR change can flip the modrzewnicy refusal under the 005E protections.** `1410` is a stable SUPPORTED misread
  that only a tail contest could neutralise, and a tail contest is forbidden (B P0-2). The house is expected to stay
  refused, now honestly typed.
- **Nothing compares the chain extent with the box** (C P0-1). The Morelach bay is enclosed. Its junction (a counter
  line drawn across the open side) reads as a STRONG vehicle door, so `adopt` sees no continuation (C P1-1, D P0-1).
- **The garage end is inside the box.** The EXCLUSION outline encloses it (5.93 m²), but `adopt` discards in-box gains
  unless something beyond the box is accepted (C P1-2, D P0-2).
- **Accepting a part re-tiles the masses.** Largest-first tiling then merged the garage into the main body, and
  storeys fell from 2 to 1 (C P0-2). Mass stability is mandatory.

## 1. Workstream A: the numeric reader (`metrics.numeric-lattice` 1.1.0)

### A1. Local dimension-font style

- **What it is.** `dimensionStyleOf(read)` is computed once per plan read. Its samples are, for every raw token of
  1–6 glyphs, the DEFAULT-mask ink runs whose width / cap lies in [0.35, 0.80]: isolated glyphs.
- **`p̂` for a label.** The median over samples whose cap is within ×/÷1.25 of the label's cap. It needs at least 8
  such samples, otherwise the label has **no style**.
- **Also recorded** (Evidence Pack only): sample count, median slant, median gap / cap.
- **What it never sees.** Values, chains, scale or published facts.

**Deviation from the brief, stated.** The brief builds the profile from CLEAR/SUPPORTED labels. A class depends on
the count, so a profile built from classes would feed back into the count it decides (a cycle). The style is therefore
taken from every raw token at the label's cap. A measured that cap filtering is what makes it local (P1-1: the plan's
CLEAR/SUPPORTED list spans caps 10–44 px).

### A2. Count admission and alternatives

Per ink run of each ink variant's anchor, with anchor count `a` and `r_k = w / (k·cap)`:

- **Admitted.** A count k is admitted when 0.75 ≤ r_k/p̂ ≤ 1.30 with a style, or 0.40 ≤ r_k ≤ 0.70 without one.
- **Candidates.** Only k ∈ {a−1, a+1}. A k is a candidate when all of these hold:
  - it is admitted;
  - it fits better than a: |ln(r_k/c)| < |ln(r_a/c)|, with c = p̂, or 0.49 without a style. This applies only when a
    is itself admitted;
  - every boundary has a valley option that does not cut a counter;
  - for k > a, every boundary's valley depth is ≥ 0.35.
- **Bounds.** At most one candidate per direction per variant, so ≤ 3 counts per variant.
- **Decisive.** When a style exists, a is not admitted and a candidate is, the candidate's count replaces the anchor's
  for that variant. This is the only way a reader's count changes.
- **Otherwise** the candidate's segmentations enter as RECUT paths flagged `countAlt`. They pay the re-cut penalty and
  add ≤ 2 new texts per ink, outside 005E's 4/6.
- **Caps.** Segmentations per count per variant ≤ 16 (005E's machinery at the count's own pitch). Per variant ≤ 48.
  Per ink ≤ 144. **Scored cells per ink ≤ 96** (hard cap; A measured a maximum of 42).

### A3. Counter safety

- **What a counter is.** A hole (background component, 4-connected, off the crop border) at least max(2, 0.2·cap) px
  tall, whose pixels are ≥ 50 % hole in **every** other ink mask re-sheared at this mask's slope.
- **When a boundary breaks it.** A boundary at column b breaks counter H when:
  - H.x0 < b ≤ H.x1; or
  - b = H.x1 + 1 and no counter starts at b + 1 (wall); or
  - b = H.x0 and no counter ends at b − 2 (wall).
- **Anchor re-cut.** An anchor cut that breaks a counter moves to the deepest non-breaking valley in its window, with
  the count unchanged.
- **Pruning.** Re-cut and count-alternative hypotheses that break a counter are pruned. Pruning was preferred over a
  penalty: it is as accurate at half the cost (A Q3).
- **Measured.** e-OZE `1600` and dabecjach `1580` re-anchor right. Development CLEAR 9 → 18, all right.

### A4. Weak joint-path retention: the ambiguity tail (B §3)

- **Rule.** `TAIL_BOUNDS = { substitutions: 2, glyphRatio: 0.7, glyphShare: 0.2, perInk: 2 }`. The pool is the final
  beam frontier of ANCHOR paths only. Eligible texts have **exactly two** non-top glyphs, each with score ≥ 0.7 × the
  cell's best and `top − score ≤ T·ln 5` (share ≥ 0.2). The text must state a dimension and not be among the emitted
  values.
- **Order.** (round6 logP desc, text asc), deduplicated by value after sorting. Keep 2.
- **Record.** `tail[]` beside `sequences`: no `p`, never as-read, outside the normalisation.
- **Unchanged.** `sequences`, `p`, `asReadP`, margins, entropy, `truncatedBy`, `mergedCount` and `emittedMass` are
  byte-identical to what A1–A3 alone produce. The floor is never lowered: every tail value is ≥ 0.04 of its path's
  best, above the 0.01 floor.
- **Consumers. No decision consumer reads `tail`.** That covers M1–M7, contest, alternatives, `valueAmbiguity`,
  corrections, structural and SCALE_RANKED. B's optional record-only SCALE_RANKED fallback is **not** implemented: B
  measured it right once and wrong once at the true scale. The tail is a recorded image candidate, for the Evidence
  Pack and the next stage. An architecture test forbids the decision functions from naming it.

### A5. OCR confidence with count ambiguity (A C6 and B 3.3 combined)

Let d be the as-read's digit count.

- An emitted valued sequence with a different digit count at p ≥ 0.10 makes the class **AMBIGUOUS**.
- Any other emitted valued sequence with a different digit count caps the class at **SUPPORTED**.
- An as-read variant anchor that is *width-ambiguous* makes the class **AMBIGUOUS**. Width-ambiguous means some run
  admits a count a ± 1 that fits at least as well as a.
- **A 3-vs-4 ambiguity is never CLEAR.**
- Stability (005E) still applies first.
- Recorded on the lattice: `countAmbiguity: { counts, decisive, widthAmbiguous, rivalP }`.

`OCR_CLASS_BOUNDS` stays unchanged unless the development refit (A C9) shows a precision loss. Any refit happens on
FIT plus corpus 5001 only and is reported per split.

### A6. Metric boundary (A C7)

- A SCALE_RANKED or correction value whose digit count differs from the as-read is never selected. Scale never crosses
  a count.
- Everything in 005E M1–M7 stands. Only as-read values witness.
- The tail and count alternatives never witness, seed, contest, corroborate or count.

### A7. Typed refusal (§14)

- The kind is `NO_DIMENSION_EVIDENCE` (no label bound to a dimension line and no legacy chain on the frame) or
  `DIMENSION_EVIDENCE_INCONCLUSIVE` (otherwise).
- It is recorded in the METRIC_RESOLUTION_INCONCLUSIVE diagnostics, with label and line counts. The "what is missing"
  sentence and the plan failure's own sentence follow it.
- Android: "na rzucie znalazłem wymiary, ale nie udało się z nich jednoznacznie ustalić skali".
- Implemented before this contract (it needs no measurement).

## 2. Workstream B: the boundary (`boundary-evidence` 1.1.0)

### B1. `ENVELOPE_EXTENT_CONFLICT` (C §4.1–4.3)

Computed in `boundaryExtension`, per extent side.

- **SUPPORTED.** The axis provenance is not WALL_GEOMETRY_EXTENT, and an EXTERIOR chain that covers the wall witness
  ends within one wall of the side, on a non-REJECTED mark.
- **STRONG.** SUPPORTED plus either:
  - two such chains whose baselines are more than one wall apart and whose ends agree within one wall; or
  - one closing chain with a READ or CHAIN_CORRECTED segment.
- **Gap.** `dir·(e_s − box_s) ≥ 2·wallPx`. Development non-conflict sides are ≤ 0.95 walls; the smallest real strip is
  2.19 walls.
- **Stretches.** The parts of the side where no BUILT cell lies within one wall. A stretch is at least 2 walls long.
  At most 2 per side.
- **Caps.** 4 conflicts × 2 stretches × 2 components.
- **Record.** Always recorded, whatever the decision: side, gap (m and walls), strength, chain ids, stretches,
  components and decision.
- **Acts only when STRONG.**

### B2. Body-completion candidates and clipping (D §3 C)

- **Parts.** 4-connected components of cells enclosed by the EXCLUSION outline that are:
  - (A) beyond the box and not accepted by 005C `adopt`; or
  - (B) inside the box but not built by the box's reading (box completion).
- **Clip.** C1: free floor is the part's pixels that are not WALL-kind solid ink, in connected components at least
  0.75·wallPx in both directions. C2: core cells are those with ≥ 25 % of their pixels on free floor. C3: keep core
  cells and the cells within 1 wall of a core cell. No core means rejected as `WALL_SLIVER`.
- At most `MAX_BODIES` (16) parts per plan. Record the part's rect before and after the clip.

### B3. Acceptance (D §3 rules 1–5, C §4.4)

- **A part beyond the box (ATTACHED_ROOM) is built only when all of these hold:**
  - it lies in a STRONG extent-conflict stretch and its outer edge is within one wall of the stated side (C E1);
  - **way in:** open edge plus bridged gaps on the junction ≥ 0.7 m. Gaps count only if their boundary is not NONE,
    their signature is LEAF_AXIS, LEAF_FACE, DASHED or BLANK, and neither jamb is a POST (a window is not a way in);
  - **walled:** on its own perimeter, WALL ≥ 0.5 and POST < 0.1 of the length;
  - **room evidence:** a STRONG GLAZING gap with WALL/CORNER jambs on its perimeter, or an in-part dimension chain with
    ≥ 2 ticks covering ≥ 50 % of its free floor along that axis, or a vehicle door;
  - **returns:** two perpendicular wall lines in its span covering ≥ 75 % of the depth (C E5);
  - it is inside the extent ± 0.5 wall;
  - **policies agree:** STRICT encloses it too, or every WEAK closure on its perimeter is a vehicle door (B4).
- **A part inside the box (BOX_COMPLETION) is built only when:**
  - it continues built cells across an open edge ≥ max(0.7 m, 0.5 × the shared length) (D rule 1); and
  - the policies agree as above.
- **Caps.** A part's area ≤ 0.5 × the box reading's built area. All completions together ≤ 0.5 × that area. Otherwise
  the decision is `QUESTION`, not built. A built cell is never removed.
- **Decisions.** ACCEPTED / REJECTED (with the failed guard) / QUESTION per part. Per conflict stretch: ACCEPTED /
  ZONE (no component, posts or line work only) / INCONCLUSIVE (wall fragments, nothing passes) / AMBIGUOUS (two
  overlapping passing components; neither is built).

**Disagreement resolved.** D accepts an attached room without a conflict; C acts only on a STRONG conflict. This
contract follows C for parts beyond the box (precision first). It follows D for in-box completion, which has no
extent side by construction.

### B4. Vehicle door (D rule 4: garage end)

A WEAK gap closes the topology in both policies only when all of these hold:

- jambs are WALL/WALL;
- width is 2.2 m ≤ w ≤ 3.2 m;
- signature is LEAF_FACE, DASHED or LEAF_AXIS (never BLANK);
- depth behind it, through the part and the built cells it continues, is ≥ 4.5 m.

It stays `occupancy: OPENING`: physically open, topologically closed (005C semantics).

### B5. Shadow lines at wall-band axes (D)

- Add a shadow line at the axis of every wall band inside the extent with no line within 0.5 wall. Cap: 16 per axis.
- **Ships only if the matrix shows no development model moving because of it.** Otherwise it is dropped and recorded
  as debt. Morelach's garage line exists today through an unread chain tick.

### B6. Mass stability (C §4.6, mandatory)

- An accepted ATTACHED_ROOM becomes its own mass, attached to the mass it opens into.
- A BOX_COMPLETION extends the mass it continues only along that mass's whole side. Otherwise it becomes its own mass,
  or is dropped as a sliver.
- **The incumbent masses are never re-tiled.**
- **Acceptance check:** storeys equal the labelled plans on every development house and on Morelach.

### B7. Separation

- The decision is made in `decomposePlan`, before the resolver. H0 and its completions are never two resolver
  readings, so the published-footprint scoring cannot choose the envelope.
- The published area appears only in the verdict.

### B8. Out of scope, recorded as debt

- The counter line read as a vehicle door (C P1-1).
- The front-door jamb read as a POST that leaks candidate B (C P1-3).
- Willa-miranda's face strip (C P1-4).
- Willa-miranda's outdoor entry step already built through `kept` (D P1-2: fixing it moves willa from −5.07 % to about
  −7.9 %).

## 3. Evidence Pack

Timeline stages added, observational only. Each is recorded only where it has something to say, so a pre-005F pack
reads ABSENT there:

- **`GLYPH_COUNT_HYPOTHESES`** (before `OCR_SEQUENCE_CANDIDATES`). Per bound ink whose count set is more than the
  anchor's: `COUNTS:<as-read count>|<alternatives>` plus decisive/width-ambiguous.
- **`ENVELOPE_EXTENT_CONFLICT`** (after `ENVELOPE`). Per raised conflict: `<side>:<decision>`, with parts.

Pack files gain:

- `07-ocr-labels.json`: per lattice, `countHypotheses`, `style`, `counterCuts`, `tail` and a `segmentation` telemetry
  block.
- `11-envelope-candidates.json`: `extentConflicts`.
- `13-body-candidates.json`: `completions` with clipped rects and reasons.

Numbers and boxes only. ON == OFF, determinism and manifests hold.

## 4. Gates

- **adaptive-glyph-count** (synthetic, `renderLabel` with `condense`):
  - 4 condensed digits at 0.40–0.50 pitch counted 4 with a style;
  - 5 condensed;
  - normal spacing unchanged;
  - a true 3-digit label never emits a 4-digit value at p ≥ 0.10 without the class being AMBIGUOUS;
  - touching pairs; counter-heavy `000`/`0000` never split;
  - the two-weak-substitution tail;
  - a genuine merged glyph;
  - a mixed 3/4-digit page style;
  - bounds;
  - scale never chooses a count.
- **numeric-reader:** every 005E adversary and corpus gate. Recall, as-read and CLEAR precision are never below 005E.
- **extent-envelope** (synthetic fixtures, D §6 and C's tests):
  - flush bay with OPEN, COUNTER or DOOR junction;
  - terrace instead;
  - oversized bay clipped;
  - garage with a wide door at the body end;
  - strong extent with no enclosure;
  - canopy inside the extent;
  - L-shaped flush wing;
  - walled yard;
  - every 005C negative.
- **development:** the 18-house matrix, with Morelach's scale gated and storeys 2/2, and modrzewnicy typed refusal.
