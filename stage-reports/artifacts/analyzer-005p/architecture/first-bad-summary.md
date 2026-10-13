# 005P — first-bad decisions on the 44 development cases (summary of `first-bad-ledger.json`)

Method and caveats: `first-bad-ledger.json` → `method`. One forensic agent per house group, on sealed evidence and the
incumbent replays (005O M0-frozen = 005P P0-frozen, byte-identical on 44/44); the eight contrasting groups were re-checked
by an adversarial reviewer told to refute (their corrections are folded in). KNOWN / INFERRED / UNAVAILABLE is kept per
item. Transcription truth is two model transcribers at crop level, used to classify only. **No development case is blind.**

## Root categories (earliest unsupported action, 44 rows)

| root category | rows | rows |
| --- | --- | --- |
| NONE_PASS (no unsupported action decides the outcome) | 18 | the 18 P0 PASS rows |
| TOPOLOGY_BOUNDARY | 10 | glogownikach, jarzabem, akebiach, kosacce-area-alone, cyklamenach, azaliach, dabecjach, helikoniach, A00, A05 |
| INSUFFICIENT_SOURCE | 7 | aster-viii, galaktyka, D01–D05 (no printed floor-plan dimension; scale only in site plans / 1:500 documents the solver does not consume) |
| BINDING_OR_CHAIN | 4 | murajach, gozdzikowcach (latent; the run fails later at emission), A04, D00 |
| METRIC_SOLUTION | 1 | dom-pod-milorzebem (twin-line dedup by classic-token confidence lets a contested 608 displace the AGREES 650) |
| SOURCE_OR_FRAME | 1 | alt-marcowki |
| OCR_OBSERVATION | 1 | dom-w-modrzewnicy |
| STOREY | 1 | willa-miranda |
| PRIMITIVE_EXTRACTION | 1 | A01 |

**Only one row's refusal is carried by plan resolution's as-printed view: glogownikach**, and even there it is not the
house's first bad decision (below). The as-printed view also re-ranks readings on jarzabem, akebiach and milorzebem
**without** being their first bad decision. This bounds what any 005P policy can achieve: at most it removes one
illegitimate refusal and must not move the others.

## The six questions the brief asks

**1. Why did PP-OCR's 541/870 exist yet SOURCE_CONFLICT arise?** (KNOWN) On the late path (the first reading completed
NEAR −8.0 %, so `footprintOnly` was false) `sourceConflictOf` T3 OUTER_TOTALS paired the classic token texts 501/206 px
and 810/333 px (statements `1fce7f3126`, `f810c24db9`), which agree on 2.432 cm/px over more long length than the
readings agreeing with the STRONG/CONFIRMED registration 2.626. The ensemble had 541 (CONTESTS, external rival p 0.9998)
and 870 (LEADS) on the same boxes, and the metric solution used them; plan resolution's view never reads the ensemble
(`plan-resolution.ts:200`). The two misreads are one reader family's substitutions (4→0, 7→1), not two witnesses.
Falsifier: with every external reading stripped, the conflict must reappear identically (005O control: it does).

**2. Why did M1 remove the conflict but not the −8.04 % footprint?** (KNOWN mechanism, INFERRED arithmetic from a
scratch re-implementation that reproduces the sealed grid) The conflict vanished because M1 *withheld* the token readings
(the M1 view abstains on every long statement of the frame), not because 541/870 won. The footprint failure is a separate,
earlier decision at the **correct** scale and the **correct** extent (78..812 × 203..553 px): on the two max-side exterior
walls `gridLines` gives the band to the inner-face line (`plan-decomposition.ts:509` tie-break by px on Y; by distance on
X), `thinLines` then drops the outer-face line by **0.136 px** (17.000 < minCellPx 17.136, `:564-582`, `:1861`), and
`walledEnvelope` snaps the correctly computed outer faces inward by one wall thickness (`:1244-1256`, tolerance = wallPx
18; Y margin 0.5 px). About 11.8 m² is lost; the boundary reviewer rejects the strips (NO_STRONG_EXTENT, WALL_SLIVER,
WALLED_OFF) and topology emits them as 3 PAVED "recess" terraces; the ring 18.83 × 8.70 m is labelled SOURCE_EXACT although
8.70 is the inner-face 870. Falsifier: minCellM 0.44 keeps line 553 and restores Y (≈172–173 m²) while X stays at 797.69.
Root: TOPOLOGY_BOUNDARY, outside the metric seam.

