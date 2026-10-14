# 005Q-CHAIN: label binding, chain solving and anchor audit (axis-topology / dimension-lines / chains / extract)

**Summary.** Labels are not bound by greedy or local-nearest rules. Since 005I they are bound by an exact Hungarian min-cost assignment of each label to one (chain, elementary interval) slot. The cost is purely geometric and does not use the label's value or the page scale. The defects are around that step. A uniform reward for binding any label lets a stray or fragment token displace a real one, and this shows up in sealed packs. The chain solver re-picks which span a label measures without checking that the label is centred, and still marks it READ. Labels that end up unbound leave no evidence or gap, and their span becomes DERIVED with false provenance. The suspected self-witness at extract.ts:997 is confirmed.

Tags: **K** = read in code at the cited line. **M** = read in a sealed evidence pack under `stage-reports/artifacts/`. **H** = hypothesis. All paths are relative to `/home/user/BuildApp/packages/source-metrics/src/` unless a package is named. Nothing was edited or run beyond read-only commands.

---

## 0. Pipeline order inside one frame (extract.ts)

1. **K** `extract.ts:386` calls `dimensionChainsOf(findDimensionLines(mask,{raster,grey}), read.raw ?? read.tokens, mask, obs)`. That function (`extract.ts:1047-1052`) runs `markLabelInk` (with `labelInkOf`), then `chainsFromLines`, then `measurementChain`.
   - It returns `allChains` (every line), `rawChains` (kept), `measured` (kept, with label-ink marks removed) and `labelInkLines`.
2. **K** `extract.ts:390`: the legacy pass, `solveFrameChains(measured, read.tokens, {tolerancePx, plausibility, checkpoint})`. Inside it, `chains.ts:574` calls `assignLabels` **without** `preferCentred`, and `chains.ts:587` calls `solveChain` **without** `topology`.
3. **K** `extract.ts:416-417`: `labelHeightOf`, then `dimensionAxisGroups(frame.id, measured, ids, labelHeightPx)`. This runs **after** the assignment and is used only for records and `DimensionChain.topology` (`extract.ts:1035`).
4. **K** Plan frames with raw tokens go through `solveFrameMetric` (metric-solution.ts:744), which makes two more kinds of assignment call:
   - one per orientation: `assignTokens(..., {preferCentred:true})` at metric-solution.ts:760;
   - a final one: `assignLabels(chains, corrected, {preferCentred:true, readingsOf: latticeReadings})` at metric-solution.ts:1289.
   - Re-solving uses `solveChain(..., {fixedScale, topology: replaced, minCorrectionPx})` at metric-solution.ts:1310.
5. **K** `extract.ts:482` calls `buildChain`, which turns solved segments into `MetricEvidence` (`extract.ts:938-981`), `DimensionChain.segments` and `ScaleAnchorInput`s (`extract.ts:997-1006`). Then `extract.ts:793-807` calls `registerFrame`.

---

## 1. How a label is assigned (Q1)

**C1.1 K: the slot unit is (chain, elementary interval), not a segment or span.**
- `labelCandidates` (`axis-topology.ts:216-245`) computes `interval` at `:234-235` as the gap between consecutive marks of the *measurement chain* that contains the label's centre.
- `slotKey = chain:interval` (`:374`).
- Which span a label actually measures is decided later, in `solveChain` (see C3.3).

**C1.2 K: one-to-one.** Each label gets at most one slot and each slot holds at most one label. The matrix is built at `:419-423` and solved by `solveNeighbourhood` (`:311-321`): a Hungarian solve over `[costs | n zero "unassigned" columns]`, using `hungarian` (`:252-301`, Kuhn–Munkres O(n²m)).

**C1.3 K: the solve is global per neighbourhood.**
- Labels that share any candidate slot are union-found into one neighbourhood (`:375-394`), and each neighbourhood is solved exactly.
- Canonical ordering: chains by `chainKey` (`:344`), tokens by `tokenKey`/`tokenDetail` (`:350`). Identical ink is deduplicated (`:352-354`).
- A neighbourhood with more than `componentLabels`=96 labels is still solved exactly, but its margin is checked only locally and it is flagged `bounded` (`:425-449`).
- A neighbourhood whose work n²(slots+n) exceeds 6e8 is not solved: every label in it becomes `UNASSIGNED, bounded:true` (`:404-411`).

