# Council F — Canonical Model / Invariants Specialist (005A post-review)

I reviewed at HEAD `f1901e9`. That is the opening-drop commit: `4c07986` was amended while this review ran and now also drops `OPENING_LEAF_*`.

The diff `git diff 7cd8e0c..HEAD` is empty for these paths [C]:
- `packages/model`, `packages/commands`, `packages/geometry`, `packages/mobile-scene`;
- `v2/emit.ts`, `v2/wall-topology.ts`, `layout-gate.ts`, `plan-diagnostics.ts`.

No validator was weakened. `WALL_OVERLAP_AREA_LIMIT = 1e-6` stands (`packages/model/src/topology.ts:486`) [C].

## 1. Strongest improvement

`fitOpeningsToHosts` now drops a `cutOpening` with a reason when the model refuses it with `OPENINGS_OVERLAP`, `UNKNOWN_WALL` or `OPENING_LEAF_*`. Before, any of these failed the run (`candidate.ts:309`, `:391`) [C]. This closes the asymmetry my pre-audit probed: cases A, C and D ended the run, while case B was already a named drop.
- The model still refuses the command. The opening's `placeWindow`/`placeDoor`/`setEvidence` are dropped with it.
- Each drop becomes a `REFUSED` unresolved entry (`reconstruct-v2.ts:1116-1117`), and the phone counts that entry as limiting (`AnalyzerScreen.kt:607`) [C].
- The test inverts the old expectation (`fit-and-levels.test.ts:73`). A refusal that is not about an opening still fails the run (`:106`, `WALLS_OVERLAP`) [C].

Two costs, both visible, so I accept them [I]:
- Which of two overlapping readings survives depends on emission order, not on evidence: "the first opening cut in the wall is kept".
- A dangling wall id used to expose an emitter bug by failing the run. It is now a named hole.

On the six known runs the change has no effect: per the brief, only runs that failed at emission change [M].

## 2. Largest remaining genericity risk

**The model validator is still asked only once, after the resolver has committed to a reading.** [C]
- The resolver starts only on a layout-level stop (`reconstruct-v2.ts:228`).
- Its hard check for overlapping bodies is the gate's box overlap > 0.5 m² (`plan-resolution.ts:298`, `layout-gate.ts:124`). That is 5×10⁵ looser than `WALLS_OVERLAP`.
- A failure at emission is terminal (`reconstruct-v2.ts:1094-1110`). Nothing falls back to the next acceptable reading.

The new readings make this reachable. `OUTER_FACE` moves each unshared, band-only side outward by half a wall (`layout.ts:819-858`). Two bodies that touch only at a corner (e.g. in a Z-shaped plan) are "unshared" on both sides. They would overlap by about (T/2)² ≈ 0.02 m², pass the resolver and the gate, and die as `MODEL_EMISSION_FAILED` [I].

The shape families already show a wrong reading that clears the layout and dies at emission. The small copy ends `MODEL_EMISSION_FAILED (WALLS_OVERLAP)`, with and without a published footprint [M `shape-families/README.md`].

**No gate catches this.** `shape-families.test.ts` accepts any named refusal on that row, and no test covers "emission fails → try the next reading".

Related, though not about genericity: versioning. Bumping to 2.2.0 was right, and it refutes 004A's reason for not bumping. But 2.2.0 now names three rule sets:
- resolver 1.0.0 (`f845d21`);
- resolver 1.1.0 with the `mouths` axis (`a3723ec`);
- the opening drop (`f1901e9`).

`PLAN_RESOLVER_VERSION` reaches only the trace and diagnostics (`plan-resolution.ts:680`). It enters no layout or candidate hash, and the candidate records only `SOLVER_V2_VERSION` (`reconstruct-v2.ts:1174`) [C]. The committed e-OZE trace says `resolverVersion 1.0.0` under the same 2.2.0 as today's code [M `resolver/rarytasy-eoze-all/analysis-trace.json`]. The outcome is the same (model `b50b6e59`), so nothing was misreported. Still, (inputs, version) → candidate is not a function across the stage. Folding the resolver version into the solver label fixes this and changes no model or scene hash.

## 3. Possible hidden overfit

- **A unit fixture is the e-OZE failure, digit for digit** [C][M].
  - `misreadSheet` (`plan-resolution.test.ts:245-258`) is a 720 px span first read as "1601", rewritten to "1801", and the test expects 2.223611 cm/px.
  - `resolver/README.md` describes e-OZE with exactly those numbers, yet the test file's header (lines 5-9) says it "carries no project's figures".
  - `generalization.test.ts` scans production code only, and only for names, ids and published figures. OCR tokens and pixel lengths get past it.
  - Detection: re-run the three scale tests with perturbed numbers (e.g. 700 px, "1402"/"1602"). The verdicts must not change.
- **`latticeScales` accepts a scale from a single long anchor** when nothing printed supports the registration (`plan-resolution.ts:176,189`: weight 0 against 0). e-OZE is exactly that case. Its acceptance then rests on the published footprint plus `WALL_COVERAGE` [C][M]. Detection: count single-anchor scales among accepted resolutions on the blind holdout.
- **Checked, not overfit: the ranking ignores the residual inside a bucket.** e-OZE chose 116.7 m² (−4.4 %) over the 122.1 m² (+0.0 %) outer-face reading, because it departs less from the first reading [M e-OZE trace, reading1/reading2]. A ranker tuned to the published figure would have taken the second.

## 4. One next research item

**Make "resolved" reach the phone, then measure it.** Today a resolved model can look like a fully read one [C]:
- Every ring's evidence says `SOURCE_EXACT` "from the plan's printed chains". This is hard-coded (`v2/emit.ts:177`).
- The new `DERIVED` basis stops at the layout quantity, and it keeps the ±1–2 cm spread of a printed span (`layout.ts:1082-1083`). The feature graph reads only `widthM.basis` (`reconstruct-v2.ts:288`).
- `warningsOf` takes no layout input (`warnings.ts:41`). A grep finds no reader of `structuralStatus` or `PLAN_RESOLVED_BY_HYPOTHESIS` in the service, the apps or Android. The code's own sentence, "a partial result until someone confirms it" (`plan-resolution.ts:666`), never leaves the layout.

What the phone shows today:
- Only a walled-first resolution adds an unresolved entry.
- e-OZE, resolved on copy, extent and scale, shows as "limited" only because of 9 unrelated unresolved entries [M].
- The correct two-storey rectangle and the T complete with the gate reading REJECTED, and the phone cannot see that either [M].

The change: in `warningsOf`, add a LIMITING warning keyed by code when `structuralStatus ≠ ACCEPTED` or when the plan was resolved. This sits outside the model, candidate and scene hashes. Add a gate: a RESOLVED run's summary must be limited.

Why it comes first: the blind holdout is scored as PASS or SOURCE_LIMITED_PARTIAL, and a resolved holdout would otherwise show "Model gotowy". Correcting the status at `emit.ts:177` needs a version bump and comes second.

**Verdict on the implementation decision:** In my area the code did what it committed to. The validators, commands and geometry are untouched, and the accepted hashes are unchanged. The opening drop landed, the version was bumped to 2.2.0, and the resolved layout is sealed with an alternative group, a scale conflict and DERIVED spans.
Departures: `PLAN_RESOLVED_BY_HYPOTHESIS` is DEGRADING instead of NOTED, which is stricter and right. "Mass overlap at acceptance" uses the 0.5 m² box overlap, not the model's own overlap check. The resolver version is outside every hash.
