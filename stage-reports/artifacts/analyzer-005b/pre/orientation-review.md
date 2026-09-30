# 005B precheck, Reviewer A: dimension graphics and OCR orientation

**Scope.** Code that detects dimension text, crops glyphs, rotates crops, classifies digits, corrects readings
and binds text to a chain. Read-only review. The only file written is this one.

**Code basis.** `HEAD` is `bdacd42`. For `packages/source-metrics`, `source-common`, `source-cv` and
`synthetic-drawings`, `git diff --stat 56ca1e3a HEAD` is empty, so the code at `HEAD` is the code that produced
the sealed holdout evidence. All `file:line` citations are to `HEAD`.
- During this review the working tree picked up **uncommitted edits by another party** to `ocr.ts` and
  `chains.ts`: an `INVERTED` pass, `raw`, `vote`, `textAxisOf`. They are not audited here.
- Every experiment below was re-run against a `git archive HEAD` copy kept outside the repository, and gave the
  same results.

**Evidence.**
- Sealed files: `stage-reports/artifacts/analyzer-005a/holdout/h{1,2}-*/{metric-evidence,observation-graph}.json`
  and `plan-diagnostics/digest.json`. No rasters are available.
- Synthetic experiments called the pure functions `readNumbers` and `classifyCell` on `synthetic-drawings`
  `Canvas` rasters.
- No pipeline run was made.

**Orientation is measurable from the sealed tokens.** 005A called it "not measured", but it can be recovered.
- The token id is `stableId('ocr', slug, {frameId, box, text, orientation})` (`extract.ts:154`).
- Re-hashing each sealed token with each of the three orientations matches **exactly one** of them for
  **1321/1321** tokens (h1) and **874/874** (h2).
- Every orientation stated below was recovered this way.

---

## Findings

Severity: **P0** directly caused the holdout failures, **P1** blocks a correct fix or its audit, **P2** is
hygiene.

1. **P0: the right-way reading is deleted before any chain sees it** (`ocr.ts:815-852`, called at
   `ocr.ts:926`). `dedupeOrientations` keeps one reading per ink, and does so by glyph-match merit only. Two
   paths, both measured:
   - **(a) The page-wide vote** (`ocr.ts:833-840`).
     - On h2 frame `7102a805c6`, the plan copy the resolver selected (`digest.selectedPlanFrameId`), **0 of 39
       rotated survivors are `ROTATED_CW`**. Every right-way reading of the left-margin chain 245/920/245/1410
       was discarded unconditionally.
     - The sibling copy `c2d04897b9` holds the same margin ink: its `0111` and `535` tokens have identical boxes
       and scores. It kept 20 CW / 22 CCW. Its CW readings `205` and `420` bound to chain@69.5 and were
       corrected to 245 and 920 at the right scale.
     - So the same ink got opposite outcomes on two copies of one drawing.
   - **(b) The per-token clash** (`ocr.ts:839-849`).
     - On h1 frames `d80b709d74` and `a80195dc44` no page loser fired: both passes survive. Upside-down CCW
       `006` (merit 0.668) and `002` (0.543) won their clashes.
     - No token in h1 reads `900` or `380`, and none in h2 reads `1410`, `920` or `245`.
2. **P0: merit cannot decide 0° against 180° for labels made of {0,1,6,8,9}.** Merit is
   `score × confidence × glyphCount` (`ocr.ts:816`).
   - Under the templates, `0` turned 180° is `0` at an identical score, and `6` and `9` swap at 0.69/0.70 both
     ways (Measurements, M6).
   - The comment at `ocr.ts:804-808` ("a mirrored five is a poor five, and the score says so") holds only for
     2, 3, 4, 5 and 7.
   - Synthetic test, in a typeface other than the templates: isolated labels printed bottom-to-top were kept
     **upside down in 14/96 renderings**.
     - `900 → 006` in 5 of 8 settings.
     - Labels made only of {0,1,6,8,9}: 9/48. Other labels: 5/48.
