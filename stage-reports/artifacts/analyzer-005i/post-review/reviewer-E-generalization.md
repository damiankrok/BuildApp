# Reviewer E (generalization / non-circularity): 005I post-implementation review

**Verdict: CONDITIONAL PASS. No P0 found.** I traced every production path into label binding, end-span keep/trim and wall refutation, and no published figure, area, reconstruction outcome or house identity reaches any of them. Production code has no house constants or family names. The round-8 exclusions are correct and complete. Research is isolated from production. Two P1s remain:
- **E1:** the new side-of-label cost is a fixed drawing convention that also depends on which way up the OCR read the label, and nothing in the corpus tests either.
- **E6:** on the synthetic sheets, the MobileSAM prompt and mask selection are taken from the answer.

Reviewed at `c150896` plus `45dd8ba`. That second commit landed during the review and holds the round-8 protocol, the research-isolation test and `.gitignore` for `__pycache__`. I ran `tests/architecture/dimension-topology.test.ts`: 7/7 green. My scratch scripts are in `/tmp/claude-0/reviewE/`. I edited nothing in the repo.

## What I checked and found clean
- **House constants:** grepped the added production code (`packages/*/src`) for 23.5 / 24 / 1100 / 900 / 596 / 562 / 216.76 / 853 / 2.716 and for jarzab / arkadi / other development family names. Nothing. Every threshold is in label heights or wall thicknesses, apart from the small pixel pads in `LABEL_INK_BOUNDS` (1 / 2 px).
- **Published facts vs binding:** `extract.ts` reads published specifications only at line 823, after the per-frame loop (binding happens at lines 386–458). `assignLabels`, `assignTokens`, `solveFrameChains` and `solveFrameMetric` are called only inside `source-metrics`. No resolver or reconstruction path re-runs binding.
- **Value-blind cost:** `labelCandidates` cost uses offset, side and centring only (`axis-topology.ts:185-187`). Text enters only the canonical sort key and the dedupe. Exact ties come out AMBIGUOUS, so ordering decides nothing.
- **Round 8 exclusions:** I recomputed them from `select.mjs` `family()`.
  - All 13 families drawn in the ledger for rounds 1–7 are excluded.
  - So are all 14 `developmentFamilies()` from the sealed packages and the 7 bake-off houses.
  - The list is a strict superset of round 7 plus the 2 draws plus 19 linked families.
  - The file is sorted and its SHA-256 is `4202abe0…`, as the README says. 2137 addresses are drawable and 948 excluded, as stated. The seed label matches.
- **Isolation:** `research/` is not a workspace and is in neither the tsconfig nor the vitest include. No `packages/*/src` or `apps/*/src` file imports it. Checkpoints live outside the repo, and `.pyc` is now gitignored.
- **Real truth vs BuildPlan output:** I spot-checked an annotation crop (`/home/user/work005i/look/j1.png`). It is a plain grid with no provider or BuildPlan overlay. Each truth scale is taken from printed overall dimensions.

## Findings

**E1 — P1 — the side cost is a fixed convention and flips with the OCR orientation**
- **Where:** `packages/source-metrics/src/axis-topology.ts:61` (`topSide: 1`), `:90-112` (`readingFrame` / `labelSide`), `:187`.
- **Problem:** the cost penalises a line beyond the glyph tops, which is the ISO 129 "number above the line" convention. That is the blind-7 sheet's convention, applied to every sheet. It is never learned from the sheet. It is also computed from the token's orientation hypothesis (CW vs CCW, HORIZONTAL vs INVERTED). The final assignment uses `corrected` tokens, whose orientation can be swapped per chain by a scale decision (`metric-solution.ts:1258-1268`).
- **Scratch reproduction** (`/tmp/claude-0/reviewE/side.ts`, `orient.ts`) on the architecture test's own geometry (lines at x 60 / 84, parts 120/160/520/560, H = 16):
  - **Labels on the other side of their line** (tops toward their own line, e.g. ArchiCAD "below"), middle part unread: `1100:BOUND:1#1:m=1`. The overall's number is bound, confidently and not AMBIGUOUS, to the parts line's middle interval. This is the mirror image of the blind-7 failure.
  - **ISO sheet read the wrong way up** (CCW), overall unread: all three part labels come out AMBIGUOUS with margin 0, and the parts chain loses every number. Blind-7's second copy was in fact read the other way up by the page vote (`baseline.md`, "Reproduced").
- **Why it matters:** the brief requires source-relative rules. This one is a constant direction chosen to fit the failing house, and nothing tests the other convention (E2).
- **Fix:**
  - Infer the sheet's side convention per axis and orientation from labels that have only one candidate line. Apply `topSide` only to the side the sheet does not use. Use 0 when that cannot be decided, or when the chain's orientation was decided only by a scale.
  - Add pixel cases for the other convention and for a misoriented read.

