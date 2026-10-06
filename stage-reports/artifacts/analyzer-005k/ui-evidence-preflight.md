# 005K Phase 0 — the UI evidence harness

## The failure (005J run 181)

The mandatory job `Android / UI evidence gate` failed on both attempts in
`apps/android/app/src/androidTest/java/com/buildplan/preview/VerticalSliceDeviceTest.kt` → `openStage`:
- attempt 1 failed on the Kosaćce slice;
- the retry failed on the Rarytasy slice.

The app and test bytes were identical to the 005I base, where the gate had passed. Run 182, on the 005J closing
commit, was green, the gate included, so the race is intermittent.

The stack of attempt 2 (job 112465873658) shows the mechanism:

```
java.lang.IllegalArgumentException: Detected multithreaded access to SnapshotStateObserver: previousThreadId=2),
  currentThread={id=41, name=Instr: androidx.test.runner.AndroidJUnitRunner}
  at androidx.compose.ui.test.OutputKt.printToString(Output.kt:138)
  at androidx.compose.ui.test.SemanticsNodeInteraction.fetchOneOrThrow(SemanticsNodeInteraction.kt:189)
  at androidx.compose.ui.test.ActionsKt.performClick(Actions.kt:54)
  at com.buildplan.preview.VerticalSliceDeviceTest.openStage(VerticalSliceDeviceTest.kt:250)
```

Line 250 was `compose.onNode(hasText(label) and hasClickAction()).performClick()`. It ran right after a scroll, with no
wait for the sheet to settle after the previous stage's state change.

The failure happened in two steps:
1. `fetchOneOrThrow` found a number of matching nodes other than one.
2. Compose then built its "expected exactly one node" message with `printToString` on the instrumentation thread
   while the UI thread was laying out. Its own thread check threw.

The real mismatch was hidden by that second exception.

Two facts of the product make a bare text-and-click matcher ambiguous while the stage sheet is open:
- The house behind the modal sheet stays in the semantics tree.
- Its timeline head prints a stage's name and is clickable.

## The fix — test harness only (`b747440`)

| change | where |
| --- | --- |
| `Evidence.awaitExactlyOne(matcher, what)` counts through `fetchSemanticsNodes` (read on the UI thread) inside `waitUntil`, and fails with an `AssertionError` naming the count. Compose's off-thread diagnostic is never reached | `Evidence.kt` |
| `Evidence.clickExactlyOne(matcher, what)`: wait for exactly one, then click | `Evidence.kt` |
| `Evidence.stageList()`: the scrolling node that holds stage rows (a clickable that says "Zakończony" or "Nierozpoczęty"; at most one stage is in progress, so such a row is always on screen). It replaces "the first scrolling node" | `Evidence.kt` |
| `Evidence.openStage(label)`, in order: `waitForIdle`; exactly one stage list; scroll to the label; exactly one row matching `hasText(label) and hasClickAction() and hasAnyAncestor(stageList)`; click; `waitForIdle`; exactly one list; scroll to the stage's "show in 3D" action | `Evidence.kt` |
| `VerticalSliceDeviceTest` and `ProductFlowDeviceTest` use the shared `openStage`. The slice's "mark done" and "make current" clicks wait for exactly one node | both tests |

**What the fix does not do:**
- it changes no product code (`apps/android/app/src/main` is byte-identical to the base);
- it removes or weakens no assertion;
- it adds no sleep;
- it changes no timeout other than the existing `NODE_TIMEOUT_MS` bound used for the new waits.

The androidTest sources compile locally (`./gradlew compileDebugAndroidTestKotlin`, offline). No emulator is available
in this container, so the proof is CI.

## The gate on the patched harness

CI run 37533180890 (BuildApp CI run 183) on `b747440`, the patched harness and nothing else beyond the 005J head.
**Green, first attempt.**

| | |
| --- | --- |
| run | 37533180890 on `b7474406ab1a15f42d208a8450c96ae12a5839e2`, branch `claude/new-session-3kzcgh` |
| conclusion | success: 39 jobs pass, 2 skipped by design (the two direct-APK publications, which run only on dispatch) |
| `Android / UI evidence gate` | job 112507417185, 21:21–22:15 UTC, success on attempt 1 |
| what it ran | the Marcówki, Rarytasy and Kosaćce vertical slices (each opens the stage sheet, marks a stage done, makes one current and walks the history: the path that failed in 005J) and the generic alternate-source flow |
| gate output | `UI evidence: all 89 required screenshots valid` → `UI evidence gate: PASS`; artifact `ui-evidence` 11448395489 |

## Phase-0 gate (brief §6)

| condition | result |
| --- | --- |
| targeted VerticalSlice path green | yes: all three slices, run 183 |
| Kosaćce and Rarytasy stage-sheet navigation covered | yes: `slice-kosacce-05-stages-sheet` … `-12-house-again`, `slice-rarytasy-05` … `-12` among the 89 screenshots validated |
| assertions not weakened | yes: every former assertion is kept; the two clicks that were bare now require exactly one node |
| UI evidence gate green at least once on the patched harness | yes: run 183, attempt 1 |
| product main code unchanged | yes: `git diff 1314df7 b747440 -- apps/android/app/src/main` is empty |

The analyzer production change (`c244ff7`) was committed after this commit and pushed only after this gate was green.

**UI_EVIDENCE_HARNESS: PASS.** One green run proves that the harness can pass. It does not prove that the race is gone.
Every later CI run of this stage is a further sample, and the stage report lists them.
