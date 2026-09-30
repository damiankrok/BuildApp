# BUILDPLAN-ANALYZER-005B — implementation contract

Binding for the implementation. It is written from the three targeted reviews in this directory
(`orientation-review.md`, `scale-independence-review.md`, `extent-role-review.md`) and from measurements
the implementer made on the eight development houses' live baseline runs (`bdacd42`, reproduced 005A
hashes on all of them). Every rule below says where it lives and what it may never do.

## 0. What the reviews and the measurements established

| # | fact | measured on | source |
| --- | --- | --- | --- |
| 1 | The page-wide orientation vote (`ocr.ts dedupeOrientations`) deletes every token of the losing vertical pass. On willa-miranda's ground plan the CW pass lost 17.2 against 19.6, and the whole left-margin depth chain (1410 = 245 + 920 + 245) went with it; on e-OZE a hatch read as a 19-character CCW token (merit 2.84) tipped the vote and deleted CW "760" | willa-miranda `7102a805c6`, e-OZE `e3a3d0015d` | A §3, implementer |
| 2 | The named misreads `006`, `002`, `0111`, `036`, `502`, `535` are all CCW readings of labels set bottom to top; the right-way readings existed and were deleted before any chain saw them. CW and CCW merits of one label are within a few per cent (Marcówki "1260" 0.67 vs "0431" 0.68) | h1, h2, Marcówki | A §1–4 |
| 3 | A trailing zero turned half a turn is a leading zero, and a cm dimension is never printed with one: 13 of 14 leading-zero tokens are upside down | h1, h2 | A §6 |
| 4 | Substituted readings vote in the pooled scale at nearly full weight; CHAIN_CORRECTED segments then anchor the registration (0 of 120 anchors ever rejected). h1's 1.892 cm/px rests on 6 of 6 rewritten anchors; e-OZE's `1601→1801` beat its own raw reading only through the ×1.5 cross-chain bonus | h1, e-OZE, Kosaćce | B F1–F4 |
| 5 | Raw readings alone reproduce the right scale on the houses that work (Marcówki 2.643, Kosaćce 2.4069, willa-miranda 2.681) and give the right one where the vote failed (e-OZE 2.2236 from 1601/720 and 760/342; h1 2.119 from 1100/519) | 7 houses | B §3, implementer |
| 6 | `1100` was pushed off h1's only overall chain by a 32 px logo glyph "14" that sat nearer the line (`assignTokens` interval claim) | h1 | B |
| 7 | The plan extent is the widest chain with a READ or CHAIN_CORRECTED segment; nothing tests where it lies. willa-miranda's depth came from interior V@375 (2.5 m, resting on a rewrite), e-OZE's from interior V@485 (68 px), h1's width from interior H@568 | h1, h2, e-OZE | C R1–R3 |
| 8 | The wall-ink cluster (`wallClusterExtent`) is too coarse to be the envelope: it covers most of the Kosaćce sheet and joins the publisher's corner logo | Kosaćce, Marcówki, h1 | C §4, implementer |
| 9 | Unread overall chains are ignored entirely; willa-miranda's sibling copy with the right 15.00 × 14.10 m extent still came out −40 %, so the extent is necessary and not sufficient | h2 | C F15 |
| 10 | Small copies (400/550 px) set their labels below 10 px; every raw reading of their overall dimensions is wrong | Kosaćce, G2E, Marcówki | implementer |

## 1. Data model (source-metrics, metric evidence schema 1.2.0)

- `OcrToken.orientation` — which pass read it (`HORIZONTAL` 0°, `ROTATED_CW` 90° bottom-to-top,
  `INVERTED` 180°, `ROTATED_CCW` 270°). Plan frames record every pass's tokens, not only the vote's.
- `MetricEvidence.rawText` — what the reader saw, always (it held the corrected text for chain values, against
  the schema). `MetricEvidence.derivation` — `{ rawText, orientation, valueText, substitutions,
  dependsOnScale, why }` whenever the value is not the raw reading or its way up was chosen by a scale.
- `DimensionObservation` — one per (reading as read, span it could measure, orientation): value, endpoints,
  span, implied scale, OCR score, leading-zero flag, `independence`
  (`INDEPENDENT | ORIENTATION_BY_OTHER_AXIS | ORIENTATION_UNDECIDED`), `status` (`RAW | ACCEPTED | REJECTED`).
  One `textRegionId` per piece of ink, shared by its readings in every pass.
