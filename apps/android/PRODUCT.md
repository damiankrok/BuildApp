# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

A Polish private homeowner-investor building one single-family house. Not a
BIM, CAD or construction professional; contractors do the physical work, and
this app is the owner's own record of it. They want to answer, without
technical vocabulary: which stage the build is at, what is being done now,
what the house looks like at this stage, what it looked like before the roof
or the windows, and which room or element they are looking at.

## Product Purpose

BuildPlan turns the house's published project into a semantic 3D model the
owner can walk around on the phone, and keeps the owner's own account of the
construction beside it: stages, the current stage, the current task and a
progress percentage. Success is an owner who opens one house and, in a few
seconds, knows where the build stands and can rewind the model to any earlier
stage.

## Positioning

The house's own 3D model, reconstructed from its published project, is the
index of every construction matter — stages now, later costs, documents and
maintenance.

## Operating Context

- Mixed use: calm review sessions at home in the evening, and short checks on
  the plot in daylight, often one-handed. Status must be glanceable and
  targets large.
- The source is a public project page given by the owner as a link — an
  ARCHON page through its specialist reader, or any other publisher through
  the generic project-page reader, which recognises a house project on the
  page's own evidence and says exactly what is missing when it cannot go
  on; the analyzer runs on the phone (or on the analyzer service) and
  produces a candidate model, which may be complete or partial.
- Offline-first: viewing the model and progress needs no network and no
  account. Only fetching a new source needs the internet.

## Capabilities and Constraints

- The house is the root (OWNER override, INTEGRATION-004A). Whenever a
  house exists the app launches into the house workspace: the 3D house full
  screen, a compact top context, restrained edge controls, the construction
  rail at the foot, and one contextual sheet at a time. There is no
  dashboard before the house and no five-place navigation. The former
  places live around the house: Dom is the workspace itself; 3D is its base
  layer; Etapy is the rail and the stage sheet; Dokumenty is the source
  sheet for now; Koszty is a named future boundary (a dedicated cost
  workspace that keeps the house's context and returns to it), never an
  empty tab. Adding a house from a link is a task flow that returns to the
  same house and camera; with no house on the phone, the root is the minimal
  "Dodaj dom z linku" state.
- The canonical building model is owned by BuildApp and is never changed by
  the app's UI, progress or history. Construction progress is a separate
  record keyed by the house's stable model id; a historical stage view is a
  derived visibility projection over the same model.
- "Postęp wg etapów" is the only progress percentage: the weighted mean of
  stage completion. It is never money spent, labour value, model geometry or
  analyzer confidence.
- Three concepts are never collapsed: the target design, the actual current
  progress, and the preview cursor on the timeline. A preview never saves.
- Stages: NOT_STARTED, IN_PROGRESS, DONE; at most one in progress. The 17
  Master Plan starter stages (Zakup działki … Ogród), equal weights until
  validated weights exist.
- Stages without their own geometry (installations, plaster, screed,
  finishing, formalities) say so; the app never fabricates geometry.
- 3D interactions that must survive: orbit, zoom, pan, select, storey and
  roof visibility, isolation, Fit/reset, MODEL / CLAY (Makieta) / LINE
  (Kreska).
- Undecided: cost ledger (inside the future cost workspace), documents and
  photos, multi-house management beyond the house menu, LINK → PROJECT merge
  into one logical house, AS-BUILT history, accounts, sync.

## Brand Commitments

- Primary UI language is Polish, in homeowner words (Dom, Postęp, Aktualny
  etap, Teraz robimy, Etapy, Historia budowy, Wróć do teraz, Projekt
  docelowy, Warstwy, Widok, Szczegóły). Technical terms stay in code and
  under "Diagnostyka" / "Dane techniczne".
- Dark-first, model-first, technical but calm (pinned by the owner's brief).
- The owner has rejected: card-heavy dashboards, a giant rounded model card,
  stacked rectangular panels around the 3D, a debug-tool feel, and large dead
  cards for unfinished modules.

## Evidence on Hand

- Three reference houses travel through the real product: Marcówki (bundled
  reference and candidate, and a live link analysis), Rarytasy (live link
  analysis, PARTIAL: pergola, entrance canopy and second chimney are missing)
  and Kosaćce (live link analysis through the generic wall topology
  planner); the alternate Marcówki publisher is read by the generic reader
  and compared to ARCHON's page, evidence first.
- No real owner progress data exists. The app must never ship invented
  progress, costs, documents or dates; an unset state says "Postęp
  nieustawiony" and offers to set it.

## Product Principles

1. The house is the index: every matter should be reachable from the model,
   and the model from every matter.
2. Say what is known, and only that: partial results, missing geometry and
   unset progress are stated in plain words, never smoothed over.
3. Looking is not editing: scrubbing, previewing and exploring never change
   what the owner has recorded; changing it is always a deliberate act.
4. The model leads, the chrome recedes: controls exist to serve the view of
   the house and get out of its way. The house, not the rule, is the primary
   product visual; the rule is the timeline under it.
5. One logical house: progress and history belong to the house, not to an
   analyzer run, a file or a hash.

## Accessibility & Inclusion

- Touch targets at least 48 dp; readable at system font scale 1.3 with no
  clipped primary label; stage state never conveyed by colour alone; the
  timeline scrubber has tap/button alternatives; respects the system animator
  scale (reduced motion = immediate transitions).
