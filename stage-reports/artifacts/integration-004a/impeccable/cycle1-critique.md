# Cycle 1 — house-first IA critique of the new HouseWorkspace (INTEGRATION-004A §41)

Method: dual-agent Impeccable critique (A: design review of the new code, no device captures yet; B: deterministic hand-checks — 0 hex outside Theme.kt, 0 `!!`, 0 `@Suppress`, 0 literal contentDescription, every maxLines with ellipsis, no interactive band under 48 dp; `impeccable detect` reports nothing for Kotlin). Baseline 24/40 → **29/40**, no P0, five P1. What was fixed after this critique is listed at the end.


Target: `apps/android/app/src/main/java/com/buildplan/preview/ui` (ShellState, AppShell, HouseWorkspace, HouseSheets, TimelineRail, StagesScreen, ToolRail, Inspector, AnalyzerScreen, Chrome, Theme) and `res/values/strings.xml`. Read-only, code-level reasoning at 411×914 dp, font 1.0/1.3, portrait and landscape. No device captures exist yet; every geometric figure below is computed from the composables' own dp constants (Compose BOM 2024.12.01 → Material 3 1.3.1 defaults where stock components are used). Mode: Operate. Baseline: run-73 five-tab UI, 24/40.

## 1. Design-specificity verdict

**Owned structure, stock joints.** The information architecture is now the product's own: `ShellState` is root + one sheet + one task with a pure `back()` (ShellState.kt:34-52), `HouseWorkspace` is the root whenever a house exists (AppShell.kt:185-196), the tab bar is gone, Koszty is a disabled named row (HouseSheets.kt:114), and the timeline header is the one edit path (TimelineRail.kt:118-123, 171-175). The visual world (folding rule, hollow preview tag, ink actions, one yellow) is intact.

Where it is still generic: the three sheets are unmodified `ModalBottomSheet`s (HouseSheets.kt:305-316) with Material's 28 dp `extraLarge` top corners and the stock pill drag handle, animating on Material's own spec rather than `LocalMotionPolicy`; the stage sheet is the old Etapy page dropped whole into that sheet at full height (StagesScreen.kt:101, 133; HouseSheets.kt:150-152); and the source sheet is a paste of the analyzer's diagnostics without a fold (HouseSheets.kt:206-219). The skeleton is house-first; three of its four sheets still read as pages.

