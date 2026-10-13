# STAGE BUILDPLAN-ANALYZER-005P — architecture-first audit, metric guard (plan resolver 1.5.0), fresh blind 11

**Class: one small production change** in plan resolution's source-conflict test (`packages/reconstruction` only),
chosen by preregistered gates over five variants on the 44 development rows: plan resolver **1.5.0**, policy **N1a**
(*doubt never helps the accuser*; a reading the registration's own metric solution cites cannot vouch for it). Blind
round 11 was drawn after a green frozen CI; it has a fresh ALGORITHMIC_FAIL (a topology failure the metric guard cannot
reach), so the stage is **PARTIAL** (§R).

## Summary

| item | result |
| --- | --- |
| branch | `analyzer/metric-ensemble-as-printed-guarded-v1` from `5906afa8aad2286e80a733e83ca2c45fb274a23b`; every push mirrored to `claude/new-session-3kzcgh` (no force push, no PR) |
| ARCHITECTURE_AUDIT | `artifacts/analyzer-005p/architecture/`: `current-system-map.md` (11 subsystems, stage order, call/data flow, contracts, the seven consumers of the as-printed reading, forbidden authority crossings, conflations), `target-contracts.md` (proposed typed observation/claim/decision contracts; no rewrite authorised), `architecture-adr.md` (no new subsystem, one seam, three horizons). Committed at the audit-before-code checkpoint `191b926`, before any production edit |
| FIRST_BAD_DECISIONS | `first-bad-ledger.json` / `first-bad-summary.md`, 44 rows, adversarially re-checked: 18 NONE_PASS, **10 TOPOLOGY_BOUNDARY**, 7 INSUFFICIENT_SOURCE, 4 BINDING_OR_CHAIN, 1 each METRIC_SOLUTION, SOURCE_OR_FRAME, OCR_OBSERVATION, STOREY, PRIMITIVE_EXTRACTION. **Only one refusal on the 44 rows is carried by plan resolution's as-printed view (glogownikach), and it is not that house's first bad decision** (a grid face selection and inward snap, TOPOLOGY_BOUNDARY, −8.04 %) |
| hypotheses | `research/analyzer-005p/hypotheses.md` H0–H5, incl. the novel **N1** and why it is not 005O's M1 renamed |
| SOLUTION_COMPARED | preregistered (`preregistration.md`, committed before any challenger): P0 (frozen), P1 (M1 conflict-only), P2 (M1 refutation-wide), P3 (M1 all = 005O M1), N1; addendum A (N1a) after review round 2, committed before any N1a run |
| gates (44 rows) | **N1 and N1a admissible; P1, P2, P3 not.** P1 raises a new AS_READ_REFUTATION on the known-good rarytasy-eoze; P2/P3 switch jarzabem's plan copy and lose its covered terrace |
| CHOSEN_IMPLEMENTATION | **N1a = plan resolver 1.5.0**: `statement-contest.ts` (new, pure), `plan-resolution.ts`, `v2/reconstruct-v2.ts`, `index.ts` (§D) |
| SAFETY / DEV_MATRIX | production replays of all 44 rows (PROD4): **2 decision paths change**. glogownikach goes from refused to completed at 2.6234 cm/px (the correct scale), still ALGORITHMIC_FAIL at −8.04 %. rarytasy-eoze keeps its trigger, outcome and model; its recorded share moves 0.3708 → 0.3348. **0 known-good model change, 0 new trigger, 0 new false-confident scale, 0 semantic change on a completed row, 0 new adverse refusal.** PASS 18 → 18, completed 22 → 23. Repeat byte-identical 44/44; external readings stripped = P0 on 44/44 decisions; production = harness N1 on 44/44 decisions |
| tests / mutations | 56 new tests: 42 unit, 6 production-solver, 8 architecture. They include a frozen 1.4.0 oracle (2000 plans, plus the same plans with random citations). **30/30 mutants are killed by their intended assertion** |
| reviews | three rounds (5 + 2 + 3 independent reviewers; two adversarial verifiers per P0/P1): **0 P0**; 1 P1 (G2-1, a circular defence) fixed by N1a; every P2/P3 dispositioned (`post-review/`) |
| performance | interleaved ABBA, 88 runs per side, solver-only: wall p50 19.10 → 18.59 s, p95 30.30 → 30.82 s; per-case ratio p50 0.98, max 1.09, **none > 15 %**; peak RSS p50 605 → 610 MB |
| freeze | only `packages/reconstruction` changed since 5906afa; `apps/`, `.github/`, root manifests, lockfile, OCR model / dictionary / WASM identical |
| CI | `PRE_HOLDOUT_11_SHA = 6f4d7ca`: run 38425412552 **green on attempt 1** (39 pass, 2 skipped by design) |
| BLIND_11 | drawn: `dom-miniaturka` **PASS** (NEW = OLD, model byte-identical); `dom-w-krasnokwiatach` **ALGORITHMIC_FAIL** (NEW = OLD, failure byte-identical; first bad TOPOLOGY_BOUNDARY at a correct scale). **TARGET_CLASS_EXERCISED = NO** |
| ANDROID_GATE | inherited 005H ARM64 device parity **PENDING** (emulator CI is not phone evidence); `owner-preview-latest` **not overwritten**; no APK published |
| NEXT | §Q, one recommendation |

## A. Audit (Phase A, before any production edit)

- **The pipeline as built.** `current-system-map.md` traces raw page → source package → page classification → observation graph (frames, roles) → source-metrics (OCR tokens, numeric lattice, external recogniser and ensemble, dimension lines, chains, bindings, metric solution, registration) → plan resolution (copies × extents × scales × tilings, source conflict, challenge) → decomposition (bands, grid, envelope, cells, bodies, openings) → storeys → canonical model → emission. Every subsystem and its owned decision is named with code locations re-verified at 5906afa.
- **The seam.** Plan resolution reads each dimension statement "as printed" from the classic template token, and seven consumers use that one reading:
  - T1 (registration side and rival side);
  - T3 (accusers and defence);
  - the ranking's refuted shares;
  - `latticeScales`;
  - isotropy;
  - `metricsAtScale`'s re-read options;
  - T2's raw-text join.

  None of them sees the ensemble's verdict on the same ink (`plan-resolution.ts:200` at 5906afa).
- **Recurring defect (ADR).** An observation from one reader is passed on as if it were the decision, with the reader's identity and its rivals dropped. The ADR keeps the existing subsystems and adds a typed contest record plus an explicit consumer policy at one seam. Everything else is deferred by name.
- **What 005O's M1 actually did on glogownikach.** It removed the conflict by withholding the token readings on every long statement, not because 541/870 won. "No evidence" then ranks as agreement (`refutedShareAsRead` = 0 when nothing is stated), which flips jarzabem's copy (denominator 681.7 → 55 px).
- **First bad decisions** (`first-bad-summary.md`, the brief's six questions):
  - **glogownikach:** the conflict comes from the classic reader's 501/810 against an ensemble that had 541/870. The −8.04 % comes from `thinLines` dropping the outer-face line by 0.136 px plus the `walledEnvelope` inward snap.
  - **murajach:** CHAIN_CORRECTED self-anchoring (`extract.ts:997`).
  - **akebiach:** the "missing piers" explanation is falsified by its own counterfactual; the S face carries no wall-thick ink.
  - **gozdzikowcach:** chain-corrected values are consumed as measured, then a chimney with no roof datum fails emission.

## B. Preregistration and variants (Phase B)

`preregistration.md` was committed on a clean tree before any challenger ran. It fixes the definitions, runs, per-case record, gates G1–G9, the selection rules, the label level and blind round 11.

| variant | T1 registration | T1 rivals | T3 accusers | T3 defence | ranking | lattice scales | isotropy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | frozen | frozen | frozen | frozen | frozen | frozen | frozen |
| P1 (M1 conflict-only) | drop | drop | drop | drop | frozen | frozen | frozen |
| P2 (M1 refutation-wide) | drop | drop | drop | drop | drop | frozen | frozen |
| P3 (M1 all = 005O M1) | drop | drop | drop | drop | drop | drop | drop |
| **N1** (accusation-monotone) | refutes only if **no** reading fits | spared only if **every** reading fits | joins only if **every** reading fits | defends if **one** reading fits | frozen | frozen | frozen |

K = the confident readers of one ink:
- AS_PRINTED;
- the LATTICE, when its own class is CLEAR or SUPPORTED;
- the EXTERNAL reader, when the frozen ensemble found it corroborating.

A statement is contested when K holds two or more distinct values. That is 284 of 994 statements, exactly 005O's M1 abstain set (`contest-equivalence.ts`, 0 disagreements).

**Property (N1):** the triggers raised are a subset of P0's, and the registration's refuted share is never larger. N1 can withdraw an accusation; it cannot make one. **Addendum A (N1a)**, after review round 2, was committed before any N1a run: a LATTICE or EXTERNAL reading that the frame's metric solution cites as a witness of its scale is set aside for the conflict test.

Controls held byte for byte on 44/44:
- P0-frozen = P0H (the harness without a policy);
- P3 = 005O M1.

## C. Development matrix (`dev-matrix.json`, `gates.json`, `semantic-delta.json`)

| variant | completed | PASS | decision paths changed | known-good path changed | models changed | new triggers | admissible |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0 (frozen) | 22 | 18 | — | — | — | — | — |
| P1 | 23 | 18 | 2 | eoze | glogownikach | eoze: AS_READ_REFUTATION | **no** (G3, P1 coherence) |
| P2 | 23 | 18 | 5 (+2 byte-only) | eoze | glogownikach, jarzabem | eoze: AS_READ_REFUTATION | **no** (G3, G4: jarzabem copy + terrace) |
| P3 | 23 | 18 | 5 (+2 byte-only) | eoze | glogownikach, jarzabem | eoze: AS_READ_REFUTATION | **no** (G3, G4) |
| N1 (harness) | 23 | 18 | 2 | eoze (share only, SOUND) | glogownikach | none | **yes** |
| **PROD4 (N1a, production)** | 23 | 18 | 2 | eoze (share only, SOUND) | glogownikach | none | **yes** |
| PROD4 repeat | = PROD4 byte for byte on 44/44 | | | | | | G7 |
| PROD4, every external reading stripped | 22 | 18 | 0 | 0 | 0 | none | = P0 decisions on 44/44 |

- **glogownikach**, P0 → PROD4:
  - P0 refused: SOURCE_CONFLICT / OUTER_TOTALS, "2 long readings as printed on both axes agree on 2.432039 cm/px (501/206 px, 810/333 px)".
  - PROD4 completes at 2.6234 cm/px with model `b7c86aac`; the truth scale is 2.6286.
  - The withdrawal is traced (`SOURCE_CONFLICT_REVIEW`). Its `doubted` list names `1fce7f3126=AS_PRINTED 501|LATTICE 501|EXTERNAL 541`; its `cited` list names `f810c24db9=AS_PRINTED 810|EXTERNAL 870 (cited)`. The result carries an AMBIGUOUS gap, "the scale of the base plan (an accusation withdrawn)".
  - **The completed model is still wrong.** Footprint is −8.04 % (ALGORITHMIC_FAIL). Three PAVED "recess" terraces are the lost exterior wall strips. The ring "18.83 × 8.70 m" is labelled SOURCE_EXACT, although 8.70 m is the inner face. All of this is upstream of the metric seam (first-bad ledger). **The owner now sees a wrong house where 1.4.0 refused.** G6/G8 admit this as preregistered (levels = plan storeys; terraces reported; never counted as a PASS). It is stated here so it is not mistaken for a repair.
- **rarytasy-eoze**, P0 → PROD4:
  - Same trigger (OUTER_TOTALS), same outcome (REPLACED at 2.222222), same model `2f342a94`.
  - The recorded `registrationRefuted` moves 0.370799 → 0.334843. The statement that moved it, `660de2eb26=AS_PRINTED 155|EXTERNAL 100`, is named in `registrationShareMovedBy`.
  - `55ef3f8509`'s 1600 readings are cited by the solution and set aside; they are named in `conflictCited`.
  - The written G3 verdict is SOUND (`soundness.json`).
- **Label level** (truth meets the variants only in the offline scorer): wrong as-printed values that can accuse a scale drop from 372 (P0) to 123 (N1) and to 122 (P1–P3), out of 670 stated among 782 labels. N1a is not scored at label level: it only narrows N1's withdrawals, so its figure lies between 123 and 372.

## D. The production change (Phase C)

| file | change | why it is necessary |
| --- | --- | --- |
| `packages/reconstruction/src/statement-contest.ts` (new, 92 lines incl. docs) | `STATEMENT_CONTEST_VERSION 1.0.0`; `statementContests(metrics)` → per statement `{readings: [{reader: AS_PRINTED\|LATTICE\|EXTERNAL, valueCm, cited?}], values, contested, latticeId?}`; `latticeKey` (frame, box, orientation) | the typed record of which confident reader read what on one ink — an observation that decides nothing. Pure, deterministic; types only from source-metrics |
| `packages/reconstruction/src/plan-resolution.ts` | `PLAN_RESOLVER_VERSION 1.5.0`; `Statement.contest`; the doubt policy confined to `chargesUnder` (T1 registration ANY_FITS, T1 rivals ALL_FIT, T3 accusers ALL_FIT, T3 defence ANY_FITS); `setAsideCited` (N1a); per-trigger charges; `sourceConflictReview` → `{conflict, withdrawn}` with `doubted`, `cited`, `shareMovedBy`; `sourceConflictAsPrinted` (the 1.4.0 test, for the review and the audit); `withdrawnRecord`; challenge record keys `conflictDoubted`, `conflictCited`, `registrationShareMovedBy`, `statementContest` | the seam. Every other consumer (ranking, lattice scales, isotropy, re-read options, T2) reads exactly as 1.4.0 (architecture test pins it) |
| `packages/reconstruction/src/v2/reconstruct-v2.ts` | `noteWithdrawn`: a withdrawn accusation is traced (`SOURCE_CONFLICT_REVIEW`) and adds an AMBIGUOUS gap to `result.unresolved` on both the early and the late path | a run that completes because an accusation was withdrawn must be traceable to the readers, and visible to the owner; it decides nothing (architecture test) |
| `packages/reconstruction/src/index.ts` | export the contest module | public seam for the research harness and tests |

How the types keep apart what the brief lists:
- **The raw reading of each reader** is `contest.readings[]`, one entry per reader.
- **A scale-dependent corrected value** (`dependsOnScale`, or a CHAIN_CORRECTED statement whose token is not a dimension) states nothing and gains no readers. Test: "states nothing".
- **A same-ink contradiction** is `contested`.
- **A missing candidate** is an absent reader, never a conjured value. Test: strip-external.
- **Candidate provenance** is `cited` (the solution rests on it) and `latticeId`.
- **Consumer-specific refusal** is per-trigger charges with their own `why`, recorded as withdrawn (`withdrawnTriggers`, `withdrawnWhy`, `withdrawnEvidence`, `doubted`, `cited`) or standing (`stillStanding`).
- No shared `confidence` field was added.

Not changed: the CanonicalBuildingModel schema, APK models/dicts/WASM, costs/scheduling, UI. 005K stays default-OFF; 005L storeys and 005N compound facade are untouched (X18 open-side mutant killed). No JTS/Clipper2/PDF.js, no weights, no cloud.

## E. Tests (falsifiable, before acceptance)

- **`packages/reconstruction/test/statement-contest.test.ts` (42):**
  - **Contest classification:** AGREES / LEADS / CONTESTS / CONTESTS_COUNT / NOT_CORROBORATING / NO_VALUE / NOT_COMPARABLE; the lattice's own class versus the ensemble class; joins on frame, box and orientation (other copy, rotated); a leading zero read upside down; duplicated crop.
  - **Each clause alone**, plus the exact share (0.9333, with `shareMovedBy` named).
  - **Hard negatives:**
    - 1600/1601 (a contest within one scale changes nothing);
    - uncontested accusers on both axes;
    - two disagreeing dimension lines whose readers agree;
    - a quarter turn;
    - an empty sheet;
    - dependsOnScale;
    - a corrected value whose token reads the value;
    - another copy;
    - ranking unchanged;
    - offered rivals unchanged.
  - **N1a:** cited versus uncited; the glogownikach pattern; another value of the same ink; another ink; the as-printed value never set aside; another frame's solution; a non-supporting observation; a duplicated crop under another id; T1 rivals; T3 defence; the trace marks `(cited)`.
  - **Records:** per-trigger naming; partial withdrawals; a copied statement id named once.
  - **Against the frozen 1.4.0 oracle** (`fixtures/conflict-oracle-1.4.0.json`, 2000 plans from the start revision's own `sourceConflictOf`): as printed = 1.4.0 object for object; no trigger 1.4.0 lacks; no larger share. A second pass repeats this with the plans' own solutions citing readings at random: N1a running, withdrawals ⊆ N1's, order-invariant.
- **`statement-contest-emission.test.ts` (6, through `reconstructV2`):**
  - 1.4.0 behaviour without the external readings (KEPT plus the AMBIGUOUS gap).
  - The 1.5.0 withdrawal: no challenge, a review trace naming the readers, the gap, the same model and building.
  - The early path with a published figure.
  - An unscaled frame: nothing accused or withdrawn, the outcome as the incumbent's.
- **`tests/architecture/statement-contest.test.ts` (8):**
  - the contest module imports types only;
  - no house, slug or published figure in the conflict functions;
  - the doubt modes appear only in `chargesUnder` / `sourceConflictReview`;
  - the review decides nothing;
  - research isolation for the 005P harness.
- **The test that fails on old code:** "two long totals the classic reader misread, read correctly by the external reader, accuse nothing (failed under 1.4.0)". Mutant X1 (the 1.4.0 test) is killed by it.
- **005O's 15-case logic corpus.** `research/analyzer-005o/test_views.py` still passes, with 4/4 broken generators killed. Its cases map onto the 1.5.0 fixtures above: contested label, LEADS, missing candidate / strip-external, two readers agreeing, two frames, inverted leading zero, empty sheet. The chain-equation cases (segment sums, misaligned chains, isotropy contest) concern the view generator, which 1.5.0 does not change.

## F. Mutations (`mutation-results.json`, `research/analyzer-005p/mutations.mjs`)

Each mutant is applied in place, the five 005P suites run, and the file is restored; the tree is checked clean after every mutant. **30/30 are KILLED by the named safety assertion**, not by a compile error.

| mutants | what each one undoes |
| --- | --- |
| X1 | the innovation itself |
| X2 | scope widened to the ranking |
| X3 | a contested external number promoted |
| X4, X7 | counting readers rather than values; trusting missing data |
| X5 | doubt helps the accuser |
| X6 | the published footprint silences the conflict |
| X8–X12 | one clause each |
| X13–X16 | ensemble-class leakage; joins; duplicated crop |
| X17 | a silent withdrawal |
| X18 | a protected open side changed |
| X19 | N1a off |
| X20 | over-naming |
| X21–X30 | N1a's ink key, value, as-printed, frame, support, duplicated crop, T1 and T3 sides, contest flag, trace |

## G. Independent reviews (`post-review/`)

- **Round 1** (`f34087d`; reviewers A correctness, B safety/authority, C tests, D runtime/packaging, E claims):
  - 0 P0. E1 was filed as P1 and downgraded to P2 by both verifiers. There were 15 P2 and 11 P3.
  - A and C each ran the verbatim 5906afa `sourceConflictOf`, on 9000 and 2000 plans: no new trigger, no larger share.
  - Fixes landed in `02286f4`; the dispositions are in `round-1-resolution.md`.
- **Round 2** (`f37e410`; reviewers F fixes and regressions, G adversary):
  - **G2-1 (P1/P2): a circular defence.** The reading that withdraws glogownikach's accusation is one the registered scale's own solution cites. In a mirror world where that reading is wrong, N1 builds an 8 %-off house where 1.4.0 refused.
  - It was fixed by **N1a**, preregistered (`bc4f6c3`) before any N1a run.
  - F compared HEAD's as-printed path with 5906afa on 96 000 plans: 0 mismatches.
- **Round 3** (`1329a4b`; reviewers H N1a and circularity, I tests and mutations, J claims):
  - 0 P0, 0 P1, 7 P2, 12 P3.
  - H proved that N1a only shrinks contests, and ran 20 000 plans plus 11 781 checks on the real evidence.
  - I's 11 surviving hand mutants are now fixtures and gates X21–X30.
  - J's corrected claims are in §I and §N.
  - Fixes landed in `15a2d4a`, `94782ac`, `ef648ca`, `761a28d`; the dispositions are in `round-3-resolution.md`.
- **Rejected or not changed, with a reason:**
  - A4: the solver stamp would change every known-good challenge row's bytes.
  - F2-2: a standing trigger's movement is visible in the as-printed audit.
  - J-1: treating a scale-derived anchor as a citation would be a new, unregistered variant. It is recorded in §N and §Q.

## H. Determinism, performance, runtime (`performance.json`)

- **Determinism.** PROD4 = PROD4-rep byte for byte on model, program, summary, failure, trace and digest (44/44). Round 1's D also found identical results on Node 18.20.4 and Node 22.
- **Interleaved timing.** Solver-only replays of all 44 rows, incumbent (5906afa reconstruction, aliased) against HEAD (aliased the same way). One process at a time, ABBA order over 2 repetitions, 88 runs per side, on an x86 container with 4 cores (not a phone).

  | measure | OLD | NEW |
  | --- | --- | --- |
  | wall p50 | 19.10 s | 18.59 s |
  | wall p95 | 30.30 s | 30.82 s |
  | peak RSS p50 | 605 MB | 610 MB |
  | peak RSS max | 770 MB | 773 MB |

  The per-case ratio has p50 0.98, p95 1.07 and max 1.09 (rarytasy-eoze); no case is over 15 %. Process start-up dominates wall time. The added work is one `statementsOn` pass plus a second conflict evaluation, about 0.25 ms per call on the largest cases (round 1, reviewer D). The noise band of identical-behaviour controls in 005O was 0.96–1.06×.
- **Node 18 embedded runtime.** The CI job "Local analyzer / Node 18 parity" is green at the freeze. The code uses no API newer than Node 18 (round 2, reviewer G). It bundles into `apps/local-analyzer`.
- **APK.** The CI "APK size + emulator" job is green. No APK was published and `owner-preview-latest` was not touched.
- **Full local gates** (`npm install`, `typecheck`, `test`, `build`, `e2e`):
  - install, typecheck, build: pass.
  - e2e: 47/47.
  - `npm test`: 2389 passed, 11 skipped, **2 failed**. Both are `apps/analyzer-api/test/worker.test.ts` timeouts at 120 s (two jobs side by side; a stuck job cancelled). The file passes 3/3 alone (26 s) and in CI at the freeze SHA, so this is a container-load effect on this 4-core machine. It is reported, not hidden.
  - The PNGs rewritten by e2e were restored.

## I. Predictions (written before the runs) and what happened

| prediction | source | result |
| --- | --- | --- |
| N1 changes the decision path only where P0 raised a conflict whose accusers are contested ("glogownikach only") | prereg §0 | **FAILED (benign)**: eoze's recorded share also moved (0.3708 → 0.3348) through clause 1, by a non-accuser statement (660de2eb26, 155 vs 100); same trigger, outcome and model; SOUND by written verdict |
| N1 leaves eoze's OUTER_TOTALS path and jarzabem's copy as P0 | prereg §0 | **HELD** for jarzabem and for eoze's trigger and outcome; the share is part of the failed row above |
| P1 re-routes eoze (as 005O M1 did) | prereg §0 | **HELD** (new AS_READ_REFUTATION) |
| P2 and P3 move jarzabem's copy | prereg §0 | **HELD** |
| P3 = 005O M1 | prereg §0 | **HELD**, 44/44 bytes |
| strip-external: glogownikach equals P0 byte for byte | prereg §2 | **PARTLY**: model, program and failure byte-identical; trace and digest differ only by the resolver version stamp (1.5.0 vs 1.4.0) |
| N1a: glogownikach still completes at 2.6234 | addendum A | **HELD** |
| N1a: eoze's share is N1's or P0's | addendum A | **HELD**, but it could not fail as written (both outcomes listed). The stated mechanism (660de2eb26's external 100 is not cited) is correct |
| N1a: nothing else moves | addendum A | **HELD** |
| N1a keeps the 1.4.0 accusation in G2-1's mirror world | addendum A | **HELD** for the single-reader mirror (REPLACED 2.432 VERIFIED, model `da496631` = 1.4.0's; or the SOURCE_CONFLICT refusal). **FAILED** for G2-1's main two-reader real-evidence mirror: N1a still completes `b7c86aac` |

`gates.py` was written after the replays. It encodes the preregistered gates; review rounds 1 and 3 made it stricter, never looser. The only human input is `soundness.json`: one SOUND verdict per variant on rarytasy-eoze, argued from code and evidence. A change without a written verdict counts as NOT_SOUND.

## J. Why no alternative was adopted

- **P1** raises a new trigger on a known-good row. Its eoze AS_READ_REFUTATION is a true accusation on Y, but it rests on one statement after deleting an irrelevant contest, and P1 mixes definitions across consumers (G3 / P1 coherence: NOT_SOUND).
- **P2 and P3** change jarzabem's copy and its open-side and terrace semantics (G4), because "no evidence" ranks as agreement.
- **N1 versus N1a.** Addendum A's rule was N1a replaces N1 if all gates pass. It did: same decisions on 44/44, and the circular defence closed.

## K. Freeze and CI

- `production-freeze-start.json` / `production-freeze-end.json`: only `packages/reconstruction` changed. `apps/`, `.github/`, root manifests, the lockfile and the embedded OCR assets (PP-OCRv6 model, dictionary, WASM) are identical.
- `PRE_HOLDOUT_11_SHA = 6f4d7cadd7ffa69d8a49b7f2079f8ba72388285c`, run 38425412552, **green on attempt 1** (39 pass, 2 skipped by design). Reviews were closed before it; the tree was clean.
- **UI evidence gate history.** The Android UI evidence gate failed on the two runs before the freeze (`191b926`, a commit with no production change, and `761a28d`). The failures were Compose UI-test races: `SnapshotStateObserver` multithreaded access, and a 5 s wait in the 1.3× font journey. The on-device analyzer's models and scenes were byte-identical across the two runs. The gate passed at the freeze SHA without a re-run.

## L. Blind round 11 (`artifacts/analyzer-005p/blind-round/README.md`)

- **Draw.**
  - Seed `2c369d9f…6313`, recomputed independently.
  - Pool `800c2a1e…`, 1518 drawable.
  - Exclusions `c7b611db…`: 141 families, covering blind rounds 1–10, every 005O/005P research and transcribed family, and the development families.
  - Both picks unstratified: i1 = 1 → `dom-miniaturka`; i2 = 712 → `dom-w-krasnokwiatach`.
- **Runs.** One each, NEW (live) then OLD (5906afa resolver, solver-only on the NEW run's sealed inputs).
- **Launch note.** One NEW launch never started: `/usr/bin/time` is absent here, so the shell exited 127 with nothing fetched. It was relaunched without the wrapper.

| # | NEW verdict | OLD verdict | OLD vs NEW | first bad (post-seal) |
| --- | --- | --- | --- | --- |
| 1 `dom-miniaturka` | **PASS** (+1.48 % footprint, 2 storeys) | PASS | model byte-identical | none decides the outcome (STRONG/CONFIRMED scale, fast path) |
| 2 `dom-w-krasnokwiatach` | **ALGORITHMIC_FAIL** | ALGORITHMIC_FAIL | failure byte-identical | **TOPOLOGY_BOUNDARY** (below) |

- **Verdict note.** The OLD verdicts needed the solver's own input graph copied into its output directory. The frozen verdict reads it, and without it #2 OLD returned PENDING_RAW_LEGIBILITY_MEASUREMENT. Both versions are kept; the verdict code is unchanged.
- **House #2 — what was right.** The scale is right: 2.511 cm/px, matching 950/378 px and 1610/641 px. The extent is right: 9.55 × 16.10 m from the printed chains.
- **House #2 — the first bad decision.** The walled envelope took the long-band box, which is only the middle 780 cm strip of a stepped plan printing 1610 = 430 + 780 + 400. Its N edge snapped to an interior partition merged with the fireplace symbol. The real facades are a 400 cm window and a 285 cm garage door, piers that leave no long band.
- **House #2 — consequences.** The STRONG N/S extent conflicts were detected but completed as "nothing is built". The result is one mass of 11.7 m² against the published 143.18 m², and a refusal. After the fact, the walled parts plus the covered terrace and porch at this scale come to about 142.9 m² (−0.2 %).
- **TARGET_CLASS_EXERCISED = NO.** Neither house raised a source conflict or recorded a withdrawal, doubt or citation, so the round is whole-house evidence, not evidence that the metric guard generalizes. **A fresh ALGORITHMIC_FAIL makes 005P PARTIAL.** Nothing was patched or re-drawn after the seal.

## M. Gates (preregistration §4, `gates.json`)

| gate | P1 | P2 | P3 | N1 | **PROD4 (N1a)** |
| --- | --- | --- | --- | --- | --- |
| G1 no new false-confident scale | ✓ | ✓ | ✓ | ✓ | ✓ (glogownikach CORRECT_SCALE) |
| G2 no known-good model change | ✓ | ✓ | ✓ | ✓ | ✓ |
| G3 known-good path change sound | ✗ | ✗ | ✗ | ✓ | ✓ (eoze SOUND) |
| G4 no semantic change | ✓ | ✗ | ✗ | ✓ | ✓ |
| G5 no new adverse refusal | ✓ | ✓ | ✓ | ✓ | ✓ |
| G6 no false closure / floor (terraces reported) | ✓ | ✓ | ✓ | ✓ | ✓ (levels 1 = 1 plan storey; 3 PAVED terraces reported) |
| G7 determinism (bytes) | not run | not run | not run | ✓ | ✓ |
| G8 glogownikach: no trigger, ALGORITHMIC_FAIL | ✓ | ✓ | ✓ | ✓ | ✓ |
| G9 monotone triggers | — | — | — | ✓ | ✓ |
| P1 coherence | ✗ | — | — | — | — |

Blind-round conditions (contract §5): no fresh false-confident scale, no wrong floor, no fabricated closure; **one fresh ALGORITHMIC_FAIL** → PARTIAL.

## N. Limitations and unresolved roots (recorded, not repaired)

- **Correlated-reader risk (G2-1 residual, J-1).**
  - On glogownikach the remaining defence of the registration is PP-OCRv6's 541. It is not cited by the solution, but it is the same recogniser that leads the solution's witnesses.
  - The accused registration's own anchor on that statement is a CHAIN_CORRECTED 5.41 m derived from the scale.
  - If the corroborating external reader were wrong on both of two accusers' inks, N1a would withdraw a correct accusation. The measured bound is 0/459 corroborating PP-OCRv6 readings wrong on the weighed statements, i.e. ≤ 0.65 % per statement by the rule of three.
  - Every M1-family variant carries the same risk.
- **B1, design.** A fitting external or lattice reading can be the only defence of a registration (clauses 1 and 4).
- **B2, design.** Clause 2 can withdraw T1 when doubt is only about which rival fits: 59 of 1212 in a synthetic stress test, 0 on the real rows.
- **A2.** After a withdrawal, a later challenge scores the figure as in a no-conflict run (SCORED, not VERIFIED). The claim is "no new accusation", not "no less cautious path".
- **A4.** The solver version stamp does not carry 1.5.0; the resolver version is in the trace record and the gap.
- **B4.** A READ statement's AS_PRINTED value can already be an ensemble-derived value upstream. The strip-external control leaves such values in place.
- **B7.** The challenge record mixes the doubt-policy T1 share with as-printed ranking shares.
- **glogownikach completed wrong.** It now completes wrong instead of refusing (§C). Root: TOPOLOGY_BOUNDARY (grid face and snap), not fixed.
- **Unresolved roots** (first-bad ledger; ADR deferred list):
  - CHAIN_CORRECTED values anchoring and measuring (murajach, gozdzikowcach);
  - grid face selection and a snap tolerance equal to a wall thickness (glogownikach);
  - envelope versus a STRONG chain extent (blind #2 krasnokwiatach);
  - absence ranked as agreement (latent under 1.5.0);
  - twin-line dedup by classic-token confidence (milorzebem);
  - orientation by the reader's posterior (murajach);
  - emission failures losing the plan digest;
  - pier primitives (akebiach).
- **Cannot be reproduced from the repository.** The publisher's pages and drawings, and the 005O transcription truth, both outside the tree by rule. The blind runs depend on the site at 16:49–17:02Z on 2026-10-13. The local `worker.test.ts` timeouts are environment-bound.

## O. Files

- **Production:** `packages/reconstruction/src/{statement-contest.ts, plan-resolution.ts, v2/reconstruct-v2.ts, index.ts}`, +356 / −37.
- **Tests:** `packages/reconstruction/test/{statement-contest.test.ts, statement-contest-emission.test.ts, contest-fixtures.ts, fixtures/conflict-oracle-1.4.0.json}` and `tests/architecture/{statement-contest.test.ts, research-isolation.test.ts, holdout-select.test.ts}`.
- **Research (never imported by production):** `research/analyzer-005p/`:
  - harness: `consumer-harness.mjs`, `policy_views.py`, `replay.mjs`, `old-resolver.mjs`, `perf.mjs`, `mutations.mjs`;
  - scoring and gates: `score_005p.py`, `compare_runs.py`, `gates.py`, `prod_vs_harness.py`, `soundness.json`;
  - checks and controls: `contest-equivalence.ts`, `conflict-oracle.ts`, `strip_external.py`, `exclusions.mjs`;
  - documents: `hypotheses.md`, `preregistration.md`, `consumer-policy-matrix.json`.
- **Holdout:** `holdout/select.mjs` (round 11), `holdout/excluded-families-round-11.txt`, `holdout/README.md` § Round 11, `holdout/LEDGER.ndjson`.
- **Artifacts:** `stage-reports/artifacts/analyzer-005p/` contains `architecture/`, `dev-matrix.json`, `gates.json`, `semantic-delta.json`, `mutation-results.json`, `performance.json`, `production-freeze-{start,end}.json`, `production-vs-harness.json`, `production-noext-vs-p0.json`, `post-review/` and `blind-round/`.

## P. Commands (ordered; scratch `W=/home/user/work005p`, outside the repository)

```bash
node research/analyzer-005o/freeze-manifest.mjs write stage-reports/artifacts/analyzer-005p/production-freeze-start.json
node research/analyzer-005p/consumer-harness.mjs setup --work $W/harness
for V in P0H P1 P2 P3 N1; do python3 -I research/analyzer-005p/policy_views.py --cases research/analyzer-005o/cases.json --variant $V --out $W/policies/$V; done
node research/analyzer-005p/replay.mjs --work $W --label P0-frozen --frozen --par 2
for V in P0H P1 P2 P3 N1; do node research/analyzer-005p/replay.mjs --work $W --label $V --policies $W/policies/$V --par 2; done
# production (after each fix round): PROD4, its repeat, and strip-external
node research/analyzer-005p/replay.mjs --work $W --label PROD4 --frozen --par 2
node research/analyzer-005p/replay.mjs --work $W --label PROD4-rep --frozen --par 2
python3 -I research/analyzer-005p/strip_external.py --cases research/analyzer-005o/cases.json --out $W/stripped
node research/analyzer-005p/replay.mjs --work $W --label PROD4-noext --frozen --metrics-dir $W/stripped --par 2
python3 -I research/analyzer-005p/score_005p.py --work $W --truth-work /home/user/work005o --variants P0H,P1,P2,P3,N1,N1-rep,N1-noext,PROD4,PROD4-rep,PROD4-noext --baseline P0-frozen --policies P0H --out stage-reports/artifacts/analyzer-005p/dev-matrix.json
python3 -I research/analyzer-005p/gates.py --matrix stage-reports/artifacts/analyzer-005p/dev-matrix.json --work $W --soundness research/analyzer-005p/soundness.json --out-gates stage-reports/artifacts/analyzer-005p/gates.json --out-delta stage-reports/artifacts/analyzer-005p/semantic-delta.json
python3 -I research/analyzer-005p/prod_vs_harness.py --prod $W/runs/PROD4 --harness $W/runs/N1 --out $W/prod4-vs-n1.json
node research/analyzer-005p/old-resolver.mjs setup --work $W/old-5906afa
npx vite-node research/analyzer-005p/conflict-oracle.ts -- --old $W/old-5906afa --out packages/reconstruction/test/fixtures/conflict-oracle-1.4.0.json
node research/analyzer-005p/mutations.mjs --out $W/mutations-r3
node research/analyzer-005p/perf.mjs --work $W --old $W/old-5906afa --reps 2 --out $W/performance.json
npm install && npm run typecheck && npm test && npm run build && npm run e2e && git checkout -- stage-reports/artifacts
node research/analyzer-005o/freeze-manifest.mjs check stage-reports/artifacts/analyzer-005p/production-freeze-start.json
# blind round 11 (after a green CI at the frozen SHA)
node holdout/select.mjs select --round 11 --pool holdout/pool.txt --pool-sha256 800c2a1ed9daee9efd2654c64b061e430094dc38fc459b805af27ff9fad2ed41 --pre-holdout-sha 6f4d7cadd7ffa69d8a49b7f2079f8ba72388285c
ANALYZER_EVIDENCE=1 TELEMETRY=1 npx vite-node packages/analysis-service/scripts/second-house.ts -- --url <address> --cache $W/blind11/hN/cache --out $W/blind11/hN/new --recogniser
OFFLINE=1 npx vite-node --config $W/old-5906afa/vite.config.mjs packages/analysis-service/scripts/second-house.ts -- --package $W/blind11/hN/new/source-package.json --graph $W/blind11/hN/new/observation-graph.json --metrics $W/blind11/hN/new/metric-evidence.json --cache $W/blind11/hN/cache --out $W/blind11/hN/old
node holdout/verdict.mjs $W/blind11/hN/new; node holdout/verdict.mjs $W/blind11/hN/old
```

## Q. NEXT_RECOMMENDATION (one)

**Reconcile the walled envelope with a STRONG printed chain extent, in `plan-decomposition` only.** The scope is `walledEnvelope` and the envelope-extent-conflict completion. When the long-band box falls short of a STRONG DIMENSION_CHAIN_EXTENT on an axis whose printed sub-chain boundaries fall on the missing strips, two changes apply:
- Offer those chain-bounded strips as envelope candidates, judged by their walls and openings, instead of resolving them as "nothing is built" or WALLED_OFF.
- Keep the outer face rather than snapping it inward by a wall thickness.

Krasnokwiaty, for example, prints 1610 = 430 + 780 + 400 while the box covers only the 780 strip.

Why this one:
- The development ledger's largest failing root is TOPOLOGY_BOUNDARY (10 of 26 non-PASS rows).
- Of the three blind failures since round 10, two are boundary failures at a correct scale (round 10 #2 akebiach, round 11 #2 krasnokwiatach), and the third (round 10 #1 glogownikach, a METRIC refusal at the time) now completes under 1.5.0 and fails on the same family.
- Glogownikach's remaining −8.04 % is the same family (outer-face line lost, inward snap).

Akebiach's uninked S face is out of reach of any such rule, and the stage should say so. The stage must keep 005N's compound-facade and open-side safety and 005L's storeys, with its own preregistration, the 44 rows plus these houses as development material, and a fresh blind.

## R. Verdict and handoff

| field | value |
| --- | --- |
| STAGE | BUILDPLAN-ANALYZER-005P |
| VERDICT | **PARTIAL**: a safe scoped metric guard shipped through every frozen gate; blind round 11 has a fresh ALGORITHMIC_FAIL (TOPOLOGY_BOUNDARY, at a correct scale, identical under the old code) and did not exercise the target class |
| BRANCH | `analyzer/metric-ensemble-as-printed-guarded-v1` (mirror `claude/new-session-3kzcgh`) |
| HEAD | the commit carrying this report (see the handoff message) |
| CI | frozen SHA `6f4d7ca`: run 38425412552 green, attempt 1 (39 pass, 2 skipped by design) |
| FULL_REPORT | `stage-reports/STAGE_BUILDPLAN_ANALYZER_005P_ARCHITECTURE_FIRST_METRIC_GUARD.md` |
| ARCHITECTURE_AUDIT | `stage-reports/artifacts/analyzer-005p/architecture/` |
| FIRST_BAD_DECISIONS | `architecture/first-bad-ledger.json`, `first-bad-summary.md`; blind: `blind-round/README.md` |
| SOLUTION_COMPARED | P0, P1, P2, P3 (005O M1), N1, N1a, on 44 rows (`dev-matrix.json`, `gates.json`) |
| CHOSEN_IMPLEMENTATION_OR_NONE | N1a, plan resolver 1.5.0 (`statement-contest.ts`, `plan-resolution.ts`, `reconstruct-v2.ts`) |
| SAFETY / DEV_MATRIX | 2 decision paths changed; 0 known-good model change; 0 new trigger; 0 new false-confident scale; 0 semantic change; deterministic; strip-external = P0; 30/30 mutants |
| BLIND_11 | `dom-miniaturka` PASS (= OLD); `dom-w-krasnokwiatach` ALGORITHMIC_FAIL (= OLD); TARGET_CLASS_EXERCISED = NO |
| ANDROID_GATE | 005H ARM64 device parity PENDING; `owner-preview-latest` not overwritten |
| NEXT_RECOMMENDATION | §Q: the walled envelope reconciled with a STRONG printed chain extent (`plan-decomposition`) |
| token | `PARTIAL_BUILDPLAN_ANALYZER_005P_BLIND11_TOPOLOGY_FAIL_TARGET_NOT_EXERCISED` |
