# BUILDPLAN-ANALYZER-005R-ROUTER-N1-ADOPT — compact source audit (before preregistration)

Base `0f2c347c0be03a32510f1e54460eab6fdf1b65a5` (local = origin `analyzer/visual-source-role-guard-v1` = mirror
`claude/new-session-3kzcgh`, clean tree, verified 2026-10-15). Production code at the base is identical to the
005R-ROUTER base `8d41456` (`git diff --stat 8d41456 0f2c347 -- packages apps .github package*.json` touches only
`tests/architecture/research-isolation.test.ts`). Line numbers are at the base.

## 1. The chain, link by link

| # | link | file:line | what it does with a perspective picture |
| --- | --- | --- | --- |
| 1 | role claim | `source-package/src/adapters/archon.ts:98` | "widok"/"wizualizacja" → `document: PERSPECTIVE_RENDER`. **Correct on the projection axis**, scene-less (interior and exterior alike). Not changed. |
| 2 | role merge | `source-package/src/roles.ts:69-83, 93-99` | `normalizeRoles` fills `projection` from the document: `PERSPECTIVE_RENDER` → `PERSPECTIVE` unless an adapter stated another projection. On the 37 DEV rows: 403 `PERSPECTIVE_RENDER` frames, **0** declared `ORTHOGRAPHIC_ELEVATION`; 146 `ELEVATION` frames. |
| 3 | deterministic routing (**first bad operation**) | `source-analyzer/src/analyze.ts:164-166` | routes by `document` only: `ELEVATION` **or** `PERSPECTIVE_RENDER` → the five orthographic facade extractors. They write SILHOUETTE / RIDGE / OPENING / LOGGIA / LINEAR_VOLUME_CANDIDATE / … and their own `MISSING`/`AMBIGUOUS` gaps on perspective frames. |
| 4 | vision routing (same defect) | `analyze.ts:179` → `source-vision/src/tasks.ts:38,91` | `tasksForDocument('PERSPECTIVE_RENDER')` = `[FACADE_DECOMPOSITION]`. The request carries `roles.projection` (`analyze.ts:193`) but nothing reads it. |
| 5 | vision apply | `source-vision/src/apply.ts:62-63` | lands any validated answer on the caller's frame; checks bytes only, never projection. |
| 6 | product wiring | `analysis-service/src/run.ts:288-291` | **always** passes a reasoner: `options.vision ?? nullVisionReasoner()`. So in every product run the facade vision task IS requested on every perspective frame and fails with `VisionUnavailable(NO_PROVIDER)` → one `NOT_ATTEMPTED` gap "a facade decomposition vision pass on asset …" per perspective asset (`analyze.ts:213-214`), and `visionAttempted = true` suppresses the "found nothing" gap (`analyze.ts:224`). |
| 7 | live provider | `apps/analyzer-api/src/wiring.ts:20`, `config.ts:61` | `ANALYZER_VISION=live` → `anthropicVisionReasoner`; then FACADE_DECOMPOSITION answers about perspective pictures **land as VISION_MODEL observations on perspective frames** (links 4–5). Default OFF. `apps/local-analyzer` (Android) passes no reasoner → null reasoner path (link 6). `analyze.ts:198` is the only call of `VisionReasoner.analyze` in the repository. |
| 8 | metric layer | `source-metrics/src/extract.ts:88-94` | reads `ORTHOGRAPHIC_*` frames only. Perspective observations: never read. |
| 9 | cross-view identity | `source-analyzer/src/identity.ts:70-123` | orthographic pairs only. |
| 10 | elevation registration | `reconstruction/src/solve.ts:312` | `ORTHOGRAPHIC_ELEVATION` only. |
| 11 | perspective camera | `reconstruction/src/v2/reconstruct-v2.ts:1166-1171`, `v2/camera.ts:838` | solved from the **raster** (silhouette corners), not from observations. Unaffected by any observation change. |
| 12 | ledger (**false provenance**) | `reconstruct-v2.ts:1177` | every observation on a perspective frame with a solved camera is recorded `USED_AS_CORROBORATION` "depth order was checked against it" — no code performs that check. A second site (review R-A F7): when no camera/roof can be attempted, perspective RIDGE/ROOF_EDGE fall through to `reconstruct-v2.ts:1418` and are also recorded `USED_AS_CORROBORATION`. |
| 13 | LVC stripe rule | `reconstruct-v2.ts:1148-1153` | a LINEAR_VOLUME_CANDIDATE on an unregistered view → `IGNORED_WITH_REASON`. |
| 14 | candidate / model / refusal / UI | `analysis-service/src/run.ts` summary; Android analyzer screen | model, refusals, quality levels and warnings never read perspective observations (005R-ROUTER consumer map §4; re-measured byte-for-byte there). UI shows observation counts and hash prefixes. |

