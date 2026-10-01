# 005D pre-review B: OCR value and label binding

Question: why a misread `1055` bound to a false partial span (204.5–633 px) became the page vote's "independent"
support and outranked the correct overall binding (77–633), and how labels should be bound to spans and OCR value
alternatives kept without breaking evidence independence.

Method. A probe (`.cache/rev-b/load.ts` and `probe.ts`) rebuilds every plan frame's solver input from a run's sealed
OCR tokens, takes chains, ticks and wall plausibility from the decoded raster (no OCR re-run), and replays
`solveFrameMetric`. On 69 plan frames in 12 runs the replay matched the sealed relation, scales, legacy count and
witness count every time. A scratch copy of the solver (`.cache/rev-b/ms.ts`) simulates the proposed rules.

Runs at HEAD: `/home/user/work005d/{base,rev-a,rev-b,rev-c,rev-d}`; Żurawki uses sealed 005B evidence. Chance
statistics: `.cache/rev-b/chance.ts`; outputs: `/home/user/work005d/rev-b/`. No repository file changed.

## 1. Findings

**P0-1. The same ink is counted twice: for two scales, and for the vote.** On Azalia's ground copy the text region
`text-region-333-623` (`1055`, box x 333–364) yields two observations, both INDEPENDENT and decisive:
- `3ee0e34b05`: 1055/428.5 px → 2.462077 cm/px. The label centre (348.5) is 70.25 px (16.4 % of the span) off the
  span centre 418.75.
- `b12fe50759`: 1055/556 px, one skipped tick → 1.897482. Its offset is 6.5 px (1.2 %).

`gather` keeps one ink per cluster, but nothing keeps one ink across clusters or between a hypothesis and the legacy
support count. So this one ink is the only witness of hypothesis 2.462 (share 0.7707), of hypothesis 1.8975 (share
1.0), and of the vote (`legacy.independentGroups = 1`). The area-table copy repeats it (205.5–633 → 2.467836).

**P0-2. The decisive gate is applied per binding, not per ink, so skipping ticks makes short labels decisive.**
- On G2E's base plan, the vote's (2.7478) only independent support is `160` bound across 322.5–380.5: 58 px, 2 skipped
  ticks, offset 0.147. The same ink's best-centred span is 322.5–362.5 (40 px, offset 0.0125), below the 55 px
  decisive length.
- Across 11 houses today: 413 counted bindings on 186 text regions. 263 of them (64 %) are not the ink's unambiguous
  best-centred binding (174 alternatives, 89 near-ties). 47 regions (25 %) count only through such a binding.

**P0-3. Fixing P0-1/2 alone is unsafe: it exposes misread overall labels.** Single uncorroborated readings already
decide relations:
- **G2E:** the vertical overall prints `1474` and is read `1170` (glyph 2 '1' at 0.268; alternatives '/' .257,
  '7' .255, '4' .223). With the vote's alternative-bound support removed, the rule "vote has 0 groups, WEAK, share ≥ 0.8"
  would replace 2.7478 with 2.188962, which is 20 % wrong.
- **e-OZE attic, already today:** the label prints `1600` (11 px cap height) and is read `1011`. It is REPLACED/WEAK
  at 2.178879; the true scale is 1600/464 = 3.448.
- **Jabłonki:** the only correct single-reading replacement is `1100` (token confidence 0.657; best glyph runner-up
  0.41 of the winner).

A binding fix must therefore ship with the value-neutrality rule V3 (§4).

**P1-1. Lattice agreement is chance-level.** Sample: 115 long-span, best-centred, INDEPENDENT label inks from 10
houses; 5,679 cross-house pairs, unrelated by construction. A pair agrees when one scale in 1–5 cm/px fits both within
2.2 px. The pair columns give how many substitutions each label may use.

| readings allowed | as read (0,0) | (1,0) | (1,1) | (2,2) |
|---|---|---|---|---|
| full lattice (mean 6.9 values ≤ 1 sub, 12.2 ≤ 2 subs) | 1.55 % | 15.3 % | 33.5 % | 45.9 % |
| bounded (≤ 1 sub, glyph ratio ≥ 0.7; mean 4.0 values) | 1.55 % | 11.1 % | 20.0 % | 20.0 % |

