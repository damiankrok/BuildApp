# 005D post-implementation review C: circularity, independence, first-success challenge, e-OZE gate split

Reviewer C. Read-only on the repository (HEAD `6f3f996`, branch `analyzer/dimension-chain-integrity-v1`). Scratch probes and
replays live in `.cache/review-c/` (gitignored). No publisher image was copied. I read the code, not the summary:
`metric-solution.ts` (solver 1.1.0), `plan-resolution.ts` (resolver 1.4.0), `reconstruct-v2.ts`, `known-row.mjs`,
`dev-row.mjs`, `verdict.mjs`, `second-house.ts` and the CI job `analyzer-generalization`. Evidence came from
`/home/user/work005d/{m2,known2}` and from new replays and probes.

Method:
- Hand-made adversaries in the shapes the 005D suites use: the first-success house from `reconstruction/test/plan.ts`,
  and the label-binding token builders.
- A decoy-factor sweep on the sealed legacy e-OZE evidence: 27 factors for every copy, 11 for the area copy alone.
- A margin probe that calls `sourceConflictOf` on all 13 development houses, at the real registration and at each rival
  hypothesis.
- The 005D test files: `source-conflict`, `first-success`, `label-binding` and `metric-solution` (4 files, 49 tests),
  all green.

## Findings

| ID | Sev | Finding |
|---|---|---|
| P0-1 | P0 | On the source-conflict path the published figure chooses which of the drawing's scales replaces the first reading |
| P1-1 | P1 | `undecidedConflict` makes a corroborated, correct scale INCONCLUSIVE when one child is misread |
| P1-2 | P1 | `PARALLEL_COPY_OF` is recorded and never consumed: one statement printed twice gives two groups, and WEAK becomes SUPPORTED (I5) |
| P2-1 | P2 | The decoy lane cannot see P0-1: legacy e-OZE offers one alternative only |
| P2-2 | P2 | The legacy-compat, known-row and verdict judges are weaker than §2.7/R9; a REPLACED record carries no trigger code |
| P2-3 | P2 | `verdict.mjs` `resolvedWithAWitness` reads only `PLAN_RESOLUTION`, so the verdict depends on the summary format |
| P2-4 | P2 | An early REPLACED is challenged a second time with the figure SCORED; the judges read only the first entry |
| P2-5 | P2 | Values whose way up was chosen by a scale count as "as read" in the resolver (latent) |
| P2-6 | P2 | Contract items not implemented: T4, R7, R8, R10 (`CROSS_COPY` provenance), AGREES_AS_READ family = one group |
| P2-7 | P2 | T1 margin: the MAJOR condition already holds on 2 correct houses; one long ink can both generate and refute |

### P0-1: the figure chooses among the drawing's scales (`challengeFirstReading`, conflict path)

