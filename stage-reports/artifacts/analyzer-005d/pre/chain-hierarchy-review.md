# 005D pre-review C — chain hierarchy and the overall (total) role

Reviewer C, read-only. Runs: `run-row.sh` at HEAD `1b66eb9` for marcowki, kosacce-clean, rarytasy-g2e,
dom-w-jablonkach, willa-miranda, dom-w-zurawkach, dom-w-modrzykach (outputs in `/home/user/work005d/rev-c/`); Azalia
and e-OZE current from `/home/user/work005d/base/`. Probes (scratch, `.cache/rev-c/`): a span-level census of every
labelled chain on GROUND plan frames (labels from `dimensionObservations` in the decided orientation, boxes from
`ocrTokens`), and a per-mark geometry probe on the raster (perpendicular stub length each side, darkness of the mark
ink, diagonal lean, distance to the nearest mark). "Base frame" = the plan the resolver selected (Azalia: the
dimensioned ground copy `…86bef468f3`). Text and numbers only; crops stayed in `views-rev-c/`.

## 1. Verdict

The overall dimension is not lost to its number but to topology decided too early and never revisited. A mark is any
ink that crosses a dimension line (`findDimensionLines`), a tick is a bare position (`ChainTick.atPx`), and the page
vote binds every label to the gap between the two marks around it (`proposalsOf(…, maxSkip=0)`). On 2 of 9 houses
(Azalia, G2E) the overall horizontal label is bound to a span cut by a non-dimension mark, and the selected
hypotheses are 32 % and 26 % off (G2E's is outvoted by the page vote, Azalia's wins); on a third (Marcówki, area-table copy) the chain DP cuts a total at a watermark mark and rewrites
`1260`→`1160`. The hierarchy that could catch this (`chainRelations`) is computed after the scale, only for 2-mark
totals with both ends within 3 px, and its sum check uses scale-dependent values: 15/15 sealed sum checks that
"agree" rest on CHAIN_CORRECTED or DERIVED values; 0 are as read.

## 2. Findings