## 2. What changes if perspective frames are not read as facades

| class | effect | how measured in this stage |
| --- | --- | --- |
| **evidence lost** | none that any consumer reads: the facade observations on perspective frames, their within-view relations, and the gaps the facade extractors emit about them (recess side walls, …) | P4′ typed accounting, per row |
| **graph identity only** | `observationGraphHash`, `metricEvidenceHash` (its content embeds the graph id), `candidateHash`, `counts.observations` | P3 (metric content, ids blanked), P6 (candidate content), P5′ (counts.observations = R0 − removed) |
| **gaps replaced** | per perspective asset: −1 "a facade decomposition vision pass" `NOT_ATTEMPTED` (link 6), +1 "facade observations on the perspective render" `NOT_ATTEMPTED` (the named refusal) | P4′ T3/T4 |
| **numerical / semantic output** | expected unchanged: model bytes, typed refusals, cameras (raster-based), quality, warnings | P1, P5′, P8 |
| **ledger** | `USED_AS_CORROBORATION` records on perspective evidence disappear (they named a check no code does) | P8 |
| **live vision (`ANALYZER_VISION=live`)** | today: facade answers on perspective frames would land and be called corroboration by link 12. Candidate: the request is never made (`tasksForRoles`) and the apply boundary refuses such an answer | vision gate (§4 V) with a local mock provider; no network, no publisher pixel |

## 3. Earlier conclusions re-checked

- 005R-ROUTER first-bad (FB-2 `analyze.ts:164-166`, vision `:179`, FB-3 `reconstruct-v2.ts:1177`): confirmed at this base.
- The staged N1 (`research/analyzer-005r-router/n1-staged/`) gates the deterministic path only. In the product path the
  null reasoner still requests the facade task on every perspective frame (link 6), so with staged N1 alone a live
  provider would still write facade claims on perspective frames: **the vision-path blocker is open in staged N1**.
- Staged N1 assumptions audited: (a) "an elevation is never refused whatever projection" — kept (P2: no downgrade of a
  photo-realistic orthographic elevation); (b) a `PERSPECTIVE_RENDER` declared `ORTHOGRAPHIC_ELEVATION` is read —
  kept, synthetic-only (0 such frames on DEV); (c) `projection` undefined ⇒ refused (fail-closed) — kept; (d) the
  amended `mutations-02.test.ts` §2 — kept (it pinned behaviour, not a requirement).
- 005R visual research (`NO_SAFE_VISUAL_CANDIDATE`): nothing here classifies a scene; publisher structure is not truth.

## 4. Candidate correction made before preregistration (N1v)

`candidate/n1v-production.patch` = staged N1 + one predicate shared by both routes:

- `source-vision/src/tasks.ts`: `readsAsFacade(roles)` (ELEVATION, or PERSPECTIVE_RENDER declared
  ORTHOGRAPHIC_ELEVATION) and `tasksForRoles(roles)` (document tasks less FACADE_DECOMPOSITION when not
  `readsAsFacade`).
