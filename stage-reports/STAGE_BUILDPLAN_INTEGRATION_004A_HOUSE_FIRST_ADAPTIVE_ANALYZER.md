# STAGE BUILDPLAN-INTEGRATION-004A — HOUSE-FIRST WORKSPACE + ADAPTIVE ANALYZER + KOSAĆCE TOPOLOGY

Branch `integration/house-first-adaptive-analyzer-v1`, from
`integration/immersive-progress-v1` @ `d199a0eba56de53bb72d9aa8607c7edfeee592e0`
(the 003C report commit; its UI code beneath it `6f9da1b`). Donor
`damiankrok/BuildPlan-PC-Legacy` `main` @ `b0e79675`, read only, unchanged.
Three workstreams, each in its own commits and independently revertible:
A the adaptive source layer (`packages/source-package`,
`packages/analysis-service`, the API and the phone's copy), B the wall
topology planner (`packages/reconstruction`), C the house-first product
(`apps/android`). No histories merged, no reset, no stash, no force push.

## A. Baseline

- BuildApp HEAD at start: `d199a0eb…` — matched the brief; no STOP.
- 003C's verdict does not carry over: the OWNER's house-first override
  (§22–§28 of the brief) revokes the five-place shell; a new critique
  baseline was taken (P below).
- Baseline analyzer runs before any change (desktop, Node 22, proxied
  HTTPS): Marcówki completed (model `6152770f43f4970a…`, scene
  `8c7d43956d74d252…`, 205 commands, 263 s); Rarytasy completed (model
  `8fa4a25bcd587248…`, scene `d4e7249bb1bda4b8…`, 151 commands, 336 s);
  Kosaćce failed (B); the alternate Marcówki address was refused before a
  byte was fetched (B).

## B. OWNER failures reproduced

1. **Kosaćce**
   (`https://www.archon.pl/projekty-domow/projekt-dom-w-kosaccach-46-mf6628752fa61f`):
   `RECONSTRUCTION_FAILED / MODEL_EMISSION_FAILED` in `BUILDING_MODEL`,
   "the model refused command 52 (createWall): WALLS_OVERLAP" — exactly the
   OWNER's failure. Sealed in
   `stage-reports/artifacts/integration-004a/kosacce/before/`
   (`failure.json`, `diagnostics.json`, `analysis-trace.json`, `live.txt`).
2. **Alternate Marcówki**
   (`https://www.projektydomownowoczesnych.pl/p,m2fa281446a8ca,dom-w-marcowkach-ge`):
   `UNSUPPORTED_PUBLISHER` from `validateAnalysisUrl` before any fetch —
   the address never reached the network. The regression test "004A
   baseline gate" in `packages/analysis-service/test/service.test.ts`
   reproduces this with a specialist-only registry and shows the reason.

## C. Publisher-gate root cause

`validateAnalysisUrl` (`packages/analysis-service/src/identity.ts`) answered
two questions with one function: whether the address was safe to fetch and
whether a registered adapter *recognised* it. `archonAdapter.recognizes`
was the only adapter, so recognition became an allowlist by hostname, and
the refusal (`UNSUPPORTED_PUBLISHER`, "… is not a publisher this analyzer
reads") was returned before a byte of the page had been looked at. The
security checks themselves (`safeFetch` in `net.ts`) were sound; they were
simply never reached for an unknown host.

## D. Source router

- `validatePublicSourceUrlSecurity` (`packages/source-package/src/security.ts`)
  is the no-network fence: https only, no credentials, the default port
  only (a new `allowedPorts` policy, also enforced per hop in `safeFetch`),
  a named public host (no literal IP), a length cap. It needs no publisher.
- `routeSourceAcquisition` (`router.ts`) runs after the page is fetched:
  a **specialist** that recognises the address (`AdapterStrategy =
  'SPECIALIST'`) reads it; otherwise a **generic** adapter classifies the
  page (`SourceClassification`: `PROJECT_PAGE` → read it,
  `NOT_PROJECT`, `REQUIRES_RENDERING`); otherwise `NO_ADAPTER`.
  `acquireSourcePackage` throws a typed `SourceAcquisitionError` with the
  code and the classification's evidence; the service maps it
  (`SOURCE_NOT_PROJECT`, `SOURCE_REQUIRES_RENDERING`, `NO_ADAPTER` →
  `UNSUPPORTED_PUBLISHER`), and `routableBeforeFetch` keeps the pre-fetch
  refusal only for a registry with no generic strategy.
- Order: specialist → generic → typed insufficient result. ARCHON pages are
  never routed to the generic reader (`packages/source-package/test/generic.test.ts`,
  router cases).

## E. Generic adapter

`packages/source-package/src/adapters/generic/` (`generic.project-page`
1.0.0, strategy `GENERIC`), deterministic, no API key, no remote model, no
browser, no script execution:

- `markup.ts` reads title, canonical, OpenGraph, description, `lang`,
  headings with offsets, tables, pairs from tables / definition lists /
  list items, JSON-LD parsed as data, text length, script count and
  JS-shell hints, image count; `contextAt` gives the nearest heading above
  a picture.
- `vocabulary.ts`: Polish and English drawing words (document, storey,
  view, annotation), download words, house words, site-chrome names.
- `classify.ts`: signal families (title, structured data, figures, project
  code, rooms, drawings); `MIN_SCORE = 4` and `MIN_FAMILIES = 2` — one
  weak keyword is never enough; `REQUIRES_RENDERING` when the page is a
  script shell with no drawings.
- `assets.ts`: `<img>`, `srcset`, `<picture>` grouped by structure, alt /
  title / caption / nearest heading, role claims (FLOOR_PLAN, ELEVATION,
  SECTION, PERSPECTIVE_RENDER, SITE_PLAN, …), chrome and navigation
  thumbnails dropped, bounded one-level same-registrable-domain crawl
  (`MAX_CRAWL_PAGES = 4`, deterministic order) of links whose words promise
  drawings, resolution hints from size stems.
- `published.ts`: figures, rooms and specification lines by the vocabulary
  of their labels; nothing invented.
- Identity (`genericIdentity`): an external id from JSON-LD `sku` or an
  opaque path segment when the page prints one; otherwise the canonical
  address — a stable identity from the page's own evidence, no
  publisher-specific field.

No hostname-specific selector exists for the alternate site or any other.

## F. Security

Nothing was weakened: `safeFetch` still resolves every host, classifies
every address (loopback, private, link-local incl. 169.254.169.254, CGNAT,
multicast, unspecified, every IPv6 spelling), follows redirects manually
and revalidates each hop, caps bytes by streaming, limits assets, and
allow-lists media types. Added: the port check per hop and the pre-fetch
fence that needs no publisher. The generic crawl uses the same policy for
every link. Required tests (`generic.test.ts`, `service.test.ts`,
`api.test.ts`): localhost, private IPv4, link-local and metadata, IPv6
loopback / private / mapped, credentials, non-https, unsafe redirect
refused, redirected asset revalidated, oversized HTML and asset cut at the
cap, wrong media type refused, bounded crawl, no jump to an unrelated
site, scripts treated as data (never executed).

## G. Alternate Marcówki result

Through the whole pipeline (desktop): routed `GENERIC` (classification
`PROJECT_PAGE`, confidence 1); 14 assets classified (4 floor plans, 4
elevations, 1 section, 1 site plan, 4 renders), 9 facts, 18 rooms, 5
specification lines read; observation extraction and registration ran;
the run ends honestly at `RECONSTRUCTION_FAILED / PLAN_LAYOUT_REJECTED`
("the lowest storey covers 19.56 m² against the 131.16 m² the publisher
prints — 85.1 % apart") because every plan on that site is a 550×550
thumbnail with no larger copy published. The address is no longer rejected
for its hostname; the result is evidence-based PARTIAL for this page.
Sealed: `stage-reports/artifacts/integration-004a/alternate-marcowki/`.

## H. Cross-source equivalence

`packages/analysis-service/src/cross-source.ts` (`npm run
analysis:cross-source`) compares two acquisitions evidence first: printed
facts within 1 %, roof pitch and kind (stated and reconstructed), the room
schedule, drawing coverage (not identity), footprint, counts and the
compiled geometry fingerprint of the structural meshes (ids and labels
excluded) when both sides reconstructed; titles are weak evidence and never
decide. ARCHON Marcówki vs the alternate page:
**SOURCE_PARTIAL_EQUIVALENT** — 12 aspects agree (project code
`m2fa281446a8ca`, six printed areas, height, volume, roof 40° gable, 18
identical rooms), none disagree, and only ARCHON's side has a
reconstruction, so the geometry fingerprint is one-sided.
`stage-reports/artifacts/integration-004a/cross-source/cross-source.{json,md}`.
Not forced to equality.

## I. Kosaćce first bad topology decision

Traced from the evidence, not from the validator: on the main mass's
ground storey (x 0..14.542 m, ring wall thickness 0.296 m) the partition
observation `main-iwall-0-z-13` is a 0.53 m stub read 8 mm *inside* the
east ring wall's band. The emitter (`emit.ts`) turned every partition run
into a `createWall` as observed, so the stub penetrated the ring wall and
overlapped it by 0.0043 m²; the validator's `WALLS_OVERLAP` was correct.
The first wrong inference was the absence of any topology decision between
the observed partition runs and the DSL.

## J. Topology planner

`planWallTopology(runs, hosts, {gapM = 0.015, reachM = 0.06, minRunM = 0.2})`
(`packages/reconstruction/src/v2/wall-topology.ts`), generic, over a
storey's partition runs and its host bands (ring walls and returns), in
order: fuse duplicates and collinear pieces (`FUSED_DUPLICATE`); a run
inside a parallel host is dropped (`DROPPED_INSIDE_HOST`), one whose end
penetrates a host is snapped off it by its measured penetration plus the
gap (`SNAPPED_OFF_HOST`); perpendicular ends are clamped to the host's
face (`TRIMMED_TO_HOST`); crossings split, thinner yields (`SPLIT_AT_CROSSING`);
stubs dropped (`DROPPED_STUB`); T ends trimmed deepest-first with the
X-owns-corner convention for L corners (`TRIMMED_TO_PARTITION`); shorts
dropped (`DROPPED_SHORT`); a final overlap audit drops what it cannot
resolve with a recorded decision (`DROPPED_UNRESOLVED_OVERLAP`) — fail to
unknown, never emit invalid. Doors on a dropped run are dropped with it
(`DOOR_DROPPED`). Every decision is in `EmitResult.topology`, the
reconstruction trace (`WALL_TOPOLOGY`) and the failure diagnostics
(command id, wall ids, measured overlap, decisions). Commands are ordered
so every prefix validates. `WALLS_OVERLAP` in `packages/model` is
untouched.

## K. Kosaćce before / after

| | before | after |
| --- | --- | --- |
| outcome | `MODEL_EMISSION_FAILED`, command 52 `createWall`, `WALLS_OVERLAP` | COMPLETED |
| masses / openings / commands / meshes | — | 3 / 13 / 169 / 136 |
| model hash | — | `5b5ffcf1afcd2511…` |
| scene contentHash / sha256 | — | `50217b856dfc3d05…` / `0a9119cdf2b4a6df…` |
| desktop wall clock | ~4 min 20 s to the failure | 284 s (acquisition 4.8, observations 269, metrics 6.5, reconstruction 0.5+) |
| Node 18 bundle (no ICU) | — | done, same model and scene hashes, 397 s, peak RSS 2 041 MB |

The sealed evidence (same source package and graph before and after)
replays offline through today's solver to the same model hash
(`stage-reports/artifacts/integration-004a/kosacce/`, CI job
`third-house-kosacce`). Nothing names Kosaćce, command 52, or the
evaluation figures (128.16 / 164.47 / 216.91 m², 6.49 m, 35°) in
production code.

## L. Marcówki regression

Model `6152770f43f4970a…` and scene `8c7d43956d74d252…` byte-identical
before and after the planner; the candidate hash moves (the program's run
ids and topology notes are part of it), the model and scene do not. The
specialist adapter's package is unchanged (same `sourcePackageHash`).

## M. Rarytasy regression

Model `8fa4a25bcd587248…` and scene `d4e7249bb1bda4b8…` byte-identical;
PARTIAL fidelity as before (pergola, entrance canopy, second chimney). The
committed 003B replay expectation is unchanged.

## N. Synthetic source fixtures

`packages/source-package/test/generic.test.ts` (31 tests): ten holdout
project pages of different shapes (tables, definition lists, JSON-LD,
`<picture>` and `srcset` variants, captions, a downloads page one level
deep, a JS shell, renders only, not a project), sealed replay
byte-identical, the security suite, the router. `generic-source.test.ts`
(7): a synthetic house on an unknown publisher reconstructed through the
generic reader and `SOURCE_EQUIVALENT` to the specialist's reading by
geometry fingerprint; NO_DRAWINGS; SOURCE_NOT_PROJECT;
SOURCE_REQUIRES_RENDERING; SOURCE_UNSAFE; specialist preferred.

## O. Synthetic wall topology fixtures

`packages/reconstruction/test/wall-topology.test.ts` (17): L corner,
exterior T, interior T, cross, duplicate, partial collinear,
near-collinear noise, genuinely separate close walls, the 8 mm stub, door
carried with its run; every emitted command prefix replayed through the
real model (`applyCommand`) so each prefix validates; a genuine overlap
still fails `WALLS_OVERLAP`.

## P. New house-first critique (§30 baseline)

Impeccable `critique`, dual-agent, on the run-73 UI under the NEW brief:
`stage-reports/artifacts/integration-004a/impeccable/house-first-critique.md`
(snapshot `apps/android/.impeccable/critique/2026-09-29T12-16-16Z…`).
Verdict "authored skin on a stock skeleton", **24/40**, cognitive load 5/8
failures. The eleven §30 questions answered with measurements: the bottom
bar existed because PRODUCT.md froze five places; setting progress,
switching or adding a house and reading source status required leaving
3D; progress could be looked at around the house but not touched; on Dom
the bar took 7.1 % and the drawing 25 % of the height, on 3D the chrome
18.6 % and the house ≈ 13 % of the area under a 25 % void; the analyzer
was a page whose result evicted the open house; 2 of 5 destinations were
empty; one-handed use was right at the foot and wrong at the top; chrome
text was strong outdoors but the model silhouette weak; ≈ 70 % of the
screen accepted orbit at rest; the %·stage·task triple was clean on one
of six states; the house was 1 tap away on every launch, a recorded stage
5 taps, a house switch 4. P0: the house was not the root. P1: progress not
editable around the house; two empty destinations; the analyzer a place
whose result evicted the house. P2: the house did not occupy the screen.

## Q. Three UI directions

`stage-reports/artifacts/integration-004a/impeccable/house-first-directions.md`:
A Spatial instrument, B Construction cockpit, C Quiet canvas, each
critiqued on house dominance, homeowner clarity, touch ergonomics, clutter,
extensibility, accessibility and Compose/Filament feasibility. B rejected
(icon-only handles trade words for glyphs and both edges cost gesture
area); C rejected as the default (hiding the rail hides the state words
"Bez dachu" / "Makieta" that the 003C evidence showed owners needing) and
kept as a behaviour (the rail already recedes while the model is turned).
**A chosen.** The OWNER was not asked: the brief's §22–§28 decide the root,
the task flow and the Koszty boundary; the rest is structural and recorded
with its evidence.

## R. Chosen HouseWorkspace

`apps/android/app/src/main/java/com/buildplan/preview/ui/`:

- `ShellState` = root + at most one `Sheet` (MENU, STAGES, SOURCE) + at most
  one `Task` (ANALYZER); pure `back()`; `EXTRA_PLACE` still names a surface
  (`HOUSE`/`MODEL`, `STAGES`, `SOURCE`, `MENU`, `ANALYZER`);
  `EXTRA_WITHOUT_BUNDLED` hides the APK's scenes for the no-house state.
- `AppShell`: the analyzer task, else `NoHouseScreen` when no house exists,
  else `HouseWorkspace`. A finished analysis opens by itself only with no
  house open; otherwise the workspace offers it in its status row.
- `HouseWorkspace` (the former `ModelWorkspace`): Layer 0 the model edge to
  edge; Layer 1 the top context (house menu button, house name, the actual
  state, and a status row only when there is something to say); Layer 2
  the labelled tool rail (receding while the model is turned); Layer 3 the
  construction rail whose header opens the stage sheet; Layer 4 one
  contextual surface at a time (the inspector in-window, or a modal sheet
  on a scrim). Camera framing measured from the resting chrome as in 003C;
  sheets and the task never move the camera.
- `HouseSheets`: `HouseMenuSheet` (houses on this phone, add from link,
  Etapy budowy, Źródło modelu i analiza, the Koszty boundary as a disabled
  row that says it is not built), `StageSheet` (the 003C editor),
  `SourceSheet` (name, the inked `HouseDrawing`, source status with
  limitation counts, a running or failed analysis, the latest analysis of
  this house with `AnalysisDiagnostics`, technical rows), `NoHouseScreen`.
- Deleted: `AppPlace`, `PlacesBar`, `PlacesRail`, `EmptyPlace`,
  `HouseScreen` (Dom), the `place_*` and `empty_*` strings.
- PRODUCT.md, DESIGN.md and the surface brief record the override.

## S. Progress / history integration

Unchanged domain and persistence (`progress/`). Around the house: the rail
header reads "43% Dach / Teraz: Montaż więźby" (or "Postęp nieustawiony"
with "Ustaw postęp") and is the handle into the stage sheet
(`TimelineRail.NowHeader.onEdit`, chevron, 48 dp, `onClickLabel`); the
top context repeats the actual state while previewing; scrubbing and
tapping the rule preview without saving; "Wróć do teraz"; the stage sheet
is the one place the record is edited and "Pokaż w 3D" closes it onto the
house with the cursor moved. Save/restore: the house, camera,
presentation, layers and selection live in the ViewModels (they survive
rotation); the preview cursor resets on a house switch and with the
process, never on a sheet or the task — defined in `AppShell`'s comment.

## T. Source / analyzer contextual UX

Entry points: the no-house state ("Dodaj dom z linku"), the house menu,
the source sheet, and the status row of the workspace when a run is going
or failed ("Analiza linku w toku · 37 %", "Analiza linku się nie powiodła
— zobacz dlaczego"). The task returns to the same house at the same
camera; a result is opened by the owner ("Otwórz w 3D") or offered ("Nowy
dom gotowy: … · Otwórz"). Generic-source copy on the phone: "Sprawdzam
stronę projektu i pobieram rysunki" (first stage), "Nie rozpoznałem na tej
stronie projektu domu.", "Znalazłem projekt, ale brakuje rzutu potrzebnego
do modelu.", "Ta strona wymaga renderowania w przeglądarce, którego
analiza na telefonie jeszcze nie obsługuje.", "Nie udało się poprawnie
połączyć części ścian. Szczegóły są poniżej." — never "Obsługiwane są
tylko strony ARCHON". Typed failures: `UnsafeUrl`, `SourceContent(code)`
with `RetryAction.NONE`.

## X. Performance (measured, not refounded)

| source | outcome | wall clock | acquisition / observations / metrics | assets, source bytes | model / scene |
| --- | --- | --- | --- | --- | --- |
| Marcówki (ARCHON) | COMPLETED | 263 s | 16.4 / 236.3 / 5.1 s | 20, 4.2 MB | `6152770f…` / `8c7d4395…` |
| Rarytasy (ARCHON) | COMPLETED | 336 s | 18.6 / 305.3 / 9.3 s | 37, 14.0 MB | `8fa4a25b…` / `d4e7249b…` |
| Kosaćce (ARCHON) | COMPLETED | 284 s desktop; 397 s Node 18 bundle, peak RSS 2 041 MB | 4.8 / 269.4 / 6.5 s | 31, 19.9 MB | `5b5ffcf1…` / `50217b85…` |
| alternate Marcówki (generic) | PLAN_LAYOUT_REJECTED | 102 s | 0.4 / 101.0 / — | 14, 3.7 MB | — |

Desktop runs on Node 22 through the proxied sandbox network. The Kosaćce
bundle run stays inside the ~2.1 GB / multi-minute envelope the brief
names; no regression flagged; no runtime optimization attempted.

## U. Three audit → fix → verify cycles

Exactly three, after the main implementation, each sealed under
`stage-reports/artifacts/integration-004a/impeccable/`:

1. **Cycle 1 — house-first IA** (`cycle1-critique.md`, Impeccable
   dual-agent critique of the new workspace code): **29/40** against the
   24/40 baseline, no P0, five P1 (the stage sheet was the Etapy page in a
   sheet; the status row was permanent for a limited house and misrouted a
   failed link; two panel overlaps; the rail out of one-handed reach; the
   bundled sample unlabelled). All five P1 and eight P2 fixed in
   `fix(ui): apply Impeccable house-first critique`; verified on the
   emulator by CI run 75 (V).
2. **Cycle 2 — analyzer genericity / security** (`cycle2-audit.md`, an
   independent technical reviewer over the diff with the tests run):
   verdict PARTIAL before fixes — no P0, two P1 (the service path never
   typed the four "page not enough" refusals; the generic reader ordered
   page text with `localeCompare`, which the phone's ICU replica refuses
   for common punctuation) — plus P2s (fence-level IPv6/IPv4-spelling
   tests, a classifier-less generic adapter, fact-label anchoring, site
   plan before floor plan, a purity guard over the generic reader). Fixed
   in `fix(source): order page text by code units…` and `fix(android):
   type the page's refusals on the service path too`; the alternate
   Marcówki package re-acquired offline after the change is byte-identical
   (same `contentHash`). Declined with reason: the solver version bump
   (it is part of every model hash, so bumping it would break the very
   byte-identity this stage gates on; noted for the next stage that changes
   those outputs).
3. **Cycle 3 — release candidate** (`cycle3-polish-harden.md`, Impeccable
   polish + harden: tokens, type at 1.3, targets, glass over glass, state
   by colour, motion under the policy, strings; then sixteen adversarial
   journeys reasoned from the code). Verdict before the fixes: not yet a
   release candidate — three P1s (the inspector let taps through to the
   model and the rail; in landscape the tool pane lay under the timeline;
   the open house was not remembered across a cold start) and eight P2s.
   Fixed in `fix(ui): … (cycle 3)`: `Modifier.solidToFinger()` on every
   surface over the model, the bottom stack ending before an open pane on
   its side, `lastOpenKey` in the preview preferences, the "nothing stands"
   message inside the chrome rectangle, a scrolling side rail capped at the
   safe height, no reload of the house already open, a failed house named
   and deletable from its source sheet, the rail leaving with the timeline
   while the details are open, rail-length layer words, folds under
   `MotionPolicy`, `safeDrawingPadding()` on the task. Three device
   assertions guard the P1s (a tap on the inspector's title keeps the
   selection; the pane and the rule do not overlap on a phone on its side,
   capture `06-layers-pane`; a second house opened, the app closed and
   opened, the same house). Carried finish debt: AA.

## W. CI / test matrix

| gate | where | status |
| --- | --- | --- |
| typecheck, unit / integration / architecture (vitest, 1 094 tests incl. generic 33, router, security, service 47, generic-source 7, topology 17, purity guards) | `core` | green (run 74/75) |
| API bundle + HTTP smoke (SOURCE_UNSAFE before fetch; an unknown publisher inspected, typed failure) | `core` | green after `43f052b` |
| analyzer container smoke | `analyzer-image` | green after `43f052b` |
| Marcówki (sealed candidate, exterior closure, facade audit) | `core` | green |
| Rarytasy: live URL, sealed replay, garage gable, pre-fix refusal, Node 18 without ICU = desktop | `second-house-generalization` | green (run 74: model `8fa4a25b…`) |
| Kosaćce: sealed evidence through today's solver = sealed hashes (hard gate when the plans fetch), live URL advisory, live = sealed | `third-house-kosacce` (new) | green (run 74: live 164 s, `5b5ffcf1…` = sealed) |
| Android JVM tests (401) + lint + APK | `android` | green |
| 3D entry gate on the workspace root (cold start, after the analyzer task, direct launch) | `android-3d-gate` | green |
| Local analyzer host parity (Node 18/22) and device (emulator fixture) | `local-analyzer-*` | green |
| UI evidence: house-first journey at font 1.0 and 1.3, landscape, lifecycle / unhappy / collisions, no-house, Marcówki + Rarytasy + Kosaćce slices, alternate publisher | `android-ui-evidence` (+ `NoHouseDeviceTest`, `GenericSourceDeviceTest`, Kosaćce slice) | run 74: every journey but the camera assertion (fixed, `0feddb4`); run 75: see V |
| OWNER direct APK (waits for the third house too) | `owner-preview-release` | Z |

## Y. Commits

All on `integration/house-first-adaptive-analyzer-v1` from `d199a0e`
(mirrored unchanged on the session branch `claude/new-session-3kzcgh`,
whose pushes run CI); each workstream reverts on its own.

| # | commit | workstream | what |
| --- | --- | --- | --- |
| 1 | `48034bc` refactor(source): separate url safety from publisher recognition | A | `validatePublicSourceUrlSecurity` (security.ts), `safeFetch` port check (net.ts), `routeSourceAcquisition` (router.ts): specialist → generic → typed refusal |
| 2 | `e4e191d` feat(source): add generic public project-page adapter | A | `adapters/generic/` (markup, vocabulary, classify, assets, published); publisher-neutral `SourcePackage`; `compareCodeUnits`; the error taxonomy; cross-source comparison |
| 3 | `a160561` test(source): add generic extraction and security holdouts | A | 10 synthetic publisher fixtures, determinism replay, SSRF fence rows, router and purity guards |
| 4 | `c3d47ff` fix(reconstruction): normalize wall topology before model emission | B | `v2/wall-topology.ts` planner between observed partition runs and the DSL; `WALLS_OVERLAP` untouched |
| 5 | `b3dced2` test(reconstruction): add Kosaccach topology gate | B | 17 synthetic topology cases incl. genuine-overlap negatives; sealed Kosaćce evidence; Marcówki / Rarytasy byte-identity |
| 6 | `7213834` refactor(ui): make HouseWorkspace the product root | C | `ShellState` (root + one sheet + one task), `AppShell`, `HouseWorkspace`, `HouseSheets`, the analyzer as a task, `NoHouseScreen` |
| 7 | `b62a096` test(android): add house-first and multi-source gates | C | ProductFlow, Adaptive, ReleaseCandidate, VerticalSlice, ModelEntry, NoHouse, GenericSource device tests; `validate-ui-evidence.mjs`; `third-house-kosacce` job |
| 8 | `c42437e` test(android): recapture the analyzer contract fixtures | A/C | service 1.1.0 fixtures |
| 9 | `43f052b` test(api): smoke the 004A refusal codes and the inspected unknown publisher | A | SOURCE_UNSAFE before a fetch; an unknown publisher inspected then typed |
| 10 | `1be45a7` docs: 004A report draft | — | sections A–T |
| 11 | `fa31064` fix(source): order page text by code units and anchor the generic reader's labels (cycle 2) | A | no `localeCompare` on page text (the phone's Node 18 has no ICU); anchored fact labels; site plan before floor plan |
| 12 | `a9cca3e` fix(android): type the page's refusals on the service path too (cycle 2) | C | `AnalyzerFailure.typed()` on both paths |
| 13 | `93a72b6` fix(ui): apply Impeccable house-first critique (cycle 1) | C | the top context, the status row, the stage sheet with the drawing, the source sheet, the no-house screen |
| 14 | `0feddb4` test(android): the camera the owner set is what a sheet or the task gives back | C | a nudge before the pose is recorded (home re-fits by design) |
| 15 | `54f0c1a`, `c3261a1` docs: 004A report — cycles, CI matrix, residual debt, OWNER checklist | — | U, W, AA, AB |
| 16 | `1b80ba8` fix(ui): solid chrome, clear landscape panes, remembered house (cycle 3) | C | H-01…H-08, P-01…P-03 and three device assertions (U) |
| 17 | docs: 004A — device evidence, commits, APK, PROJECT_STATUS | — | V, Y, Z and the three verdicts; the commit that carries this row |

Every commit carries the session's attribution trailer; none carries a
model identifier. Legacy is untouched (`b0e79675`, read only).

## AA. Residual debt

- **Alternate Marcówki does not reconstruct**: the site publishes only
  550×550 plans; the run ends honestly at `PLAN_LAYOUT_REJECTED`. The phone
  says "Nie udało się zbudować modelu" with the reason folded under
  "Szczegóły analizy"; a dedicated sentence for "plans too small to read"
  would need the solver to tell resolution from layout, which it cannot
  yet. A larger-copy probe for unknown publishers (as the ARCHON convention
  does) is the next step of the generic reader.
- **`SOLVER_V2_VERSION` unchanged** although the emitter's rule set grew
  (cycle 2, declined for the byte-identity gate); the duplicate binding of
  a split run (cycle 2 P3) is left for the same reason (the sealed
  Kosaćce candidate hash).
- Role-aware media types per fetch, return-host unit cases, a multi-tenant
  registrable-domain list, a page-size cap below the asset cap (cycle 2
  P2/P3).
- In-window sheets honouring `MotionPolicy` (the Material sheet still
  slides under reduced motion), the landscape timeline as a row, a
  persisted "gesture hint seen", the analysis date on a re-analysed house's
  menu row (cycle 1 P2-2, P2-8, P3).
- The two 6 s timers (gesture hint, notice) and the 11–13 sp rail labels
  and numerals in glare are unchanged from 003C.
- Cycle 3 P3 finish debt: the 56/64/560 dp rows and measure and the 1.5 dp
  mark radius as tokens, `AlertDialog` corners and `TextButton` stadium
  state layers, the progress bar's stop dot, three scrim alphas, the stage
  list re-scrolling on recreation, `refreshScenes()` on every back press,
  four merge-able duplicate strings, the gesture hint and "limited" notice
  reset after a task round trip.
- The five-minute analyses and ~2 GB peak RSS are measured, not reduced
  (§40 of the brief).

## AB. OWNER checklist (visual acceptance on the phone)

Install `BuildPlan-owner-preview.apk` (Z) and, with the sample house open:

1. **The house is the first thing.** The app opens on the 3D house, no
   dashboard, no tab bar. Is that right for you on a cold start, every time?
2. **The rail at the foot (upright).** Wygląd / Warstwy / Widok / Dopasuj
   stand above the timeline where a thumb reaches; on a phone on its side
   they are at the top right. Do the labelled buttons earn their place, or
   would you rather one handle that unfolds them (direction C)?
3. **The rule's header is the way into the stages.** Tap "43% · Dach ›"
   (or "Ustaw postęp") — the stage sheet opens over the house with the
   inked drawing and the one big figure; the ridge stays visible above it.
   Is 82 % of the screen the right height, or should the sheet be shorter
   and open on the current stage only?
4. **The status row.** Under the house's name a line appears only when there
   is something to say (a new house ready · Otwórz; an analysis running or
   failed; a model with limitations, once; the sample's "dodaj swój dom").
   Does any of these deserve to stay permanently, or to be a toast?
5. **The house menu.** Houses on this phone, "Dodaj dom z linku", Etapy
   budowy, Źródło modelu i analiza, and Koszty as a disabled row that says
   it is not built. Is that the right place for Koszty until the cost
   workspace exists?
6. **The source sheet.** Where the model came from, its limitations, the
   latest analysis of this house, the technical rows folded, and "Usuń ten
   dom z telefonu" for a downloaded house.
7. **A link from another publisher.** Paste
   `https://www.projektydomownowoczesnych.pl/p,m2fa281446a8ca,dom-w-marcowkach-ge`:
   the app says "Sprawdzam stronę projektu i pobieram rysunki", reads the
   page, and ends with "Nie udało się zbudować modelu" — the page's plans
   are 550 px thumbnails — rather than refusing the address. Is that honest
   enough, or do you want the sentence to say the plans are too small?
8. **Kosaćce.** Paste the Kosaćce link: the analysis completes (about
   three to seven minutes) and the house draws; "Model gotowy z
   ograniczeniami" (13 unresolved) is said on the status row and the source
   sheet.
9. **Back.** From the bare house, back leaves the app; a sheet closes; the
   analyzer task returns to the same house at the camera you left.
10. **Font 1.3 and landscape.** Everything above at the larger font and on
    the phone's side (the details as a side panel, the stage sheet).

Anything you would change is a bounded fix for the next stage; nothing here
is merged to `main` until you decide.