**C1.4 K: the cost (`:241`).**
- `cost = offset + 1·againstConvention + 2.5·(preferCentred && !centred)`. `offset = |centre − baseline| / max(1, token.height)` (`:231`).
- Candidate gates:
  - text axis equals chain axis (`:228`);
  - offset ≤ `maxOffsetHeights` (default 2.2, `:222`, `:232`);
  - centre along the line lies within [first mark, last mark] (`:233`).
- Bound cost is `cost − reward`, with `reward=6` (`:73`, `:421`). Leaving a label unassigned costs 0.
- `centred` (`centredOn`, `:203-213`) means some span across at most 2 skipped marks is centred within 0.3·length.
- The side convention is learned per sheet from uncontested anchors (`sideConventionsOf` `:481-499`, `sideConventionOf` `:135-142`). ISO "BEFORE" is the default.

**C1.5 K: ties and near-ties abstain.**
- For a bound label, `margin` = (best total with that label forbidden from its slot) − (optimum) (`:436`, `:442`).
- For a label left unassigned in the optimum, `margin` = (best total that forces it onto some slot) − optimum (`solveNeighbourhoodBound` `:502-510`, `:437-441`).
- `margin < 0.1` makes the label `AMBIGUOUS` (`:452-453`). It is then left out of `perChain` (`:464`), but its slot is **not** given to anyone else: the other labels keep the optimum's placement.
- Existing test: `test/dimension-topology.test.ts:225` expects `400` and `300` both AMBIGUOUS.

**C1.6 K: occupied slots.** Two labels whose centres fall in the same elementary interval of one chain cannot both bind there. The loser goes to another candidate or to UNASSIGNED/AMBIGUOUS.

**C1.7 K: labels off the line produce no record at all.**
- A token with zero candidates is skipped at `:355` before `labels.push`. It gets no `LabelAssignmentDecision` (the type comment at `:168` says so).
- The same happens to a token with no `LINEAR_DIMENSION` reading (`:366`), and to a lattice that `readingsOf` returns `[]` for (metric path).
- Examples: a label printed beyond the end ticks, a label more than 2.2 heights from the line, a label read in the wrong axis.

**C1.8 K: split lines are never rejoined.**
- `findStraightRuns` breaks a run at any gap over `maxGapPx=2` (`dimension-lines.ts:116`, `:202-205`). It drops a run entirely if its *middle* crosses ink thicker than 3 px (`:209-210`).
- No code joins collinear pieces (grep for collinear/rejoin finds nothing in source-metrics).
- `dimensionAxisGroups` needs overlap ≥ 0.5·shorter (`axis-topology.ts:559`), so collinear disjoint pieces are never grouped.
- Consequences:
  - **K** a label centred in the gap (in-line style text that breaks the line, or a logo) lies outside both pieces' tick ranges, so it is silently dropped (C1.7);
  - **K** a dimension running across the gap cannot be represented.

**C1.9 K: nested dimensions (an overall line beside its parts).**
- These are separate chains, so they are separate slots. The overall label and the part labels compete only through candidate costs (offset and side).
- The axis topology (`SUBDIVIDES`/`OVERALL`, `axis-topology.ts:600-623`) is **not** an input to `assignLabels`; the signature at `:336-340` has no topology parameter.
- An overall label printed on the *same* line as its parts cannot be told apart from a part label: it is bound to its centre interval, and the span is left to the solver DP.

**C1.10 K: one frame runs several assignment passes with different inputs.**

| Pass | Location | Inputs | Decisions kept? |
|---|---|---|---|
| Legacy | `chains.ts:574` | `read.tokens`, no centring cost | Recorded as `dimensionTopology.assignment.legacy` |
| Per orientation | metric-solution.ts:760 | `dimensionLabels`-filtered raw tokens, centring cost | **Discarded**: `assignTokens` returns only `perChain` (`chains.ts:201`) |
| Final | metric-solution.ts:1289 | `corrected` tokens, lattice readings | Recorded as `.final` |