- `source-analyzer/src/analyze.ts`: the deterministic gate uses `readsAsFacade`; vision tasks come from
  `tasksForRoles(asset.roles)`; the refusal text names both routes.
- `source-vision/src/apply.ts`: the apply boundary refuses a FACADE_DECOMPOSITION answer on a frame that is not
  `readsAsFacade` (defence in depth; unreachable through `analyze.ts`).
- Tests: staged `projection-gate.test.ts` (7, one adjusted for the vision gap no longer requested) + 3 mock-live-vision
  negatives; `vision.test.ts` +2 (routing table, apply refusal with same-bytes control).

Developed against **synthetic tests only** (source-analyzer 55/55, source-vision 36/36), then saved as the patch and
reverted; no DEV row, anchor or replay has run with it before preregistration.

## 5. Incident log (operator)

- **INC-1 (2026-10-15 ~22:00–22:06Z).** The first R0 control launch (3 rows) resolved production packages from the
  working tree, and I applied the candidate to that tree while it ran. Those three runs were killed unfinished and
  discarded unread (moved to `work005r-n1/R0ctl-CONTAMINATED-discarded`, outside Git; not compared). Fix: the tree was
  reverted to base; `replay.mjs` now refuses an R0 run on a dirty `packages/` tree and records a hash of the resolvable
  `source-analyzer`/`source-vision` sources before and after each row (`sources.json`, `TREE_MOVED`); challengers run
  only through the variant alias (`variant.mjs` now copies and aliases `source-vision` too). The control was rerun
  clean (`R0ctl`, 3 rows, `moved: false`).
- **INC-3 (2026-10-15 ~23:50Z, during N1vshuf).** The session container restarted. N1vshuf had completed 7 rows
  (dom-w-tymianku, dom-w-krasnokwiatach, dom-w-daliach, dom-miniaturka, dom-w-glogownikach, dom-w-akebiach,
  dom-w-cieszyniankach); 3 rows (A06, A07, dom-w-murajach) were mid-run with no output. As preregistration §3 allows
  for a harness crash before any output, the remaining 30 rows were run once more with the same `--order reverse
  --shuffle N1-ADOPT` (the per-package shuffle seed is `N1-ADOPT:<row>`, so each package's asset order is unchanged);
  the 7 completed rows were kept. Logs: `N1vshuf-part1.out`, `N1vshuf-part2.out` (outside Git).
- The two reviews (preregistration §6, "after Tier C") were started while this last Tier C leg (N1vshuf) was still
  running; they had P1–P6 and P8 on 37/18 rows, not P7′ on N1vshuf. Disclosed process deviation; no predicate depends
  on review timing.
- `pkill -f` with a pattern matching my own shell ended that shell twice (exit 144); the processes were then killed by
  pid. No file was affected.

## 6. Controls and baseline reuse

- Fresh `R0ctl` (base, clean tree, Node 22.22.2): marcowki, rarytasy-g2e (G2E-5 edition, 25 perspective assets incl.
  the bathroom render), dom-pod-jarzabem (porch). Against sealed 005R-ROUTER R0/R0fix and R0rev: model, failure,
  graph, metric evidence, candidate byte-identical, summary identical after stripping `recogniser.ms`; raw summaries
  differ in `recogniser.ms` only (67 596 / 65 274; 45 739 / 46 826; 62 840 / 54 688 ms).
- Incumbent noise over all 37 sealed rows (R0∪R0fix vs R0rev): graph 37/37, model 23/23, failure 14/14, metric
  23/23, candidate 23/23 byte-identical; summary 0/23 raw-identical, the only differing leaf `recogniser.ms` (23/23).
  This, measured on the incumbent alone, fixes the clock whitelist `{recogniser.ms}` (preregistration §4 P5′).
- Sealed prior runs are reused only through `work005r-n1/runs-prior` (hard links), hashed in
  `prior-runs.sha256` (584 files, digest `0c19df46…`), R0fix overriding R0 on its 6 rows as in 005R-ROUTER.
