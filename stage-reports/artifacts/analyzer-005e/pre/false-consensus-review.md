# 005E pre-review D (`rev-d5e`) — metric confidence and false consensus

Question: why two wrong labels made a STRONG scale on `dom-w-dabecjach`, and how to score independent but ambiguous
witnesses so weak wrong reads cannot make STRONG (or anything that skips the challenge) without regressing the
development houses. Measured read-only on the sealed 005D evidence (`analyzer-005d/holdout/h{1,2}-*`, blind packs),
the frozen matrix `/home/user/work005d/m4/<house>/`, and label re-reads of the cached bytes (cell hole counts only;
nothing copied). Probes in `/home/user/BuildApp/.cache/rev-d5e/` (gitignored): `simulate.mjs` replays the 005D
choice and reproduces the sealed confidence on all 13 frames tried (11 houses, 2 twin copies); `policy.mjs` replays
the contract below; `topology.ts` re-reads glyph topology. Tolerance 2.2 px; decisive span ≥ 55 px.

## Findings

**P0-1 — Confidence ignores the neutrality it has just found.** In `solveFrameMetric` §5, the rival-neutrality
loop marks an ink neutral and then acts only if the result is a swap or a tie (`rivalNeutral` is filled only in
those branches). `confidenceOf(selected, rival)` is then computed on the selected scale's whole counted set. On
dabecjach `810` (printed 850) has the bounded value `850`, which sits on the rival 2.810 at 0.5 px. It was found
neutral, kept counting, and supplied the Y axis and the corroboration that made STRONG. The same thing happens
with `confidenceOf(legacyEvidence, …)`.

**P0-2 — Glyph evidence is never consulted.** A witness is `decisive` when it has a primary binding, a span of at
least 25·tol, a cap height of at least 10 px and no leading zero. The only OCR number used is `token.confidence`,
and only as a weight factor. Across every counted witness it lies between 0.50 and 0.75, so it cannot tell inks
apart: `1501` has 0.514 and the correct `888` has 0.517. The `1501` ink has a glyph scored 0.164 whose cell has
**2 holes** but was read `0` (1 hole), with a runner-up at **0.946** of it. That makes it the weakest reading on
any measured sheet, yet it carried the X axis and the "overall" place in the tuple.

**P1-1 — Hidden runner-ups.** `classifyCell` lists alternatives only above an absolute score of 0.2, but
`confidence = best/(best+second)` still encodes the second-best: for `1501`'s third glyph a runner-up at 0.1555
(ratio 0.946). §AB says "no runner-up", `boundedValues` is empty, V4 `valueAmbiguity` cannot fire. Any class must
take its ratio from `confidence`, (1−c)/c, not from `alternatives`.

**P1-2 — Rival neutrality is one-directional, and the two V3 tolerances differ.** On tunbergiach the rival 1.995
rests only on `1117`. That ink's bounded value `1177` fits the selected 2.092 at 2.6 px, inside the rival bound
`tol·(1+min(1, px/widest)) = 4.4`. So `1117` is neutral, but `b.kept = []` and `a.kept = [1000]` match neither
branch. The rival keeps equal standing (weight ratio 0.920 ≥ 0.8), which gives INCONCLUSIVE. Against the page vote,
`neutralAt` uses plain `tol` (2.6 > 2.2), so the same ink counts as "1 independent reading" for the vote's 1.9947
and blocks `beatsLegacy`. **With neutrality applied symmetrically and one tolerance, 005D's own evidence gives
REPLACED/WEAK at 2.092** (the printed scale is 2.09). The two-substitution value `1173` in the 005E lattice sits
0.7 px off 2.092, so the outcome does not depend on the 2× bound.

**P1-3 — The hierarchy test aims at the wrong rival.** `undecidedConflict` takes `rival` from the evidence-tuple
order. On dabecjach that is 3.571 (`1700`, Y, 0.814 share), not 2.810. Conflict 1 (`1501` against `888+643=1531`)
has no rival member in its pair. Conflict 2 (`1700` against `810+141=951`) has `1501` outside its pair, so
`every(inPair)` fails. Separately, selectedMembers (2) > rivalMembers (1). CONFLICT_AS_READ cannot be a trigger on
its own: it also occurs on correct totals whose children are misread (marcowki `1205` against 855, modrzykach
`1160` against 1056, kosacce `1260` against 1210, zurawkach `450` against 950).

