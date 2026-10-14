# 005Q-CHAIN — causal map: printed number → dimension line → chain → scale → 3D

Base `cd0c513bcbbb5a00dc7115c887daada1800f9172` (005Q-OCR closing commit; `packages/` unchanged since 005Q, `packages/source-metrics/src` unchanged since 005I `c0ad2e8`). Written and committed **before any challenger ran** (contract §2).

**Method.** Nine read-only code/case readers (extract+chains, lattice+ensemble+OCR, binding topology, metric solution+registration, reconstruction consumers, Murajach, Goździkowce, Głogowniki, controls), six adversarial verifiers (one per load-bearing claim), one completeness critic; raw outputs kept outside the repository (`/home/user/work005q-chain/audit/`). Every claim below was re-read in code at the base or measured in sealed evidence. Tags: **K** = read in code, **M** = measured in sealed evidence / production replay, **H** = hypothesis (not used for any conclusion without a replay).

**Evidence identity (M).** The 005Q-CHAIN C0 replay re-runs the production source-metrics pass on every row's sealed package + observation graph + cached publisher bytes. On every row finished so far the fresh `metric-evidence.json` is **byte-identical** to the sealed one (e.g. jarzabem `7dba5532…`, marcowki `0e037495…`, kosacce `d1fe182e…`, miniaturka `a23c6092…`), and the solver output equals 005Q's PROD3 replay byte for byte. So the sealed sets *are* today's production evidence, and the audit's measurements on them are measurements of the incumbent.

**Line numbers** are those of the base; the verifiers corrected several map citations (noted where it matters).

---

## 0. The path of one printed number (one frame, in order)

| # | step | callsite (K) | what it decides | sees a scale? |
|---|---|---|---|---|
| 1 | classic template reader, four quarter turns, page vote | `ocr.ts:1017-1066` (`readNumbers`), `ocr.ts:921-958` (`dedupeOrientations`) | tokens (`OcrToken.text`, glyph alternatives), `pageVote` KEPT/DISCARDED = **orientation**, not value | no |
| 2 | dimension lines, marks, mark classes, label-ink marks | `extract.ts:386` → `dimensionChainsOf` (`extract.ts:1047`), `dimension-lines.ts:180-656` | chains, ticks, TICK/QUESTIONABLE/REJECTED | no |
| 3 | **legacy page vote and chain solve** | `extract.ts:390` → `solveFrameChains` (`chains.ts:567-600`): `assignLabels` (no centring), `proposalsOf` (`chains.ts:259-288`) over **every reading incl. substitutions**, `voteScale`, `decideScale`, `refineAxis`, `solveChain` at `fixedScale` (`chains.ts:587`, no `minCorrectionPx`) | legacy scale L **and every legacy segment value** | **yes — and L may be seeded by a substitution** |
| 4 | numeric lattice per on-line ink, every orientation | `extract.ts:424-432`, `numeric-lattice.ts:908` | lattice as-read, class, sequences | no |
| 5 | external PP-OCRv6 reader + frozen ensemble | `extract.ts:437-457`, `ensemble.ts:91-156` | AGREES / LEADS / CONTESTS / …, ensemble as-read | no |
| 6 | independent metric solution | `extract.ts:459` → `solveFrameMetric` (`metric-solution.ts:744-1480`) | witnesses (`readingOf`, as-read only), orientation per chain, relation CONFIRMED/REPLACED/ADDED/LEGACY_UNCONFIRMED, class STRONG…INCONCLUSIVE | its own clusters; orientation routes OTHER_AXIS_SCALE / joinedCm import another set's scale |
| 7 | re-solve of chains | `metric-solution.ts:1300-1333` | only under REPLACED/ADDED (every chain) or CONFIRMED **with different token entries** (`sameEntries` `:741`, gate `:1303`); `rereadable = CONFIRMED` (`:1231`) | yes (`axisScale`) |
| 8 | evidence and anchors | `extract.ts:471-484` → `buildChain` (`extract.ts:906-1043`) | `MetricEvidence.value/origin/rawText/derivation`, `DimensionChain.segments`, **registration anchors** (`:997`) | consumes |
| 9 | level ladder (sections) | `extract.ts:688-773`, `registration.ts:295-400` | datum values (READ/CHAIN_CORRECTED), LEVEL anchors | its own fit |
| 10 | registration | `extract.ts:793-808` → `registerFrame` (`registration.ts:127-191`) | metres per pixel X/Y, confidence (+0.08 per kept anchor, ≤5, `:170`), `measuredBothAxes` (`:159`) | fits anchors |
| 11 | reconstruction | `reconstructV2` (`v2/reconstruct-v2.ts`), plan resolution (`plan-resolution.ts`), layout (`layout.ts`) | plan choice (`choosePlan` `solve.ts:141`), statement contest / SOURCE_CONFLICT, grid ladder (`layout.ts:1139-1260`), body basis (`:1866`), SOURCE_EXACT (`v2/reconstruct-v2.ts:409`, `v2/emit.ts:193`) | uses registration mpp + statement values |

---