On the same sheet (274 pairs on STRONG/SUPPORTED frames), as-read pairs agree at a wrong scale (> 3 % off) 1.8 %
and at the frame's scale 9.1 %; full-lattice (1,1) pairs 34.3 % wrong against 32.5 % right, so a substituted
agreement is more often wrong than right.

On Azalia, the lattices of the two overall labels (`1055` horizontal, `010` vertical) agree on both spans: `1035`+`670`
at 1.8615 on 556 px, and `1035`+`870` at 2.4154 on the false 428.5 px span. Each case has four agreeing pairs.

**P1-2. "One ink" is not one ink.** `textRegions` (metric-solution.ts:432) unions every raw token, page-sized
pseudo-tokens included. On Azalia a 683×348 px INVERTED `0089` merges 193 tokens and 38 observations of 14 distinct
labels into `text-region-111-120`. Largest region today / long-span label inks sharing a region: Azalia 193 / 16 of 27;
e-OZE 316 / 9 of 17; Kosaćce 251 / 8 of 32; Jabłonki 180 / 7 of 32. Built only from size-filtered labels (`dimensionLabels`), the largest region is 8–16 tokens, and no decision on any
house changes. So today the effect is under-counting, not over-counting.

**P1-3. Copies of one drawing are not independent.** On Modrzyki's two 853 px ground copies the overall reads `1050`
('0' .310 against '8' .305) and `1850` ('8' .308 against '0' .306); the vertical reads `1100`/`1160` ('0'/'6' at
.272/.271). Azalia's two copies both read `1055`; e-OZE's both read `1601` with identical glyph scores.
A cross-frame "overall-span consensus" must count a label printed on several copies once.

**P1-4. A tick can lie inside the label's own box.** In 10 of 103 best-centred decisive-length bindings a detected
tick lies strictly inside the label box (Azalia `71`, G2E `715`/`154`/`110`, Marcówki `141`, …). These are the
label's own strokes or ornaments crossing the line, but they act as span ends or skipped ticks.

**P2-1. The legacy vote never sees the overall span.** `proposalsOf(…, maxSkip = 0)` (chains.ts:323/635) with the
0.3·L centring test (chains.ts:384) binds `1055` to 204.5–633 only. This is the origin of the 2.462 incumbent; judging
the incumbent was the 005B solver's job.

**P2-2. Weight and outer ticks mislead.** The misbound span outweighs the right one (4.776747 against 4.338646)
because of the 0.7^k skip discount. Outer ticks do not discriminate either: the true binding is outer on Azalia and
on Marcówki `1260`, but the false binding is outer on e-OZE `760` (230–578.5 against the true 236.5–578.5).

**P2-3. `beatsLegacy`'s "outright" test ignores the overall-reading flag** (tuple position 2, metric-solution.ts:652).
This has no effect once P0-1 is fixed.

## 2. Azalia trace and the first wrong decision

Frame `…rzut-86bef468f3-19006df9bc`, chain `chain-horizontal-646-750b25df33`, ticks [77, 204.5, 633]. The label is
`1055`: HORIZONTAL, cap height 17 px, shear −10.2°, token confidence 0.55738. Glyph 3 is '5' .458 (alternatives
'1' .364, '3' .330, '0' .324); glyph 4 is '5' .555 (alternatives '3' .397, '1' .348, '2' .302).

1. **Legacy vote.** `spansFor(maxSkip 0)` offers only 204.5–633, so 1055/428.5 = 2.462. The vote wins at 2.462082
   (4 READ and 2 CHAIN_CORRECTED anchors).
2. **Metric solver** (`observationsOf`, metric-solution.ts:232–258). `spansFor(maxSkip 2)` returns two spans, (1,2) and
   (0,2). Each becomes a record whose `decisive` flag is computed on its own (≥ 55 px, height ≥ 10, no leading zero);
   both pass. Both are INDEPENDENT (horizontal orientation decided PAGE_UPRIGHT).
3. **Hypotheses.** `counted` keeps both records (line 608), so `clustersOf(counted)` builds two clusters holding the
   same region: 2.462077 (1 group, weight 4.7767, share 0.7707) and 1.897482 (1 group, weight 4.3386, share 1.0).
   `compareEvidence` ([0,0,1,1,·] beats [0,0,0,1,·]) selects 1.8975; `confidenceOf`, with 2.462 as rival, gives WEAK.