3. **P0: the page vote is decided by ink that is not dimension text, and deletes every token of the losing
   direction**, including tokens that nothing else claims (`ocr.ts:840`).
   - Sealed survivors: only **2.3-6.9 %** of rotated merit sits on any chain. **65-79 %** of rotated tokens
     have 1-2 glyphs.
   - A synthetic sheet with 5 labels bottom-to-top and 3 top-to-bottom returns the three minority labels upside
     down (`502`, `026`, `502`) and loses `1410`. A 6:2 split does the same. A 4:4 split reads correctly.
4. **P0: orientation errors lie outside the correction lattice, so the chain solver launders them**
   (`parse.ts:130-178`, `chains.ts:700-723`, `chains.ts:776-788`).
   - `readingLattice` only substitutes glyphs position by position. It can never reverse the order or turn the
     glyphs, so an upside-down reading can only be "fixed" into a *different* number that fits the imposed
     scale.
   - Example: `006 → 806`. No glyph of `006` has `9` among its alternatives, so `900` was unreachable.
   - **Every chain value that came from a CCW token is `CHAIN_CORRECTED`**: 7/7 on h1 and 4/4 on h2. No CCW
     token was ever `READ`.
5. **P0: the witness is circular, and a clean cross-axis `READ` was overruled** (`chains.ts:580`,
   `chains.ts:630`, `extract.ts:775`).
   - On h1 `d80b709d74`, all **6/6 registration anchors are `CHAIN_CORRECTED`**.
   - The clean horizontal `1100` (`READ`, 0 substitutions) sits on chain@828 over 519 px (2.119 cm/px). That
     chain was left "no number on this chain could be reconciled with the sheet scale" (1.892).
   - Counterfactual arithmetic:
     - The right-way readings give 900/426 = 2.113 and 380/180.5 = 2.105, alongside 1100/519 = 2.119.
     - All three lie within the 2.2 px tolerance of 2.114, on 2 chains. That meets `decideScale`'s rule of at
       least 3 numbers on at least 2 chains.
     - The scale is plausible: a 22 px wall becomes 0.47 m.
     - So the orientation error removed exactly the two corroborators the true scale needed. The end-to-end
       effect is **not measured** (no raster).
6. **P1: integer strings with leading zeros are accepted** (`parse.ts:106-111`).
   - `006` parses as 6 cm, `0111` as 111, `036` as 36 and `002` as 2.
   - The lattice also produces leading-zero outputs and the solver accepts them. On h1, `012 → 037` became a
     0.37 m registration anchor. On h2, `014 → 074`.
   - Of the rotated leading-zero tokens near vertical chains, **13 of 14** also break the placement convention
     (finding 11, and M5).
7. **P1: the raw reading is overwritten in `rawText`.** `extract.ts:744` writes the *corrected* text.
   - The schema says otherwise: `rawText` is "Exactly what the reader saw" (`schema.ts:213`), and for
     `CHAIN_CORRECTED` "the original reading survives in `rawText`" (`schema.ts:77`).
   - Measured: the rule is broken by **22/22** (h1) and **21/21** (h2) of the `CHAIN_CORRECTED` linear evidence.
   - The level-ladder path keeps the raw text (`extract.ts:531`), so the two correction paths disagree.
8. **P1: the chain's "own scale" is imposed from outside the chain.**
   - `chain.scale` is documented as "implied by the chain's own readings" (`schema.ts:287`). It is in fact the
     frame or axis `fixedScale` (`chains.ts:630`, `chains.ts:814`).
   - So "the chain's scale endorses 806" (`extract.ts:757`) is false. That chain's only read segment is the
     corrected label itself (`readSegments: 1`).
   - `closes` is `true` (`extract.ts:793`), although no printed total exists (`schema.ts:289`) and the other
     segment is `DERIVED` from the same scale.
