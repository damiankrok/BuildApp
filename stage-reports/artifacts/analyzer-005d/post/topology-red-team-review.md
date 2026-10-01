# 005D post-implementation review A — topology false-positive red team

Reviewer A, read-only, HEAD `6f3f996` (branch `analyzer/dimension-chain-integrity-v1`). Question: can the 005D mark
classes (`classifyMarks`) and label binding (`bindingsFor` / `primaryBinding`) still let a spurious mark split a total,
demote a real tick in a way that moves a binding or a scale, or let a partial outrank a total? Probes live in
`.cache/review-a/` (gitignored). Publisher bytes came only from `/home/user/work005d/cache`; the one crop I looked at
stayed in the session scratchpad. Nothing tracked was edited. The two 005D test files pass at HEAD (45 tests).

## 0. Method

- **Class counterfactual on real bytes** (`cf.ts`, `bindcmp.ts`). For every plan frame that carries a metric
  solution in the m2 runs (71 frames, 13 runs, 12 houses; `eoze-legacy-*` and `kosacce-area-alone` have no package or
  graph and were skipped), the probe re-decodes the frame. It rebuilds lines, chains, page vote and metric solution
  exactly as `extract.ts` does, three times: the 005D classes; classes stripped (every mark a TICK); QUESTIONABLE→TICK.
  The 005D variant reproduces the sealed solutions (for example Azalia REPLACED/WEAK 1.897482, Jabłonkach `…d2646b4dce`
  selected 3.59116).
  `npx vite-node .cache/review-a/cf.ts /home/user/work005d/m2/<house> all` → `.cache/review-a/out/<house>.txt`.
- **Drawn counter-examples** (`syn.ts` + `s1…s9.ts`, `sweep*.ts`). A `Canvas` at 2.5 cm/px goes through the same
  pipeline as the `analyse()` of `dimension-topology.test.ts`. Each case runs with the classes and with them stripped.
- **Sealed-evidence scans** (`realends.py`, `override.py`, `fixsim2.py`) of `dimensionObservations` and
  `chains[].marks`.

## 1. Findings

### P0-1 — "Fewer questionable ends" outranks centring. A real end demoted to QUESTIONABLE hands its label to any interior TICK.

This is P0 by the stated definition: a real-tick regression on a development house. No model moved today.

`primaryBinding` (`metric-solution.ts:302`) sorts eligible spans (s ≤ 0.10) by `questionableEnds` first and by
centring only second. B4 ambiguity (`:305`) is declared only between candidates with the **same** questionable-end
count. So whenever a real end mark is QUESTIONABLE, any TICK-class crossing inside the span gives the label a
partial span. The condition is that the partial span is still within 0.10 of the label, which holds up to about
L/6 from that end for a centred label and about L/4 at a 0.06 offset. The partial span then wins outright: it is
PRIMARY, never AMBIGUOUS, and decisive. With the classes stripped, the same ink binds the right span.

- **Development house: Jabłonkach `frame-asset-rzut-d52f958fd6-d2646b4dce`, red room chain H512.** I checked the crop
  by eye.
  - The label `325` (HORIZONTAL, INDEPENDENT, decisive) is centred on [337.5, 445]: s = 0.007, 107.5 px. That span fits
    the final 2.964 cm/px within 2.1 px.
  - 337.5 is the black wall face the arrow stops at. It is QUESTIONABLE [WEDGE_NOT_STROKE, COLOUR_MISMATCH] (κ 2.19,
    widths 7/6).
  - 354.5 is where the diagonals of the wardrobe symbol cross the line. It is a TICK [COLOUR_MISMATCH].
  - With the classes, PRIMARY = [354.5, 445]: 90.5 px, s = 0.086, qE 0 → 3.591 cm/px, **+21 %**.
  - In the sealed evidence, 3.59116 is that frame's selected hypothesis, the page vote has independentGroups 0, and
    `valueAmbiguity` names this ink.
  - With the classes stripped, PRIMARY = [337.5, 445], and the page vote is "kept on 1 independent reading".
  - The relation (LEGACY_UNCONFIRMED/INCONCLUSIVE) is the same either way. The frame is not Jabłonkach's selected
    frame.
  - Command: `npx vite-node .cache/review-a/detail.ts /home/user/work005d/m2/dom-w-jablonkach d2646b4dce 325`
- **The same mechanism produces wrong accepted scales on drawn sheets** (columns: with classes | stripped):

