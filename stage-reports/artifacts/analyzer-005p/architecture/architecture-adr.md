# ADR-005P — evidence view + consumer policy at the metric seam; no new subsystem, no rewrite

Status: accepted for 005P scope (written at the audit-before-code checkpoint). Context: `current-system-map.md`,
`target-contracts.md`, `first-bad-ledger.json`, `research/analyzer-005p/hypotheses.md`.

## Context

The analyzer is a chain of single answers (copy, extent, scale, tiling, envelope, emission), each produced by a
subsystem that mostly OBSERVES well and DECIDES with whatever its neighbour handed it. Its failures on the 44
development houses do not share one root: murajach is decided wrong in source-metrics (orientation, binding) before plan
resolution sees it; akebiach misses short piers in primitive extraction; gozdzikowcach's plan is right and its emitter
cannot place a chimney without a roof datum; jarzabem's copy is chosen by a ranking that treats "no evidence" as
agreement; glogownikach is accused of a wrong scale by a reader the ensemble already contradicted. The audit found the
same pattern at several seams: **an observation from one reader is passed on as if it were the decision, with the
reader's identity and its rivals dropped** (as-printed view, T2's raw-text join, orientation's typography test,
role claims from captions).

## Decisions

**(i) Is a new subsystem necessary?** No. Every subsystem that needs to change exists and owns the right decision; what
is missing is a typed *contest/provenance record* travelling with the value, and an explicit *consumer policy* where the
value is used. A new "evidence service" would move the same untyped value one module further.

**(ii) The minimal refactor that pays off now.** At plan resolution's metric seam only: compute, once and purely, what
each statement's confident readers read (TOKEN, LATTICE, EXTERNAL; correlated estimators of one crop) and whether they
disagree; make every consumer of the "as printed" reading name its policy. 005P adopts at most one such policy, chosen
by the pre-registered gates, and records the contest in the run's diagnostics so a refusal or a withdrawn accusation can
be traced to the readers. Nothing upstream (OCR, ensemble, binding, metric solution) and nothing downstream (topology,
emission, schema) changes.

**(iii) Deferred, by name.** Orientation by the reader's posterior (murajach; source-metrics); T2 PARTIAL_BINDING's
join across two readers; `refutedShare = 0` when nothing is stated (ranking); CHAIN_CORRECTED anchoring the
registration it was corrected toward; CROSS_COPY independence; pier/short-block primitives (akebiach); emission failure
records without the plan digest (gozdzikowcach); role claims never checked against pixels; the published figure's
residual choosing power in `resolvePlan` (005A AD-1). Each is a separate ownership boundary and a separate stage.

**(iv) Why not a giant rewrite.** The 18 development PASS houses pass because many guards hold at once (figure SPENT /
VERIFIED, drawing-first conflict choice, budgets, named ties). A rewrite re-opens every one of them with no blind
evidence that the new arrangement is better, and the development set (44 rows, 38 truth families at label level) is far
too small to re-tune a whole pipeline without fitting it. Every 005-series stage that changed one decision found side
effects on rows it did not target (005N A05, 005O jarzabem); a rewrite multiplies that.

**(v) Keeping a recoverable evidence chain end to end.** Every value that crosses a boundary keeps: its evidence id,
the readers that produced it (and their rivals), whether it depends on a scale, and the rule/version that used it. A
decision that withdraws or refuses records the ids that drove it. A run that fails late keeps the early decisions'
records (today the plan digest is lost on MODEL_EMISSION). The contracts are written down in `target-contracts.md`.

## Consequences

- 005P changes at most one behaviour, behind a resolver version bump, with the old behaviour reproducible on demand by
  the research harness (P0 control) and every changed row listed.
- Blast radius is reviewable: a consumer that is not in the policy keeps the frozen reading, visibly.
- The deferred list above is the backlog; no item is fixed "on the way".

## Three horizons (no stage started here)

| horizon | what | boundary |
| --- | --- | --- |
| NOW (005P) | contest record + one consumer policy in plan resolution, if admissible; diagnostics; tests; mutation controls | `plan-resolution.ts` (+ one pure helper) |
| NEXT (candidate stages, coordinator's choice) | (a) orientation decided by corroborating posterior in exactly one quarter-turn (005O M4-diag 171/0 where truth known) — source-metrics; (b) ranking that distinguishes "no as-read evidence" from "agrees" — plan resolution; (c) emission failure records keeping the plan digest — reconstruct-v2 / analysis-service; (d) short wall-thick block primitives (piers) — primitive layer | one owner each |
| LATER (research) | typed `SourceObservation`/`EvidenceClaim`/`Decision` records across the pipeline; three-graph topology with virtual closures; role classification checked against pixels; independent-witness accounting by correlation group | architecture programme, staged |
