# BUILDPLAN-ANALYZER-005Q-CHAIN — preregistration (committed before any challenger runs on the corpus)

Base `cd0c513bcbbb5a00dc7115c887daada1800f9172`. Causal audit: `research/analyzer-005q-chain/architecture/causal-map.md`
(committed `66a22ce`, before this file). Every later change to a challenger, a gate or a prediction is an **addendum** at the
end of this file, committed **before** the changed challenger runs. Research only: `packages/`, `apps/`, `.github/`, root
manifests, lockfile, OCR weights and runtime are frozen (`freeze-manifest.mjs`, start `stage-reports/artifacts/analyzer-005q-chain/freeze/production-freeze-start.json`).

## 1. Frozen inputs

- **Rows.** `research/analyzer-005q-chain/cases.json` = the 46 development rows of `research/analyzer-005q/cases.json`
  (unchanged, in order) + blind round 12's two houses (`dom-w-tymianku`, `dom-w-daliach`), **revealed and now development —
  never called fresh blind**. **48 rows, all inputs present** (`case-inventory/case-inventory.json`: package, graph and
  sealed-metrics SHA-256 per row; every cached publisher byte of every frame variant hashed and equal to its `byteHash`).
  45 rows are `EXTRACT` (the source-metrics pass re-runs on the sealed package + graph + bytes, offline, with the deployed
  recogniser); 3 are `SOLVE_ONLY_LEGACY` (`eoze-legacy-every`, `eoze-legacy-area`, `kosacce-area-alone`: their input IS a
  sealed legacy evidence set; a source-metrics challenger cannot reach them — they are controls for the solver only).
- **Correlation.** 42 independent families. Same-house rows (`kosacce-clean/-tracked/-area-alone`, `marcowki/alt-marcowki`,
  `rarytasy-g2e/-eoze/eoze-legacy-every/-area`) are copies of one house and are never counted as independent evidence; house-
  level results are reported per row and per family (a family changes if any of its rows changes). Murajach S2 (ground) and
  S3 (attic) are two drawings of one package (one typeface, one reader family): correlated, never independent witnesses
  (correction to 005Q-OCR, which called them two copies of one drawing; `causal-map.md` §3).
- **Label truth.** 005Q-OCR's frozen truth on its 9 sheets, rebuilt with its own functions (`score.py` `build_items`,
  `binding.py` `truth_binding`): **PRIMARY** = tier A (005O double blind transcription) + tier B (local double read R1 = R2),
  110 dimension labels on 8 MAIN sheets (+17 on smoke sheet S5, reported apart); **SENSITIVITY** adds tier C (R1_CONFIDENT,
  same reader family as the candidates — correlated, no conclusion rests on it). Binding truth (line-internal proportion,
  TICK marks only) exists for 19 MAIN labels, **none on Murajach** (`NOT_MEASURED` there), 2 of 19 lie > 3 % from the 005O
  transcription scale (questionable): every binding number is also reported **without** those 2 (sensitivity). The 20
  human spot-review entries of 005Q-OCR remain an **open validation dependency**; no model verified them; no image is
  shown to any model or sent to any service in this stage.

## 2. Runner, baseline, determinism

- **Runner** `research/analyzer-005q-chain/replay.mjs` (two steps per row: `second-house.ts --package --graph --cache
  --recogniser` → `metric-evidence.json`; then `research/analyzer-005q/solve.ts --metrics <that evidence>` (+ the row's
  `--drop-frames`) for the 005Q research sidecars). A challenger is `variant.mjs setup --patch ACCEL.patch --patch
  candidates/<X>.patch`: the base's `packages/source-metrics/src` and `packages/reconstruction/src` copied **outside the
  repository** and aliased; every other package is the frozen working tree. **No challenger patch touches
  `packages/reconstruction`** — plan resolution, the 005P N1a statement contest and all reconstruction code are identical
  in every variant; a challenger reaches the model only through the evidence it seals.