| case (`.cache/review-a/…`) | drawing | 005D | classes stripped |
|---|---|---|---|
| `s7.ts` | red room chain between two black wall faces (ends QUESTIONABLE: WEDGE ∧ COLOUR), one thin black furniture diagonal at 15 %, label centred | CONFIRMED/WEAK **+17.4 %** | REPLACED/WEAK, right |
| `s2.ts` S2b | 2-px line, ordinary ±4 px slash ends (QUESTIONABLE ONE_SIDED, P1-1), one dark crossing at 12 %, label centred | CONFIRMED/WEAK **+13.9 %** | REPLACED/WEAK, right |
| `sweep.ts` | as S2b; crossing at p·L, label offset 0 / 0.03 / 0.06 | CONFIRMED/WEAK at **+2…+19 %** (p ≤ 0.16), **+25 %** (0.03, p 0.2), **+34 %** (0.06, p 0.25) | right REPLACED, or an honest LEGACY_UNCONFIRMED/INCONCLUSIVE (except offset 0.06 at p 0.12–0.14, wrong in both: P1-2) |
| `s1.ts` S1b | 1-px line, size-3 slash ends (ONE_SIDED), crossing at 12 % | CONFIRMED/WEAK **+13.9 %** | REPLACED/WEAK, right |
| `s3.ts` short/no-label | real internal slash drawn smaller (ONE_SIDED), short last segment unlabelled; `1025` centred on [100, 510] | **REPLACED/WEAK −14.4 %** (label bound to the whole line, s 0.070) | CONFIRMED/WEAK, right |

- **First bad decision.** The comparator order in `primaryBinding`: (b) is applied beyond the centring margin, and B4
  exempts candidates whose qE differs. `beatsLegacy` then lets one overall-share WEAK reading replace a page vote that
  has no independent support (S3), or confirm a page vote that split at the same crossing (S1b/S2b/S7).
- **Contributing deviation from the contract.** §2.1 sets QUESTIONABLE ⇔ ¬REJECTED ∧ (LIGHTER ∨ ONE_SIDED ∨
  DUPLICATE ∨ STYLE) and says colour reasons "annotate only". The code adds `(WEDGE_NOT_STROKE ∧ COLOUR_MISMATCH)`
  (`dimension-lines.ts:544`, documented only in `docs/METRIC_EVIDENCE.md:142`). That clause demotes every wall-face end
  of a coloured room chain: 30 of the 81 QUESTIONABLE real ends below carry COLOUR+WEDGE. The Jabłonkach end is one of
  them.
- **Proposed generic fix.**
  1. Centring decides.
  2. Fewer questionable ends may override centring only toward a **longer, enclosing** span (skipping a doubted
     interior mark, the G2E planter case) and only within the ambiguity margin (Δs < 0.05).
  3. Any other eligible near-tie of distinct length is AMBIGUOUS, whatever its qE.
  4. Restore "colour annotates only".

  I simulated rules 1–3 on the sealed bindings of every run (`fixsim2.py`; Kosaćce clean and tracked both counted):
  825 unchanged, **1 fixed** (Jabłonkach `325`), **0 broken**. The other 70 changes all involve inks that fit nothing; most go from PRIMARY to AMBIGUOUS. G2E
  `1751` keeps [106.5, 730.5]: it encloses the planter span and Δs = 0.023. Add S2b, S3 and S7 as negative tests.

### P1-1 — ONE_SIDED is a rounding artefact on 2-px lines and on small ticks, so whole real chains become QUESTIONABLE

`rowOf(d) = Math.round(b + d)` (`dimension-lines.ts:388`). With t = 2 the baseline is k + 0.5. The rows above then
start 2 px past the line's top row, and the rows below start 3 px past its bottom row (JS rounds .5 up). A symmetric
slash reaching 4 px beyond the line therefore supports (3, 1) rows → ONE_SIDED (`s2.ts` S2a: both ends Q).

- A size-3 slash (±3) on a 1-px line, or a filled dot of radius 3, is also ONE_SIDED (rows 2,2; S1a, S2f).
- On a development house: on Żurawkach `…45095f59cd`, **every** mark of V20, V33 and H328 is QUESTIONABLE ONE_SIDED.
  They are real small slashes (κ ≈ 1, width 1, rows 2/3), not spurious ink.
  Command: `npx vite-node .cache/s5d/marks.ts …/dom-w-zurawkach/{source-package,observation-graph}.json <frame> V33`
- ONE_SIDED alone accounts for 16 of the 81 QUESTIONABLE real ends on the development houses, and is a reason on 43
  of them.
- **Consequences:**
  - It arms P0-1 on ordinary sheets: the S2b sweep needs nothing but a 2-px line.
  - It makes such overalls unable to be `OUTER_TOTAL` (`plan-extent.ts:232` requires TICK ends), so §2.5 silently
    does not engage on them.
- **Fix:**
  - Measure side rows from the line's own outer rows (top − d, bottom + d).
  - Judge ONE_SIDED relative to the support of the chain's own clean end marks, as STYLE_MISMATCH already does. A chain
    whose every tick is short is a drawing style, not doubt.

### P1-2 — Dark spurious marks still split a total; the fix only catches ink lighter than the line

