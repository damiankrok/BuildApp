# BUILDPLAN-ANALYZER-005E — post-implementation review B (non-circularity and scale leakage)

- **Reviewer:** b5e. **HEAD:** `8b8bd396a167d632c0309392699c0d7eeb749a7a` (diff against the 005D freeze `d8ba4e8`). Read-only on the repo.
- **Read:** brief §4–5, §11–18, §29–31; `pre/implementation-contract.md` (R0–R5, S1–S6, M1–M8); `numeric-lattice.ts` (all),
  `metric-solution.ts` (all), `extract.ts`/`chains.ts`/`ocr.ts`/`schema.ts`/`hash.ts` diffs, `parse.ts:readingLattice`,
  `extract.ts:buildChain`, `registration.ts:registerFrame`, `evidence-pack/src/pack.ts` (07-ocr-labels), the shipped
  tests `ocr-metric-adversaries.test.ts` and `numeric-lattice.test.ts`, and the consumers in `reconstruction/src`
  (`plan-resolution.ts` challenge, `plan-decomposition.ts` grid, `layout.ts` registration).
- **Ran** (scratch under `/home/user/BuildApp/.cache/review-b5e/`; no row runs of my own, no images touched):
  - `oracle.ts` — every observation / sealed chain segment / structural assignment / registration anchor of every run dir
    against its ink's own lattice: m1 (18 rows, a8ba3db), m2 (10 HEAD rows finished at review time), fix2/dom-w-jablonkach.
  - `c4.ts`, `anchors.cjs`, `selected-vs-sealed.cjs`, `derived.cjs`, `structural.cjs`, `twins.cjs`, `nolat.cjs` — focused
    tallies on the selected plan frame (`plan-diagnostics/digest.json`).
  - `probes.ts` — six adversarial probes in the style of `ocr-metric-adversaries.test.ts` (hand-made tokens and lattices,
    `solveFrameMetric` / `correctionReadings` at HEAD source). Output quoted below.

## Findings

| ID | Sev | One line |
|----|-----|----------|
| B5E-1 | P1 | The lattice re-solve falls back to 005D's unfloored substitution list for an ink whose lattice states no dimension: on dom-w-modrzykach (HEAD, REPLACED/STRONG) a LOW_QUALITY ink with no dimension among its 8 sequences is sealed CHAIN_CORRECTED 251 and anchors the X registration (contract M7/R0 broken). |
| B5E-2 | P1 | Kept legacy chains (CONFIRMED and LEGACY_UNCONFIRMED frames) seal 005D 1–2-substitution values outside the ink's own 005E lattice, chosen by the vote's scale on spans down to 20 px. Downstream treats them as printed and lets them anchor the registration. R0's "never in any record" is false and nothing tests it. |
| B5E-3 | P2 | `ocr.selected` is not "the value the span was finally given". It disagrees with the sealed segment on 10 of 44 selected-frame spans. SCALE_RANKED skips the plausibility bound and `minCorrectionPx` that 8b8bd39 added. Some READ segments carry a lattice value under the 005D `rawText`. |
| B5E-4 | P2 | A printed span whose label misses the scale is sealed as DERIVED (scale × px) with the note "nothing is printed on this span". A correction the re-solve refused (8b8bd39) comes back as the scale's own value. |
| B5E-5 | P2 | The STRUCTURAL refutation has no image-plausibility bound: a correct CLEAR total is refuted through a re-cut value its ink holds at about 1 %. |
| B5E-6 | P2 | CHAIN_CORRECTED values (chosen by the scale) anchor registrations even though the sealed derivation calls them "never a witness". On rarytasy-g2e the X registration has 7 CHAIN_CORRECTED anchors and no READ anchor. |

No P0: on every development run at HEAD, observation values, alternatives, `ocr.selected`, `falseConsensus` and structural
assignments all come only from image-generated candidates. Both P1s are paths where values the **005E** reader does not
support still reach the sealed record. They do so through 005D's `readingLattice`, which is image-generated in the 005D
sense but has no floor.

## B5E-1 (P1) — the lattice re-solve reads `readingLattice` for an ink the lattice re-read

