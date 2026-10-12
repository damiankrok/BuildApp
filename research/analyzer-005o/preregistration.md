# BUILDPLAN-ANALYZER-005O — pre-registration (written and committed BEFORE any challenger is run)

Stage class: RESEARCH / DIAGNOSTIC / BENCHMARK ONLY. No production file changes (`research/analyzer-005o/freeze-manifest.mjs`
checks `packages/`, `apps/`, `.github/`, root manifests and lockfile, and the embedded OCR assets against
`stage-reports/artifacts/analyzer-005o/production-freeze-start.json`, taken at `b680cd440f7e202ad6813f0a3bffdb563abfa772`).

## 0. What was known when this was written (baseline facts, not results of a challenger)

Measured on the sealed blind-10 evidence of `dom-w-glogownikach`, at the incumbent, before any challenger existed:

- M0 replays byte-identically (`failure.json`, `analysis-trace.json`, plan digest) with and without the research
  harness's module swap (no view given).
- The source conflict that refuses the house (`OUTER_TOTALS`, "501/206 px, 810/333 px agree on 2.432039 cm/px") is
  computed by `plan-resolution.ts` `sourceConflictOf` from **statements**: legacy chain-evidence items
  (`LINEAR_DIMENSION`, origin `READ` / `CHAIN_CORRECTED`), whose "as printed" value is the **classic token reader's
  text** (`ocrTokens[].text`, `metrics.numeric-ocr@1.4.0`), not the lattice and not the ensemble.
- On the selected plan frame the deployed PP-OCRv6 reader read 541 (p 0.99981, stable over the 4-variant bracket) and
  870 (p 0.99952, stable) on the very boxes whose token text is 501 and 810. The ensemble kept both (`CONTESTS` 501/541,
  `LEADS` 870 with 810 a candidate). The metric solution (dimension-observation path) is STRONG at 2.6287 cm/px on both
  axes. So for this house the correct value **existed at the first ensemble** and was lost only in plan resolution's
  as-printed view (class (d) of the brief, sub-class `AS_PRINTED_VIEW_IGNORES_ENSEMBLE`) — to be confirmed by the
  scorer, not assumed.

These facts motivate the challengers below; the challengers are defined so that they can equally well make things
worse, and the scorer is defined so that it would show it.

## 1. Hypotheses

- **M** (primary): with OCR alternatives already present (or re-read from the same source pixels by the deployed
  reader), chain arithmetic and two-axis consistency, the correct printed dimensions are recovered or kept as viable
  candidates without accepting a wrong scale or violating provenance.
- **T** (secondary, diagnostic only): on `dom-w-akebiach`, a bounded noding/polygonization/dangle or polygon boolean on
  the SAME accepted wall line set reveals a missing structural link — or it does not (`NO_KERNEL_BOTTLENECK`).

## 2. The single seam every challenger acts on

All metric challengers change ONE thing: the **as-printed view** of each statement that plan resolution reads
(`zeroSubstitution` / `asRead` in `plan-resolution.ts`), delivered by `as-printed-harness.mjs` (a module swap outside
the repository; the frozen file is untouched). OCR, binding, chains, registration, the metric solution, the layout
re-read at another scale (`metricsAtScale`), scoring and every published-figure rule stay the frozen code. A view entry
is two lists per statement, `zero` and `asRead` (the frozen functions' two outputs); an empty list = the statement
states nothing as printed (ABSTAIN). A statement with no entry keeps the frozen behaviour.

The candidate sources a challenger may use are fixed:

| source | definition (all from the sealed metric evidence unless stated) |
| --- | --- |
| `TOKEN` | the statement's token text, if `/^[1-9]\d{1,4}$/` (exactly the frozen `firstReadCm` test); for origin `READ` the evidence value |
| `ALT` | the evidence item's recorded `alternatives[].value` (the classic reader's runner-ups) |
| `LATTICE` | the numeric lattice on the same frame, same box, same orientation (exact join), its `asRead` value, **only when its own class (`ensemble.lattice.ocrClass`, else `ocrClass`) is CLEAR or SUPPORTED** |
| `LATTICE_PATHS` | the lattice's `paths[].text` values (its own segmentation alternatives) — M2/M3 candidate set only, never a confident reading |
| `EXTERNAL` | the same lattice's PP-OCRv6 reading, **only when corroborating by the frozen ensemble rule**: decision `AGREES` or `LEADS`, or `CONTESTS` with a `rival` whose witness is `EXTERNAL` (posterior ≥ 0.9, mean p ≥ 0.9, stable over BASE/PAD2/TRIM1/SCALE90, the model's own unconstrained answer equal to the digits) |
| `REREAD` (M1b only) | the deployed PP-OCRv6 (`inlineRecogniser`, pinned model `9ef676d6…`, WASM `3398c10d…`) run by the research script on the statement's own token crop, cut exactly as production cuts it (`labelCrop` from the pass field, `RECOGNISER_CROP` padding, the same 4-variant bracket), corroborating by the same frozen `ensembleOf` rule; **only for statements whose token has no lattice** (no external reading exists for them) |