- `FrameMetricSolution` per floor-plan frame — relation to the legacy scale, confidence, per-axis scale,
  anisotropy, isotropy (`MEASURED | ASSUMED | NONE`), the ≤ 6 scale hypotheses with their witnesses, the legacy
  scale's own independent support, supporting and conflicting observation ids, the per-chain orientation
  decisions, the chains re-read, counts, why.
- `ChainRelation` — `TOTAL_OF` (a two-tick chain spanning exactly what a finer chain divides, with the value sum
  recorded and never forced) and `NESTED_IN`.
- The raw tokens of every pass are sealed; nothing is rewritten in place. `readNumbers(…, { hypotheses: true })`
  adds a 180° pass and returns `raw` and the vote as numbers; the legacy `tokens` are byte-identical.

## 2. Orientation (source-metrics `metric-solution.ts`)

Per chain, at most two hypotheses: 0°/180° for a horizontal chain, 90°/270° for a vertical one. Decided in this
order, and the rule that decided is recorded:

1. `SINGLE_READING` — only one way up parses as a dimension on this chain.
2. `CHAIN_SELF_CONSISTENCY` — two decisive readings on the chain agree one way up and not the other.
3. `AXIS_SELF_CONSISTENCY` — a reading joins a cluster of decisive readings elsewhere on the same axis that agree
   (scale-free with respect to the other axis).
4. `TYPOGRAPHY` — read one way up, a label has a leading zero; the other way, none.
5. `AXIS_MAJORITY` — a sheet sets its vertical text one way: when the chains decided by 1–4 agree three to one,
   the rest follow.
6. `OTHER_AXIS_SCALE` — the horizontal readings' own scale (as read, then within two substitutions) decides.
   A reading chosen this way is `ORIENTATION_BY_OTHER_AXIS`: it is never a witness of isotropy.
7. `UNDECIDED` — the legacy vote's way up is kept; its readings witness nothing.

Horizontal text: `PAGE_UPRIGHT` unless the 180° readings agree and the upright ones do not (or three or more
upright labels carry leading zeros and the inverted ones do not). Never a string table; no correction lattice
ever reverses a string.

## 3. Scale (source-metrics `metric-solution.ts`)

- **Witnesses.** Readings as read (no substitution), bound to their ticks, in the chain's decided orientation.
  A reading may bind across at most two spurious ticks, centred on its label, discounted 0.7 per tick. Labels
  outside the sheet's dimension-label size (0.5–1.8 × the median cap height of tokens on chains) are not
  labels (the logo "14", room numbers).
- **Independence.** One witness per piece of ink per hypothesis, whatever passes read it. A witness counts only
  if INDEPENDENT (its orientation owed nothing to a scale), decisive (span ≥ 25 × the pixel tolerance, so it
  states the scale to 4 %) and legible (cap height ≥ 10 px). A CHAIN_CORRECTED value is never a witness.
- **Hypotheses.** Seeded from every witness, refined to the weighted centre of their members, one per 3 %,
  at most six, each with its plausibility (the plan's wall-thickness check) recorded, never averaged across
  clusters.
- **Witness shares.** A reading measures a share of the longest chain on its axis: OVERALL ≥ 0.8, MAJOR ≥ 0.5,
  SUBSTANTIAL ≥ 0.25. `corroborated` = a MAJOR reading and a second SUBSTANTIAL one on another chain agree;
  `axesMeasured` = each axis carries a SUBSTANTIAL independent reading and one is MAJOR.
- **Selection.** Lexicographic, never a weighted sum: axes measured, corroborated, an overall reading, number
  of independent witnesses, weight.
- **Confidence.** STRONG = axes measured and corroborated; SUPPORTED = corroborated; WEAK = one decisive
  independent reading; INCONCLUSIVE = none. A rival of equal standing on the first three places with half the
  weight costs a step, with four fifths the decision.
- **Relation to the legacy vote** (its scale is the incumbent):
  - `CONFIRMED` when the selected scale agrees with it (1.2 %, or the pixel tolerance on the longest witness):
    its numbers are kept.
  - `REPLACED` when it has no independent decisive support and the selected scale is at least SUPPORTED, or WEAK
    on one overall reading; or when the selected scale beats it outright on axes, corroboration and count and is
    at least SUPPORTED.
  - `LEGACY_UNCONFIRMED` otherwise: kept, with its own independent support counted (INCONCLUSIVE on none).
  - `ADDED` / `NO_SCALE` when the vote had no scale (ADDED needs SUPPORTED).
- **Chains.** Each is solved at the frame's scale from the tokens of its decided orientation; a chain whose
  tokens are the vote's own reuses the legacy solution byte for byte. Substitutions happen here, downstream of
  the scale, as CHAIN_CORRECTED values with `derivation.dependsOnScale = true`.
- **Registration.** Fitted by the existing rule over the sealed chains. On a frame where nothing was re-read
  and the relation is CONFIRMED or LEGACY_UNCONFIRMED this is the legacy registration, byte for byte. The
  CHAIN_CORRECTED anchors it contains act after scale selection (a refinement within the tolerance the
  independent witnesses set). They are never counted in any witness count or confidence.
- **Anti-circularity, stated as tests:** a correction made under a scale never increases that scale's
  support or class (the self-anchoring adversary); a scale supported only by corrections is INCONCLUSIVE and
  is replaced by any independently supported one.

## 4. Chain graph and roles

- source-metrics seals `TOTAL_OF` and `NESTED_IN` from ticks alone.
- reconstruction classifies roles against a **wall witness computed from the sheet's pixels only** (bands of the
  sheet's wall thickness, detached thin-stroke components such as the publisher's logo excluded; no chain and no
  extent enters it): OUTER (baseline outside the walls met along its span, on one side) vs INTERIOR (walls on
  both sides); end ticks on the outermost faces; nesting.
