# 003C — Audit Cycle 2: Impeccable `audit` (native) + `adapt` (native)

Input: CI run 66 UI evidence (commit `507d5c7`), 2026-09-28. Produced by an Impeccable audit sub-agent reading `.claude/skills/impeccable/reference/audit.native.md`, `adapt.native.md` and `android.md` against the captures and the code. Recorded verbatim (indentation removed); fixes and verification are in the stage report, *Audit Cycle 2*.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | 3D elements can only be reached by tapping the model; "Wróć do teraz" touches the scrub band with no gap (0 dp) |
| 2 | Performance | 2 | Scenes are read, hashed and parsed on the main thread at launch and on every open; the render loop draws every vsync even when idle |
| 3 | Appearance & Theming | 3 | Light system-bar icons are forced on and disappear over the Makieta/Kreska backgrounds (1.57:1) |
| 4 | Platform Conformance | 3 | Screens under the Scaffold ignore keyboard (IME) and display-cutout insets; predictive Back is not declared |
| 5 | Adaptivity | 2 | Landscape is a stretched portrait layout; the details sheet fills the whole landscape window; no window size classes |
| **Total** | | **13/20** | **Acceptable** |

## Platform Conformance Verdict
**PASS.** It reads as a native Compose app, not a port. It uses Material AlertDialog, ModalBottomSheet, OutlinedTextField and Slider. The Back chain is pure and correct: pane → details → selection → leave (ShellState.back). The 3D screen goes edge-to-edge through safeDrawing.

Violations:
- Light nav-bar icons are forced on over light 3D backgrounds.
- No IME or cutout insets outside 3D.
- Predictive Back is not declared.
- Short-lived feedback is inline text instead of a snackbar.
- One filled Material icon sits in an outline icon set.

## Executive Summary
- **13/20 (Acceptable).** 17 issues: P0 0 · P1 3 · P2 10 · P3 4.
- Most important: C2-01, C2-02, C2-03, C2-05, C2-10.
- Next: optimize → adapt → harden → clarify → polish.

## Detailed Findings

### P1
**C2-01 System navigation icons disappear over light 3D backgrounds**
- Location: MainActivity.kt:54-57 (SystemBarStyle.dark always); ModelWorkspace.kt:154-160 (scrim at the top only); PresentationMode.kt:133,153; screenshots slice-rarytasy-10, slice-marcowki-10
- Category: Theming / Conformance
- Impact: In Makieta the 3-button bar is #FFFFFF on #D0CEC9 (sampled), which is 1.57:1. Kreska's background (sRGB 0.86) is paler still. On the building site in daylight, Back and Home are effectively invisible.
- Guideline: Edge-to-edge requires system-bar icons to contrast with the content behind them.
- Recommendation: Mirror the top scrim at the bottom (nav-bar inset + 24 dp), or set isAppearanceLightNavigationBars/StatusBars from the active PresentationLook.
- Suggested command: /impeccable harden

**C2-02 Landscape: the details sheet fills the window and runs under the status bar**
- Location: ModelWorkspace.kt:240-266 (outside safeDrawing; maxHeight = 460.dp; only navigationBarsPadding); Inspector.kt:76
- Evidence: in default-12 the sheet measures 457 dp (1074→2274 px); the landscape window is 411 dp. This comes from source plus that measurement; there is no landscape capture of the details sheet.
- Category: Adaptivity
- Impact: The model, top bar and tool rail are fully covered. The header sits under the clock and in the cutout band. frameBottom becomes the full window height, so the rule "the element stays in view above its details" has no room to work.
- Guideline: Restructure for compact height; respect status-bar and cutout insets.
- Recommendation: At compact height, show details as a side panel on the end edge (~360 dp, full safe height) beside the model. Otherwise cap it at min(460 dp, 55% of the window) and apply safeDrawing top/start.
- Suggested command: /impeccable adapt

**C2-03 Scenes are read, hashed and parsed on the main thread**
- Location: PreviewViewModel.kt:45,109-112,132-148 (init runs inside viewModel() in setContent); DownloadedScenes.kt:218-236 (readBytes + SHA-256 + parse); SceneRepository.kt:63-80 (470–580 KB assets); Viewport.kt:64-66 (upload on Main); AppShell.kt:83 (index re-read on every Back)
- Category: Performance
- Impact: The first frame waits for the parse. Switching houses or auto-opening an analysis freezes the UI. ScreenState.Loading is set and overwritten in the same call, so "Wczytywanie…" never appears.
- Guideline: No disk- or CPU-heavy work on the main thread or before the first frame.
- Recommendation: Load in viewModelScope on Dispatchers.IO/Default; publish Loading, then Ready; refresh the scene list off the main thread.
- Suggested command: /impeccable optimize

