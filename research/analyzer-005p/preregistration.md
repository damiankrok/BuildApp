# BUILDPLAN-ANALYZER-005P — pre-registration (committed on a clean tree BEFORE any challenger is executed)

Stage class: architecture audit + guarded production pilot. At most ONE production interpretation change, only in plan
resolution's metric seam (`packages/reconstruction/src/plan-resolution.ts`, optionally one new pure helper beside it),
only if it passes every gate below. Start: `5906afa8aad2286e80a733e83ca2c45fb274a23b` (accepted 005O), branch
`analyzer/metric-ensemble-as-printed-guarded-v1`. Production freeze at the start:
`stage-reports/artifacts/analyzer-005p/production-freeze-start.json` (005O's `freeze-manifest.mjs`).

## 0. Known before this was written (controls and audit facts, not challenger results)

- The 44 development cases are 005O's `research/analyzer-005o/cases.json` (005N's 42 rows + blind round 10, revealed).
  All sealed inputs are present (checked at the start). None of them is blind.
- The consumer-scoped harness (`consumer-harness.mjs`) is a module swap outside the repository; `P0H` (harness, every
  consumer FROZEN) is compared byte for byte with `P0-frozen` (no alias) on 44/44 before any challenger runs.
- The contested set (|K| ≥ 2) equals 005O's M1 abstention set: 284 statements, 0 mismatching cases.
- Audit facts used to design the variants: `hypotheses.md` §0 (seven consumers; TOKEN/LATTICE correlated; the
  eoze 1600/1601 contest; denominators) and the first-bad ledger (`stage-reports/artifacts/analyzer-005p/architecture/
  first-bad-ledger.json`, `first-bad-summary.md`), committed in the same audit-before-code commit as this file.
- Predictions written now, to be checked by the replays: N1 changes the decision path only where P0 raised a source
  conflict whose accusers are contested about the scale (expected: glogownikach only); N1 leaves rarytasy-eoze's
  OUTER_TOTALS path and jarzabem's copy exactly as P0; P1 re-routes rarytasy-eoze (as 005O M1 did); P2 and P3 move
  jarzabem's copy (P3 = 005O M1 reproduced).
- Already known from 005O (and therefore NOT evidence for any 005P variant): 005O M1 = all-consumer DROP produced
  glogownikach 2.6234 (FAIL −8.04 %), jarzabem copy switch with semantics change, eoze trigger path change,
  milorzebem / akebiach best-reading text changes. `P3` re-runs it only as a harness validation and safety reference.

## 1. Variants (exact definitions; `policy_views.py` CONFIGS and `consumer-harness.mjs` modes)

K = confident readers of a statement's ink = {TOKEN, LATTICE if CLEAR/SUPPORTED, EXTERNAL if corroborating by the frozen
ensemble rule} (005O §2 definitions, no REREAD). Contested ⇔ |K| ≥ 2. Uncontested statements are read exactly as
frozen in every variant.

| variant | CONFLICT_LATTICE | T1_REG | T1_ALT | T3_ACCUSE | T3_DEFEND | RANKING | LATTICE | ISOTROPY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0 (`P0-frozen`; control `P0H`) | frozen | frozen | frozen | frozen | frozen | frozen | frozen | frozen |
| P1 M1 conflict-only | DROP | DROP | DROP | DROP | DROP | frozen | frozen | frozen |
| P2 M1 refutation-wide | DROP | DROP | DROP | DROP | DROP | DROP | frozen | frozen |
| P3 M1 all (005O M1) | DROP | DROP | DROP | DROP | DROP | DROP | DROP | DROP |
| N1 accusation-monotone | frozen | KSET_ANY | KSET_ALL | KSET_ALL | KSET_ANY | frozen | frozen | frozen |

C6 (`metricsAtScale` re-read options) and C7 (T2 PARTIAL_BINDING) are frozen in every variant (they are not view
consumers; `hypotheses.md` §0.2).

**No N2.** A second novel challenger was considered (N1 + `KSET_ANY` on RANKING). It is not materially different in
mechanism (the same rule on one more consumer) and it re-opens the ranking side 005O showed is semantically fragile, so
it is not admitted. `NO_SECOND_NOVEL_CHALLENGER`.

