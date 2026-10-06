# 005I post-implementation council — resolution (Track A, reviewers A and E)

Reviews: `reviewer-A-topology.md` (CHANGES REQUESTED, two P1) and `reviewer-E-generalization.md` (CONDITIONAL PASS, two
P1, one of them Track B). Reviewers B (boundary / CV), C (licensing) and D (deployment) review Track B: their files and
resolutions sit beside these. Every P0 / P1 is fixed and held by a test that fails when the fix is removed; P2 / P3 are
fixed or stated below with the reason they are not.

| id | sev | finding | resolution | held by |
| --- | --- | --- | --- | --- |
| A1 / E5 | P1 | wall refutation moved a side to the nearest tick anywhere in the overshoot (a window jamb), kept it strong, and refuted `OUTER_TOTAL_MARKS` sides | the side moves only to where a dimension line out there **ends** (its first or last TICK), within a wall of where the contradicting walls end, and only if no two walls still run on past it; otherwise DOWNGRADED. Either way the frame is **weak** (the resolver weighs it). `OUTER_TOTAL_MARKS` and wall-framed sides are never asked | `end-spans.test.ts` §16: jamb tick ignored, short line downgrades, outer-total side not asked, move is weak |
| A2 | P1 | a real tick whose arms labels cover on both sides was REJECTED as label ink | contact test: ink outside every glyph in the two rows next to the line, inside the hit run, is a stroke reaching the line — that side is not label ink. Plus two rules the development matrix asked for (G2E): label ink is a label printed **along** the line (text axis = line axis), and a **numeral** (≥ 2 digit glyphs, ≤ 1 other) | `axis-topology.test.ts` §11 (three cases; each fails with its rule removed) |
| E1 / A5 | P1 | the side cost was ISO hard-coded and computed in the label's reading frame, so a label read the other way up, or a sheet printing below/right, flipped it | the side is the **page** side of the ink (BEFORE / ACROSS / AFTER), never the reading frame; the convention is the **sheet's**: stated by its uncontested labels (≥ 4 and 4:1), withdrawn when contradicted (≥ 2 AFTER, no fewer than BEFORE), ISO otherwise. Recorded per frame (`sideConventions`) and per candidate (`againstConvention`) | `axis-topology.test.ts`: (17) other convention stated, (18) ISO right-hand margin, (19) sparse other convention never mis-binds, misread orientation binds alike, the rule table, in-line labels |
| E6 | P1 | Track B: synthetic MobileSAM prompts / selection came from the truth extent | Track B: synthetic extent replaced by the production `planExtent`; see the bake-off methodology §11 | Track B |
| A3 / E9 | P2 / P3 | an AMBIGUOUS label carried the tie-break `chosen`, and the Evidence Pack counted it as support | `chosen` only when BOUND; the pack's support / conflict and the SVG link only for BOUND | `axis-topology.test.ts` record case |
| A4 / E4 | P2 | `alignedEnds` accepted any neighbour mark (interior, doubted) and was not matched to the segment's end | aligned only where a neighbour **ends** (its first / last TICK) at the chain's own first / last TICK, and the end span must end at that tick | `axis-topology.test.ts` axis-group case; `end-spans.test.ts` |
| A6 | P2 | `centred` recorded as true on the page vote; the feature set is partial | `centred` is computed and recorded always (costed only with `preferCentred`). The cost stays offset + side against convention + centring: end-mark class, nesting order and contamination are **not** costs — a stated deviation from the §12 list (the mark classes act earlier, on the measurement chain) | record case |
| A7 | P2 | an unread, unlabelled end segment shorter than two walls is trimmed with no signal even where walls reach into it | **not changed** in 005I: keeping or flagging it would be a new wall-to-dimension rule with model effects on every sheet with a wall-thickness end span, decided without a development measurement. Recorded as a known limit (every trim is on the record, `EndSpanDecision`) | — |
| A8 | P3 | ties refuse both labels | intended (§13 / §17); its upstream causes (A2) fixed | §17 cases |
| A9 | P3 | dedupe kept whichever of two same-key tokens came first | survivor chosen by a full canonical detail key (height, scores, glyphs) | record case |
| A10 | P3 | case (10)'s expectation was loose | pinned: CONFIRMED / WEAK | `dimension-topology.test.ts` (10) |
| A11 | P3 | doc and record gaps | `labelHeightOf` doc corrected; `NO_CANDIDATE` removed from type and schema (a label with no line is no label); bounded path no longer calls an unassigned label AMBIGUOUS; `planExtent` records the end spans of `chainsIn` — stated in architecture.md | — |
| E2 | P2 | the corpus copied the blind case | (16) lettering 13 / 16 / 22 px × separations 1.5 / 2.5 / 3.8 label heights × scales 2.0 / 2.5 / 3.2 cm/px, values unrelated to any house; (17–19) conventions; token cases for misread orientation and in-line labels | `dimension-topology-synthetic.json` |
| E3 | P2 | the §8 test checked names, not data flow | import closure of everything that decides what binding sees; call order (every chain / solver / grouping step before the specifications are read); the production entry with no / two different published-fact sets seals byte-identical topology and chains; forbidden-word list widened | `tests/architecture/dimension-topology.test.ts` |
| E7 | P2 | Track B: a post-scoring change not recorded | Track B methodology §11 | Track B |
| E8 | P2 | the isolation gate did not cover runners | `packages/*/scripts`, `apps/*/scripts` and app bundler configs scanned | `tests/architecture/research-isolation.test.ts` |
| E10 | P3 | DOWNGRADED feeds a challenge the figure can veto | stated in architecture.md (veto, never selector; the challenge re-decides no binding or end span) | architecture §8 test (end-span rules read no published fact) |
| E11 | P3 | `performance.json` missing | written from the final matrix by the topology probe (`performance.json`; see D3) | — |

