# STAGE BUILDAPP-03M-FIX — ANDROID AUTO CANDIDATE RENDERING

## 1. Baseline and result

| | |
| --- | --- |
| branch | `claude/buildapp-buildworld-v1-7y6yqh` |
| baseline HEAD | `f3766237840514fc60178ca6c9bf4f3c9e13ebbd` (BUILDAPP-03 final), plus the CI micro-task commits `781d6d6` and `13108e5` |
| implementation commit | the commit that carries this report (see `git log`) |
| model schema | `buildapp.canonical-building-model` **1.4.0** — untouched |
| mobile bundle | `buildapp.mobile-scene-bundle` **1.0.0** — untouched |
| reconstruction | untouched: no solver, OCR, SourcePackage, metric or candidate change |
| result | **PASS** — the candidate's walls, slabs, members, openings and windows reach the GPU and are visible in every layer mode |

## 2. The failure

On the owner's device *Marcówki (auto)* loaded correctly — model 1.4.0, 72
objects, 1640 triangles, bundle `0986fa57` — and drew one object: the roof,
floating over nothing. No Layers mode (All / Roof off / Ground / Attic /
Cutaway) revealed the building.

## 3. The trace, one Auto wall against one Reference wall

`ring-0-w0` (`wall`, `lvl-0`, `mat-wall`, 216 triangles) was followed through
the whole Android path and compared with the reference's `g-front`. Every step
before the GPU was healthy, and **identical in kind** between the two models:

| step | Auto `ring-0-w0` | Reference `g-front` |
| --- | --- | --- |
| bundle mesh | 216 triangles, 1944 coordinates, all finite | 76 triangles, 684 coordinates |
| Kotlin decode | `vertexCount` 648, 1 part (`WALL`), `mat-wall` resolved | `vertexCount` 228, 1 part (`WALL`) |
| `ModelFrame` | x, y, −z with vertices re-wound a, c, b — coordinate for coordinate | same |
| winding | signed volume **+82.9** (outward; back-face culling correct) | **+57.0** |
| bounds | non-empty solid, agrees with the bundle's declared bounds | same |
| `ModelEntities.build` | entity created (72 of 72 objects; none skipped) | 127 of 127 |
| `visibleObjectIds` | present in All / Roof off / Ground / Cutaway | present |

So the candidate's geometry was never the problem, and neither was coordinate
conversion, winding, culling, materials, back-face culling or the visibility
rules. **Nothing in the reconstruction was changed, and nothing needed to be.**

## 4. The cause

`ui/Viewport.kt` installed the per-frame callback inside
`LaunchedEffect(canvas, model)`. Neither key changes when the user opens a
different building, so the effect never re-ran and the callback went on reading
the `scene` value it had **captured at its first composition** — the reference
model — for the rest of the session:

```kotlin
LaunchedEffect(canvas, model) {
    canvas.onFrame = { … canvas.modelRenderer.setState(scene, model.viewer) … }
}
```

Visibility answers with *object ids*, and an object id only means something
inside its own model. After switching to the candidate, the renderer therefore
held the candidate's 72 entities but was told to show the **reference's** ids.
The two buildings share exactly one object name:

```text
auto ∩ reference = { roof-main }        (kind: roof)
```

One entity was added to the Filament scene. Every layer mode recomputed the
same wrong set, so no mode could ever reveal a wall — precisely the reported
symptom. It never showed up before because the reference is the first index
entry and so is both the captured and the displayed scene until a model is
switched; Demo happens to share 17 ids with the reference, which is why it
looked partly right rather than empty.

## 5. The fix

The renderer now **owns the scene whose geometry it uploaded**, so the class of
bug is gone rather than this instance of it:

- `FilamentModelRenderer` keeps `uploadedScene`, set in `setModel` and cleared
  in `releaseModel`. `setState(state: ViewerState)` no longer takes a scene —
  a caller cannot hand it a model that is not on the GPU.
- Visible ids are intersected with `ModelScene.renderableObjectIds`, the
  objects that actually carry geometry, so the Filament scene can only ever be
  asked for entities that exist.
- `Viewport`'s frame callback captures nothing that can go stale, and the
  upload effect is keyed on the scene itself rather than on its key.

Not done, deliberately: no material was left double-sided, no test was
weakened, no geometry was regenerated and no reconstruction output was touched.

## 6. Regression assertions

Against the **real committed** `apps/android/app/src/main/assets/scenes/marcowki-auto.scene.json`
(`AutoCandidateRenderingTest`, 12 tests):

| assertion | measured |
| --- | --- |
| All → walls > 0 and roof > 0 | 8 walls, 1 roof |
| Roof off → walls > 0, roof kinds = 0 | 8 walls, 0 roof |
| Ground → `lvl-0` walls > 0 | 4 walls |
| Attic → `lvl-1` walls > 0 | 4 walls |
| Cutaway → non-roof geometry beyond a token | 1272 triangles across 62 entities |
| no mode shows only roof | all five modes carry building geometry |
| hidden entities are not pickable | pickability equals visibility in every mode |
| wall coordinates survive bundle → Kotlin | coordinate-for-coordinate, exact floats, every wall outward-wound |
| decoded bounds agree with the bundle's | within 1e-4 m for all 72 objects |
| every compiled object becomes an entity | 72 of 72 |
| one scene's ids are not a substitute for another's | 0 foreign walls resolve, for every other shipped scene |
| Reference and Demo unchanged | both render their own building under all five modes |

`tests/architecture/android.test.ts` gains the assertion that binds to the
cause itself: `setState` must not take a scene and the frame callback must not
capture one. It was checked against the pre-fix sources and **fails** there.

`RenderTraceTest` prints the whole trace — bundle objects, decoded
SceneObjects, GPU entities, visible ids and the entities each mode puts in the
Filament scene, grouped by semantic kind and level — for every shipped scene.

## 7. Commands run

| command | result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 68 files, 791 tests |
| `npm run build` | PASS |
| `npm run e2e` | PASS |
| `npm run android:test` | PASS — 102 tests, 0 failures |
| `npm run android:assembleDebug` | PASS |

## 8. Artefact

`stage-reports/artifacts/android-preview/BuildPlan-Model-Preview-arm64-v8a-debug.apk`
— rebuilt and replaced, 13 285 754 bytes, application id `com.buildplan.preview`
(installable alongside the owner's older BuildPlan APK). It carries all three
scene bundles unchanged.

## 9. Limitations

- Verified on the JVM and by source contract, not on a GPU: no Android device
  or emulator is available in the build environment, so the final confirmation
  is still the owner opening *Marcówki (auto)* and switching Layers.
- The candidate's own accuracy is unchanged — it remains the BUILDAPP-03
  candidate with its 56.3 % geometric accuracy, its one gable roof and its
  refused stair. This stage made it visible, not better.

## 10. Recommended next bounded step

Unchanged from BUILDAPP-03: **BUILDAPP-04 — camera-aware source-view
verification and semantic repair loop**. Now that the candidate is actually
inspectable on the phone, the owner's visual review is the cheap input that
loop should be fed with.