### P2
(Format: Location · Category · Impact · Guideline · Recommendation · Command)

**C2-04 Render loop runs every vsync while idle** — FilamentCanvas.kt:55-72, FilamentModelRenderer.kt:399-405 · Performance · drains battery and heats the phone during long on-site sessions (shadows on; ambient occlusion in Makieta) · avoid wasted rendering · render only when something changed (gesture, pose animation, state, resize); stop posting frames otherwise · /impeccable optimize

**C2-05 No IME inset handling** — no imePadding or windowSoftInputMode anywhere (targetSdk 35); screenshot font-1.3-04 · Conformance · the keyboard covers the places bar and the list runs behind it. The "Zapisz" button that appears under the task field (StagesScreen.kt:318-320) and "Zapisz adres" (AnalyzerScreen.kt:238) end up under the keyboard, leaving only the ✓ key to save · apply IME insets · adjustResize + imePadding()/WindowInsets.ime; hide the bar while typing · /impeccable harden

**C2-06 Screens under the Scaffold ignore the display cutout** — HouseScreen.kt:81, StagesScreen.kt:82, AnalyzerScreen.kt:104, EmptyPlace.kt:43 (status-bar padding only; the Scaffold default is systemBars); landscape-01/-04 · Conformance · content starts at x=43 px while the status bar and the 3D top bar start at 129–150 px. Stage numbers (x≈43–58) scroll through the camera punch-hole area · apply displayCutout insets · contentWindowInsets = WindowInsets.safeDrawing · /impeccable harden

**C2-07 Landscape Dom shows only the drawing** — landscape-01; HouseDrawing.kt:45 (fixed 232 dp); AppShell.kt:96-98 · Adaptivity · the percentage, the current stage and "Otwórz w 3D" are below the fold; the bottom bar takes 65 of 411 dp · restructure, don't stretch · see Adapt · /impeccable adapt

**C2-08 Houses sheet cannot scroll** — HouseScreen.kt:379 (no verticalScroll in the ModalBottomSheet); from source, no capture · Adaptivity · 5 bundled + 2 analysed houses need about 560 dp, more than the 411 dp landscape window, so the last houses and "Dodaj dom z linku" can't be reached · never hide functionality · use a LazyColumn · /impeccable adapt

**C2-09 "Wróć do teraz" touches the scrub band** — default-08 (the button's bottom and the rule's tags are both at y=2093 px); TimelineRail.kt:119-131; FoldingRule.kt:95-115 · Accessibility · a slightly low tap previews stop ~11–13, the opposite of what the user wanted · 48 dp targets, 8 dp apart · add an 8 dp spacer, or start the scrub band below the tags · /impeccable layout

**C2-10 3D elements need touch geometry** — Viewport.kt:103-145 · Accessibility · elements can only be selected by tapping the model and zoom only works by pinching. TalkBack and switch users can reach the details panel only through the Schody/Wejście presets · WCAG 2.5.1 · add an "Elementy" list (by storey or stage) in Warstwy; add zoom ± in Widok · /impeccable harden

**C2-11 Feedback is not announced and is often off-screen** — StagesScreen.kt:110-113,181-199 (the notice is list item 3, while the edit happens further down); AnalyzerScreen.kt:130 · Conformance · refusals and save failures go unseen and unheard · use snackbars for short-lived feedback · add a SnackbarHost to the Scaffold · /impeccable clarify

**C2-12 Predictive Back not declared** — AndroidManifest.xml has no enableOnBackInvokedCallback, though AppShell.kt:50-53 relies on it · Conformance · no back-to-home preview; the pane and sheet close without the back-progress animation · honour predictive Back · opt in; add PredictiveBackHandler to the tool pane and the details panel · /impeccable harden

**C2-13 English errors reach the owner** — DownloadedScenes.kt:219-236 and SceneRepository.kt:59-78, shown via HouseScreen.kt:158 and ModelWorkspace.kt:84 · Clarity · a Polish-only product shows English failure text · PRODUCT.md copy rule · map typed failures to strings.xml; keep English under "Dane techniczne" · /impeccable clarify

### P3
**C2-14 Icon drift** — TimelineRail.kt:26-27,115 uses the filled KeyboardArrowUp among the ShellIcons outlines, which ShellIcons.kt:12-16 forbids · Conformance · /impeccable polish

**C2-15 Double speech** — TimelineRail.kt:102 has a polite live region (which includes the button label), and FoldingRule.kt:118 changes the rule's state, so each scrub step is spoken twice. StagesScreen.kt:231 also repeats the visible state text · Accessibility · /impeccable polish