**P2-1 — A report error.** §AB says "rival 2.81 (`888`) at 54 %"; 54 % is 3.571's weight (4.777/8.826), 2.81 has 37 %.

**P2-2 — SUPPORTED is the boundary that matters, not STRONG.** Downstream only `firstReadingNeedsChallenge` reads
confidence (≥ SUPPORTED skips the challenge), plus the warnings and the v2 INCONCLUSIVE rewrite. A rule that only
stops STRONG but lets two ambiguous wrong reads reach SUPPORTED still skips the challenge.

**P2-3 — A topology contradiction alone is not low quality.** kosacce `204` is right (fits at 0.7 px) though its `0`
was read on a 2-hole cell (score 0.345); the low-quality signal must be the score floor.

**P2-4 — Candidate agreement happens by chance.** Between two counted witnesses of the selected scale, the reader's
own alternatives agree on some distinct scale on kosacce (1 hit with one substitution, 5 with two) and on
modrzykach (1 hit with two, at 3.57). Candidate-only consensus must never select a scale and must be gated (§C3).

## Root cause

Corroboration (`corroborated`, `axesMeasured`) assumes that two inks agreeing on a scale fail independently. That
holds only when each ink's reading is decided. Both dabecjach witnesses are undecided by the reader's own numbers:
`1501` is a segmentation failure (score 0.164, a 2-hole cell read as `0`, runner-up hidden at 0.946), and `810` is
a classifier coin toss (`1` 0.3956 against `5` 0.3878, same topology). Their agreement within 0.4 % (2.6708 and 2.6821) is a coincidence of two errors, and nothing in the solver knows
that each was a coin toss. Behind them stand an ink read CLEAR that states 2.810 (`888`: three `8`s, each cell with
2 holes, so the `0` runner-up contradicts the topology) and two misreads whose lattices contain the truth (`810` →
`850`; `1700` → `1340` with two substitutions at ratios 0.993 and 0.904, 0.8 px off 2.81). V3 found `810` neutral
and threw that finding away (P0-1). Nothing weighs reading quality (P0-2).

## Measurements

**dabecjach, selected copy `rzut-1a56066c62`** (the twin `03a05dd085` is identical; longest chains X 562, Y 584.5).
Weight = conf·px/50.

| ink (printed) | axis/span/share | implies | glyphs: score, runner ratio (topology) | class |
|---|---|---|---|---|
| `1501` (1580) | X 562 1.00 | 2.6708 | 1 .565/.33 · 5 .420/.59 · **0 .164/.95 hidden, cell 2 holes ≠ `0`** · 1 .426/.69 | LOW_QUALITY |
| `810` (850) | Y 302 .517 | 2.6821 | 8 .399/.85 (runner `0` topology ≠) · **1 .396/.98 vs 5** · 0 .563/.47 | AMBIGUOUS; `850` fits 2.81 at 0.5 px |
| `888` (888) | X 316 .562 | 2.8101 | 8 .376/.93 ×3, every cell 2 holes, so the `0` runner-up is topology-excluded | CLEAR (raw: AMBIGUOUS) |
| `1700` (1340) | Y 476 .814 | 3.5714 | 7 .450/.99 vs 3 · 0 .292/.90 vs 4 | AMBIGUOUS; L2 `1340` fits 2.81 |

Tuples: 2.672 (`1501`+`810`) [1,1,1,2,8.83]; 3.571 (`1700`) [0,0,1,1,4.78]; 2.810 (`888`) [0,0,0,1,3.27]. Rival
neutrality against 2.810: `810` neutral, `888` kept, {`1501`} keeps the overall place, so no swap, no tie, and the
finding is discarded. Against the page vote (2.6723 vs 2.6734) V3 is not asked. Result: CONFIRMED/STRONG.