9. **P1: a printed label that was rejected is recorded as "nothing is printed", and then orphaned.**
   - `segment.token` is set only when a reading is chosen (`chains.ts:776-779`), and the `DERIVED` fill checks
     that field (`chains.ts:802`).
   - `extract.ts:732` then writes "nothing is printed on this span". The token is never added to `usedTokens`,
     so it is listed as "not on a dimension line" (`extract.ts:589-598`).
   - Measured: 6 such segments on h1 and 7 on h2. They include h1's `002` span (180.5 px, `DERIVED` 341.5) and
     h2 `c2d04897b9`'s bottom 245 over the printed `535`.
10. **P1: `OcrToken` does not record orientation or the rival reading** (`schema.ts:113-130`, `toOcrToken`
    `extract.ts:156-168`).
    - Tokens dropped by the dedupe and the page-vote totals are not sealed at all.
    - Two downstream consumers treat `token.text` as what was printed: `plan-resolution.ts:169`, whose
      `/^\d{2,5}$/` accepts `006`, and `v2/reconstruct-v2.ts:595`.
11. **P1: binding to a chain knows neither the text side nor a shared direction.**
    - A vertical chain accepts CW and CCW tokens mixed together (`chains.ts:206`).
    - The offset is taken as an absolute value (`chains.ts:209`), so which side of the line the text sits on is
      discarded.
    - That side is the cheapest orientation cue there is (M5).
12. **P1: the tests cannot see this defect.**
    - Only bottom-to-top text is exercised: `ocr.test.ts:32-50`, `chains.test.ts:126-142`, `house.ts:266`.
    - The dedupe test asserts one token per ink "whatever it decides the characters are" (`ocr.test.ts:47`),
      so it checks neither the text nor the orientation.
    - `Canvas.text` supports only `'NONE' | 'CW'` (`canvas.ts:61`).
    - There is no top-to-bottom test, no both-ways test, no test of a label made of {0,1,6,8,9}, and no 180°
      metamorphic test.
13. **P2: there is no 180° pass for horizontal text** (`ocr.ts:98`, `ocr.ts:900`).
    - Upside-down horizontal text comes back as unflagged `HORIZONTAL` junk.
    - The horizontal pass also cross-reads vertical labels as sideways glyph runs. On h1 `0c491c2999`,
      `9110`/`5911`/`150` at h7 are examples. These compete in the dedupe clash.
14. **P2: `unrotateRect` is off by one** (`ocr.ts:875`, `ocr.ts:879`).
    - It uses `H−rx` and `W−ry` where the inverses are `H−1−rx` and `W−1−ry`.
    - Glyph boxes use an exclusive end (`ocr.ts:1034-1035`). On the sealed `006`, the token starts at x0 763 and
      its glyphs at 762.
15. **P2: token boxes snowball in `groupTokens`** (`ocr.ts:588-596`).
    - The merged box's height widens the tolerances for the next blob, so a token can keep growing.
    - 40/1321 (h1) and 25/874 (h2) sealed tokens exceed the glyph cap of 0.06 × the raster edge. Their
      containment test can suppress the other orientation's tokens.
16. **P2: the orientation names describe the page, not the text.**
    - `ROTATED_CW` means the *page* was turned clockwise, so the text itself was set counter-clockwise (reading
      bottom to top).
    - `Canvas` `'CW'` follows the same naming (`canvas.ts:93-98`). Hypotheses should be named by reading
      direction.
17. **P2: ring callouts are marked `READ` even when their value is a substitute.**
    - The value can be an out-of-range fallback or a runner-up from the shortlist (`callouts.ts:838-871`,
      `extract.ts:477-480`).
    - The ring carries `ocrTokenIds: []`, and the raw halves survive only in the prose. Rings are read upright
      only.

---

## Measurements (sealed JSON; orientation recovered from the id hash)

**M1. Surviving rotated tokens on plan frames** (count and Σ merit, after the dedupe).
- A frame with only one vertical pass surviving is one where the page vote fired.
- The pre-dedupe totals, which are the actual vote, are **not measured**. Post-dedupe totals are not the vote:
  on h1 `d80b709d74` they stand at 7.01 against 5.28, yet both survived.