4. **Legacy support** (line 628). The 1055/428.5 record fits L (miss ≈ 0.001 px), so `legacy.independentGroups = 1`
   with share 0.7707.
5. **Relation.** CONFIRMED fails (|ln(1.8975/2.462)| = 0.26). REPLACED fails: `beatsLegacy` (line 653) needs an
   outright win, the tuples tie on axes, corroboration and count (1 against 1), and `own` is only WEAK. The result is
   LEGACY_UNCONFIRMED, confidence `confidenceOf(legacy, selected)` = WEAK, with the same ink the only witness on both
   sides.

**The first wrong decision is in `observationsOf`** (metric-solution.ts:232–258). It emits every candidate span as a
separate observation, each marked decisive by its own length, and never asks whether the same ink has a
better-centred binding. From then on, "one ink = one witness" holds inside a cluster (`gather`, line 273) but not
across hypotheses or for the vote's support (line 628).

The upstream cause of the wrong incumbent is the vote's own binding (P2-1). The downstream cause of failing to replace
it is the double count.

Human-read truth: 1035/556 = 1.8615 cm/px (horizontal) and 670/359.5 = 1.8637 (vertical). Even the correct binding
states 1.8975 (+1.9 %), because the value is misread.

## 3. Root cause

**Binding is an enumeration, not an assignment.** `spansFor` generates candidates (its 0.3·L test admits a label 16 %
off centre), and every candidate becomes evidence of equal standing; only the 0.7^k weight differs, and it favours the
wrong, unskipped span. **Independence is keyed on the region but enforced per cluster**, and the region is unreliable
(P1-2). **Value alternatives are kept but used only downstream**: nobody asks whether the deciding witness would still
decide under its own coin-toss glyphs (P0-3).

## 4. Proposed contract (generic; no project literals)

### Binding (B)

- **B1. Keep candidate generation as is** (≤ 2 skipped ticks, centre within 0.3·L). Neighbour bounds should use every
  label-sized ink on the chain, in any orientation.
- **B2. One primary binding per ink.** Let `a` be the text centre projected on the chain axis, `c` the span centre,
  `L` the span length, and `s = |a − c| / L` the offset share. PRIMARY is the candidate with the smallest `s`; ties go
  to fewer skipped ticks. Store `s`, the offset in px, the skipped-tick count and the outer flag on the record.
- **B3. Only the primary binding can be decisive**, and only when `s ≤ 0.10`, `L ≥ 25·tol`, the cap height is at
  least 10 px, and there is no leading zero. Calibration: the 34 best-centred bindings whose as-read value fits a
  STRONG/SUPPORTED final scale all have `s` ≤ 0.041 (median 0.008, at most 6.3 px). The false bindings measure 0.164
  and 0.165 (Azalia) and 0.147 (G2E).
- **B4. AMBIGUOUS binding.** If another candidate has `s − s_min < 0.05` and a length at least 3 % (DISTINCT_RATIO)
  different, the ink has no decisive binding; up to 3 alternatives stay on record, none counted. Near-ties whose
  lengths are within 3 % state one scale, so the primary is kept (e-OZE `760`: 342 against 348.5 px).
- **B5. A tick strictly inside the label's own box is neither a span end nor a skipped tick for that label** (P1-4;
  to share with Reviewer A's tick classes).
- **B6. Outer ticks, hierarchy level and weight are recorded but never choose a binding** (P2-2).

### Independence (I)

- **I1. The witness unit is the ink.** Build regions only from label-sized tokens (0.5–1.8× the median label cap
  height, as `dimensionLabels`); a larger token never merges.
- **I2. An ink counts for at most one scale**: the one its decisive binding's as-read value fits within tol. Every
  other binding is recorded and may attach to a cluster as an uncounted member, but never counts.
- **I3. One counted set** (from I2) serves hypotheses, rivals, `confidenceOf` and the vote's support; the line-628
  filter becomes "counted and fits L".
- **I4. A value proposed because it fits a scale is DERIVED**, never a witness: CHAIN_CORRECTED segments, lattice
  fits, and agreement between two substituted readings. Bounded substituted pairs agree by chance in 20 % of
  unrelated pairs (P1-1).
