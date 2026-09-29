# 003C — Audit Cycle 3: Impeccable `polish` + `harden` (release candidate, journeys A–E)

Input: CI run 70 UI evidence (commit `0ad5ef3`), 2026-09-29. Produced by an Impeccable audit sub-agent reading `.claude/skills/impeccable/reference/polish.md`, `harden.md`, `craft-floor.md` and `android.md` against the captures and the code. Recorded verbatim (indentation removed); fixes and verification are in the stage report, *Audit Cycle 3*.

1. VERDICT
Not ready for owner acceptance. No P0, but there are 2 P1s, and both sit on Journey D's unsupported-link path. After a failed local analysis the link form stays locked with the text "Trwa analiza". The failure is also explained with the wrong cause and offers a retry that cannot succeed. The 3D, timeline, Etapy and lifecycle paths hold up well, and the cycle 1 and 2 fixes largely held.
Score (audit.native): Accessibility 3 · Performance 3 (idle vsync rendering, C2-04, is still deferred) · Appearance & Theming 3 · Platform Conformance 3 · Adaptivity 3 = **15/20, Good** (cycle 2 was 13/20).

2. FINDINGS

C3-01 [P1] The analyzer form stays locked after a local analysis ends · AnalyzerScreen.kt:264/275/278 (LinkForm); AnalyzerViewModel.kt:187-188; LocalAnalysis.kt:84
Evidence: rc-d-04 shows the failure card next to a disabled field, a disabled "Analizuj projekt" and "Trwa analiza — kolejny link możesz dodać po jej zakończeniu". At that same moment the test asserts `analyzer.isRunning == false` (ReleaseCandidateDeviceTest, journey D).
Cause: `isRunning = local.isBusy || state is …`. `isBusy` reads plain vars, not snapshot state. While the job runs the check short-circuits, so LinkForm never subscribes to `state`. With Kotlin 2.0.21 strong skipping, nothing recomposes LinkForm afterwards. This also happens after Cancel. "Zamknij" only clears the job section, which leaves the locked form and nothing else on screen.
Impact: the owner cannot correct a wrong link. The only way out is to leave the screen and come back. A fix from cycle 1 (C1-D2) now says the opposite of the truth.
Fix: back the busy flag with snapshot state (for example a `mutableStateOf` set in `publishLocal`), or read `state` before `local.isBusy`. Add a device assertion that the field is enabled after Failed, Cancelled and Zamknij.
Command: /impeccable harden

C3-02 [P1] Every local failure is blamed on "the drawings", and every one offers "Spróbuj ponownie" · AnalyzerFailure.kt:101-102, 127; LocalAnalysis.kt:207, 257; AnalyzerClient.kt:77-91
Evidence: rc-d-04 shows "Analiza zatrzymała się (UNSUPPORTED_PUBLISHER): z rysunków tego projektu nie udało się zbudować modelu." for example.com. The manifest records `JobFailed(code=UNSUPPORTED_PUBLISHER …)`. The service path handles the same case correctly ("Tego linku nie da się przeanalizować", RetryAction.NONE, AnalysisTracker.kt:224-227). Local mode is the default on the phone.
Impact: the stated cause is false, a raw English code sits in the main sentence, and the retry is futile. Losing the network during "Pobieram stronę…" would get the same sentence (code path only, not captured).
Fix: map local codes such as UNSUPPORTED_PUBLISHER, INVALID_URL and acquisition/network failures to the existing typed failures, with the correct retry. Pre-check the ARCHON host in ProjectLinks so the field says it inline. Show codes only under "Szczegóły analizy".
Command: /impeccable clarify + harden

C3-03 [P2] Dom's "zobacz, czego analiza nie rozstrzygnęła" leads nowhere durable · HouseScreen.kt:262; AnalyzerScreen.kt:307, 507-529, 663-673
The unresolved list exists only in the in-memory Completed state of the latest job. After a restart the link opens an empty form. For any house other than the last one analysed, it opens that other house's result (see slice-rarytasy-04). When the list is visible, its items are the analyzer's English sentences (contract fixture: "the pitch of the roof over mass-0").
Impact: Journey B's partial result can never be explained to the owner in plain words.
Fix: store the unresolved items with the download record, open that house's own summary, and map the common items to Polish.
Command: /impeccable clarify