- Only plan frames get recorded (`extract.ts:485` `if (isPlan)`). Elevations and sections keep no decisions.

---

## 2. Can the global assignment steal a slot? (Q2)

**C2.1 K: yes, by design. A one-hop displacement always happens when it lets another label bind.**
- The reward is the same for every label (6) and larger than any candidate cost: at most 2.2+1 = 3.2 in the legacy pass, 2.2+1+2.5 = 5.7 with centring.
- So moving label A from its best slot to any other candidate (Δcost ≤ 5.7 < 6) is always worth it if it frees a slot for an otherwise-unbound label B.
- Multi-hop displacements happen when ΣΔ < 6.
- The reward does not depend on label quality (glyph count, height against the sheet's median, digit count) or on value. A 2-glyph fragment is worth the same as a clean 4-digit label (`:73`, `:421`).

**C2.2 Constructed example (legacy pass, ISO convention, height 10 px). K for the arithmetic; H that a stray like this parses as `LINEAR_DIMENSION`.**
- Lines:
  - O: horizontal, baseline y=100, ticks [0,400], so one interval;
  - C: baseline y=125, ticks [0,300,400].
- Labels:
  - A = "400", O's true label, centre (200,108), sitting between the lines: on O, offset 0.8, AFTER (against convention), cost 1.8; on C:0, offset 1.7, BEFORE, cost 1.7.
  - D = "300", centre (150,117): on C:0 cost 0.8; on O, offset 1.7 AFTER, cost 2.7.
  - B = stray "12", centre (170,92): on O, offset 0.8 BEFORE, cost 0.8; C is out of range (offset 3.3).
- Optimum: B→O, D→C:0, A unassigned, total 1.6−12 = **−10.4**. The correct assignment A→O, D→C:0 totals 2.6−12 = **−9.4**.
- Result: A is **UNASSIGNED** with margin 1.0, so it is not called ambiguous. O's overall 400 is lost, and O is solved with "12", which becomes an UNRESOLVED labelled segment. B's proposal also enters the legacy scale vote (`proposalsOf` `chains.ts:259-288`).
- The final pass's centring cost blocks B only if B is off-centre. At x=170 it is centred: |170−200| = 30 ≤ 120.

**C2.3 M: the same pattern appears in sealed evidence** (`07b-dimension-topology.json`, FINAL assignment).
- **krasnokwiatach** (`analyzer-005p/blind-round/evidence/blind-h2-dom-w-krasnokwiatach/`): token `13` (box 7×6 px at x181–188, y447–453) is BOUND at chain …17baff interval 1, cost 1.4375. Token `517` (box 10×17 px, ROTATED_CW) has that same slot as its **only** candidate (cost 2.727) and is UNASSIGNED, margin 1.29. Junk `1/±` also lost that slot.
- **miniaturka**:
  - `51` is BOUND at …69d4d6:8 (cost 0.667), and `517` (only candidate on that slot, cost 2.27) is UNASSIGNED;
  - `/73` is BOUND at …84015e:1, and `14` is UNASSIGNED;
  - `13` is AMBIGUOUS (margin 0.048) between two chains.
- Across the 10 sealed packs: UNASSIGNED counts are 0–3 per plan and AMBIGUOUS 0–4 (akebiach 4, miniaturka 1).
- **H**: that `517` is the true label in both cases, and that `13`, `51` and `/73` are fragments or strays. The pixels have not been checked.

---

## 3. Use of value or scale; where the solver re-assigns spans (Q3)

**C3.1 K: the cost ignores scale and value.**
- `labelCandidates` and the cost use only boxes, orientation axis, baselines and marks (`axis-topology.ts:216-245`). There is no scale input.
- Value enters only in three places:
  - as a membership test: the token must parse to a `LINEAR_DIMENSION` reading (`:356-366`);
  - as a digit count when choosing side-convention anchors (`:493`);
  - through readings for `labelInkOf`'s numeral test (`extract.ts:1060-1066`, glyph characters only).

**C3.2 K: the input set of the final assignment does depend on scale.**
- `corrected` (metric-solution.ts:1249-1270) swaps each legacy token for its other-orientation sibling whenever an orientation decision says so.
- Those decisions use `consistentCluster(…, tol, plaus)`, a scale clustering, and the `OTHER_AXIS_SCALE` route (metric-solution.ts:775-800).
- So which ink takes part in the final assignment can depend on a scale, even though the cost does not.

**C3.3 K: `solveChain` re-picks which span a label measures, using the scale and without any centring test.**
- `spanOf` (`chains.ts:643-700`) accepts any tick pair whose span contains the label (`inside`, `:650`), with at most 3 skipped non-REJECTED marks (`:660`).
- The reading is chosen by how well it fits `fixedScale` (`:671-683`). The DP (`:709-723`) picks the partition.
- **There is no centring check**, although `spansFor` (`:301-303`, `:319-320`) says a label against one end "is not measuring that span, whatever the arithmetic says." `spansFor` is used only for scale proposals (`proposalsOf`, maxSkip 0) and in metric-solution.ts:651.
- The resulting segment is `origin:'READ'` whenever `substitutions===0` (`:758`). It carries no `derivation.dependsOnScale`, because `extract.ts:964` adds that only for CHAIN_CORRECTED or for orientation decided by scale. The span was nonetheless chosen *by the scale*.
- **Constructed test (pure unit, no raster).** RawChain with ticks [0,100,200,300]; one ChainToken at `atPx=50`, reading 300 cm, confidence 1; `fixedScale: 1`.
  - DP values: span(0,3) = (1+1)·0.7² = **0.98**. The alternatives are span(0,1) = −0.5 (miss 200 px) plus 0.02 + 0.02, or −0.48.
  - Result: one segment [0,300], READ, `skippedTicks=[1,2]`. The label's centre is at 50; the span centre is 150 and 0.3·300 = 90 < 100, so `spansFor` would have refused it.
  - Expected after a fix: not READ over [0,3], or flagged as dependent on scale.
  - No current test covers this: `test/chains.test.ts:92` uses a centred spurious tick.

---

## 4. What an unbound label leaves behind (Q4)

**C4.1 K: AMBIGUOUS and UNASSIGNED labels do not reach the solvers.**
- Only BOUND labels go into `perChain` (`axis-topology.ts:464`).
- They get no `DimensionObservation`: `observationsOf` iterates assigned entries only (metric-solution.ts:484-490).
- They get no `MetricEvidence` and are not added to `usedTokens` (`extract.ts:924-925` adds only segment tokens).
- The leftover-token loop handles only `LEVEL_DATUM`, `ANGLE` and `OPENING_CALLOUT` (`extract.ts:545`, `:584`, `:611`). A leftover `LINEAR_DIMENSION` token is dropped without an `UnresolvedMetric`.
- What remains on the record:
  - the `OcrToken`;
  - on plans only, the decision in `dimensionTopology[].assignment.{legacy,final}` (`extract.ts:486-513`, schema `schema.ts:414`).
- The only consumer of those decisions is `evidence-pack/src/pack.ts:543-602`, which is diagnostic. Reconstruction never reads assignment status: grep finds `dimensionTopology` only in source-metrics, evidence-pack and the topology-probe script.

**C4.2 K: an unbound label's interval becomes DERIVED and is described as unprinted.**
- In `solveChain` the interval looks empty (merit 0.02, `chains.ts:662-667`).
- On a chain that is otherwise confirmed (`fitted>0 && residual ≤ 1.1 px`, `:778-786`), it gets `origin:'DERIVED'`, value = scale × px, confidence 0.4.
- `buildChain` writes the provenance text "**nothing is printed on this … px span**" (`extract.ts:936`) and omits `labelled` (`:986`). That statement is false for an AMBIGUOUS or UNASSIGNED label.
- Downstream, `reconstruction/src/plan-decomposition.ts:856` treats a segment without `labelled` as having no printed number.
- DERIVED segments do not anchor the registration (`extract.ts:997`).
- **Test.** C has ticks [0,100,200,300] with "100" bound in intervals 0 and 1. In interval 2, a third label is made AMBIGUOUS by an exact-cost tie with a parallel line. Assert that segment 2 is not DERIVED with "nothing is printed", or that it carries a flag saying a label is present but unbound.

**C4.3 K: frames other than plans keep no decision record**, so this loss cannot be audited there (`extract.ts:485`).

---

## 5. Mark classes and how segments form (Q5)

**C5.1 K: detection.**
- A hit is where `crossThickness ≥ thickness + 2` and `crosses` (ink on both sides beyond the line's half-thickness) at the same position along the line (`dimension-lines.ts:238-244`).
- Hits within 2 px are merged into one mark at their mean (`:245-259`).
- `findDimensionLines` keeps lines with at least 2 marks and `fill > 0.9` (`:180`).

**C5.2 K: classification (`classifyMarks` `:355-553`, final rule at `:546-551`).**

| Class | Rule |
|---|---|
| REJECTED | `LIGHTER_THAN_LINE && (WEDGE_NOT_STROKE || ONE_SIDED)` |
| QUESTIONABLE | `LIGHTER_THAN_LINE || ONE_SIDED || DUPLICATE || STYLE_MISMATCH || (WEDGE_NOT_STROKE && COLOUR_MISMATCH)` |
| TICK | otherwise |

- Consequence (**K** from the rule; **H** that it happens in practice): a dark wall face crossing the line with `WEDGE_NOT_STROKE` and nothing else stays a **TICK**, unless `STYLE_MISMATCH` (an internal mark more than 2× the end-mark width + 2) catches it.

**C5.3 K: label-ink marks (`markLabelInk` `:596-656`).**
- For each side of the line, the mark's ink is checked against glyph boxes of numeral labels running along that line (`LabelInk.axis`) that lie wholly on that side. "Label ink" means ≥ 90 % of the ink falls inside glyphs and no off-glyph ink touches the line within 2 rows.
- Both sides label ink: REJECTED with `TEXT_INK`. One side: TICK becomes QUESTIONABLE with `TEXT_INK`.
- `measurementChain` (`axis-topology.ts:89-92`) removes only REJECTED marks that carry `TEXT_INK` (`isLabelInkMark` `:83`).

**C5.4 K: every other mark stays a cut point for binding.**
- All remaining marks, including REJECTED marks without `TEXT_INK` and QUESTIONABLE marks, still split assignment intervals (`:234-235`) and still count for `centredOn` (`:203-213`).
- In `solveChain` mark classes matter only when `topology:true` (`chains.ts:628`). The legacy pass never sets it (`chains.ts:587`). The metric re-solve sets it only when the scale is REPLACED (metric-solution.ts:1310).
- So on the confirmed-scale path a REJECTED (non-text) mark is a full TICK that costs ×0.7 to run across.

**C5.5 K: `dimensionAxisGroups`** uses only TICK-class marks for line ends (`endsOf` `:570-573`) but any mark for `hasMarkNear` (`:568`). Roles are OVERALL / SUBDIVISION / PARTIAL / INDEPENDENT (`:620-623`, `:634`).

---

## 6. Self-witness suspicion at extract.ts:997 (confirmed)

**C6.1 K: CHAIN_CORRECTED segments become registration anchors.**
- The condition is `segment.origin !== 'DERIVED' && confidence > 0 && (anchorable?.(segment) ?? true)` (`extract.ts:997`). The comment at `:992-996` says "Only a segment whose number was actually READ anchors"; the code also admits CHAIN_CORRECTED.
- `anchorable` (`:478-481`) applies only when the scale stands and the chain was re-read, and it compares against the legacy segment, which may itself be CHAIN_CORRECTED.

**C6.2 K: such an anchor is an inlier by construction.**
- A corrected reading is chosen only if |v/s − px| ≤ 2.2 px (`chains.ts:672-673`).
- `registerFrame` is called without `tolerancePx` (`extract.ts:794-806`), so its inlier tolerance is 3 px (`registration.ts:128`, `:87`).
- Effects:
  - each such anchor lowers the residual and adds +0.08 confidence (`registration.ts:169`);
  - it counts toward the `anchors.length >= 2` gate (`extract.ts:793`).

**C6.3 K: the same applies, unflagged, to READ segments whose span was chosen by the scale (C3.3).**
- `reconstruction/src/plan-resolution.ts:202` and `:228` (`asRead` / `zeroSubstitution`) already exclude scale-chosen *values* from refutation, but registration has no equivalent guard.
- No test covers this (grep `CHAIN_CORRECTED` in `test/registration.test.ts` finds only the ladder at `:109`).

**C6.4 H: impact.** Inflated registration confidence where the anchors are mostly corrected values. The 005P lead cites murajach at 2.451 cm/px. This needs replaying to be confirmed.

---

## 7. Can min-cost matching / a topology-aware rule fit the existing structures? (Q6)

**C7.1 K: no new library is needed.** The exact assignment, abstention and work bounds already exist (`hungarian` `:252`, `solveNeighbourhood` `:311`, `solveNeighbourhoodBound` `:502`, margin logic `:428-450`, `ASSIGNMENT_BOUNDS.ambiguity` `:73`). A challenger only changes the **edge set and costs** at these seams:
- **(a) Displacement cap**, at `:419-423` (cost-row build). Make candidates with `cost > ownBest + Δ` FORBIDDEN, so a label is left UNASSIGNED rather than pushed onto a line it is not printed on. This addresses C2.1 and C2.2 and needs no scale.
- **(b) Reward that depends on label quality**, at `:421`. Replace the constant `R` with R(label) from geometry only: height against the sheet's median label height (already computed in `sideConventionsOf` `:484-485`), and glyph or digit count. This keeps the assignment blind to value and scale (non-circularity) and addresses C2.3.
- **(c) Topology input.** Move `ids`, `labelHeightOf` and `dimensionAxisGroups` before `solveFrameChains`. Their inputs (`measured`, `rawChains`, tokens) are all available at `extract.ts:390`. Then add an optional `topology: Array<ChainAxisTopology|undefined>` to `assignLabels`, `assignTokens` and the call at metric-solution.ts:1289, with a cost term in `labelCandidates` (`:241`), e.g. a label centred on the whole extent of an OVERALL chain against an uncentred SUBDIVISION interval.
- **(d) Span-aware edges without breaking bipartiteness.** Keep the slot as the centre interval, but let each candidate carry its best centred span (from `centredOn` `:203`, which already allows up to 2 skipped marks), with the cost including whether that span is centred. True interval packing (an overall label and segment labels sharing one line) is not a bipartite problem. It should stay in the `solveChain` DP, with the fix at C7.2.

**C7.2 K: the solver seam.**
- In `chains.ts:650` (`inside`), apply the same 0.3·length centring test as `spansFor` (`:319-320`). Alternatively, mark READ segments whose span was chosen by scale (any skipped TICK) as `dependsOnScale`, by extending `extract.ts:964` and excluding them at `:997`.
- For C4.2, give `solveChain` the intervals that have unbound labels (from `decisions` with candidates on that chain), and suppress DERIVED there (`:778-786`) or record it as `labelled:'UNBOUND'`.

**C7.3 Tests to register (all pure unit tests on constructed `RawChain` / `TextToken` / `ChainToken`, no raster):**
- T1: the C2.2 steal, legacy and centring variants. Expect A UNASSIGNED today; expect A→O under (a)/(b).
- T2: the C3.3 non-centred skip. Expect READ [0,3] today.
- T3: C4.2, an unbound label's interval turning DERIVED with "nothing is printed".
- T4: C6.1/C6.2, a frame whose only second anchor is CHAIN_CORRECTED still registering (via `extractMetricEvidence` on a synthetic sheet).
- T5: order and metamorphic invariance. The existing `test/axis-topology.test.ts` non-circularity and order suites must stay green.
- T6: a replay of the sealed decisions above (krasnokwiatach `517`/`13`, miniaturka `517`/`51`, `14`/`/73`), comparing label-level results first and then the end-to-end models.