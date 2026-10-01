# 005D post-implementation review B: OCR value and label binding

Scope: `packages/source-metrics/src/metric-solution.ts` at HEAD `6f3f996`. That covers binding (`bindingsFor`,
`primaryBinding`), value hypotheses (`boundedValues`), V3 against the vote, the new "V3 between rivals" block
(lines 774–800), V4 (`topology.valueAmbiguity`), and I1/I2.

This review was read-only. All probes are in `.cache/review-b/` (gitignored) and run with
`cd /home/user/BuildApp && npx vite-node .cache/review-b/<probe>`. No publisher image was copied.

Method:
- `load2.ts` rebuilds each plan frame's solver input from a sealed m2 run: the OCR tokens come from
  `metric-evidence.json`; the chains and marks come from today's `findDimensionLines(mask, {raster, grey})` on the cached
  bytes.
- `p2-replay.ts` reproduces the sealed relation, confidence, scale and selection on **71/71** plan frames of 13 runs.
- `ms-var.ts` is a scratch copy of the solver with toggles: rival rule on/off, widened or plain tolerance, distinctness
  gate, glyph ratio, and q-end ambiguity. With default toggles it equals the shipped solver on 71/71 frames
  (`p16-variant-identity.ts`).
- m1 against m2 (`cmp.mjs`): relation, confidence, scales, selected hypothesis, neutral ids and value ambiguity are
  identical on every frame. **The V3-between-rivals rule never fires on the development data.**

Note: `packages/reconstruction/src/{plan-resolution.ts,v2/reconstruct-v2.ts}` showed uncommitted edits during this
review. I did not make them. `packages/source-metrics` is clean at HEAD.

## Findings

### P1-1. V3 between rivals: a short reading takes the selection from a correct overall reading, through a tolerance widened by its own imprecision

**First bad decision:** `fitsOther` (l. 779) tests an ink of the strongest scale S against a rival R within
`tol·(1 + w.px / widest(R))`.
- When R rests on one short ink, this window is the short ink's own ±tol / p_R, transferred onto the overall reading.
- For a 556 px overall reading against an 80 px rival, that is 17.5 px, i.e. ±3.1 % in value.
- The overall reading is then neutral if ANY bounded alternative (one glyph) lands in R's window. This includes an
  alternative that differs from the as-read value only in the last digit.
- The swap (l. 789) then compares what remains. S has nothing left; R keeps its unchallenged short ink, and R becomes
  the selection.

The alternative is considered only because it fits R, and it hands R the decision. That is non-circularity broken at
the decision level, not the witness level.

The neutrality test against the vote (`neutralAt`, l. 811) uses plain `tol`, so the two V3 uses are inconsistent.

Reproductions:

1. **`p15-replace-wrong.ts`: a wrong scale is REPLACED in; the old code was right.**
   - S = 1.8975 is stated by `1055`/556 px (overall; alternative `1035` @0.9) and corroborated by `380`/200 px
     (alternative `360` @0.8).
   - R = `182` on a 100 px vertical chain. It is the only vertical chain, so its share is 1.0. It misses S by 4.1 px.
   - The vote is a misread `1400` (2.518, 0 groups).
   - Output:
     ```
     S=1.8975 R=1.82 (-4.1%); 1035@R misses 12.7 px (window 14.4); 360@R misses -2.2 px (window 6.6)
     [today]                     REPLACED/WEAK X=1.82 ... selected=1.82(1) neutral=2 ... a rival scale has 756% of its independent support
     [without V3-between-rivals] REPLACED/SUPPORTED X=1.897594 ... selected=1.897594(2)
     [rival rule at plain tol]   REPLACED/SUPPORTED X=1.897594 ...
     ```
   - After the swap, `confidenceOf(R, S)` caps R at WEAK. `beatsLegacy` still accepts it, because the vote has 0 groups
     and R's longest share is ≥ 0.8 on its own short axis.

2. **`p10-lastdigit.ts`: a last-digit alternative is enough.**
   - `1055` (alternative only `1058`, +0.28 %) against `157`/80 px (R = 1.9625, +3.4 %, missing S by 2.74 px). The
     window is 17.5 px; `1058`@R misses by 16.9 px. Even the as-read value misses by only 18.4 px.
   - With the wrong vote `1400`:
     - today: LEGACY_UNCONFIRMED/INCONCLUSIVE at **2.517986** (+33 %), selected 1.9625;
     - without the rule, or at plain tol: REPLACED/WEAK at **1.897482**.
   - With the vote right: today LEGACY_UNCONFIRMED/WEAK; the old code CONFIRMED/WEAK.