## 1. Where READ, CHAIN_CORRECTED and DERIVED become values, anchors and claims

- **The only place a segment's origin is decided** (K): `chains.ts:758` — `substitutions === 0 ? 'READ' : 'CHAIN_CORRECTED'`; DERIVED at `chains.ts:778-785` (blank span on a chain whose fitted readings sit within tol/2; **`fitted` counts CHAIN_CORRECTED**, `:768`, so a chain with only scale-chosen values can fill its blanks from the same scale).
- **Inside a span the scale chooses the reading with no substitution penalty** (K, verified S6): `merit = confidence × max(0.02, 1 − miss/tol)` (`chains.ts:681-682`); the `0.45^subs` factor (`:695`) prices partitions only. So a substitution beats an as-read value **that also fits** (Goździkowce 1385 fits at 1.66 px but loses to 1382 at 0.48 px).
- **Where candidate values come from** (K): legacy path — `readingLattice(token)` (`parse.ts:130-178`; single substitutions on any glyph, pairs on the two weakest, ≤24 strings); re-solve path — `correctionReadings(lattice)` (`metric-solution.ts:404-441`: ensemble as-read substitutions 0; the ensemble **rival at confidence 1, substitutions 1**; plausible lattice values; external-only values), gated by `minCorrectionPx = 25·tol = 55 px` (`:1309`). The legacy path has no such gate (Murajach `111→117` over 48.5 px).
- **`MetricEvidence`** (K, `extract.ts:938-981`): `value = segment.valueCm` (the chain's choice); `origin = segment.origin`; `rawText = segment.token?.text ?? segment.text` (the **classic** token, never the ensemble); `alternatives = segment.rejected[0..4]` at confidence 0.2; `derivation {rawText, valueText, substitutions, dependsOnScale: true, why: "… never a witness for it"}` only for CHAIN_CORRECTED or a scale-chosen orientation.
- **Registration anchors** (K, `extract.ts:997-1006`): every segment with `origin !== 'DERIVED' && confidence > 0 && (anchorable?.(segment) ?? true)`. **CHAIN_CORRECTED passes.** The comment at `:992` ("Only a segment whose number was actually READ anchors a registration") contradicts the code; so does the evidence's own `derivation.why`. `ScaleAnchorInput`/`RegistrationAnchor` carry no origin. Ladder rungs: same pattern (`extract.ts:757-771`, CHAIN_CORRECTED datums from `registration.ts:394`).
- **`DimensionObservation`** (K): created only in `metric-solution.ts:observationsOf`; `valueCm = readingOf(lattice)` (ensemble as-read; never the chain's value); ACCEPTED only with a matching **READ** segment (`:1338-1339`).
- **Chain sums** (K): `derivedTotalCm` = sum of READ + CHAIN_CORRECTED + DERIVED (`chains.ts:789-795`); `closes` needs `readSegments` (which counts CHAIN_CORRECTED) (`extract.ts:1014`) — a chain of scale-chosen and scale-derived values "closes" trivially. `chainRelations` AGREES_AS_READ uses as-read observations only; the fallback AGREES_AFTER_CORRECTION sums solved values (`metric-solution.ts:1604-1680`).
- **`firstReadCm`** (K): `plan-resolution.ts:206` — the classic token text when it matches `/^[1-9]\d{1,4}$/`; used by `zeroSubstitution`/`asRead` (`:218`, `:228`), refutation (T1/T3), `latticeScales`, `metricsAtScale` (`:351-377`).
- **`readingOf`** (K): `ensemble.ts:159-163` — the ensemble's as-read when an ensemble exists, else the lattice's; consumed by observations, `correctionReadings`, contest values.
- **SOURCE_EXACT** (K): the layout ladder reads `cited.value` **for any origin** (`layout.ts:1139-1147`), pins grid lines longest first, ties broken toward the statement citing more evidence ids (`:1181`); a stated body side gets basis MEASURED unless resolver-reread (`:1866-1867`); `reconstruct-v2.ts:409` → MASS `SOURCE_EXACT` (checks `widthM.basis` only); `v2/emit.ts:193` writes ring evidence `SOURCE_EXACT` whenever no outer face is open (no basis check). **So a CHAIN_CORRECTED value — and an all-DERIVED span — becomes SOURCE_EXACT geometry.** Level datums: `levelsFrom` has no origin filter (`solve.ts:252-292`) → LEVEL SOURCE_EXACT (`reconstruct-v2.ts:479`).

## 2. Can a verified OCR 1020 become 1010? What survives, and in which branch is the answer its own witness?

**Yes (M, Murajach S2, evidence `metric-dimension-8b1d309902`).** The ink was read twice independently of any scale: lattice `1020` (SUPPORTED, stable) and PP-OCRv6 `1020` (p 0.9993, stable ×4) → ensemble **AGREES / CLEAR**; 005Q-OCR truth 1020.

1. **First use of 1010 is the scale vote itself** (M by re-implementation, verified): `proposalsOf` (`chains.ts:259-288`) proposes every substitution; the winning seed is **1010/412 px = 2.4515 cm/px** (weight 5.75 vs 1020/412 at 4.41, with 151→131 agreeing across chains); `refineAxis` → L = **2.451224**. The value later "chosen by the scale" is the value that *made* the scale.
2. `solveChain` at `fixedScale` 2.451224: 1020 misses by 4.12 px (> 2.2) and is not even a candidate; 1010 misses by 0.04 px → `CHAIN_CORRECTED` (`chains.ts:758`).
3. Evidence: `value 1010, rawText "1020", derivation {rawText 1020, valueText 1010, dependsOnScale true}`, `alternatives[0] = 1020 (conf 0.2)`.
4. Metric solution: `LEGACY_UNCONFIRMED / INCONCLUSIVE`, `independentWitnesses 0`; **1010 is not a witness** (the 1020 observation is UNCENTRED on the 412 px piece, `offsetShare` 0.269 > 0.1, so not decisive).
5. **Registration — the self-witness:** `registration-plan-xz-c5d5b9399e` has 3 anchors, **all CHAIN_CORRECTED** (`1020→1010`/412 px X, `111→117`/48.5 px X, `151→157`/63.5 px Y); mppY = 1.57/63.5 exactly, so one scale-chosen value sets the whole Y axis and flips `measuredBothAxes`; confidence 0.718 (0.5 + 3×0.08 − residual).

**What survives (K/M):** `rawText`, `derivation.rawText`, `alternatives[0]`, the token, the lattice and external readings, `DimensionObservation.valueCm` all still say 1020. **Who recovers it:** plan resolution (`firstReadCm` → `asRead`, T1/T3, `latticeScales`) and the statement contest (AS_PRINTED, LATTICE, EXTERNAL all 1020). **Who does not:** the registration anchor (`extract.ts:1004` uses `segment.valueCm`), the fitted registration and everything that reads it, and the geometry (layout ladder). **Recovery does not help here** (verified S2): 1020 against the registration 2.4514 is within plan resolution's 3 % `agrees` tolerance (412 × 2.4514 = 1009.98), so the recovered ink **defends** the 1010-fitted registration. `metricsAtScale` can swap in `firstReadCm` only in a ≈1 % window and then marks the span DERIVED.

**The branches in which a scale-chosen value is its own witness** (verified S1, M on the sealed 1.8.0 sets):

| branch | condition | loop | measured |
|---|---|---|---|
| A — legacy, full loop | no metric solution (non-floor-plan PLAN_XZ, no `read.raw`); `LEGACY_UNCONFIRMED` (`rereadable=false`); CONFIRMED chain not re-read (`sameEntries` gate or not `better`) | substitution-seeded vote → CHAIN_CORRECTED at that scale → anchor of that scale | CC anchors: CONFIRMED 125 / LEGACY_UNCONFIRMED 114 / no metric 51 (READ 52 / 37 / 18) |
| B — REPLACED / ADDED | `scaleStands=false`: every chain re-solved at the independently selected `axisScale`, `anchorable` undefined | CC values chosen toward a scale **they did not create**: they inflate anchor count, confidence and residual, not the scale | CC 14 + 1, READ 57 + 4 |
| C — CONFIRMED, chain re-read | `anchorable` compares the **re-read** segment (incl. its confidence) with a legacy one | CC matches only by coincidence → effectively blocked; it also blocks good re-read READ values (marcowki READ 1260) | 0 anchors of any origin from re-read chains |

Across the sealed 1.8.0 plan registrations: 203 of 236 registrations carry ≥ 1 CHAIN_CORRECTED anchor; **44 have no READ anchor**; 127 would have < 2 READ anchors (the `anchors.length ≥ 2` gate, `extract.ts:793`). The `FrameMetricSolution` (relation, class, witnesses) never reads anchors or segment origins — **the self-witness confirms the registration, not the metric solution** (K, verified).

**Segment vs whole line vs off-line.** A segment label is bound to one (chain, elementary interval) slot, but `solveChain` then re-picks the span it measures **by scale fit, with no centring test** (`chains.ts:643-700`; `spansFor`'s "a label against one end is not measuring that span" is used only for proposals) — the measured span of a READ label can itself be scale-chosen without any `dependsOnScale` flag. A whole-line (overall) label printed on its parts' line competes for the same interval slot. An off-line label (beyond the end ticks, > 2.2 heights from the line, wrong axis) gets **no decision record and no evidence**; only an aggregate `gap/unattached` with the false reason "not on a dimension line" (`extract.ts:776-785`), and nothing at all below score 0.25.

## 3. 870 vs 810: lattice/ensemble vs page vote vs correction; which value each consumer uses

Głogowniki S1 (M; sealed `work005n/blind10/out-1`): token `810` (ROTATED_CW, pageVote KEPT; glyph '1' alternatives 7/3/2); lattice as-read 810 (p 0.358, AMBIGUOUS — its own `870` sequence has p 0.484); PP-OCRv6 **870** p 0.9995 stable → ensemble **LEADS 870 / SUPPORTED**. The frame is CONFIRMED/STRONG at 2.626 cm/px (two counted witnesses 920/350, 949/361, both ensemble LEADS). Because the legacy chain is kept (`sameEntries` → no offer), the segment value **870 is a legacy substitution 1→7** that happens to equal the ink: `metric-dimension-f810c24db9 value 870, rawText 810, CHAIN_CORRECTED`. In another plan frame of the same package (REPLACED) the same ink is READ 870 via `correctionReadings`. 541/501: classic 501, lattice 501 CLEAR, PP-OCRv6 541 → **CONTESTS** (rival EXTERNAL 541); segment CHAIN_CORRECTED 541.

| consumer | 541/501 ink | 870/810 ink | callsite |
|---|---|---|---|
| legacy chain solver / page vote | 541 (CC from "501") | 870 (CC from "810") | `chains.ts:259-291`, `:758` |
| metric solution observations | 501 (CONTESTS keeps the lattice; witness of the rival 2.432 hypothesis) | 870 (LEADS; supporting, not counted) | `metric-solution.ts:498-503` |
| registration anchor | 541 | 870 | `extract.ts:997` |
| plan resolution "as printed" | 501 (contested) | 810 (870 set aside as **cited**, N1a) | `plan-resolution.ts:206`, `:958-981`, `statement-contest.ts:82` |
| geometry (layout ladder) | 541 (part of the 18.83 m width) | 8.70 m depth = 870 exactly | `layout.ts:1137-1147` |

The page vote records **orientation** only; the value 810 lives in the classic token text, which `firstReadCm` and AS_PRINTED read; the 870 lives in the ensemble, which the metric solution reads. **Two layers disagree about what one ink says.** Of S1's 10 registration anchors, 9 are CHAIN_CORRECTED; 6 contradict the external reader's confident reading of the same ink (`501→505` vs 302, `110→120` vs 224, `180→160` vs 280, `150→250` vs 350, `432→132` vs truth 346; the one READ anchor `171` has truth 472).

**Where copies and rotations merge.** The metric solution counts one witness per ink: `textRegions` union-finds different orientations of one ink (`metric-solution.ts:150-184`, symmetric `sameInk`), `gather` keeps one per region, an ink with two decisive readings counts zero (I2), twin parallel lines count once (I5). **Registration has none of this**: (M, verified S3) Głogowniki frame `…p-d1223ce8ba`: tokens `151` HORIZONTAL and `85` ROTATED_CW are one ink (covered 1.0), both KEPT because `dedupeOrientations` tests containment in one direction only (`ocr.ts:954`); both bound in the legacy solve, both READ, **one anchor on each axis** of a registration that claims both axes measured (metric solution: LEGACY_UNCONFIRMED, isotropy ASSUMED); also false provenance — evidence `1882769b8c` (ROTATED_CW) carries "read the way up the other axis's scale chose" while the chain chose ROTATED_CCW. Live but rare: 1 such pair in 8 632 KEPT cross-orientation same-ink pairs. Raster copies of one drawing are solved per frame; `CROSS_COPY` corroboration (`plan-resolution.ts:456`, `:582-588`) has no shared-source check (no measured case where it decided acceptability). Two readers of one crop are never counted twice, but AGREES promotes any lattice class (incl. LOW_QUALITY) to CLEAR (`ensemble.ts:132-133`), turning a non-decisive ink into a counted witness.

**Correction to 005Q-OCR:** Murajach S2 and S3 are **not** two copies of one drawing: S2 is the ground plan, S3 the attic (storey roles in the graph; label sets share only "240"). They remain correlated (one package, one typeface, one reader family), never independent publisher witnesses.

## 4. Binding

- **Not greedy** (K, verified S4): an exact Kuhn–Munkres solve per connected neighbourhood (`axis-topology.ts:252-321`, `:375-424`), cost = offset/height + 1·againstConvention + 2.5·(preferCentred ∧ ¬centred) (`:241`), a constant binding reward 6 (`:73`); near-ties (margin < 0.1) abstain as AMBIGUOUS and **their slot is not reassigned**; one label per (chain, elementary interval) slot (one-to-one). The only non-optimal case: neighbourhoods with work > 6e8 are not solved (all UNASSIGNED, `bounded`).
- **Three passes** (legacy without centring `chains.ts:574`; per orientation `metric-solution.ts:760`, decisions discarded; final `:1289`); only legacy and final are recorded, plans only.
- **Can a label lose its line to another?** Yes, through costs, not greed: a fragment's offset is normalised by its own small height, and the reward ignores label size or quality (M, krasnokwiatach: `13` 7×6 px BOUND, `517` UNASSIGNED margin 1.29; the slot is ≈216 cm, which neither fits — the whole chain is sealed UNRESOLVED). A constructed case (verified arithmetic) leaves a true overall label UNASSIGNED (margin 0.9) while a stray `12` is bound; it then gets no evidence and the false "not on a dimension line" gap.
- **Value- and scale-dependence:** costs and edges are geometric, but membership needs a LINEAR_DIMENSION reading (substitutions suffice on the legacy path), the side convention uses digit counts, the final pass's token set follows orientation decisions (some scale-based), and **`solveChain` re-picks the measured span by scale without centring** (constructed: label at 50 on ticks [0,100,200,300], value 300 at 1 cm/px → READ over [0,300]).
- **Overall + parts, split segments:** an overall label on its parts' line competes for one interval; two adjacent labels are never merged; collinear pieces of one line split by a gap (logo, wall crossing) are **never rejoined** (`dimension-lines.ts:116`, `:202-210`; no join code) — Murajach's 1020 is bound to a 412 px fragment of a 660 px line (1020/660 = 1.5455 cm/px, consistent with 740/476 = 1.5546, 410/264 = 1.553 and the published area −0.5 % — H, needs a replay that this stage does not run: line geometry is out of scope).
- **A bound label whose readings all miss the scale** leaves no evidence: `segment.token` is set only when a reading fits (`chains.ts:757`), so on a confirmed chain the span is filled DERIVED "nothing is printed" (`extract.ts:936`); `labelled` on unread segments is dead code (`:1009`). (M, Głogowniki `e002fdbefa` DERIVED 575.11 cm "nothing is printed" over the span where 949 is printed.)
- **Graph matching without a library** (K): the exact assignment, its abstention and its bounds already exist; a challenger can change only the edge set and costs (`:419-423`, `:241`), feed the axis topology (`dimensionAxisGroups`, available before `extract.ts:390`), or — the decisive seam — keep the **span** a label measures geometric in `solveChain` (`chains.ts:650`). True interval packing (overall + parts on one line) is not bipartite and stays in the chain DP.

## 5. UNRESOLVED propagation and missing-as-agreement

- There is **no UNRESOLVED origin** in `MetricOriginSchema` (`schema.ts:129-138`); an unresolved segment is written without evidence (`extract.ts:929`, `:1011`). No runtime zod parse of evidence in production (only a test, K).
- **Safe drops** (K): `statementsOn` (`plan-resolution.ts:202`), layout ladder `valueOf` (undefined → SCALED), plan decomposition (no grid line), `metricsAtScale` (non-statements untouched).
- **Registration** with < 2 anchors → no registration and an AMBIGUOUS/MISSING gap (`extract.ts:809-821`); consumers: `choosePlan` excludes the frame (`solve.ts:133-143`), `chooseBasePlan` (+2 for a registration, `layout.ts:586-594`), a placeholder unit-scale registration "never a metre" (`layout.ts:410-416`), copies skipped in `resolvePlan` (`:599-605`), source-conflict review and challenge (`:1066`, `:1167`, `:1180`), confidence gates (`plan-decomposition.ts:1806`, `:1891`), section scale (`v2/reconstruct-v2.ts:887`). **A bug in the gate itself** (verified): `extract.ts:793` counts *input* anchors; `fitAxis` may keep one and `registerFrame` never re-checks (marcowki SECTION_HY: 1 kept anchor, residual 0, confidence 0.43; 8 such sections).
- **Missing counted as agreement** (verified S5): only in plan resolution — `refutedShareAsRead` returns **0 when nothing is stated** (`plan-resolution.ts:260-268`), the best bucket; a frame whose every statement has an empty `asRead` (leading-zero READ, READ with `dependsOnScale`, CC whose classic text is no dimension, multi-token evidence) cannot be refuted (M, zurawkach `…45095f59cd`: 2 statements, both CC with unparsable text → share 0 beside main plans at 0.25). It matters only across copies; partial withholding cuts both ways ((R−r)/(S−r) for withheld accusers; withheld defenders raise the share and lower T3's bar — the same mechanism as N1a's set-aside). T2 PARTIAL_BINDING reads `origin === 'READ'` only. The metric solution never treats an empty witness set as agreement.
- **Ladder**: an UNRESOLVED rung is still emitted as `MetricEvidence origin 'READ'` with confidence ×0.4 (`extract.ts:717`) and `levelsFrom` sets storeys from it as measured (M: helikoniach `+0,02`, cieszyniankach `+2.95`).

**Consequence for challengers:** any new abstention must (a) never be written as a value > 0 (the ladder would take it as stated → MEASURED → SOURCE_EXACT); (b) be counted, in scoring, separately from refusals caused by evidence no longer self-confirming; (c) be checked against the zero-share bucket (a frame emptied of as-read statements must not win a copy comparison).

---

## 6. Causal chains

### 6.1 `dom-w-murajach` — 1020/1010 (ground plan S2) — first bad: **line fragmentation + substitution-seeded vote**
token 1020 (classic, glyph '2' 0.535) → lattice 1020 SUPPORTED + PP-OCRv6 1020 → AGREES/CLEAR → bound to the 412 px fragment `chain-horizontal-809-8ba358fc77` (ticks 108.5–520.5; the 520.5 end QUESTIONABLE; a collinear piece 550.5–768.5 on the same baseline) → vote seeded by 1010/412 → L 2.451224 → CC 1010 → anchor → registration 2.4514 (3/3 CC, confidence 0.718) → metric solution LEGACY_UNCONFIRMED/INCONCLUSIVE, `independentWitnesses 0` → the wrong X cluster (2.4756, from the UNCENTRED 1020/412) decides `chain-vertical-244` by **OTHER_AXIS_SCALE**, dropping the true CW readings 252/410 → PROD3 **METRIC_RESOLUTION_INCONCLUSIVE** (firstFailure PLAN_LAYOUT_REJECTED, footprint 169.92 vs 75.83 m²); the attic (S3, LEGACY_UNCONFIRMED 1.516, 6/6 CC anchors, confidence 0.880) is stacked at k 0.618. **Reverting 1010 → 1020 does not give Murajach an independent two-axis metric**: 1020/412 stays UNCENTRED (not decisive), Y has no counted READ witness (240/98 ALTERNATIVE role, 740/476 and 410/264 ORIENTATION_UNDECIDED, 252 dropped). **Refusing is the correct outcome until a line-geometry change makes an independent witness** (out of this stage's scope). Every CC anchor on S2/S3 checked against truth is wrong (S2: 1010/117/157 vs 1020/115/252; S3: 148/148/190/168/155 vs 298/298/390/288/352).

### 6.2 `dom-w-gozdzikowcach` — 1385/1382 (S4) — first bad: **within-span reading choice (no substitution penalty) at the legacy scale**
token 1385 (glyph '5' 0.535; alternatives 3/7/2) → lattice 1385 AMBIGUOUS + PP-OCRv6 1385 p 0.99992 → AGREES/CLEAR → bound (legacy = final) to the single-span chain `chain-horizontal-747` (96→641, 545 px) → L 2.530475, X refined 2.533553 → at that scale 1385 fits (1.66 px) but 1382 fits better (0.48 px, merit 0.494 vs 0.244) → **CC 1382** (`chains.ts:681-682`) → the metric solution is CONFIRMED (4 independent X witnesses 524/205, 1385/545, 544/215, 317/123 select 2.541746, within the 1.2 % `agreeTol` floor of L) → **no re-read** (`sameEntries`, `rereadChainIds []`) → registration 6/6 CC anchors (`514`, `311`, `1382`, `950`, `55` from "135" with a leading zero over 20.5 px, …), confidence 0.846 → PROD3 **MODEL_EMISSION_FAILED** at command 135 `placeChimney` ("Number must be greater than 0"; H: no main roof → zero chimney height, `v2/emit.ts:449`), unrelated to scale. Ink-first would change X by +0.2 – +0.3 % (far below any gate); the as-read parts close exactly (544 + 317 + 524 = 1385, recorded AGREES_AS_READ) while the sealed corrections break that closure (311 + 514 = 825 vs 841). With CC anchors excluded, S4 has **0 READ anchors on either axis** → no registration.

### 6.3 `dom-w-glogownikach` — 541/501, 870/810 (S1) — first bad for the metric: **re-read gate** (`sameEntries`); for the footprint: **not OCR**
See §3. Metric solution right (STRONG/CONFIRMED 2.626 vs TRUE_SCALE 2.6286); the self-witness inflates the registration (9/10 CC); plan resolution's view (501/810) differs from the metric layer's (501/870) and from the geometry's (541/870). PROD3 completes with model `19cb8fde…`, **−8.04 %** footprint: 18.829 m = chain-622 segments 0–7, 8.70 m = the CC 870; the DERIVED 17 px end spans excluded; the body stops on the inner faces of the east and front walls (005P/005Q; `thinLines` + `walledEnvelope`) — **not an OCR or chain defect**; 0 terraces (refused, not fabricated). Ink-first would make 870 READ (no OUTER_TOTALS charge under AS_PRINTED) and leave the footprint ≈ −8 %.

### 6.4 870/028 rotation twin (S1, box x24–37 y362–382)
On `chain-vertical-41` (vertical line: only the axis is fixed by the line). Production chose ROTATED_CW by **TYPOGRAPHY** ("1 of its labels start with a zero": the CCW reading `028`/`019` has a leading zero, NO_VALUE "states no dimension"); non-circular, correct per truth (870). **005Q-OCR's B2 `UNRESOLVED` was a scorer artefact** (its `INT = ^[0-9]{2,5}$` accepted 028 and merged the twins' values). The other 005Q-OCR twins (790/062, 700/002, 800/008, 890/068) all have a leading-zero side. Orientation decided by a scale happens elsewhere: OTHER_AXIS_SCALE (Murajach `chain-vertical-244`) and joinedCm.

### 6.5 Controls (all PROD3 COMPLETED, verdict PASS except A06/S8 which is a REPLACED/WEAK frame)
| control | frame relation | registration anchors READ / CC | READ-only refit | corrections feeding the model |
|---|---|---|---|---|
| marcowki S5 | CONFIRMED/STRONG 2.6425 | X 1/4, Y 2/2 (READ 1260 dropped by `anchorable`) | −0.17 % | `151→751` (ink 750 LEADS) gives Y 12.61 (truth 12.60) by winning the 2-id tie over READ 1260 (`layout.ts:1181`); `740→790`, `115→415` ink-correct; `515→155`, `701→301`, `147→157` ink-wrong; attic: Y 4 CC / 0 READ (anisotropy 1.008 self-witnessed); CC level datums +5.06→3.06, +0.67→4.67 |
| kosacce-clean S6 | CONFIRMED/STRONG 2.4058 | X 2/9, Y 2/5 | X −0.72 % (the X scale rests on ink-correct corrections 1660, 665, 521) | mass-1 X 6.48 vs printed 665 (a DERIVED chain with 3 truth-wrong CCs pins line 157.5); width 16.58 from a 4-id total beating READ 1660; 9 truth-wrong CCs |
| dom-w-zurawkach S7 | CONFIRMED/STRONG 2.2182 | X 4/2, Y 2/1 | 0 | masses do not depend on a correction; `176→136` moves one interior line 1 cm; READ ≠ correct: `212` bound wrong, `155` truth 335 |
| A06 S8 | REPLACED/WEAK 2.0726 | X 2/1, Y 2/1 (1145 READ+dependsOnScale) | — | masses independent; `165→185` moves lines 6 mm; CC level datums 2.86 / 5.8 / 9.05 |
| dom-pod-jarzabem `…397808a266` | CONFIRMED/STRONG | **0 READ / 9 CC** | — | overall `1460→1950` (two substitutions at L 2.787) vs lattice 1960 independent |

**Predicted risk (H, from the controls simulation):** an ink-first change moves known-good geometry toward the printed numbers (marcowki Y 12.61 → 12.60, kosacce mass-1 6.48 → 6.65, lines by up to 20 cm) and removes registrations whose anchors are all corrections (marcowki attic) — a strict G1 ("zero change to a known-good model") cannot hold for any rule that lets the ink replace a scale-chosen value.

---

## 7. Label-level baseline (C0 = sealed; 005Q-OCR truth unchanged; PRIMARY MAIN n = 110)

Measured with this stage's scorer (`score_labels.py`, 005Q-OCR's own truth items, classes and line-internal binding truth) on the incumbent's evidence:

| first bad on the path ink → statement | n |
|---|---|
| NONE (printed, correct, bound) | **10** |
| SCALE_DEPENDENT_VALUE (statement is CC / dependsOnScale; 12 of them equal the ink by accident) | **34** |
| READ_RIGHT_NOT_BOUND — bound by the assignment, **no statement** | **25** |
| READ_RIGHT_NOT_BOUND — AMBIGUOUS / UNASSIGNED / no decision | 4 / 2 / 2 |
| READ_NOT_CORROBORATED | 20 |
| PRINTED_VALUE_WRONG (READ, wrong) | 3 |
| READ_RIGHT_BOUND_WRONG | 2 |
| ROTATIONAL_TWIN_AMBIGUOUS / NEVER_PROPOSED / NOT_ON_A_CHAIN | 2 / 3 / 3 |

Scale-dependent statements used as registration anchors on these labels: **42**. **The 25 "bound but no statement" labels** were diagnosed one by one: in every one the assignment bound the ink's *classic* token (`909` for 949, `583` for 582, `111` for 352, `1/6` for 346, `714` for 210, …), the legacy chain solve could not fit any classic reading at the legacy scale, and the chain was never re-solved from the ink because the re-read is gated (`sameEntries` under CONFIRMED, `rereadable=false` under LEGACY_UNCONFIRMED); 21 of their spans stayed unread, 6 were filled DERIVED "nothing is printed". **This is a distinct bottleneck from the self-witness, larger than assignment ambiguity (8), and invisible to 005Q-OCR's B2 (which measured geometry only).**

## 8. First-bad summary and the seams the challengers test

| defect (K unless noted) | where | test registered |
|---|---|---|
| D1 substitution readings vote for the legacy scale | `chains.ts:259-288` | Murajach replay: the S2 seed (out of scope for a challenger: changes L everywhere; recorded) |
| D2 within-span reading choice ignores substitutions | `chains.ts:681-682` | Goździkowce 1385 (C1 makes the ink the printed value whichever the solver picked) |
| **D3 CHAIN_CORRECTED / scale-oriented segments anchor the registration (+ ladder)** | `extract.ts:997`, `:757-771` | **C1** (anchors from READ ink only); gate G2 counts scale-dependent anchors |
| D4 the ink reading never reaches a statement the scale chose (value authority) | `extract.ts:938-981` | **C1** (ink-first statement, correction kept as SCALE_DEPENDENT alternative) |
| **D5 the measured span is re-picked by the scale; unbound labels' spans DERIVED "nothing printed"** | `chains.ts:643-700`, `:778-785`, `extract.ts:1011` | **C2** (geometric span; labelled spans never DERIVED); spec `c2.spec.ts` |
| **D6 orientation decided by another set's scale (OTHER_AXIS_SCALE, joinedCm); UNDECIDED segments anchor** | `metric-solution.ts:798-807`, `:841-851`, `:1473`; `extract.ts:997` | **C3** |
| **D7 ink readings gated out of the chain solve (`sameEntries`, `rereadable`)** | `metric-solution.ts:1231`, `:1303` | **N1** (the measured 25-label bottleneck, §7) |
| D8 CC/DERIVED → MEASURED → SOURCE_EXACT; ring SOURCE_EXACT without basis; levels without origin filter | `layout.ts:1139-1147`, `:1866`; `reconstruct-v2.ts:409`; `emit.ts:193`; `solve.ts:252` | not a challenger (reconstruction is frozen and no challenger touches it); counted per row (SOURCE_EXACT census) |
| D9 registration gate counts input, not kept anchors | `extract.ts:793`, `registration.ts:127-191` | recorded |
| D10 one ink as two anchors through one-directional orientation dedupe | `ocr.ts:954` | recorded (1 pair in 8 632) |
| D11 missing-as-agreement (share 0 with nothing stated) | `plan-resolution.ts:260-268` | gate G2/G5 check on changed refusals |
| D12 line fragmentation (collinear pieces never rejoined) | `dimension-lines.ts:116`, `:202-210` | out of scope (line geometry); Murajach stays a negative control |

Out of the contract's scope and not tested here: D1 (changes the legacy scale on every frame), D8 (reconstruction provenance), D9, D10, D12 — each recorded with its callsite for a later, separately authorised stage.

---

## 9. Completeness critic (corrections and additions, before any challenger ran)

- **Registration confidence decides almost nothing in v2** (K): `choosePlan` (`solve.ts:132-145`) has no production caller; v2 picks a storey's base plan by DIMENSIONED annotation, then pixel area, then id (`layout.ts:380-386`); `chooseBasePlan` uses only registration existence and `−2·rmsM`; the only readers of `registration.confidence` are the `> 0` gates (`plan-decomposition.ts:1806`, `:1891`). **What scale-chosen anchors actually decide:** (a) whether a registration exists at all (≥ 2 input anchors); (b) mppX/mppY — every SCALED span of the layout ladder (`layout.ts:1175-1180`), all of `planFrameV2` (openings, terraces, interior), wall thickness, the STATED storey ratio k and its anisotropy check (`layout.ts:808-815`, `:867`); (c) rmsM; (d) plan resolution's T1 registration scale (`plan-resolution.ts:286`, `:318`, `:1001`).
- **Re-measured at the base (M, C0 evidence, 14 rows at the time):** 74 registrations; anchors CHAIN_SEGMENT 214 CC+dependsOnScale / 117 READ / 5 READ+dependsOnScale, LEVEL 4 CC / 13 READ; 42 of 74 would have < 2 READ anchors, 13 none; fully self-witnessed at the base: jarzabem `…397808a266` (CONFIRMED, 9 CC / 0 READ), modrzykach `…b3f1538ca6` (CONFIRMED, 6/0), kosacce-clean `…803d3d68d8` (LEGACY_UNCONFIRMED, 6/0), willa-miranda `…2088494fef` (LEGACY_UNCONFIRMED, 8/0); **35 of 60 distinct two-axis registrations have an axis with no READ anchor** (willa-miranda `…1ac18b4545`: an 11.7 % anisotropy resting on two corrections).
- **Głogowniki frame choice is settled** (K+M): the model frame is the DIMENSIONED `…0cb0a5c1d9` (CONFIRMED, 9 CC / 1 READ); `…b0502a47aa`, where 870 is READ, is an AREA_TABLE drawing and never reaches the model.
- **67 of 360 DERIVED dimension evidences** at the base carry a printed label's readings in `alternatives` while saying "nothing is printed on this … px span" (M).
- **Chain sums arbitrate nothing** (K): `chainRelations` has zero consumers in reconstruction; `DimensionChain.printedTotal` is never written; `layout-gate.ts:86` always uses `derivedTotalCm` (READ + CC + DERIVED).
- **Three different rules for which span a label measures** (K): scale vote (`proposalsOf`/`spansFor`: 0 skips, centred), observation binding (2 skipped ticks, centred; `metric-solution.ts:518`, `:67`), and the sealed value (`solveChain`: ≤ 3 non-rejected marks, **no centring**). A label may be sealed READ over a span the observation layer would never bind it to; an overall label over more than 3 marks (Głogowniki 1930 over 78→812) is representable nowhere.
- **Re-read `taken` rule** (K, `metric-solution.ts:1313-1333`): `readRegions` counts CC segments as taking an ink, so a legacy CC can block a re-read that would READ that ink (H for marcowki 750; to be observed under N1).
- **Plan resolution's 3 % `agrees` tolerance** (`plan-resolution.ts:213-214`) scores any one-digit correction within ≈ 3 % as *defending* the registration fitted to it: recovering 1020 in the evidence changes no plan-resolution decision unless the registration itself changes (it does under C1, which removes the scale-chosen anchors).
- **Unverified at the time, closed by the C0 replay of this stage:** the case chains of Murajach, Goździkowce and Głogowniki on evidence extracted at the base (C0 is byte-identical to the sealed sets on every row compared).
