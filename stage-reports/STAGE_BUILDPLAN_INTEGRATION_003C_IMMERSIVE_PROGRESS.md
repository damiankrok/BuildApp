# STAGE BUILDPLAN-INTEGRATION-003C — Immersive workspace + construction progress + 3D hotfix

**Result: PASS_BUILDPLAN_INTEGRATION_003C_IMMERSIVE_PROGRESS_VERTICAL_SLICE_READY_FOR_OWNER**

This is the **resume** of 003C, on top of the P0 fix and the progress foundation from the first session (sections C, D, J–M below keep their proven content). This session:

- ran the vendored **Impeccable** skill (context, init → PRODUCT.md, new-work direction, craft, three audit cycles, finish);
- rebuilt the product workspace (Dom, immersive 3D with the construction timeline, Etapy, Koszty, Dokumenty, analyzer entry);
- ran **three distinct audit → fix → verify cycles**, each on fresh device evidence from its own commit;
- added a device gate for the UI: the owner's journey at font 1.0 and 1.3, landscape, three release-candidate journeys and the two reference projects analysed through the app.

Every number below comes from a test, a file, a CI run or a command named next to it. Nothing is presented as OWNER acceptance: technical PASS is not visual acceptance.

## A. Baseline heads

| repository | ref | required | found at resume |
| --- | --- | --- | --- |
| `damiankrok/BuildApp` | `integration/immersive-progress-v1` | `30135c64f2cbae450c331b08005bb58585a94b84` | `30135c64f2cbae450c331b08005bb58585a94b84` |
| `damiankrok/BuildPlan-PC-Legacy` | `main` | `b0e79675c7ebeacf718cd1392f62272fb400418b` | `b0e79675c7ebeacf718cd1392f62272fb400418b` (unchanged at the end, clean worktree) |

The donor was only read: no commit, branch or file change.

## B. Branch and final HEAD

`integration/immersive-progress-v1`, the existing branch (created from `integration/product-shell-rarytasy-v1 @ 2d8ee75` in the first session). No new branch, no history merged, no force push, nothing merged to `main`.

- Final UI/code HEAD: **`6f9da1b`** (the OWNER APK and the final evidence set are built from it).
- The report commit follows it and changes documentation only.

# IMPECCABLE AUDIT

## E. Impeccable invocation proof