- **I5. A label printed on copies of one drawing counts once** in any cross-frame consensus; the copies' differing
  readings form one value-hypothesis set.

### OCR value hypotheses (V)

- **V1. Each ink has a bounded set of value hypotheses:** the as-read string; at most 4 one-substitution readings whose
  glyph ratio (alternative score ÷ winner score) is ≥ 0.7; and the ink's other-orientation reading, which the
  orientation decision already handles. Two-substitution readings never qualify. On 5 houses' counted long labels,
  156 of 289 glyphs have a runner-up ≥ 0.7. The commonest pairs: 6/0 (17), 4/9 (15), 2/3 (13), 1/3 (12), 5/3 (9),
  7/3 (7), 5/1 (7), 0/6 (7), 1/7 (6). No merged two-glyph cells ("kerned 11") were found: 0 glyphs ≥ 0.95× cap height.
- **V2. Only the as-read value, in the decided orientation, is a witness.**
- **V3. Neutrality.** An ink does not decide between scales S1 and S2 (including REPLACED against the vote) if any of
  its bounded hypotheses, on its decisive binding, fits the other side within tol. Rebuild the deciding evidence
  without such inks before `beatsLegacy` or `confidenceOf`.
- **V4.** When the deciding ink of the selected scale has bounded alternatives inside the plausible band, report
  VALUE_AMBIGUOUS with the implied interval and cap confidence at WEAK. The published figure alone never chooses
  among the alternatives.
- **V5. Cross-sheet selection, for 005D's overall-span consensus.** An as-read value printed on another sheet may
  select one of an ink's bounded hypotheses, but it is never counted on the target sheet. All of these must hold:
  - the two sheets' roles identify the same physical extent;
  - the selected value is in the ink's bounded set;
  - a scale-free check holds: the ratio of two such values equals the ratio of the two matching pixel spans on the
    target sheet, within the summed pixel tolerance;
  - the source value was not itself chosen to fit a scale.

## 5. What could select `1035` on Azalia, and the honest outcome

- **Ruled out:** the second ground copy (same misread, P1-3); short labels (57/30.57 and 71/37.5 state the scale only
  to ±7 %, against a 1.9 % gap); parts chains (none spans 77–633); the vertical overall `010`/`014` (`670` only as a
  two-substitution reading, I4); and the published footprint (69.69 m²), which points the wrong way: 67.26 m² at
  1.8975 (−3.5 %) against 64.73 m² at 1.8615 (−7.1 %).
- **Legitimate evidence exists in the package: the site plan.** Frame `…sytuacja-2-08297d9423` (23 px text) prints
  `1035` horizontal and `670` vertical as read. It gives values, not a scale: its 400 setbacks read `000`, its 1470
  reads `1070`, and its own spans are schematic (1035/390 px = 2.65 against 670/280 px = 2.39).
- **The scale-free check settles it.** The ground plan's overall pixel spans give 556/359.5 = 1.5466. The site plan's
  1035/670 = 1.5448 is 0.12 % away; 1055/670 = 1.5746 would be 1.81 % away; the two-span pixel tolerance is ±1.0 %.
  `1035` is in the ground ink's bounded set (ratio 0.722). V5 therefore selects 1035 → 1.8615 horizontal, and 1.8637
  through the vertical span. This is CROSS_SHEET evidence; the ground sheet's independent witness count does not rise.
- **Honest outcome without V5:** REPLACED/WEAK at the as-read 1.8975, which V3 allows because every bounded hypothesis
  refutes 2.462. It carries VALUE_AMBIGUOUS over 1.8076–1.8975 (from {1055, 1015 .794, 1035 .722, 1053 .714,
  1005 .707}; the truth lies inside), and the question "the overall dimension reads 1055 — confirm?".

## 6. Negatives and risks

- **A nearby unrelated numeral or logo** wins a binding only if centred (s ≤ 0.10) and within 2.2 text heights, and
  then counts as one ink. As-read chance agreement is 1.55 % per pair, so false corroboration stays possible. The
  existing height filter removes oversized glyphs, and I1 extends it to regions.
- **A label between segments**, straddling a real tick, is handled by B5. A real tick inside a label box cannot be told
  from a stroke, so such a label may lose a binding. Measured: 10 of 103, none a witness of a base plan's selected
  scale.
