# 005A — Council implementation decision

Written after the seven pre-audit reports (`pre/reviewers/`) and the synthesis (`pre/10-council-synthesis.md`),
before any production code of this stage. Binding for the implementation commits that follow.

## 1. Why does the current analyzer generalize poorly?

Because it is a serial pipeline of single winners closed by a terminal gate on the first reading. Each
decision — which plan copy, which extent, which scale, which OCR orientation, which region merge — is
made once, from one signal, and never reopened; the published footprint then kills the run instead of
choosing among readings. A house passes when every single winner happens to be right on it. Measured:
each copy of one drawing, alone, completes in 4 of 16 cases; copies of one drawing disagree about the
sheet's width by 1.15–3.5× in 4 of 4 projects; harmless image perturbations change the e-OZE scale
three ways. The tracking-query "failure" is identity drift plus a phone that received one plan copy of
four; the 63 % plateau is a 164–193 s pass that emits nothing.

## 2. Top five root assumptions

1. One plan copy per storey, first success wins (`layout.ts:177-246`) — ASSUMP-SOURCE-004.
2. The extent is the widest READ chain; walls outside it are deleted (`plan-decomposition.ts:698-811,1206`) — ASSUMP-DIMENSION-002 / WALL-001.
3. One pooled scale; losing readings rewritten to agree and reused as anchors (`chains.ts`, `extract.ts:765`) — ASSUMP-SCALE-001 / DIMENSION-001.
4. Largest-first region merge with a 0.35 cliff that drops a body whole (`plan-decomposition.ts:1543`, `layout.ts:890`) — ASSUMP-BODY-001.
5. The published footprint as a terminal gate on the first reading (`layout-gate.ts:145`, `plan-diagnostics.ts:106`) — ASSUMP-BODY-002.
(Close sixth: one OCR orientation per page, `ocr.ts:829` — deferred, see 09 #2.)

## 3. Which modules change

| Module | Change | Commit |
| --- | --- | --- |
| `packages/source-package` | logical identity (`logicalSourceUrl`), evidence-only content hash, final URL on cache hits, retry-once on transient asset errors, claimed role on failures, abort is not a timeout, body deadline | `refactor(source): make logical project identity tracking-query invariant` |
| `packages/source-common` | `progress.ts`: `Checkpoint`, `AnalysisProgressEvent` types, `NO_CHECKPOINT` | `feat(analyzer): add candidate and progress tracing` |
| `packages/source-analyzer` | ticks per asset and per preparation step; lazy `thinSegments` | same + `perf` part of the telemetry commit |
| `packages/source-metrics` | ticks per frame / OCR pass / callout ring; bounded callout render cache (results identical) | telemetry commit |
| `packages/reconstruction` | `resolver/` (plan-copy, extent, scale, merge, face hypotheses; scoring; acceptance; `PLAN_RESOLUTION_INCONCLUSIVE`), optional hypothesis plumbing in `readPlans`/`decomposePlan`/`axisLadder`/`inferStructuralLayout`, opening-drop in `fitOpeningsToHosts`, `SOLVER_V2_VERSION` 2.2.0 | `refactor(reconstruction): add bounded layout hypothesis resolver`, `refactor(reconstruction): score wall-network and envelope alternatives`, `fix(reconstruction): resolve owner development failures generically` |
| `packages/analysis-service` | checkpoint wiring, cancel checks, phase registry, typed warnings with severity, resolver trace in the result/diagnostics, performance record | telemetry commit |
| `apps/local-analyzer` | protocol 3: `telemetry` event, control-pipe poll, performance record on every terminal event | `feat(analyzer): emit real subphase progress and heartbeat` |
| `apps/analyzer-api` | job record `activity` (phase, sub-phase, counters, heartbeat age) | same |
| `apps/android` | `LocalTelemetry` DTO, `LivenessTracker`, progress UI (phase, sub-task counter, step elapsed, last activity, slow vs no-response), severity-aware "limited" | `feat(android): show activity counters and slow-vs-stalled state` |
| `tests/architecture`, packages' tests | metamorphic source, resolver, shape families, progress, purity (no project names/codes/evaluation dimensions in production) | `test(analyzer): add metamorphic and shape-family gates` |
| CI | `analyzer-generalization`, `plan-resolver`, `analyzer-progress` gates; sealed replays compare model + scene hashes | same |

## 4. Which modules do not change

`packages/model` (no validator is weakened), `packages/commands`, `packages/geometry`,
`packages/mobile-scene`, the ARCHON adapter's discovery rules, the grid/cell decomposition's own
code path, the storey alignment, the roof and projection passes, the wall-topology planner, the
OCR and the chain solver's decisions (only instrumented), the product workspace outside the
analyzer progress UI.

## 5. Candidate architecture

`resolveStructuralLayout(options)`:
1. Run `composeStructuralLayout(options)` exactly as today (the **incumbent**). If today's pipeline
   would continue (a world frame, ≥ 1 mass, the gate does not refuse), return it untouched with a
   one-candidate resolution record. Accepted houses therefore stay byte-identical by construction.
2. Otherwise enumerate `PlanHypothesis = { copy, extent, scale, merge, faces }` in a fixed order
   (copy: DIMENSIONED first, then pixels, then id; extent: CHAIN_RECT, WALL_MASS_CLUSTER when its box
   differs by more than a wall thickness; scale: REGISTRATION, then ≤ 2 LATTICE readings of the
   overall chains when the registration is contradicted; merge: LARGEST_FIRST, WALLED_FIRST; faces:
   AS_GRIDDED, OUTER_FACE). Per-copy mask/bands are computed once.
3. Stage 1 (cheap, per decomposition): decomposition, bodies, footprint, wall coverage, refuted
   statements, corroborations, hard violations. Dedupe by outline; keep the best K = 4.
4. Stage 2: the unchanged `composeStructuralLayout` under each of the K hypotheses (roofs, §21 audit,
   gate). Rank lexicographically; accept per the rule in §7; else `PLAN_RESOLUTION_INCONCLUSIVE`.
5. The chosen hypothesis's metric view (its scale and re-read chain statements) is what the v2
   passes read; provenance of re-read spans is DERIVED; the layout carries a NOTED
   `PLAN_RESOLVED_BY_HYPOTHESIS` reason, a `SCALE_DISAGREEMENT` conflict when the scale departed, and
   an `AlternativeGroup` "which reading of the plan" with the considered outlines and the margin.

## 6. Maximum candidate / beam size

Decompositions N ≤ 24 (4 copies × 2 extents × 3 scales), outlines ≤ 96 as post-processes, full
compositions K = 4. Counts only — never a time budget. Cost measured by the resolver trace
(expected: seconds on desktop, against a 250–340 s run).

## 7. Which gates become scores

`FOOTPRINT_AREA_WRONG`, the `planFailureOf` ladder, the 0.35 wall-fraction cliff,
`STRUCTURE_SILHOUETTE_DISAGREES`. Order: hard violations → gate refusals → footprint bucket
(AGREES ≤ 6 % < UNKNOWN < NEAR ≤ 20 % < WRONG) → refuted-statement share (bucket 0.05) → wall
coverage (bucket 0.05) and corroboration count → departures from the incumbent → id.
**Acceptance** of a non-incumbent: no hard violation and no gate refusal after stage 2, and footprint
AGREES; or NEAR with ≥ 1 corroboration independent of the published figure; or UNKNOWN with ≥ 2.
WRONG never. Corroborations: CROSS_COPY (another copy of the storey agrees on the sheet's width in
centimetres within 5 %), ISOTROPY (the scale holds on both axes within 3 %), WALL_COVERAGE (≥ 0.8 of
the long-wall length on or inside the outline), EXACT_READING (the scale's generating reading needed
no substitution).

## 8. Invariants that remain hard

URL fence and per-hop SSRF checks; decoded-size truth; every canonical model validator (incl.
`WALLS_OVERLAP` at 1e-6 m²); `verifyReplay`; per candidate: no frame/envelope/body, degenerate or
non-finite geometry, anisotropy > 1.15, mass overlap at acceptance.

## 9. Progress event design

`AnalysisProgressEvent { kind: PHASE_START | PHASE_END | HEARTBEAT, stage, stageIndex, stageCount,
phaseId, phaseLabel, subphaseId?, subphaseLabel?, workDone, workTotal | null, unit, assetIndex?,
assetTotal?, candidateIndex?, candidateTotal?, heartbeatSeq, elapsedMs, phaseElapsedMs, timestamp,
message?, diagnosticCounters?, overall }`, emitted by a write-only `Checkpoint.tick()` at loop
boundaries (throttled to ≥ 1 s between heartbeats, cancel checked every 200 ms), forwarded by the local
program as a `telemetry` event (protocol 3) and by the API as the job's `activity`. The phone keeps
`lastActivityAt` (any line), `lastMeaningfulProgressAt` (phase/sub-phase/counters changed) and the
step's start; it shows the phase, the real counter ("Wymiary · 24 z 70", "Wariant układu 2 z 4"), the
step's elapsed time and the last activity; after 30 s of frozen counters with a live heartbeat
"Nadal analizuję — ten krok jest obliczeniowo ciężki.", after 45 s without any line "Brak odpowiedzi
analizatora od N s" with cancel and diagnostics. The overall percent stays monotone and secondary; no
ETA. Cancellation is polled inside `tick()` from the control pipe.

## 10. What evidence will prove improvement

- Kosaćce tracked on the desktop: the same logical identity (canonical URL, package id) and the same
  model and scene as the clean link; and the phone case (area-table copy alone) resolves to a valid
  model instead of `FOOTPRINT_AREA_WRONG`.
- Rarytasy e-OZE: a valid coarse model, or `PLAN_RESOLUTION_INCONCLUSIVE` with the candidates listed —
  never a single-method failure; with the area-table copy alone the same.
- Marcówki, Rarytasy 5 G2E, Kosaćce clean: model and scene hashes unchanged (`6152770f…/8c7d4395…`,
  `8fa4a25b…/d4e7249b…`, `5b5ffcf1…/50217b85…`).
- The plan-copy subset matrix on sealed evidence (Council G §4e: 4 projects × 9 subsets) and the
  twin-copy check (853 D vs 853 A) measured before and after; the area-table-alone Kosaćce row and
  both e-OZE rows gated. Image-transform invariance (G §4b) measured and reported, not gated.
- A production-wide leakage test whose registry of names, publisher codes and published figures is
  derived from every sealed `source-package.json` in `stage-reports/` (a new development house extends
  the guard with no edit), with a planted-cheat self-test.
- Metamorphic URL tests (tracking keys, order, fragment, trailing slash, canonical redirect) and
  ordering tests green; resolver determinism (same candidates, same winner, same hashes twice);
  progress tests (monotone, counters, heartbeat, cancel in OCR and in the resolver, no 100 % before done).
- Max heartbeat gap per phase reported for every development run; peak RSS not worse.
- Two blind ARCHON holdouts, selected by the seed rule after `PRE_HOLDOUT_SHA`, run once, reported as
  PASS / SOURCE_LIMITED_PARTIAL / ALGORITHMIC_FAIL without patching.
