# House-first critique of the run-73 UI (INTEGRATION-004A, §30 baseline)

Method: dual-agent (A: a5465cc282137d263 · B: a49e4370ffbc5c1d2), Impeccable
`critique` playbook, native Android target. Target:
`apps/android/app/src/main/java/com/buildplan/preview/ui` at BuildApp HEAD
`d199a0eb` (003C run 73, 76/76 required screenshots valid). Evidence: run-73
captures and manifests in `stage-reports/artifacts/integration-003c/final/`,
the code as read, and the deterministic hand-checks of Assessment B. Visitor
mode: Operate. Brief being scored: the OWNER's house-first override (§22–§28
of the 004A brief), which revokes the 003C "five places" contract. The 003C
PASS therefore does not carry over; this is the new baseline.

Detector note: `impeccable detect --json` on the Kotlin package returns `[]`
with exit 0 because the detector v0.1.5 scans `.css .htm .svelte .tsx` only;
that is a silent skip, not a pass. Deterministic evidence comes from
Assessment B's hand-checks instead (below). No browser step exists for a
native Compose app.

## Design health score (Operate, all ten apply)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Source/model status only on Dom; the task line vanishes in preview and while the inspector is open |
| 2 | Match system / real world | 3 | "Stan po etapie 8 z 17" counts stops; "Aktualnie:" prefix; "Rzut równoległy" |
| 3 | User control and freedom | 2 | "Ustaw postęp" drops `cameFrom` and resets the preview; analyzer success evicts the open house and its camera |
| 4 | Consistency and standards | 2 | Two navigation grammars; "43% · Dach" printed twice on 3D; two house lists |
| 5 | Error prevention | 3 | Preview never saves; one in-progress stage; leaving 3D silently drops the cursor |
| 6 | Recognition rather than recall | 2 | Two tabs the owner must remember are empty; the edit affordance is nowhere near the number |
| 7 | Flexibility and efficiency | 1 | 5 taps to record a stage from 3D; 4 to switch a house; every launch costs a tap to reach the house |
| 8 | Aesthetic and minimalist design | 2 | Dom restates 3D; 40 % of the bar is empty; the house is ~13 % of the 3D screen under a 25 % void |
| 9 | Error recovery | 3 | Good words (`LoadProblem`, `Failure`, `ProblemLine`) but always on another page than the house |
| 10 | Help and documentation | 3 | Hints exist; the hollow-vs-solid tag is never explained in place |
| | **Total** | **24 / 40** | Needs work (003C scored 26 against its own contract) |

Cognitive load: 5 of 8 checklist failures (repetition on one screen; controls
away from their object; dead ends in primary navigation; core task > 2 steps;
state lost across transitions).

## Design specificity verdict

**Authored skin on a stock skeleton.** The visual world is owned and
consistent (the folding rule, the hollow preview tag, graphite glass with a
rim, ink-only actions, one accent with one meaning, Barlow Condensed for
measures only). The information architecture under it is the Material 3
category default: a five-cell bottom bar with a home page, a viewer tab, an
editor tab and two placeholders. Against the house-first brief the structure
is the loudest stock element on screen.

Deterministic scan (Assessment B, 24 files, 6 605 lines, 105 composables):
0 hex colours outside `Theme.kt`, 0 `!!`, 0 `@Suppress`, 0 empty `catch`,
0 `maxLines = 1` without ellipsis, 0 literal `contentDescription`, 3 literal
`Text("…")` (two URL placeholders, one computed template). One interactive
band under 48 dp: `FoldingRule` at `RuleDefaults.StaticHeight = 40.dp` when a
caller passes it with `onScrub` (the static uses on Dom and Etapy have no
scrub, so no live violation). Timers: a 6 s gesture hint and a 6 s notice,
both self-dismissing. Every manifest records `animatorDurationScale 0.0`;
seven at font 1.0, one at 1.3. No manifest records `contentInsets`.

## §30 audit answers (measured)

1. **Why does the bottom nav exist?** Because PRODUCT.md §Capabilities froze
   "five places, and only five" and `AppPlace` enumerates them. One place is
   the house (3D), one is a page about it (Dom), one edits a number the rail
   already shows (Etapy), two are empty. Nothing needs a top-level page.
2. **What truly requires leaving 3D?** Today: setting progress, adding or
   switching a house, reading source status, analyzer settings. None of
   these needs a page; each is a sheet or a modal task.
3. **Can progress be manipulated around the house?** No. `NowHeader` is
   display-only; `ProgressViewModel`'s mutators are called only by
   `StagesScreen`. Missing: an edit affordance on the current stage and a
   one-stage sheet.
4. **Does persistent nav compete with the model?** On Dom the bar is 7.1 %
   of height and the drawing 25 %; on 3D the bar is hidden but the chrome
   bands take 18.6 % (28.6 % with system bars), the rail 17 % of width for
   28 % of height, and the house is ~12.7 % of the area (manifest: walls'
   extent 0.69 / 0.30 in the free area) under a 25 % void. With the
   inspector open the house is ~5 %.