REJECTED needs LIGHTER, so a darker leader, same-ink hatching, a furniture or wall line, or the slash of a crossing
chain is always a TICK, or at worst QUESTIONABLE.

- **Same-ink hatching near an end** (`s8.ts`, `s8d.ts`):
  - Three or five crossings in the first ~14 % push the outer span past `maxSkip = 2` (`:279`), so the true span is
    never a candidate.
  - The label binds PRIMARY, unambiguously, to [156, 579.5] (s = 0.062) → **REPLACED/WEAK +13.3 %** (+7.3 % with three
    crossings).
  - The result is identical with the classes stripped.
- **One dark crossing with the label 6 % off-centre toward the far end** (`sweep1.ts`; real offsets measured
  0.004–0.069): with TICK ends, crossings at p = 0.12–0.14 give **CONFIRMED/WEAK +13.9…16 %** in both variants.
  (With TICK ends and a centred label it holds; see §3.)
- **First bad decision.** `bindingsFor` counts every TICK toward `maxSkip`, so a cluster of crossings makes the
  centred outer span vanish instead of making the label AMBIGUOUS.
- **Fix:**
  - When the outermost-tick span is centred (s ≤ 0.10) but excluded only by `maxSkip`, mark the ink AMBIGUOUS.
  - Count crossings closer together than a label height as one skip.
  - A periodic run of ≥ 3 equally spaced, same-angle crossings → QUESTIONABLE. Pre-review A suggested this; it
    needs a test.

### P1-3 — Partial vs total: one extra mark on the total line disables the as-read conflict check, and a misread total keeps the scale even when the check fires

`dimensionHierarchy` builds TOTAL_OF only from **consecutive** marks of the total line (`metric-solution.ts:1216`).

- `s6.ts`, the §43 drawing: total `1400` over children `500`/`700`, truth 1200.
  - **Today:** CONFLICT_AS_READ → `undecidedConflict` → **CONFIRMED/INCONCLUSIVE with pooled 2.9226 (+16.9 %)**. The
    page vote follows the misread total, and the test asserts only the confidence.
  - **With one thin crossing on the total line at x = 470:** relations = [] and **REPLACED/WEAK +16.9 %**, the same
    with the classes stripped. The two correctly read children on the parallel line state 2.5 and are overruled by the
    tuple's "overall reading" key.
- The partial-promoted-to-total variant (S3 above, −14.4 %) is the same family, via P0-1.
- **Fix:**
  - Build TOTAL_OF from each as-read PRIMARY span of the total line, using its bound ends, which may skip marks.
  - A CONFLICT_AS_READ whose total is the registration's only decisive witness should not leave CONFIRMED anchoring
    the model. Reviewer D should check whether the resolver's T4 covers this.

### P2

- **P2-1 Lighter and short real ticks are REJECTED, and their labels lose their spans.**
  - `s2.ts` S2d: grey-110 size-3 ends on a black line → both REJECTED → LEGACY_UNCONFIRMED/INCONCLUSIVE, where
    stripped gives CONFIRMED/WEAK.
  - `s6.ts` S3r: the same as an internal tick → both labelled segments unbound.
  - No development house instance. The margin is thin, though: the lowest real κ is 0.77 against a threshold of 0.75
    (pre-review A).
- **P2-2 One dark pixel defeats LIGHTER.** κ is the darkest pixel on **either** side within the window, so a single
  dark pixel (a glyph, a hatch) beside a watermark edge prevents REJECTED. κw (weak side), which caught Azalia at
  0.30, only feeds FAINT_SIDE, an annotation.
- **P2-3 B5 tests only the along-axis extent of the label box** (`:265`), and treats marks inside it as free skips.
  - `s9.ts`: a `40` printed over a 16-px segment, with neighbours unlabelled, binds PRIMARY (s = 0.001) to the whole
    line → REPLACED/WEAK 0.0835 cm/px (−96.7 %).
  - The real pipeline's plausibility check would normally veto this, but `planScalePlausibility` can be undefined.
  - Fix: apply B5 only when the label box reaches the line's band, and count those marks toward `maxSkip`.
- **P2-4 `outerTotalSpans` accepts any PRIMARY observation**, in any orientation, independence or leading-zero state.
  It also requires TICK ends, so it fails on the Q-ended overalls of P1-1.
- **P2-5 Arrowhead terminators bias the mark position.** A mark that merges an extension line and an arrowhead sits at
  the merged run's centre (`s2.ts` S2g, +2.6 %). This predates 005D: the hit generator is unchanged.

## 2. Real development houses: marks that end READ/CC segments or fitting PRIMARY bindings (`realends.py`)

"Real end" means the end of a READ or CHAIN_CORRECTED legacy segment, or the end of a PRIMARY binding (decided
orientation, no leading zero) whose value fits the frame's final scale.