- **C0** = production, no alias, no patch (`runs/C0`). **C0dup** = the zero-challenger variant copy with `ACCEL.patch`
  only, reverse row order, 1 worker (`runs/C0dup`). **Stop rule S1:** C0 and C0dup must be byte-identical on every row
  (metric evidence, model, program, failure, unresolved, provenance, digest). If not, the harness is invalid: STOP and
  report. Observed before this file (not a prediction): on every C0 row finished so far the fresh metric evidence is
  byte-identical to the sealed set and the solver output to 005Q's PROD3.
- **ACCEL** (`ACCEL.patch`, harness only): the ring-callout reader (≈ 90 % of extraction time, `callouts.ts`, untouched by
  every challenger) is memoised on disk per (variant bytes, frame) when `ACCEL_005Q_CHAIN_DIR` is set. **Stop rule S2:** a
  warm ACCEL run of the zero-challenger copy (`runs/C0warm`) must equal C0 byte for byte on every row; else challengers run
  without ACCEL.
- **Repeat / order (G4):** every challenger that is not inadmissible on G1–G3 is re-run once in rotated order
  (`--order rotate:17`, 2 workers) and must be byte-identical to its first run.

## 3. Challengers (each one causal seam; patches in `candidates/`, sha256 recorded in §9 at commit)