A value is any of the above parsed by the frozen `dimensionValueOf`/token test. The same crop read by two readers is
**two estimators of one raster, never two witnesses**; nothing below ever counts reader agreement as independent
support for a scale.

## 3. Challengers

- **M0 — incumbent.** No view. Run twice: frozen module (no alias) and harness without view; both must be identical.
- **M1 — reader consensus, image-free** (no new pixels read). Confident readings of the statement's ink:
  K = {TOKEN} ∪ {LATTICE if confident} ∪ {EXTERNAL if corroborating}. If |K| ≤ 1: no entry (frozen behaviour). If the
  confident readers disagree (|K| ≥ 2): ABSTAIN (`zero = asRead = []`): a label its own readers dispute states nothing
  as printed — neither for the registration nor against it.
- **M1b — M1 plus targeted crop re-read.** As M1, with `REREAD` added to K for statements without a lattice. Run only
  if the re-read reproduces the sealed external readings bit-for-bit on statements that HAVE one (crop-pipeline
  validation); otherwise `NOT_RUN` with the measured mismatch.
- **M1P — exploratory promotion (pre-registered as exploratory, adoption-ineligible on its own).** As M1, except when
  the lattice is not confident and EXTERNAL corroborates (`LEADS`): as-printed = [EXTERNAL] (frozen READ rule for
  `dependsOnScale` kept). Measures the risk of letting the stronger reader's value VOTE, not only abstain.