3. **`p3-eoze-perturb.ts`: a development house, one glyph score away.**
   - The frame is the second ground copy of current e-OZE, `…rzut-2abfc5825d-e842a14c7f`. The model is built from the
     sibling copy `b747b42ad2`, which has no rival.
   - Sealed result: REPLACED/STRONG 2.223611. The rival R = 2.047244 rests on one ink, `130`/63.5 px (share 0.088), so
     the window for the 720 px `1601` is 27.1 px.
   - `760`'s alternative `700` already fits R (0.08 px). `1601`'s runner-up `5` sits at 0.57, below the 0.7 bound; at
     ≥ 0.7, `1501` would miss R by 13.2 px.
   - Nudging that one glyph ratio from 0.57 to 0.70:
     ```
     [nudged, today]                     LEGACY_UNCONFIRMED/INCONCLUSIVE X=2.501397 selected=2.047244(1g, share 0.088194) neutral=2
     [nudged, without V3-between-rivals] REPLACED/STRONG X=2.223611
     [nudged, rival rule at plain tol]   REPLACED/STRONG X=2.223611
     ```
   - 2.5014 is the scale 005A failed on. `p4-sensitivity.ts`: with the glyph bound at 0.5 for every frame, this is the
     only frame of 71 where the shipped rule differs from both the plain-tol rule and the old code.
   - Downstream the resolver's challenge might still recover it. That was not run end to end.

**Proposed generic fix (not implemented):**
- (a) Judge rival neutrality on the ink's own pixel tolerance, as `neutralAt` does. At most allow
  `tol·(1 + min(1, w.px / widest(R)))`, so a less precise rival never gets a wider window on a more precise ink.
- (b) Neutrality may make a decision undecided. It must never promote a hypothesis of lower standing than the
  strongest's FULL evidence (the first three places of the tuple) to the selection. In that case the result is
  `undecidedRival`/INCONCLUSIVE, not a swap.
- (c) Add a test: an overall reading with a last-digit alternative against a short rival 3–4 % away must not move the
  selection.

(a) at plain tol is identical to the shipped code on all 71 frames at glyph ratio 0.7. It keeps the shipped fixture
(`1601`/`800`, `p11-fixcheck.ts`: selection 2.5 either way) and removes reproductions 1–3.

### P1-2. V3 against the vote is not asked between 1.2 % and 3 %: a single misread replaces the vote while its own alternative fits the vote exactly

**First bad decision:** `distinctFromLegacy` (l. 810) asks V3 only when |ln(selected/L)| ≥ `DISTINCT_RATIO` (0.03).
CONFIRMED needs ≤ `agreeTol` = max(0.012, tol/longest) (l. 833–836, 875). In the gap, a selection is neither confirmed
nor checked for neutrality, and `beatsLegacy` replaces a 0-group vote on one overall reading.

This happens on a development frame today: the e-OZE attic, `…e-oze-rzut-1dede27c71`, in m1 and m2.
- Result: REPLACED/WEAK at 2.178879, decided by `1011`/464 px alone.
- `1011`'s bounded alternative `1031` (@0.839) fits the vote's 2.222028 at 1031/2.222028 = 463.99 px, a 0.01 px miss.
  The gap is |ln| = 0.0196.
- The contract says (§2.3 V3): "an ink does not decide … when one of its bounded hypotheses … fits the other side
  within the pixel tolerance".
- `p5-distinct-gap.ts`, with the gate removed: LEGACY_UNCONFIRMED/INCONCLUSIVE 2.222028. That is exactly what
  pre-review B simulated for B+I+V.

Both scales are wrong (pre-review B gives the printed `1600` → ≈ 3.45), and this frame does not feed the model
(`selectedPlanFrameId` = `b747…`). It is still a contract deviation with a live instance. G2E `e8520c3ad3`
(|ln| = 0.021) also sits in the gap; its outcome does not change.

**Fix:** ask V3 whenever the selection is not CONFIRMED (|ln| > `agreeTol(selected)`). Better still, decide per ink in
pixels: an ink is neutral when an alternative fits L within tol and the as-read value does not. Measured with the gate
removed, the attic frame is the only frame whose relation changes.

### P1-3. Binding: questionable ends outrank centring with no ambiguity, so a partial span wins over the span the label is centred on

