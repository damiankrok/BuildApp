# 005D pre-review D — resolver / first-success recovery

Question: why can a wrong metric reading survive until the published-footprint veto, and how should a completed
(or failing) first reading be challenged from SOURCE evidence before the figure is consulted, so that a
source-supported alternative wins without the figure choosing?

Method: read `plan-resolution.ts` (1.3.0), `v2/reconstruct-v2.ts` (lines 255–305), `layout-gate.ts` (footprint
bands), `holdout/verdict.mjs`, `scripts/known-row.mjs`. Measured with read-only probes under `.cache/rev-d/`
(`statements.ts`, `triggers.ts`, `sim.ts`, `azalia-bound.ts`, `witness.ts`) on the HEAD runs in `base/`, `rev-d/`
(and, for Kosaćce clean and Jabłonkach, the identical HEAD runs other reviewers left in `rev-a/`, `rev-c/`).
`sim.ts` composes the real first reading, then calls the real `challengeFirstReading` / `resolvePlan`; for
pre-1.2.0 evidence it feeds the challenge the resolver's own `latticeScales` output. Nothing in the repo changed.

## 1. Findings

**P0-1 — The flow consults the figure before the drawing.** `reconstruct-v2.ts:255` sends any first reading
the gate refused — including one that built a body and only missed `FOOTPRINT_AREA_WRONG` — straight to
`resolvePlan`, which marks the figure SPENT (`plan-resolution.ts:531`). The source-driven challenge
(`challengeFirstReading`) only runs in the `else` branch, i.e. after the first reading PASSED the gate. So the
figure always speaks first; when it refuses, every alternative then needs two corroborations it cannot have.
Legacy e-OZE: first reading 150.63 m² (+23.4 %) refused; the drawing's own as-read evidence refutes it far
more than the alternative (0.921 vs 0.242 of the stated chain length), but that comparison is made only after
the figure is spent → `PLAN_RESOLUTION_INCONCLUSIVE` with the right building (116.7 m², −4.4 %) as "reading1".

**P0-2 — Pre-1.2.0 evidence has no challenge at all.** `firstReadingNeedsChallenge` returns false when the
metric set carries no solution (`:824`), and `challengeFirstReading` generates scales only from
`metricScales(solution)` (`:878`). The lattice the resolver already computes for such evidence (`latticeScales`,
`:582`) finds 2.223611 cm/px on legacy e-OZE (support 720 px vs registration support 0 px) — but it is only used
inside `resolvePlan`, after the figure was spent.

**P0-3 — The resolver's "drawing evidence" can point at the wrong scale (Azalia).** `statementsOn` reads the
legacy chain segments, which bind the overall label `1055` (printed 1035) to the partial span 204.5–633
(428.5 px) created by a watermark vertex. Measured `refutedShare` (as read): dimensioned copy 0.322 at the
registration 2.462 vs **1.000** at 1.8975; area copy 0.000 vs **1.000**. `compareReadings` ranks the footprint
bucket BEFORE the refuted share (`:465–466`), so the resolver chose the reading the drawing's own (mis-bound)
statements refute entirely, because the figure AGREES (67.26 m², −3.48 %), corroborations none. The right
answer was reached by the figure overriding the drawing, which is exactly what 005A forbids in spirit.