**tunbergiach, `rzut-83377e8ffc`:** `1000` (Y 478, overall; 1 .457/.50, zeros .720/.40, .646/.45, .669/.52) is
CLEAR. `1117` (printed 1173; X 560, overall; 1 .485/.93 vs 7, 7 .436/.93 vs 3) is AMBIGUOUS. Tuples
[0,0,1,1,6.30] and [0,0,1,1,5.80]; tie at weight ratio 0.920, so LEGACY_UNCONFIRMED/INCONCLUSIVE (P1-2).

**Development counted witnesses** (decided orientation, PRIMARY, INDEPENDENT, ≥ 55 px, h ≥ 10, one per region).
"raw r" = max per-glyph runner ratio from `confidence`; "topo r" = the same, with runner-ups whose hole count
contradicts the cell excluded.

| house (005D) | witness: share, min score, raw r → topo r, class |
|---|---|
| marcowki CONFIRMED/STRONG | `1205` X 1.00, .499, .94 (2 vs 1) → .94 **A** · `510` Y .34, .414, .72 → .72 **S** |
| dom-w-zurawkach CONFIRMED/STRONG | `1180` X 1.00, .344, .92 (8 vs 0) → .38 **C** · `750` X .64, .438, .78 **S** · `800` Y .84, .440, .80 → .45 **C** · `150` Y .16, .601, .72 **S** |
| dom-w-modrzykach REPLACED/STRONG | `1850` X 1.00, .308, .99 (8 vs 0) → .61 **C** · `1160` Y 1.00, .278, .99 (6 vs 0) **A** · `621` X .34, .278, .97 **A** · `684` Y .59, .343, .90 (4 vs 9) **A** |
| rarytasy-eoze REPLACED/STRONG | `1601` X 1.00, .323, .71 **S** · `760` Y .98, .348, .81 **S** |
| kosacce CONFIRMED/SUPPORTED | `1260` .389, .79 **S** · `204` .345, .74, winner on a 2-hole cell **S** · `370` .459, .93 **A** |
| willa-miranda CONFIRMED/SUPPORTED | `1500` .431, .72 **S** · `700` .478, .89 **S** · `800` .308, .99 → .52 **C** |
| jablonkach / azalia REPLACED/WEAK | `1100` .358, .52 **C** · `1055` (printed 1035, a misread) .458, .79 **S** |

**What the classes separate.** The 21 counted witnesses that fit the final scale (correct reads) have min glyph
score ≥ .278; 9 of 21 have raw r ≥ 0.9, 5 of 21 with topology; classes 7 C, 9 S, 5 A, 0 L. The 5 known misreads:
`1501` L, `810`/`1700`/`1117` A, `1055` S. Of 52 counted-shaped readings that miss the final scale (misreads or
misbindings), 10 score below 0.25; none of the 21 correct ones do. Glyph margin alone does not separate right from
wrong (`1850` right at raw r .994, `810` wrong at .98); topology does (`1850`'s and `888`'s `8`s are 2-hole cells,
while `810`/`1700`/`1117` are 0-hole coin tosses). What a class cap would do to the STRONG houses:

| cap | marcowki | zurawkach | modrzykach | eoze |
|---|---|---|---|---|
| ≥ 2 CLEAR (topo) | loses | STRONG | loses | loses |
| corroborating pair needs 1 C/S (topo) — **proposed** | STRONG | STRONG | STRONG | STRONG |
| same, raw ratios | STRONG | STRONG | **WEAK** → challenge | STRONG |

Floor sensitivity: 0.30 keeps every STRONG house (modrzykach loses `1160`/`621`, `1850`+`684` remain); 0.35 regresses eoze.

## Proposed contract

