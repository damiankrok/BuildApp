# 005F post-implementation review D — overfit / generalization

Reviewer D (read-only). Brief's code: `d910212` (HEAD `a991e6b` adds one CI commit). **HEAD moved during this review**:
`4fd2f8e` (12:16, post-review B/C fixes to the boundary completion), `65ebbdd` (12:27, "only floor one can stand in is
a room behind a wall") and `2e1889a` (12:29, the D5F-1 fix), all unpushed. The matrix evidence (`/home/user/work005f/m-c`, all 20 rows) and my
probes are at `d910212`; findings D5F-11/12 are on `65ebbdd` (unchanged at `2e1889a`). Every number below was measured by me on the evidence
named, or by a probe I ran on a scratch copy of `snap-c` (`/home/user/work005f/post/scratch-D/snap-D`, outside the
repo). Scripts and outputs are in `/home/user/work005f/post/scratch-D/`. Nothing in the repository was edited by me (the
working-tree edits seen during the review, later committed as `65ebbdd` and `2e1889a`, are the coordinator's).

**Verdict.** At `d910212` the production code is free of development fingerprints, the OCR candidates are image-only,
the metric cannot choose a glyph count, the tail feeds no decision and the published footprint is read by no new code;
the class refit was reverted to a defensible bar. **From `65ebbdd` on (still at `2e1889a`) the production guard is red**: a comment names
Morelach and its measured window reveal (D5F-11, P0). What is not generic is where the stage was validated: every
accepting path of the boundary completion is exercised by one house, the one it was iterated on with its published
footprint as feedback — and that loop continued after the post-reviews (D5F-12); its new alignment target is
load-bearing there; the styled count bound is placed by the one label it was built for. One user-facing regression
(the typed refusal told two plans that print no dimension that it found dimensions, D5F-1) is fixed at `2e1889a`; I
checked the rule on all four refusal rows.

Counts: **P0 1 · P1 3 · P2 8.**

## P0

### D5F-11 (P0) — HEAD `65ebbdd` names a development house, and its measurement, in production code; the guard fails

- **Where.** `packages/reconstruction/src/boundary-completion.ts:366-368` at `65ebbdd`:
  "stays with the walls (Morelach's window reveal, a 0.5 × 0.3 m sliver behind a pier, is no yard)".
- **Reproduce.** `cd /home/user/BuildApp && npx vitest run tests/architecture/generalization.test.ts` → 1 failed:
  `boundary-completion.ts: WORD morelach in "…stays with the walls (morelach's window reveal, a 0…"` (run on a clean
  tree at `65ebbdd`; the comment is unchanged at `2e1889a`). The rule "no project-specific literals, names or thresholds in production" is broken in a
  committed file, and CI's generalization gate will fail on push.
- **Fix.** Describe the case generically ("a window reveal or a niche narrower than a door, behind a pier, is no yard")
  and drop the measured 0.5 × 0.3 m. Re-run the guard before pushing.

---

## P1

### D5F-1 (P1, fixed at `2e1889a`) — The typed refusal said "dimensions were found" on plans that print none (galaktyka, aster-viii)

- **Where.** `packages/reconstruction/src/plan-diagnostics.ts:98-104` (`dimensionEvidenceOf`), consumed by
  `v2/reconstruct-v2.ts:237-243` and `plan-diagnostics.ts:149-153`; copy in
  `apps/android/.../AnalyzerFailure.kt:157-161`.
- **What is wrong.** `NO_DIMENSION_EVIDENCE` requires *zero* dimension observations and zero legacy chains. Any noise
  token the 005D topology bound to any line (UNCENTRED, LOW_QUALITY) flips the plan to
  `DIMENSION_EVIDENCE_INCONCLUSIVE`, and the phone then says *"na rzucie znalazłem wymiary, ale nie udało się z nich
  jednoznacznie ustalić skali"* — false for both plans.
- **Evidence** (m-final, identical in m-c):

  | row | 005E message | 005F kind | what was "found" |
  | --- | --- | --- | --- |
  | galaktyka | "prints no dimension chain … it prints none" (correct: 005C stage report §AB, "the plan prints no dimension, confirmed on the raw copy"; CI comment `buildapp-ci.yml:1176` "its plans print no legible dimension") | `DIMENSION_EVIDENCE_INCONCLUSIVE`, "2 labels on 2 lines" | `01`, `10` (UNCENTRED), `111` (PRIMARY) — 0 legacy chains |
  | aster-viii | "prints none" (correct: 005C stage report §R, "Aster's scale is stated only by its 1:500 outline PDF") | `DIMENSION_EVIDENCE_INCONCLUSIVE`, "1 label on 1 line" | `215` UNCENTRED, LOW_QUALITY — 0 legacy chains |
  | dom-w-modrzewnicy | "prints none" (wrong — the stage's motivating defect) | `DIMENSION_EVIDENCE_INCONCLUSIVE`, 17 labels / 10 lines | right |
  | alt-marcowki | "an overall dimension read the right way up …" | `DIMENSION_EVIDENCE_INCONCLUSIVE`, 9 / 23 | right (23 legacy chains) |

  The stage fixed the modrzewnicy message by producing the mirror-image error on the two development plans that really
  print nothing. The unit test (`failure-codes.test.ts`, 005F block) only covers 0 vs ≥ 1 observations; CI gates the
  kind only on modrzewnicy (`buildapp-ci.yml:1201`), not on galaktyka/aster-viii.
- **Reproduce.** `node /home/user/work005f/post/scratch-D/refusal-fix.mjs /home/user/work005f/m-final` (prints shipped
  kind, label/line counts and the fix below for every row); or read `failure.json` → `diagnostics.dimensionEvidence` in
  `/home/user/work005f/m-final/{galaktyka,aster-viii}`.
- **Smallest generic fix.** Count as dimension evidence only what could witness: labels whose observation is `PRIMARY`
  and not `LOW_QUALITY`. `DIMENSION_EVIDENCE_INCONCLUSIVE` when the frame has a legacy chain, or ≥ 2 such labels on
  ≥ 2 distinct lines (the refusal's own "two readings on different chains" minimum); otherwise
  `NO_DIMENSION_EVIDENCE`. Measured on all 20 matrix rows: galaktyka → NO (1 label on 1 line), aster-viii → NO (0),
  modrzewnicy → INCONCLUSIVE (9 labels on 6 lines), alt-marcowki → INCONCLUSIVE (legacy chains); every completed row
  stays INCONCLUSIVE. Add `--dimension-evidence NO_DIMENSION_EVIDENCE` to the galaktyka and aster-viii CI rows and a
  unit case with one UNCENTRED/LOW_QUALITY observation.
- **FIXED at `2e1889a`** (read, not re-run): `dimensionEvidenceOf` implements this rule (it also counts observations
  with no binding; none exist on these frames), CI gates aster-viii and galaktyka on `NO_DIMENSION_EVIDENCE`, and a
  unit case covers UNCENTRED / LOW_QUALITY / one-label inputs. Replayed on `m-c`: galaktyka NO (1 label,
  1 line), aster-viii NO (0), modrzewnicy INCONCLUSIVE (9 labels, 6 lines), alt-marcowki INCONCLUSIVE (23 legacy
  chains). What remains: re-run the two refusals so their `failure.json` and the phone's sentence are seen to change.

### D5F-2 (P1) — The class refit's cited record does not exist; what it must say includes a held-back miss and knife edges

- **Where.** `numeric-lattice.ts:75-88` (comment: "the margin restores it on both, keeping the most right readings of
  the bars tried (005F calibration record)"), `docs/METRIC_EVIDENCE.md` ("what decided the margin, and what it costs,
  is in `stage-reports/artifacts/analyzer-005f/calibration/README.md`"). That file does not exist
  (`stage-reports/artifacts/analyzer-005f/` holds only `pre/`). The contract (A5) requires the refit "reported per split".
- **Judgement of the refit (d910212: SUPPORTED 0.35, both margins 0.5).** Replayed with
  `node /home/user/work005f/post/scratch-D/replay2.mjs grid` over `calib/{dev-lattice,corpus-5001,corpus-9017}.json`
  (finer grid than `calib/replay.txt`: SUPPORTED 0.30–0.45, margin 0.30–0.70, CLEAR margin tied or fixed at 0.3).

  | split | 005E code, 005E bars (005E README) | 005F code, 005E bars | **005F shipped (0.35 / 0.5)** | 005F at dd95020 (0.4 / 0.5) |
  | --- | --- | --- | --- | --- |
  | FIT | C 3/3, S 11/17 (.647), C+S .700 | C 8/8, S 9/16 (.563), C+S .708 | C 8/8, **S 9/13 (.692)**, C+S .810 | S 7/11 (.636) |
  | HELD_BACK | C 6/6, S 3/5, C+S .818 | S 4/7, C+S .769 | S 4/6 (.667), C+S .833 | S 3/5 |
  | TARGET | S 6/7, C+S .857 | S 2/3, C+S .857 | S 1/1, C+S 5/5 | S 0/0 |
  | corpus 5001 | C 38/42, S 58/87 (.667), C+S 96/129 (.744) | S 52/83 (.627), C+S 102/138 (.739) | C 49/52, **S 38/57 (.667)**, C+S 87/109 (.798) | S 36/54 |
  | corpus 9017 | C 42/44, S 55/80 (.6875), C+S 97/124 (.782) | S 47/72 (.653), C+S 103/131 (.786) | C 55/58, **S 41/60 (.683)**, C+S 96/118 (.814) | S 37/53 |

  - **Defensible as a general rule: yes, with stated costs.** 0.5 ("the next value at most half of the reading") is a
    round a-priori ratio; it is the *smallest* margin in the grid that brings SUPPORTED precision back to 005E's on
    both fitting splits (0.45 fails FIT .600 and 5001 .646; 0.55 passes with fewer right readings). Raising SUPPORTED to
    0.4 (dd95020) fails FIT (.636 < .647) and was chosen for a label in **no** calibration split (Morelach `642`→`602`,
    p 0.382, margin 0.590 — confirmed in `m-c/dom-w-morelach/metric-evidence.json`); d910212's revert is correct and its
    message's numbers check out.
  - **But it sits on knife edges that the record must name.** (a) Corpus 5001 is restored to *exactly* 005E's
    precision (38/57 = 58/87 = 2/3): one more wrong SUPPORTED fails the criterion. (b) On FIT the bar lands just above
    two wrong readings (`1470` for `1474`, margin 0.492; `805` for `845`, 0.488) and just above a right TARGET reading
    (tunbergiach `280`, 0.478, now AMBIGUOUS). (c) On the **held-back corpus SUPPORTED precision is 41/60 = .683, below
    005E's 55/80 = .6875** — the check split misses the very criterion the refit was chosen on (by under one label).
    (d) The criterion (SUPPORTED-only precision) is confounded: counter-safe cuts moved 5 right FIT readings from
    SUPPORTED to CLEAR, which lowers SUPPORTED precision without any harm. On C+S precision the 005E bars lose nothing on
    FIT (.708 ≥ .700) and < 1 label on 5001 (.739 vs .744); margin 0.4 would already restore both (.739, .746) and keep
    6 more right 5001 SUPPORTED readings. (e) Recall cost: right C+S readings 96 → 87 on 5001, 97 → 96 on 9017, 6 → 5
    on TARGET; right SUPPORTED 58 → 38 and 55 → 41. (f) `clearMargin` 0.3 was inert in 005E (implied ≥ ⅓ at p ≥ 0.6);
    at 0.5 it is not: −1 right CLEAR on each corpus (5001 50/55 → 49/52, 9017 56/59 → 55/58). The test
    "one margin bar for both" makes this a structural choice, not a fitted one — say so. (g) The revert to 0.35
    readmits one wrong-*count* SUPPORTED reading on 9017 (`54` for `191`, p 0.390, margin 0.555): at HEAD the
    confident wrong-count readings are 2 on 5001 (`40` for `917`, `4950` for `49110`) and 2 on 9017 (`85` for `185`
    CLEAR, `54` for `191`), all TOUCHING — not the "0 and 1" the pre-review projected (measured: `corpus-sens.out`,
    `calib/corpus-*.json`).
  - **Matrix consequences of the bars** (all explained by the generic rule, none hidden): rarytasy-g2e CONFIRMED STRONG
    → WEAK (its witness `1470`, a misread of 1474, drops from SUPPORTED at margin 0.492 — honest);
    dom-w-morelach CONFIRMED WEAK → INCONCLUSIVE at HEAD (`602`, a misread, rises from p 0.34 to 0.38 under the 005F
    count machinery, becomes SUPPORTED, and stands as `BETTER_CLASS_RIVAL` for a wrong 3.079 cm/px rival with *blind*
    confidence STRONG; the model, the scale and the PASS are unchanged and CI expects `LIMITING:METRIC_SCALE_UNSUPPORTED`).
  - **The 0.4 bar's only effect was its target.** Comparing the complete HEAD matrix (`/home/user/work005f/m-c`, 0.35)
    with the e6fe6bc matrix (`m-final`, 0.4) row by row (relation, confidence, false consensus, model hash, refusal
    kind): **dom-w-morelach's confidence is the only difference in 20 rows.** That is the overfit signature dd95020
    had; d910212 removes it.
- **Fix.** Commit `analyzer-005f/calibration/README.md` with the table above (per split, C, S and C+S, right counts),
  the grid tried, the criterion used and why SUPPORTED-only, the held-back miss (c), the knife edges (a, b), the
  CLEAR-margin cost (f), and the two matrix consequences. Until it exists, the code comment and the doc cite a record
  that is not there.

### D5F-12 (P1) — After the post-reviews the boundary loop on Morelach continued, and HEAD's newest rule has only Morelach as evidence

- **Where.** `4fd2f8e` and `65ebbdd` (`packages/reconstruction/src/boundary-completion.ts`, `layout.ts`,
  `plan-decomposition.ts`).
- **Facts.** `4fd2f8e` applied post-reviews B and C (walled-off parts, symmetric glazing, chain ticks at both ends,
  vehicle depth across open edges only). The coordinator's check runs: `/home/user/work005f/d-check/dom-w-morelach`
  (snapshot `snap-d` = `4fd2f8e`, 12:17): **−6.48 %, ALGORITHMIC_FAIL**, 2 masses; `views-dbg` (12:21); `e-check`
  (`snap-e`, 12:22): −3.12 %, PASS; committed as `65ebbdd`, whose message says the rule was added because Morelach went
  "−3.12 % → −6.48 %". The new rule — unreached free floor is a walled-off room only when it is a door's width
  (`COMPLETION_BOUNDS.doorM`, 0.7 m) across both ways — reuses an existing bound and is plausible in general, but:
  `65ebbdd` changes one file and adds **no test**; its only evidence is the motivating house, judged by its published
  footprint; and **no development matrix exists at `4fd2f8e` or `65ebbdd`** (only Morelach was re-run), so `m-c` no
  longer describes HEAD's boundary layer for the other 19 rows (12 of which record completion parts).
- **Fix.** Before the freeze: (1) a synthetic test of the new rule both ways (a niche narrower than a door behind a
  pier stays with the part; a door-wide walled room beside the part is WALLED_OFF), drawn in the five orientations
  `4fd2f8e`'s tests use; (2) rerun the full development matrix at the freeze candidate and diff completions, model
  hashes and verdicts against `m-c` row by row; (3) record in the stage report that Morelach's PASS was restored by a
  rule chosen on Morelach.

---

## P2

### D5F-3 (P2) — The boundary completion's accepting paths are exercised by one house: the one it was iterated on

- **Where.** `packages/reconstruction/src/boundary-completion.ts` (whole module), `plan-decomposition.ts:2868-2940`,
  `layout.ts:498-510` (`envelope-without-attached`).
- **Facts.**
  - Across the 20 matrix rows, **only dom-w-morelach has an ACCEPTED part** (one ATTACHED_ROOM, one BOX_COMPLETION).
    Every other part is rejected by `WALL_SLIVER` (33), `SEPARATE` (11), `NO_STRONG_EXTENT` (3), `NO_WAY_IN` (1) or
    `NO_CONTINUATION` (1) (49 parts over 13 rows, the duplicate Kosaćce and e-OZE legacy rows included). The guards `NOT_WALLED`, `POSTS`, `NO_ROOM_EVIDENCE`, `NO_RETURNS`, `BEYOND_EXTENT`,
    `TOO_LARGE`, `POLICIES_DISAGREE` decide **no** development part; they are exercised only by the synthetic suite
    (`extent-envelope.test.ts`, 20 tests, green). `envelope-without-attached` is added only when an ATTACHED_ROOM is
    accepted, so it is inert on every row but Morelach.
  - The implementation was iterated on Morelach with the verdict (which reads the published footprint) as the feedback
    signal before 177dfca was committed (11:03): `/home/user/work005f/dev-b1..b5`, `dbg-align` (10:21–10:54).
    b2/b3: −8.21 %, storeys 1/2; `dbg-align` (10:42) logs `DBGALIGN` candidates for the attic plan against the
    widened envelope 61–670; b4 (10:45): storeys 2/2 — the `envelope-without-attached` target; b5 (10:54): −3.12 %,
    PASS — the garage end. The code reads no published figure (verified, question 4 below), but the *developer*
    closed the loop on the motivating house's published footprint. That is permitted for a development house; it means
    Morelach's PASS is fit evidence, not generalization evidence. Round 6 is the only clean check.
  - Margins of Morelach's accepted parts against each `COMPLETION_BOUNDS` value (from
    `m-final/dom-w-morelach/evidence-pack/13-body-candidates.json`): conflict 3.61 walls (bar 2); way in 2.64 m
    (0.7); walled 0.750 (0.5); posts 0 (0.1); returns 3 (2); continuation 3.80 m of 5.36 m (needs 2.68); part shares
    0.034 / 0.059 (0.5); vehicle depth ≈ 8.0 m (4.5). ±20 % moves none of these except **`vehicleMinM`: the garage door
    measures 2.376 m against 2.2 (+8 %); at 2.64 (+20 %) the garage end becomes `POLICIES_DISAGREE` (STRICT does not
    enclose it) and the footprint falls to the b4 state, 105.12 m² (−8.2 %), FAIL.** 2.2 m is 005C's existing
    `LEAF_FACE ≥ 2.2` bar in `boundary-evidence.ts:459` and a standard garage-door minimum, not a new fit — but the
    PASS rests on it. Without `envelope-without-attached` Morelach drops to storeys 1/2 and FAIL (my
    `morelach-no-ewa` run). The clip (`freeFloorWalls`/`coreShare`, behind the 33 WALL_SLIVER rejections) loosened 20 %
    on modrzykach changes nothing (`modrzykach-clip-20`); `returnCover` was not run.
- **At HEAD.** These facts are measured at `d910212`; `4fd2f8e`/`65ebbdd` rewrote the part judgement and only Morelach
  has been re-run since (D5F-12).
- **Fix (no code change required for the freeze).** State in the stage report that the accepting paths and the new
  alignment target have one real exercise, the house they were tuned on, and that Morelach's PASS is not counted as
  generalization; list the guards no development house reaches. For the next stage, add at least one development or
  synthetic two-storey case where `envelope-without-attached` is *selected* by wall agreement (today's test only checks
  that the target is offered).

### D5F-4 (P2) — The style band's upper bound is placed by the motivating label; the gate replays that label

- **Where.** `numeric-lattice.ts:96-121` (`COUNT_BOUNDS.styleBand: [0.75, 1.3]`, `styleCapRatio: 1.25`);
  `packages/source-metrics/test/adaptive-glyph-count.test.ts:60-78, 104-128`.
- **Facts.** Pre-review A §C2 chose 1.30 "(development true counts 0.81–1.17; blind `000` 1.17; `2590` at k=3 is
  1.40)" — an interior point between the development maximum and the one label it was meant to flip. My label-level
  sensitivity (81 development labels + 9 round-5 labels, HEAD code, `sens.ts`/`sum2.mjs` in scratch-D):

  | change | development effect | `2590` (modrzewnicy) |
  | --- | --- | --- |
  | `styleBand` upper 1.04 (−20 %) | FIT kosacce `665`→`661`, `205`→`105` (2 right as-read lost), willa `245` leaves the set | decisive (4) |
  | `styleBand` upper 1.56 (+20 %) | none (jablonkach `505` loses only its decisive flag) | **not decisive: `140` LOW_QUALITY, as 005E** |
  | `styleCapRatio` 1.5 (+20 %) | none | **not decisive** |
  | `styleCapRatio` 1.0 (−20 %) | TARGET tunbergiach `274` leaves the set; FIT e-OZE `472` reads `°47` for `°017` (both wrong) | decisive |
  | `styleBand` lower 0.9 (+20 %) | TARGET tunbergiach `274` leaves the set (0.6: none) | decisive |
  | `noStyleBand`, `noStyleCentre`, `addDepth`, `styleSamples`, `counterPersist`, `countRivalP`, `countTexts`, `cellsPerInk` ±20 % | inert on all 90 labels | unchanged |
  | `sampleBand`, `counterHeight` ±20 % | one class or set membership each (see `sum2.mjs` output) | unchanged |
  | TAIL_BOUNDS `glyphRatio`, `glyphShare` ±20 % | no decision moves; the tail still recovers the same two truths (zurawkach `430`, modrzewnicy `1950`) | — |

  On both synthetic corpora (no plan style; `corpus-sens.ts`, 480 labels at HEAD) **no** ±20 % change of `noStyleBand`,
  `noStyleCentre`, `addDepth`, `counterHeight`, `counterPersist`, `countRivalP`, `countTexts` or `cellsPerInk` moves an
  as-read value, the truth-in-set count (±1) or the wrong-count totals (15 / 14 as-read, 2 / 2 CLEAR or SUPPORTED);
  they move only classes and the number of inks carrying a count alternative (`addDepth` 0.28: 14 → 28; `noStyleBand`
  lower 0.48: 14 → 3). The count machinery is robust where it has no style; its only sharp bound is the styled one.

  So development data alone supports any upper bound from ≈1.17 to ≥ 1.56; the shipped 1.30 is where it is to make
  `2590` decisive. The benefit on the motivating house is honesty only (`1140` AMBIGUOUS instead of `140` LOW_QUALITY;
  the truth is still absent, the house still refused). The risk is the other direction: a narrower band makes *more*
  decisive count changes, and a decisive change replaces the reader's count with no class cap. On the 81 development
  labels 5/5 decisive changes are right; on the matrix 89 lattice records (78 without the duplicate Kosaćce row) carry a decisive count in some ink variant, with no truth to check them
  (e.g. Morelach `160`→`1611`, `041`→`7031`, both LOW_QUALITY on a 16 × 8 px ink; marcowki `55`→`511` SUPPORTED).
- **The synthetic gate replays the development case.** `adaptive-glyph-count.test.ts` builds every condensed page from
  modrzewnicy's measured geometry (`iso 0.455, pitch 0.477`), targets the literal `2590`, and fills the page style with
  Morelach's printed figures (`350, 1062, 297, 415, 732, 380, 642, 100`). Tests are outside the production guard, so
  this is no rule violation, but the gate proves the motivating label, not the rule.
- **Fix.** Document in the calibration record that 1.30 was placed with `2590` in view and that the development data
  alone admits ≥ 1.56; cap a reading whose count was decided by the style at SUPPORTED (never CLEAR) until a blind
  round shows decisive changes are reliable; replace the literal targets in the gate with a seeded sweep (random 3/4/5-
  digit strings, `iso` 0.42–0.50, pitch 0.44–0.52, both faces, a page of random context labels).

### D5F-5 (P2) — STRONG extent sides can come from one chain whose "closure" is the scale restated

- **Where.** `layout.ts:384-411` (`extentSidesOf`: `readAndCloses`), `source-metrics/src/extract.ts:884`
  (`closes = derivedTotalCm !== undefined && readSegments > 0 && residualPx <= 1.2`); comment "Geometry only: no printed
  value decides a side" (`layout.ts:382`) and `docs/STRUCTURAL_LAYOUT.md` ("geometry only, no printed value").
- **What is wrong.** With one READ segment and the rest DERIVED (scale-restated), or one CHAIN_CORRECTED segment (a
  value the frame's scale chose), a chain "closes" trivially. Measured: Morelach's chain-131 closes with `READ 380` + 5
  DERIVED; zurawkach's chain at baseline 35.5 closes with 0 READ, 1 CHAIN_CORRECTED; dabecjach N is STRONG from **one**
  chain (2 READ + 1 DERIVED). So the single-chain STRONG branch is barely stronger than SUPPORTED, depends on read values
  and on the scale, and the doc's "geometry only" is inaccurate. Not a published-fact leak; no development decision
  depends on it today (dabecjach N → ZONE; Morelach E is STRONG through two chains 29 px apart, robust at ±20 % of
  the one-wall spacing).
- **Still at HEAD.** `4fd2f8e` tightened `twoLines` (the two chains' ends within a wall); `readAndCloses` is unchanged
  (`layout.ts:408` at `65ebbdd`).
- **Fix.** For the single-chain branch require ≥ 2 READ segments (no DERIVED, no CHAIN_CORRECTED) that sum to a read
  total, or drop it; correct the two comments.

### D5F-6 (P2) — Contract deviations that loosen guards or are unrecorded

- `boundary-completion.ts:388-392`: room evidence "a chain measuring it" counts any chain with ≥ 2 ticks inside the part
  and its baseline across it; contract B3 also required the chain to cover ≥ 50 % of the free floor. A dimensioned
  terrace passes this guard. Fix: add the coverage test (or amend the contract). **Fixed at `4fd2f8e`** (C5F-3: ticks within a wall of
  both ends; read at HEAD).
- `boundary-completion.ts:403-428`: a BOX_COMPLETION's vehicle depth grows through every contiguous built cell in the
  door's column, across interior walls — "a vehicle's length of built floor behind it" is the building's depth there,
  not the garage's. Fix: stop the growth at a WALL edge, or document it. **Fixed at `4fd2f8e`** (C5F-4: growth only across open
  edges; read at HEAD).
- `metric-solution.ts:421-428` (`latticeAlternatives`) has no digit-count filter, so a count alternative can contest a
  scale (and makes the class AMBIGUOUS via `rivalP`). Contract A6 says count alternatives "never … contest". Harmless
  in direction (a contest only withholds) and not exercised: no contested observation in m-final or m-c has an
  other-count alternative (`scratch-D/contest.mjs`). Fix: filter, or amend A6 and the doc.
- Contract B5 (shadow lines at wall-band axes) is not implemented and not recorded as debt anywhere in the repo. Fix: one
  line in the stage report's debt list.

### D5F-7 (P2) — Development models that moved for reasons the stage did not design

All explained by generic rules, none worse on a verdict; the stage report must say so (today no 005F report exists).

- dom-w-modrzykach: model `77b4be1b` → `86ed8afd`, footprint 181.00 → 182.28 m² (−0.54 % → +0.16 %, PASS both), door
  elements 23 → 22 (openings 21 both). Cause: two interior chains (baselines 232 H, 126 V) now carry `CHAIN_CORRECTED` values (205 on 73 px =
  2.808 cm/px, 303 on 112 px = 2.705, against 2.749) that become registration anchors (10 → 12, rms 0.023 → 0.028 m);
  the attached slab moves 17 cm. The "improvement" is two scale-chosen corrections entering the registration — the
  pre-existing comment "Only a segment whose number was actually READ anchors a registration" is not what
  `origin !== 'DERIVED'` enforces (`source-metrics/src/extract.ts:862-877`; not new in 005F, newly exercised by it).
- dom-w-jablonkach: model `6c8cf347` → `37c8f6f1`, footprint unchanged; sub-millimetre registration change from
  decisively re-counted STRICT inks (fd-jablonkach).
- kosacce: selected hypothesis 2.405526 → 2.40613 cm/px, model unchanged. modrzewnicy: selected hypothesis 2.895 →
  1.762 cm/px, still refused. g2e and Morelach confidence: D5F-2.
- Verified unchanged: Morelach ground registration `mppX 0.019801 / mppY 0.02027` and metric 1.989028 / 1.997504 cm/px
  in base, m-final (0.4), r035, m-c (0.35); storeys equal to the 005E matrix on every row; willa (−5.07 %),
  zurawkach (−0.81 %, 1/3), azaliach (refused), Morelach (now −3.12 %) do not regress.

### D5F-8 (P2) — ON == OFF was proven only on a run where the new layers say little (now observed on Morelach, not gated)

`packages/analysis-service/test/evidence-pack.test.ts` (19 tests, green at `a991e6b`) compares ON and OFF on the synthetic
Larchfield house, which accepts no completion. No ON/OFF pair exists for a house where `ENVELOPE_EXTENT_CONFLICT`
accepts a part or the style re-counts an ink. The 005F pack directory is not committed yet (`f4eb80f` verifies it "once
committed"), so "no publisher pixels in committed packs" cannot be checked; the four pre-reviews contain only numbers
(1-D column-ink profiles of three modrzewnicy inks, `segmentation-count-review.md:101-104` — derived counts, not a
bitmap). **Closed by my `morelach-off` run** (heavy-run section): byte-identical model and metric evidence. What
remains: commit that pair (or an equivalent CI gate on a completion-accepting synthetic house) so the property is
guarded, not just observed once.

### D5F-9 (P2) — Pointers and comments that describe what is not there

- `numeric-lattice.ts:79-87` and `docs/METRIC_EVIDENCE.md` cite the missing calibration record (D5F-2).
- `.github/workflows/buildapp-ci.yml:1192-1197` cites "report §C, §Q, §D, §R" of a stage report that does not exist.
- `COUNT_BOUNDS.styleBand`'s comment gives only "development true counts 0.81–1.17" (D5F-4: the upper end was set by
  `2590`).

### D5F-10 (P2) — The production hard-code guard does not register the round-5 three-digit labels or pixel values

`tests/architecture/generalization.test.ts` registers four-digit non-round printed dimensions (2590, 1950, 1410, 1212,
1062 are in) but by design not three-digit ones (642, 602, 640, 730, 380, 732) nor pixel coordinates (609.5, 670, 590,
667, 415). I scanned every production file the stage changed for those literals and for house names at `a991e6b`: none
(`git diff 9b619ec..a991e6b -- packages/*/src apps` + a grep of the changed files; only a pre-existing HTTP `415` in an
Android *test*). The guard passed at `a991e6b` (6/6; red at `65ebbdd`, D5F-11). No action needed beyond keeping literal targets out of production;
noted so that nobody reads the green guard as covering three-digit values.

---

## The six questions

1. **Literals.** At `d910212`: none in production (house names, the listed printed values, the Morelach pixel values,
   0.4545/0.477 style values). **At `65ebbdd`: "Morelach" and its 0.5 × 0.3 m reveal in a production comment; the guard
   fails (D5F-11).** `generalization.test.ts` guards ids, names, published figures and ≥ 4-digit printed overalls
   (round-5 overalls registered via `development-dimensions-005e-round-5.json`) and passed at `d910212`;
   `reconstruction.test.ts`
   ("no production source reads a stage artefact") passed at `a991e6b` — it failed at 10:57 (`vitest-full.log`) on a
   comment path that dd95020 removed.
2. **Class refit.** D5F-2. Other new constants: D5F-3 (completion), D5F-4 (count), D5F-5 (extent strengths); TAIL_BOUNDS
   are record-only (no decision reads `tail`; `metric-solution.ts` never names it; `extract.ts` records it once).
3. **Matrix.** Every row explained (D5F-2, D5F-7); no development verdict worse; metric confidence worse on g2e and
   Morelach, both honest; Morelach's scale unchanged.
4. **Non-circularity.** New code reads no published fact (`publishedAreas`/`footprint` appear only in pre-existing
   resolver and gate code). The lattice imports nothing metric (`adaptive-glyph-count.test.ts` gate + my reading of
   `countHypotheses`, `dimensionStyleOf`, `styleFor`: inputs are the raw tokens' ink only). A scale cannot choose a
   count: `correctionReadings` drops other-count values (`metric-solution.ts:394`), SCALE_RANKED and STRUCTURAL draw
   only from it. Completions are decided in `decomposePlan` before the resolver; on Morelach the challenge scored three
   readings that differ by *scale*, each with the same completions (`analysis-trace.json`, METRIC_CHALLENGE). The scale
   does reach completions (metres, and D5F-5's closure) — by design, not circularly.
5. **Evidence Pack.** ON == OFF and determinism green on Larchfield; D5F-8 for the gap.
6. **Typed refusal.** Correct on modrzewnicy and alt-marcowki; wrong on galaktyka and aster-viii (D5F-1). The Polish
   copy is accurate for its two kinds and keeps the 005E sentence when the field is absent. Fixed at `2e1889a`; the fixed rule
   classifies all four rows right (D5F-1).

## Heavy runs (3, sequential, after `m-c.alldone`, on the scratch copy `snap-D` of `snap-c`)

The copy carries three env-guarded overrides (`REVIEW_D_OVERRIDE` for COUNT/TAIL bounds, `REVIEW_D_COMPLETION`,
`REVIEW_D_NO_EWA`); with none set it is `d910212`'s code (HEAD of the brief). Script: `scratch-D/heavy.sh`; outputs `scratch-D/runs/`.

| run | what it tests | result |
| --- | --- | --- |
| `morelach-off` | Evidence Pack OFF, nothing else changed | `model.json` and `metric-evidence.json` **byte-identical** to the ON run `m-c/dom-w-morelach` (model `c3eb20a9`, metric `612e77e5`, candidate, scene hashes equal). ON == OFF holds on the one house where a completion is accepted and inks are re-counted (closes the gap in D5F-8), and the copy's overrides are neutral. |
| `morelach-no-ewa` | `envelope-without-attached` removed | **storeys 1/2, 13 openings, ALGORITHMIC_FAIL** (footprint −3.12 % unchanged). The target is load-bearing for Morelach's PASS — it is the fix the `dbg-align` session found (D5F-3). |
| `modrzykach-clip-20` | the completion clip loosened 20 % (`freeFloorWalls` 0.6, `coreShare` 0.2) on the row with the most WALL_SLIVER parts (8) and a STRONG conflict | all 8 parts still `WALL_SLIVER`, conflict still INCONCLUSIVE, model `86ed8afd` unchanged, PASS. The sliver rejection is not on a knife edge there. |

Not run (budget): `returnCover` ±20 % on Morelach (3 returns against 2 needed), the clip on willa-miranda, and
`vehicleMinM` +20 % (predicted from the record and the b4 run instead: −5.93 m², 105.12 m², FAIL).

## Not verified

- Truth of the ~78 decisive re-counts on the matrix outside the 81 labelled inks (no transcribed truth; a scale-fit
  proxy was too noisy to use: 48 of 264 unchanged PRIMARY readings fit their span).
- Committed 005F packs (none committed yet).
- The 005F stage report (does not exist yet); CI was read, not run.
- Anything at `4fd2f8e`/`65ebbdd` beyond reading the diffs, the coordinator's Morelach check runs (`d-check`,
  `e-check`) and the guard run: no matrix exists there and my heavy-run budget was spent at `d910212`.