- **Rotated labels:** binding works the same along either axis. CW and CCW readings are hypotheses of one ink. An
  orientation chosen by the other axis stays ORIENTATION_BY_OTHER_AXIS.
- **Real segmented chains:** neighbour bounds keep a label's own segment PRIMARY. If only the middle label of a
  three-segment chain is read, the segment and the whole chain tie at s = 0, so the label is AMBIGUOUS and not
  counted. That is honest but costs a witness. Measured near-tie losses: Marcówki `1260` (457 against 476.5 px) and
  Żurawki `155`.
- **Thresholds:** V3 at glyph ratio 0.5 also flags e-OZE `1601` (`1801` at 0.654 fits the old 2.5014), but `760`
  keeps the replacement. B3 at 0.10 changes no relation; it only drops witnesses on NO_SCALE frames (Aster, Żurawki b33f).
- **Model and CI:**
  - G2E's warning moves from METRIC_SCALE_WEAK to METRIC_SCALE_UNSUPPORTED, but 005B pins G2E to the WEAK warning, so
    the pin must change deliberately. Today's WEAK rests on `160`'s two-skipped-tick alternative span.
  - The e-OZE attic scale moves 2.1789 → 2.2220; both are wrong (the true scale is ≈ 3.45).
  - The full-pipeline effect on models was not run. Re-run e-OZE, G2E and Azalia end to end.

## 7. Per-house measurement

Variants: **B+I** = B2–B4 plus I2–I3; **B+I+V** = B+I plus V3 at glyph ratio 0.7 (adding B3 at s ≤ 0.10 and I1
leaves every relation the same). "Non-primary" counts alternative and near-tie bindings.

| house | plan frames | counted bindings today (regions) | non-primary | regions counted only via non-primary | base plan today | base plan under B+I+V |
|---|---|---|---|---|---|---|
| Marcówki | 8 | 67 (34) | 45 | 13 | CONFIRMED/STRONG ×2, 3 witnesses | same, 2 witnesses (`1260` ambiguous) |
| Kosaćce clean / tracked | 4 / 4 | 48 (23) each | 24 | 0 | CONFIRMED/SUPPORTED ×2 | unchanged |
| Rarytasy G2E | 4 | 26 (13) | 17 | 4 | LEGACY_UNCONFIRMED/WEAK 2.7497 | LEGACY_UNCONFIRMED/INCONCLUSIVE 2.7497; B+I alone gives REPLACED/WEAK 2.189 (wrong) |
| Rarytasy e-OZE | 4 | 31 (9) | 21 | 1 | REPLACED/STRONG ×2 (`1601` + `760`) | unchanged; attic REPLACED/WEAK 2.1789 → LEGACY_UNCONFIRMED/INCONCLUSIVE 2.2220 |
| alt-Marcówki | 4 | 12 (4) | 12 | 4 | LEGACY_UNCONFIRMED/INCONCLUSIVE | unchanged |
| Jabłonki | 8 | 42 (14) | 28 | 1 | REPLACED/WEAK (`1100`/519) | unchanged |
| Willa Miranda | 8 | 50 (27) | 31 | 8 | CONFIRMED/SUPPORTED ×2 | unchanged |
| Żurawki (sealed 005B) | 12 | 64 (29) | 41 | 8 | CONFIRMED/STRONG ×2, CONFIRMED/WEAK | unchanged; one copy 5 → 4 witnesses |
| Modrzyki | 4 | 36 (23) | 19 | 6 | CONFIRMED/STRONG, REPLACED/STRONG | unchanged |
| Aster VIII | 1 | 1 (1) | 0 | 0 | NO_SCALE | unchanged |
| Azalia | 8 | 36 (9) | 25 | 2 | LEGACY_UNCONFIRMED/WEAK 2.462 / 2.468 | REPLACED/WEAK 1.8975 ×2 (V5 gives 1.8615) |

**Selected-scale changes under B+I+V:**
- Azalia's two ground copies: 2.462 → 1.8975 (error 32 % → 1.9 %).
- e-OZE attic: 2.1789 → 2.2220 (both wrong).

No development house's base-plan scale changes. Witness counts fall only where an alternative or ambiguous binding
was being counted. Reject B+I without V: it would turn G2E's correct incumbent into a 20 %-wrong replacement.