**Code.**
- `correctionReadings` returns `undefined` when `asReadValueCm === undefined` (`metric-solution.ts:384`).
- `latticeReadings` passes that `undefined` on (`:1143-1146`).
- `assignTokens` then falls back to 005D's `readingLattice` (`chains.ts:237-246`): every single substitution with no
  glyph-ratio floor, plus the pairs.
- The same ink is dropped from the observations (`metric-solution.ts:431`), so it is never weighed as read. It then
  re-enters the sealed chain as a scale-chosen correction. Tokens with no lattice at all (1 or more than 6 glyphs) take
  the same path.
- Contract M7 says "the REPLACED re-solve read[s] the lattice, not `readingLattice`". R0 says "a value outside an ink's
  lattice never appears in any record".

**Probe P1** (2.00 cm/px, ADDED/STRONG). Ink T: 005D read it `500` with a `9` under the 5 at ratio 0.25. The lattice reads
it `5,0` and offers only {500}. Results:
- `P1c BROKEN — chain 2 [200,650] CHAIN_CORRECTED 900 (ink read 500, lattice 5,0|500)`.
- The shipped oracle (`expectNonCircular`) passes (`P1a HOLDS`), because it checks observations only.
- Control: when the lattice states `500`, the span is not corrected (it becomes DERIVED 900, see B5E-4).

**Development, HEAD (m2/dom-w-modrzykach, selected frame, REPLACED/STRONG).**
- `RESOLVE CHAIN_CORRECTED ANCHOR raw 551 -> 251 span 91`.
- The ink's lattice is LOW_QUALITY, as-read `55,`, and its eight sequences (`3-5`, `1-5`, `51,`, `7-5`, `55,`, `55.`,
  `21,`, `2-5`) contain no dimension. The 005D token is 74 px tall and its third glyph scored 0.010.
- The value is anchor `anchor-chain-segment-5a50278e58` of the X registration (residual 0.0089 m).
- At m1 the same path also gave dom-w-tunbergiach `51 -> 55` on 26 px (lattice `°.1`). HEAD's `minCorrectionPx` now
  blocks that one (spans under 55 px), but not modrzykach's 91 px.

**Generic fix.** An ink that has a lattice takes its readings from the lattice only:
`return lattice ? (correctionReadings(lattice) ?? []) : undefined`. An empty list means `assignTokens` skips the token,
so an ink the reader says states no dimension has no reading. Also extend `expectNonCircular` to `m.solved`: every
READ/CHAIN_CORRECTED segment of a lattice ink must carry a value of that lattice.

**Regression risk.** Low. modrzykach's X registration loses one of its four anchors (2 READ + 2 CHAIN_CORRECTED). A
READ-only least-squares gives 0.027489 m/px against the registered 0.027483 (0.02 %). The 91 px span becomes reading-less
or DERIVED, so its tick keeps chain support but loses "printed" support (`plan-decomposition.ts:435`). Re-run that row.

## B5E-2 (P1) — the kept legacy chains seal values the 005E reader does not support

**Code.** R1 keeps the vote's DP byte for byte. Wherever `offers[c]` is not taken (CONFIRMED without a re-read,
LEGACY_UNCONFIRMED), the sealed segment is `legacy.solved[c]` (`metric-solution.ts:1158-1190`). Its readings come from
`readingLattice` (`parse.ts:130-178`: singles at any ratio, pairs on the two least-decided glyphs). It has no
`minCorrectionPx`, because "the 005D path is unchanged" (8b8bd39).

**HEAD, selected plan frame.** Every one of these is a registration anchor, and every one lies outside the ink's own lattice:

| Row | Count | Examples (raw → sealed, span, lattice as-read) |
|-----|-------|------------------------------------------------|
| kosacce-clean / -tracked | 6 of 14 CHAIN_CORRECTED | `387→381` 157 px (lattice `187`), `170→110` 47 px (`770`), `461→61` 27 px (`961`) |
| marcowki | 3 of 6 | `515→155` 57 px, 2 substitutions (`775`); `701→301` (`700`) |
| rarytasy-g2e | 5 of 9, all 2 substitutions on 25–60 px | `754→114` (`719`), `515→111` (`115`) |
| willa-miranda | 2 | `10→50` on **20.5 px** (`10`), `605→645` (`605`) |
| alt-marcowki | 2 + 1 READ | READ `111` where the lattice reads `414` |