| house | TICK | QUESTIONABLE | REJECTED |
|---|---|---|---|
| Marcówki | 51 | 9 | 1* |
| Kosaćce clean | 45 | 9 | 0 |
| Modrzykach | 41 | 6 | 0 |
| Willa Miranda | 39 | 10 | 0 |
| Jabłonkach | 32 | 12 | 0 |
| Żurawkach | 32 | 10 | 0 |
| e-OZE (current) | 30 | 10 | 0 |
| G2E | 24 | 11 | 0 |
| Azalia | 20 | 2 | 0 |
| alt-Marcówki | 11 | 2 | 1* |
| Aster VIII, Galaktyka | — | — | — |

\* Neither REJECTED end is a tick. Marcówki `…863ec969ff` V568@299 is a watermark mark. alt-Marcówki V187@193.5
(κ 0.67, κw 0.19) bounds only a legacy CHAIN_CORRECTED segment.

- **Totals:** 325 TICK, 81 QUESTIONABLE, 2 REJECTED (408 real ends).
- **QUESTIONABLE reasons** (a mark can carry several): COLOUR+WEDGE 30 (18 alone), ONE_SIDED 43 (16 alone),
  STYLE_MISMATCH 10, DUPLICATE 6, LIGHTER 4.
- **Decisions:** across all 71 frames, stripping every class leaves relation, confidence and final scales (pooled,
  X, Y) **identical**. The selected hypothesis moves on 7 frames (5 houses). PRIMARY bindings that fit the final
  scale:
  - **lost 2:** Jabłonkach `325` (P0-1, decisive); G2E `…7d0192a519` V97 `52` (15 px, not decisive).
  - **gained 3:** Marcówki V568 `1260` on the base frame and on its copy; G2E V70 `850`.
- **Reread segmentation:** chains re-solved at a replaced scale differ on 6 REPLACED frames, and only in UNRESOLVED
  segments. I did not re-run reconstruction.
- **Azalia is not fixed by the classes.** With the classes stripped, its base frame still gives REPLACED/WEAK 1.897482,
  because centring alone rejects [204.5, 633] (s = 0.164). The classes change only that frame's reread segments and
  one junk binding (`717`).
- **Rule (b) on the development houses:** it overrode a better-centred candidate for 50 inks (`override.py`, Kosaćce
  counted once). In none of them did rule (b) pick the span that fits the final scale. In one (Jabłonkach) the
  better-centred span it overrode was the fitting one. In G2E's case, the motivating one, the label is misread (`1751`)
  anyway.

## 3. What I tried that did not break it

- **Light marks:** watermark-like light wedges, one or two, anywhere on the line, plus the §41 imagings, are REJECTED,
  and the total keeps its outer ticks.
- **Dark crossing, TICK ends, centred label:** with a crossing at p ≥ 0.12 the result is the right REPLACED. With p
  between 0.04 and 0.10 it is AMBIGUOUS → LEGACY_UNCONFIRMED/INCONCLUSIVE, which is honest (`sweep1.ts`).
- **End styles:** heavy short bars, arrowheads at extension lines, and grey-110 normal-length ticks (QUESTIONABLE but
  with no TICK rival) all give the right scale (`s2.ts`).
- **Internal marks:** an internal stop 4 px wide stays a TICK; a DUPLICATE stub beside an internal tick leaves the
  segment bound right (`s3.ts`).
- **A labelled neighbouring segment always protects.** A span cannot cross the next label, so S3 with `175` present
  and S9 with every segment labelled read right.
- **Isolation:** a spurious mark on one line never demotes ticks on another line (as the suite also shows).

## 4. Verdict

| question | verdict | basis |
|---|---|---|
| Spurious-tick fix | **Partial.** It works for ink lighter than the line, and Azalia's watermark is REJECTED. Dark spurious marks are TICKs by design; they still split totals through hatch clusters over `maxSkip` and through off-centre labels (P1-2), and through Q-ended chains (P0-1). On the development houses the classes changed no decision; Azalia is fixed by centring. | §1 P0-1, P1-2; §2 |
| Real-tick preservation | **Fail.** 0 real decisive ends are REJECTED, but 81 of 408 real ends are QUESTIONABLE (half-pixel ONE_SIDED, colour+wedge against the contract). Rule (b) turns that into a wrong decisive binding on Jabłonkach (+21 %) and wrong CONFIRMED/REPLACED scales on drawn sheets (−14 … +34 %) that the class-blind binding gets right. | P0-1, P1-1 |
| Partial vs total safety | **Fail (P1).** A partial label can be promoted to the whole line (S3, −14.4 %). One extra mark on the total line removes the TOTAL_OF conflict, and a misread total then replaces the scale (+16.9 %). Even with the conflict detected, the final scale stays the misread total's (CONFIRMED/INCONCLUSIVE). | P0-1, P1-3 |