**First bad decision:** in `primaryBinding` (l. 302, 305), questionable ends rank before the offset share. The B4
ambiguity check then only looks at candidates with the SAME count of questionable ends. So a better-centred candidate
that ends on one more QUESTIONABLE mark can never make the primary ambiguous.

`p8-binding.ts (a)`: an overall line with marks [100 QUESTIONABLE, 150 TICK, 656], label `1055` exactly centred.
```
(a) bindings of 1055: 150-656(PRIMARY s=0.049407 q=0 skip=0) 100-656(ALTERNATIVE s=0 q=1 skip=1)
[a q-end total vs partial] CONFIRMED/WEAK X=2.08498 legacy=2.08498(1) selected=2.08498(1)     (true 1.897482, +9.9 %)
    same with a clean end mark: … 100-656(AMBIGUOUS s=0 q=0 skip=1)
```
Doubt about the line's real end therefore turns an honest AMBIGUOUS into a decisive partial witness that "confirms" the
vote's partial binding.

The ingredient is common (`p9-endmarks.ts`):
- 1101 of 3237 chains on the development frames have a QUESTIONABLE outermost mark. ONE_SIDED, natural at a line end,
  accounts for 903 of those reasons. The figure is 106 of 315 for chains at least half the axis long.
- 357 chains have a TICK just inside a QUESTIONABLE end.

`p6-partial.mjs` on m2:
- 136 inks have a PRIMARY that is a strict part of an eligible longer candidate.
- In 42 of them the longer candidate was better centred and lost only on questionable ends. 10 of those primaries are
  decisive-length INDEPENDENT readings.
- Example: Jabłonki `d52f958fd6`, `325` bound to 354.5–445 at s = 0.086 (above the calibrated ≤ 0.069) over 337.5–445
  at s = 0.007, a 17 % value move. That frame's selected hypothesis 3.59116 rests on it. Its relation is unchanged
  (LEGACY_UNCONFIRMED).

**Fix:** a candidate that strictly contains the primary, is centred better than primary + `ambiguity`, differs in length
by ≥ `distinct`, and lost only on questionable ends makes the ink AMBIGUOUS.
- Measured with `p12-qambig.ts`: no relation or scale changes on the 71 frames; only Jabłonki `d52f` and Willa `07b69`
  drop a partial-bound selected hypothesis.
- G2E's planter case (C P0-2: the questionable span lies inside the true one) is untouched.
- Do NOT drop the containment condition: the unrestricted variant hands G2E's selection to the misread `1170` (2.189).

### P2 findings

- **P2-1. B5 binds a label printed over a real mark to the span across it** (`p8 (b)`). Marks [100, 300, 500] with
  `200` centred on 300 give PRIMARY 100–500, decisive at 0.5 cm/px. With unequal segments the same label is UNCENTRED
  (shipped test). Fix: a mark inside the box should cost a skipped mark, or make the binding AMBIGUOUS when both sides
  are segments of their own.
- **P2-2. I1 is bypassed on sparse frames.** `dimensionLabels` returns every token when fewer than 5 near-chain heights
  exist (l. 195). In `p13-giant.ts` a 400×348 px pseudo-token `589` over the overall line claims its interval: `1055`
  is dropped and `589` becomes the PRIMARY decisive witness.
  - Result: CONFIRMED/INCONCLUSIVE at 1.059, against CONFIRMED/STRONG at 1.898 without it.
  - With five ordinary labels nearby, the filter engages and the pseudo-token is excluded.
  - Fix: an absolute bound when the sample is small, e.g. the median height of all multi-glyph tokens on the frame.
- **P2-3. One ink is counted for two scales** (I2/I3). `gather` attaches a counted ink to every cluster it fits within
  tol, and a decisive ink of ≤ 147 px fits two scales 3 % apart.
  - In `p14-shared.ts`, `135`/70 px is an independent witness of both 1.8975 and 1.9604, and makes each "corroborated"
    with both axes measured.
  - Here the tie ends INCONCLUSIVE, and no decision flip was found. Fix: assign a counted ink to the best-fitting
    hypothesis only.
- **P2-4. V4 is looser than the contract.**
  - The interval is not limited to the plausible band. Examples: e-OZE attic [2.18, 15.11] via `7011`; Marcówki
    `fed2` [1.82, 6.98]; Willa `07b69` [1.24, 7.97].
  - It is computed only when `selectedMembers.length === 1`, not when V3 leaves a single deciding ink.
  - On LEGACY_UNCONFIRMED frames (Kosaćce `803d`, Marcówki `fed2`, G2E) it describes a hypothesis the frame did not
    adopt.