The contract says the drawing picks the winner and the figure then verifies or vetoes it (R4–R6: "The figure is in no
comparator"; "a challenger strictly better on the drawing, and none acceptable → refuse"). The code does the opposite
order: it filters on the figure first and ranks by the drawing second.
- `plan-resolution.ts:1060`: `winner = composed.filter(c => stage 2 && acceptable(c) && strictlyBetter(c, incumbent)).sort(byDrawing)[0]`.
- `strictlyBetter` (`:1052`) contains the footprint bucket.
- Stage 1 (`:1033`) drops a figure-WRONG alternative before it is ever composed.

So when the drawing's preferred scale is vetoed, a scale the drawing ranks lower but the figure verifies wins, and it
is recorded as `publishedFigure: VERIFIED`.

**Reproduction** (`npx vite-node .cache/review-c/probe-f1.ts -- fig <published>`).
- Plan: the first-success house at a 5 cm/px registration, with as-read chain values only:
  - `cx` 40|120|200|400 reads 320, 368, 800
  - `cy` 40|160|280 reads 480, 552
- Metric hypotheses: 4.0 cm/px (3 groups) and 4.6 cm/px (2 groups).
- As read, the registration is refuted on 100 % of the length, 4.0 on 33 % and 4.6 on 67 %. The drawing prefers 4.0.
- The solution is either LEGACY_UNCONFIRMED/INCONCLUSIVE or CONFIRMED/STRONG.

| published m² | outcome (both solutions) | built scale |
|---|---|---|
| 112 | `REPLACED`, figure `VERIFIED`, "4.6 cm/px … 111.7 m² (-0.2 % of 112), AGREES" (4.0 at 84.5 m² is WRONG) | **4.6** |
| 85 | `REPLACED`, figure `VERIFIED`, "4 cm/px … 84.5 m² (-0.6 % of 85), AGREES" | **4.0** |
| 160 | `REFUSED` SOURCE_CONFLICT, preferred 4 cm/px | none |

The same drawing is built at 4.0 or at 4.6 depending only on the figure. The trigger was `AS_READ_REFUTATION,OUTER_TOTALS`,
computed without the figure, so the drawing really does prefer 4.0.

The same root lets a `WALL_MASS_CLUSTER`/`WALL_WITNESS` alternative at the refuted registration scale win when the figure
AGREES with it: it is "drawing-better" on wall coverage, while the conflict says that very scale is refuted.

**First bad decision:** `:1060`, where `acceptable(c)` is applied before the drawing's preference.

**Generic fix:**
1. When `conflict` is set, decide `preferred` on `drawingTuple` alone, among every alternative with a SCALE departure
   that is drawing-better (stage 1 or stage 2, the figure ignored). Exclude registration-scale re-framings from
   answering a scale conflict.
2. Compose `preferred` and apply `acceptable()` to that one reading only: accepted means REPLACED, anything else means
   REFUSED.
3. Never fall through to a lower-ranked alternative.
4. Drop the bucket clause from `strictlyBetter` on this path.
5. Add a metamorphic test that sweeps the figure across every alternative's area: the built scale must be invariant,
   or the run must be refused by name.

### P1-1: `undecidedConflict` over-fires (`metric-solution.ts:848–855`)

The rule asks only that every counted member of `selected` and `rival` sit on the two chains of some `CONFLICTS_WITH`
relation. It never asks whether the pair itself decides. Pre-review C §4.6 limited INCONCLUSIVE to "a CONFLICT_AS_READ
family **with no independent group**".

**Reproduction** (`npx vite-node .cache/review-c/probe-m.ts -- m1`). One axis: a total of 1055 over 556 px, and on a
line 35 px away three children printed 400|300|355.

| case | relation / confidence | hypotheses |
|---|---|---|
| all read right | CONFIRMED **SUPPORTED** | 1.897482: 4 groups, corroborated |
| child 300 read 360 (rival +20 %, plausible) | CONFIRMED **INCONCLUSIVE** (`undecidedConflict: true`) | 1.897482: 3 groups, corroborated; 2.276978: 1 group (17 % of the weight) |
| same, plus a vertical overall 700 read right | CONFIRMED STRONG | (the rule is dodged by any counted ink off the pair) |

What this costs: the frame loses SUPPORTED, so `firstReadingNeedsChallenge` fires (figure SCORED). It also means
`metricStop` renames any later plan failure as METRIC_RESOLUTION_INCONCLUSIVE.

This shape is common on single-axis copies (area tables, a plan with one dimensioned side). It does not fire on the 13
houses: four frames carry a `conflictsAsRead`, and none is undecided.

**Generic fix:** mark the pair undecided only when, inside the pair, neither side has more independent groups than the
other (or when the selected side is supported by the total alone). The side carrying the total plus agreeing children
is decided by them; record the conflict either way.

### P1-2: parallel copies count twice (I5 not enforced)

`dimensionHierarchy` records `PARALLEL_COPY_OF`, but nothing reads it: `grep` shows its only consumer is a count in
`topology.hierarchy`.

**Reproduction** (`probe-m.ts -- m4`):
- One overall line with one label: CONFIRMED **WEAK**, 1 group.
- The same line drawn twice 12 px apart, each copy with its own printing of `1055`: CONFIRMED **SUPPORTED**, 2 groups,
  corroborated, `parallelCopies: 1`.

One geometric statement corroborates itself. SUPPORTED plus a chain frame then skips the first-success challenge.
(A twin detection with a single label is counted once, which is correct: probe `m3`, case M3a.)

**Generic fix:**
- Merge the regions on `PARALLEL_COPY_OF` lines into one witness group before `shareEvidence`, so they are not
  `corroborated` and not counted as two groups.
- Do the same for a TOTAL_OF family that AGREES_AS_READ (contract §2.4: it may be value-corroborated, but counts as one
  group; today M1's control counts 4).

### P2-1: the decoy lane is meaningful but blind to P0-1

Sweep: `.cache/review-c/sweep.sh every "" <factors>` (and `area "<dimensioned ids>"`) on the sealed 005A e-OZE evidence.

| factors × published | every copy | area copy alone |
|---|---|---|
| 0.70–0.90 | REFUSED SOURCE_CONFLICT (preferred 2.2236 NEAR or WRONG) | 0.80–0.90 REFUSED |
| 0.92–1.00 | REPLACED at 2.223611, figure VERIFIED, AGREES (−4.2 … +4.1 %) | 0.95–1.00 REPLACED at 2.223611 |
| 1.02–1.50 (registration AGREES at 1.18–1.30) | REFUSED SOURCE_CONFLICT | 1.05–1.30 REFUSED |

- On this evidence the figure never chooses: across 27 factors, the only completion is the drawing's 2.2236. The
  refuted 2.50 registration is never built, the 1.25/0.8 decoys refuse by name, and no factor reaches `resolvePlan`.
- The decoys do catch these regressions: keeping a refuted incumbent (×1.25), accepting a NEAR without corroboration
  (×0.8), and dropping the conflict check altogether.
- But legacy e-OZE has exactly **one** drawing alternative, so ranking among alternatives cannot be exercised. The lane
  is green today on code that contains P0-1.

**Fix:** add a synthetic decoy row with ≥ 2 drawing alternatives (P0-1's fixture) to the gate. Pick decoy figures
relative to the evidence: one at each non-preferred alternative's area. Every one of them must refuse or build the
preferred scale.

### P2-2: the judges are weaker than §2.7/R9

- §2.7(i) requires replacement on `AS_READ_REFUTATION`, at a scale ≥ 3 % from the corrected registration, with the
  figure VERIFIED. `known-row.mjs legacy-compat` instead accepts "within 6 % however reached". The 6 % footprint check
  does bound a true-figure completion to about ±3 % in scale, so a wrong-scale completion cannot pass this lane, but a
  figure-chosen one can.
- `known-row.mjs:61` (`!challenge.trigger`) and `verdict.mjs` `replacedByTheDrawing` (`Boolean(challenge.trigger)`) are
  vacuous: `challengeRecord` always sets `trigger` to the why-string, including on the 005B weak-metric path, where the
  figure is SCORED.
- A REPLACED record carries no `sourceConflict` or `conflictEvidence` (`challengeFirstReading` returns REPLACED without
  `conflict`). The trigger code R9 asks for is absent, and the sweep rows above show an empty slot.

**Fix:**
- Return `conflict` on REPLACED.
- Have the judges require `sourceConflict` to include `AS_READ_REFUTATION`, `publishedFigure === 'VERIFIED'` and
  `|chosenCmPerPx / registration − 1| > 3 %` for the legacy lane.

### P2-3: `resolvedWithAWitness` ignores a challenge

`verdict.mjs:65` reads `resolution?.chosenCorroborations` only.
- A full run emits `LAYOUT_PLAN_RESOLVED_BY_HYPOTHESIS` after a challenge replacement. Patching that one warning into a
  copy of `known2/eoze-every-copy` (`.cache/review-c/verdict-probe`) turns the verdict into `ALGORITHMIC_FAIL`, with
  `{"chosen":null,"corroborations":"","holds":false}`.
- A replay summary has no `warningDetails`, so the same evidence gives `PASS` ("the first reading held").

The verdict therefore depends on the summary format. A witnessed challenge would fail too.

**Fix:** apply the witness rule to whichever of PLAN_RESOLUTION or METRIC_CHALLENGE (REPLACED) built the model, and read
that entry's own `chosenCorroborations`.

### P2-4: double challenge after an early REPLACED (`reconstruct-v2.ts:267–317`)

After the early (footprint-refused) path replaces the reading, the `else` branch still evaluates
`firstReadingNeedsChallenge(metrics, incumbent)` on the **original** incumbent and challenges again, with
`conflict = null` and the figure SCORED.

Probe `probe-f1.ts -- fig 82` (weak solution): `challenge entries: 2`. The first is `REPLACED/VERIFIED`, the second
`REPLACED/SCORED` with the same winner.
- `planDiagnostics.challenge` (digest and evidence pack) now says SCORED.
- `known-row` and `verdict` read the first entry.
- The model happens to be identical, because the filter is identical.

**Fix:** skip the second challenge when the early one returned REPLACED, or else challenge the replaced result.

### P2-5: values whose way up a scale chose count as "as read" in the resolver (latent)

`extract.ts:814` sets `derivation.dependsOnScale` only for CHAIN_CORRECTED and OTHER_AXIS_SCALE. Two kinds of value are
therefore READ and not scale-dependent in the legacy chain evidence, which T1, T3, `refutedShare` and `latticeScales`
consume:
- values turned to join another chain's cluster (`joinedCm`, ORIENTATION_BY_SCALE in the solver);
- values whose way up the page vote kept (ORIENTATION_UNDECIDED).

Separately, `bothAxes` (the ISOTROPY corroboration for lattice challengers) uses `zeroSubstitution`, not `asRead`, and a
0.15 share where R10 asks for an as-read substantial reading.

On the dev set this touches at most 2 short segments per house (≤ 84 px, none on a selected frame).

**Fix:** carry the solver's `independence` into `derivation`, so that only INDEPENDENT values are as-read; use `asRead`
and `WITNESS_SHARE.substantial` in `bothAxes`.

### P2-6: contract items not implemented (recorded, not reproduced)

- **T4 `HIERARCHY_CONFLICT`:** a hierarchy conflict reaches the resolver only through lowered confidence, that is, the
  005B path with the figure SCORED.
- **R7:** `compareReadings` still ranks the footprint bucket before the refuted share. In `resolvePlan`, with the figure
  unspent (the first reading failed for a non-footprint reason), the figure still ranks scale departures, the same root
  as P0-1.
- **R8:** T1 and T3 score legacy chain segments, not primary bindings.
- **R10:** `CROSS_COPY` (`:422`) does not check that the other copy rests on different printed text.

### P2-7: T1 margins (decided without the figure; no false trigger today)

| house | registration refuted (as read) | best alternative | fires |
|---|---|---|---|
| Kosaćce (pinned PASS) | **0.570** | 0.747 (1.449) | no |
| Jabłonkach | **0.540** | 0.656 (0.939) | no |
| Marcówki / Modrzykach / G2E | 0.427 / 0.339 / 0.308 | ≥ 0.815 / 0.902 / 0.938 | no |
| Miranda / Żurawkach / Azalia / e-OZE | 0.214 / 0.251 / 0.202 / 0.115 | 1.0 / 0.781 / 1.0 / 1.0 | no |

The MAJOR condition (≥ 0.5) already holds on two correct houses, because their misread long labels (Kosaćce's printed
1660, read 1000, 690 px) count as refutation. They are kept only by "an alternative ≤ registration − 0.25".

On legacy e-OZE, the one ink `1601/720 px` is 68 % of the as-read length: it both generates 2.2236 and is most of the
registration's 0.921. That is not circular (it is an as-read value, and R10 calls the result "figure-verified,
unwitnessed"), but a single long misread on a short-read house would trigger T1. With a true figure the outcome is a
named refusal, never a wrong build.

Sensitivity: registered at each plausible rival hypothesis, T1/T3 fire on 13 of 17 cases. They miss Kosaćce at 2.2703
(−5.6 %) and 1.4493, Jabłonkach at 0.9390, and alt-Marcówki at 1.4052.

## What did not break

- **No false trigger.** `sourceConflictOf` is null on every one of the 13 houses at its registration (`margins.ts`), and
  no METRIC_CHALLENGE carries a `sourceConflict` in `m2`. Current e-OZE: no challenge, REPLACED/STRONG 2.2236 from an
  overall reading.
- **Scale-derived values do not witness in T1/T3.** CHAIN_CORRECTED values count only through the reader's first
  reading. DERIVED values and READ values with `dependsOnScale` are excluded. `metricScales` offers only counted
  (independent, decisive) clusters, and lattice values (I4) are never witnesses. `sourceConflictOf` is never given the
  figure.
- **One ink, one witness holds in the solver:**
  - only a PRIMARY binding can be decisive;
  - I2 demotes an ink with two decisive keys;
  - `gather` keeps one observation per region and cluster;
  - V3 (against the vote and against rivals) only removes evidence, never adds it;
  - the 005D adversaries pass: a total and its off-centre part are one witness, and an ink read both ways up is one region;
  - a twin-detected line with one label counts once.
- **The legacy lanes cannot pass a wrong-scale completion with the true figure.** The model-footprint check holds a
  completion to ±6 % of the area. Across 38 legacy-e-OZE replays the registration's 2.50 is never built.

## Verdict

| Area | Verdict |
|---|---|
| OCR/metric non-circularity | **PASS with defects**: no scale-derived witness found. One statement on parallel copies counts twice (P1-2), orientation-by-scale values are "as read" in the resolver (P2-5, latent), and the TOTAL_OF family is not one group (P2-6) |
| First-success challenge, source-driven | **FAIL (P0-1)**: the trigger is figure-free and does not fire falsely on the 13 houses, but with ≥ 2 drawing alternatives the figure picks the built scale; plus the double challenge (P2-4) and R7 missing |
| e-OZE gate split | **PASS with gaps**: the current row is honest, legacy-compat cannot pass a wrong scale, and the decoys refuse by name at every factor tried. But the lane is blind to P0-1 (P2-1), the judges are weaker than §2.7/R9 (P2-2), and the verdict depends on the summary format (P2-3) |
| Hierarchy conflict handling | **FAIL (P1-1)**: correct houses are untouched today, but one misread child makes a corroborated single-axis scale INCONCLUSIVE; any counted ink off the pair dodges the rule; T4 is absent |
