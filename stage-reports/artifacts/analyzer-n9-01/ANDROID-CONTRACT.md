# N9-01: Android contract — status

## What changed in the API answer

The response is additive only. The service version is 1.3.0 (was 1.2.0), the solver is 2.17.0 and the model is 1.7.0; the solver and model versions are unchanged.

- **New member `assessment`** in `result.json` (and in every result summary):
  - `technicalValidity`
  - `decompositionCompleteness` (the old `modelCompleteness.verdict`, unchanged)
  - `sourceFidelity` (relations R1, R3, R4, R5 with items)
  - `sourceUnchecked`
  - `previewAvailable: true`
  - `summary`
- **Old fields kept as they were:** `preview.completeness` keeps its meaning, the warnings are unchanged, and every member of the legacy answer is still present.
- **The model is untouched:** CanonicalBuildingModel 1.7.0 and the MobileSceneBundle 1.0.0 are byte-identical for the same input (8/8 houses: `model-hashes.json`).

## Two snapshots, reviewed — not a blind refresh

| snapshot | directory | captured | role |
|---|---|---|---|
| legacy | `apps/android/app/src/test/resources/analyzer-contract/` | 005L, solver 2.3.0 | **Not rewritten.** The answer of an older server the phone must still parse (`RealServerContractTest`). |
| current | `apps/android/app/src/test/resources/analyzer-contract-current/` | N9-01, solver 2.17.0, service 1.3.0 | Today's server. `apps/analyzer-api/test/android-contract.test.ts` compares a fresh capture with it byte for byte, and `CurrentServerContractTest` (Kotlin) runs the whole job on it. |

`android-contract.test.ts` has three checks:
1. The current snapshot equals a fresh capture.
2. **No member path of the legacy answer is missing from today's** (shape test).
3. The result carries the three axes, and `decompositionCompleteness.verdict == preview.completeness.verdict`.

Before N9-01 the single byte-for-byte test had been red since solver 2.4.0 (N9-00 §4).

## Shape difference legacy → current (member paths; arrays collapsed to `[]`)

N9-00 reported 52 paths only in the fresh answer, counted on `0d03d60` with its own tool. Counted here with `test/support/contract-shape.ts` (objects and leaves both counted): 60 paths outside `assessment` and 118 under it. 0 paths were removed from any file.

```
## submitted.json: removed 0, added 0 (outside assessment 0, under assessment 0)
## status-running.json: removed 0, added 0 (outside assessment 0, under assessment 0)
## status-completed.json: removed 0, added 0 (outside assessment 0, under assessment 0)
## result.json: removed 0, added 178 (outside assessment 60, under assessment 118)
   $.preview
   $.preview.built
   $.preview.built.openings
   $.preview.built.roofPlanes
   $.preview.built.roofs
   $.preview.built.rooms
   $.preview.built.slabs
   $.preview.built.stairs
   $.preview.built.wallRings
   $.preview.built.walls
   $.preview.completeness
   $.preview.completeness.conflicts
   $.preview.completeness.conflicts.blocking
   $.preview.completeness.conflicts.degrading
   $.preview.completeness.decomposition
   $.preview.completeness.decomposition.basis
   $.preview.completeness.decomposition.coverage
   $.preview.completeness.decomposition.drawnBuiltM2
   $.preview.completeness.decomposition.representedM2
   $.preview.completeness.missingBodies
   $.preview.completeness.modelRefusals
   $.preview.completeness.unexplainedWalls
   $.preview.completeness.unexplainedWalls.bandLengthM
   $.preview.completeness.unexplainedWalls.count
   $.preview.completeness.unexplainedWalls.lengthM
   $.preview.completeness.unresolvedAreas
   $.preview.completeness.verdict
   $.preview.completeness.why
   $.preview.outcome
   $.preview.partial
   $.preview.provisional
   $.quality.byFamily.INTERIOR_DOOR
   $.quality.byFamily.INTERIOR_DOOR.L1
   $.sourceBasis
   $.sourceBasis.annotation
   $.sourceBasis.assetId
   $.sourceBasis.dimensions
   $.sourceBasis.dimensions.chains
   $.sourceBasis.dimensions.evidence
   $.sourceBasis.dimensions.segmentsRead
   $.sourceBasis.document
   $.sourceBasis.largestOffered
   $.sourceBasis.projection
   $.sourceBasis.scale
   $.sourceBasis.scale.anchors
   $.sourceBasis.scale.confidence
   $.sourceBasis.scale.independentWitnesses
   $.sourceBasis.scale.mppX
   $.sourceBasis.scale.mppY
   $.sourceBasis.scale.relation
   $.sourceBasis.scale.rmsM
   $.sourceBasis.scale.verified
   $.sourceBasis.storey
   $.sourceBasis.variant
   $.sourceBasis.variant.byteHash
   $.sourceBasis.variant.byteLength
   $.sourceBasis.variant.heightPx
   $.sourceBasis.variant.mediaType
   $.sourceBasis.variant.widthPx
   $.sourceBasis.variants
## scene.json: removed 0, added 0 (outside assessment 0, under assessment 0)
## refusal-unsupported-publisher.json: removed 0, added 0 (outside assessment 0, under assessment 0)
## not-found.json: removed 0, added 0 (outside assessment 0, under assessment 0)
## meta.json: removed 0, added 0 (outside assessment 0, under assessment 0)
```