5. **Can the analyzer be contextual?** Yes. `AnalyzerViewModel` already runs
   independently of the screen; only `ShellState.analyzerOpen` and the full
   page make it a place. Entry points: no-house state, the house menu, a
   status line on the workspace. Today success evicts the open house
   (`autoOpen` → `openKey` → new camera at home) and cancel returns to Dom.
6. **Empty modules?** 2 of 5 cells (40 % of the bar), two 64 dp thumb-zone
   targets that return a paragraph.
7. **One-handed?** The bottom layers (rule, "Wróć do teraz", inspector
   actions) are right; the house switcher, back arrow and the analyzer's
   link field are top-anchored or on another page.
8. **Outdoor readability?** Chrome text is strong (Ink 15.6:1, InkMuted
   8.4:1, InkFaint 6:1). The model silhouette is weak in glare (roof ≈ 1.5:1
   on the renderer ground); the smallest text (13 sp numerals, 11 sp rail
   labels) sits on the most-used controls.
9. **Gesture area?** ~70 % of the screen accepts orbit/pan at rest, ~43 %
   with a tool pane, ~52 % with the inspector. Glass is solid to the finger;
   the scrims do not steal. The gesture hint steals a strip for 6 s.
10. **Progress clarity?** Dom gives the triple (%, stage, task) cleanly; 3D
    gives it twice and loses the task the moment anything opens.
11. **Return-to-house speed?** Cold launch 1 tap every session; set progress
    from 3D 5 taps with back landing on Dom; switch house from 3D 4 taps;
    analyzer not reachable from 3D (4-tap round trip, cursor reset).

## What's working (keep)

1. **The construction rail is already Layer 3.** Scrub and tap stops, hollow
   vs solid tag, the actual state repeated at the top, no camera move and no
   re-upload while scrubbing (manifest: `modelUploads during scrub 0`).
2. **The tool rail is a working Layer 2.** Labelled buttons, one opaque pane
   at a time, labels naming the non-default state, zoom without pinch, an
   element list for gloves and TalkBack.
3. **Honest state language.** "Postęp nieustawiony", "gotowy z
   ograniczeniami", "Na tym etapie model 3D się nie zmienia". Only the
   placement is wrong.

## Priority issues

- **[P0] The house is not the root; the shell is.** `ShellState()` defaults
  to Dom; `ModelWorkspace` is an immersive leaf reached through a tab.
  Fix: render the workspace as the root whenever a house exists; delete
  `AppPlace`, `PlacesBar`, `PlacesRail`; reduce `ShellState` to a surface
  plus one sheet with the same pure `back()`.
- **[P1] Progress can be looked at around the house but never touched
  there.** Fix: a one-stage sheet reusing the Etapy editors, opened from the
  rail's header and from the stage strip; the house stays at the same pose.
- **[P1] Two of five destinations are empty.** Fix: remove Koszty and
  Dokumenty as destinations; Koszty becomes a named future boundary reached
  from the house menu, Dokumenty folds into the source sheet.
- **[P1] The analyzer is a place, and its result evicts the house.** Fix: a
  task surface launched from the menu and the no-house state; a running or
  failed run shown as one line on the workspace; on success return to the
  same house and pose and offer the new one; a source sheet in the
  workspace.
- **[P2] The house does not occupy the screen.** Fix: frame to the real free
  rectangle, keep the rail restrained, cap the inspector below the house.

## Persona red flags

- **Casey (one-handed, distracted):** a drawing before the house; dead tabs
  in the thumb zone; "Ustaw postęp" flings them onto a 17-row list; back
  afterwards lands on Dom.
- **Jordan (first-timer):** "Dom" and "3D" both show the house; "43% · Dach"
  top and bottom; two Dachs, one hollow, one solid, unexplained in words.
- **The owner on the plot:** "before the roof" works well; "więźba done,
  60 %" is five taps and a text field; the second plot's house is four taps
  away.

## Minor observations

"43% · Dach" printed twice on the root; "Szczegóły" beside × where the row
should be the handle; "Dopasuj" among three toggles; two house lists; two
labels for "return to the house"; font 1.3 Dom paints "Dodaj dom z linku"
under the fold gradient; landscape Dom hides "Teraz robimy…"; Etapy repeats
`progress_explain`; "Stan po etapie 8 z 17" is analyzer vocabulary;
"Wybierz element z listy (91)" is the renderer's count.

## Questions to consider

1. With the house as root, is `HouseDrawing` worth keeping beyond the house
   switcher and the frame shown while Filament warms up?
2. Should the rule's current segment be the editor, so the folding rule is
   set, not only read?
3. Should the no-house state be the same graphite ground with one "Dodaj dom
   z linku" standing on it, so the first screen and the hundredth are the
   same place?
4. With no tabs, does back from the root leave the app, and does the house
   need a back arrow at all?
5. When a second analysis finishes while the owner is looking at the first
   house, who decides which house is on screen?

Questions skipped: the OWNER brief already answers the direction (house is
root; analyzer is a task; Koszty a future boundary); the remaining questions
are answered in `house-first-directions.md`.