**C2-16 sp text in a fixed-dp Canvas** — FoldingRule.kt:143-144,231: the numerals are always dropped on the 40 dp static rule (default-05 and landscape-04 show ticks only), and on the 52 dp rule above ~1.6× font scale · Accessibility · /impeccable typeset

**C2-17 Layout feedback loop** — ModelWorkspace.kt:118-131,175,200,229-233: onGloballyPositioned writes state, which recomposes every frame while the chrome slides · Performance · /impeccable optimize

## Adapt Assessment
**Source context:** phone, portrait, one-handed.

**Target contexts:** landscape phone (914×411 dp, compact height); ≥600 dp width (unfolded foldable, tablet, split-screen); keyboard (IME); multi-window. There is no tablet capture, so the ≥600 dp assessment is from source only. Nothing reads a window size class. The only adaptation is the 3D screen's COMPACT_HEIGHT = 480 dp check via BoxWithConstraints, which is the right basis.

**What breaks:**
- C2-02 and C2-05 to C2-08.
- At ≥600 dp every screen stretches: "Otwórz w 3D" goes full width, Etapy rows put the chevron far from its label, and the details panel is a full-width bottom sheet. Only EmptyPlace caps its width (560 dp).
- Each multi-window resize recreates the Activity and re-uploads the geometry on the main thread (Viewport.kt:50,64).

**Landscape phone — ship now:**
- NavigationRail at the start edge (cutout-safe) when height is compact.
- Dom in two panes: the drawing fills the left; progress, current stage and "Otwórz w 3D" on the right.
- Details panel on the end edge.
- Scrollable houses sheet.
- IME and cutout insets.

**≥600 dp — later, when tablets are a target:**
- currentWindowAdaptiveInfo() drives a rail at medium width and a permanent drawer at expanded width.
- Etapy as list-detail: list on the left, the opened stage's editor on the right.
- Dom as list-detail: houses | house.
- Details panel as a side sheet; timeline max ~720 dp.
- Ship one cheap guard now: content width caps (~640 dp), so split-screen and unfolded phones never stretch.

## Patterns & Systemic Issues
- Insets are solved screen by screen. 3D uses safeDrawing; everything under the Scaffold uses only statusBarsPadding, so cutout and IME insets fall through the gap.
- Synchronous I/O in view-model entry points: open, init, refreshScenes, and ProgressStore save.
- Layout constants in dp that assume portrait: 232 dp drawing, 460 dp sheet, 60 dp rail offset, and 40/52 dp canvases holding sp text.

## Positive Findings
- Merged-node semantics are done right: stateDescription rather than contentDescription (AppShell.kt:164-165), and fact rows keep both texts.
- FoldingRule is a real adjustable control: range info, setProgress, previous/next/"Wróć do teraz" actions, a haptic tick per stop, tap-to-stop, and the expanded strip as a tap alternative to scrubbing.
- MotionPolicy follows the system animator scale live, and camera moves snap when motion is reduced (PreviewViewModel.kt:198-205).
- Per-frame values are read in the draw/layer phase; scrubbing never re-uploads geometry or moves the camera.
- At font scale 1.3, no primary label is clipped across the 18 captures, and every maxLines is paired with Ellipsis.
- The documented contrast ratios hold: InkMuted 8.4:1, InkFaint 6.0:1, RuleEmpty 3.9:1. The disabled "Analizuj projekt" (~3.0:1) is exempt, and the faded chrome (~1.6:1) only appears while a finger is on the model.
- State is never shown by colour alone (shape, hollow vs solid tag, words), and orientation is not locked.

## Recommended Actions
1. **[P1] /impeccable optimize** — load scenes off the main thread with a visible Loading state (C2-03); render only on change (C2-04); fix the layout loop (C2-17).
2. **[P1] /impeccable adapt** — landscape details panel (C2-02), rail + two-pane Dom (C2-07), scrollable houses sheet (C2-08), width caps.
3. **[P1] /impeccable harden** — system-bar legibility over light backgrounds (C2-01); IME and cutout insets (C2-05, C2-06); accessible element list and zoom (C2-10); predictive Back (C2-12).
4. **[P2] /impeccable layout** — spacing between "Wróć do teraz" and the rule (C2-09).
5. **[P2] /impeccable clarify** — snackbar feedback (C2-11); Polish error copy (C2-13).
6. **[P3] /impeccable typeset** — rule numerals (C2-16).
7. **/impeccable polish** — icon drift and double speech (C2-14, C2-15), then the final pass.

No repository files were edited. The only scratch files (crops and the report draft) are in (scratch folder)