- **P2-5. Tests.**
  - `glyph-ambiguity.test.ts`'s `bounded` helper is the one-substitution lattice without the 0.7 ratio and ≤ 4 cap, so
    "named" there is looser than production V1. It should call `boundedValues`.
  - The only fixture for V3 between rivals misses its rival by 0.4 px, so the widened tolerance is never exercised.
- **P2-6.** `observationsAsRead` (l. 846), which feeds `CONFLICT_AS_READ` and `undecidedConflict`, includes
  ORIENTATION_BY_OTHER_AXIS readings. Their orientation was chosen by `latticeFits`, which uses two substitutions with
  no ratio bound. They are not witnesses, but they can make a frame INCONCLUSIVE.

## What I tried that did not break

- **No substituted value is ever counted.** Counted means INDEPENDENT ∧ PRIMARY ∧ decisive. Readings are as read
  (`substitutions === 0`). CHAIN_CORRECTED segments are never ACCEPTED observations. AGREES_AFTER_CORRECTION and
  `valueAmbiguity` have no consumer outside the evidence pack. Resolver T2 reads PRIMARY ≥ 25·tol only.
- **Two-substitution values** appear only in `latticeFits`, which picks a chain's orientation and labels it
  ORIENTATION_BY_OTHER_AXIS so it is never counted, and in the incumbent vote's CHAIN_CORRECTED anchors. `boundedValues`
  never yields one. Its 0.7 ratio and one-substitution bound are the same set everywhere it is used: recorded
  alternatives, V3 against the vote, rival neutrality and V4. Only the pixel tolerance (P1-1) and the gate (P1-2)
  differ.
- **Non-digit glyph alternatives** on all m2 tokens are only `/` (2923) and `±` (16); none parses as a linear
  dimension. The 16 decimal value alternatives are never decisive.
- **Azalia's partial** stays non-decisive with the watermark mark REJECTED or QUESTIONABLE: the total remains PRIMARY
  and 204.5–633 is outside the 0.10 share.
- **Other binding attacks:**
  - a label centred between unequal segments → UNCENTRED;
  - a box widened by a stray or kerned stroke (+60 px) → UNCENTRED, a witness lost with no misbinding (`p8 (c)`);
  - a rotated label across a rejected mark → correct;
  - a page-sized pseudo-token covering the line's end marks → no binding (B5), only the displaced label is lost.
- **Swap guard rails:** an implausible R cannot be selected, and post-swap confidence uses full evidence, so R is capped
  WEAK against a stronger S. These mitigate P1-1 but do not prevent it (reproduction 1 goes through the overall share on
  R's own short axis).
- **The rule's reach on the development data:** pairwise margins on all 71 frames are in `p2-replay.out` and
  `p2-replay-b.out`. Inks became neutral only where an alternative already fits within plain tol, except on Modrzyki:
  `1050`, `1100` and `1160` miss by 2.5–4.0 px inside windows of 5.9–10.6 px. None of them changes a decision.

## Verdict

| Area | Verdict | Basis |
|---|---|---|
| OCR non-circularity | **FAIL (decision level)**; PASS at witness level | No substituted, lattice-fitted or corrected value is ever counted. But in P1-1 alternatives considered only because they fit the rival hand it the selection (a wrong REPLACED in reproduction 1; one glyph score from a wrong scale on the e-OZE copy). In P1-2 an ink whose own alternative fits the vote decides REPLACED (e-OZE attic, live). |
| Partial-vs-total safety (binding side) | **PARTIAL** | Only PRIMARY decisive bindings count; Azalia's partial is closed; ambiguity among equal-q candidates holds. Open: a questionable outer end hands the binding to a partial (P1-3, 42 instances on m2, 10 decisive-length); B5 on equal segments (P2-1); I1 bypass on sparse frames (P2-2). |
| Glyph-ambiguity handling | **PARTIAL** | One bound (ratio ≥ 0.7, one substitution, ≤ 4, no leading zero) applied identically to the recorded alternatives, V3, rivals and V4. Inconsistent pixel tolerance (P1-1) and distinctness gate (P1-2); V4 band and trigger (P2-4); test helper looser than production (P2-5). |

Severity summary: no P0. P1-1 (rival tolerance and swap), P1-2 (V3 distinctness gap, live on a non-model development
frame), P1-3 (questionable-end precedence). Each has a generic fix measured to leave all 71 development frames' relations
and scales unchanged.