- **Interior chain safety.** A chain whose baseline has walls on both sides along its span, and whose span does
  not cover the witness on its axis, may never set the building's width or depth. Neither may a chain an
  exterior chain on the same axis encloses.

## 5. Extent (reconstruction `plan-extent.ts`)

- The incumbent `planExtent` rectangle stands, byte for byte, when the chain it took each axis from passes
  the safety rule.
- An axis whose chain is refused takes, in order: the widest exterior chain on that axis (read or not: an
  exterior chain's ticks are a geometric statement of the building's extent); else the wall witness, marked
  weak, with provenance `WALL_GEOMETRY_EXTENT` kept apart from `DIMENSION_CHAIN_EXTENT`.
- ≤ 3 extent hypotheses per copy for the resolver: the role-aware chain rectangle, the wall witness, and the
  legacy wall-ink cluster.

## 6. Confidence-aware first success and the resolver (resolver 1.3.0)

- The base plan's metric solution travels with the layout. A first reading that completes keeps the fast path
  when its base plan is CONFIRMED/REPLACED with confidence ≥ SUPPORTED and its extent passed the safety rule.
- Otherwise, even when the first reading completes, the resolver weighs the **metric alternatives only**
  (the frame's other plausible scale hypotheses and the extent hypotheses) against the incumbent, which
  competes on the same score. An alternative replaces it only when strictly better on the evidence tuple and
  acceptable; otherwise the incumbent stands with a LIMITING warning naming its metric confidence.
- The resolver's scale axis takes the metric layer's hypotheses (no dimension logic in the resolver); its lattice
  scales stay as they were for the readings it already weighed. `PLAN_RESOLVER_VERSION` goes to 1.3.0 because
  acceptance behaviour changes.
- When the run stops and the base plan's metric solution is INCONCLUSIVE with no alternative composed, the
  typed stop is `METRIC_RESOLUTION_INCONCLUSIVE` with the candidates attempted, the top competing scales, the
  conflicts and what evidence is missing.
- Published figures stay verification: they may refuse and (unspent) rank, never rewrite a reading.

## 7. Progress, bounds, determinism

- Ticks: `ORIENTATION` (chains i/n), `SCALE` (hypothesis i/n), `EXTENT` (candidate i/n); Polish step lines on
  Android beside the existing OCR/callout/camera lines.
- Bounds (counts, never a clock): 2 orientations per label, 6 scale hypotheses, 400 observations, 2 skipped
  ticks, 2 substitutions for a cross-axis lattice check, 200 chain relations per frame, 3 extent hypotheses per
  copy; the resolver's 24-decomposition budget is unchanged.
- Everything is sorted by code-unit order; no `localeCompare` in the new code; same inputs, same bytes.

## 8. Out of scope

Roof fidelity, the garage roof debt, façade decoration, room-name OCR, document import, UI redesign. The
cross-view witness (site plan, elevations) is recorded as available and not built unless a development house
needs it. No per-house branch, no benchmark number as a decision; the hard-code guard extends to both
ex-blind families.