## Reviewer C — licensing (`reviewer-C-licensing.md`, CONDITIONAL PASS, no P0 / P1)

| id | sev | finding | resolution |
| --- | --- | --- | --- |
| C1 | P2 | the DeepLSD refine path is not "BSD/MIT/MPL/Apache": GC-RANSAC bundles gco-v3.0 (research-only, patent notice); distro Ceres links GPL-2+ SuiteSparse | corrected in the licensing matrix, the dependency matrix and the recommendation; the refine row's worst open item is the research-only clause |
| C2 | P2 | ONNX tooling misdescribed and unpinned; onnxruntime-web's licence unrecorded | tooling table added (torch.onnx BSD-3, onnx 1.17.0 Apache-2.0, onnxruntime-web 1.30.0 MIT); onnx pinned in `build.sh` and `manifest.json`; exported graphs carry the weights' licence and provenance |
| C3 | P2 | isolation-gate gaps (checkpoint extensions, build scripts, version catalog, app / root manifests) | `.tar .ort .pkl .h5 .pb .gguf` refused anywhere, `.bin` outside the BUILDAPP-03R byte cache; `build.*` scripts of apps and packages scanned; `libs.versions.toml` read; root and app `package.json` dependencies checked |
| C4 | P2 | the mirror's weight licence not conditioned on provenance | "MIT (authors) only if byte-identical to the official file — unverified" |
| C5 | P3 | OpenCV ≥ 4.10 ships an Apache-2.0 LSD | nuance added to the deployment estimate; not a drop-in for pytlsd's variant |
| C6 | P3 | MobileSAM weights "implied" | decoder licence stated by Meta (Apache-2.0); SA-1B attribution cited to the paper, not the README |
| C7 | P3 | "audited before any external code was executed" overstated | "before any provider was run" |
| C8 | P3 | attribution | none missing; nothing redistributed |

Pre-existing, outside 005I: the repository has tracked `.cache/source-bytes/*.bin` (publisher bytes) since BUILDAPP-03R
(2026-09-16). None is a frame of the bake-off (reviewer C compared hashes), none was added in 005I, and removing them
is an OWNER decision (it would not remove them from history). Recorded in the stage report.

## Reviewer D — deployment, determinism, bounds (`reviewer-D-deployment.md`, no P0)

| id | sev | finding | resolution | gate |
| --- | --- | --- | --- | --- |
| D1 | P1 | the metric-evidence hash did not cover the 005I fields reconstruction reads | from schema 1.7.0 every chain member hashes its marks (position, class, sorted reasons), each segment's `labelled` and the chain's `topology`, and the set hashes `dimensionTopology`; a 1.5.0 set re-hashes to its stored hash | `hash-topology.test.ts` |
| D2 | P2 | the "bounded" path was not bounded | a neighbourhood whose solve would cost more than `ASSIGNMENT_BOUNDS.solveWork` (n² · (slots + n) = 6·10⁸, about a second on a desktop core) is not solved: its labels are UNASSIGNED, `bounded`, counted `unsolved` — a gap on the record, never a guess. One checkpoint tick per neighbourhood, before its solve, from every caller that has a checkpoint (`solveFrameChains`, the 005B per-orientation bindings, the final re-read). `assignLabels` returns `stats` (neighbourhoods, largest, exact, bounded, unsolved) | `axis-topology.test.ts` §43 D2 (one 120-label neighbourhood: bounded, solved; one above the work bound: unsolved, every label a gap, one tick); §43 stress still 480 BOUND |
| D3 | P2 | no evidence that real sheets stay under the bounds | `topology-probe.ts` reports the neighbourhoods met (count, largest, exact / bounded / unsolved) per frame and in total; run over the final development matrix → `performance.json` and `order-invariance.json` | — |
| D4 | P3 | `dimensionAxisGroups` was not permutation-canonical | pairs are taken by canonical position (baseline, then chain id), not by input index, so which of two equal ranges CONTAINS the other does not depend on the order lines were found in | `axis-topology.test.ts` D4 (all 24 orders of four lines, two with equal ranges); the probe shuffles lines on every sealed frame |
| D5 | P3 | the pack's version compare was lexicographic | `compareVersions` (numeric, per component) in `requiredFiles` | `evidence-pack/test/versions.test.ts` |
| D6 | P3 | schema 1.7.0 changed shape inside the stage | sets written at `c150896` (side `BASELINE / THROUGH / TOP`, no `sideConventions`) are **void**: none is committed, none is evidence for this stage, and every figure in the report is from the final code. The stale "1.5.0 set" comment in `extract.ts` is corrected | — |
| D7 | P3 | reconstruction behaviour changed with no version naming it | `PLAN_EXTENT_VERSION` 1.0.0 (end spans, `refuteByWalls`) in `ANALYZER_VERSIONS` (run record and Evidence Pack manifest); the result contract is unchanged | — |
| D8 | P3 | Track B: stale APK baseline, "peak RSS" | sent to Track B: percentages against 005H's 39 419 927 B APK; "RSS after inference (a lower bound on the peak)" | Track B |