**E2 — P2 — the synthetic corpus copies the blind case and varies nothing that matters**
- **Where:**
  - `packages/source-metrics/test/axis-topology.test.ts:29-30,95-118`
  - `tests/architecture/dimension-topology.test.ts:94-97`
  - `packages/reconstruction/test/end-spans.test.ts:43-44`
- **Problem:** the default `margin()` is overall `1100` over parts `100/900/100`, lines 24 px apart (blind: 23.5), `nearGap` 3 (blind: 3.5 vs 4), cap 16 (blind: about 15.5). Every multi-line pixel case uses 24 px spacing, CAP is always 16, and the scale is always 2.5. The file's claim "nothing here is the blind-7 drawing… at this file's own numbers" is not accurate.
- **Coverage gaps:**
  - No case has labels below or right of their line (TOP side).
  - No case has in-line (THROUGH) labels.
  - The only INVERTED or CCW labels come from case (14), which rotates the whole page 180°. It asserts nothing about the inverted horizontal labels, and builds a mirrored raster `m` it never uses.
  - The true ISO right-hand margin is untested: bottom-to-top text with the overall's own label between the two lines.
  - The `extraInner` option is declared but unused.
- **Consequence:** no test changes separation relative to `AXIS_GROUP_BOUNDS.separationHeights` (4 h) or `maxOffsetHeights` (2.2 h), and none changes cap height relative to the pixel pads in `LABEL_INK_BOUNDS`.
- **Fix:** parametrise separation (for example 1.0, 1.5, 2.5 and 3.8 h), cap (10 / 16 / 28 px), scale and values unrelated to the blind house. Add the convention families listed above.

**E3 — P2 — the §8 architecture test checks names, not data flow**
- **Where:** `tests/architecture/dimension-topology.test.ts:29,40-73`.
- **What it covers:** the import allowlist covers only `axis-topology.ts`. The forbidden-word regex covers that file plus three function bodies (`markLabelInk`, `dimensionChainsOf`, `labelInkOf`).
- **Uncovered callers:** `solveFrameChains` (`chains.ts`) and `solveFrameMetric` (`metric-solution.ts`). Those two decide the token set, orientation swaps and `maxOffsetHeights` that binding receives. `metricEvidenceSteps` is also uncovered, and it already imports `readSpecifications` / `PublishedSpecificationInput` (`extract.ts:51-52`).
- **Concrete sneak path:** at `extract.ts:458`, pass `maxOffsetHeights: f(options.specifications)`, or filter `corrected` by a value near the published figure, inside `solveFrameMetric`. Every test stays green.
- **The regex is easy to dodge:** M5 was caught only because the parameter was called `publishedFootprintM2`. The regex also misses `truth`, `oracle`, `benchmark`, `spec`, `figure` and `target`. The behaviour test calls `assignLabels` directly, not the production entry point.
- **Fix:**
  - Add a behaviour test that runs the synthetic corpus through `extractMetricEvidence` with different `specifications`, or none at all. Assert byte-identical `dimensionTopology` and `chains`.
  - Extend the import check to the import closure of `chains.ts`, `metric-solution.ts` and `dimension-lines.ts`.
  - Assert that `options.specifications` is referenced only after the frame loop.

**E4 — P2 — `alignedEnds` accepts any neighbour mark, not a neighbour's end**
- **Where:** `axis-topology.ts:461,470-478`; consumer `plan-decomposition.ts:817`.
- **Mismatch:** the docs (architecture.md, `endSpanSupport` JSDoc, end-spans test title) say "a neighbouring line *ends* at the same mark". The code sets `alignedEnds` when *any* mark of any group member lies within tolerance of the chain's end, and does not check that mark's class. A QUESTIONABLE `TEXT_INK` mark counts.
- **Scenario:** a three-line margin (overall / rooms / openings). The rooms chain has an unread terrace stub. Its end lines up with an interior opening tick on the openings chain, because extension lines cross all lines. The stub is KEPT_SUPPORTED and the frame grows into the terrace. No test exercises this: end-spans sets `topology` by hand.
- **Fix:** require the neighbour's first or last tick (`range(chains[b])`) with class TICK. Add a pixel case where the alignment comes from an interior mark.

