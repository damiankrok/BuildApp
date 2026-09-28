---
target: BuildPlan Android product shell (BEFORE, PASS 0)
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/home/user/BuildApp/apps/android/app/src/main/java/com/buildplan/preview/ui"
timestamp: 2026-09-28T19-44-31Z
slug: app-src-main-java-com-buildplan-preview-ui
---
Method: dual-agent (A: design-review sub-agent · B: detector sub-agent)

# Critique — BEFORE (PASS 0 baseline, INTEGRATION-003C), commit 30135c6 UI

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | build status (% / stage / Teraz) absent; status-bar icons ~1.1:1 |
| 2 | Match System / Real World | 2 | analyzer English engineering copy; jargon in Polish |
| 3 | User Control and Freedom | 3 | back chain sound; 3D hides nav |
| 4 | Consistency and Standards | 2 | "Cały dom" in two menus; M3 lavender leak #4A4458 |
| 5 | Error Prevention | 3 | link validation, locked mode, delete confirm |
| 6 | Recognition Rather Than Recall | 2 | 4–5 of 6–7 dock tools off-screen; gestures unexplained |
| 7 | Flexibility and Efficiency | 2 | accelerators exist but hidden |
| 8 | Aesthetic and Minimalist Design | 2 | Dom card stack, two equal primaries; opaque bars around 3D |
| 9 | Error Recovery | 2 | Dom failure line has no reason/retry; analyzer card partly English |
| 10 | Help and Documentation | 1 | no gesture hints, no first-run guidance |
| Total | | 21/40 | Acceptable (bottom of band) |

Design specificity: category-interchangeable (stock M3 card column; generic viewer). Detector: 0 findings — nothing scannable in Compose (.kt/.xml skipped by directory walk; CSS/JSX rules cannot match), no browser overlay (native).

Priority issues:
1. [P0] Construction progress absent (no %, stage, Teraz, timeline, Wróć do teraz; Etapy is a poster). Fix: status line + bottom stage timeline + preview captions + real Etapy. /impeccable shape → layout
2. [P1] Dom is a card-stack dashboard with no house. Fix: house hero + progress; switcher sheet; one primary. /impeccable distill → layout
3. [P1] 3D framed by stacked opaque rectangles (19.4 % chrome; 2 of 6 tools visible at 1.0, 1 at 1.3; first frame crops house). Fix: floating minimal chrome, grouped labelled tools, inspector as sheet. /impeccable layout → adapt
4. [P1] Analyzer is a half-English debug console (127 literals; English TalkBack). Fix: link first, diagnostics collapsed, Polish, ready/with-limitations result. /impeccable clarify → distill → harden
5. [P2] Three dead-end places; nav vanishes in 3D. Fix: quiet honest states; Etapy real. /impeccable layout → onboard

Persona red flags: Jordan — disclaimer-first Dom, no gesture hint, 13-item Widok, wrench→"Jeszcze niedostępne". Casey — no glanceable state, exit top-left only, horizontal dock scroll beside orbit, unreadable status bar. Sam — no non-touch selection, English TalkBack strings, "Doku…" truncated at 1.0.

Minor: theme leaves secondaryContainer/surfaceContainer* undefined; 3D clear #07080C vs window #12151A; millimetre precision on a poglądowy model; "Pewność 87%" will compete with progress %; HouseScreen.kt:178 maxLines=1 without ellipsis.