**P1-4 — The trigger "corrected anchors + ≥2 raw long readings on both axes agree" does NOT fire on legacy
e-OZE.** Measured on the first-reading copy (`…e3a3d0015d`, judge = wall cluster 720×506 px): exactly ONE long
as-read reading states 2.2236 — X, chain `…a3d8696b1d` (baseline y 698.5, ticks [75, 795], 720 px, share 1.0),
CHAIN_CORRECTED 1801 ← first read `1601`. The same print on the area copy (`…a80475310f`, identical token box
416–447 × 678–693) is the same label exported twice, not a second witness. Y has NO read long statement on
either 853-px copy: the vertical overall (`…ec88c1181b`, x 24, ticks [230, 236.5, 578.5], 342 px) is unread —
its rotated label (`760` per today's reader) was OCR'd `041` by the 1.1.0 horizontal-only reader. The other long
X statement 480/191 px is a substitution of `080` (leading zero, no as-read value). 7 of 9 registration anchors
are CHAIN_CORRECTED (corrected share 0.933 of anchor length); their first reads 176/52, 180/42, 155/48, 720/62,
516/53 are refuted at BOTH scales; the two READ anchors 108/45 and 100/38.5 agree with BOTH (7.75 px tolerance).

**P1-5 — A challenge replacement escapes both judges.** `challengeRecord` emits no chosenArea/residual/
corroborations; `verdict.mjs` and `known-row.mjs` read only the `PLAN_RESOLUTION` trace entry. A REPLACED
challenge therefore always fails "resolved with a witness" (even with ISOTROPY), and known-row never checks its
residual or figure use (a completion with the right body count passes unconditionally).

**P1-6 — Fixing Azalia's binding alone does not make its first reading complete.** Simulated with the label
bound to 77–633 (556 px), spurious tick dropped, REPLACED/WEAK at 1.8975, vertical unread: X extent becomes
77–633.5 but Y is framed by the read room chain `…83cd28f902` (x 570, 172.5–375 = 202.5 px, its `582` refuted at
both scales) while the exterior vertical overall (159.5–519 = 359.5 px, label centred, offset 1.7 %) is unread;
the wall witness on that frame is 520–818 × 720–777 (not the building) so 005C's outspanned rule cannot engage;
the wall cluster is 77–463 × 160–519. First reading → NO_MASS again; resolver → area copy, wall-ink extent,
REGISTRATION 1.8975, 67.26 m² (−3.48 %) AGREES, refuted **0.000** (was 1.000), departures COPY+EXTENT (no
SCALE), corroborations none. With the 2.462 hypothesis kept as a rival: same choice; that rival is refuted
0.901 and WRONG (+63.3 %).

**P2-7 — Decoy figure ×1.25 gives a silent wrong-scale pass, today and under a naive challenge.** Legacy e-OZE
with the figure at 152.59 m²: the first reading at 2.50 is ACCEPTED (−1.29 %); a challenge that lets the figure
veto keeps it (challenger 116.94 m² WRONG −23.4 %). ×0.8: challenger NEAR (+19.7 %) without corroboration → not
acceptable → incumbent WRONG → named refusal (correct).

**P2-8 — "Corrected overall" alone is unsafe.** It fires on Kosaćce (X 1660 ← first read `1000`, 690 px,
share 0.878 → 1.4493 vs 2.4058), where the correction is RIGHT; only the refutation margin tells them apart
(Kosaćce alternative refutes 0.747 > 0.570 at the registration; e-OZE 0.242 < 0.921).

**P2-9 — CROSS_COPY can be circular.** It compares with other copies' wall extents at THEIR registrations; on
legacy e-OZE both 853-px copies were registered from the same corrected `1801`, so CROSS_COPY can never witness
2.2236, and it would "witness" 2.50 if two copies shared the misreading.

## 2. Root cause and first wrong decision

- Legacy e-OZE: upstream, the 1.1.0 chain solver corrected 1601 → 1801 toward the pooled 2.50 (today's reader
  reads it right). First wrong decision in the RESOLVER: `reconstruct-v2` lets the footprint gate refuse a
  first reading that built a body before any source check, so the figure is spent on a reading the drawing
  itself already disqualifies (as-read refutation 0.921 vs 0.242), and pre-1.2.0 evidence has no challenge path.
- Azalia: upstream, the metric layer bound the label to a sub-span through a non-tick mark (two hypotheses
  from ONE ink: 2.462 longestShare 0.771, 1.8975 longestShare 1.0; label centre 348.5 is 1.2 % of the span from
  the 556-px centre, 16.4 % from the 428.5-px one). First wrong decisions in the RESOLVER: refutation scored on
  legacy segment bindings (P0-3) and the figure ranked before refutation, so the figure chose the scale.
- Common cause: the resolver has no notion of a SOURCE conflict independent of the figure; "weak" is read only
  from the metric solution's confidence label, which pre-1.2.0 evidence lacks and which said nothing about the
  footprint-refused case.

## 3. Proposed contract (generic; no new constants — 0.5/0.25/0.8 are WITNESS_SHARE, 3 %/6 %/20 % existing)

R1 Order. After composing the first reading, compute `sourceConflict(metrics, draft)` from the metric set,
   the base sheet and the draft's base frame ONLY (never `publishedAreas`). If the first reading has a world
   frame and ≥1 mass and its BLOCKING reasons other than `FOOTPRINT_AREA_*` are none, and (existing weak-metric
   trigger OR `sourceConflict`), run the challenge BEFORE the footprint verdict is acted on.
R2 Triggers (any one; each records its evidence ids and numbers):
   T1 AS_READ_REFUTATION (all schemas): as-read refuted share at the registration ≥ 0.5 AND a generated
      alternative scale refutes ≤ (registration share − 0.25).
   T2 PARTIAL_BINDING (≥1.2.0): the hypothesis the registration rests on has longestShare < 0.8 and its longest
      INDEPENDENT witness ink is also bound, on the same chain, to a span wider by > wallPx that belongs to a
      plausible hypothesis with longestShare ≥ 0.8 (a partial segment drives scale while a total exists).
   T3 OUTER_TOTALS: ≥2 as-read substantial (≥0.25 share) readings on distinct chains covering BOTH axes agree on
      a scale outside 5 % of the registration, with more length than the registration's as-read support.
   T4 HIERARCHY_CONFLICT (≥1.2.0): a `chainRelations` TOTAL_OF with `sum.agrees = false` where the registration's
      decisive witness sits on one side and the other side, as read, states a plausible different scale.
   Corrected-anchor share and "corrected overall" are reported as the WHY, never as a trigger (P2-8).
R3 Alternatives. ≥1.2.0: `metricScales(solution)` (≤2). Pre-1.2.0: `latticeScales` on the base copy with the
   resolver's judge (wall cluster ?? chain rect) — the same generator `resolvePlan` uses, `alignByFitOnly` kept.
   Extent CHAIN_RECT; WALL_* extents only when the frame was weak (today's rule). Copy/tiling/faces/mouths fixed.
R4 Winner by the drawing. Incumbent scored with gate refusals EXCLUDING `FOOTPRINT_AREA_*`. A challenger must be
   strictly better on `drawingTuple` (hard, non-figure refusals, refuted bucket, −wall bucket, −corroborations);
   among several, `byDrawing` then generation order. The figure is not in any comparator.
R5 Figure verifies/vetoes. The winner's own gate applies the figure through the existing `acceptable()`:
   AGREES → accept; NEAR → needs ≥1 corroboration; none published → ≥2; WRONG → veto. Record
   `publishedFigure: 'VERIFIED'` (new value): the figure refused nothing, so it is not SPENT.
R6 Never silent. Trigger fired AND a challenger strictly better on the drawing AND none acceptable (vetoed or
   unverified) → refuse `PLAN_RESOLUTION_INCONCLUSIVE`, why `SOURCE_CONFLICT`, naming the as-read anchors, both
   scales, both refuted shares and the figure's bucket for each. Do NOT keep the incumbent the drawing refutes,
   and do NOT hand it to `resolvePlan` (the figure would choose). No challenger strictly better → KEPT → today's
   path (incumbent gate; `FOOTPRINT_AREA_WRONG` → `resolvePlan`, SPENT). KEPT on a fired trigger adds a DEGRADING
   `SCALE_DISAGREEMENT` conflict, so a pass on a contested scale is never ACCEPTED silently.
R7 Failed first readings (no body; Azalia path). `resolvePlan` as today, plus: (a) for readings departing in
   SCALE, the refuted bucket ranks before the footprint bucket; (b) a reading with refuted share ≥ 0.5 is
   acceptable only with ≥1 corroboration. Land (b) together with the metric binding fix (R8/005D tick+span work):
   alone it turns today's Azalia completion (chosen reading refuted 1.000) into a named refusal.
R8 Refutation basis for ≥1.2.0: score over the metric layer's INDEPENDENT observations per text region (a region
   agrees with s if any of its bindings in its decided orientation agrees; weight = its longest binding), not over
   legacy segments. Azalia's 1.8975: 1.000 → 0 on the overall; the tie between bindings of one ink is broken by
   the hierarchy the metric layer decides (label centred on the outer ticks), not by the figure.
R9 Records. `challengeRecord` emits chosenAreaM2, chosenBucket, chosenResidualPct, chosenCorroborations,
   publishedFigure, trigger code(s) and evidence ids. `verdict.mjs` and `known-row.mjs` read
   `PLAN_RESOLUTION ?? METRIC_CHALLENGE(outcome REPLACED)` and apply the same residual / figure-use rules.
R10 Witness honesty. For a challenge winner count only: ISOTROPY when the OTHER axis carries an as-read
   substantial reading (not the anchor) agreeing (axesMeasured); CROSS_COPY only when the other copy's
   registration rests on different printed text and not on a correction toward the same pooled vote. The
   refutation margin is never a corroboration: on legacy e-OZE the whole 720-px margin IS the `1601` anchor —
   excluding it, both scales refute the same 257 of 340.5 px. So legacy e-OZE resolved by challenge is
   "figure-verified, unwitnessed": verdict `resolvedWithAWitness` must read false, and that is honest.

## 4. e-OZE gate split

- CURRENT e-OZE (dev row, today's reader): MUST_COMPLETE. Fast path unchanged: first copy REPLACED/STRONG/
  MEASURED at 2.2236 (1601/720 X + 760/342 Y), refuted 0.115, no trigger fires; 1 body, +1.57 %, hash unchanged.
- LEGACY e-OZE (`eoze-every-copy`, `eoze-area-copy-alone`, sealed 1.1.0): LEGACY_EVIDENCE_COMPATIBILITY.
  PASS iff (i) completed with 1 body via a METRIC_CHALLENGE REPLACED whose trigger is AS_READ_REFUTATION, at the
  as-read lattice scale the record names (not within 3 % of the corrected registration), |residual| ≤ 6 %,
  publishedFigure VERIFIED (never SPENT), a SCALE_DISAGREEMENT conflict naming the as-read anchor; or (ii) the
  exact named refusal `PLAN_RESOLUTION_INCONCLUSIVE` (why SOURCE_CONFLICT or NONE_HOLDS). FAIL: completion at
  the corrected scale, residual > 6 %, a completion with the figure SPENT, any other failure code.
  Simulated under R1–R5: every-copy → REPLACED, dimensioned copy, 2.223611, 116.94 m² (−4.21 %) AGREES, refuted
  0.242 vs 0.921; area-alone → REPLACED, 116.74 m² (−4.37 %), refuted 0.000 vs 0.910; both corroborations none.
  Add decoy rows: figure ×1.25 must refuse by name (today ACCEPTED at 2.50 — P2-7); ×0.8 must refuse by name.

## 5. Negatives and risks

- Must not fire on STRONG/SUPPORTED houses without a source conflict: measured, T1/T2/T3 fire on NONE of the 10
  development first-reading frames (table). Closest non-firing T1 cases: Jabłonkach 0.540 (alts 0.656/0.804, i.e.
  worse), Kosaćce 0.570 (0.747/0.750), Kosaćce sealed area copy 0.626 (0.662). Closest margin on any copy:
  Modrzykach area copy (not the first frame) 0.722 → 0.608 = 0.114 < 0.25.
- T1 as implemented on legacy segments is blind to Azalia-type binding errors (it compares 0.322 vs 1.000 and
  points to the wrong scale — it does not fire, but never rescues). R8 is needed for ≥1.2.0 evidence.
- A lattice challenger rests on one raw reading; a misread overall whose scale the figure coincidentally
  verifies within 6 % would pass. Bounded by T1's majority requirement (the registration must contradict ≥ half
  the as-read length) and by R10 (reported unwitnessed).
- No published-figure chooser: the figure is absent from `drawingTuple`; R6 converts a veto of the drawing's
  preferred reading into a named refusal rather than a fallback the figure picked.
- Byte-identity: houses where no trigger fires keep their path; G2E, Jabłonkach, Miranda already run today's
  weak-metric challenge (KEPT) with the same metric alternatives. R7(b) changes Azalia today (see R7).
- Cost: trigger is linear in statements; a fired challenge composes ≤2 scales (+≤2 extents); legacy e-OZE full
  probe incl. raster decode 21 s. Counts only, no clock.

## 6. Measurements (first-reading frame unless noted; as-read refuted share; "alts" = generated alternatives)

| row (evidence) | first frame, solution | today | corr. anchor share | refuted @reg | alts (scale:refuted) | T3 task | corr.-overall | T2 | T1 |
|---|---|---|---|---|---|---|---|---|---|
| Marcówki (1.2.0) | …33a5ff46cd CONFIRMED/STRONG/MEASURED | holds, ACCEPTED | 0.585 | 0.427 | 2.7571:0.864, 2.8966:0.955 | no | — | no | no |
| Kosaćce clean (1.2.0) | …668d857ed9 CONFIRMED/SUPPORTED/ASSUMED | holds, ACCEPTED | 0.745 | 0.570 | 1.4493:0.747, 2.2704:0.750 | no | fires (1660←1000) | no | no |
| Kosaćce tracked | same frame and numbers | holds, ACCEPTED | 0.745 | 0.570 | same | no | fires | no | no |
| Kosaćce area-copy-alone (005A 1.1.0) | …bdf7aa09e8 none | refused by figure → INCONCLUSIVE (SPENT) | 0.671 | 0.626 | 1.4493:0.662 | no | fires (1660←1000) | n/a | no → unchanged |
| G2E (1.2.0) | …59a406b738 LEGACY_UNCONFIRMED/WEAK | challenge KEPT | 0.955 | 0.308 | 3.4640:0.959, 2.1890:0.938 | no | no (1.7 %) | no | no |
| Jabłonkach (1.2.0) | …d80b709d74 REPLACED/WEAK | challenge KEPT | 0.540 | 0.540 | 0.9390:0.656, 3.2687:0.804 | no | — | no | no |
| Willa Miranda (1.2.0) | …7102a805c6 CONFIRMED/SUPPORTED | challenge KEPT (weak frame) | 0.214 | 0.214 | 2.1103:1.0, 1.2245:1.0 | no | — | no | no |
| Żurawkach (1.2.0) | …6fe6f9c445 CONFIRMED/STRONG/MEASURED | holds | 0.315 | 0.251 | 1.0502:0.781, 2.5188:1.0 | no | no (other support 1) | no | no |
| Modrzykach (1.2.0) | …6827e718fe REPLACED/STRONG/MEASURED | holds, PARTIAL | 0.550 | 0.340 | 2.0421:0.902, 2.5252:0.970 | no | — | no | no |
| e-OZE current (1.2.0) | …e3a3d0015d REPLACED/STRONG/MEASURED | holds, ACCEPTED, +1.57 % | 0.148 | 0.115 | 1.2858:1, 1.1111:1 | no | — | no | no |
| Azalia h1 (1.2.0) | …19006df9bc LEGACY_UNCONFIRMED/WEAK | NO_MASS → resolved by figure, refuted 1.000 | 0.323 | 0.322 | 1.8975:1.000 | no | — | **fires** (428.5 px ls 0.771; same ink 556 px ls 1.0) | no |
| Azalia area copy | …79ba9b7966 LEGACY_UNCONFIRMED/WEAK | (chosen copy) | 0.000 | 0.000 | 1.8975:1.000 | no | — | **fires** | no |
| e-OZE legacy every (005A 1.1.0) | …e3a3d0015d none, reg 2.5016/2.5974 | refused +23.4 % → INCONCLUSIVE (SPENT) | 0.933 | 0.921 | 2.2236:0.242 | **no** (1 raw long, X only) | fires (1801←1601) | n/a | **fires** → sim REPLACED 116.94 m² −4.21 % |
| e-OZE legacy area-alone (1.1.0) | …e842a14c7f none, reg 2.5014/2.5362 | refused +20.4 % → INCONCLUSIVE (SPENT) | 0.910 | 0.910 | 2.2236:0.000 | **no** | fires | n/a | **fires** → sim REPLACED 116.74 m² −4.37 % |

Decoy control (legacy every-copy, R1–R5 without R6): ×1.25 → KEPT, first reading ACCEPTED at 2.50 (silent wrong
scale); ×0.8 → KEPT, named refusal. With R6 both become `PLAN_RESOLUTION_INCONCLUSIVE` / SOURCE_CONFLICT.
Unspent-figure counterfactual (today's resolver, figure SCORED): legacy every-copy resolves on the area copy at
2.2236, 116.74 m² — i.e. today's alternative set already contains the right building; only the order of use is wrong.