**3. How did jarzabem lose its terrace semantics under M1?** (KNOWN, recomputed) M0 reads the correct copy at the correct
scale (truth-oracle replay gives the same model `df2aa66c`) and fails footprint (−11.9 %) on a topology decision: no grid
lines at the porch jambs, so the open porch shares cells with the study and kitchen and the envelope seals at an interior
line. Under M1 the resolver's ranking flips copies: on the dimensioned copy `19f8c2fa6e` all three contested statements
abstain — one is metrically irrelevant (1101 vs 1100) and one is a binding error both readings refute — so the copy's
refutation denominator falls from 681.7 px to 55 px and its refuted share to **0.000** (bucket 0) against the area-table
copy's 0.395 (bucket 7). **"No evidence" ranks as perfect agreement** (`refutedShareAsRead` returns 0 when nothing is
stated, `:234`). The other copy's decomposition then turns the 3.8 m opening into OPEN_SIDE and loses the covered terrace.
Falsifier: any policy that leaves the ranking's denominators alone (P1, N1) must leave jarzabem's copy and semantics as M0.

**4. Why is murajach not repaired downstream?** (KNOWN binding/anchors, INFERRED vote composition) The legacy chain solver
binds the correctly read 1020 to a 412 px fragment cut by the publisher logo (the metric layer itself rejects that binding
as UNCENTRED), its vote converges on a self-consistent set of substitutions (1020→1010, 111→117, 151→157), and
`extract.ts:997` admits those CHAIN_CORRECTED segments as the **only** registration anchors — against its own comment at
`:992`. The registration 2.451 (true ≈ 1.554) is therefore self-anchored. The two correct witnesses (740/476 on v49,
410/264 on v244) are both lost to orientation decisions, one of them (v244, OTHER_AXIS_SCALE) itself made at the
fragment scale. Plan resolution sees only copies registered at 2.451 (the others have no PLAN_XZ registration) and
correctly refuses. No plan-resolution policy can reach this: root BINDING_OR_CHAIN in source-metrics.

**5. Why can't akebiach be fixed by polygon snapping?** (KNOWN for the flood labels; the 005N/005O "missing piers"
mechanism is **FALSIFIED** by its own counterfactual) The scale is right (STRONG, REPLACED). The enclosure flood
classifies the core/living column, the hall pocket, the W area and the S projection as OUTSIDE inside the STRONG chain
extent. Injecting both piers as wall-thick bands changes enclosed cells 344 → 347 and leaves the storey at 95.6 m²; the
decisive leak is the core's **south face, which carries no wall-thick ink** (row ink 0.08–0.27). No closure rule and no
band snapping can shut a face the drawing does not ink as wall; a source-unbacked closure gives 187 m² (−24.9 %), still
WRONG, because the S 4.30 m projection is never a completion candidate. Root TOPOLOGY_BOUNDARY; snapping/noding of band
rectangles is not a fix (consistent with 005O `NO_KERNEL_BOTTLENECK`).

**6. Which parts of gozdzikowcach are right and wrong?** (KNOWN) Right: the scale (the metric solution uses
524/1385/544/317 correctly), 005N's compound facade (WALL_RETURN separator, recess with back wall, garage built), the
validator's refusal of a 0 m chimney (no false model ships). Wrong, in order: (a) latent — the chain solver rewrites
printed labels into scale-fitted values (1385→1382 although token, lattice and external all read 1385; 114→514; 717→311)
and the layout consumes them as MEASURED (13.82 m SOURCE_EXACT width; a false WIDTH_CORROBORATED from a copy carrying the
same substitution; the recess shifted ≈12 cm); (b) v2 builds recesses only from ZONE regions and drops the layout's RECESS;
(c) the failing one — one LEVEL_DATUM, no ridge datum, no registered elevation → no main roof → `emit.ts:447` writes chimney
height 0 → MODEL_EMISSION_FAILED. The failure record keeps no plan digest. None of this is in the metric seam.

## Cross-cutting roots found (recorded, not fixed in 005P)

- **CHAIN_CORRECTED values treated as printed:** anchoring the registration they were corrected toward (`extract.ts:997`;
  murajach), consumed as MEASURED widths and grid positions (gozdzikowcach), and as cross-copy corroboration of the same
  substitution. This is the most frequent unsupported action upstream of plan resolution in the ledger.
- **Grid face selection and snap tolerance equal to a wall thickness** (glogownikach; jarzabem's missing jamb lines is the
  same family of grid decisions).
- **Absence ranked as agreement** (`refutedShareAsRead` = 0 when nothing is stated): latent under P0, decisive under any
  dropping view.
- **Twin-line dedup by classic-token confidence** (milorzebem): the metric layer itself prefers a contested reading.
- **Emission failures lose upstream records** (gozdzikowcach, A01).

## Consequence for the 005P hypotheses

- A policy at plan resolution can, on these 44 rows, at most remove glogownikach's illegitimate refusal; the house then
  completes and still FAILS its footprint (Q2). Any variant that changes jarzabem's copy, eoze's trigger path, or the
  ranking labels of akebiach/milorzebem is moving rows whose first bad decision is elsewhere.
- No first-bad decision on the 44 rows is a double-counted witness **inside plan resolution's decisions**; correlated
  support appears upstream (CHAIN_CORRECTED self-anchoring; a copy's identical substitution as corroboration in the
  layout gate) and in T3's "different chains" test (glogownikach's two misreads), which the contest policy addresses.