| house | frame (asset) | H | CW | CCW | CW Σmerit | CCW Σmerit |
| --- | --- | --- | --- | --- | --- | --- |
| h1 | `d80b709d74` (rzut-a8bd…, selected) | 45 | 19 | 16 | 7.01 | 5.28 |
| h1 | `a80195dc44` (rzut-07bd…) | 35 | 16 | 22 | 3.75 | 6.37 |
| h1 | `d2646b4dce` (rzut-d52f…) | 35 | **0** | 30 | 0 | 10.29 |
| h2 | `7102a805c6` (rzut-73ee…, selected) | 30 | **0** | 39 | 0 | 12.72 |
| h2 | `c2d04897b9` (rzut-891a…, same margin ink) | 30 | 20 | 22 | 6.62 | 6.40 |
| h2 | `1ac18b4545` (rzut-dac3…) | 29 | 31 | **0** | 6.80 | 0 |

**M2. The named misreads.** All are `ROTATED_CCW`, and all sit **left** of their dimension line.
- The notation `c:s/c` means character, score and confidence. "alts" lists the runner-ups with their scores.

| token (house, frame) | box x0-x1 × y0-y1 | h px | score | conf | shear° | merit | glyphs `c:s/c` (alts) | line |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `006` (h1 `d80b709d74` = `a80195dc44`) | 763-776 × 446-465 | 14 | 0.407 | 0.546 | −13.5 | 0.668 | 0:.670/.663 (4 .341, 8 .205); 0:.759/.735 (8 .274, 4 .258, 6 .233); 6:.407/.546 (0 .338, 8 .290, 5 .245) | V@780.5, span 237-663 (426 px); → **806** CC, conf 0.142 |
| `002` (h1, same frames) | 763-776 × 142-162 | 14 | 0.315 | 0.575 | −13.5 | 0.543 | 0:.808 (4, 8, 5); 0:.315 (1, 9, 5); 2:.407 (**3** .301, 5 .299, 7 .276) | V@780.5, span 56.5-237 (180.5); rejected, then `DERIVED` 341.5 |
| `006` (h1 site `9a28602a7f`) | 77-98 × 444-482 | 22 | 0.385 | 0.586 | −10.2 | 0.677 | 0, 0, 6 (0 .272) | unbound |
| `0111` (h2 `7102a805c6` = `c2d04897b9`) | 19-32 × 338-363 | 14 | 0.260 | 0.505 | −6.8 | 0.525 | 0:.537 (4 .264); 1:.288 (/, 7); 1:.260 (5 .254, 3 .240, 7 .240); 1:.464 | V@35, 84.5-610.5 (526 px); unbound |
| `036` (h2 `7102a805c6`) | 54-66 × 340-359 | 13 | 0.320 | 0.510 | −6.8 | 0.490 | 0:.613 (4, 8); 3:.395 (1 .380, 5 .376, 7 .375); 6:.320 (8, 5, 0) | V@69.5, 176-519 (343); unbound |
| `502` (h2 `7102a805c6`) | 54-66 × 122-142 | 13 | 0.313 | 0.510 | −6.8 | 0.479 | 5:.523 (3 .477, 1 .420, 2 .387); 0:.313 (4); 2:.368 (5 .353, 3, 7) | V@69.5, 84.5-176 (91.5); unbound |
| `535` (h2 `7102a805c6` = `c2d04897b9`) | 54-66 × 557-577 | 13 | 0.338 | 0.529 | −10.2 | 0.537 | 5:.431 (1, 3, 0); 3:.338 (5, 7, 2); 5:.424 (3, 1, 7) | V@69.5, 519-610.5 (91.5); on c2d0, `DERIVED` 245.41 |

