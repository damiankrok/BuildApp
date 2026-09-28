---
target: BuildPlan Android product workspace (Cycle 1, AFTER redesign)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/BuildApp/apps/android/app/src/main/java/com/buildplan/preview/ui"
timestamp: 2026-09-28T21-45-46Z
slug: app-src-main-java-com-buildplan-preview-ui
---
Method: dual-agent (A: design-review sub-agent · B: detector sub-agent)

# Critique — Cycle 1 (AFTER redesign, INTEGRATION-003C), commit f43ea2e, device evidence CI run 63

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | "43% · Dach" + "Aktualnie:" kept in preview; record age (updatedAtEpochMs) never shown |
| 2 | Match System / Real World | 2 | inspector prints exporter English (Type/Footprint/Ridge axis/"Garage flat roof") |
| 3 | User Control and Freedom | 3 | "Wróć do teraz", Back chain, reset confirm; landscape blocks Dopasuj |
| 4 | Consistency and Standards | 2 | yellow on buttons; one pill; "4.15 m" beside "4,15 m"; no nav rail in landscape |
| 5 | Error Prevention | 3 | single current stage, confirm reset, "100% nie zamyka etapu" |
| 6 | Recognition Rather Than Recall | 3 | labelled rail/tabs; collapsed rule numbered only |
| 7 | Flexibility and Efficiency | 2 | no bulk "earlier stages done"; three routes to Etapy on Dom |
| 8 | Aesthetic and Minimalist Design | 3 | restrained; Dom button cluster + inspector wall add noise |
| 9 | Error Recovery | 2 | disabled "Analizuj projekt" without reason (2.96:1) |
| 10 | Help and Documentation | 3 | "Co to znaczy?", unset guidance, gesture hint |
| Total | | 26/40 | Acceptable (top of band) |

Design specificity: authored — the folding-rule grammar (solid done / part-filled current / outline not started / hollow tag preview) repeats on Dom, 3D, Etapy and is always doubled by words; Dom leads with the inked axonometric and one monumental figure. Stock leaks: pill "Wróć do teraz", near-white filled "Otwórz w 3D", card strip, English inspector table.
Detector: `impeccable detect --json ui/` → [] exit 0; 0 scannable files (native Kotlin, 22 .kt / 5 414 lines); engine verified on a control HTML (#999 on #fff → low-contrast). Browser overlay skipped: native Android, no DOM. Deterministic native checks: 0 hex colours outside Theme.kt; 0 `!!`/`@Suppress`/empty catch; all text tokens ≥ 4.5:1 on every surface (Ink 15.6, InkMuted 8.5, InkFaint 6.1 on glass over scene); 1 sub-48dp target (HouseScreen analysis-running line, 36dp); 1 maxLines=1 without ellipsis (TimelineRail:167); inspector shows exporter English labels and "4.15 m" beside "4,15 m"; disabled "Analizuj projekt" 2.96:1; FoldingRule numerals never drawn at 40dp static height.

Priority issues:
1. [P1] 3D crops the house — portrait house bbox touches x=0 in default-06/08/09/10/11/13/14, font-1.3-06; landscape house 3.9 % of screen. OrbitCamera.home() frames with aspect 1.0; ContentInsets.right (tool rail) never reported. Fix: aspect-aware home, rail as right inset, landscape scale. /impeccable layout
2. [P1] Landscape chrome collides — tool rail (x 2066–2249) and timeline card overlap ~184×148 px; "Dopasuj" covered (1.17:1 through glass) and untappable; Dom landscape shows only the drawing; bottom bar at ~914 dp. Fix: rail ends above timeline / timeline ends before rail; two-pane Dom; navigation rail ≥ 600 dp. /impeccable adapt
3. [P1] Inspector leaks English engineering metadata (Inspector.kt:77,93–94,101) and mixes decimal separators; 460dp sheet covers the tapped element. Fix: Polish mapping, unmapped keys under "Dane techniczne", one number format, lead line "Dach garażu · Parter · …", frame selection above the sheet. /impeccable clarify
4. [P2] Font 1.3 clips/wraps primary labels — "Podgląd: Fundam…" (TimelineRail:187–192), "…na ka…" (:164), Dom "7 z / 17" wraps already at 1.0 (HouseScreen:258–274), "Dodaj dom z linku" wraps inside its button (HouseScreen:122). Fix: preview name full-width line, "Co to znaczy?" under the rule, one quiet link instead of the two-button row. /impeccable typeset
5. [P2] First-time setup is a chore — 7 expand-and-mark rounds for a house at the roof stage (StagesScreen:337–341). Fix: explicit "Oznacz etapy 1–7 jako zakończone (7)" showing the count before it acts. /impeccable onboard

Persona red flags: Pan Marek (owner on site) — gable cut off; tapping a roof gives English data and hides the roof under the sheet; no "zapisano …" so an old "Teraz robimy" reads as today; "Dodaj dom z linku" co-equal on every visit. Jordan — 7 manual marks; "Ridge axis X"; 43 % and 40 % in the same face, 40 % without a noun. Casey — ~20 dp rule stops (drag + strip compensate); tags small in sunlight. Sam — 1.3 clipping; Dopasuj covered in landscape; positives: state never colour-only, rule fully operable by accessibility actions.

Minor: yellow outside measured progress ("Ustaw postęp" border, "Wróć do teraz" pill, selected strip card); the only pill; near-white "Otwórz w 3D" outshouts 43 %; "Dane techniczne" indented by TextButton padding; Etapy scrolls under the status bar without a scrim; disabled "Analizuj projekt" gives no reason; three routes to Etapy on Dom.

Questions: Should Dom's rule be draggable to rewind the ink drawing? Should the rule's major graduations be Polish milestones (stan zero / SSO / SSZ / deweloperski) instead of 1/5/10/15? Should the inspector answer "which stage is this and is it done" first, with the engineering table under "Dane techniczne"?