**Coherence of P1 (pre-declared):** P1 measures the conflict with the DROP view while the challenge that follows a
raised conflict ranks with the frozen view. This mixes two refutation definitions on one decision path; P1 is run as
pre-declared, and is admissible only if every case where it raises a conflict that P0 did not raise is shown sound.
P2 is the coherent M1 split (one refutation definition everywhere).

## 2. Runs

- Every variant replays all 44 cases, solver only, on the sealed package / graph / metric evidence
  (`research/analyzer-005p/replay.mjs`, `--par 2`), outputs in `/home/user/work005p/runs/<label>`.
- `N1` and (if adopted) the production implementation are replayed a second time for determinism (byte identity).
- Counterfactual controls (on N1 and on the adopted variant): `--strip-external` (every external reading and ensemble
  record removed before the policy is computed) — Głogowniki must then equal P0 byte for byte (no 541/870 conjured);
  other cases are reported as they come (TOKEN-vs-LATTICE contests remain without EXTERNAL).
- Hard negatives are read off the same 44 rows: jarzabem (terrace / copy), rarytasy-eoze (conflict path),
  kosacce-area-alone (refusal reason), the 18 P0 PASS rows, Kosaćce open terraces, carports / porches / loggias in the
  semantics columns, Marcówki floors, gozdzikowcach (geometry + later chimney failure), murajach (upstream METRIC),
  akebiach (EXTENT). Logic negatives (false double witness, insufficient total-sum, noisy orientation, mirrored /
  rotated, copied statement id, different page/copy, scale-corrected token, circular area prior) are unit fixtures of
  the adopted implementation (Phase C), written before acceptance.

## 3. Per-case record (`dev-matrix.json`)

outcome and failure code/substage; the selected frame; the scale (mean of mppX/mppY ×100) and its class against the
005O transcription scale (3 % band; UNKNOWN where 005O had none); the decision path (PLAN_RESOLUTION / METRIC_CHALLENGE:
outcome, trigger, registrationRefuted, chosen / preferred reading text); semantics (wide openings, boundary bodies,
wall kinds, openings, levels); model and program hashes; holdout verdict (`holdout/verdict.mjs`, the same scorer as
005O); contested statements on the selected frame and whether any is in the conflict evidence; wall time and peak RSS.
The four questions are recorded separately: **a wrong number suppressed**, **a conflict resolved**, **a house model
completed**, **a house correct (PASS)**.

## 4. Gates (every one must hold for a variant to be admissible) — fixed now

- **G1 no new false-confident scale:** no case completes at a scale outside the 3 % band of a known transcription scale
  where P0 did not; a completion with UNKNOWN truth that P0 refused counts as a violation unless the scale equals the
  frame's STRONG/SUPPORTED metric solution within 1 %.
- **G2 no known-good model change:** every P0 PASS row keeps its model hash.
- **G3 no unexplained known-good decision-path change:** a P0 PASS row whose PLAN_RESOLUTION / METRIC_CHALLENGE record
  changes (trigger, outcome, refuted shares, chosen reading) violates G3 unless the change is shown sound from the code
  and the evidence (written per case); "same model hash" is not a justification by itself.
- **G4 no semantic change on a completed model** (wide-opening decisions, boundary-body relations incl. covered
  terraces, wall kinds, levels) on any row, unless the row went from refused to completed AND the change is the
  completion itself; a copy switch on a completed row violates G4.
- **G5 no new adverse refusal reason:** no refusal whose message asserts a scale > 3 % off a known transcription scale
  where P0's did not.
- **G6 no false physical closure / no unsupported floor:** levels and BUILT/terrace bodies of every completed row are
  P0's, except a refused→completed row, whose levels must equal its storey frames and whose terraces are reported.
- **G7 determinism:** two replays byte-identical.
- **G8 Głogowniki:** the 501/810 conflict is removed on existing evidence AND the −8.04 % footprint failure is stated
  as a remaining ALGORITHMIC_FAIL (never counted as a PASS).
- **G9 (N1 only) the monotone property:** on every case, the set of source-conflict triggers raised under N1 is a
  subset of P0's (checked from the traces).

## 5. Selection (fixed now)

1. Admissible = all gates hold. If none is admissible → `NO_SAFE_ADOPTION` (no interpretation change ships; the
   diagnostic contest record may ship only if it influences no decision and is covered by isolation tests).