All parameters are **existing production values**; no new number is introduced or tuned: the frozen ensemble rule
(AGREES/LEADS, CLEAR/SUPPORTED, `ensemble.ts`), the dimension pattern `/^[1-9]\d{1,4}$/` (plan resolution's own), the
centring share 0.3 and the two skipped marks of 005B's `centredOn`/`spansFor`, chain tolerance 2.2 px, `minCorrectionPx`
55 px.

| id | seam (causal-map defect) | rule | files |
|---|---|---|---|
| **C1 INK-FIRST** | D3 + D4: a value the scale chose is printed and endorses that scale | A CHAIN_CORRECTED segment whose ink the frozen ensemble read with corroboration (AGREES or LEADS, class CLEAR/SUPPORTED, an integer of 2–5 digits without a leading zero) states **that ink** (origin READ; `derivation` = INK_FIRST with the classic text and the ink; the scale's value kept as an alternative `SCALE_DEPENDENT`). Rival confident readings (CONTESTS, CONTESTS_COUNT) or a single reader give no ink: the statement stays CHAIN_CORRECTED. **Anchors: exactly the READ segments not read the way up a scale chose** (`dependsOnScale`); the production legacy-identity filter `anchorable` is not applied (it blocks every re-read chain's anchors by coincidence of confidences, `causal-map.md` §2 branch C). Ladder: CHAIN_CORRECTED rungs never anchor. `derivedTotalCm` re-summed from the stated values. | `extract.ts` |
| **C2 GEOMETRIC_BIND** | D5: the measured span is re-picked by the scale; labelled spans DERIVED "nothing printed" | In `solveChain`, the span a label measures is fixed by the marks alone (`geometricSpanC2`): the span it is centred on (0.3 of its length) across ≤ 2 non-rejected marks, the fewest marks first; a tie of two different spans → none; no centred span → none. A span holding a label that is not that label's span carries it **unread**. A span holding a bound-but-unread label, or the position of a label the assignment left AMBIGUOUS/UNASSIGNED with a candidate on that chain, is `labelledUnresolved`: never DERIVED; its record carries `labelled`. The assignment (exact Hungarian, unchanged) and the value rule are production's. Bipartite matching was considered (`causal-map.md` §4): the assignment is already an exact per-neighbourhood min-cost matching with abstention; the measured defect is downstream of it, in the span DP, which is not a bipartite problem. | `chains.ts`, `metric-solution.ts`, `extract.ts` |
| **C3 ORIENTATION** | D6: orientation decided by another set's scale; undecided segments are witnesses | The two orientation routes that take a scale as evidence are closed: vertical AXIS_SELF_CONSISTENCY by joining other chains' cluster (`joinedCm`) and OTHER_AXIS_SCALE. A vertical chain that typography, a single reading, its own labels' agreement or the sheet majority does not decide is UNDECIDED: the page vote's way up is kept on the record, flagged `dependsOnScale` (no witness): its segments carry a derivation and **anchor nothing**. | `metric-solution.ts`, `extract.ts` |
| **C4** | C1 + C2 + C3 | combination, exploratory; never adopted unless C1, C2 and C3 each meet their source-authority invariants (G2, G3) | |
| **N1 INK RE-READ** (own algorithm) | D7, the measured distinct bottleneck: of 110 PRIMARY MAIN labels, **25** were read correctly by the ensemble and bound by the assignment, yet have no statement — in every case the chain kept a classic-token reading the legacy scale could not fit, and the ink never reached the chain because the re-read is gated (`sameEntries` under CONFIRMED, `rereadable = false` under LEGACY_UNCONFIRMED; `causal-map.md` §7) | Every chain of a frame whose labels have lattices is **offered** a re-read from its inks (`correctionReadings`) at the scale the frame stands at, whatever the relation. Adoption is production's unchanged rule: the offer must READ more of the chain than the vote did and take no ink another chain reads; anchoring is production's (incl. `anchorable`). Falsifiable: if the gate is not the bottleneck, `READ_RIGHT_NOT_BOUND:BOUND_NO_STATEMENT` does not fall. | `metric-solution.ts` |
| **C1N1** | C1 + N1 | combination, exploratory (N1's re-read chains anchor only through C1's READ rule; under N1 alone production's `anchorable` blocks re-read anchors) | |

Not tested (recorded with callsites in `causal-map.md` §8): substitution votes for the legacy scale (D1 — changes L on
every frame), reconstruction provenance (D8), the registration kept-anchor count (D9), one-directional orientation dedupe
(D10), line fragmentation (D12 — the Murajach root).

## 4. Measures

**Label / binding level** (`score_labels.py`, per variant, PRIMARY and SENSITIVITY, per sheet and family, S5 apart): per
truth dimension label — reader (CORRECT / WRONG / NONE / ROTATIONAL_TWIN), assignment decision, statement (origin, value,
scale-dependent, anchor), binding vs truth, and the first bad step (`NEVER_PROPOSED`, `NOT_ON_A_CHAIN`,
`READ_NOT_CORROBORATED`, `ROTATIONAL_TWIN_AMBIGUOUS`, `READ_WRONG`, `READ_RIGHT_NOT_BOUND:*`, `READ_RIGHT_BOUND_WRONG`,
`SCALE_DEPENDENT_VALUE`, `PRINTED_VALUE_WRONG`, `NONE`); aggregates: correct printed + bound, wrong-when-asserted, spurious
certainty (asserted printed value wrong or bound wrong), scale-dependent anchors, sound abstention. Per frame: registration
exists, anchors by origin, scale error vs 005O TRUE_SCALE, false-confident scale (> 3 % at confidence ≥ 0.5).

**House level** (`score_houses.py`, 48 rows): outcome, refusal code, decision path, frozen `holdout/verdict.mjs` verdict
and footprint residual (computed offline, after the run, on the run's own evidence — the only place a published figure
meets a variant), model/program/failure/unresolved hashes, 005Q semantics (wall rings + evidence status, terraces, wide
openings, boundary bodies, unresolved gaps, MASS provenance), metric semantics (per plan frame: registration mpp,
confidence, anchors by origin; metric solution relation/class/witnesses), a semantic model summary (storeys and level
heights, walls by kind, openings kind+width+host, rooms, terraces, roofs, balconies, stairs, footprint, evidence-status
census incl. SOURCE_EXACT), and against C0 every change. Changed refusals are classified by hand from the decision path:
`EVIDENCE_NO_LONGER_SELF_CONFIRMS` (a registration or statement disappeared because it rested on scale-chosen values) vs
`GENUINE_REPAIR` (the model moved toward the drawing through a source-supported statement, verified on the evidence) vs
`REGRESSION`.

## 5. Predictions (written before any challenger runs)

Offline anchor simulation on the C0 evidence (211 plan registrations): under C1, **66** fall below two anchors (115 under a
READ-only rule without ink-first) and **21** lose every anchor.
- **C1.** Labels: `SCALE_DEPENDENT_VALUE` (34 PRIMARY MAIN) falls sharply; `NONE` rises from 10; scale-dependent anchors 42 → 0;
  **spurious certainty rises** wherever a correct ink sits on a wrongly bound span (e.g. Głogowniki `501→505` where the ink
  reads 302; Murajach `151→157` where the ink reads 252 on 63.5 px): a wrong-span promotion C1 does not prevent.
  Houses: registrations disappear on frames whose anchors were all uncorroborated corrections (attics, site plans,
  `zurawkach …45095f59cd`), scale moves ≤ 1 % where ink replaces corrections; **known-good models change** (marcowki Y
  12.61 → 12.60 m, kosacce mass-1 6.48 → 6.65 m and interior lines up to 20 cm): **G1 predicted FAIL**. Murajach: stays
  refused (no independent two-axis witness; its ink-first anchors include the wrongly bound 252/63.5 px, an
  anisotropy no registration can honour) — if it completes, that is a false-confident scale (G2). Goździkowce: S4
  registration from ink (1385, 524, 317, 950) at ≈ +0.3 % X; still fails at chimney emission (unrelated). Głogowniki: 870
  READ; 541 stays CHAIN_CORRECTED (CONTESTS) and no longer anchors; footprint ≈ −8 % unchanged.
- **C2.** Few label changes (span re-pick without centring is rare in the truth set; DERIVED "nothing printed" spans with a
  bound label become unread — Głogowniki `e002fdbefa`); model changes where a DERIVED span pinned a grid line or an end
  span (`plan-decomposition.ts:856` now sees `labelled`). **G1 at risk** (DERIVED spans feed the layout ladder).
- **C3.** Changes only frames with an OTHER_AXIS_SCALE / joinedCm / UNDECIDED vertical chain (Murajach `chain-vertical-244`);
  those chains' anchors vanish → Y registrations disappear on such frames. G1 at risk where a known-good plan has an
  UNDECIDED vertical chain.
- **N1.** `READ_RIGHT_NOT_BOUND:BOUND_NO_STATEMENT` falls (ink that fits the frame scale becomes READ statements); on
  LEGACY_UNCONFIRMED frames the re-read is at an unsupported scale (production's reason for the gate) — reads that fit an
  unsupported scale are new statements, not new witnesses; production's `anchorable` blocks re-read chains' anchors, so
  **registrations lose anchors on many frames** → G1 predicted FAIL.
- **C4, C1N1.** Union of their parts; no prediction of a net gain.

## 6. Safety gates (adoption-eligibility; this stage adopts nothing)

| gate | operational definition | applies to |
|---|---|---|
| **G1** known-good | on every C0 `PASS` row and on the named controls (rarytasy-g2e/-eoze/eoze-legacy-*, dom-pod-jarzabem open porch, kosacce-clean/-tracked/-area-alone, A06/A07 storeys, marcowki, dom-w-zurawkach, dom-miniaturka, Tymianku, Daliach): the semantic model summary identical (storeys, level heights, walls by kind, openings kind+width(2 dp)+host, rooms, terraces, roofs, footprint (2 dp)), verdict unchanged. Byte-only changes with an identical summary are listed and explained (trace/provenance). | all |
| **G2** source authority | (a) **zero** registration anchors citing CHAIN_CORRECTED or `dependsOnScale` evidence, on every row (absolute — the incumbent fails it); (b) every INK_FIRST statement equals its lattice record's ensemble reading (AGREES/LEADS) — no silently changed printed number; (c) no new false-confident scale: a row that completes under the variant with |footprint residual| > 6 % where C0 refused or was within 6 %, or a truth sheet whose registration moves > 3 % from TRUE_SCALE at confidence ≥ 0.5; (d) no new SOURCE_EXACT on a row unless traced to a READ statement; (e) no changed refusal explained only by withheld evidence counting as agreement (decision path: T1/T3 share computed on fewer as-read statements). | all |
| **G3** no invention | no new built area, terrace, closed/carport/pergola/porch body, room or wall on any row; no wide opening changes class; every changed `bodies` / `terraces` / `wideOpenings` entry listed with its source evidence. No publisher pixel is committed; negative fixtures are the frozen rows themselves (jarzabem porch, kosacce carport/pergola/open side, akebiach courtyard, krasnokwiatach covered terrace). | all |
| **G4** determinism, leakage | C0 = C0dup = C0warm (S1, S2); a re-run in rotated order byte-identical; no challenger patch names a row, family, slug, published area, footprint, verdict, truth path or file name (architecture test). | all |
| **G5** refusals and conflicts | every changed refusal and every changed SOURCE_CONFLICT / METRIC_CHALLENGE listed and explained; no existing correct SOURCE_CONFLICT suppressed without an independent reason; reconstruction code (incl. 005P N1a) byte-identical in every variant (no patch touches it — checked). | all |
| **G6** cost | extraction wall time and peak RSS per row from the replay logs (contended, 3 workers); interleaved A/B/B/A uncontended on 6 rows (no ACCEL) for any candidate surviving G1–G5: median ratio ≤ 1.15, peak RSS ≤ +10 %. Node 18 / ARM64 phone: UNMEASURED unless run. | survivors |
| **G7** mutations | each mutation applied to the challenger copy must be **killed** by a named spec test or gate: M1 self-witness (C1 re-admits CHAIN_CORRECTED anchors) → G2a; M2 silently changed printed number (ink value ± 10) → G2b; M3 duplicate reader as independent (C1 accepts NOT_CORROBORATING) → `c1.spec`; M4 max-p rotation (C3 decides UNDECIDED by page-vote merit as a witness) → G2a on a C3 row with an UNDECIDED vertical chain; M5 missing value as agreement (C1 treats CONTESTS as ink) → `c1.spec`; M6 wrong-span promotion (C2 centring 0.3 → 1.0) → `c2.spec`; M7 known-good semantic switch (a known-good model with one window turned into a door, given to the gate) → G1; M8 source-truth / filename leakage (a patch naming a row slug or reading `publishedFacts`) → architecture test. | harness |

**Rule:** a challenger failing any of G1–G5 is `NOT_ADOPTION_ELIGIBLE`; the stage result is then `NO_SAFE_ADOPTION` for it
and production stays frozen (it is frozen regardless). A label-level gain never justifies adoption when house topology
worsens.

## 7. Selection and recommendation

Among adoption-eligible challengers (none failing G1–G7): (1) fewest spurious certainties and false-confident scales;
(2) then the most correct printed-and-bound labels on PRIMARY (with sensitivity reported); (3) then the smallest change.
At most **one** candidate is named for a future, separately authorised production patch, or **NONE**. A research PASS is an
integration study only; it fixes no house.

## 8. Stop rules and limits

S1/S2 above. A challenger crash on any row = inadmissible (reported). Disk: outputs gzip'd; runs that are not needed for
the report are deleted after scoring. No fresh blind, no APK, no 005R/005S, no production edit.

## 9. Patch hashes at commit

Filled by the commit that adds this file (`candidates/*.patch`, `ACCEL.patch`); see §9 table appended below.

| file | sha256 |
| --- | --- |
| `ACCEL.patch` | `ae9e800504c4a84aca6d8d22df513772bcdeca3fc2e08d906f85b59e90f814e0` |
| `candidates/C1.patch` | `a67c487fc3cbc265615ca07ae9e76e60dcfd2c69d158a7947bdc0d6727dd6a93` |
| `candidates/C2.patch` | `596eeb2d59d5560b5812b56d91117efee90b7eef232cd891a34159c2768efd8d` |
| `candidates/C3.patch` | `ac1b4c36a973c8f2aab45012d4bb71f44631ee2d179dff8c652ac3aab07593ed` |
| `candidates/C4.patch` | `fb26adb3617dfa7a63b2c7d682f545e9fc024b3158689139cdffdbac8f5a8159` |
| `candidates/N1.patch` | `499dfb0e54df432257a5ad7de6830cc7b1ee47d2d48b3182e56bca6db11a31e0` |
| `candidates/C1N1.patch` | `756725e7c484c45096f43d16641f12c1902feb6d87dad85286954d30b1edbfeb` |
| `spec/c1.spec.ts` | `682038dec89e2a7222d26e2b962eea58af2f2565b983f9de352245a9b5fb1fc2` |
| `spec/c2.spec.ts` | `d32355deb09657143eb61d4b9afba5d6335c9bc1328fe9625fa12cba258449cc` |