## 2. Nielsen heuristics (Operate; 0–4)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | The root now says "43% · Dach" and source status at once; but the status row is permanent for a limited house (HouseWorkspace.kt:433-437) and the task line ("Teraz: …") vanishes whenever the inspector replaces the timeline (HouseWorkspace.kt:317). |
| 2 | Match system / real world | 3 | "Stan po etapie 6 z 17" still counts stops (TimelineRail.kt:220); the source sheet prints "replay", "adapter", "observations · frames · metric evidence" unfolded (AnalyzerScreen.kt:585-600 via HouseSheets.kt:208). |
| 3 | User control and freedom | 3 | Back is pure and leaves only from the bare house; but the source sheet → analyzer → back lands on the bare house, not the sheet (ShellState.kt:49), and the "Nowy dom gotowy" row cannot be dismissed without opening it (HouseWorkspace.kt:431, 447). |
| 4 | Consistency and standards | 2 | Stock sheet shape and handle vs the 12 dp rectilinear system; the rail header is a handle while the selection row needs a "Szczegóły" button (HouseWorkspace.kt:509); two house lists (menu vs `Downloads`, AnalyzerScreen.kt:692); panels overlap in two configurations (see P1-3). |
| 5 | Error prevention | 3 | Preview never saves, one stage in progress, reset confirmed. A limited-model row promises "zobacz, czego brakuje" and delivers a count only (`house_status_limited_kept`, HouseSheets.kt:242). |
| 6 | Recognition rather than recall | 3 | Labelled rail keeps state visible; the stage sheet opens with the current stage expanded but scrolled to the top of 17 rows (StagesScreen.kt:115, 133); the bundled sample house is unlabelled on the root (HouseWorkspace.kt:401-408). |
| 7 | Flexibility and efficiency | 3 | Record a stage: 2 taps; switch a house: 2 taps; add a house: 2 taps (was 5/4/4). The rail sits at y ≈ 60–314 dp, outside a one-handed thumb (HouseWorkspace.kt:287). |
| 8 | Aesthetic and minimalist design | 3 | Chrome at rest is three glass pieces; "43% · Dach" is still printed twice (HouseWorkspace.kt:409-415, TimelineRail.kt:191-198); the stage sheet header repeats title, house, figure, paragraph and a second rule (StagesScreen.kt:158-181). |
| 9 | Help users recover from errors | 3 | A failed analysis is one line on the house (good), but its tap opens the current house's source sheet, not the failed task (HouseWorkspace.kt:445-449). |
| 10 | Help and documentation | 3 | Gesture hint and unset guide exist; the hollow vs solid tag is still never explained in words; "Co to znaczy?" folding is gone (the paragraph is now always inline, StagesScreen.kt:176). |
| | **Total** | **29 / 40** | Up from 24. The gain is structural (#7, #4 partly, #1); the losses that remain are finish, not architecture. |

## 3. Cognitive-load checklist

| Item | Result | Evidence |
|---|---|---|
| One dominant element per screen | PASS (with caveat) | Root free rectangle ≈ 323 × 670 dp of 411 × 914 (top context ~84 dp incl. status bar, rail 80 dp wide, timeline ~160 dp incl. nav bar); a 1.3:1 house fitted by width is ≈ 21 % of the screen — better than run-73's 13 %, but the rail's full-height right inset (`ContentInsets(right = railInset)`, HouseWorkspace.kt:183) is the binding constraint although the rail itself is only 254 dp tall. |
| Nothing repeated on one screen | FAIL | `actualLine` "43% · Dach" (HouseWorkspace.kt:410) and `NowHeader` "43%" + "Dach" (TimelineRail.kt:192-194) at rest; in the stage sheet a second static `FoldingRule` (StagesScreen.kt:177) plus the house title (167) already in the top context. |
| Controls where their object is | FAIL | The header names "Dach" but the sheet opens at row 1 with no `LazyListState` scroll to the open stage (StagesScreen.kt:133-148); "zobacz dlaczego" for a failed link routes to `Sheet.SOURCE` of the open house (HouseWorkspace.kt:448); deleting a house exists only inside the analyzer task (AnalyzerScreen.kt:713). |
| No dead ends in primary navigation | PASS | Koszty is disabled with a sentence (HouseSheets.kt:114), every sheet closes onto the house, the task returns (ShellState.kt:48-52). One soft dead end: the limited row's promise (see #5 above). |
| Core task ≤ 2 steps from root | PASS (with caveat) | Header tap → current stage is `openStage` (StagesScreen.kt:115) → "Oznacz jako zakończony" is the InkButton (399). Two taps only when that row is on screen; for stages ≥ ~9 it is below the fold. |
| State survives transitions | FAIL | The analyzer task removes `HouseWorkspace` from composition (AppShell.kt:176-185): the `Viewport` is destroyed and re-uploads the model on return (Viewport.kt:334, 369); `railExpanded`, `toolName`, `detailsOpen`, `hintShown` (HouseWorkspace.kt:149-153) reset; a sheet that launched the task is not restored. Camera pose survives in the view model (PreviewViewModel.kt:72). |
| Consistent vocabulary | FAIL (minor) | Four names for one area: "Źródło modelu i analiza" (menu), "Analiza linku i jej diagnostyka" (HouseSheets.kt:220), "Szczegóły analizy", "Dane techniczne". Stale copy: `progress_unset_body` "Zaznacz w Etapach" (strings.xml:54, orphaned), comment "(miejsce podrzędne w zakładce Dom)" (strings.xml:315). |
| Technical detail progressively disclosed | FAIL | Source sheet: `AnalysisDiagnostics` (hashes, English rows) rendered unfolded under a `SectionHeading` (HouseSheets.kt:206-209) and the schema/objects/triangles/hash row under an always-visible "Dane techniczne" heading (210-219). Inspector and analyzer do fold (Inspector.kt:447, AnalyzerScreen.kt:542). |

Four fails, one minor, three passes.

## 4. Priority issues

No P0: the root, the back model, the one-sheet rule and the Koszty boundary match the OWNER's brief. Everything below is a P1 or lower; P1-1 becomes a P0 the moment the OWNER reads "sheet over the house" as "house still visible".

### P1-1 The stage sheet is the Etapy page in a sheet: full height, opened at the top of the list
- **What:** HouseSheets.kt:148-153 (`heightIn(max = maxHeight)` = the sheet's whole height); StagesScreen.kt:101 (`fillMaxSize`), :133 (`LazyColumn(Modifier.fillMaxSize())` with no `LazyListState`); StagesScreen.kt:115 opens the current stage but nothing scrolls to it.
- **Why:** With `fillMaxSize` a `ModalBottomSheet` (`skipPartiallyExpanded = true`) always expands to the window minus the status bar, so "the house's ridge in view above it" (DESIGN.md) is in practice a 24 dp strip of scrim. The header the owner tapped said "43% · Dach ›"; the sheet answers with "Etapy budowy", the house name, a 28 sp figure, a paragraph, a second rule and rows 1–7. For a stage past ~9 (Stolarka onwards) the expanded editor is below the fold at 1.0 and well below it at 1.3. This is exactly the "page hopping" the brief revoked, only vertically.
- **Fix:** (a) Replace `Modifier.fillMaxSize()` in `StagesScreen` with `fillMaxWidth().heightIn(max = …)` and cap the sheet at `maxHeight * 0.82f` in `StageSheet`, so at least ~150 dp of house stays visible over the scrim. (b) `val list = rememberLazyListState(); LaunchedEffect(Unit) { list.scrollToItem(index = 2 + currentIndex) }` (items 0–1 are Header and Problems). (c) Preferably, a one-stage sheet for the current stage — `CompletionEditor`, `TaskEditor`, `StageActions` — with the header's figure and a `QuietAction("Wszystkie etapy")` that expands to the full list; the direction document already asked for this.

### P1-2 The status row: permanent for a limited house, wrong destination for a link problem, no way to dismiss a ready house
- **What:** HouseWorkspace.kt:430-479. `limited` is derived from the download record (433-434) so it is true forever for Rarytasy; `running`/`failed` route to `Sheet.SOURCE` (448) because `Context` (138-145) has no `onAnalyze`; `readyKey` is cleared only by opening that house (AppShell.kt:155, 166).
- **Why:** "Only when there is something to say" turns into a 48 dp row said every session under the house name. A failed link is a fact about the task, not about the open house: "zobacz dlaczego" costs two taps through a sheet that has nothing to do with the failure. The ready row is the one top-anchored action a one-handed owner cannot decline.
- **Fix:** Add `onAnalyze` to `Context`; in the click: `ready != null -> onOpenHouse; running || failed -> onAnalyze(); else -> onOpenSheet(SOURCE)`. For `limited`, show the row once per house (a `rememberSaveable` seen-set keyed by `scene.key`, or persist beside the progress record) and otherwise leave the fact in the menu row's supporting text, which already says "gotowy z ograniczeniami" (HouseSheets.kt:97). Clear `readyKey` when the menu opens (the new house is listed there).

### P1-3 Panels overlap: the tool pane over the status row (portrait) and the timeline over the pane (landscape)
- **What:** HouseWorkspace.kt:287 (`padding(top = 60.dp)` for the rail), :248 (`paneMax = maxHeight * 0.62f`), :293-296 (the bottom Column is composed after the rail, so it draws over the pane), :438-451 (status row makes the top context ≈ 110 dp tall, right edge at ≈ 307 dp).
- **Why:** Portrait with a status row: the pane (236 dp wide, left edge ≈ 79 dp, top 60 dp) covers the status row's band y 60–110 for x 79–307. Landscape (padded height ≈ 371 dp): rail 60–314, pane up to 60–290, timeline ≈ 243–371 and 818 dp wide → the timeline's 90 % glass lies over the pane's last 47 dp: stacked translucency and stolen taps, both named violations in DESIGN.md ("Panels share a budget, not a layer").
- **Fix:** Derive the rail's top from the measured `topInset` (`padding(top = with(density) { topInset.toDp() } + Space.s)` inside the padded box) instead of the 60 dp literal; compute `paneMaxHeight = (maxHeight - timelineInsetDp - railTopDp - Space.s)` from the same measurements; in `sidePanel` mode give the pane `heightIn(max = …)` against the timeline's top, or lay the pane out to the left of the rail with `Alignment.BottomEnd` so it ends where the timeline begins.

### P1-4 The tool rail is out of one-handed reach in portrait
- **What:** HouseWorkspace.kt:285-291 — `Alignment.TopEnd` + `padding(top = 60.dp)`; four 60 dp buttons at y ≈ 60–314 on a 914 dp screen.
- **Why:** PRODUCT.md's Casey checks the plot one-handed; "Bez dachu" and "Warstwy" are the controls that answer "what did it look like before X" and they sit above the reachable half of the screen. The brief's "restrained edge controls" says nothing about the top.
- **Fix:** In portrait (`!sidePanel`) anchor the rail `Alignment.BottomEnd` with `padding(bottom = timelineInsetDp + Space.s)`, which puts the buttons at ≈ y 380–640 dp; keep `TopEnd` in landscape where the timeline already stops beside it. The right inset for framing is unchanged; the pane then grows upwards (`TransformOrigin(1f, 0.9f)`).

### P1-5 A first launch is the bundled sample, unlabelled, and the no-house state is unreachable
- **What:** AppShell.kt:185 (`preview.scenes.isEmpty()` — never true while a bundled scene ships); HouseWorkspace.kt:401-415 (top context shows title + progress only); HouseSheets.kt:39 (`house_status_bundled` exists but only in the menu list).
- **Why:** Jordan opens the app and is on "Marcówki" with "Postęp nieustawiony" and "Ustaw postęp". Nothing on the root says this is a sample or how to get their own house; the only entry to the analyzer is a menu icon whose meaning they have to guess.
- **Fix:** For `entry.source != DOWNLOADED`, render the top context's second line as "Przykład · model poglądowy" and show a status row "Dodaj swój dom z linku" routing to `onAnalyze` (this also gives the one-house owner the add path one tap from the root). Alternatively make `NoHouseScreen` the real root and list the sample in the menu only.

### P2-1 "43% · Dach" twice on the root at rest
- **What:** HouseWorkspace.kt:409-415 (`actualLine`) and TimelineRail.kt:191-198 (`NowHeader` percent + stage).
- **Why:** Baseline minor issue carried over. The DESIGN rule requires the actual state at the top *while previewing*; at rest the same three words in two glasses is repetition, not reassurance.
- **Fix:** Split the reading: top context = house name + `Measure.inline` figure ("43%") only; rail header = "Dach · Teraz: montaż więźby ›" (stage + task; the % is what the unfolded rule already shows). While previewing keep "Aktualnie: 43% · Dach" at the top as now.

### P2-2 Stock Material sheet chrome and motion on the three most-used sheets
- **What:** HouseSheets.kt:305-316 — no `shape`, no `dragHandle` override, animation on Material's spec, not `LocalMotionPolicy`; MENU → STAGES swaps two `ModalBottomSheet`s in `when (sheet)` (HouseWorkspace.kt:121-134), tearing one Dialog down and animating another up.
- **Why:** 28 dp `extraLarge` corners and a 32 × 4 dp capsule handle against DESIGN.md's "four radii, no pills"; `ANIMATOR_DURATION_SCALE = 0` does not stop the sheet's slide (the very reason `MotionPolicy` exists, Motion.kt:499-501).
- **Fix:** At minimum `shape = RoundedCornerShape(topStart = Radius.sheet, topEnd = Radius.sheet)` and `dragHandle = null` (or a 32 × 4 dp `Radius.tick` bar in `Palette.Hairline`). Better: an in-window `HouseSheet` — a scrim `Box` with `pointerInput` that dismisses, `AnimatedVisibility(enter = motion.sheetEnter(), exit = motion.sheetExit())`, `BackHandler`, `heightIn(max = maxHeight * 0.82f)` — so one sheet cross-fades into the next and reduced motion is honoured; the inspector already works this way (HouseWorkspace.kt:338-343).

### P2-3 The source sheet dumps diagnostics and carries the progress drawing
- **What:** HouseSheets.kt:195-203 (`HouseDrawing`, 200 dp, inked by *progress*, on the *source* sheet, tap = close), :206-209 (`AnalysisDiagnostics` unfolded), :210-219 (schema/objects/triangles/hash always visible), :220 (a second way to the analyzer on the same sheet as `AnalysisLine`).
- **Why:** "Where the model came from" becomes the longest surface in the app, with eight hash rows and English labels before the fold; the drawing answers a progress question on a source page.
- **Fix:** Fold `AnalysisDiagnostics` and the technical row behind one `QuietAction("Pokaż dane techniczne")` (state in `rememberSaveable`), reuse `AnalyzerScreen.Foldout` (make it internal). Move `HouseDrawing` to the stage sheet header (it is the picture of progress) or drop it (baseline Q1); keep only one way to the task per sheet.

### P2-4 What the deleted Dom page lost
- **What:** `savedDate()` orphaned (HouseSheets.kt:349-351) while `ProgressSummary.savedAtEpochMs` still exists (ProgressSession.kt:250); `progress_saved_on`, `progress_explain_show/hide`, `progress_unset_body`, `progress_done_of`, `progress_stage_share`, `progress_current_stage`, `progress_no_current_stage`, `progress_now_doing`, `progress_task_unset`, `house_switch_description`, `house_diagnostics_hide`, `model_back`, `progress_metric_spoken`, `state_selected` — 14 strings with zero references; `Measure.monumental` unused (Theme.kt:418 still says "on Dom").
- **Why:** The saved date was the owner's evidence that the record is theirs and recent; it is now nowhere. "Co to znaczy?" is not missed because the paragraph is inline, but DESIGN.md still lists the QuietAction and the 64 sp monument that the code no longer has. "Otwórz w 3D" survives only in the analyzer result, which is right.
- **Fix:** Show "Zapisano 28 września 2026" as bodySmall `InkFaint` under the stage sheet's figure (and as the rail header's second line when there is no task). Delete the orphaned strings. Decide the monument: either the stage sheet uses `Measure.monumental` (the sheet is the only place a 64 sp figure will not fight the house) or DESIGN.md and Theme.kt drop the claim.

### P2-5 Selection row: a button where the row should be the handle
- **What:** HouseWorkspace.kt:503-515 — name + storey text, `LineButton("Szczegóły")`, × button; the row itself is not clickable.
- **Why:** The rail header is a handle with a chevron (TimelineRail.kt:171-175, 195-197); the row above it, on the same glass, needs a button. Two grammars on one panel.
- **Fix:** `Row.clickable(role = Role.Button, onClickLabel = stringResource(R.string.dock_details), onClick = onDetails)` with a `chevronRight`, keep the × as the only button.

### P2-6 Two house lists with different verbs
- **What:** HouseMenuSheet (HouseSheets.kt:77-107: pick) vs `Downloads` in the task (AnalyzerScreen.kt:692-738: open + delete).
- **Why:** The task is "add a house from a link"; managing the houses on the phone is a matter of the house menu. The only delete lives where nobody looks after the first run.
- **Fix:** Remove `Downloads` from `AnalyzerScreen` (keep the just-finished `Result`); put "Usuń z telefonu" with its confirm dialog at the foot of `SourceSheet` for downloaded houses.

### P2-7 `autoOpen` is only raised by local runs
- **What:** AnalyzerViewModel.kt:239-246 (`publishLocal` sets `autoOpen`); no service-mode counterpart, so `readyKey` (AppShell.kt:145-154) never fires for a service analysis.
- **Why:** The same event ("a house finished while you looked at another") is announced on the root in one mode and silent in the other.
- **Fix:** Set `autoOpen = entry.key` wherever `AnalysisState.Completed` is published, in both modes.

### P2-8 Landscape leaves the house a 130–190 dp band
- **What:** HouseWorkspace.kt:192 (`sidePanel`), :250 (`besideRail`); timeline header ≥ 56 dp + rule 52 dp + paddings stacked under a 52–110 dp top context in a ≈ 371 dp padded height.
- **Fix:** In compact height lay `NowHeader` and the `FoldingRule` side by side (`Row`, header `weight(1f)`, rule `weight(1.4f)`), halving the timeline's height; fold the status row into the top context's second line in landscape.

### P3
- Gesture hint is `rememberSaveable` in `ReadyWorkspace` (HouseWorkspace.kt:153) and returns after every analyzer round trip and process death; persist "seen" once.
- "Stan po etapie 6 z 17" (TimelineRail.kt:220, `timeline_stop_position`) counts stops; say "Po etapie: Ściany" or drop the line.
- A second percentage — "Analiza linku w toku · 37%" — in the same glass as "43% · Dach" (HouseWorkspace.kt:463); show the analyzer line without a figure on the root, or with a thin `Hairline` track.
- The "nothing stands" glass at `Alignment.Center` (HouseWorkspace.kt:198-212) can lie over an open tool pane (x 32–379 vs pane 79–323): glass on glass, rare.
- `WorkspaceMessage` while loading shows a bare menu icon and a centred sentence, then the whole chrome pops in (HouseWorkspace.kt:531-546); draw the top context with the title and "Wczytuję model…" instead.
- Stale comments: strings.xml:315 "(miejsce podrzędne w zakładce Dom)"; strings.xml:52 "jeden odczyt dla Domu, 3D i Etapów"; Theme.kt:337, 418 name Dom/Etapy as places.
- The house menu lists re-analysed houses by title only (HouseSheets.kt:95); two downloads of the same link with different content (keyed by `sceneSha256`, DownloadedScenes.kt:175) show as two identical "Rarytasy" rows — print `entry.subtitle` (the analysis date) as the second line for downloaded houses.

DESIGN.md named rules, checked: one meaning of yellow holds (`Palette.Rule` only in FoldingRule, StageMark, PreviewMark, CompletionTrack/thumb, HouseDrawing current). Glass one layer holds at rest, broken in the two overlap cases (P1-3) and the P3 centre message. 48 dp holds everywhere I could measure (rail 64 × 60, strip 56, rows 56/64, status 48, buttons `heightIn(48)`). `stateDescription` is used on every merged node (menu rows, stage rows, strip stops, rail buttons, checklist); the three `contentDescription`s on merged buttons in AnalyzerScreen.kt:490, 711, 713 include the label text, so nothing is erased. Every `maxLines` is paired with `Ellipsis`. No hex or radius outside Theme.kt; the only raw dp literals are layout constants (60, 112, 200, 460, 360, 480) — the 60 dp rail offset is the one that should be measured instead.

## 5. Persona red flags

- **Casey (one-handed, on the plot):** the rail is at the top right (P1-4), the menu and both status-row actions are top-left; everything that reads or edits progress is at the foot, which is right. The gesture hint takes a strip above the rule for 6 s on every fresh composition. In glare, the 11 sp rail labels and 13 sp numerals remain the smallest text on the most-used controls (unchanged from baseline).
- **Jordan (first-timer):** lands on an unlabelled sample house (P1-5); taps "Menu domu" to find out; the hollow tag and "Podgląd" vs "Aktualnie" are still explained by shape only; "zobacz, czego brakuje" opens a sheet that says the phone kept "ich liczbę, nie listę" (HouseSheets.kt:242) — a promise the app cannot keep; the technical area has four names.
- **The owner with two houses:** switching is now two taps (menu → row) and a finished second analysis is offered, not forced — both real gains. But: the limited row sits permanently on Rarytasy; the sample house makes three rows in "Domy na tym telefonie"; a re-analysis of the same link becomes a second identical title with no date; deleting a house is possible only inside the "add a house" task; and in service mode no "Nowy dom gotowy" row appears at all (P2-7).

## 6. Minor observations and questions

Observations: the `Context` class (HouseWorkspace.kt:138-145) is a parameter bag without `onAnalyze`, which is the root cause of P1-2's misrouting. `HouseSheet`'s scrim is `Palette.Scrim.copy(alpha = 0.6f)` while the nav scrim is 0.6 and the status scrim 0.55 — three near-identical constants that could be one token. `StagesScreen` still keeps the whole 003C editor including the "Pokaż w 3D" buttons, which now merely close the sheet and move the cursor — good behaviour, but the label "Pokaż w 3D" implies going somewhere. `AppShell`'s `BackHandler` also calls `preview.refreshScenes()` on every back — harmless but odd. Back handling itself is sound: the `ModalBottomSheet` Dialog owns the back press while open and dismisses through `onCloseSheet`; the workspace's tool/details/selection handlers are enabled only while their thing is open, and from the bare house no handler is enabled so predictive back works.

Questions:
1. If the header already says "Dach" and is the edit path, why does the sheet need to be all seventeen stages? What would a one-stage sheet lose that the owner would miss?
2. The status row is a 48 dp lane that can hold one of four messages by priority. Which of those four is worth a permanent line under the house's name, and which is a one-time toast?
3. With the house as root, is the tool rail's label-visibility (the reason direction A beat C) worth more than thumb reach? Could the rail live at the bottom right and keep its labels?
4. Should the bundled Marcówki ever be the root for a real owner, or is the sample a menu row and the no-house state the honest first screen?
5. `HouseDrawing` survived by moving to the source sheet. Is there a screen where an inked drawing of progress belongs now that the house itself is always on screen — or is it the frame shown while Filament warms up after the analyzer task?

## Fixed after this critique (commit "fix(ui): apply Impeccable house-first critique")

- P1-1 the stage sheet is capped at 82 % of the window (the house's ridge stays in view), its list opens scrolled to the current stage, its header carries the inked house drawing, the one monumental figure, "N z 17 zakończonych" and the saved date; the house's name is not repeated.
- P1-2 the status row routes a running or failed analysis to the task, says a model's limitations once per house, offers a finished house (opening it clears the offer) and, on the bundled sample, "dodaj swój dom z linku".
- P1-3 the rail and its pane are laid out between the measured top context and the measured bottom stack; no literal 60 dp, no pane under the timeline.
- P1-4 upright, the rail stands above the timeline at the thumb; on a phone on its side it stays at the top beside the bottom stack.
- P1-5 the bundled sample is named as such on the root with the add path one tap away.
- P2-1 "43% · Dach" is no longer printed twice: the top context says the saved date while the timeline shows now, the actual state while previewing or while the details replace the timeline.
- P2-2 the sheets take the system's 12 dp corners and no pill handle.
- P2-3 the source sheet folds the technical rows and diagnostics behind "Dane techniczne"; the drawing moved to the stage sheet.
- P2-4 the saved date is back (stage sheet and top context); the orphaned Dom strings are deleted; the 64 sp monument lives on the stage sheet.
- P2-5 the selection row is the handle into the details, with a chevron.
- P2-6 the analyzer task no longer lists the houses; removing a downloaded house is on its source sheet.
- P2-7 a finished service analysis is offered on the root like a local one.
- P3 "Stan po etapie: Ściany" instead of a count of stops; stale comments.

Not done (residual): in-window sheets honouring `MotionPolicy` (P2-2's larger half); the landscape timeline as a row (P2-8); a persisted "hint seen"; the analysis date as the menu row's second line.