**C1. OCR evidence class** — per ink (one text region; every pass, orientation and 005E preprocessing variant of one
footprint is one ink). It is computed by the reader with no scale and no published fact, and stored on the
observation as `ocrClass` and `ocrClassWhy`. For the top-1 path P: `s_i` is the glyph score; `ρ_i` = (1−c_i)/c_i,
from the unfiltered runner-up, excluding runner-ups whose prototype hole count contradicts the cell's (only when
that count is the same under the ink's two binarizations and every hole has area ≥ 2 px²; otherwise the raw
ratio); `m_seq` is the image-score ratio of the best path with a **different value**, segmentation variants
included (IMAGE_SCORE = Π s_i, length-normalised as exp(n·mean log s) when glyph counts differ). Classes:

- **LOW_QUALITY**: min s_i < 0.25, or cap height < 10 px. LOW_QUALITY never counts, never decides and never
  carries a hypothesis. It stays on the record and can be bound for the chain solver as DERIVED.
- **AMBIGUOUS**: not LOW, and max ρ_i ≥ 0.90 or m_seq ≥ 0.90.
- **SUPPORTED**: max ρ_i in [0.70, 0.90) and m_seq < 0.90.
- **CLEAR**: max ρ_i < 0.70 and m_seq < 0.70, which means the reader generated no other value at the V1 bar.