**P0-1 Azalia: the overall label is bound to a watermark-cut span, and the vote counts that ink against itself.**
Base frame, line y=645.5, marks [77, 204.5, 633]. Marks 77/633: stub 9/8 px each side, ink 124/115, lean `/`,
perpendicular stub present. Mark 204.5: stub 4/3, ink 211 (pale), lean `\`, no stub — the watermark vertex. Label
`1035` (read `1055`), box 333–364 (31 px wide): 6.5 px (0.21 label widths, 1.2 %) off the centre of 77–633, 70.2 px
(2.27 widths, 16.4 %) off the centre of 204.5–633. `spansFor` accepts both (centring tolerance 0.3·length = 128.6 px).
The vote (maxSkip 0) sees only 204.5–633 → 2.462 cm/px. The 005B solver ranks 1055/556 (1.8975, share 1.0) above
1055/428.5 (2.462, share 0.77) by the overall flag, but `legacySupport` counts the same text region bound to the
partial span as the vote's independent witness (1 group), so `beatsLegacy` needs an outright win one ink cannot give:
LEGACY_UNCONFIRMED WEAK at 2.462. The area-table copy repeats it (mark 205.5, 2.4678). The solved chain is
[77–204.5 DERIVED 313.9 cm][204.5–633 READ 1055]; `dimensionedAxis` trims the 127.5 px DERIVED stub (< ½·428.5),
so the dimensioned width drops from 556 to 428.5 px. Truth: 1035/556 = 1.8615, 670/359.5 = 1.8637.

**P0-2 G2E: the same failure, masked by the vote.** Total line y=781, true marks 106.5/730.5 (stub 6/6, `/`), three
non-dimension marks: 186.5 and 419.6 (planter foliage: no stub or a ragged one, ink 34–38, mixed lean) and 692 (a
drawing line: stub 7 above / 40 below, ink 176). Label `1720` (read `1751`) is printed 28 px (1.1 widths, 4.5 %) off
the true centre to clear a planter; the span between two foliage marks, 186.5–692, is centred within 7.2 px. The
true span skips 3 marks and is not an observation at all (`METRIC_BOUNDS.skippedTicks` = 2). Selected hypothesis:
3.464 cm/px from 1751/505.5 (truth ≈ 2.756: 1720/624, 1474/534.5, 850/308.5); the same ink also forms rivals
2.9906 (106.5–692) and 3.2188 (186.5–730.5). The vote's 2.7497 survives only as LEGACY_UNCONFIRMED WEAK. The chain DP
(≤3 skips) reads the total as 1721 CHAIN_CORRECTED. The segment line (196|688|836, y≈760, crossed by the planters)
is not detected, so no hierarchy exists on this axis.

**P1-1 Marcówki: the DP trades two skips for one substitution; the rival is the selected's own ink.** The V total
`1260` (line x=568, marks [259, 278.5, 300.5, 735.5]; 278.5/300.5 are watermark: ink 223–231 vs 108–126, no stub)
is READ over 259–735.5 on the dimensioned copy (scaleY 2.6434, miss 0.16 px). On the area-table copy scaleY is
refitted to 2.6555, the full-span reading misses by 2.01 of 2.2 px, and the DP prefers [259–278 DERIVED][278–299
DERIVED][299–735.5 `1160` CHAIN_CORRECTED] (×0.45 for one substitution against ×0.7² = 0.49 for two skips, plus 0.02
per empty span): a printed total rewritten to fit a watermark cut. Its children (510 READ, 751 corrected) sum to 1261
— the conflict is visible and unused. On the selected copy the "rival" that sets the 38 % contest is 1260/457 px
(2.7571), the same ink bound to 278.5–735.5; 1260/435 (2.8966) is a third hypothesis from it.

**P1-2 The hierarchy is post hoc, too narrow and noisy.** Across the 9 houses' metric evidence: 5,839 NESTED_IN and
74 TOTAL_OF relations; 404 NESTED_IN (6.9 %) join two labelled chains; 11 of the 60 plan frames with relations hit
the 200-relation cap; 15 TOTAL_OF join lines more than 60 px apart;
NESTED_IN has no baseline bound (furniture lines 500 px apart are "nested"). TOTAL_OF requires a 2-mark total whose
ends equal the parts' ends ±3 px, so it misses (a) a total over a sub-run (Marcówki 1260 = 510+750 inside
100|510|750|100), (b) a total carrying a stray mark (Azalia, G2E, Marcówki 1260), (c) a total that is a segment of an
outer line (Miranda: outer line 330|1500, the 1500 totals 800|700 — the only family on the 9 houses whose sum agrees
as read has no sealed relation). Sum checks: 15 sealed, 15 "agree", all 15 involve CHAIN_CORRECTED (13) and/or DERIVED (8)
values. `printedTotal` is never set; `closes` is a residual test. Nothing downstream reads `chainRelations`.

**P1-3 Child-sum checks are an OCR-error detector here, rarely a confirmer.** Span-level census, base frames,
exterior lines: 11 TOTAL_OF families (Marcówki 2, Kosaćce 2, G2E 1, Miranda 2, Żurawkach 2, Modrzykach 2). As read:
1 agrees (Miranda H 1500 = 800+700), 7 conflict, 3 incomplete (a child unlabelled or unbound). In the 7 conflicts a
child is misread in 6 and the total in 3 (Kosaćce H and G2E V both). After correction 5 "agree" (Marcówki 1205/1261,
Żurawkach 950, Modrzykach 1161, Kosaćce 1658 with a DERIVED child) — agreement manufactured by the scale.

**P1-4 One mark is detected twice.** A slash and its perpendicular stub give two positions 6.5–7.5 px apart: e-OZE V
230/236.5, Marcówki 221/228.5 and 735.5/742. The arm detection has no stub (0/0); the stub one is the mark.
They produce 6.5 px segments (DERIVED 14–17 cm) and extra spans for every label. Detection centroids also sit up to
3 px off the stub (Jabłonkach 602.5 vs 605).

**P1-5 A single outer reading is one witness, whatever its share.** e-OZE 550 px copy: `1600` read `1011`, 1 group,
share 1.0 → REPLACED WEAK at 2.1789 (truth 3.448, −37 %). Jabłonkach: `1100` READ, 1 group → REPLACED WEAK 2.1195
(right; 900/426 = 2.113). Same standing, opposite truth: an OUTER role must not raise a lone witness above WEAK.

**P2** — skip caps disagree (vote 0, observations 2, DP 3); the overall share is relative to the longest chain on
the axis, junk lines included; label centring 0.3·length is over 4× looser than measured (true spans: 33 READ segments
on STRONG/SUPPORTED frames, offset median 2.5 px, max 6.2 px = 0.25 widths = 6.9 %; one deliberate exception,
the G2E total, 1.1 widths); the
same drawing at another raster size (e-OZE 853 vs 550: `1601` vs `1011` at the same relative place) is never
compared; on the Marcówki 400-px-wide copies (scales 1.1585 and 2.3493, both 0 independent groups) nothing is legible.

## 3. Root cause and first wrong decision

Root cause: marks carry no evidence (`dimension-lines.ts:176–193` keeps only a position), so every later stage must
treat each crossing as a measurement point or skip it by price, and prices are compared against a scale. First wrong
decision: `solveFrameChains` → `proposalsOf(i, c, tokens, minLength)` (maxSkip 0, `chains.ts:635`) with the 0.3
centring of `spansFor` (`chains.ts:384`) binds `1055` to 204.5–633. Second: `solveFrameMetric` lets one text region
be a witness for two mutually exclusive spans — for the vote (`metric-solution.ts:628–637`) and for the rival
hypothesis — so the geometric preference for the full span can never win (`beatsLegacy`, lines 650–654).

## 4. Proposed contract

**4.1 Dimension graph (per frame).** Replace bare ticks with:
- `Mark {id, lineId, atPx (stub position), members[] (detections merged), class, cues}`. Detections within
  markReach+1 px (8 px) are one mark (`TWIN` members); position = the member with the perpendicular stub.
  `class ∈ {STYLE, FOREIGN, UNCERTAIN}` against the **sheet terminal signature**: the median of the end marks of
  2-mark labelled lines (and line ends that agree with each other) — stub length each side, ink darkness, presence of
  a perpendicular stub, lean. `FOREIGN` needs ≥ 1 of: no stub / stub < 0.6× / stub > 2× (one side) / ink > reference
  + 60 (probe thresholds, to be fitted on development sheets only). Lean alone never makes a mark FOREIGN (Modrzykach: the real 60-cm mark at 66 fails on lean only).
  Lines whose own end marks do not match the sheet signature, or that cross wall-thick ink, are `UNCERTAIN`
  throughout (interior arrow chains: Kosaćce 2 and Żurawkach 4 READ endpoints fail the signature — wall faces).
- `Line {id, axis, baselinePx, marks[], styled: bool, side: EXTERIOR|INTERIOR|UNKNOWN}` (side from the wall witness
  where available, else from thick-ink crossings).
- `Label {regionId, box, readingsAsRead[]}` — one region, one label, however many passes read it.
- `Span {id, lineId, fromMark, toMark, skipped[], labelId?, role, binding, cues}`; a span may only END at a STYLE or
  UNCERTAIN mark — never at a FOREIGN one (this alone removes G2E's 186.5–692 and Azalia's 204.5–633).
- `Relation {kind, from, to, check}` (4.4). Totals are overlay spans over a partition (a laminar family), never a
  partition element the DP must choose against its own segments.

**4.2 Span roles, from geometry only (never the number).** On an EXTERIOR line:
- `OUTER_TOTAL`: a labelled span whose ends coincide (± mark tolerance) with the extreme STYLE marks of all exterior
  lines on its side — nothing on that side reaches further — covering ≥ 0.8 of their union on that axis.
- `PARTIAL_TOTAL`: a labelled span that is TOTAL_OF a run of ≥ 2 spans of a parallel line, but not OUTER (Marcówki
  1260 over 510|750; Miranda 1500 on the outer line 330|1500).
- `INTERNAL_SEGMENT`: one interval between adjacent STYLE marks of a line with ≥ 3 STYLE marks; and every span on an
  INTERIOR line. Share thresholds (`WITNESS_SHARE`) are computed against the union of exterior lines, not the longest
  chain of any kind.

**4.3 Binding a label: alternative A (span over a questionable mark) vs B (segment at it).** For each label and each
mark m it straddles, record cues; decide per mark, never globally:
1. class of m (FOREIGN/TWIN favours A; STYLE favours B; UNCERTAIN neither);
2. placement: offset in label widths from A's and B's centres (≤ 0.5 centred, ≥ 1.5 not; between: no vote);
3. siblings: B leaves an adjacent sub-span with no label on a line that carries no other label → favours A; a centred
   label of its own on that sub-span → B;
4. alignment: m coincides (± mark tolerance) with a STYLE mark of a stacked parallel line → favours B only if m is
   itself STYLE (G2E 419.6 sits ≈ on the 688|836 boundary but is foliage);
5. chain sums as read (4.4) for A's span vs B's;
6. last, an independent scale witness (another region, another line, preferably the other axis) agreeing with exactly
   one alternative → `BOUND_BY_SCALE`, recorded as dependent and never counted for that scale.
`DECIDED_BY_GEOMETRY` when 1–5 agree with no contrary cue; otherwise `TOPOLOGY_AMBIGUOUS`. A STYLE mark is never
skipped by geometry. On the houses: Azalia → A (cues 1, 2, 3); G2E → the only span with STYLE ends, 106.5–730.5;
Marcówki 1260 → A on both copies; Marcówki 510 (watermark mark 290) → A as today; e-OZE 760 → twin merged.

**4.4 Relations.** Only between parallel lines on the same side with baseline gap ≤ 4 label heights (measured families:
20–38 px, 1.4–2.7 heights):
- `TOTAL_OF(span → run [k..l] of a line)`: span ends coincide with marks k and l; ≥ 1 STYLE mark strictly inside.
  `SEGMENT_OF` is its inverse per child span.
- `NESTED_IN`: inside another line's extent without end coincidence; same gap bound; no cap-driven truncation.
- `PARALLEL_COPY_OF`: the same span on another line of the frame, or the corresponding span on another raster copy of
  the same drawing (scale ratio must equal the copies' size ratio); values must agree as read.
- `CONFLICTS_WITH`: a failed check, both directions, with which side was read, corrected or derived.
Check states: `AGREES_AS_READ` (total and every child substitution-free, |Δ| ≤ max(2 cm, 1 %)), `INCOMPLETE` (a child
unlabelled/unread — DERIVED children never complete a run), `CONFLICT_AS_READ`, `AGREES_AFTER_CORRECTION` (any
corrected value: recorded, never evidence). Nothing is ever re-read to make a check close.

**4.5 Independence and the consensus ranking.**
- Unit = text region. A region is a witness for at most one span in the whole frame (its decided binding); an
  AMBIGUOUS region witnesses no hypothesis, and no hypothesis may be "contested" by another span of a region it uses.
- Legacy support counts a region only if the vote's span for it equals its decided binding (Azalia: 0 groups).
- A witness group merges regions that are not independent: one region's alternatives; a TOTAL_OF family (shared end
  marks — one geometric statement); a total whose reading was chosen because it equals its children's sum or fits the
  scale (CHAIN_CORRECTED: no witness); PARALLEL_COPY_OF across raster copies.
- An `AGREES_AS_READ` family counts as one group that is value-corroborated (it may make a hypothesis `corroborated`,
  never `axesMeasured`). A total in `CONFLICT_AS_READ` with no independent group agreeing with it is ranked as
  PARTIAL, not OUTER.
- Tuple, compared in order: [OUTER groups on both axes agreeing within pixel tolerance; ≥ 2 independent OUTER groups
  agreeing; corroborated; the longest witness DECIDED_BY_GEOMETRY; share of the exterior union; groups; weight].
  Two independent outer witnesses agreeing > one decided partial witness > any number of AMBIGUOUS ones.

**4.6 Confidence.** STRONG: two independent groups, both axes, one OUTER (today's rule, with groups). SUPPORTED:
corroborated (incl. an AGREES_AS_READ family). WEAK: one DECIDED group, however outer. INCONCLUSIVE: only AMBIGUOUS
groups, or two OUTER groups that disagree beyond tolerance with nothing independent deciding, or a CONFLICT_AS_READ
family with no independent group.

## 5. Negatives and risks (what must not change)

- **Real segmented chains stay segmented.** Exterior labelled lines of the 9 base frames carry 23 internal
  STYLE marks, every one a real division (Kosaćce 269|665|521|205, Marcówki 100|510|750|100 and 790|415, Miranda
  330|1500, 800|700, 245|920|245, Żurawkach 750|430, 950→800|150, Jabłonkach 380|900, Modrzykach 60|740|426|624 and
  196|689|195|80, G2E 850|624): 0 classified FOREIGN; their labels sit ≤ 6.2 px from their own interval's centre.
  Jabłonkach's V line 380|900 has no total: no OUTER_TOTAL is invented, the 900 stays a segment; Miranda's
  unlabelled 89–794 (1830) is never derived as a total.
- **Spurious marks classified:** all 7 known non-dimension marks on exterior lines (Azalia 204.5; Marcówki 278.5,
  300.5, 290; G2E 186.5, 419.6, 692) are FOREIGN, the 3 known twins TWIN; on STRONG/SUPPORTED frames 62/68 READ endpoints
  match the sheet signature (the 6 misses: interior wall faces → excluded by 4.1) and 12/12 marks the DP skipped
  inside a READ segment fail it. One more FOREIGN mark sits on a terrace object's line (Miranda, label h 24).
- **A conflicting total with no independent witness lowers confidence:** G2E V (1170 vs 850+21; no two of the three
  regions agree) → nothing from that family; Żurawkach V (450 vs 800+150): the children agree with H's 1180 → total
  recorded CONFLICTS_WITH, contributes nothing, STRONG stays.
- **Topology does not fix OCR.** Azalia becomes 1055/556 = 1.8975 (+1.9 %), G2E 1751/624 = 2.806 (+1.8 %): single
  decided witnesses, WEAK at best; a 1.8 % misread is 10 px at 556 px, so it never "agrees" with a second outer
  reading within tolerance — the right result there is a recorded conflict, not STRONG.
- Do not relax: lean alone, a sheet with fewer than 2 styled 2-mark lines (all UNCERTAIN → today's behaviour, flagged
  AMBIGUOUS), arrow/dot offices, interior chains, marks under labels. Never decide A/B from which scale "fits better".
- Tests to add: a total line with a pale crossing at 23 % of its length (A, scale-free; also with values ×3); the same
  with a STYLE mark and a sibling label (B); three foreign crossings (span still observable); twin detections 7 px
  apart (one mark); a total and parts that agree only after correction (no witness); a raw-agreeing family
  (corroborated, not axesMeasured); one region on two spans (one witness, no self-contest).

## 6. Per house (base frame; today's code)

| House | Solution today | H overall: printed → read, span | V overall: printed → read, span | Families as read | Non-dim. marks on ext. lines | With the contract |
|---|---|---|---|---|---|---|
| Azalia | LEGACY_UNCONF. WEAK 2.462 | 1035→1055 on 204.5–633 (watermark cut) | 670→014/010, unread | none | 1 FOREIGN | A: 77–633, 1.8975 WEAK (OCR +1.9 %) |
| Marcówki | CONFIRMED STRONG 2.6425 | 1205 READ 58–514 | 1260 (partial total of 510\|750) READ 259–735.5 | H 855≠1205, V 661≠1260 | 3 FOREIGN, 2 TWIN | same; area copy 1260 READ, no 1160 |
| Kosaćce | CONFIRMED SUPP. 2.4058 | 1660→1000, CC only | 1260 READ 179.5–703 | H conflict, V incomplete | 0 | unchanged |
| G2E | LEGACY_UNCONF. WEAK 2.7497 | 1720→1751 on 186.5–692 (foliage cut) | 1474→1170, no witness | V 871≠1170 | 3 FOREIGN | 106.5–730.5, 2.806; V demoted; WEAK |
| e-OZE | REPLACED STRONG 2.2236 | 1600→1601 READ 75–795 | 760 READ 236.5–578.5 | none | 1 TWIN | unchanged, twin merged |
| Jabłonkach | REPLACED WEAK 2.1195 | 1100 READ 83.5–602.5 | none printed (380\|900 segmented) | none | 0 | unchanged, 900 stays segment |
| Miranda | CONFIRMED SUPP. 2.6809 | 1500 (PARTIAL_TOTAL) READ 234.5–794 | 1410→1110, no witness | H 1500=800+700 ✓, V incomplete | 0 (+1 on a terrace object) | unchanged; family AGREES_AS_READ |
| Żurawkach | CONFIRMED STRONG 2.2178 | 1180 READ 260–792 | 950→450, CC only | H incomplete, V 950≠450 | 0 | unchanged; V total CONFLICTS_WITH |
| Modrzykach | REPLACED STRONG 2.7477 | 1850 READ 46–719 | 1160 READ 113–535 | H 807≠1850, V 1056≠1160 | 0 | unchanged |

Overall labels printed: 9 horizontal, 8 vertical. Read as printed on their true span: H 6/9, V 4/8 (Marcówki's V is
a partial total). Two independent outer witnesses agree on 3 frames (e-OZE, Modrzykach, Marcówki) — all STRONG.
Topology (a non-dimension mark inside an overall line) is the first wrong decision on 2/9 overall-H lines and costs
a total its value on 1 copy (Marcówki area table); OCR of the label is the rest.