Across the 10 HEAD rows: 67 such anchors (oracle C4) and 15 READ anchors whose value is not the lattice's as-read
(oracle C2). Downstream, CHAIN_CORRECTED counts as printed:
- `plan-decomposition.ts:435` (printed support of a grid line);
- `:755-768` (`dimensionedAxis`, the building's frame);
- `layout-gate.ts:84`, `plan-resolution.ts:196`.

This is §5's forbidden pattern with one hop added. The 005E image reader emits `187` and its own alternatives. The vote
scale expects 381. The legacy DP supplies 381 from a runner-up list the stage replaced as uncalibrated (§12). The
short-span chance fit that 8b8bd39 removed from the re-solve (`a one-glyph value that fitted a 15 px span by chance`) is
still live on this path: `10→50` on 20.5 px. It is pre-existing and R1-sanctioned. It is not a 005E regression, but the
contract's R0 claim is false and no test covers sealed chains.

**Generic fix (005E, record only).**
- Flag each sealed LINEAR_DIMENSION whose ink has a lattice that does not hold its value (`outsideLattice: true`, and the
  lattice id) and surface it in `07-ocr-labels.json` and the timeline.
- Restate R0 as "observations, selections and the lattice re-solve", with the legacy exemption written down.
- Add a sealed-record oracle with that exemption.

**005F decision:** apply `correctionReadings` and `minCorrectionPx` to the legacy chains of lattice inks.

**Regression risk.** The record-only fix changes `contentHash` and nothing else. The behavioural fix changes every
CONFIRMED model (it breaks R1):
- rarytasy-g2e's X registration would lose all 7 anchors and fall back to the Y scale with assumed isotropy;
- kosacce X would move from 0.024058 to 0.023916 m/px (−0.6 %).

## B5E-3 (P2) — `ocr.selected` is not the value the span was given

The docs say each observation "records which value its span was finally given" (`METRIC_EVIDENCE.md` "non-circular
selection"). The Evidence Pack shows `selected` per lattice (`pack.ts:303`, `:334`). Yet `selectedValueOf`
(`metric-solution.ts:1202-1222`) ranks **all** emitted sequences (`:1217`) independently of the chain that is sealed.

**Measured (HEAD, selected frames, PRIMARY spans that are sealed segments).**
- 34 agree and **10 disagree**; another 3 say UNRESOLVED while the span was sealed with a value.
- kosacce-clean: `105` is SCALE_RANKED to **201** but sealed READ **204**.
- rarytasy-g2e: `185` is AS_READ but sealed CHAIN_CORRECTED **165**.
- willa-miranda: `130` is AS_READ but sealed DERIVED **390.08**.

**SCALE_RANKED skips 8b8bd39's bounds.** 7 of 48 SCALE_RANKED values on HEAD rows are values `correctionReadings` would
refuse. Example: rarytasy-g2e, a CLEAR `160` ranked to `110` at p/own 0.088 on a 40 px span. Probe P2: a CLEAR `46` on
20 px gets `selected {by: SCALE_RANKED, valueCm: 40, imageRank 1}` even though `correctionReadings` offers `46` only
(`P2b BROKEN`).

**Related: READ segments with a lattice value under the 005D text.** The as-read can come from STRICT/SAUVOLA. On 10
HEAD segments the sealed READ value is the lattice's as-read under the 005D `rawText`, and 9 of them have no
`derivation`. Examples: dom-w-azaliach READ `rawText 010`, value **670**; rarytasy-g2e `1170`, value **1470**;
dom-w-jablonkach `104`, value **105**. This is still non-circular (the as-read is chosen by segScore,
`numeric-lattice.ts:593`), but the record cannot show it.

**Fix.**
- Derive `selected` from the solved segment that covers the primary span: its origin, value and that value's lattice
  rank.
- Keep the current ranking as `metricPreference`, with the same plausibility bound and `minCorrectionPx`.
- Add `derivation {valueText: asRead, rawText: 005D}` when they differ.

**Risk:** records only.

## B5E-4 (P2) — a printed span is sealed DERIVED with "nothing is printed"

**Code.** `solveChain` sets `segment.token` only when a reading was chosen (`chains.ts:818-822`). A span whose label
misses the scale (`:760`) is then derived (`:844-849`: scale × px, DERIVED). `buildChain` writes `rawText ''` and the
note "nothing is printed on this … span" (`extract.ts:806`, `:819`). That contradicts `solveChain`'s own doc ("a span
whose number cannot be reconciled with the scale is left UNRESOLVED", `chains.ts:682-683`).

**Probe P2.** The refused correction `40` is sealed anyway, as DERIVED 40 (`P2c BROKEN`). Probe P1's control seals
DERIVED 900 over a SUPPORTED `500`.

**HEAD.** fix2/m2 dom-w-jablonkach (REPLACED, lattice path): `501` on 57.5 px is sealed DERIVED 121.87. The CONFIRMED
rows have one each: kosacce `164`, rarytasy-g2e `210` CLEAR, willa-miranda `130`. The value is labelled DERIVED (no
anchor), so nothing circular is presented as read. What is lost is the conflict between a printed figure and the scale.

**Fix (record).** Keep the rejected token on the segment (`printedText`, `rejectedAtScale`) and write an honest note.
Making such spans UNRESOLVED drops their `valueCm`, and `plan-decomposition.ts:433` then drops their ticks, which can
change tiling. Do that only after a matrix run.

## B5E-5 (P2) — STRUCTURAL refutation without an image-plausibility bound

**Code.** `altCost` admits every emitted lattice value at cost `max(1, nonTop)` (`metric-solution.ts:434`, `:1547`). A
re-cut's top text (nonTop 0) costs 1, the same as a 0.93 coin toss.

**Probe P4** (2.00 cm/px). The total is `1230` (CLEAR, correct) and a re-cut offers `1200` at 1 %. The child `500` is
SUPPORTED and actually 530; its lattice never reached 530. The child `700` is CLEAR.
- `structural [1230→1200, 500→500, 700→700]`.
- The true total is refuted and stops witnessing; its record says `STRUCTURAL 1200, metricResidualPx 15`.
- `correctionReadings` offers `1230` only (`P4 BROKEN`).

**Development.** Only 2 assignments, both at p/own 0.92 (dom-w-zurawkach, m1), so no development impact. The
assignment uses no scale, which is the right half of M5.

**Fix.** Admit as structural options only values within `correctionReadings`' bound (p ≥ 0.5·own, or one glyph ≥ 0.7).
**Risk:** dom-w-zurawkach's 450→950 still passes; nothing else on development.

## B5E-6 (P2) — scale-chosen CHAIN_CORRECTED values anchor registrations

**Code.** `buildChain` anchors every non-DERIVED segment (`extract.ts:866`). Its own comment (`:861`) says "only a
segment whose number was actually READ anchors". The sealed derivation calls a CHAIN_CORRECTED value "downstream of that
scale, never a witness for it". `registerFrame`'s confidence counts up to 5 anchors and both axes (`registration.ts:170`).

**HEAD, selected-frame registrations:**
- rarytasy-g2e X: 7 CHAIN_CORRECTED, 0 READ;
- willa-miranda Y: 2 CHAIN_CORRECTED, 0 READ;
- kosacce X: 9 CHAIN_CORRECTED / 2 READ;
- on the lattice path, dom-w-jablonkach Y: 3 CHAIN_CORRECTED / 1 READ, and modrzykach X: 2 CHAIN_CORRECTED / 2 READ.

On frames that have a metric solution, the registered scales differ from a READ-only fit by at most 0.6 %, but "measured on both axes" in the registration rests
on scale-chosen values. This is pre-existing. 005E feeds the lattice re-solve into it.

**Fix (005E).** Record each anchor's evidence origin in the registration. Excluding CHAIN_CORRECTED anchors is a 005F
decision, with the same risk as B5E-2.

## Probe output (`npx vite-node .cache/review-b5e/probes.ts`, HEAD source)

```
P1 page: ADDED/STRONG at 2
HOLDS   P1a shipped observation oracle (expectNonCircular) passes
HOLDS   P1b lattices unchanged by solving
BROKEN  P1c R0/M7: no sealed chain value outside its ink lattice in the lattice re-solve  — chain 2 [200,650] CHAIN_CORRECTED 900 (ink read 500, lattice 5,0|500)
HOLDS   P1d control (lattice states 500): span not CHAIN_CORRECTED to 900  — segment DERIVED 900 token=none text=-
HOLDS   P2a the re-solve does not offer 40 (correctionReadings, minCorrectionPx)
BROKEN  P2b the record does not SCALE_RANK a value the re-solve refuses  — selected SCALE_RANKED 40
BROKEN  P2c a printed, CLEAR-read span is not given the scale’s own value (DERIVED) instead  — segment DERIVED 40
HOLDS   P3 one ink read in two passes is one region, one witness  — regions 2, independent 1
BROKEN  P4 a CLEAR total is not refuted by a value its ink holds at ~1 % (one correctionReadings would refuse)  — refuted -> 1200; correctionReadings offers 1230
```

## Checked and found sound

- **`labelLattice` is image only** (`numeric-lattice.ts:479-497`).
  - Its inputs are the pass's ink field, the page size and orientation, the token's `passBox`/`text`/`orientation`, and
    the cache. It takes no scale, chain, tick, other label or published fact.
  - Imports are pinned by `numeric-lattice.test.ts:98-105` (`schema.js` only for `toCentimetres`).
  - A cache hit is verified byte for byte, and development runs had 0 hits, so no twin crops shared a lattice.
  - The as-read path is chosen by segScore and the grammar only (`:591-593`). It is not DEFAULT as contract S1 wrote,
    but the docs say so, and the choice is scale-free.
- **The lattice selection** (`extract.ts:979-1008`) uses chain axis, baseline distance and tick extent only, never a
  scale. Being off a line is not a leak: such an ink goes the 005D way. Only 2 m1 observations lacked a lattice (a
  7-glyph `570.533`, UNCENTRED); there were 0 at HEAD.
- **Oracle over m1 (2 473 lattice observations) and HEAD (1 693):** 0 violations of
  - `valueCm` = lattice as-read;
  - `rawText` = `asRead`;
  - `valueAlternatives` ⊆ lattice;
  - `selected.valueCm` and `selected.text` ⊆ lattice;
  - structural `chosenCm` ⊆ lattice (6 m1 assignments).

  DERIVED never anchored a registration (C0 = 0).
- **No re-read ink is counted twice.**
  - `retainPasses` pushes only the `passBox` copies into `tokens`/`raw`. `dedupeOrientations` keeps their identity, so
    the lattice keys match the legacy tokens.
  - Different-pass tokens of one ink form one region (probe P3).
  - Structural rejects a repeated region (`:1545`). `assignTokens` assigns by box, so both orientations of one ink land on
    the same chain; a total and its child cannot be one ink (inferred from the code, not probed).
  - Variants are merged by max, never by sum (`:563-571`).
- **The false-consensus `candidateCmPerPixel`** is only recorded and never becomes a hypothesis. **IMAGE_SCORE and
  METRIC_SUPPORT** are separate fields and never multiplied. Lattices are unchanged by solving (P1b, plus the shipped
  test).
- **Published footprint.** No 005E path reads `publishedFacts`: the only readers are the pre-existing `pack.ts:181`,
  `:535`. `packages/reconstruction` is unchanged `d8ba4e8..HEAD`, so the first-success challenge's use of the figure
  (SCORED / SPENT / VERIFIED) is 005D's. Reconstruction never reads `numericLattices`, `falseConsensus`, `structural` or
  `ocr.selected`. The challenge's alternative scales are still `solution.hypotheses`, which are as-read witnesses only
  (`plan-resolution.ts:283-296`).