2. Among admissible variants, prefer the fewest decision-path changes vs P0 on all 44 rows (the smallest blast
   radius), then the fewest consumers touched. Both counts are mechanical from the matrix.
3. **N1 may be chosen over an admissible P1/P2 only with a specific, safely measured advantage** on at least one of:
   fewer known-good decision-path changes; fewer decision-path changes overall; G9 holding where the M1 split raises a
   new trigger; a contest that is metrically irrelevant (all of K fits one scale) left untouched. Code elegance alone
   is not an advantage.
4. Blind round 11 is never used to choose between variants.

## 6. Label level (offline scorer, truth meets variants only there)

005O's 782 agreed crop transcriptions (`/home/user/work005o/labels/truth.json`, outside the repository; read only by
`score_005p.py`): per variant, the number of statements whose WRONG value can (a) accuse the registration, (b) refute a
correct-scale reading, (c) state a value at all; with the same denominators as 005O (670 stated among 782 labels;
372/670 frozen wrong-when-stated). These are descriptive; the house-level gates decide.

## 7. Blind round 11 (only if a production change is adopted and frozen)

Protocol written and committed before the draw (`holdout/README.md` § Round 11, `select.mjs` extended): exclusions =
every family of blind rounds 1–10, every 005O research / transcribed family, 005K/005M exposures, and the 44 development
families; two fresh families minimum (one stratum if a dimension-evidence stratum can be pre-registered from page text
without reading drawings, else two unstratified with `TARGET_CLASS_EXERCISED` unknown); seed from a committed value and
a public later quantity, burned candidates logged. Old (P0, `PRE_HOLDOUT_11_SHA`'s parent behaviour) and new analyses,
single run each, in a fixed order; verdicts and first-bad records sealed before diagnosis. A fresh ALGORITHMIC_FAIL,
false-confident scale, wrong floor or fabricated closure forces PARTIAL. If nothing is adopted:
`NOT_DRAWN_NO_SAFE_ADOPTION`.

## Addendum A — N1a, a safety amendment after review round 2 (committed BEFORE any N1a run)

**Why.** Review round 2 (finding G2-1, P1 by one verifier, P2 by the other) showed on Głogowniki's real evidence that the
reading which withdraws the accusation (PP-OCRv6 870 on `f810c24db9`) is also a witness the registered scale's own metric
solution cites (`supportingObservationIds` → the observation whose `ocr.latticeId` is that ink's lattice). The registration
defends itself with its own witness. In a mirror world where the classic tokens are right and that external reading is
wrong, N1 completes the house at a scale 8 % off where 1.4.0 refused or replaced it. N1 is preregistered and stays the
selected policy unless N1a passes the same gates.

**N1a (exact).** As N1, except that, for the source-conflict test only, a contested statement's reading is excluded from
the doubt when the frame's metric solution cites it: a reader value `v` of a statement whose ink's lattice is `L` is
excluded when an observation in the solution's `supportingObservationIds` has `ocr.latticeId = L` and `valueCm = v`
(LATTICE and EXTERNAL readings only; the as-printed value is never excluded). The statement is then read by its remaining
readings; with one distinct value left it is uncontested for the conflict test and read as printed (1.4.0). A frame
without a metric solution, or a solution citing nothing, is N1 exactly. Everything else (clauses 1–4, the records, the
gap, every other consumer) is N1's.

**Property.** N1a's withdrawals are a subset of N1's, and N1's are a subset of 1.4.0's triggers: N1a can withdraw fewer
accusations than N1, never more, and still raises none 1.4.0 does not.

**Predictions (written now).** On the 44 rows: glogownikach still completes at 2.6234 cm/px (541 on `1fce7f3126` is not
cited, so that accuser stays contested and the accusation has one accuser left); rarytasy-eoze's recorded share is either
N1's 0.334843 or P0's 0.370799, depending on whether `660de2eb26`'s external 100 is cited; nothing else moves. In the
mirror world of G2-1 (the classic tokens right, the cited external wrong) N1a keeps the 1.4.0 accusation.

**Gates and selection.** G1–G9 unchanged, on production replays of all 44 rows (the consumer harness cannot express a
citation, so N1a is measured on the production implementation directly, and the determinism repeat and the
strip-external control are rerun). N1a replaces N1 only if it passes every gate; if it does not, N1 ships with G2-1
recorded as an accepted limitation.