**M3. Is the right-way reading sealed anywhere?**
- `900`, `380`, `1410`, `920` and `245` appear in **no** sealed token of either house.
- Right-orientation rivals exist only on h2 `c2d04897b9`:
  - CW `205` (53-65 × 123-143, merit 0.543) beat CCW `502` (0.479). It was then CC → 245.
  - CW `420` (merit 0.663) beat CCW `036` (0.490). It was then CC → 920.
  - The CW readings of 1410 and of the bottom 245 lost, with merit below 0.525 and 0.537 respectively. Their
    exact values are **not measured**.
- Even the right-way glyphs are imperfect: 4 was read as 0, and 9 as 4.

**M4. The expected strings follow the 180° template map (M6).**
- 900 → reversed 0,0,9′ → `006`, as observed.
- 380 → 0, 8′→0, 3′→2 → `002`, as observed.
- 920 → 0, 2′→2 or 3, 9′→6 → `026`/`036`. Observed `036`.
- 245 → 5′→2 or 5, 4′→0, 2′→2 or 3 → `502`, as observed. `535` is a partial match.
- 1410 → 0, 1, 4′→0, 1 → `0101`. Observed `0111`, where 4′ was undecided.

**M5. Which side of its nearest vertical chain a rotated numeric token sits on** (2-4 digits, within 2.2
heights of the line).
- The convention holds when CW text sits left of the line and CCW text right of it.
- h1: 9 break the convention with a leading 0, 11 break it without one, and 19 keep it without one.
- h2: 4 break it with a leading 0, 12 break it without one, 1 keeps it with a leading 0, and 9 keep it without
  one.
- All seven named misreads break the convention. The right-way `205` and `420` keep it.

**M6. `classifyCell` on digits turned 180°.** Each entry reads "turned digit → result, score". The first row
uses the reader's own templates. The second uses the synthetic typeface.

| template | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| reader (self) | 0, 1.00 | 1, 0.34 | 2, 0.52 (3 .50) | 2, 0.47 | 0, 0.29 | 2, 0.44 (5 .42) | **9, 0.69** | /, 0.32 | 0, 0.37 (9 .36) | **6, 0.69** |
| synthetic face | 0, 0.59 (= upright) | 1, 0.43 | 2, 0.59 | 2, 0.50 | 0, 0.31 | 5, 0.43 | 9, 0.60 | /, 0.48 | 9, 0.32 | 6, 0.41 |

**M7. Synthetic `readNumbers`**, in the synthetic face, on a 420 px page. Caps of 11, 13, 16 and 20 px, slant 0
and 0.18.
- Kept upside down: **14/96**. The flips were:
  - `900→006` in 5 of 8 settings, and `600→009` ×2;
  - `1016→9101` and `1016→4101`;
  - `1260→0921` and `1260→0925`;
  - `750→05/`, `920→026` and `1410→0151`.
- `900` against `006`: the ratio of CCW merit to CW merit ranged 0.86-1.65, and stayed within ±15 % in 7 of 8
  settings.
- Both-ways sheets: finding 3.

**M8. Evidence origins.**

| | h1 | h2 |
| --- | --- | --- |
| linear `READ` / `CHAIN_CORRECTED` / `DERIVED` | 8 / 22 / 66 | 9 / 21 / 52 |
| `READ` from a CCW token | 0 (0 of 7 CCW-sourced) | 0 (0 of 4 CCW-sourced) |
| registration anchors, `READ` / `CHAIN_CORRECTED` | 6 / 22 | 11 / 20 |
| CC corrections from or to a leading zero | `012→037`, `051→431`, `006→806`, `000→400` | `000→480`, `014→074` |
| `DERIVED` segments with a printed, rejected reading | 6 | 7 |

**Not measured.**
- The pre-dedupe tokens and vote totals.
- The rival merits for `006`, `002`, `0111` and the bottom `535`.
- How the real ARCHON typeface behaves under 180° (no rasters).
- The end-to-end effect of right-way readings on the scale and the extent (finding 5 is arithmetic only).

---

## Answers

