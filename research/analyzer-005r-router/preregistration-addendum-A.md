# Preregistration addendum A — code critic's pre-implementation review

Committed **after** `preregistration.md` (`014781c`) and **before** any N1, R2w or R1 run. Only R0 rows had run
(incumbent, unchanged). Source: `stage-reports/artifacts/analyzer-005r-router/reviews/pre-code-critic.md`. Nothing
below loosens a veto; A-1 corrects predicates that would have fired on every row for a reason unrelated to the
evidence (a hash that embeds the observation graph's identity), and replaces them with stricter content checks.

## A-1 (critic C-1, P1): identity-carrying hashes

The metric evidence set embeds `observationGraphId` / `observationGraphHash` (`source-metrics/src/extract.ts:857-858`)
and hashes them; the structural layout (`reconstruction/src/structural.ts:163-164`), the feature graph inputs
(`v2/graph.ts:229`) and the hypothesis set (`reconstruct-v2.ts:1357-1360`) do the same. Any change of the graph moves
these ids and hashes without any change of content. Therefore:

- **P3 (replaced):** the metric evidence JSON of R0 and N1 must be byte-identical **after normalisation**: the fields
  `id`, `contentHash`, `observationGraphId`, `observationGraphHash` are blanked at every depth. Every evidence item,
  chain, registration, solution and its own id must be equal. (Stricter than a hash: it localises a difference.)
- **P5 (replaced):** summary fields allowed to differ: `observationGraphHash`, `metricEvidenceHash`, `candidateHash`,
  `counts.observations`. Everything else identical (model and scene hashes, counts, warnings, unresolved, quality).
- **P6 (replaced):** the candidate JSON must be byte-identical after blanking, at every depth, `id`, `contentHash`,
  and every `*Id` / `*Hash` field whose name starts with `observationGraph`, `metricEvidence`, `structuralLayout`,
  `hypothesisSet`, `featureGraph`. `program`, `steps`, `traces`, residuals and counts must be equal.
- **P8 (clarified):** ledger compared as records (evidenceId, disposition, reason, stage); the `featureGraphHash`
  difference is expected; the feature graph's *features* are compared after the same blanking.

## A-2 (critic C-2, P1): FB-2 is the first unsafe **deterministic** assertion

Vision task routing is also by document (`analyze.ts:178` → `source-vision/src/tasks.ts:38`). With a live provider
(`apps/analyzer-api` with `ANALYZER_VISION=live`, or the developer CLI `--live`) facade observations would still land
on perspective frames and FB-3 would still fire. N1 closes the deterministic channel only; the vision channel is
named as the remaining one (no remote pixels may be sent, so it cannot be measured here). The report must say so.

## A-3 (critic C-3): the MISSING exclusion is inert on the product path

`runAnalysis` always passes a reasoner (null by default, `run.ts:288`), so `visionAttempted` is true for renders and
the "found nothing" gap never fires for them in production; the exclusion matters only to callers without vision
(tests). On the product path N1 is purely additive in `graph.unresolved` (one NOT_ATTEMPTED per render, beside the
existing per-task vision gap). P4 stands as written.

## A-4 (critic C-4, C-5, C-6): expected differences, disclosed

- `graph.extractors` may lose the five `cv.*` facade entries on a package with renders and no elevation (P4 allows it).
- No version string moves (the extractor versions are unchanged; the service version is in `analysis-service`, outside
  this stage's scope): a replayed R0 graph (`REPLAYED_GRAPH`) gives R0's graph back. Under H1 its model is the same.
  Recorded as PROPOSE_NEXT (a routing version), not done here.
- Android displays the graph, metric and candidate hash prefixes and the observation count (`AnalyzerScreen.kt:693,714-716`,
  `DownloadedScenes.kt:380`); the scene key is the scene sha and does not move. These displayed values change.

## A-5 (critic C-7, C-8): tests and edge cases

- `mutations-02.test.ts:112` will go red by design; it is amended to assert the new contract (the render frame is
  declared, carries 0 deterministic facade observations and one typed NOT_ATTEMPTED), keeping :113–115. No other
  pinning test was found by the critic. No "005R" string enters production code (`research-isolation.test.ts:767`).
- The gate reads `asset.roles.projection`. `ELEVATION` frames are not gated at all, so an `ELEVATION` sealed with a
  non-orthographic projection (a `PACKAGE` input is parsed, not normalised, `run.ts:241`) behaves exactly as today.
  A `PERSPECTIVE_RENDER` with an adapter-claimed `ORTHOGRAPHIC_ELEVATION` projection is still read (none exists today).

## A-6 (critic C-9): audit citations corrected in place

`makeAsset` starts at `acquire.ts:326`; observations in the web panel are shown at `Sources.tsx:117,176,198,220`
(`:234` is the unresolved list); the projection filter of registration is `solve.ts:312` reached via
`reconstruct-v2.ts:524`. The audit's §4 adds the hash coupling (A-1) and the Android displays (A-4).