C3-04 [P2] Progress-record problems are silent or mis-explained outside Etapy · HouseScreen.kt:297-312; TimelineRail.kt:149-156; StagesScreen.kt:176-195
If the record is corrupt, Dom and 3D show "Postęp nieustawiony" with no explanation. Only Etapy says so (rc-d-01, and the journey goes straight to Etapy). If a newer app version wrote the record, Dom shows `progress_preview_only_body` ("model nie ma stałego identyfikatora"), which is the wrong reason. This was noted for cycle 3 and is not fixed.
Fix: one problem line on Dom and in the 3D header, driven by `view.problem`.
Command: /impeccable harden

C3-05 [P2] The inspector shows two different heights for the same wall · Inspector.kt:104-113
Evidence: slice-marcowki-11 shows "Wysokość 2,72 m" next to dimensions of "…× 2,53 m". slice-rarytasy-11 shows 5,7 m against 5,37 m. This was noted for cycle 3 and is not fixed. The same sizes also appear three times: in the header, the fact rows and the Wymiary row (landscape-04, default-12).
Fix: show one height. If the source and the model disagree, label which is which. Drop the Wymiary row when the fact rows already give the sizes.
Command: /impeccable clarify

C3-06 [P2] Nothing is announced to TalkBack when a long job ends · ui/ has 0 liveRegion/announce/FocusRequester; AnalyzerScreen.kt:437-441; AppShell.kt:85-90
A 4-minute analysis that fails says nothing. A successful one jumps to 3D with no cue.
Fix: announce once, politely, on Failed, Cancelled and Completed. Move focus to the failure heading, or to the 3D title after auto-open.
Command: /impeccable harden

C3-07 [P2] A 3.7–4.4-minute analysis depends on the app staying in the foreground (not proven) · LocalRuntimeHost.kt:118 uses bindService with no foreground service; analysisMs 219919 / 266769
On API 34 a cached app, and the analyzer process bound to it, can be frozen or killed. If killed, the owner sees INTERRUPTED at the next start. Nothing tells the owner how long the analysis takes or that they should stay in the app.
Fix: add a foreground service with a progress notification, or at least say "trwa kilka minut; nie wychodź z aplikacji" and keep the screen on. Then test backgrounding on a device.
Command: /impeccable harden

C3-08 [P2] The "Analiza linku w toku" line on Dom is still about 36 dp tall · HouseScreen.kt:405-411
It has no `heightIn(min = Sizes.touch)`, unlike the failure row at :426. This is C1-D3, deferred to cycle 2 and never fixed.
Command: /impeccable polish

C3-09 [P3] Analyzer result hierarchy and copy · slice-*-04; AnalyzerScreen.kt:272-277, 506; strings.xml:385
Two equal, full-width filled primaries are stacked: "Analizuj projekt" and "Otwórz w 3D". The counts read label-first with jargon: "Odczytano: bryły 2 · otwory 14 · pomieszczenia 9". Demote the link form once a result is shown, and write the counts as proper Polish plurals ("2 bryły…").
Command: /impeccable distill

C3-10 [P3] Owner-language drift · strings.xml:51, 80, 85, 112, 205, 291
- The UI calls the timeline "oś budowy", which a builder can read as structural grid axes. PRODUCT's own term, "Historia budowy", appears nowhere.
- "Na tym etapie osi budowy element jeszcze nie stoi" does not name the stage, and the details sheet covers the timeline (rc-e-03).
- "geometrii 3D" is jargon in owner copy.
- "Materiał: ścianka działowa" names an element type, not a material.
- A flat roof lists "Kąt nachylenia 0°" and "Wysunięcie okapu 0 m" (default-12).
Command: /impeccable clarify