**Q1. Which rotations are tried?**
- Three passes: `HORIZONTAL` (0°), `ROTATED_CW` and `ROTATED_CCW` (`ocr.ts:98`, `ocr.ts:900`).
  - `ROTATED_CW` turns the page 90° clockwise (`ocr.ts:855-868`). It reads text printed **bottom-to-top** the
    right way up; that is the ISO convention and what ARCHON prints.
  - `ROTATED_CCW` turns the page counter-clockwise. It reads **top-to-bottom** text the right way up.
- There is **no 180° page pass**.
- For any vertical ink, the CW and CCW passes are a **0°/180° pair**. Exactly one reads the label the right way
  up, and the other reads the same ink with the glyph order reversed and each glyph turned half a turn.
- The horizontal pass also reads that ink, as sideways glyphs.

**Q2. How is text direction inferred?** Only by `dedupeOrientations` (`ocr.ts:815-852`), once per raster.
1. `merit = minGlyphScore × minGlyphConfidence × glyphCount` (`ocr.ts:816`).
2. `cw` and `ccw` are the Σ merit of every pre-dedupe token of that orientation on the raster, junk included
   (`ocr.ts:833-835`).
3. `losing` is CCW if `cw > 1.1·ccw`, CW if `ccw > 1.1·cw`, and otherwise none (`ocr.ts:836`).
4. Every token of the losing orientation is **dropped without condition** (`ocr.ts:840`).
5. The rest are sorted by merit, descending, with ties broken by x0 then y0 (`ocr.ts:839`). A token is dropped
   if an already kept token of **any other** orientation, `HORIZONTAL` included, has IoU > 0.4 with it, or
   covers more than 0.6 of its area (`ocr.ts:848`).
   - Tokens of the same orientation never clash.
   - Nothing about the drop is recorded.

On a sheet whose vertical text runs both ways:
- If the Σ merits differ by more than 10 %, every label of the minority direction is deleted. Its upside-down
  reading from the winning pass then survives unopposed, so those labels come back upside down.
- Otherwise each clash is decided by merit, which is a coin toss for labels made of {0,1,6,8,9}.
- Both paths are reproduced synthetically (finding 3).

**Q3. How can `900` become `006`?** The label is printed bottom-to-top, left of line x = 780.5.
1. The CCW pass sees it turned 180° and reads `006` (the 9 becomes a 6, the 0s stay 0).
2. With symmetric digits, the template scores of the two readings are equal in expectation (M6). The CCW
   reading won its clash at merit 0.668 (finding 1b).
3. `006` parses as 6 cm (`parse.ts:106-111`).
4. `readingLattice` substitutes glyph 0's runner-up `8`, with penalty 0.205/0.670 = 0.307, to give `806`.
   - 806/426 lies 0.004 px from the imposed 1.892003 cm/px.
   - The result is `CHAIN_CORRECTED`, with confidence 0.546 × 0.307 × 0.85 = 0.142 (`chains.ts:786-788`).

The h2 strings follow the same map (M4). The measured quantities are in M2, M3 and M8.

Why merit favours the wrong turn:
- the symmetry of 0, 1, 6, 8 and 9 under a half turn;
- `min` aggregation, which lets one weak glyph decide the whole token;
- glyph count, which rewards whichever pass fragments more;
- a page vote dominated by junk (finding 3);
- the ARCHON typeface differing from the templates (**not measured**).

**Q4. Can glyph geometry separate 0° from 180°?** Only partly. The table is ordered by evidential strength.