| step | what ran | output in the repo |
| --- | --- | --- |
| install | Impeccable vendored as a project skill (commit `30135c6`, before this session's resume point): `.claude/skills/impeccable/` (SKILL.md, 50 references incl. `android.md`, `audit.native.md`, `adapt.native.md`, the `impeccable` CLI) and `.claude/agents/impeccable-*.md`. Not reinstalled. | `.claude/skills/impeccable/` |
| context | `impeccable context` from `apps/android` | — |
| init | product interview (primary user = homeowner; mixed home + site use; positioning kept) | `apps/android/PRODUCT.md` |
| new-work | direction chosen by the OWNER: **"The Folding Rule"** (progress read on a carpenter's rule of 17 segments) | `apps/android/.impeccable/surfaces/app-src-main-java-com-buildplan-preview-ui.md` (surface brief + direction contract) |
| craft / craft-floor | the workspace built against the contract (commit `80b9887`) | code |
| critique (baseline) | dual-agent: A design review, B detector (`impeccable detect --json ui/` → `[]`, 0 scannable native files; the engine proved on a control HTML) | `apps/android/.impeccable/critique/2026-09-28T19-44-31Z__…md` — **21/40** |
| **Cycle 1** critique | dual-agent, same method, on run 63 | `apps/android/.impeccable/critique/2026-09-28T21-45-46Z__…md` — **26/40** |
| **Cycle 2** audit + adapt | `audit.native` + `adapt.native` on run 66 | `stage-reports/artifacts/integration-003c/impeccable/cycle2-audit-native-adapt-native.md` — **13/20** |
| **Cycle 3** polish + harden | release-candidate lens, journeys A–E, on run 70 | `stage-reports/artifacts/integration-003c/impeccable/cycle3-polish-harden.md` — **15/20** |
| finish | `impeccable-finish-reviewer` on the final build; `impeccable-documenter` | reviewer verdict *fix first* (1 P1, 3 P2, 2 P3) → fixed in `89c8ad6`, `1169321`, `6f9da1b` (see *Finish*); `apps/android/DESIGN.md`, `apps/android/.impeccable/design.json` |

- Critique snapshots were written with `impeccable critique-storage write` and trended with `critique-storage trend` (21 → 26).
- The detector is a web tool: it finds nothing to scan in Compose, and the browser overlay does not apply to a native app. That is stated, not hidden; the native checks (hex outside `Theme.kt`, `!!`, `@Suppress`, empty `catch`, contrast of every text token, targets under 48 dp, `maxLines = 1` without ellipsis) were run by hand in each cycle.
- Not available in this session, so not used: the secondary lenses (`frontend-design`, Emil Kowalski's skill, Mobbin).
- Critique questions were not put to the OWNER mid-run (the resume instruction said not to ask); the baseline answers stayed in force (order 3D + timeline, Dom, Etapy; analyzer link first, choices folded; inspector sizes rounded, certainty moved). The open ones are in the final OWNER questions.

## F. BEFORE UI audit

Baseline critique on the UI at `30135c6` (the 003B product shell with the P0 fix), captured on CI run 58 (`stage-reports/artifacts/integration-003c/after-run58/`: Dom, 3D from Dom, 3D at font 1.3). **21/40**, P0 1, P1 3.

| # | heuristic | score | key issue |
| --- | --- | ---: | --- |
| 1 | Visibility of system status | 2 | no build status: no %, stage or "Teraz" |
| 2 | Match with the real world | 2 | analyzer copy in English engineering terms |
| 3 | User control and freedom | 3 | back chain sound; 3D hides the navigation |
| 4 | Consistency and standards | 2 | "Cały dom" in two menus; Material lavender leaks |
| 5 | Error prevention | 3 | link validation, delete confirmation |
| 6 | Recognition rather than recall | 2 | 4–5 of 6–7 dock tools off-screen |
| 7 | Flexibility and efficiency | 2 | accelerators hidden |
| 8 | Aesthetic and minimalist design | 2 | Dom card stack, two equal primaries, opaque bars around 3D |
| 9 | Error recovery | 2 | Dom failure line without a reason or a retry |
| 10 | Help and documentation | 1 | no gesture hints, no first-run guidance |

Priority issues: **[P0]** construction progress absent (no %, stage, task, timeline, Etapy a poster); **[P1]** Dom a card-stack dashboard with no house; **[P1]** 3D framed by stacked opaque rectangles (19.4 % chrome, 2 of 6 tools visible at 1.0, 1 at 1.3); **[P1]** the analyzer a half-English debug console (127 literals, English TalkBack); [P2] three dead-end places and no navigation in 3D.


## Required area table

BEFORE = the baseline critique (`30135c6`, run 58). AFTER = the final build (`6f9da1b`, run 73). Captures are in that run's `ui-evidence` artifact (prefix `default-`, `font-1.3-`, `landscape-`, `rc-c/d/e-`, `slice-marcowki-`, `slice-rarytasy-`).

| # | area | BEFORE | AFTER | evidence | status |
| ---: | --- | --- | --- | --- | --- |
| 1 | Dom hierarchy | card stack, two equal primaries, no house | name + source status; the inked axonometric of the house (derived from the model); one monumental figure "43%" read off the rule; current stage + task + "Zapisano …" as one row into Etapy; one ink primary "Otwórz w 3D"; "Dodaj dom z linku" a quiet link; two panes on a wide window | `default-01`, `default-05`, `landscape-01`, `slice-*-03` | FIXED |
| 2 | Navigation | bottom bar; gone in 3D; three dead ends | five places (Dom, 3D, Etapy, Koszty, Dokumenty); a navigation rail on short or wide windows; the bar steps aside while typing; 3D immersive with its own back; predictive back declared | `default-*`, `landscape-01/05`, `rc-c-*` | FIXED |
| 3 | 3D dominance | 19.4 % opaque chrome, model boxed | model full-bleed under glass chrome; the house framed inside the free area left by the chrome (0/0 house pixels at the free area's edges in portrait, font 1.3 and landscape) | `default-06`, `font-1.3-06`, `landscape-02` | FIXED |
| 4 | Top chrome | opaque title bar | one glass strip: back, house name (ellipsized), status | `default-06`, `font-1.3-06` | FIXED |
| 5 | Tool controls | 6–7 tools in a scrolling dock, 2 visible | labelled right rail (Wygląd, Warstwy, Widok, Dopasuj; "Szczegóły" with the chosen element); panes grow from their control; element list in Warstwy; Przybliż/Oddal in Widok | `default-06`, `rc-e-05` (Warstwy with the element list), `landscape-02` | FIXED |
| 6 | Timeline | none | the folding rule at the bottom: 17 stages + the design, tap/drag to a stage, expand for the named strip | `default-06..10`, `default-13` (expanded), `font-1.3-07` | FIXED |
| 7 | Progress communication | none | "43% · Dach", "Teraz: …", done-of-total, "Co to znaczy?" (by stages, not money); the same figure on Dom, 3D and Etapy | `default-05/06`, `slice-*-05` | FIXED |
| 8 | Historical scrub | none | "Podgląd: Ściany" + position + "Wróć do teraz"; the actual state is never replaced; stages without geometry say so; no upload, no camera move | `default-07..10`, `slice-*-07..10`, `rc-d-03` | FIXED |
| 9 | Inspector | English export table, 460 dp sheet | Polish headline, storey, stage line with the owner's mark, sizes once, certainty in words; export data folded under "Dane techniczne"; a side panel in landscape | `default-12`, `slice-*-11`, `landscape-04`, `rc-e-03` | FIXED |
| 10 | Koszty empty state | dead card | honest "Jeszcze niedostępne": what will be here, that nothing is saved or priced, a way to Etapy | `default-16` | FIXED |
| 11 | Dokumenty empty state | dead card | same pattern; the model's source is found at the house | `default-17` | FIXED |
| 12 | Analyzer entry | half-English debug console | link first, Polish stages, "Model gotowy" / "Model gotowy z ograniczeniami", diagnostics folded; failures by cause, no futile retry; the form unlocks when a job ends; screen kept on while analysing | `default-15`, `slice-*-01/04`, `rc-d-04` | FIXED |
| 13 | Touch targets | several < 48 dp | 48 dp everywhere measured, including the analysis line on Dom | cycle 2/3 audits | FIXED |
| 14 | Typography | stock M3 | Barlow Condensed numerals for the measure, body in the system face; rule numerals fit their measured height | `default-05`, `font-1.3-*` | FIXED |
| 15 | Font scale | "Doku…", clipped at 1.0 | whole journey at 1.3 with every `maxLines = 1` ellipsized; preview header on two rows | `font-1.3-01..18` | FIXED |
| 16 | Motion | per-screen durations | one `MotionPolicy`: arrivals slower than exits, < 250 ms, staged replacement; system "Remove animations" honoured (every spec a cut) | `reducedMotion=true`, `animatorDurationScale=0.0` in every manifest | FIXED (normal-speed motion not exercised on CI) |
| 17 | Glass / opacity | opaque bars | one glass layer over the model; chrome over chrome opaque; navigation-bar scrims over light modes | `default-06`, `rc-e-04` | FIXED |
| 18 | Blank 3D lifecycle bug | P0 (dock covered the model) | fixed in `6e1dcf8`; the 3D gate plus Dom → 3D → back → 3D, pause/resume, recreate and restart on the device, one engine throughout | 3D gate; `default-14`, `slice-*-12`, `rc-c-01/02` | FIXED |


## Convergence

| point | commit | device evidence | Impeccable score | P0 | P1 | P2 | P3 |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| BEFORE | `30135c6` | run 58 | critique 21/40 | 1 | 3 | 1 | — |
| Cycle 1 input | `f43ea2e` | run 63 | critique 26/40 | 0 | 3 | — | — |
| Cycle 2 input | `507d5c7` | run 66 | audit.native 13/20 | 0 | 3 | 10 | 4 |
| Cycle 3 input | `0ad5ef3` | run 70 | audit.native 15/20 | 0 | 2 | 6 | 3 |
| after Cycle 3 | `af49ee7` | run 71 | — | 0 | 0 | 2 partial (reasons below) | — |
| after finish | `6f9da1b` | run 73 | finish review: fix first → fixed | 0 | 0 | 1 OWNER_REVIEW (F-02) | — |

The critique records P0 and P1 counts only (its snapshot frontmatter). Each cycle used a different lens on fresh captures from its own commit. No cycle re-scored an earlier cycle's screenshots. The audit (native) scale is /20 and the critique scale /40, so the numbers are compared within a lens only.

## Audit Cycle 1 — critique (product structure)

- **Invocation:** Impeccable `critique`, dual-agent (A: design review with `critique.md` + `android.md`; B: detector, `impeccable detect --json ui/` → `[]`, 0 scannable native files, engine verified on a control HTML). Snapshot `2026-09-28T21-45-46Z` written with `critique-storage write`.
- **Input:** CI run 63 (`f43ea2e`), 43 captures (journey 1.0 / 1.3, landscape, slices).
- **Findings and fixes** (fix commits `de48ed7`, `cd60077`, `507d5c7`):

| ID | sev | screen | evidence | fix | files | verification | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1-01 | P1 | 3D | house bbox at x = 0 in default-02/06/08..14; landscape house 3.9 % of the screen | home framed with the free area's aspect (`ContentFrame.fitAspect`), the rail as a right inset, re-home while at home. Two root causes found while verifying: Filament's `setShift` stores twice the value (`mShiftCS = shift × 2`), and the eased inset was read only in a `SideEffect` (no subscription) | `camera/OrbitCamera.kt`, `camera/ContentFrame.kt`, `ui/PreviewViewModel.kt`, `ui/ModelWorkspace.kt`, `ui/Viewport.kt`, `render/FilamentModelRenderer.kt` | run 66: free area t=275 r=211 b=452, 0/0 house pixels at its edges (02, 06, 14; font 1.3; landscape); `ContentFrameTest` | FIXED |
| C1-02 | P1 | 3D landscape | rail and timeline overlap 184 × 148 px; "Dopasuj" 1.17:1 | the bottom stack ends beside the rail below 480 dp of height | `ui/ModelWorkspace.kt` | `AdaptiveLayoutDeviceTest`: Fit ∩ rule/toggle = ∅ (runs 64–66) | FIXED |
| C1-03 | P1 | inspector | English "Ridge axis", "Garage flat roof"; "4.15 m" beside "4,15 m" | `ElementWords`: Polish headline, storey and owner facts, decimal comma, centimetres; export English under "Dane techniczne" | `ui/ElementWords.kt`, `ui/Inspector.kt`, strings | `ElementWordsTest` (7); the journey asserts no export name or English label at 12 | FIXED |
| C1-04 | P2 | timeline, Dom | "Podgląd: Fundam…", "…na ka…", "7 z / 17" | two-row header (title / explanation + action), "Co to znaczy?" under the rule, NBSP | `ui/TimelineRail.kt`, `ui/HouseScreen.kt` | `font-1.3-05/07` | FIXED |
| C1-05 | P2 | Etapy | 7 expand-and-mark rounds for a house at the roof | `markDoneBefore`: one saved edit that shows its count first, never inferred | `progress/ConstructionProgress.kt`, `progress/ProgressSession.kt`, `ui/StagesScreen.kt` | `ConstructionProgressTest` +2; the journey uses "Oznacz 6 wcześniejszych etapów jako zakończone" | FIXED |
| C1-06 | P2 | Dom | three routes to Etapy; "Dodaj dom z linku" co-equal | Etapy button removed (tab + the current-stage row); quiet link | `ui/HouseScreen.kt`, `ui/Chrome.kt` | `default-05` | FIXED |
| C1-07 | P2 | Dom | the record's age never shown | "Zapisano 28 września 2026" | `progress/ProgressSession.kt`, `ui/HouseScreen.kt` | `default-05` | FIXED |
| C1-08 | P3 | Dom, timeline | yellow on buttons, one pill | ink outlines, control radius | `ui/HouseScreen.kt`, `ui/TimelineRail.kt` | captures | FIXED |
| C1-09 | P2 | all | Polish plurals by the device's (English) rules: "6 wcześniejszego etapu" | activity locale pinned to pl-PL | `MainActivity.kt` | run 66 label | FIXED |
| C1-10 | P2 | Dom / 3D | "… (GE) (analysis)" English suffix | the scene takes the house's own title | `scene/DownloadedScenes.kt` (+4 tests) | `slice-*-03/06` | FIXED |
| C1-11 | P2 | analyzer | keyboard over the progress | clear focus and hide on start | `ui/AnalyzerScreen.kt` | `slice-*-01` | FIXED |
| C1-12 | P3 | inspector | export millimetres ("0,448 m") | centimetres | `ui/ElementWords.kt` | `ElementWordsTest` | FIXED |
| C1-D1..D3 | P2 | Dom landscape; analyzer disabled button (2.96:1); analysis line 36 dp | — | moved to cycle 2 (adapt / a11y lens) | — | — | D1 → C2-07; D2 → F-03 (closed at finish); D3 → C3-08 |

- **Verification:** run 64 FAIL (the new framing assertion caught b = 0 → root-cause hunt), 65 FAIL (same), **66 PASS** (journey 1.0 / 1.3, landscape, both slices).
- **Residual:** the OWNER questions C1-O1 (Polish milestones as graduations on the rule) and C1-O2 (the rule on Dom as a rewind gesture).

## Audit Cycle 2 — audit (native) + adapt (native)

- **Invocation:** Impeccable `audit` with `audit.native.md` and `adapt.native.md` (+ `android.md`), a code-and-pixel technical audit. Report: `stage-reports/artifacts/integration-003c/impeccable/cycle2-audit-native-adapt-native.md`. Score **13/20** (Acceptable); platform conformance PASS.
- **Input:** CI run 66 (`507d5c7`).
- **Findings and fixes** (fix commits `8f645b0`, `941cdb9`, `b25ccae`, `0ad5ef3`; new device test `83bb3dc`):

| ID | sev | finding | fix | files | status |
| --- | --- | --- | --- | --- | --- |
| C2-01 | P1 | navigation-bar icons 1.57:1 over Makieta / Kreska | navigation-bar scrims (bottom / end) | `ui/ModelWorkspace.kt` | FIXED (`rc-e-04`) |
| C2-02 | P1 | landscape details sheet fills the window, under the status bar | a 360 dp side panel at the end edge in the safe area; it becomes the frame's right inset; the sheet ≤ 55 % | `ui/ModelWorkspace.kt`, `ui/Inspector.kt` | FIXED (`landscape-04`: panel left > width/2, right inset > width/4) |
| C2-03 | P1 | scene read, hashed and parsed on the main thread; Loading never shown | background load, Loading state, older load cancelled | `ui/PreviewViewModel.kt`, `scene/*` | FIXED |
| C2-04 | P2 | the renderer draws every vsync while idle | — | — | DEFERRED → LATER_POLISH: the 3D gate proves liveness by counting frames; on-demand rendering needs that gate reworked first |
| C2-05 | P2 | IME ignored | safe-drawing content insets, the bar steps aside while typing, `adjustResize` | `ui/AppShell.kt`, manifest | FIXED |
| C2-06 | P2 | display cutout ignored under the Scaffold | `WindowInsets.safeDrawing` | `ui/AppShell.kt` | FIXED |
| C2-07 | P2 | landscape Dom = drawing only; bottom bar at 914 dp | navigation rail (short or wide), two-pane Dom, `Sizes.contentMax` | `ui/AppShell.kt`, `ui/HouseScreen.kt`, `ui/StagesScreen.kt` | FIXED (`landscape-01/05`) |
| C2-08 | P2 | the houses sheet cannot scroll | `verticalScroll` | `ui/HouseScreen.kt` | FIXED |
| C2-09 | P2 | "Wróć do teraz" touches the scrub band | 8 dp gap | `ui/TimelineRail.kt` | FIXED |
| C2-10 | P2 | elements only by touching the model; zoom only by pinch | element list in Warstwy; Przybliż / Oddal in Widok | `ui/ToolRail.kt` | FIXED (`rc-e-05`: element chosen from the list; zoom 33.46 → 26.77 m) |
| C2-11 | P2 | refused edits unseen and unannounced | snackbar | `ui/StagesScreen.kt` | FIXED (`rc-d-02`) |
| C2-12 | P2 | predictive back not declared | `enableOnBackInvokedCallback` | manifest | FIXED |
| C2-13 | P2 | English scene-load errors | typed `SceneLoadProblem`, Polish, technical detail folded | `scene/SceneRepository.kt`, `scene/DownloadedScenes.kt`, `ui/Chrome.kt` | FIXED |
| C2-14 | P3 | a filled icon among outlines | `ShellIcons.chevronUp` | `ui/TimelineRail.kt` | FIXED |
| C2-15 | P3 | double speech (live region + rule; row state) | live region removed; row state = open / closed | `ui/TimelineRail.kt`, `ui/StagesScreen.kt` | FIXED |
| C2-16 | P3 | rule numerals dropped at 40 dp / large font | the rule's height fits its measured numerals | `ui/FoldingRule.kt` | FIXED |
| C2-17 | P3 | layout write-back while the chrome slides | — | — | DEFERRED → LATER_POLISH (no visible defect; the frame follows the eased inset) |

- **Verification** (the new `ReleaseCandidateDeviceTest` journeys C / D / E found real bugs, which were fixed, not waived):
  - run 67 FAIL — with the bar stepping aside while typing, saving the task left the keyboard up and no tab (fixed: saving ends typing); an older "Saved" consumed late wiped a newer refusal (fixed: consume only the outcome shown); test timing in the slice and the roof-off assertion.
  - run 68 FAIL — **the refusal snackbar was cancelled the instant it appeared** (its effect's key changed on consuming; fixed with the screen's scope); a list item off-screen in the pane (test scrolls).
  - run 69 FAIL — test expectation: an unsupported link is refused by the analyzer, not by the field; "Przybliż" moved to the top of Widok.
  - **run 70 PASS** (`0ad5ef3`): journey 1.0 / 1.3, landscape, RC C / D / E (drawn = stated 84 / 45 / 1 / 77 / 117), both slices.
- **Residual:** C2-04, C2-17 (LATER_POLISH, reasons above).

## Audit Cycle 3 — polish + harden (release candidate)

- **Invocation:** Impeccable `polish` + `harden` with `craft-floor.md` and `android.md`, journeys A–E. Report: `stage-reports/artifacts/integration-003c/impeccable/cycle3-polish-harden.md`. Score **15/20** (Good). Verdict: not ready (2 P1).
- **Input:** CI run 70 (`0ad5ef3`): journey 1.0 / 1.3, landscape, RC C / D / E, slices Marcówki and Rarytasy.
- **Journeys:** A (Marcówki) proven; B (Rarytasy) proven, its PARTIAL result not explainable in words (C3-03); C (lifecycle) proven for pause / resume, recreation and restart (not process death); D partly — the unsupported link exposed C3-01 and C3-02, the corrupt record was said only in Etapy (C3-04); E (collisions) proven, drawn = stated.
- **Findings and fixes** (fix commit `af49ee7`):

| ID | sev | finding | fix | files | verification | status |
| --- | --- | --- | --- | --- | --- | --- |
| C3-01 | **P1** | after a local analysis ends the link form stays locked ("Trwa analiza"): `isRunning = local.isBusy \|\| state is …` short-circuits on plain fields and never subscribes to `state` | read `state` first (the runner clears its job before publishing the final state) | `ui/AnalyzerViewModel.kt` | RC-D asserts the field and "Analizuj projekt" enabled after the failure | FIXED |
| C3-02 | **P1** | every local failure blamed on "the drawings", raw code in the sentence, futile retry | local refusals map to the typed `UnsupportedPublisher` / `InvalidUrl` with no retry; sentences by the analyzer's code (page unreachable, refused, no drawings, timeout); the code only under "Szczegóły analizy" | `analyzer/local/LocalAnalysis.kt`, `analyzer/AnalyzerFailure.kt` | `LocalAnalysisTest` +1, `AnalyzerClientTest`; RC-D asserts the typed failure, `RetryAction.NONE` and the sentence on screen | FIXED |
| C3-03 | P2 | Dom's "zobacz, czego analiza nie rozstrzygnęła" leads nowhere durable; items are the analyzer's English | Dom links to the list only while the analyzer's result is this house's; otherwise it says the phone keeps the count, not the list | `ui/HouseScreen.kt` | code + `slice-rarytasy-03` | PARTIAL — persisting the items with the download and Polish wording of the analyzer's vocabulary → NEXT_ANALYZER_STAGE |
| C3-04 | P2 | a set-aside or newer-app record silent on Dom / 3D; the newer schema explained with the wrong reason | one problem sentence on Dom, in the 3D header and in Etapy; the newer-schema body fixed | `ui/StagesScreen.kt`, `ui/HouseScreen.kt`, `ui/TimelineRail.kt` | RC-D asserts the sentence on Dom before Etapy | FIXED |
| C3-05 | P2 | inspector: two heights (2,72 vs 2,53 m), sizes three times | sizes once: the source's own figures when given, else the model's extent; the header carries the storey | `ui/Inspector.kt`, `ui/ElementWords.kt` | `slice-*-11`, `default-12` | FIXED |
| C3-06 | P2 | nothing announced when a four-minute job ends | polite live region on the result, failure and cancelled headings | `ui/AnalyzerScreen.kt` | code (TalkBack not driven on CI) | FIXED (focus move → LATER_POLISH) |
| C3-07 | P2 | a 3.7–4.4 min analysis depends on the app staying in front | screen kept on app-wide while analysing; the note "trwa kilka minut, nie zamykaj aplikacji" | `ui/AppShell.kt`, `ui/AnalyzerScreen.kt` | `slice-*-01` | PARTIAL — a foreground service with a notification → OWNER_REVIEW (it changes how the app runs in the background) |
| C3-08 | P2 | the analysis line on Dom about 36 dp tall | `heightIn(min = 48 dp)` | `ui/HouseScreen.kt` | code | FIXED |
| C3-09 | P3 | two filled primaries beside a result; counts label-first | "Analizuj projekt" outlined beside a result; "2 bryły · 14 otworów · 9 pomieszczeń" | `ui/AnalyzerScreen.kt` | `slice-*-04` | FIXED |
| C3-10 | P3 | "oś budowy", the stage not named in the hidden text, "geometrii 3D", "ścianka działowa" as a material, "0°" and "0 m" facts | "Historia budowy"; the hidden text by its cause, with the stage's name; plain copy; not-a-material; zero pitch / overhang skipped | strings, `ui/Inspector.kt`, `ui/ElementWords.kt`, `ui/ModelWorkspace.kt` | `ElementWordsTest` +1; RC-E asserts "W podglądzie „Fundamenty” ten element jeszcze nie stoi." | FIXED |
| C3-11 | P3 | the inspector's mark always half-filled; no task counter; source URL in the release log | the recorded completion; a counter from 160 / 200; URL stripped outside debug | `ui/Inspector.kt`, `ui/StagesScreen.kt`, `ui/AnalyzerViewModel.kt` | code | FIXED (houses-switch label → LATER_POLISH) |

- **Verification:** **run 71 PASS** (`af49ee7`, `36510537205`): 76 / 76 captures valid. RC-D: `UnsupportedPublisher`, `RetryAction.NONE`, the link field and "Analizuj projekt" enabled again (`rc-d-04`), the corrupt-record sentence on Dom before Etapy. RC-E: "W podglądzie „Fundamenty” ten element jeszcze nie stoi.", drawn = stated 84 / 45 / 1 / 77. The inspector gives one height (`slice-marcowki-11`: 2,72 m). Both slices PASS. The same held in runs 72 and 73.
- **Severity gate:** P0 0; P1 0; P2 deferred only with reasons (C3-03, C3-07, both partly fixed).

## Finish (Impeccable finish reviewer + documenter)

Not a fourth audit cycle: the skill's finish step on the release candidate, after Cycle 3 was verified.

- **Documenter** (`impeccable-documenter`): recorded `apps/android/DESIGN.md` + `.impeccable/design.json` from the shipped code (17 colours, 13 type roles, 8 spacing steps, 4 radii, 22 component entries). It named three pieces of shipped drift, fixed in `89c8ad6`: a stock pill slider in Etapy (now the rule's graduated bar and a marker), card-like stops in the expanded timeline (now flat on the timeline's glass, only the previewed stop marked), and Dom's column cut under the places bar without a fade.
- **Finish reviewer** (`impeccable-finish-reviewer`, on `89c8ad6` + run 71's captures): verdict *fix first*. Fixed in `1169321`:

| ID | sev | finding | fix | status |
| --- | --- | --- | --- | --- |
| F-01 | **P1** | the house framed at about half the free space (walls 54 % of the free width upright, 47 % of the free height on its side): the home pose fitted a bounding sphere with a 1.35 margin | home, "Cały dom" and "Dopasuj" fit the house's projected box to the free rectangle's two spans with a 1.12 margin (1.1 in `1169321`, see the verification below; `OrbitCamera.distanceToFitBox`, `ContentFrame.fitSpan`); `ContentFrameTest` checks every corner inside and the limiting side filled to the margin; the device evidence asserts the walls fill ≥ 55 % of the free area | FIXED (run 73: walls 0.69 of the free width upright, 0.60 of the free height on its side, 0 / 0 house pixels at the edges) |
| F-02 | P2 | the 3D backdrop is darker than the contract's ground (`#07080C` on screen vs `#101419`) | not changed: it is the renderer's MODEL ground (`#12151A`, darkened by tone mapping), unchanged since 003A | OWNER_REVIEW |
| F-03 | P2 | disabled "Analizuj projekt" at 2.96:1 (the cycle-1 note C1-D2, never closed) | disabled InkButton = InkFaint on Raised (≈ 5.6:1); disabled LineButton = InkFaint on a Hairline outline | FIXED |
| F-04 | P2 | the chosen element's bar a second glass panel stacked on the timeline | the row is the top row of the timeline's own glass; the camera's frame is measured from the rule alone, so choosing never moves the house | FIXED (`rc-e-05`) |
| F-05 | P3 | on a phone on its side, Dom's "Otwórz w 3D" below the fold | kept under the scrolling words, outside the scroll | FIXED (`landscape-01`) |
| F-06 | P3 | the new slider's empty range nearly invisible | a 1.2 dp RuleEmpty outline (the rule's "not started") | FIXED (code) |

- **Verification:** run 72 (`40cf940`): UI evidence PASS with a 1.1 margin (walls 0.70 / 0.62), but its **core job failed** on `tests/architecture/presentation.test.ts`, for two reasons. The Dom sketch had been put in the ported `presentation/` package in `4bf3757`; the core job had not run since run 58, because the UI runs were UI-only. And 1.1 is a coordinate of the donor's reference house. Fixed in `6f9da1b`: the sketch moved to `ui/`, and the margin became 1.12, the fit preset's own. The core suite passed locally (1473 tests). **Run 73 (`6f9da1b`) is green on every job.**

## Residual UI/UX debt after 3 cycles

| class | item | reason |
| --- | --- | --- |
| BLOCKING | none | |
| OWNER_REVIEW | analysis as a foreground service with a progress notification (C3-07) | changes background behaviour and asks for a notification permission; the screen now stays on and the owner is told |
| OWNER_REVIEW | Polish milestones as graduations on the rule; the rule on Dom as a rewind gesture; the inspector as a stage card (C1-O1, C1-O2, critique questions) | direction choices, not defects |
| OWNER_REVIEW | visual acceptance of Dom, 3D, Etapy on the owner's phone | technical PASS is not visual acceptance |
| OWNER_REVIEW | the 3D backdrop darker than Dom's ground (F-02); Makieta / Kreska turn the ground light, where the dark glass chrome reads as slabs | a renderer presentation choice kept from 003A; the light modes are opt-in |
| LATER_POLISH | render on demand instead of every vsync while idle (C2-04) | the 3D gate counts frames; needs its own gate rework |
| LATER_POLISH | layout write-back while the chrome slides (C2-17) | no visible defect |
| LATER_POLISH | "Cały dom" names both a layer (everything shown) and a view (the whole-house camera) — a baseline-critique consistency note the cycles did not reopen | P3 wording; each is unambiguous inside its own pane |
| LATER_POLISH | move focus to the failure heading / the 3D title after an analysis (C3-06); a label for the houses switch (C3-11) | announcements already made politely |
| LATER_POLISH | normal-speed motion and TalkBack traversal never exercised on CI (every run at animator scale 0); no tablet; no landscape at font 1.3 | coverage, not a known defect |
| NEXT_ANALYZER_STAGE | keep the unresolved items with the download and say them in Polish (C3-03) | the download record keeps counts only; the items are the analyzer's English vocabulary |
| NEXT_ANALYZER_STAGE | Rarytasy stays PARTIAL (pergola, entrance canopy, second chimney) | analyzer scope; unchanged in 003C by rule |

# P0 — the blank 3D (Workstream A)

## C. Root cause (proven)

**Class: other — a Compose layout fault in the product shell's chrome.** Not the SurfaceView, not the render-surface or swap-chain lifecycle, not the camera, not the scene.

The opaque **tool dock grew over the whole model.**

- In `ui/Controls.kt` (`ToolDock`), the scroll-edge fade was a `Box(Modifier.align(CenterEnd).width(28.dp).fillMaxHeight())` inside a `Box` with no height of its own.
- `ModelWorkspace` lays out a `Column`:
  - the top strip;
  - `Box(Modifier.weight(1f))`;
  - the details panel;
  - the dock.
- A `Column` measures unweighted children first. So as soon as the fade existed (`scroll.canScrollForward`: the dock's buttons overflow the width), `fillMaxHeight()` took all the remaining height. The dock became as tall as the free space, and the weighted spacer got nothing.
- The dock's surface is opaque (`surface` + tonal elevation, luminance ≈ 40). The model underneath was still being drawn and was completely hidden.
- On a phone the dock's six controls ("Widok · Warstwy: Cały dom · Wygląd: Model · Dopasuj · Resetuj · Szczegóły") never fit the width. So **every** entry to 3D was covered, whichever way it was reached. The owner could only reach it through Dom, hence "Dom → 3D".

**Evidence** (CI run 57, job `Android / 3D entry gate (swangle_indirect)`, artifact `model-entry-swangle_indirect`, emulator API 34 x86_64, ANGLE):

| step | render view | frames drawn | swap chains | visible objects / renderables | engines | surface: colours, luminance σ | screen: colours, luminance σ | grid correlation |
| --- | --- | ---: | ---: | --- | ---: | --- | --- | ---: |
| Dom → 3D (first) | SurfaceView | 36 | 1 | 127 / 144 | 1 | 286, 48.2 | **1, 0.0** | 0.00 |
| Dom → 3D (after back) | SurfaceView | 37 | 1 | 127 / 144 | 1 | 282, 48.2 | **1, 0.0** | 0.00 |
| direct 3D | SurfaceView | 42 | 1 | 127 / 144 | 1 | 286, 48.2 | **1, 0.0** | 0.00 |
| Dom → 3D (first) | TextureView | 36 | 1 | 127 / 144 | 1 | 285, 48.2 | **1, 0.0** | 0.00 |

- The surface PNG (PixelCopy / `TextureView.getBitmap`) shows the Marcówki house. The screen PNG shows:
  - the top strip;
  - the dock's buttons directly under it;
  - one flat blue-grey down to the bottom;
  - the dock's 28 dp fade running the full height at the right edge.
- The same covered screen appears with both surfaces and on both paths, which rules out the SurfaceView z-order / hole-punch hypothesis (H1) the code reading had ranked first.
- The run-57 gate passed anyway, because it asked only that the screen be "not the background colour". That assertion was wrong and is replaced (below).

**Why no earlier screenshot caught it:**
- The CI emulator never showed a house. With the default `-gpu swiftshader_indirect` (gfxstream's SwiftShader OpenGL ES 3.0 translator), the emulator process itself goes away right after Filament's first frame. Run 56 went offline 70 s into the test, and every later `adb` call hung until the job's two-hour limit. Runs 57 `swiftshader_indirect` and `guest` (which falls back to the same translator on API 34) went offline after `frame 1` too, with the renderer `ready=true`.
- Run 55's 003A "before" screenshot shows a black viewport, and its 003B "after" screenshots are missing, for the same reason.
- ANGLE (`-gpu swangle_indirect`, OpenGL ES 3.1 on SwiftShader Vulkan) runs Filament without losing the emulator.

## D. Fix

Commit `6e1dcf8`, `ui/Controls.kt`:
- The fade is now **drawn** over the row with `drawWithContent` (a 28 dp horizontal gradient, only while `scroll.canScrollForward`). It takes no part in layout, so the dock is exactly as tall as its buttons.
- Same look, same condition.
- No other file in `ui/` lays out an overlay with `fillMax*` in an unbounded parent. The inspector's bottom fade has a fixed 20 dp height inside a width-bounded panel.

**The render surface stays a `SurfaceView`.**
- After the fix, SurfaceView and TextureView pass the same strict checks on both paths (table below).
- The code reading had ranked "SurfaceView z-order / hole punch after a late attach" first. The evidence does not support it: the same covered screen appeared with both surfaces, and after the fix both show the house.
- So the surface was not switched. Switching would have added GPU composition cost to fix nothing that was proven.
- The TextureView path stays available through a launch extra (`com.buildplan.preview.RENDER_SURFACE`) for comparisons.
- One caution carries over to the redesign: translucent or animated layers over a SurfaceView must be checked on a device (`docs/ANDROID_MODEL_PREVIEW.md`).

`setZOrderOnTop(true)` was not used.

## The 3D gate (hard regression)

`app/src/androidTest/.../ModelEntryDeviceTest.kt` + `tools/run-3d-gate.sh` + CI job **`Android / 3D entry gate`** (`-gpu swangle_indirect`, API 34 x86_64).

**`domThen3dThroughTheNavigationBarDrawsTheHouseAndAgainAfterBack`**
1. Cold start at Dom: no viewport and no engine, asserted.
2. Tap `3D` in the navigation bar (Compose semantics), then wait for the renderer.
3. Assert:
   - swap chain alive, created ≥ 1; resized ≥ 1; viewport > 0; UiHelper ready;
   - model uploaded; renderables > 0 and visible objects > 0; camera finite;
   - ≥ 30 frames drawn after ready; exactly **one** engine.
4. Pixels: the screen over the viewport's middle must carry the surface's picture:
   - ≥ 16 colours;
   - ≥ 40 % of the surface's luminance spread;
   - correlation ≥ 0.5 of their 12 × 12 luminance grids.
5. System **back** (Espresso key event): the viewport is destroyed and there are 0 engines.
6. Tap `3D` again and repeat every assertion.

**`direct3dLaunchDrawsTheHouse`** is the same, launched with the `PLACE=MODEL` extra.

**Runs:**
- **Gating:** the default surface at font scale **1.0** and **1.3**.
- **Evidence:** `SURFACE_VIEW` and `TEXTURE_VIEW` explicitly.
- Logcat is streamed from the first second.
- Every `adb` call runs under a timeout.
- A lost emulator reports `DEVICE_LOST` in minutes, not after the job's limit.

The gate also blocks the OWNER APK: `owner-preview-release` now `needs: [android, android-3d-gate]`.

**Proof that it catches the P0:** replayed on run 57's PNGs (the code before the fix), every step fails: screen 1 colour, σ 0, correlation 0.

**After the fix** (CI run 58, `0a3791b`, artifact `model-entry`, status **PASS**, 4 × `OK (2 tests)`):

| run | step | view | frames | swap chains | visible / renderables | engines | surface colours, σ | screen colours, σ | correlation |
| --- | --- | --- | ---: | ---: | --- | ---: | --- | --- | ---: |
| default, font 1.0 | Dom → 3D | SurfaceView | 36 | 1 | 127 / 144 | 1 | 285, 48.2 | 282, 48.2 | 1.000 |
| default, font 1.0 | back → 3D again | SurfaceView | 34 | 1 | 127 / 144 | 1 | 276, 48.2 | 286, 48.2 | 1.000 |
| default, font 1.0 | direct 3D | SurfaceView | 43 | 1 | 127 / 144 | 1 | 285, 48.2 | 284, 48.2 | 1.000 |
| default, font 1.3 | Dom → 3D | SurfaceView | 36 | 1 | 127 / 144 | 1 | 286, 48.2 | 283, 48.2 | 1.000 |
| default, font 1.3 | back → 3D again | SurfaceView | 36 | 1 | 127 / 144 | 1 | 286, 48.2 | 282, 48.2 | 1.000 |
| default, font 1.3 | direct 3D | SurfaceView | 40 | 1 | 127 / 144 | 1 | 285, 48.2 | 282, 48.2 | 1.000 |
| evidence | Dom → 3D / again / direct | SurfaceView | 36 / 37 / 41 | 1 | 127 / 144 | 1 | 286, 48.2 | 283, 48.2 | 1.000 |
| evidence | Dom → 3D / again / direct | TextureView | 36 / 36 / 41 | 1 | 127 / 144 | 1 | 285, 48.2 | 282, 48.2 | 1.000 |

- The screens show the Marcówki house in the model area, the top strip above it and the dock as one row at the bottom.
- At font 1.3 the subtitle ellipsizes and the dock row scrolls.
- The model in these screens is the built-in example, which is the one Dom opens first. Screens: `stage-reports/artifacts/integration-003c/` (below).

**Final build** (CI run 73, `6f9da1b`, artifact `model-entry`, status **PASS**, 4 × `OK (2 tests)`), with the new chrome and framing:

| run | step | view | frames | swap chains | visible / renderables | engines | surface colours, σ | screen colours, σ | correlation |
| --- | --- | --- | ---: | ---: | --- | ---: | --- | --- | ---: |
| default, font 1.0 | Dom → 3D | SurfaceView | 36 | 1 | 127 / 144 | 1 | 381, 44.3 | 390, 44.2 | 0.986 |
| default, font 1.0 | back → 3D again | SurfaceView | 36 | 1 | 127 / 144 | 1 | 376, 44.3 | 392, 44.2 | 0.986 |
| default, font 1.0 | direct 3D | SurfaceView | 42 | 1 | 127 / 144 | 1 | 376, 44.3 | 376, 44.3 | 0.986 |
| default, font 1.3 | Dom → 3D / again / direct | SurfaceView | 36 / 36 / 44 | 1 | 127 / 144 | 1 | 396–400, 44.1 | 415–427, 54.9 | 0.758 |
| evidence | Dom → 3D | SurfaceView / TextureView | 35 / 35 | 1 | 127 / 144 | 1 | 388, 44.3 | 379–380, 44.2 | 0.986 |

At font 1.3 the taller glass header covers more of the sampled region, so the correlation is 0.758 (the gate asks ≥ 0.5); the house is on screen in every capture.

**Engine lifecycle:** logcat `BuildPlanRender` over the whole run shows `liveEngines=1` for each viewport and `0` after each `canvas destroyed`. Never two.

**Lifecycle, now driven on the device** (this session, `ReleaseCandidateDeviceTest.journeyC`, `AdaptiveLayoutDeviceTest`, the journey and the slices):
- Dom → 3D → back → 3D through the real navigation (journey 14, slices 12);
- pause / resume (`moveToState(CREATED)` → `RESUMED`), activity recreation, rotation to landscape and back;
- the app closed and opened again, with the saved progress read back;
- one live engine at every step, 0 after leaving 3D (run 73: frames at the first, second and recreated entries 21 / 50 / 22).
- Not driven: process death while in 3D, and backgrounding during an analysis.

The 3D gate still runs on every CI run and gates the OWNER APK (`owner-preview-release` `needs: [android, android-3d-gate, android-ui-evidence]`).



# The product workspace

## G. New shell architecture

All in `apps/android/app/src/main/java/com/buildplan/preview/ui/` (Compose + Material 3, one activity).

- **Places** (`ShellState.kt`): Dom, 3D, Etapy, Koszty, Dokumenty. `ShellState` is saved (`rememberSaveable`) and carries where 3D was entered from, so Back returns there.
- **`AppShell.kt`**:
  - 3D is immersive (no bar); every other place sits in a `Scaffold` with `WindowInsets.safeDrawing`.
  - A bottom `PlacesBar` on a phone held upright; a `PlacesRail` (80 dp, start edge, `Role.Tab`) when the window is shorter than 480 dp or at least 600 dp wide.
  - The bar steps aside while the keyboard is up (`WindowInsets.isImeVisible`; `adjustResize`).
  - Binds the progress to the open house, returns the timeline to NOW when leaving 3D, auto-opens a finished phone analysis once, and keeps the screen on while an analysis runs.
- **State owners:** `PreviewViewModel` (scene, viewer, camera, framing), `ProgressViewModel` (the progress session of the open house, the timeline cursor, edit outcomes), `AnalyzerViewModel` (link, job, downloads). No global renderer singleton; one Filament engine per `SurfaceView`, released with the composition.
- **Design system:** `Theme.kt` (`Palette`, `Space`, `Radius`, `Sizes`, `Measure` type), `Glass.kt` (one glass layer; chrome over chrome is opaque), `Motion.kt` (one motion policy), `Chrome.kt` (ink / line / quiet actions, panel header, load problems), `ShellIcons.kt`. Recorded in `apps/android/DESIGN.md` + `.impeccable/design.json`.
- **Locale:** the activity is pinned to pl-PL (`PRODUCT_LOCALE`), so Polish plurals and dates follow Polish rules on any phone.

## H. Dom

`HouseScreen.kt`. One column (≤ 720 dp) on a phone; two panes (drawing | words) on a window at least 600 dp wide and wider than tall.

1. The house's name (≤ 2 lines, ellipsized), the houses switch, and the source in words: "Przykład wbudowany …", "Z analizy linku · model gotowy" or "… gotowy z ograniczeniami" with the count of what the analysis left open.
2. **The house drawn**: an inked axonometric derived from the model (`HouseDrawing.kt`, from `HouseSketch`), not a screenshot of 3D.
3. **Progress** (a problem with the saved record first, when there is one):
   - unset: "Postęp nieustawiony", the empty rule, "Ustaw postęp";
   - recorded: the monumental figure ("43%"), "Postęp wg etapów", "Zakończone etapy: 7 z 17", the rule, "Co to znaczy?"; then one row into Etapy: the stage mark, "Aktualny etap: Dach · 40% etapu", "Teraz robimy: …", "Zapisano 29 września 2026".
4. A running or failed analysis, when there is one (48 dp, into the analyzer).
5. **"Otwórz w 3D"** — the one ink primary; "Dodaj dom z linku" as a quiet link.

## I. 3D workspace

`ModelWorkspace.kt`, `ToolRail.kt`, `TimelineRail.kt`, `Inspector.kt`, `Viewport.kt`.

- **Model first:** the `SurfaceView` fills the screen; the chrome floats on one glass layer: a top strip (back, name), a labelled tool rail on the right, the timeline at the bottom.
- **Framing:** the chrome reports its insets against the root. The projection is scaled and shifted so the image lands in the free area (Filament `setShift` takes half the NDC offset). Home, "Cały dom" and "Dopasuj" fit the house's projected box to the free area's two spans with a 1.12 margin (finish review, F-01). The house re-homes when the free area changes while the camera is at home, never while the owner is orbiting.
- **Tools** (the rail): Wygląd (Model / Makieta / Kreska), Warstwy (Cały dom, Bez dachu, Tylko parter, Tylko poddasze, Przekrój, Tylko zaznaczony, and a folded list of elements to choose without touching the model), Widok (Cały dom, Przybliż / Oddal, elevations, from above, parallel projections, places), Dopasuj. "Szczegóły" comes with the chosen element. Each pane grows from its control; the tools never cover the timeline.
- **Inspector:** a bottom sheet (≤ 55 % of the height, ≤ 460 dp) or, below 480 dp of height, a 360 dp side panel at the end edge. It takes the timeline's place, never stacked on it. Headline and storey in Polish; the stage the element belongs to, with the owner's mark and completion; why it is not drawn, by cause; sizes once; certainty in words; the export data folded.
- **Gestures:** one finger orbits, pinch zooms, two fingers pan, a tap selects. Nothing in the chrome passes drags to the model.
- **Empty stage:** when the chosen stage has nothing standing yet, the model area says so ("Na tym etapie dom jeszcze nie stoi — tylko działka …"; now: "Według Twojego postępu nic z domu jeszcze nie stoi.").

## N. Etapy

`StagesScreen.kt` over `ProgressSession`:

- The 17 stages as a list with the rule's mark, state in words and the stage's share; one stage open at a time (`stateDescription` = open / closed).
- For the stage in progress: the completion ("100% nie zamyka etapu"), "Oznacz jako zakończony", the current task ("Teraz robimy", ≤ 200 characters with a counter from 160), "Cofnij do nierozpoczętych" with a confirmation.
- **"Oznacz N wcześniejszych etapów jako zakończone"**: one saved edit that shows its count before it acts; nothing is inferred.
- Starting a stage while another is in progress is refused and said (snackbar, announced, leaves by itself).
- A corrupt record is set aside and said; a newer app's record is shown and never overwritten; a stage without its own geometry says so.
- The editor writes through the store (atomic, deterministic); Dom, 3D and Etapy read the same session, so they always agree.

## O. Accessibility and motion

- **Targets:** 48 dp for every action measured in cycles 2 and 3, including the rule's stops (drag + the named strip + accessibility actions).
- **State never by colour alone:** every stage mark is doubled by words; `stateDescription` on merged rows (never `contentDescription`, which would erase the children); the progress figure is spoken as a sentence.
- **Announcements:** the refusal snackbar; polite live regions on the end of an analysis (result, failure, cancelled). The rule speaks its own new state as it moves, once (no second live region).
- **Font scale 1.3:** the whole journey captured at 1.3; every `maxLines = 1` has an ellipsis; headers that could clip are two rows.
- **Contrast:** text tokens ≥ 4.5:1 on every surface, glass over the scene included (Ink 15.6, InkMuted 8.5, InkFaint 6.1); navigation-bar scrims over the light presentation modes.
- **Motion:** one `MotionPolicy`: arrivals (emphasised decelerate) slower than departures, both under 250 ms; a dense panel replacing another waits for it to leave. The system's "Remove animations" (animator scale 0) makes every spec a cut; Compose ignores that setting by itself, so the policy reads it. **Proof:** every manifest of the final run records `animatorDurationScale = 0.0` and `reducedMotion = true`, and the captures are taken with no transition in flight.
- **Insets:** safe drawing (cutout, bars, IME), predictive back declared.
- **Not covered on CI:** TalkBack traversal and normal-speed motion (every run at animator scale 0).

# Construction progress (Workstreams C and D)

All in `apps/android/app/src/main/java/com/buildplan/preview/progress/`: pure Kotlin, no Android or Filament import, beside the scene and never inside it.

## J. Progress domain

`ConstructionProgress.kt`

- **`HouseId`** is the canonical model id, read from the bundle (`generatedFrom.modelId`, else `scene.modelId`).
  - The analyzer derives it from the project it read: `m-analysis-<slug>`, where the slug is the publisher's project id, else a hash of the canonical page URL (`packages/analysis-service/src/identity.ts`). It never comes from the job, the clock or the content, so re-analysing the same project with a newer analyzer keeps it.
  - Content hashes, file names, download keys (`analysis-<sha256>`) and run ids are never used; a test holds that for every shipped scene.
  - A bundle without a model id gets no id; its progress would be preview-only.
  - Limitation: the bundled reference `marcowki-ge`, the bundled candidate `m-auto-v3-marcowki` and a phone analysis of the Marcówki link are three model ids today. One logical house across LINK / PROJECT modes needs the merge engine, which does not exist yet.
- **`ConstructionProgressState`**: house id, the ordered stage list, current task, `updatedAtEpochMs`, `schemaVersion` = 1.
- **`ConstructionStageProgress`**: `stageId`, `definitionKey`, `order`, `status` (NOT_STARTED / IN_PROGRESS / DONE), `completion`, `weight`, `note`.
- **Starter list:** the 17 Master Plan stages in order, with stable English keys (`plot_purchase` … `garden`); Polish names are a UI matter. Equal weights, because no validated task or BOQ weights exist.
- **Invariants,** checked on every construction (a loaded file, an edit, a fixture):
  - NOT_STARTED = 0, DONE = 1, IN_PROGRESS in [0, 1];
  - finite positive weights, unique ids, strictly increasing order;
  - at most one stage IN_PROGRESS;
  - a current task only while a stage is in progress.
  - The current stage is not a second field that could disagree: it *is* the stage in progress.
- **Edits** (`startStage`, `setCompletion`, `markDone`, `resetStage`, `setCurrentTask`, `setNote`) are pure and change only the stage they name.
  - Starting a later stage marks nothing done. Marking a stage done touches no other stage: construction is not always linear, and history is never "repaired".
  - Starting a stage while another is in progress is refused (`ANOTHER_STAGE_IN_PROGRESS`); the owner must finish or reset the current one first. That is the conservative rule the brief asks for (§25K).
  - Reaching 100 % does not finish a stage; that is an explicit step.
  - A refused edit returns its reason and leaves the state as it was.

## K. The percentage

`StageProgressMetric.kt`: **Postęp wg etapów** = `sum(weight × completion) / sum(weight)`.

- Displayed as a whole percent, **rounded down**, so 100 % appears only when every stage is done.
- One calculator and one formatter (`"43%"`) for every screen.
- It is not a share of money or of the value of the work: no money, geometry or analyzer confidence feeds it.
- Example (a test): 7 stages done and Dach at 40 % gives (7 + 0.4) / 17 = 43.5 %, shown as **43%**.

## Persistence

`ProgressStore.kt`: one JSON file per house in app-private storage (`buildplan.construction-progress`, schema 1).

- **File name:** a readable part plus a hash of the whole house id; the id is stored inside and checked on read.
- **Atomic:** temp file → `fsync` → rename. Deterministic bytes: fixed field order, stages in order.
- **Recovery:**
  - A record that does not parse, or breaks an invariant, or belongs to another house is moved aside to `*.corrupt-<n>.json` and reported (`Corrupt`), never silently reset.
  - A record from a newer schema is reported (`Unsupported`) and never overwritten; its version is read leniently before the strict decode.
- Offline; no account; nothing leaves the phone.
- **Wired to the product:** `ProgressSession` (one per open house) reads the store, applies every edit through the pure functions and saves atomically; Dom, 3D and Etapy read the same session. Durability is proven by `ProgressStoreTest` and on the device (`journeyC`: the app closed and reopened, percent, stage and task read back; `journeyD`: a corrupt file set aside and said on Dom and in Etapy).
- `markDoneBefore(stage)` (cycle 1): the stages before the given one marked done in **one** saved edit, refused while another stage is in progress; the UI shows its count before it acts.
- `ProgressSummary.savedAtEpochMs`: the record's age, shown on Dom ("Zapisano …").

## L. Timeline / time machine

`ConstructionTimeline.kt`: the cursor and what it shows, apart from any screen.

- **Cursors:**
  - `Now` shows the owner's actual progress, or the whole design with `progressUnset` when nothing is stated.
  - `Stage(key)` is a preview of the house at the end of that stage, in the planned order.
  - `Target` is a preview of the finished design.
- **`TimelineFrame`** carries the construction filter plus what the screen must say: `isPreview` (every cursor but `Now`), `progressUnset`, and `stageWithoutGeometry` ("Na tym etapie model 3D się nie zmienia").
- **Stops:** the 17 stages then the design; `snap(position)` snaps a scrub to a stage, never to a fraction of one.
- The timeline holds no progress and has no way to write any. A test saves a state, runs every cursor over it and compares the file byte for byte; `Now` then gives the same frame as before.
- **Built on it (this session):** `TimelineRail` + `FoldingRule` — the rule of 17 segments and the design, tap or drag to a stop (snapped), accessibility actions, an expandable strip of named stages; the header says "Podgląd: Ściany", the stop's position or "Na tym etapie model 3D się nie zmienia", and "Wróć do teraz". Leaving 3D returns the cursor to NOW. The scrub changes only `ViewerState.construction`: no upload, no camera move (0 uploads, camera unmoved, run 73).

## M. Semantic stage mapping

`StageProjection.kt`: `StageSemanticRules` is a data table, not UI conditionals.

It reads only what every bundle carries: the object `kind`, the exporter's `semanticGroup` of its meshes, and its storey.

| group | kinds / rule | first stands at |
| --- | --- | --- |
| BASE_SLAB | `slab` on the lowest storey whose top is at that storey's floor (± 5 cm), recognised geometrically, never by name | Fundamenty |
| STRUCTURE | `wall`, `opening` (reveals), `wallPanel` (unless all cladding), `linearSolid` of group STRUCTURAL_MEMBER | Ściany |
| SPACES | `room` (spaces exist once their walls do) | Ściany |
| FLOORS_AND_STAIRS | other `slab`s (upper floors, heads), `stair`, `balcony` (unless every surface is a terrace) | Strop |
| ROOF | `roof`, `roofPlane`, `roofOpening`, `chimney`, `linearSolid` of group ROOF_TRIM / ROOF_MAIN / FLAT_ROOF | Dach |
| JOINERY | `window`, `door` (garage doors included), `rooflight` | Stolarka |
| FACADE | `surfaceRegion`, `railing`, cladding `wallPanel`, `linearSolid` of group FACADE_FRAME | Elewacja |
| EXTERIOR_WORKS | `terrace`, `platform`, `stepRun`, a terrace-surfaced `balcony`, `linearSolid` of group PERGOLA_MEMBER | Ogród |
| UNMAPPED | anything else: `assembly`, an unknown kind, a member whose meshes disagree on a role | only in the finished design |

- **Unknown elements** are hidden at every stage and in the actual view, and shown only in `Target`. They are never placed at a stage they might not belong to. Tests: a synthetic `assembly`, an unknown kind and a mixed-role member; the committed `unknown-feature` fixture.
- **Stages without geometry of their own,** in every model this app can show: Zakup działki, Projekt, Formalności, Przygotowanie terenu, Instalacja elektryczna, Hydraulika, Ogrzewanie, Tynki, Wylewki, Wykończenie. The timeline still stops there and says so; nothing is fabricated. Rarytasy (single storey) also has no Strop geometry.
- **Actual view:** exactly the stages the owner marked started or done, whatever their order. If Ściany is done and Dach is in progress while Fundamenty was never marked, the base slab is not claimed as built.
- **Composition** (`ViewerState.construction`): visible = stage ∩ layer mode (roof, storeys) ∩ isolation.
  - Each filter only removes, so the result is deterministic.
  - Isolating something that does not stand yet shows nothing, which is true.
  - The selection survives a scrub, but is not drawn, highlighted or pickable while its object does not stand.
  - Presentation modes (MODEL / CLAY / LINE) never change the set.
  - Feature-edge batches already fall back to per-object groups when a class is split, so no hidden object's edge is drawn. Tested on the reference house for every stage × mode.
- **The model is only read:** a test compares every object's positions and the bundle hash before and after projecting.
- **No house name, URL or fixture constant** in any rule.

**Per-stage object counts** (`StageProjectionEvidenceTest`, env-gated; the Rarytasy bundle is the 003B after-model `8fa4a25b…`, model id `m-analysis-m84f2903cb8e14`, from the 003B work, not committed):

| house | objects | Fund. | Ściany | Strop | Dach | Stolarka | Elewacja | Ogród | unplaced |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rarytasy (analysis, 003B after) | 81 | 2 | 51 | 51 | 55 | 75 | 79 | 81 | 0 |
| Marcówki auto v3 | 119 | 2 | 75 | 79 | 88 | 112 | 117 | 119 | 0 |
| Marcówki reference | 127 | 1 | 77 | 82 | 91 | 117 | 125 | 127 | 0 |

(cumulative: objects standing at the end of each stage)



# P. BEFORE / AFTER evidence

**BEFORE:** run 58 captures of the UI at `30135c6` in `stage-reports/artifacts/integration-003c/after-run58/` (Dom, 3D from Dom, 3D at font 1.3), judged in the baseline critique (*F*); the P0's own before/after in `before-run57/` and `after-run58/`.

**AFTER — the final evidence set (§25AA), all from `6f9da1b`, CI run 73 (`36515580578`), artifact `ui-evidence`, validated by `tools/validate-ui-evidence.mjs` (every PNG decoded, CRCs checked, size = the screen) — 76 of 76 captures valid, 0 failed:**

| required | capture | what it shows (facts from the manifests) |
| --- | --- | --- |
| Marcówki Dom | `slice-marcowki-03-dom-result` | the analysed house on Dom (`m-analysis-m2fa281446a8ca`): "Z analizy linku · gotowy z ograniczeniami", 2 unresolved, 4 warnings |
| Marcówki analyzer result | `slice-marcowki-04-analyzer-result` | "Model gotowy z ograniczeniami", counts in Polish plurals, analysis 193.8 s on the emulator; "Analizuj projekt" outlined beside the result |
| Marcówki 3D current | `slice-marcowki-06-3d-now` | NOW = stages 1–7 done + Dach 50 %: **44 %**, 88 objects standing |
| Marcówki walls-history | `slice-marcowki-07-3d-history-walls` | Ściany: 75 objects standing |
| Marcówki roof-history = pre-joinery | `slice-marcowki-08-3d-history-pre-joinery` | the end of Dach is the state before Stolarka: one semantic state, one capture. 88 objects (Strop and the roof on the walls). The bundled Marcówki journey also has its own `default-09-3d-history-roof`. |
| Marcówki inspector | `slice-marcowki-11-3d-inspector` | "Ściana wewnętrzna · Parter", Etap budowy: Ściany (6), zbudowane; sizes once (height 2,72 m) |
| Marcówki Etapy current | `slice-marcowki-05-etapy-current` | stages 1–7 done, Dach at 50 % |
| Rarytasy Dom | `slice-rarytasy-03-dom-result` | `m-analysis-m84f2903cb8e14` on Dom: "gotowy z ograniczeniami", 10 unresolved, 5 warnings |
| Rarytasy analyzer PARTIAL | `slice-rarytasy-04-analyzer-result` | **PARTIAL said:** "Model gotowy z ograniczeniami" · "2 bryły · 14 otworów · 9 pomieszczeń" · "10 elementów nierozstrzygniętych · 5 ostrzeżeń", and the sentence that the model shows only what was read |
| Rarytasy 3D current | `slice-rarytasy-06-3d-now` | 44 %, 55 objects standing (81 in the design) |
| Rarytasy history | `slice-rarytasy-07-3d-history-walls` | Ściany: 51 objects; Dach 55; Stolarka 75 |
| Rarytasy Etapy | `slice-rarytasy-05-etapy-current` | stages 1–7 done, Dach at 50 % |
| progress unset | `default-01-dom-unset`, `default-02-dom-to-3d-unset`, `default-03-etapy-unset` | "Postęp nieustawiony" with the empty rule and "Ustaw postęp"; the 3D shows the whole design; Etapy explains how to start |
| font 1.3 Dom / 3D / Etapy | `font-1.3-05-dom-progress`, `font-1.3-06-3d-now`, `font-1.3-04-etapy-current-editing` | the same journey at font scale 1.3 (`fontScale` in the manifest) |
| reduced-motion proof | every manifest | `animatorDurationScale = 0.0`, `reducedMotion = true` (the app's `MotionPolicy` read the system setting) |
| Dom → 3D → back → 3D | `default-02`, `default-14-3d-second-entry`, `slice-*-12-3d-again`, `rc-c-01-3d-after-resume` | the 3D gate (one engine in 3D, 0 after leaving, both paths); the second entry framed as the first (0 / 0 edge pixels, walls 0.69); after pause / resume, frames 21 / 50 / 22 |

**Semantic difference, not blind pass:** consecutive history captures are compared pixel-wise; the scrub assertions also compare the drawn object count with the projection's count at every stop.
- Journey (the built-in Marcówki), mean |Δ| luminance between consecutive captures: Fundamenty → Ściany 28.9, Ściany → Dach 13.7, Dach → Stolarka 2.0 (windows and doors are small), and NOW vs back-to-now 0.43 (the same state, as it should be).
- Slices: Ściany → pre-joinery 7.59 / 4.38, pre-joinery → Stolarka 0.92 / 1.44 (Marcówki / Rarytasy). The drawn object counts 75 → 88 → 112 and 51 → 55 → 75 are asserted equal to the projection's.

Beyond the required set, the same run holds landscape (`landscape-01..05`), the lifecycle (`rc-c-*`), the unhappy paths (`rc-d-*`) and the collisions (`rc-e-*`).

A selection of the final captures (the set above, plus landscape Dom and the details panel) is committed in `stage-reports/artifacts/integration-003c/final/` at half resolution with the run's manifests and `validation-run73.json`; the full-resolution set stays in the run's artifact (30 days).

# Q. Marcówki / Rarytasy regression

**No analyzer, reconstruction, compiler, mobile-scene or bundle file changed in this stage** (`git diff 2d8ee75..6f9da1b --stat` touches the Android app, its tests and tools, CI, the vendored Impeccable skill and docs only). The analyzer failure mapping in C3-02 is on the app's side (`apps/android/.../analyzer/`), not in the analyzer.

- **Through the product UI** (run 73, `VerticalSliceDeviceTest`, the phone's embedded analyzer on the emulator): link typed into the analyzer screen → analysis → the house opens in 3D → Dom → analyzer result → Etapy (stages 1–7 done, Dach 50 %) → 3D now → history at Ściany, Dach, Stolarka → CLAY at Ściany → inspector → Dom → 3D again.
  - Marcówki: PASS in 193.8 s. modelHash `6152770f…`, scene `8c7d4395…`: the same in runs 66, 70, 71 and 73. 119 objects, 0 unplaced; introduced at Ściany / Dach / Stolarka 73 / 9 / 24
  - Rarytasy: PASS in 226.8 s. modelHash `8fa4a25b…` (the 003B after-model), scene `d4e7249b…`: unchanged. 81 objects, 0 unplaced; 49 / 4 / 20; 10 unresolved, 5 warnings — **PARTIAL**, said as "Model gotowy z ograniczeniami" with the count of unresolved items; unchanged analyzer scope (pergola, entrance canopy, second chimney).
- **Generic, not house-specific:** the slice asserts through `StageProjection.introducedAt(…)` and the viewer's visible set; there is no `if (house == …)` or URL check in UI, progress or projection code.
- **Full CI (run 73), all green:** the core job (1473 tests: analysis service, reconstruction, Marcówki audits, architecture), the second-house job (Rarytasy live URL + offline replay), the local analyzer on the emulator, Node 18 parity, the analyzer container, architecture / assemblies and the browser.

# R. Test / CI matrix

**Local** (this container: JDK 21, no GPU, no KVM):

| gate | result |
| --- | --- |
| `./gradlew testDebugUnitTest` | **401 tests, 0 failures**, 2 skipped (env-gated evidence writers) |
| `./gradlew lintDebug` | pass (no new issue categories) |
| `./gradlew assembleDebug`, `compileDebugAndroidTestKotlin` | pass |

**Device (CI, emulator API 34 x86_64, Pixel 6 profile, `-gpu swangle_indirect`):**

| suite | what | final run |
| --- | --- | --- |
| `ModelEntryDeviceTest` (3D gate) | Dom → 3D → back → 3D and direct 3D, pixels vs surface, fonts 1.0 / 1.3 | 4 × `OK (2 tests)` (default 1.0, 1.3, SurfaceView, TextureView) |
| `ProductFlowDeviceTest` (journey) | the owner's journey, 18 captures, at font 1.0 and 1.3 | `OK (1 test)` at 1.0 and at 1.3 |
| `AdaptiveLayoutDeviceTest` | landscape: Dom, 3D, history, details panel, Etapy; rotation both ways | `OK (1 test)` |
| `ReleaseCandidateDeviceTest` | journeys C (lifecycle), D (unhappy paths), E (collisions) | `OK (3 tests)` |
| `VerticalSliceDeviceTest` | Marcówki and Rarytasy analysed through the app | `OK (1 test)` × 2 |

**CI runs of this session** (`buildapp-ci.yml`, `workflow_dispatch`):

| run | commit | scope | result |
| --- | --- | --- | --- |
| 59–62 | `70e4385`, `e2a1899`, `d7d17c0`, `3589135` | UI evidence (gate bring-up) | FAIL: harness fixes (screenshot fallback, frame-commit wait, late frames) |
| 63 | `f43ea2e` | UI evidence | PASS — Cycle 1 input |
| 64, 65 | `de48ed7`, `cd60077` | UI evidence | FAIL (the new framing assertion; root causes found) |
| 66 | `507d5c7` | UI evidence | PASS — Cycle 1 verified, Cycle 2 input |
| 67–69 | `8f645b0`, `941cdb9`, `b25ccae` | UI evidence | FAIL (real bugs found by the RC journeys, fixed) |
| 70 | `0ad5ef3` | UI evidence | PASS — Cycle 2 verified, Cycle 3 input |
| 71 | `af49ee7` | UI evidence | PASS — Cycle 3 verification |
| 72 | `40cf940` | full, `owner_apk=true` | UI evidence, 3D gate, APK green; **core FAIL** (architecture test, fixed in `6f9da1b`) |
| **73** | **`6f9da1b`** | **full, `owner_apk=true`** | **green, every job (preview-latest skipped by design; "Analyzer API / deploy" a no-op: no deployment configured)** |

# S. Performance

Emulator (software GPU, ANGLE on SwiftShader) — relative numbers, not the owner's phone.

| measure | value | source |
| --- | ---: | --- |
| first Dom → 3D, frames by the time it is asserted | 24 (font 1.0) / 26 (1.3); the 3D gate 35–44 | journey manifest |
| scrub: tap → construction filter applied | 92–158 ms (font 1.0), 90–519 ms (1.3) | journey manifest (Ściany / Dach / Stolarka) |
| scrub: tap → frame drawn | 0.94–1.48 s (1.0), 1.9–2.1 s (1.3) | journey manifest |
| model uploads during scrubbing | 0 | journey manifest |
| camera moved by scrubbing | no | journey manifest |
| live engines: in 3D / after leaving | 1 / 0 | RC C, 3D gate |
| Marcówki analysis on the emulator | 193.8 s | slice manifest |
| Rarytasy analysis on the emulator | 226.8 s | slice manifest |
| projection build / scrub step (JVM) | 0.16–0.39 ms / 0.10 ms | `StageProjectionEvidenceTest` |

The scrub changes only `ViewerState.construction`; the renderer adds and removes existing entities. The frame-drawn times are dominated by the software GPU. The renderer still draws every vsync while idle (C2-04, LATER_POLISH).

# T. Commits

First session (the P0 and the progress foundation):

| commit | purpose |
| --- | --- |
| `812eeec` | diag(android): renderer lifecycle counters and a Dom→3D device gate |
| `b247752` | feat(progress): add construction progress state |
| `97541fe` | feat(3d): semantic stage projection and the timeline cursor |
| `662fa9c` | test(android): the 3D gate as its own bounded job |
| `6e1dcf8` | **fix(android): restore 3d after product-shell navigation** |
| `0a3791b` | test(android): the 3D gate compares pictures, runs on ANGLE, gates the owner APK |
| `db6fdbe`, `472a03c`, `f85e5d8` | docs (first-session report) |
| `30135c6` | chore: vendor the Impeccable skill (the resume point) |

This session:

| commit | purpose |
| --- | --- |
| `4bf3757` | feat(progress): progress session, derived house sketch, Impeccable product context |
| `80b9887` | **feat(ui): rebuild the immersive BuildPlan workspace — The Folding Rule** |
| `70e4385` | test(android): the UI evidence gate — the owner's journey and both reference projects |
| `e2a1899`, `d7d17c0`, `3589135`, `f43ea2e`, `3d2dd50` | test / fix: evidence harness bring-up, Dom drawing, slice captures |
| `de48ed7`, `cd60077`, `507d5c7` | **Cycle 1 fixes** (critique) |
| `83bb3dc` | test(android): release-candidate journeys C, D, E |
| `8f645b0`, `941cdb9`, `b25ccae`, `0ad5ef3` | **Cycle 2 fixes** (audit + adapt) and the bugs the RC journeys found |
| `af49ee7` | **Cycle 3 fixes** (polish + harden) |
| `89c8ad6`, `1169321`, `40cf940` | **finish**: documenter drift, finish-review fixes, DESIGN.md |
| `6f9da1b` | fix: the presentation package kept to the ported files; box margin 1.12 (**the final build**) |
| (this commit) | docs: 003C report, status, final evidence |

The analyzer is untouched, so no analyzer change is mixed into UI commits. No APK or AAB is committed.

# U. OWNER direct APK

**`https://github.com/damiankrok/BuildApp/releases/download/owner-preview-latest/BuildPlan-owner-preview.apk`**

- **Run 73** (`36515580578`), `workflow_dispatch`, from `integration/immersive-progress-v1` @ **`6f9da1ba281d04b3d298a31ec9898385947c7748`**. Later commits are documentation only.
- versionCode **1073**, versionName `0.73.0-preview`, applicationId `com.buildplan.preview`, target SDK 35.
- **30 618 139 bytes**, SHA-256 `12f8920dc7e409f3579dc2868cc54ba8f7ecf7087c9c172c79761167ca965b47`.
- Verified from this container after the run:
  - `GET` → 200, `Content-Type: application/vnd.android.package-archive`, 30 618 139 bytes;
  - `aapt2 dump badging`: `native-code: 'arm64-v8a'` only (5 libraries, all under `lib/arm64-v8a/`);
  - `apksigner`: signer SHA-256 `6e48fac4…` (the preview key, so it installs over earlier test builds);
  - the downloaded bytes hash to the SHA-256 in the release notes, and the notes name run 73 and the commit.
- Published only after `android`, `android-3d-gate` and `android-ui-evidence` passed (`needs:`); the job itself re-downloaded the link and compared it byte for byte.

# V. Limitations

- **Visual acceptance is the OWNER's.** The emulator proves structure, framing, text and state; it is not the owner's phone or GPU.
- **Koszty and Dokumenty** are honest empty places; costs and documents were not started (by rule).
- **Rarytasy stays PARTIAL** (analyzer scope, unchanged by rule). Dom says so; the list of unresolved items is shown only right after the analysis and in the analyzer's English (C3-03, NEXT_ANALYZER_STAGE).
- **Analysis in the background** is not a foreground service: the screen stays on and the owner is told to keep the app open (C3-07, OWNER_REVIEW).
- **One logical house across modes:** the house id is the canonical model id; the bundled reference, the bundled candidate and a phone analysis of the same project are three houses until a LINK / PROJECT merge exists.
- **Stages without geometry** (MEP, plaster, screed, finishing, formalities) show the same shell and say so; nothing is invented.
- **Not driven on CI:** TalkBack traversal, normal-speed motion, process death, a tablet, landscape at font 1.3.
- **Idle rendering** every vsync (C2-04).

# W. OWNER test checklist

1. Install the APK from *U* (it updates the earlier test build).
2. **Dom** (the built-in Marcówki): the house drawn in ink, "Postęp nieustawiony", the empty rule, "Ustaw postęp".
3. Tap **Ustaw postęp** → Etapy. Open *Dach*, "Ustaw jako aktualny", then "Oznacz 6 wcześniejszych etapów jako zakończone" (check the count before it acts), set the completion, type what is being done now, "Zapisz".
4. Back on **Dom**: one figure (e.g. "43%"), the rule filled to Dach, "Aktualny etap: Dach", "Teraz robimy: …", "Zapisano …". Does the figure read as "by stages, not money"? Tap "Co to znaczy?".
5. **3D**: the whole house visible between the chrome, not under it; one finger orbits, pinch zooms, two fingers pan.
6. On the rule tap **Ściany**, then **Dach**, **Stolarka**: "Podgląd: …" at the top, the house changing by stage, the camera not moving; "Wróć do teraz" returns.
7. At NOW tap a wall: its row appears on the timeline with "Szczegóły". Tap *Fundamenty* on the rule, then "Szczegóły": it says the wall does not stand yet in the "Fundamenty" preview, and shows its stage and your mark.
8. Warstwy → Bez dachu while previewing Dach: the roof goes, chimneys stay; Wygląd → Makieta / Kreska keep the stage.
9. Turn the phone: the rule, the tools and Szczegóły move to the sides, nothing overlaps; turn back.
10. Home and back; close from recents and reopen: the progress and the house are still there.
11. **Dodaj dom z linku** → paste the Marcówki link → "Analizuj projekt": the screen stays on; a few minutes later the house opens in 3D by itself. Paste `https://example.com/dom`: "Tego linku nie da się przeanalizować" with the reason, no "Spróbuj ponownie", and the field usable again.
12. Set the system font to your largest size and repeat 4–6.

# OWNER questions

1. **The house's size in 3D:** after the finish fix the whole house fills about 70 % of the free width on an upright phone. Is that right at first sight, or should it start closer (cropping the plot grid)?
2. **The 3D backdrop** is darker on screen (`#07080C`) than Dom's graphite (`#101419`), so the glass chrome reads a little lighter over it. Keep the darker night backdrop, or match Dom?
3. **"Postęp wg etapów"** weights the 17 stages equally (Zakup działki counts as much as Ściany). Is that honest enough, or should the stages carry weights you set?
4. **Milestones on the rule:** should the Polish milestones ("stan surowy otwarty", "stan surowy zamknięty", "stan deweloperski") appear as graduations on the folding rule?
5. **The rule on Dom:** keep it a figure to read, or let dragging it open 3D at that stage (a rewind gesture)?
6. **The inspector:** keep element facts with the stage line on top, or turn it into a stage card (what the element's stage involves, its status and the current task)?
7. **Analysis in the background:** it takes 3–4 minutes and now keeps the screen on. Should it run as a foreground service with a notification, so you can leave the app (Android will ask for the notification permission)?
8. **Makieta / Kreska** turn the scene light, where the dark glass chrome reads as dark slabs. Acceptable for study modes, or should the chrome lighten with them?
9. **Rarytasy "z ograniczeniami":** Dom says "10 elementów nierozstrzygniętych". Is the count enough, or should the list be kept with the house and said in Polish (next analyzer stage)?
10. **"Cały dom"** names both a layer (everything shown) and a view (the whole-house camera). Rename the layer (for example "Wszystko"), or keep it?

# X. Next step

Return to the coordinator with this report and the OWNER questions. The OWNER installs the APK and answers the visual questions; nothing is merged and costs / documents are not started.

**PASS_BUILDPLAN_INTEGRATION_003C_IMMERSIVE_PROGRESS_VERTICAL_SLICE_READY_FOR_OWNER**