- **M2 — chain constraints only, legacy candidates** (candidates = TOKEN ∪ ALT ∪ LATTICE_PATHS; no EXTERNAL).
  1. *Segment-sum-to-overall.* Equation = a statement O on chain A and k ≥ 2 consecutive statements S₁…S_k on one
     other chain B of the same frame and axis, every segment between S₁ and S_k carrying a statement, with
     |O.from − S₁.from| and |O.to − S_k.to| ≤ max(3 px, 1 % of O's span). Holds when |ΣS − O| ≤ 1 cm on the current
     as-printed values. Violated: enumerate single substitutions (one member → one of its candidates); exactly one that
     restores the equation → that member's as-printed = [that value] (`ARITHMETIC_RESOLVED`: scale-free, so it may vote);
     zero or several → every member ABSTAINS. A member without an as-printed value → equation skipped.
  2. *Two-axis consistency (isotropy contest).* A long statement (≥ 15 % of its axis's chain extent on the frame) whose
     as-printed value disagrees by > 3 % with a scale on which ≥ 2 long statements of the OTHER axis, on ≥ 2 chains
     not related by `PARALLEL_COPY_OF`, agree within 3 %, while one of its own candidates agrees with that scale →
     ABSTAIN. It never promotes (a value chosen because it fits a scale cannot then vote for it).
- **M3 — M1 + M2.** Contest by M1's K (with REREAD if M1b ran); arithmetic over candidate sets K ∪ ALT ∪
  LATTICE_PATHS: enumerate assignments (each member a value of its set; product capped at 10⁴, else skip); a unique
  satisfying assignment in which every contested member takes a value from its CONFIDENT set K → those members
  `ARITHMETIC_RESOLVED`; none → all members ABSTAIN; several → contested members ABSTAIN. Then M2's isotropy contest.

Order of evaluation: M0 (both) → M1 → M2 → M3 → M1P → M1b (if validated) → M3b (M3 with REREAD). No challenger
definition is changed after its first run; a defect found later is fixed as a NEW, separately named variant with the
original result kept.

## 4. Data, split and truth (offline scorer only)

- Cases: `research/analyzer-005o/cases.json` — the 42 005N development rows plus blind round 10 (both now revealed
  development). **Not fresh holdout.** No fresh blind draw in 005O.
- Families: rows of one house design form one family (`rarytasy` ×4, `kosacce` ×3, `marcowki` ×2, every other row
  its own family; publisher groups ARCHON vs DobreDomy (`D0x`) reported separately). Statistics are clustered by
  family; no transform of one family is a second sample.
- **Label truth**: blind double transcription of every statement crop (`statement_crops.py`, `label_sheets.py`): two
  independent transcribers per sheet see only the enlarged crop and a sheet-local number — no reader output, no
  value, no case; sheets shuffle houses; 4 synthetic controls of known value per sheet measure the transcribers.
  Truth = both transcribers agree on the same reading (or both say NOT_A_LABEL); otherwise `UNCERTAIN` (excluded and
  counted). The brief's evaluation values for `dom-w-glogownikach` (541, 870, scale ≈ 2.629 cm/px) are checked against
  this truth, not substituted for it. Truth never reaches a view generator: the generator's inputs are the sealed
  metric evidence (and, for M1b, the pixels); the scorer is a separate script.
- **Frame truth scale**: per plan frame, the largest cluster (±2 %) of truth-value / segment-px over statements with a
  truth value, supported by ≥ 3 statements on ≥ 2 chains and both axes → `TRUE_SCALE` (median of the cluster);
  otherwise `UNKNOWN` (excluded from scale scoring, counted).

## 5. Metrics

Label level (statements with a truth label): `EXACT_LABEL` per reader (TOKEN, LATTICE asRead, EXTERNAL top, ensemble
reading); `TOP-K_CANDIDATE_RECALL` at the first lattice/ensemble (truth ∈ TOKEN ∪ ALT ∪ LATTICE ∪ LATTICE_PATHS ∪
EXTERNAL topK); per variant the as-printed outcome `CORRECT` / `ABSTAIN` / `WRONG` (wrong value stated as printed);
`BOUND_CONSISTENT` (truth/px within 3 % of TRUE_SCALE: correct chain and binding) vs `BOUND_INCONSISTENT`; pixel-backed
corrections = statements whose as-printed changes from WRONG to CORRECT through a pixel reading.

House level (end-to-end replay): outcome (COMPLETED / refusal code), the scale built at, `CORRECT_SCALE` (within 3 %
of TRUE_SCALE — the frozen code's own agreement tolerance, fixed in advance, never fitted per house),
**`FALSE_CONFIDENT_SCALE`** = COMPLETED at a scale outside 3 % of TRUE_SCALE (reported separately from every refusal,
and per family), `UNRESOLVED` = refused, verdict by the committed predicates (`holdout/verdict.mjs`, as in 005N's
`dev-matrix.mjs report`), model hash change vs M0.

Statistics: paired per-family deltas vs M0; 95 % intervals by family-cluster bootstrap (10 000 resamples, seed 5050)
and Wilson intervals for rates; denominators always printed.

Runtime: wall time and sampled peak RSS of each replay process; for M1b the re-read's cold (session open + first
crop) and warm per-crop p50/p95 on this x86 container, Node 22 and Node 18.20.4. No Android or ARM64 figure is
measured or implied.

## 6. Winner rule (fixed now)

1. **Safety first**: zero newly COMPLETED-at-a-wrong-scale and zero changed model on any row that is a known-good
   control (M0 COMPLETED and verdict PASS); zero new `FALSE_CONFIDENT_SCALE` anywhere. Any violation = `NO_ADOPTION`
   for that variant (reported as a trade-off, never tuned away).
2. Then source-backed correct-scale gains (rows moving to CORRECT_SCALE COMPLETED, each traced to a pixel reading or
   an arithmetic resolution — never to a published figure, a file name or truth).
3. Then retained abstention (refusals where TRUE_SCALE is UNKNOWN or evidence is insufficient stay refusals).
4. Then latency / RSS.

No unique safe gain → `NO_METRIC_ALGORITHM_GAIN`. A variant that wins is a recommendation for a separate production
stage with its own freeze and fresh blind, never an adoption here.

## 7. Adversarial controls (required, run against the research implementation)

- Missing-candidate control: on a copy of the `dom-w-glogownikach` evidence with every EXTERNAL reading removed, M1 and
  M3 must NOT produce 541/870 and must keep refusing (no conjured value).
- Broken-implementation controls (mutations of the view generator, each must change a scored outcome): M1 that
  promotes on CONTESTS; M2 that accepts a substitution chosen by agreement with the registration; M3 that counts two
  readers of one crop as two witnesses; a generator that reads the truth file.
- Source-correlation control: two readers agreeing on one crop never increase the number of independent witnesses
  (asserted on the generator's output).
- Synthetic chain corpus (logic level, family-split, seeded): overall missing; segments contradicting the overall;
  contradicting axes; a two-scale drawing (ground copy and area copy); a label belonging to a parallel chain; inverted
  / mirrored readings; no scale at all. Expected outcomes are written before the run.
- Synthetic glyph corpus (pixel level, seeded, rights-cleared fonts only: DejaVu, Liberation, FreeFont, Bitstream
  Charter, Courier 10 Pitch, plus the repository's own stroke font): lookalike pairs (541/501, 870/810, 3/8, 1/7, 6/5,
  0/9), cap heights 10–16 px, blur and JPEG; ≥ 50 cases per family, ≥ 5 families; each label read by the frozen lattice
  and the deployed PP-OCRv6. If the corpus cannot be produced: `INSUFFICIENT_VALIDATION`.

## 8. Budget

Each end-to-end variant: 44 solver-only replays (~10–25 s each, 2 in parallel on 4 cores). Total replay budget ≤ 3 h
CPU. M1b re-read ≤ 300 crops. Transcription: 26 sheets × 2 transcribers. The akebiach topology diagnostic: one bounded
experiment if, and only if, the first-bad trace demonstrates a low-level noding/polygonization/boolean operation on the
accepted line set (JSTS / Clipper2 / polygon-clipping pinned in a scratch directory outside the repository, never in a
`package.json`); otherwise `NO_KERNEL_BOTTLENECK` with the measured reason.