| cue | kind | scale-free | separates 0/180? |
| --- | --- | --- | --- |
| Chain arithmetic: Σ parts = overall on stacked chains, v_i/v_j = px_i/px_j, equal spans carry equal values | arithmetic fact | yes | **Yes.** 245+920+245 = 1410 ✓, while 502+36+535 ≠ 111. 900/380 = 2.37 against 426/180.5 = 2.36 ✓, while 6/2 = 3 ✗ |
| Cross-axis scale from the *other* axis's `READ` values | sheet fact: one scale, anisotropy ≤ 5 % | yes, relative to the hypothesis | **Yes.** 1100/519 matches 900/426 and not 6/426 |
| Placement: the text sits on the side of its line that its glyph tops face (ISO 129 "above the line") | drafting convention | yes | Yes when present (M5); neutral when the text sits in a gap in the line |
| No leading zero in an integer cm label | numeral convention | yes | Strong: the 180° reading of any label ending in 0 starts with 0 |
| Glyph asymmetry: 2, 3, 4, 5, 7 have no digit image under 180°; 6↔9; hole height (8's smaller top loop, 4) | geometric, depends on the typeface | yes | Only for labels containing {2,3,4,5,7}; **none** for {0,1,6,8,9}* |
| Comma or degree sign position relative to baseline and cap line | typographic fact | yes | Yes, but rare on cm chains |
| Direction of vertical text (bottom-to-top) | convention (ISO 129) | yes | A prior only; it fails on both-ways sheets |
| Italic shear sign | geometric fact | — | **No.** A shear is invariant under a half turn |
| Reading order along the chain | — | — | **No.** Page positions do not change, and neither does the span a label binds to |

**Q5. Where values are replaced after OCR.**
1. `dedupeOrientations` (`ocr.ts:815-852`) replaces one reading of the ink with its rival. **Nothing of this is
   sealed.**
2. `readingLattice` (`parse.ts:130-178`) and `solveChain` (`chains.ts:700-723`, `chains.ts:776-788`) produce
   `CHAIN_CORRECTED`.
   - `rawText` is the corrected text (`extract.ts:744`).
   - The original survives in the `OcrToken`, in `alternatives[0]` (confidence 0.2) and in the prose
     `provenance.detail`.
3. The `DERIVED` fill over a rejected printed label (`chains.ts:800-807`): the token is not cited and
   `rawText` is `''` (finding 9).
4. The level ladder (`registration.ts:291-392`, `extract.ts:500-551`): the value is replaced and `rawText` is
   kept. There were 0 such corrections on either holdout.
5. The ring callout fallback and shortlist (`callouts.ts:838-871`, `extract.ts:477-480`): the result is `READ`,
   the prose keeps the raw halves, and there are no tokens.
6. `parseAlternatives` (`extract.ts:688-702`) only lists runner-ups and replaces nothing.
7. `parseNumber` normalises `006` to 6. Downstream, `plan-resolution.ts:169` does the same.

**Q6. What can a later diagnostic recover from a `CHAIN_CORRECTED` segment?**
- **Raw text:** yes, through `ocrTokenIds` → `text`, but `rawText` itself is wrong.
- **Orientation:** only by the accident of the id hash.
- **Substitution:** no. Which glyph, from what to what, and at what penalty are not recorded.
- **The evidence used:** partly. The chain id and the chain's scale are present, but not that the scale was
  imposed (`fixedScale`), which numbers or chains produced it, the `decideScale` override (prose in
  `unresolved` only), or that the co-anchors were themselves corrected.
- **Scale dependence:** implicit and never flagged. Anchors carry no origin.
- **Missing from `OcrToken`:**
  - the orientation or reading direction;
  - an orientation-group id and the rival reading, with its text, scores and merit;
  - the dedupe outcome and its reason;
  - the frame vote;
  - per-glyph holes (computed at `ocr.ts:524`, dropped at `extract.ts:167`);
  - per-glyph `relTop`/`relHeight`;
  - the parse flags, such as a leading zero.

**Q7. Design:** see the contract below.

---

## Recommended contract

1. **The OCR layer reads and never chooses.** Replace the deletion in `dedupeOrientations` with grouping.
   - Build **orientation groups**: union-find over rotated tokens from different passes, reusing the existing
     IoU > 0.4 / containment > 0.6 test as the *grouping* rule.
   - Validate a pair by reversed glyph order: CW glyph i against CCW glyph n−1−i, with centres within 2 px.
   - Each group carries **at most 2 hypotheses**.
     - Vertical: `BOTTOM_TO_TOP` (the CW pass) and `TOP_TO_BOTTOM` (the CCW pass).
     - Horizontal: `UPRIGHT`. An optional `INVERTED` may be added only as a rejection flag, never as a source
       of a value.
   - A hypothesis may be made of at most 4 fragments.
   - Horizontal-pass cross-reads of vertical ink are attached as `crossReads`, not as competitors.
   - The legacy choice and the frame vote may be sealed as *priors*.
2. **Cheap flags go on hypotheses, with no deletion.** Each hypothesis carries:
   - `leadingZero`, whereupon `parseNumber` refuses a leading-zero integer as a cm dimension;
   - `placement`, set at binding: `WITH`, `AGAINST` or `UNKNOWN` convention;
   - `punctuationInverted`;
   - `glyphEvidence`, which is `NONE` when both readings lie in {0,1,6,8,9}\*, and otherwise the score margin
     on the asymmetric glyphs.
   - Shear is declared uninformative.
3. **The chain decides, once per chain.** A vertical chain binds groups, not tokens.
   - Its orientation state `s ∈ {B2T, T2B}` is shared by all its labels, and by stacked chains that share both
     end ticks.
   - That gives **2 states per chain or margin**. There is no enumeration over every label.
   - Lattice substitutions (at most 24 strings and at most 2 substitutions, as today) run **inside** one
     hypothesis only.
   - A substitution never repairs an orientation.
4. **Evidence order, scale-free first.**
   1. Closure between stacked chains.
   2. Ratio consistency.
   3. Equal spans carry equal values.
   4. The cross-axis scale, from the other axis's **0-substitution `READ`** values only, leaving the chain
      under decision out, within 5 % anisotropy.

   Priors break ties only, in this order: placement, then grammar, then glyph asymmetry, then the frame
   majority.
   - If evidence 1-4 is silent or split, the chain is `ORIENTATION_AMBIGUOUS`.
     - Both hypotheses are sealed.
     - Neither value becomes an anchor.
     - No correction is applied.
   - **Never judge an orientation by its fit to a scale that includes the label under test.**
5. **Sealing** needs a schema version bump.
   - On `OcrToken`: `orientation` and `orientationGroupId`.
   - `orientationGroups[]`, holding the hypotheses and their flags.
   - On evidence: `rawText` set to the token text exactly, plus `chosenText`,
     `substitutions[{glyph, from, to, ratio}]`, and `orientationDecision{chosen, rejected, basis[],
     scaleDependent, scaleSource}`.
   - Anchors carry their origin.
   - Downstream readers of `token.text` (`plan-resolution.ts:169`, `reconstruct-v2.ts:595`) read the chosen
     hypothesis.
6. **Anti-patterns, all refused:**
   - a string table such as `006→900` or `0111→1410`;
   - a "reverse and swap 6↔9" substitution added to `readingLattice`;
   - hard-coding "vertical text is bottom-to-top", or dropping the CCW pass;
   - tuning the 1.1 margin or the merit weights until the two holdouts pass;
   - "leading zero, so flip the string";
   - choosing an orientation by fit to the pooled scale (the `806` loop).
7. **Tests.**
   - `Canvas` gains `'CCW'` and `'180'`.
   - Isolated labels {900, 600, 1100, 1016, 180, 380} at caps of 11-20 px, slant 0 and 0.18, must come back
     right or `AMBIGUOUS`, never upside down with a value.
   - Both-ways sheets at 5:3 and 6:2.
   - The chain 245/920/245 with an overall 1410, all with no corrections.
   - An h1-like sheet: a vertical 900 and 380 with a horizontal `READ` 1100 at one scale.
   - A single symmetric label with no cross evidence must be `AMBIGUOUS` and produce no anchor.
   - Metamorphic: turning the whole raster 180° leaves every vertical label's value unchanged.