## Test status

| test | where | status |
|---|---|---|
| `android-contract.test.ts` (3 tests) | TS, vitest | **PASS** |
| `CurrentServerContractTest` (whole job on today's bytes, assessment parsed, scene stored and opened) | Kotlin JVM unit test, `:app:testDebugUnitTest` | **PASS** (1/1) |
| `RealServerContractTest` (whole job on the legacy bytes) | Kotlin | **PASS** (2/2) |
| `AnalyzerContractTest` | Kotlin | **PASS** (12/12) |
| `ResultHeadlineTest` (+3 N9-01 cases: a conflict or technical error is never "ready"; UNCHECKED fidelity is not "ready"; the DTO reads `assessment` and an older answer without it) | Kotlin | **PASS** (10/10) |
| APK build, instrumented tests, device | — | **NOT_RUN** (out of scope: no APK in N9-01) |
| Android lint | — | **NOT_RUN** |

The Kotlin tests ran with `ANDROID_HOME=/opt/android-sdk ./gradlew :app:testDebugUnitTest --tests …` (log: `logs/kotlin-tests.log`).

**No phone was tested.** The JVM tests show that the parser, tracker, store and headline accept today's answer. They do not show the screen on a device.

## Phone UI (code, not run on a device)

**`AnalyzerScreen.kt` `AssessmentDetails`** shows the three axes on separate lines:
- **Poprawność techniczna** (technical validity), with the note that 0 errors is not proof of fidelity.
- **Kompletność odczytu (dekompozycji)** (reading/decomposition completeness).
- **Zgodność ze źródłem** (fidelity to the source), with each relation and up to 6 conflicts named.
- **Niesprawdzone w źródle** (not checked against the source), with the counts and 6 items.
- The always-present line *„Konflikt ze źródłem nie wyłącza podglądu 3D”* ("a conflict with the source does not turn off the 3D preview").

The old section title "Kompletność modelu" ("model completeness") is now "Kompletność odczytu (dekompozycji)". The "Otwórz w 3D" ("Open in 3D") button is shown in every case.

**Headline:**
- A technical ERROR or a source CONFLICT means at least LIMITED.
- A COMPLETE model whose fidelity is UNCHECKED is OPEN_QUESTIONS, never READY.
- READY requires fidelity PASS.

**The on-device (local) analyzer** is bundled from the workspace when an APK is built (`apps/local-analyzer/build.mjs`), so the next APK carries the assessment. No bundle was built here.
