# STAGE BUILDPLAN-ANALYZER-005D — dimension-chain integrity, spurious-tick rejection, overall-span consensus, Analyzer Evidence Pack

| verdict | result |
| --- | --- |
| DIMENSION CHAIN TOPOLOGY | **PASS** — a spurious mark no longer splits a total (Azalia's 204.5 REJECTED, the overall bound across it); real internal ticks stay ends (§42, the matrix: no model hash moved); on both blind houses every mark, span and hierarchy decision on the overall lines was right |
| OCR LABEL-TO-SPAN BINDING | **PARTIAL** — the binding is right on every development and blind overall (centred PRIMARY spans, Azalia's `1055` over 77–633); the values bound are not: on both blind houses the overall figure was misread with the printed value outside the bounded readings (`1580` → `1501`, `1173` → `1117`), the failure §28 looks for, declared as a reader limit before the draw |
| METRIC EVIDENCE INDEPENDENCE | **PARTIAL** — one ink one witness (I2), twin lines once (I5), V3 against the vote and the rivals, the figure never choosing (both blind runs: verifier only); but on blind 1 two misreads on two chains counted as two independent witnesses and confirmed a wrong scale STRONG, one of them (`810`) with a runner-up that fits the rival, and the recorded total/children conflict did not unsettle it |
| CURRENT e-OZE DEVELOPMENT | **PASS** — MUST_COMPLETE: 123.99 m² (+1.57 %), model unchanged, REPLACED/STRONG from `1601` read as printed (§R) |
| LEGACY e-OZE COMPATIBILITY | **PASS** — its own lane, printed "not current acceptance": the sealed 005A evidence completes by the drawing's own reading (−4.21 %, −4.37 %, the figure VERIFIED), both decoys refused by name (§S) |
| ANALYZER EVIDENCE PACK | **PASS** — post hoc, ON == OFF, byte-deterministic, manifest-verified, no publisher pixel; 16 packs committed (the bound); both blind first bad decisions named from the packs written during the one run (§N–P, §AA–AD) |
| 005C BOUNDARY REGRESSION | **PASS** — dom-w-modrzykach, dom-w-zurawkach, willa-miranda, the terrace and gap negatives unchanged (§U) |
| 005C GENERIC SOURCE REGRESSION | **PASS** — no source-reader file changed; Aster VIII's facts and documents as before (§U) |
| BLIND ARCHON ROUND 4 / PROJECT 1 (`dom-w-dabecjach`) | **ALGORITHMIC_FAIL** — refused `BOUNDARY_RESOLUTION_INCONCLUSIVE` on a plan registered at a CONFIRMED/STRONG 2.672 cm/px where the printed overalls state 2.81; first bad decision `OCR_READING` `1580` → `1501` (§AA, §AB) |
| BLIND ARCHON ROUND 4 / PROJECT 2 (`dom-w-tunbergiach`) | **ALGORITHMIC_FAIL** — completed at −12.47 %, storeys 1 of 3; first bad decision `OCR_READING` `1173` → `1117`, which tied the true `1000` one reading to one and kept the page vote's scale INCONCLUSIVE (§AC, §AD) |
| **Stage** | **PARTIAL** — `PARTIAL_BUILDPLAN_ANALYZER_005D_BLIND_ARCHON_OVERALL_LABEL_MISREAD`. Both blind houses fail algorithmically; not patched (protocol) |

Branch `analyzer/dimension-chain-integrity-v1` (every push also to `claude/new-session-3kzcgh`), from
`analyzer/opening-aware-envelope-v1` @ `1b66eb98562e0d501be10da581b87ba9273c76c7`. Legacy (`BuildPlan-PC-Legacy`)
was not touched. No drawing, PDF page, render or overlay of any publisher is committed: only text facts, hashes,
numbers, and the analyzer's own SVG primitives and model renders in the Evidence Packs.

---

## A. Baseline — 005C PARTIAL accepted

- **Start.** `analyzer/opening-aware-envelope-v1` @ `1b66eb98…` verified (HEAD, clean tree); the new branch was
  created from it. 005C's PASSes are kept as they were: the opening-aware envelope, the cross-publisher generic
  source, the 005B metric regression, telemetry, dom-w-modrzykach and dom-w-jablonkach PASS, boundary evidence
  1.0.0, the generic reader 1.2.0.
- **Reproduced, not assumed.** With the frozen 005C code, outside the repository (publisher bytes in a scratch
  cache): Azalia completes at −3.48 % resolved by the published figure alone (verdict ALGORITHMIC_FAIL); the sealed
  005A e-OZE evidence refuses (`PLAN_RESOLUTION_INCONCLUSIVE`, the figure spent); the current e-OZE row completes
  (PASS, model `b4e76f04…`).

## B. Focused pre-implementation reviews

Four read-only reviewers, each told only its question, measured on the development houses' own bytes (commit
`7a18d21`, `artifacts/analyzer-005d/pre/`): A dimension-graphics topology, B OCR / label binding, C chain hierarchy
and the overall role, D resolver / first-success recovery; `implementation-contract.md` is the synthesis.

1. **A:** the Azalia mark at x = 204.5 on the ground copy's overall line is the edge of a light watermark; it passed
   both mark tests on the binary ink mask alone (`crossThickness`, `crosses()`), and nothing compared a mark with the
   line it sits on. An unclassified mark is a mandatory boundary, so it outweighed the true span. The same
   mechanism exists on development houses, masked because their labels are read; near-duplicate marks 6.5–7.5 px
   from a real tick were found too.
2. **B:** the same ink was counted for two scales and for the vote; the decisive gate was per binding, not per ink,
   so skipping ticks made short labels decisive; fixing that alone exposes misread overall labels, so a binding fix
   had to ship with value neutrality (V3). "One ink" was not one ink (a page-sized pseudo-token merged 193 tokens).
3. **C:** the overall label was bound to a watermark-cut span (Azalia) and a planter-cut span (G2E, masked by the
   vote); the hierarchy was post hoc and noisy; a single outer reading is one witness whatever its share.
4. **D:** the flow consulted the published figure before the drawing; pre-1.2.0 evidence had no challenge at all;
   the resolver's own "drawing evidence" read the legacy segment bindings and pointed at the wrong scale.

## C. Azalia — the first bad decision

Ground copy, overall line H645.5, marks at 77, 204.5 and 633 px (005C reader, `metric-evidence.json` of the
round-3 blind run):

- The mark at 204.5 is a lighter wedge, one-sided, wider than a stroke (peak contrast κ = 0.667 of the line's).
  005C took it as a tick: the chain became [77, 205.5, 633].
- The italic overall figure, printed `1035`, read `1055`, was bound to the cut-off part 205.5–633 (427.5 px,
  2.468 cm/px) — ACCEPTED — while the same ink over the whole line (556 px, 1.897 cm/px) was REJECTED.
- The page vote kept 2.468 (LEGACY_UNCONFIRMED/WEAK); the independent alternative did not outweigh it twice over.
  The plan's first reading failed, and the resolver chose the reading the published figure liked (−3.5 %, no
  witness) — the verdict's ALGORITHMIC_FAIL.

**First bad decision:** `DIMENSION_TICK_CLASSIFICATION`, object `tick:chain-horizontal-646-…:204.5`, ACCEPTED (005C)
→ REJECTED (005D) — what the first-divergence helper names between the two packs (§P).

## D. e-OZE gate semantics

- **CURRENT e-OZE — MUST_COMPLETE.** Today's reader on the sealed package (`analyzer-005b/dev/rarytasy-eoze`): the
  development row `rarytasy-eoze`, `dev-row.mjs pass --metric REPLACED,CONFIRMED --metric-overall`.
- **LEGACY e-OZE — LEGACY_EVIDENCE_COMPATIBILITY.** The sealed 005A evidence (registered at 2.50 cm/px, `1601`
  read `1801`) replayed through today's solver: `known-row.mjs legacy-compat` — complete within 6 % of the
  published footprint however reached, or refuse by name; never a wrong-scale completion; printed as
  `[LEGACY_EVIDENCE_COMPATIBILITY: not current acceptance]`.
- **Decoys.** The same legacy replay with the published footprint ×1.25 and ×0.8 (`--decoy-footprint`) must be
  refused by name: a figure may verify the drawing's scale, never choose it.

## E. The old dimension topology

A dimension line was a long thin straight run crossed by marks; every crossing that straddled the line was a tick
(`ticksPx`), and the chain solver's DP took every tick as a mandatory boundary unless it skipped it at a cost. The
reader bound each label to one interval of one chain (nearest centre, one label per interval), the page vote
pooled every reading, and the 005B independent solver re-bound labels without knowing which marks were real. There
was no notion of a mark's class, of a span skipping a doubtful mark for free, or of a label's alternatives deciding
nothing.

## F. Tick classification (`metrics.dimension-topology` 1.0.0)

Every mark crossing a line is measured against the line it sits on (`classifyMarks`, `dimension-lines.ts`): the
paper and line greys at clean positions, the mark's per-side rows, darkest grey and stroke width (side rows
symmetric about a half-pixel baseline), its colour against the line's. Reasons: `LIGHTER_THAN_LINE` (peak contrast
< 0.75 of the line's), `FAINT_SIDE`, `ONE_SIDED`, `WEDGE_NOT_STROKE` (wider than a stroke and not narrowing),
`COLOUR_MISMATCH`, `DUPLICATE` (a reach apart, the weaker), `STYLE_MISMATCH` (unlike the chain's clean ends),
`NO_LINE_REFERENCE`. Classes:

- `REJECTED` = lighter ∧ (wedge ∨ one-sided) — never ends a span;
- `QUESTIONABLE` = lighter ∨ one-sided ∨ duplicate ∨ style mismatch ∨ (wedge ∧ colour) — a doubted end;
- `TICK` otherwise.

`ticksPx` keeps every mark (nothing that read it moves); the classes are `chains[].marks`. Azalia's mark at 204.5:
REJECTED [LIGHTER_THAN_LINE, FAINT_SIDE, ONE_SIDED, STYLE_MISMATCH, WEDGE_NOT_STROKE]; both ends TICK.

## G. The dimension graph

Per plan frame, recorded in metric evidence schema 1.3.0: every line with its marks (class, reasons); every label
with every candidate span between non-rejected marks (`dimensionObservations[].binding`: role, offset share,
questionable ends, skipped marks by class) and its bounded value alternatives (`valueAlternatives`); the relations
between lines (`chainRelations`, §H); and per solution `topology` — marks by class, bindings by role, neutral inks,
the hierarchy, any value ambiguity. The Evidence Pack draws it (layers 05–09).

## H. Total / segment hierarchy

Between parallel lines of one family (≤ 4 label heights apart): `TOTAL_OF` / `SEGMENT_OF` (a span of one line —
consecutive marks, or the span a label on it is bound to — whose ends coincide with marks of a finer line, l ≥ k+2:
the whole line over a finer one, or one segment of a middle line over an inner one), `PARALLEL_COPY_OF`,
`NESTED_IN`, `CONFLICTS_WITH`. Checked on values as read: `AGREES_AS_READ`, `CONFLICT_AS_READ`, `INCOMPLETE`,
`AGREES_AFTER_CORRECTION` (closed only through the solver's own values — recorded, never evidence). A total and
its children that disagree as read, each side stating one of two scales, with nothing outside the pair to decide
and the leading side not also outnumbering the other, leave the solution INCONCLUSIVE
(`hierarchy.undecidedConflict`): reported, never forced consistent.

## I. Label binding

A label measures the span it is centred on (`bindingsFor`, `primaryBinding`): candidates end only at TICK or
QUESTIONABLE marks, never at a REJECTED one or at a mark inside the label's own box; skipped marks are counted by
class (rejected ones free). Centring decides: the best-centred candidate within 10 % is PRIMARY; a questionable end
only lets a label take a longer span that encloses it and is centred within 5 % of it (a label printed off centre to
clear a planter); another centred candidate of a different length within 5 % makes the label AMBIGUOUS. Only a
PRIMARY binding at least 25 tolerances long, from a legible label without a leading zero, is decisive; one ink is
one witness (an ink whose decisive readings measure different spans or values witnesses nothing — I2); readings of
one dimension drawn on twin lines count once (I5).

## J. OCR value hypotheses

The as-read value is the witness (V2). Up to four one-substitution readings whose glyph ratio is at least 0.7 are
kept beside it (V1, `boundedValues`): never a substitution table, only what the matcher reports for those strokes.
An ink whose alternative fits another scale decides nothing between them — against the page vote (V3, asked
whenever the selection would not simply confirm the vote) and against a rival hypothesis (within at most twice the
ink's own tolerance; neutrality never promotes a rival of lower standing — then INCONCLUSIVE). When the selected
scale rests on one ink with alternatives that move it, `topology.valueAmbiguity` records the interval and the
confidence is at most WEAK (V4). A value proposed because it fits a scale (a correction, a lattice fit) is DERIVED
and never a witness (I4).

## K. Overall-scale consensus

Hypotheses are the scales the counted witnesses state, ranked by the evidence tuple [both axes, corroborated, an
overall reading ≥ 0.8 of its axis, independent groups, weight] — an outer total physically supported outranks
internal segments; two independent outer witnesses outrank one; agreement across axes is explicit
(`isotropy: MEASURED`). The page vote is the incumbent: CONFIRMED, REPLACED only when it had no independent support
and the selection is SUPPORTED or an overall WEAK reading, LEGACY_UNCONFIRMED otherwise. The published footprint is
not an input.

## L. First-success challenge (plan resolver 1.4.0)

A first reading is challenged when the drawing contradicts the scale it was registered at — decided by
`sourceConflictOf`, which is given no published figure: `AS_READ_REFUTATION` (the registration contradicts at least
half the chain length as read, and a stated scale a quarter less), `PARTIAL_BINDING` (an unconfirmed scale resting
on a long reading whose label is centred on a wider span), `OUTER_TOTALS` (two long readings, both axes, two chains,
agree on another scale and outweigh the registration). The challenge runs before the footprint verdict when only the
figure refused the first reading, and after completion otherwise. On a conflict the drawing chooses first — its
best-supported other scale, ranked with the figure's own refusal left out — and the figure then verifies that one
reading (`REPLACED`, `publishedFigure: VERIFIED`) or vetoes it (`REFUSED`, `PLAN_RESOLUTION_INCONCLUSIVE`,
`why: SOURCE_CONFLICT`); a vetoed choice is never followed by the next-best, and a reading that answered the
challenge is not challenged again. Plan extent: an overall line beside the building, bound PRIMARY to its own tick
ends, frames an axis that a line drawn across the building (crossing a wall face) had framed
(`OUTER_TOTAL_MARKS`, weak, only widening).

## M. Published-fact semantics

The published footprint may refuse a reading, and may verify the drawing's own choice; it may not choose OCR,
topology, binding, scale or the replacement. Where the figure refused the first reading it is spent for the
resolver (005A); on a source conflict it is a verifier only (005D). Decoys prove it: the sealed e-OZE evidence with
the figure ×1.25 or ×0.8 is refused by name (§S); a figure sweep on a synthetic house builds one scale or none
(`source-conflict.test.ts`).

## N. Evidence Pack architecture

`@buildapp/evidence-pack` (`docs/EVIDENCE_PACK.md`): built after a run from the files it wrote (`readRunDir` →
`buildEvidencePack` → `writePack`), never imported by production. Files 00–18: source summary, page classification,
asset inventory (address, SHA-256, size, pixel size, type, crop, role — never pixels), layer SVGs with JSON sidecars
(plan frame, wall bands, dimension lines, tick candidates, OCR labels, span hypotheses, scale hypotheses, extent,
envelope, openings, bodies, selected layout), the canonical model summary, the analyzer's own model render (≤ 800 px
wide), the trace, the decision timeline (`18-decision-timeline.json`, stable object ids, stages in analyzer order),
`evidence-summary.svg`, `README.md` and `manifest.json` (every version, hash and file with its SHA-256). Bounds: 3000
elements per SVG, top 200 per layer (omitted counted), 4 plan copies drawn and 8 solved, 1.5 MB per JSON; at most 16
packs committed per stage. `firstDivergence` names the first stage and object two timelines decide differently.
Commands: `evidence:pack`, `evidence:diverge`, `evidence:verify`; mode `ANALYZER_EVIDENCE=1` / `--evidence <dir>`.

## O. Evidence Pack non-invasiveness

- **By construction:** the pack runs after `secondHouse` resolves, from the run directory; no analyzer package
  depends on `@buildapp/evidence-pack` (architecture test), so ordering, heuristics, timeouts, seeds and hashes
  cannot see it.
- **Sealed by test** (`packages/analysis-service/test/evidence-pack.test.ts`): a synthetic house run twice through
  the script, with evidence on and off — every file, every hash (`result-summary.json` hashes, traced decisions) the
  same; writing the pack changes no file of the run; mode off by default; two packs of one run byte-identical,
  manifest included; every required file and sidecar present; no forbidden pattern in any SVG and only analyzer
  primitives (an allowlist the writer does not share); bounds held.
- **On the development houses:** the m4 matrix ran with evidence on; every model hash is compared with the 005C
  matrix in §T.

## P. Azalia Evidence Pack

`artifacts/analyzer-005d/evidence/dom-w-azaliach` (005D) and `…/dom-w-azaliach-005c` (the committed round-3 blind run,
packed after the fact). `npm run -s evidence:diverge -- dom-w-azaliach-005c dom-w-azaliach`:

```
FIRST_DIVERGENCE = DIMENSION_TICK_CLASSIFICATION
object = tick:chain-horizontal-646-750b25df33:204.5
before = ACCEPTED  (UNCLASSIFIED)
after  = REJECTED  (FAINT_SIDE,LIGHTER_THAN_LINE,ONE_SIDED,STYLE_MISMATCH,WEDGE_NOT_STROKE)
28 object(s) differ in that stage; later stages differing: OCR_READING, LABEL_BINDING, DIMENSION_HIERARCHY,
SCALE_HYPOTHESIS, METRIC_RELATION, REGISTRATION, FRAME_SELECTION, EXTENT, ENVELOPE, BODIES, PLAN_RESOLUTION, FINAL
```

(`first-divergence-dom-w-azaliach-005c-to-005d.json`). What the 005D pack shows on the selected ground copy
(`frame-asset-rzut-86bef468f3-…`): 166 ticks, 32 questionable, 3 rejected marks; 17 primary, 26 alternative, 1
ambiguous, 2 uncentred bindings; 4 totals recorded (4 incomplete), 2 parallel copies; the deciding ink `1055`
bound PRIMARY to 77–633 across the rejected mark (`skipped.rejected = 1`), its upside-down shadow `5501` RAW; value
ambiguity `1055` → {1015, 1035, 1053, 1005}, scale interval 1.8076–1.8975 cm/px, which contains the printed
`1035`'s 1.8615; the extent's depth from the outer total line (`OUTER_TOTAL_MARKS`). The first bad decision of the
005D run is no longer in the metric layer: the envelope (layer 11) finds no walled outline on a plan whose outer walls
are piers between glazing on every side, the first reading builds 0.86 m², and the resolver finds nothing the
drawing supports besides the figure that refused it.

## Q. Azalia result — fixed in the metric layer, honestly unresolved downstream

| | 005C (round-3 blind run) | 005D (development row) |
| --- | --- | --- |
| mark at 204.5 | a tick | REJECTED (lighter, faint, one-sided, wedge, style) |
| `1055` bound to | 205.5–633 (the cut-off part) | 77–633, PRIMARY, across the rejected mark |
| metric | LEGACY_UNCONFIRMED/WEAK 2.468 cm/px | REPLACED/WEAK 1.8975 cm/px, value ambiguity named (1035 inside) |
| extent | chain extent | depth from the outer total line (`OUTER_TOTAL_MARKS`) |
| outcome | completed −3.48 %, chosen by the figure alone, storeys 1 of 2: ALGORITHMIC_FAIL | `PLAN_RESOLUTION_INCONCLUSIVE`: the envelope builds 0.86 m² and nothing but the spent figure supports another reading |

Against the §34 targets: the true total survives the spurious tick (yes); the false partial `1055` cannot outrank the
overall evidence (yes — it is no longer a candidate span); the source-supported scale wins (yes, WEAK, with its one
glyph ambiguity named; the printed value is `1035`, so the scale is 1.9 % high and says so); the published figure is
not the chooser (yes — it now chooses nothing); a valid downstream model "if later stages allow" — they do not: the
opening-aware envelope (005C, out of scope) does not close a plan walled by piers and glazing on every side. Azalia is
**fixed generically in the metric layer and honestly unresolved downstream**; its CI row is the named refusal plus the
metric gate (`dev-row.mjs refuse:PLAN_RESOLUTION_INCONCLUSIVE --metric REPLACED,CONFIRMED --metric-overall`).

## R. Current e-OZE — MUST_COMPLETE: PASS

`rarytasy-eoze`: completed, 1 body, 123.99 m² (+1.57 % of 122.07), model `b4e76f04…` unchanged, verdict PASS;
metric REPLACED/STRONG at 2.2235 cm/px, the scale stated by an overall reading on both axes (`1601` as printed, the
metric gate passes). No source-conflict trigger fires on it.

## S. Legacy e-OZE — LEGACY_EVIDENCE_COMPATIBILITY

The sealed 005A evidence (registered at 2.5016 cm/px from `1601` read `1801`) through the 005D solver:

| row | outcome | how | residual |
| --- | --- | --- | --- |
| every copy | completed, 1 body, model `0a0e019d…` | the drawing contradicts the registration (AS_READ_REFUTATION: 92 % of the chain length as read against 24 % at 2.2236); the reading it states replaces the first one; the figure VERIFIED it | −4.21 % |
| area copy alone | completed, 1 body, model `a27f3a5e…` | the same | −4.37 % |
| decoy ×1.25 | `PLAN_RESOLUTION_INCONCLUSIVE`, `why: SOURCE_CONFLICT` | the drawing's choice (2.2236) is vetoed by the decoy figure; the reading the figure would like (the registration, −1.3 % of the decoy) is the one the drawing refutes: neither is built | — |
| decoy ×0.8 | `PLAN_RESOLUTION_INCONCLUSIVE`, `why: SOURCE_CONFLICT` | the same | — |

Before 005D both real rows were refused by name (the figure spent). They are judged in their own lane
(`known-row.mjs legacy-compat`, printed "not current acceptance"); reviewer C swept the figure across 38 factors on
this evidence: the registration's scale is never built, the drawing's 2.2236 only where the figure verifies it
(factors 0.92–1.00 and 0.95–1.00), every other factor refused by name.

## T. Development matrix

`artifacts/analyzer-005d/development-matrix.json`: the 13 development houses offline from their sealed packages
(publisher bytes fetched outside the repository), the 005D code at `3e08681` with the Evidence Pack on; "before" is
the 005C matrix, and for the two round-3 blind houses their committed blind runs.

| house | before (005C) | after (005D) | metric (selected copy) |
| --- | --- | --- | --- |
| marcowki | PASS `6152770f` | PASS `6152770f` = | CONFIRMED/STRONG 2.6425 |
| kosacce-clean | PASS `5b5ffcf1` | PASS `5b5ffcf1` = | CONFIRMED/SUPPORTED 2.4069 |
| kosacce-tracked | PASS `5b5ffcf1` | PASS `5b5ffcf1` = | CONFIRMED/SUPPORTED 2.4069 |
| rarytasy-g2e | footprint:2 `8fa4a25b` | footprint:2 `8fa4a25b` = | LEGACY_UNCONFIRMED/INCONCLUSIVE (was WEAK) |
| rarytasy-eoze (current, MUST_COMPLETE) | PASS `b4e76f04` | PASS `b4e76f04` = | REPLACED/STRONG 2.2235 |
| alt-marcowki | refused METRIC_RESOLUTION_INCONCLUSIVE | the same | LEGACY_UNCONFIRMED/INCONCLUSIVE |
| dom-w-jablonkach | PASS `70b01afd` | PASS `70b01afd` = | REPLACED/WEAK 2.1195 |
| willa-miranda | footprint:4 `1ce47cfb` | footprint:4 `1ce47cfb` = | CONFIRMED/SUPPORTED 2.6809 |
| dom-w-zurawkach | footprint:2 `31ba5eea` | footprint:2 `31ba5eea` = | CONFIRMED/STRONG 2.2178 |
| dom-w-modrzykach | PASS `d4accc9d` | PASS `d4accc9d` = | REPLACED/STRONG 2.7478 |
| dom-w-azaliach | completed −3.48 %, ALGORITHMIC_FAIL | refused PLAN_RESOLUTION_INCONCLUSIVE (§Q) | REPLACED/WEAK 1.8975 (was LEGACY_UNCONFIRMED 2.468) |
| aster-viii | refused METRIC_RESOLUTION_INCONCLUSIVE | the same | NO_SCALE |
| galaktyka | refused METRIC_RESOLUTION_INCONCLUSIVE | the same | NO_SCALE |

**No model hash moved.** The metric-evidence and candidate hashes move with schema 1.3.0 and the new readers
(record-only fields, versions); the model, scene and footprint of every completing house are byte-identical. The one
warning change is G2E's: its page vote's scale is kept but no longer named WEAK — the readings that agree with it are
neutral between it and their own one-glyph alternatives (V3), so it is LEGACY_UNCONFIRMED/INCONCLUSIVE and carries
`METRIC_SCALE_UNSUPPORTED` instead of `METRIC_SCALE_WEAK` (its CI row follows the evidence). Known houses are not
blind proof.

## U. 005C boundary / source regressions

None: dom-w-modrzykach's opening-aware facade PASS (−0.14 %, model unchanged); dom-w-zurawkach's house and garage
(2 bodies, −0.81 %); willa-miranda's four bodies (−5.07 %); the terrace/pergola and unsupported-gap negatives
(`boundary-envelope`, `boundary-post-review`, `attached-bodies` suites unchanged and green); Aster VIII's generic
facts and documents (the live probe in the envelope job). No file of the boundary layer or the source reader changed.

## V. Tests and metamorphics

New suites (all green; counts at the freeze):

- `source-metrics/test/dimension-topology.test.ts` — the fourteen §39 drawn cases (clean total; total over valid
  child ticks; one and two spurious marks; a dark crossing kept but skipped; a text stroke; light hatching; a
  partial label near a total; a total centred over real ticks, and printed on the far side of a line that carries
  its children; a missing child tick never invented; duplicate ticks 2/4/6 px; a broken end tick and a one-sided
  stub; an offset extension line; two hierarchy levels), §42 real internal ticks (two cases), §43 conflicting total
  (undecided → INCONCLUSIVE; decided by an independent reading), §41 nine imagings (downscale 0.9 and 0.8,
  anti-aliasing, lower contrast, 1 px erosion and dilation, padding, crop) with topology and scale clauses
  separated, an extra non-semantic crossing line, reordered copies. The scale clause admits only the right scale or
  no scale adopted; the anti-aliased imaging fails it (the reader reads `1200` as `1100`, truth outside its bounded
  readings) and is declared `it.fails` — a known reader limit, not hidden.
- `source-metrics/test/label-binding.test.ts` — §40 adversaries on hand-made tokens: a `1055`/`1035`-like
  ambiguous overall (alone, across a rejected mark, joined by two unambiguous readings, over children that sum to it
  as read), a `1601`/`1801`-like ink whose alternative fits the other scale, a label between segments, a nearby
  logo, a rotated label across a rejected mark, questionable and rejected ends; §30 independence (a total and its
  off-centre part from one ink, one label between two copies, one ink both ways up); I2, V3 against the vote, a
  conflict the pair decides, a dimension on twin lines (I5).
- `source-metrics/test/glyph-ambiguity.test.ts` — §28: 3/5, 1/7, italic, 0/6/9 turned, kerned 11, broken strokes,
  and the declared blur limit.
- `reconstruction/test/source-conflict.test.ts` — T1/T2/T3 and their negatives; a corrected value judged by what was
  first read; the figure sweep through `reconstructV2` (one scale or none, one challenge).
- `reconstruction/test/plan-extent.test.ts` — the outer-total extent rule and three negatives.
- `analysis-service/test/evidence-pack.test.ts` — ON == OFF, determinism, completeness, no publisher pixels,
  bounds, first divergence.
- `tests/architecture/generalization.test.ts` — the hard-code guard with the 005D printed and misread overalls
  registered (`development-dimensions-005d.json`), extended to the Evidence Pack, the blind verdict and the row
  judges; nothing production depends on the Evidence Pack.

## W. Performance and progress

| measure | value |
| --- | --- |
| mark classification, all plan copies of a house | 36–90 ms (e-OZE 4 copies 663 marks 36 ms; Azalia 8 copies 1140 marks 90 ms) on top of 174–242 ms line finding |
| metric phase (`METRIC_FRAMES`), Azalia run alone | 143.3 s (005C blind run, another machine: 222.7 s); the phase is the reader's, unchanged |
| whole run, Azalia alone | 164.1 s, peak RSS 702 MB, longest tick gap 1.7 s, longest telemetry gap 1.9 s |
| development rows (three in parallel) | wall 36–245 s, peak RSS 666–905 MB, longest tick gap ≤ 2.5 s (galaktyka 3.5 s, unchanged reader on a 1625 × 1700 plan) |
| Evidence Pack generation | 37–271 ms per run, 32 files, recorded apart (`evidence-performance.json`) |

Bounds: bindings per label (spans with at most two skipped marks, centred within 30 %), value alternatives ≤ 4 per
ink, hypotheses `METRIC_BOUNDS.hypotheses`, relations `METRIC_BOUNDS.relations`, rivals checked once each; no
combinatorial step was added. Telemetry is unchanged: the new work runs inside the existing `CHAINS` and `SCALE`
subphases, whose ticks it keeps.

## X. Post-implementation review

Four reviewers tried to falsify the stage (`artifacts/analyzer-005d/post/`): A topology red team, B OCR / value
binding, C circularity / first-success / e-OZE split, D overfit / verification / Evidence Pack / protocol. Their
findings and what was done are in `post/resolution.md`: four P0s (the figure choosing among the drawing's scales on a
source conflict; questionable ends outranking centring; the §41 escape hatch; R9 unable to fail) and ten P1s, every
generic one fixed with a test that fails without it (commit `3e08681`), the rest named as residual (§AH). The m4
matrix and the committed packs are of the fixed code.

## Y. PRE_HOLDOUT_4_SHA

`286486e6c262afa682c1374a3a8f777a6dcf5cd8` — the m4 matrix and the fourteen development packs on the post-review code
(`3e08681`). Before it: the full development matrix (§T), current e-OZE green and legacy e-OZE in its own lane
(§R, §S), Azalia honestly unresolved downstream (§Q), every suite green, the four reviews closed (§X), the Evidence
Pack's determinism and ON/OFF tests green. Pushed to both branches; CI run 120 (`36857800150`): 34 jobs, 32 green and
the 2 APK publishes skipped by design (push), completed 12:43:07Z. Nothing production changed after it: the only
commits since are the ledger line (`bbe8172`), the sealed blind evidence (`446207d`) and documents.

## Z. Blind pool and seed

The round-4 protocol (`holdout/README.md`, Round 4), committed before the freeze: two ARCHON families from the
round-1 pool (`800c2a1e…2ed41`), 41 excluded families (`excluded-families-round-4.txt`, `8c5a4a97…2919`: every earlier
round's families and the round-3 draw, now a development house), 2501 drawable addresses, 584 excluded.
`seed = SHA256(PRE_HOLDOUT_4_SHA + "BUILDPLAN-005D-DIMENSION-CHAIN-HOLDOUT") =
9a6b907da2378dee755be0204bbec684edb46f040018bc7d202d67ef910bd416`; `i1 = seed mod 2501 = 608` →
`dom-w-dabecjach` (`…/projekt-dom-w-dabecjach-2-g2-m1d2240bad8ffb`); the second pick, uniform over the other families
(`SHA256(seed + ":second")`), `i2 = 2130` → `dom-w-tunbergiach` (`…/projekt-dom-w-tunbergiach-7-r2-md842941974a5c`).
One ledger line (12:43:41Z, `bbe8172`), nothing committed between the freeze and the draw. Each house ran once, live,
with the frozen code and `ANALYZER_EVIDENCE=1`; nothing was re-run. The sealed record is
`artifacts/analyzer-005d/holdout/README.md`, with its §52 quality table.

## AA. Blind project 1 — `dom-w-dabecjach`: ALGORITHMIC_FAIL

- **Source.** 23 assets with roles, 8 plan copies (GROUND and ATTIC; 853 px dimensioned and area-table, 550 and 400 px
  dimensioned), 10 published figures (footprint 168.76 m², garage 36 m²); no plan lost. 222.6 s, 773 MB, longest tick
  gap 3.4 s (network).
- **Result.** Refused by name, `RECONSTRUCTION_FAILED / BOUNDARY_RESOLUTION_INCONCLUSIVE`: the first reading covers
  116.52 m² (−31.0 %), the figure refuses it and is spent; the outline is B_STRICT 120.2 m² or B_EXCLUSION 150.9 m²,
  more than 6 % apart; of 95 other readings the best (161.3 m², −4.4 %, at 3.571 cm/px from the misread `1700`) has
  only the spent figure behind it. The checklist finds nothing source-limiting (overall glyphs 12 px, walls 11 px), so
  the refusal is an algorithmic fail.
- **Metric.** The selected ground copy: 83 lines; 192 tick, 93 questionable, 6 rejected marks; 20 primary bindings;
  12 totals, 2 `CONFLICT_AS_READ`. Scale CONFIRMED/STRONG 2.672 cm/px on two independent readings, isotropy MEASURED.
  The printed overalls state 2.81 cm/px on four chains (`1580`/562, `888`/316, `850`/302, `1340`/476 px): the
  registered plan is 4.9 % small in each direction.

## AB. Blind project 1 — first divergence (first bad decision)

There is no earlier run of this house to diverge from; the pack's timeline is read against the printed drawing
(looked at locally, not committed):

| event | stage | decision | right? |
| --- | --- | --- | --- |
| marks on the overall lines | `DIMENSION_TICK_CLASSIFICATION` | ends at 153, 469, 715 (X) and 159, 461, 635 (Y) TICK | yes |
| **`e00229`** | **`OCR_READING`** | **`label:chain-horizontal-738-810fb47ebb:HORIZONTAL:1501`** — printed `1580`; the third glyph `8` read `0` at 0.16 with no runner-up, the fourth `0` read `1`; no bounded alternative | **no — the first bad decision** |
| `e00230` | `LABEL_BINDING` | `1501` PRIMARY 153–715, centred 0.006 | yes (the span) |
| `e00235`–`e00240`, `e00231` | `OCR_READING` | `692` → `643`, `850` → `810` (runner-up `850` at 0.98), `888` right, `1340` → `1700`, `490` → `141` | four more misreads |
| `e00301`, `e00311` | `DIMENSION_HIERARCHY` | `CONFLICT_AS_READ`: total `1501` against `888 + 643 = 1531`; `e00302` `1700` against `810 + 141 = 951` | yes — recorded |
| `e00407` | `METRIC_RELATION` | CONFIRMED/STRONG 2.672 on `1501`/562 and `810`/302 (2.671, 2.682); rival 2.81 (`888`) at 54 % | no |
| `e00458`, `e00459` | `ENVELOPE`, `BODIES` | outline adopted; the garage classed `COVERED_TERRACE`, not built (37.21 m²) | downstream of the wrong scale |
| `e00467`, `e00468` | `PLAN_RESOLUTION`, `FINAL` | INCONCLUSIVE; `BOUNDARY_RESOLUTION_INCONCLUSIVE` | a named stop |

Why 005D's rules did not catch it: the true value is outside the bounded readings, so V1–V4 had nothing to name;
the hierarchy conflict is undecided only when no counted reading outside the pair decides, and `810` — itself a
misread — sat outside it; `810`'s runner-up fits the rival, but rival neutrality acts only when it would swap or tie
the selection. Two misreads agreeing within 0.4 % then made a STRONG scale.

## AC. Blind project 2 — `dom-w-tunbergiach`: ALGORITHMIC_FAIL

- **Source.** 24 assets, 12 plan copies (GROUND, UPPER, ATTIC; the same four kinds), 9 published figures (footprint
  117.74 m²); no plan lost. 201.7 s, 777 MB, longest tick gap 3.6 s (network).
- **Result.** Completed: 1 body 103.06 m² (−12.47 %, fails), 8 openings (every printed one, holds), storeys 1 of 3
  (fails: `PLAN_STOREY_ALIGNMENT_FAILED`), model `9d92a2ea…`, scene `d2f6ce4c…`; warnings
  `LAYOUT_FOOTPRINT_AREA_NEAR`, `LAYOUT_NO_MASS_REACHES_UP`, `METRIC_SCALE_UNSUPPORTED`, `PLAN_EXTENT_FROM_WALLS`.
- **Metric.** The selected ground copy: 62 lines; 140 tick, 55 questionable, 5 rejected marks; 10 primary bindings;
  10 totals, none read on both sides. LEGACY_UNCONFIRMED/INCONCLUSIVE 1.9947 cm/px, isotropy ASSUMED; the printed
  overalls state 2.09 (`1173`/560 px, `1000`/478 px).
- **The figure.** The challenge's trigger fired; the drawing's other reading (2.09205) builds 111.9 m², −4.9 % —
  `AGREES` — and is not adopted, because the drawing does not prefer it (one reading each) and the figure may not
  choose a scale (`publishedFigure: SCORED`). The rule held; the house is still wrong.

## AD. Blind project 2 — first divergence (first bad decision)

| event | stage | decision | right? |
| --- | --- | --- | --- |
| marks on the overall lines | `DIMENSION_TICK_CLASSIFICATION` | ends 132, 692 (X) and 175, 653 (Y) TICK | yes |
| `e00107`, `e00108` | `OCR_READING`, `LABEL_BINDING` | `1000` read as printed, PRIMARY 175–653 | yes |
| **`e00109`** | **`OCR_READING`** | **`label:chain-horizontal-758-e7e091be90:HORIZONTAL:1117`** — printed `1173`; glyph 3 `1` (0.485) over `7` (0.452), glyph 4 `7` (0.436) over `3` (0.405); bounded readings `1177`, `1113`, `1115`, `1137` — the truth needs both substitutions | **no — the first bad decision** |
| `e00110` | `LABEL_BINDING` | `1117` PRIMARY 132–692, centred 0.007 | yes (the span) |
| `e00119`, `e00127`, `e00117` | `OCR_READING` (other copies) | the same figure `1119` (550 px copy) and `1177` (400 px copy); `1000` → `1010` once | the reader is consistent in error |
| `e00181`, `e00182` | `SCALE_HYPOTHESIS` | 2.092 (`1000`) and 1.995 (`1117`), one independent reading each | a tie |
| `e00187` | `METRIC_RELATION` | the page vote's 1.994682 kept (it took `1117`, discarded `1000`): LEGACY_UNCONFIRMED/INCONCLUSIVE | named, but registered at it |
| `e00247` | `FIRST_SUCCESS_CHALLENGE` | KEPT — the drawing prefers neither reading | by rule |
| `e00248` | `FINAL` | COMPLETED, 103.06 m² against 117.74 | the result of the misread |

The storey failure is separate: the upper and attic plans of this twin house register onto no body ("no scaling of
this plan puts its walls on the walls of the plan below"); storeys were out of scope (§37), and the wrong ground
scale is part of why no scaling fits.

## AE. CI

| Run | Commit | Result |
| --- | --- | --- |
| 119 | `1b66eb9` | green (005C's last record; the base of this branch) |
| **120** | `286486e` | **green**: 34 jobs, 32 green, the 2 APK publishes skipped by design (push) — every 005D gate (dimension evidence, evidence pack, the 13 development houses, generalization, plan resolver, envelope, known rows, Android, browser, container). `PRE_HOLDOUT_4_SHA` |
| 121 | `bbe8172` (the ledger line) | superseded by the next push (concurrency group) |
| 122 | `446207d` (the sealed blind evidence) | on the sealed evidence and the hard-code guard with the blind houses registered |
| final | the commit that carries this report | `workflow_dispatch` with the OWNER APK; recorded with the APK in the commit after it (§AG) |

The 005D commits before the freeze were pushed together: CI ran once on them, at the freeze (run 120), green at the
first attempt, the Android UI gate included.

## AF. Commits

Reviews: `7a18d21` (four pre-reviews and the implementation contract). Implementation: `cc9f2ea` (the Evidence Pack),
`0a83a0f` (topology, binding, value hypotheses), `09c5121` (outer totals and the first-success challenge), `6f3f996`
(CI gates). Post-review: `3e08681` (every generic P0/P1). Matrix and packs: `286486e` = **PRE_HOLDOUT_4_SHA**. Blind
round: `bbe8172` (the draw, burned), `446207d` (the sealed runs and packs). Report and status: the commit that carries
this section; the APK record: the commit after it.

## AG. OWNER APK

Built by the final `workflow_dispatch` on the commit that carries this report (analyzer code = the frozen
`PRE_HOLDOUT_4_SHA` code); verified from the downloaded file and recorded in the commit after it.

## AH. Residual debt

Named, not fixed in 005D; each with its evidence.

- **The digit reader on overall labels** (§AA–AD, §V). On both blind houses the overall figure, 12–17 px tall, is read
  as another dimension with the printed value outside the one-substitution lattice (`1580` → `1501` with no runner-up;
  `1173` → `1117`, both true digits runners-up at ≥ 0.9). The same family as the declared blur limit (`it.fails` in
  `glyph-ambiguity.test.ts` and the §41 anti-aliased imaging). 005D bounded and named one-glyph ambiguity; it did not
  change the reader.
- **Rival neutrality acts only on a swap or a tie** (§AB): an ink whose runner-up fits the rival keeps counting for the
  selection while the selection stays ahead.
- **A conflict as read is a record, not a trigger** (C-P2, now seen on a blind house): a total and its children that
  disagree are left decided by any counted reading outside the pair, even one that is itself misread.
- **A tie completes** (§AC): a first reading registered at an INCONCLUSIVE scale between two single readings builds,
  with limiting warnings, at −12.47 %; the figure rightly cannot break the tie. Whether such a plan should be refused is
  the coordinator's question, not a patch.
- **Downstream of a wrong scale** (§AA): the garage classed `COVERED_TERRACE` and B_STRICT/B_EXCLUSION 6 % apart —
  unverified at the right scale.
- **Storeys** (§AC; Azalia, willa-miranda, dom-w-zurawkach): upper plans of a twin house register onto no body;
  storey registration was out of scope (§37).
- **Azalia downstream** (§Q): the opening-aware envelope does not close a plan walled by piers and glazing on every
  side.
- From the post-review (`post/resolution.md`): A-P1-2 dark same-ink marks near an end; B-P2 (the ambiguity interval not
  clipped, a page-sized pseudo-token, lattice-fit orientations); C-P2 (T4/R7/R8/R10 not implemented; T1's refuted share
  already ≥ 0.5 on two correct houses); D-P2 (first divergence reports record-only hierarchy entries first).
- **Time**: the metric phase is 157–178 s of the blind runs' 202–223 s (the reader, unchanged); mark classification adds
  36–90 ms per house.

## AI. Next step

**Return to the coordinator with the round-4 ARCHON defect as the next stage's input: the overall dimension label is
misread with the printed value outside the reader's bounded readings (`dom-w-dabecjach`: `1580` read `1501`, with a
second misread `850` → `810` agreeing; `dom-w-tunbergiach`: `1173` read `1117`), and the metric layer then confirms the
wrong scale or keeps it in a tie (`artifacts/analyzer-005d/holdout/`, `evidence/blind-*`).** Both families join the
development set; a further claim needs a new blind draw on a new frozen SHA.