Neither 0.70 nor 0.90 is new: 0.70 is the V1 `glyphRatio`; 0.90 is the coin-toss bar where 005D's own blind
misreads sit (.93–.99). The floor: an exact shape scores about 1 × priors and a topology mismatch alone halves a
score (kosacce's correct 2-hole `0` scores .345; the lowest correct witness is .278), so a cell below .25 has failed
both shape and topology — an ink or segmentation failure, not a font variant. Classes never change a value.

**C2. Confidence** — on the **deciding set** D(H): counted witnesses of H that are not LOW and not contested.

- **Contested.** A witness is contested when a reader-generated candidate fits a distinct plausible rival R within
  `tol·(1+min(1, px/widest(R)))`. Candidates are bounded to ≤ 2 substitutions with ρ ≥ 0.70 each, plus
  segmentation paths with m ≥ 0.70.
- **Standing.** R contests only if it has standing: at least one counted, non-LOW, as-read witness with share ≥ 0.25
  and with no candidate fitting H.
- **Symmetric, one tolerance.** The test applies to the selection, every rival and the page vote alike, with the
  same tolerance (fixes P0-1 and P1-2). Neutral inks leave both the ranking and confidenceOf/legacyStats.
- **STRONG** = axesMeasured ∧ corroborated on D. **SUPPORTED** = corroborated on D. In both cases the
  corroborating major+substantial pair must contain a CLEAR or SUPPORTED witness: two AMBIGUOUS never corroborate
  each other, so two AMBIGUOUS make at most WEAK.
- **WEAK** = |D| ≥ 1; **INCONCLUSIVE** = D empty. The confidenceOf rival rules then apply to D(S) against D(R).
- **No promotion.** If after demotion a rival's D outranks D(S) but has lower standing than S's class-blind
  evidence, nothing is promoted: the result is INCONCLUSIVE, exactly as the 005D `lowerStanding` rule.

**C3. False consensus** (typed `FALSE_CONSENSUS_SUSPECTED` in `topology`, with `selectedId`, `challenger`,
`demotedObservationIds`, `reason`) fires when (1) S's class-blind tier is ≥ SUPPORTED, (2) its C2 tier is
< SUPPORTED, and (3) the doubt points at a scale: (a) a rival with standing has a witness whose class is strictly
better than a demoted S witness, or (b) two AMBIGUOUS S witnesses on different chains have candidates agreeing on
one distinct plausible scale. Effect: confidence INCONCLUSIVE, relation kind kept (CONFIRMED/INCONCLUSIVE, like
today's undecided cases), so `firstReadingNeedsChallenge` challenges. The challenger is recorded and **never**
selected by this rule; a (b)-type challenger is CANDIDATE_CONSENSUS (DERIVED), never a hypothesis. Without a
counterpart the demotion simply stands (WEAK, `OCR_AMBIGUOUS_SUPPORT`).

**C4. Structural support of a total** (scale-free). This applies to a TOTAL_OF (005D `dimensionHierarchy`) whose
total ink and child inks are distinct regions: not the same footprint, not preprocessing variants of one ink, not
an ink bound both as total and as child (I2 already makes that AMBIGUOUS), and not a parallel copy (I5). Search
joint assignments drawn from each ink's bounded candidates (as-read value included; LOW inks do not take part),
using the existing agreement tolerance max(2 cm, 1 %).

If the as-read assignment conflicts and **exactly one** assignment with the minimum total of substitutions (≤ 2)
agrees, it is STRUCTURAL: its non-top values are DERIVED and the top-1 values it replaces are refuted (no longer
witnesses). A tie, or no agreeing assignment, leaves the conflict as a record; conflict alone is not a trigger
(P1-3 dev cases). The total plus its children is **one statement** whose witnesses are the children as read; a
structurally selected total never adds a corroboration. The test only removes witnesses, never creates them.
Kosacce: the correct `1260` is supported through child `840`'s candidate `890`, and `840` (the 2.27 rival) is refuted.

**C5. Selecting values among image candidates.** Each candidate records, separately and never multiplied:
IMAGE_SCORE and imageRank (reader only); STRUCTURAL_SUPPORT, scale-free (the TOTAL_OF sum of C4; the same printed
dimension on another plan copy within its candidates at imageRank ≤ 2 — support for the value, not a second scale
witness); METRIC_SUPPORT, only after a scale is chosen (residual px on the primary binding, cross-axis fit,
wall/extent consistency). Chain role and physical span decide only whether an ink can be a witness and its weight.
The value of a span, in order: (1) a top-1 that is not LOW and not refuted → AS_READ; (2) the C4 candidate →
STRUCTURAL; (3) the best-IMAGE_SCORE candidate fitting the chosen scale → SCALE_RANKED (DERIVED, as
CHAIN_CORRECTED); (4) two fitting candidates within an IMAGE_SCORE ratio of 0.90 → unresolved.

I4 as a test: only imageRank 1 enters `observationsOf` (today `substitutions === 0`; in 005E it must be the top
image path, never re-ranked by any scale). STRUCTURAL and SCALE_RANKED values never enter `bounded`, `counted`,
clusters, legacySupport or a contest resolution. Metamorphic check: delete every DERIVED value and the
FrameMetricSolution stays byte-identical.

**Replay of C1–C3 on sealed evidence** (`policy.mjs`; classes as measured above):

| house | 005D | proposed |
|---|---|---|
| marcowki | CONFIRMED/STRONG | CONFIRMED/STRONG (pair `1205` A + `510` S) |
| dom-w-zurawkach | CONFIRMED/STRONG | CONFIRMED/STRONG |
| dom-w-modrzykach | REPLACED/STRONG | REPLACED/STRONG (`1850` C; no S witness contested — rival 2.59 rests on a .16-share ink) |
| rarytasy-eoze | REPLACED/STRONG | REPLACED/STRONG |
| kosacce, willa-miranda | CONFIRMED/SUPPORTED | unchanged (rivals 2.27/1.22/2.24 lose standing: their inks are neutral) |
| azalia, jablonkach | REPLACED/WEAK | unchanged (azalia's `1055` S misread stays a residual) |
| rarytasy-g2e | LEGACY_UNCONFIRMED/INCONCLUSIVE | unchanged |
| **dom-w-dabecjach** (both copies) | CONFIRMED/STRONG 2.672 | **CONFIRMED/INCONCLUSIVE, FALSE_CONSENSUS_SUSPECTED**: `1501` L, `810` contested by 2.81 (`888` C); challenger 2.81 not promoted; `1700` contested via L2 `1340` → challenge |
| **dom-w-tunbergiach** | LEGACY_UNCONFIRMED/INCONCLUSIVE 1.9947 | **REPLACED/WEAK 2.092**: `1117` neutral (`1177`/`1173` fit 2.092), the vote has no support; WEAK → challenge, where 005D measured 2.092 → 111.9 m², −4.9 %, AGREES |

**Mandatory adversary** (on paper; the dabecjach mechanism). True scale 2.20; Y longest 420 px.

- **A** (X overall, 559 px): printed `1230`, read `1150` — glyph 2 `1` .47 over `2` .445 (ρ .95), glyph 3 `5` .42
  over `3` .40 (ρ .95), 0-hole pairs, so AMBIGUOUS. One-substitution values 1250/1130 are ≥ 9 px off at 2.20; the
  two-substitution `1230` is exact.
- **B** (Y 350 px, share .83): printed `770`, read `720` — `2` .44 over `7` .41 (ρ .93), AMBIGUOUS; its
  one-substitution `770` is exact. **Children of A** (finer X chain, CLEAR): `530`/241 px, `700`/318 px.
- The wrong reads imply 2.0572 and 2.0571 (6.5 % small, area −12.6 %).

**Old:** S = 2.057 {A, B} [1,1,1,2]; rival T = 2.20 {children} [0,0,0,2]. B is neutral, A kept; A's overall place
beats T, so no swap, no tie, and confidence is taken on the full set. A (1150) conflicts with 530+700 as read, but
B sits outside the pair, so `undecidedConflict` is false. **CONFIRMED/STRONG.**
**New:** C1 makes A and B AMBIGUOUS. C2: T has standing through `700` (C, share .57), so A (via `1230`) and B (via
`770`) are contested and D(S) is empty. C4: A's as-read value is refuted by its own children (`1230` unique at 2
substitutions → STRUCTURAL, not a witness). T's D outranks S's empty D but has lower standing than S's class-blind
evidence, so it is not promoted. **INCONCLUSIVE, FALSE_CONSENSUS_SUSPECTED → challenge.** Without the children: the
class rule gives WEAK and C3(b) fires (`1230` and `770` both state 2.2003) → INCONCLUSIVE. Without the two-substitution
lattice as well: WEAK, still below the fast path.

## Risks and negatives

- **The modrzykach STRONG depends on topology-aware margins.** With raw ratios all four witnesses are AMBIGUOUS.
  The house falls to REPLACED/WEAK (the scale is unchanged, but the challenge is triggered). If 005E does not
  implement the guarded topology rule, use the fallback: ≥ 3 deciding AMBIGUOUS inks on ≥ 3 chains and both axes
  may corroborate, capped at SUPPORTED. This is the one clause chosen with a named house in view; its generic
  argument is that three coincident misreads are about p² as likely as two.
- **Topology can lie.** Blur fills a counter (8 → 1 hole), or turns a 5 into a looped shape. That is why the
  2-binarization stability guard and the hole-area guard exist. Without them a blurred misread can come out CLEAR.
  The `it.fails` anti-aliasing cases are exactly this family; test C1 against them.
- **A confident misread is invisible to the class.** azalia `1055` (ρ .79, SUPPORTED) would still corroborate if a
  second ink agreed. The classes reduce false consensus; they do not detect misreads. 4 of the 5 known misreads are
  flagged only because they were coin tosses or a segmentation failure.
- **A wider 005E lattice means more contests by chance.** C2 only lowers confidence, but on the dev set that means
  WEAK and then a challenge. Measured with two substitutions: no S witness contested, and candidate consensus on
  kosacce/modrzykach that C3's gates suppress. Re-measure with the real 005E lattice (segmentation paths included)
  on all houses before freezing.
- **The thresholds are close to the data**: floor 0.25 against a lowest correct .278 (n = 21, 9 houses); the 0.90
  bar sits near `684`'s 0.904. Floors 0.17–0.27 and AMBIGUOUS bars 0.85–0.95 leave every replayed outcome unchanged
  (`1117` becomes SUPPORTED at 0.95 but stays neutral). Thin samples.
- **dabecjach is not repaired by this**: it becomes a typed INCONCLUSIVE plus a challenge; completing depends on the
  resolver ranking 2.81 (decided by `888` alone) and on the B_STRICT/B_EXCLUSION outline (§AA). No value is mutated,
  no candidate invented, no candidate-consensus scale selected, and no published figure read.