C3-11 [P3] Small fidelity and control gaps:
- The inspector always half-fills the yellow mark for a stage in progress (Inspector.kt:183), so Dach at 40% is drawn at 50%. That puts yellow on a value nobody measured.
- The only way to switch houses is an icon with no visible label (HouseScreen.kt:246), yet the copy refers to "lista domów".
- The task field stops accepting input at 200 characters without saying so; it needs a counter.
- A release build writes `Log.i` with the source URL (AnalyzerViewModel.kt:245).
Command: /impeccable polish

3. JOURNEYS
- **A (Marcówki): proven.** slice-marcowki-01..12: analysed on the phone, auto-opened in 3D, then Dom, Etapy at 44 %, rewind to walls, before joinery and joinery (75/88/112 objects), CLAY, inspector. Not proven: font 1.3, landscape, service mode. The analysed house is also a separate house from the bundled "Marcówki", with its own progress (LINK→PROJECT merge is still undecided).
- **B (Rarytasy): proven as honestly partial.** slice-rarytasy-03/04 show "gotowy z ograniczeniami · 10 elementów nierozstrzygniętych". Not proven: that the owner can learn *what* is missing, such as the pergola, canopy or second chimney (C3-03).
- **C (lifecycle): proven** for pause/resume, activity recreation and restart. rc-c-01/02: one engine throughout, frames 22/49/22, 43 % and the task read back after restart. Not proven: process death, and backgrounding during an analysis (C3-07).
- **D (unhappy paths): partially proven.** Corrupt record handled in Etapy only (rc-d-01, see C3-04). Refusal snackbar shown (rc-d-02), but triggered through a ViewModel call rather than a tap. Stage without its own 3D geometry: 117 objects drawn = 117 stated (rc-d-03). The unsupported link exposes C3-01 and C3-02 (rc-d-04). Not proven: offline, newer schema, save failure, service-mode errors.
- **E (collisions): proven.** rc-e-01..05: objects drawn equal objects stated at 84/45/1/77; element chosen from the list; zoom buttons move the camera 33.46→26.77 m; 0 model uploads during scrub; camera did not move. Checked in code only, not on device: double taps on edit buttons (the edits are idempotent), and an edit landing while scrubbing (not possible: leaving 3D returns the cursor to now, AppShell.kt:82).
- **Coverage gap across all journeys:** every run used animator scale 0, so normal-speed motion and TalkBack traversal were never exercised. No tablet, and no landscape at font 1.3.

4. FIXES THAT DID NOT HOLD
- **C1-D2** (a reason for the disabled "Analizuj projekt"): the reason now appears wrongly after a failure or cancel (C3-01).
- **C1-D3** (36 dp target): deferred and never fixed (C3-08).
- **Both items noted for cycle 3** are still present: corrupt-record recovery is said only in Etapy (C3-04), and the 2,72 vs 2,53 m height mismatch remains (C3-05).
- **Everything else held:**
  - Framing: 0/0 house pixels at the edges in all three runs.
  - Landscape: chrome and details side panel (landscape-04).
  - Navigation-bar scrim over Kreska/Makieta (rc-e-04).
  - The 8 dp gap under "Wróć do teraz".
  - Numerals and preview headers at font 1.3.
  - Polish plurals.
  - "Zapisano …" on Dom.
  - Keyboard put away when an analysis starts.

5. WHAT IS WORKING
- Target, actual progress and preview never merge. During a preview the top reads "Aktualnie: 43% · Dach", the preview tag is hollow and the now tag solid, and the rule keeps showing actual progress.
- The model is framed in the free area at every size (0/0 edge pixels). Objects drawn match objects stated in every collision test. Scrubbing never re-uploads the model or moves the camera.
- States are honest: "Postęp nieustawiony", "Brak osobnej geometrii…", "gotowy z ograniczeniami", and "Jeszcze niedostępne" on Koszty and Dokumenty.
- Token discipline: no hex colours outside Theme.kt, yellow kept almost entirely to measured progress, and no clipped primary labels in any of the 18 captures at font 1.3.
- Lifecycle is solid: one engine after resume and recreate, and progress survives a restart.