**E5 — P2 — the wall-triggered move to an alternate mark is recorded as a dimension frame**
- **Where:** `plan-decomposition.ts:931-976`.
- **Problem:**
  - The walls decide both whether a side moves and the window it moves within.
  - Within that window, the code takes the *nearest* TICK on any non-INTERIOR chain of that axis. It does not check whether that tick is a chain end, bounds a labelled span, or has anything read on it.
  - The result keeps `provenance` DIMENSION_CHAIN_EXTENT and stays not weak, so `framedByItsChains` lets the resolver skip its challenge (`plan-resolution.ts:917`).
- **Scenario:** two wall-thick terrace or retaining walls run past the west side. An interior tick on a top-margin chain (a terrace or window position) lies inside the overshoot. The side jumps there and is trusted as dimension-stated.
- **Fix:** give such a move its own provenance, or mark it weak. Alternatively require the tick to be a chain end or a read segment boundary, and test that this path pushes the plan into the resolver's challenge rather than the fast path.

**E6 — P1 (Track B) — synthetic MobileSAM prompts and selection come from the truth**
- **Where:** `research/analyzer-005i-boundary-bakeoff/extract-synthetic.ts:86,110`; `baseline.ts:132`; `providers/msam_run.py:50-51`; methodology §5 and §7.1.
- **Problem:** on the synthetic corpus, `b.extent` is the bounding box of the truth outer faces. It becomes `msamPrompt.extent`, which drives:
  - the MSAM-BOX box;
  - the negative points for MSAM-SOURCE-PROMPTS;
  - the selection window for MSAM-AUTO ("largest mask inside the extent").
- **Why it breaks the brief:** this is a prompt and a selection taken from the answer, which the brief forbids. It strongly favours a box-prompted segmenter over line detectors, which never use the extent, so "favours both equally" does not hold across providers.
- **Fix:** the synthetic sheets print dimension chains, so run the production `planExtent` on them as for the real houses. Otherwise label every synthetic MSAM row ORACLE_PROMPT and keep it out of the scorecard and recommendation, the way the oracle upper bound already is.

**E7 — P2 (Track B) — a post-scoring change is not recorded**
- **Where:** `stage-reports/artifacts/analyzer-005i/boundary-bakeoff/methodology.md:227-229`.
- **Problem:** §11 still reads "(none yet)". But `score.py:647` says the TRIVIAL-EXTENT / TRIVIAL-BOX comparators were "added after the first scoring run, §11". `/home/user/work005i/LOG.md` gives the reason: "MSAM-BOX high IoU on rectangular houses -> need trivial box comparator (added)".
- **Fix:** record it in §11 before the recommendation is frozen. The bake-off is still in progress, so this may just be pending.

**E8 — P2 — the isolation gate does not cover the blind runner**
- **Where:** `tests/architecture/research-isolation.test.ts:44-49`.
- **Problem:** `productionSources()` scans `packages/*/src`, `apps/*/src`, Android Kotlin and `*.gradle.kts`. It does not scan:
  - `packages/*/scripts`. This includes `packages/analysis-service/scripts/second-house.ts`, the exact entry the round-8 runs use ("production analyzer only").
  - `apps/local-analyzer/scripts`, where a bundler alias could pull research in.
- **Today:** none of these imports `research/` (I grepped), but the gate would not notice if one did.
- **Fix:** add `packages/*/scripts/**` and `apps/*/scripts/**`, or better, the import closure of `second-house.ts` and of the local-analyzer bundle entry.

**E9 — P3 — refused labels still carry an order-dependent `chosen` in the record**
- **Where:** `axis-topology.ts:384`; `extract.ts:491`; `evidence-pack/src/pack.ts:520`.
- **Problem:** an AMBIGUOUS decision keeps `chosen`, which is the Hungarian method's tie-break pick and therefore depends on canonical order. The Evidence Pack puts that chain into `supportIds` and leaves it out of `conflictIds`, for a label that was refused. The solver is unaffected, but the record says a tie was handed out.
- **Fix:** emit `chosen` only when the status is BOUND.

**E10 — P3 — DOWNGRADED leads into a challenge the published figure can veto**
- **Where:** `plan-decomposition.ts:976` → `plan-resolution.ts:917-933`.
- **Problem:** a DOWNGRADED refutation sets `weak`, which now triggers the resolver challenge. There the published figure acts as a veto ("no worse against the figure"). It is not a selector and the mechanism predates 005I, but 005I adds a new trigger into it.
- **Fix:** state this in architecture.md §8. Add a test that the challenge never re-decides end spans or label bindings.

**E11 — P3 — `performance.json` is referenced but missing**
- **Where:** architecture.md, "Bounds (§43)".
- **Problem:** the doc cites `performance.json` "on development frames", but no such file is in `stage-reports/artifacts/analyzer-005i/` or tracked anywhere. The 96-label `componentLabels` bound and the "none on any development sheet" claim therefore have no committed evidence.
