---
name: BuildPlan
description: The owner's own house, large in 3D on a calm graphite ground, with a minimal dock of matte glass tiles that grow into their panels (variant C, "Minimalny dok").
colors:
  Ground: "#101419"
  Raised: "#181D24"
  Sheet: "#1B2128"
  Well: "#10141A66"
  Hairline: "#2E3640"
  Ink: "#EEF1F4"
  InkMuted: "#AEB7C2"
  InkFaint: "#8E98A4"
  RuleEmpty: "#6B7581"
  Accent: "#7FE3C4"
  AccentWash: "#7FE3C429"
  OnAccent: "#0B1F19"
  Rule: "#7FE3C4"
  OnRule: "#0B1F19"
  Error: "#EF8A7E"
  InkMutedOnGlass: "#C3CBD4"
  Glass: "#2A3038E0"
  GlassDense: "#1D2329F0"
  GlassSheen: "#FFFFFF17"
  GlassContact: "#00000059"
  GlassOpaque: "#161B21F2"
  GlassRimHigh: "#FFFFFF4D"
  GlassRimLow: "#FFFFFF0A"
  GlassShadow: "#000000CC"
  Scrim: "#05060A"
  ModelBackground: "#222B36 (skybox input #303740 under ACES legacy, named in the view's ColorGrading)"
  SelectionMint3D: "#7FE3C4 edges, emissive at about a sixth"
  ContactShadow: "8 rings of #000000 at 7.2 %, 0 to 1.4 m beyond the footprint"
typography:
  measureMonumental:
    fontFamily: "Barlow Condensed SemiBold"
    fontSize: "64sp"
    fontWeight: 600
    lineHeight: "64sp"
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  measureInline:
    fontFamily: "Barlow Condensed SemiBold"
    fontSize: "20sp"
    fontWeight: 600
    lineHeight: "22sp"
    fontFeature: "tnum"
  measureNumeral:
    fontFamily: "Barlow Condensed SemiBold"
    fontSize: "13sp"
    fontWeight: 600
    lineHeight: "14sp"
    fontFeature: "tnum"
  headlineSmall:
    fontFamily: "Roboto"
    fontSize: "24sp"
    fontWeight: 600
    lineHeight: "32sp"
    letterSpacing: "-0.005em"
  titleLarge:
    fontFamily: "Roboto"
    fontSize: "22sp"
    fontWeight: 600
    lineHeight: "28sp"
    letterSpacing: "0sp"
  titleMedium:
    fontFamily: "Roboto"
    fontSize: "16sp"
    fontWeight: 600
    lineHeight: "24sp"
    letterSpacing: "0sp"
  titleSmall:
    fontFamily: "Roboto"
    fontSize: "14sp"
    fontWeight: 600
    lineHeight: "20sp"
    letterSpacing: "0sp"
  bodyLarge:
    fontFamily: "Roboto"
    fontSize: "16sp"
    fontWeight: 400
    lineHeight: "24sp"
    letterSpacing: "0.5sp"
  bodyMedium:
    fontFamily: "Roboto"
    fontSize: "14sp"
    fontWeight: 400
    lineHeight: "20sp"
    letterSpacing: "0.25sp"
  bodySmall:
    fontFamily: "Roboto"
    fontSize: "12sp"
    fontWeight: 400
    lineHeight: "16sp"
    letterSpacing: "0.4sp"
  labelLarge:
    fontFamily: "Roboto"
    fontSize: "14sp"
    fontWeight: 500
    lineHeight: "20sp"
    letterSpacing: "0.01em"
  labelMedium:
    fontFamily: "Roboto"
    fontSize: "12sp"
    fontWeight: 500
    lineHeight: "16sp"
    letterSpacing: "0.02em"
  labelSmall:
    fontFamily: "Roboto"
    fontSize: "11sp"
    fontWeight: 500
    lineHeight: "16sp"
    letterSpacing: "0.02em"
rounded:
  tick: "2dp"
  control: "12dp"
  tile: "18dp"
  panel: "22dp"
  sheet: "26dp"
  pill: "999dp"
spacing:
  xxs: "2dp"
  xs: "4dp"
  s: "8dp"
  m: "12dp"
  l: "16dp"
  xl: "24dp"
  xxl: "32dp"
  xxxl: "48dp"
sizes:
  touch: "48dp"
  tile: "56dp"
  icon: "22dp"
  iconSmall: "18dp"
depth:
  tile: "6dp"
  panel: "16dp"
motion:
  morphOpen: "spring, critically damped, stiffness 650 (≈ 450 ms), keeps its velocity on a reversal"
  morphClose: "spring, critically damped, stiffness 900 (≈ 350 ms)"
  morphPath: "LIFT 0–0.45 in its own column, then GROW 0.38–1 with the foot fixed above the dock"
  handover: "the incoming glass starts when the outgoing one is within 6 % of home"
  quickExit: "90ms"
  turntable: "opt-in, 6°/s, after 5 s idle, 1.6 s ease in/out, 30 Hz, 5 min at most"
  glide: "after a flick: exponential decay τ 220 ms, 30–360°/s, pitch at 35 %"
  showroom: "chrome to 20 % over 1.4 s after 6 s of turning; the first touch only wakes it"
  enter: "220ms"
  exit: "150ms"
  settle: "180ms"
  recede: "160ms"
components:
  house-pill:
    background: "Glass"
    shape: "pill"
    height: "48dp"
    content: "house icon, short name (titleSmall), Demo/Galeria badge, chevron down"
  header-button:
    background: "Glass"
    shape: "pill"
    size: "48dp"
  badge:
    textColor: "Accent"
    background: "AccentWash"
    shape: "pill"
    typography: "labelMedium"
  dock-tile:
    background: "Glass"
    shape: "tile"
    height: "56dp"
    content: "icon, caption (labelMedium, InkMutedOnGlass) with a 14 dp chevron, state (titleSmall): 'Widok / Cały dom', 'Etapy / 40% · Ściany'; preview mark + return"
  dock-panel:
    background: "Glass → GlassDense (follows the morph)"
    shape: "panel"
    maxShare: "the dock's column: 62% of the height upright; the column's full height on a phone on its side"
  layer-card:
    background: "#FFFFFF0F"
    border: "1dp GlassRimHigh"
    shape: "control"
    height: "56dp"
  layer-card-selected:
    background: "AccentWash"
    border: "1.5dp Accent"
    content: "Accent icon, semibold label, Accent check"
  view-chip:
    background: "#FFFFFF0F"
    border: "1dp GlassRimHigh"
    shape: "pill"
    height: "48dp"
  view-chip-selected:
    background: "AccentWash"
    border: "1.5dp Accent"
    content: "Accent check, semibold label"
  folding-rule:
    done: "Rule (mint) fill"
    inProgress: "Rule outline, filled to completion"
    notStarted: "RuleEmpty outline"
    height: "52dp interactive, 40dp static"
  ink-button:
    background: "Ink"
    textColor: "Ground"
    shape: "control"
    height: "48dp"
  line-button:
    border: "1dp RuleEmpty (Ink when it is the action that matters)"
    textColor: "Ink"
    shape: "control"
    height: "48dp"
---

# Design System: BuildPlan

## Overview

**Creative North Star: "Minimalny dok" (OWNER's choice, variant C, APK 1356; round D, APK 1357)**

The house is the screen. The model stands large and centred on a calm graphite ground, edge to edge, grounded by a soft contact shadow, and the only chrome over it is a handful of small floating pieces of smoky matte glass: the house pill at the top start, one capsule with "Dopasuj" and the menu at the top end, and a dock of two equal tiles at the foot — "Widok / Cały dom" and "Etapy / 40% · Ściany", each a caption over a state. Each tile lifts out of its slot and grows, as the very same piece of glass, into its own panel (Widok, Etapy) and shrinks back into its slot; nothing else on the screen moves. Nothing else is permanent. Words are achromatic ink; one accent, mint, marks what is chosen or measured — in the chrome and in the 3D alike — always beside a mark or a word. Left alone, the house may turn slowly by itself, if the owner chose that.

This direction replaces the former "Folding Rule" system and its bans (no pills, no shadows, a side rail, a bottom timeline panel). The folding rule survives as the construction axis inside the Etapy panel, now in mint; it is no longer the frame of the screen.

Confirmed rejections, from the owner's briefs: a permanent side rail, a permanent large progress panel, a full navigation bar (variant A), a vertical axis (variant B), a permanent CAD grid, card-heavy dashboards, stacked translucent panels, and dead features shown as main actions.

**Key Characteristics:**
- The house fills most of the width upright and stays centred; the camera frames it in what the chrome leaves free AT REST.
- Two dock tiles; each morphs into its panel. One panel at a time; the other tile, the header and the house never move.
- Smoky matte glass: tint, sheen, fixed grain, light rim, soft depth outside the shape. No backdrop blur (see Elevation & Depth).
- One accent, mint, for chosen and measured things, never alone: a check, a filled mark, a heavier label go with it.
- Rounded, soft shapes from one scale (12 / 18 / 22 / 26 dp and pills).
- Every colour, space, corner, size, depth and motion comes from `Theme.kt` and `Motion.kt`.

## Colors

Graphite neutrals in tight tonal steps, achromatic ink in three levels, and one mint accent.

### Primary
- **Mint** (`Accent`, also named `Rule` where the construction axis draws it): what is chosen (the layer card, the view chip on screen, the menu's check) and what is measured (the done segments of the axis, the in-progress fill, the "now" tag, the saved percentage on the Etapy tile, the "Demo" badge). A preview is the mint as an OUTLINE (the hollow preview tag), never a fill.
- **Mint wash** (`AccentWash`): the quiet fill under a chosen card or chip, always with the 1.5 dp mint rim and a check.
- **Ink on mint** (`OnAccent` / `OnRule`): ticks and text on the mint (12:1).

### Neutral
- **Model background** (`PresentationLook.MODEL_BACKGROUND`): the 3D ground, a calm mid graphite a step lighter than the app's own ground, with a soft Compose vignette at the corners. The skybox input is #303740; Filament's tone curve (ACES legacy, now named explicitly in the view's `ColorGrading` so an upgrade cannot change it) draws it as ≈ #222B36 on screen (measured, round D). Until APK 1356 the input was #1E2329 and it rendered #0F141A — the house floated in a near-black void.
- **Selection in 3D** (`render/Selection`): the chosen element's own feature edges in mint (its faces pushed back one depth step so the edges draw over them), and a mint glow at about a sixth of its strength that keeps the element's light and shade. The box outline only for an element with no edges of its own (a pane). Until APK 1356 an emissive blue flattened it.
- **Contact shadow** (`presentation/ContactShadow`): eight stacked outlines of the ground-standing objects' convex hull, black at 7.2 % each, growing 0 → 1.4 m beyond it (denser near the wall): ≈ 45 % at the foot, nothing 1.4 m out. Presentation only, MODEL only, only while something that stands on the ground is shown.
- **Room floors** in MODEL: a neutral warm grey (#A7A196 at 22 %); teal read as the chosen-element mint.
- **Graphite Ground** (`Ground`): the places without the model (the analyzer task, the no-house state).
- **Raised / Sheet** (`Raised`, `Sheet`): opaque sheets that carry dense text — the house menu, the full tools sheet, the source sheet, the element details, dialogs.
- **Well** (`Well`): a translucent dark step under an open stage row inside a panel.
- **Hairline** (`Hairline`): 1 dp dividers.
- **Ink / Muted Ink / Faint Ink** (`Ink` 15:1, `InkMuted` 8:1, `InkFaint` 6:1 on the ground): text in three levels; Faint is metadata only. On the light resting glass of a tile or a pill, muted words take `InkMutedOnGlass` (#C3CBD4), a step brighter.
- **Rule Grey** (`RuleEmpty`): the outline of a stage not started, graduation ticks, an idle LineButton border.
- **Error** (`Error`): with the caution mark, never alone.

### Named Rules
**The Mint Means Chosen or Measured Rule.** The mint never marks an action, a focus or a link. A chosen thing is also a check, a filled mark or a heavier label.

**The Never Invented Rule.** With nothing saved, the Etapy tile says "Etapy / Nieustawione": no percentage, no stage, no date.

## Typography

Barlow for everything read and Barlow Condensed SemiBold with tabular figures (`Measure`) for measured figures only: one family in two widths (taste pass, APK 1358). Barlow is a low-contrast grotesk drawn from road and site signage — the lettering of a building site, the place this app is about — where Roboto was the face of every Android app. Material's scale is kept; titles take Barlow SemiBold, labels Medium, body Regular with a touch of tracking on the small roles. Labels on glass are titleSmall (tiles, pill), titleMedium (panel titles), bodyMedium (cards), labelLarge (chips). A measured figure stands after its name with no separator — the narrower face says it is a number ("Ściany 40%", the figure in mint).

### Named Rules
**The Plain Join Rule.** Facts are joined the way a sentence joins them — a comma, a full stop, a colon — never with a middle dot ("Z tyłu, bez dachu"; "Postęp wg etapów 2%. Zapisano …"). Dense diagnostic lists in the analyzer keep their dots.

**The Every maxLines Has An Ellipsis Rule.** Checked at font scale 1.3: the pill's name, the tile labels and the chips end in an ellipsis rather than wrap into the house.

## Layout

The workspace (`HouseWorkspace.kt`) is the root whenever a house exists.

- **Header (top, inside the safe area):** the house pill at the start (house icon, the short name — "Marcówki" for the showcase, from the scene registry's `showcase.short`, else the title — a discreet mint-wash badge "Demo" or "Galeria", a chevron; it opens the house menu), and at the end ONE glass capsule: "Dopasuj" (its glyph a frame, or a house once fitted — the second tap goes home) | ⋮. Under the pill, only when there is something to say, one status pill.
- **Dock (foot), by arithmetic (`DockLayout.of`):** a row of two equal shares, as wide as the window allows (440 dp at most), a function of the window alone — no label, open panel, selection or keyboard is an input, so nothing a tile shows can move a slot. "Widok" over the layer (or the named view: "Z tyłu · Bez dachu") and "Etapy" over "40% · Ściany" (the figure first, so an ellipsis cuts the name, never the number), "Ostatni: Dach" or "Nieustawione"; while a stage is previewed, the hollow preview mark, "Podgląd" over the stage's name, and a 48 dp × that returns.
- **Panels:** both open in the dock's own column, their foot just above the dock: upright at most 62 % of the height, so the house stays in view; the tile leaves its slot, the other tile stays. On a phone on its side (under 480 dp tall AND at least 600 dp wide) the dock and its panels are a column at the start, a panel as tall as the column under the header, and the house is framed BESIDE the column, at rest and with a panel open alike. A short, narrow window keeps the upright dock. The keyboard lifts only the open panel; the dock, the frame and the house ignore it.
- **Context pieces:** the chosen element's pill above the dock (name, storey, the way to its details, ×); the gesture hint once at the first start; the details in a sheet from the foot (a side panel on a phone on its side). While the details sheet stands upright, the dock steps aside under it.
- **Framing:** the camera frames the house in what the resting chrome leaves free (under the header, above the dock — or beside the column on its side), computed by arithmetic so it is right in the first frame; opening or closing a panel never moves it; an element's details ease the frame once to their final size (measured by size, not by where the sliding sheet stands). The whole house is fitted by the corners of each object's own box, CENTRED by moving the focus until the projected extent is symmetric — an L-shaped house's empty box corner (a rear terrace, a garage wing) no longer pushes it small and aside. The parallel views keep their box fit (identical for axis-aligned views).
- **Grid:** the one-metre reference grid is a view setting in the menu ("Siatka pod domem"), off at the start, remembered on the phone.

## Elevation & Depth

**Matte glass, honestly.** Every piece of chrome over the 3D is `GlassSurface` / `Modifier.matteGlass`: a soft depth drawn OUTSIDE the shape only (eight rings of falling alpha, offset a little downwards; `Depth.tile` 6 dp growing to `Depth.panel` 16 dp with the morph), a 2 dp contact hairline just outside the edge (`GlassContact`), a translucent graphite tint (`Glass` 88 %; a panel thickens to `GlassDense` as it grows), a diagonal sheen from the top start (`GlassSheen`), a fixed seeded grain tile (7 % alpha) that makes the tint read as frosted, and a rim with a bevel over the top 24 dp (`GlassRimHigh` → transparent). A fade of glass (the chrome stepping back) modulates the drawing's alpha instead of compositing it offscreen, so the depth outside the edge is never clipped mid-fade.

**What it is not: a backdrop blur.** The model is drawn by Filament into its own `SurfaceView`, a separate layer composited by the system below the window. Compose's `Modifier.blur` blurs only the window's own content, and the window cannot sample the surface beneath it; a true blur would need the scene drawn twice or read back from the GPU every frame, and neither is done. The glass is static: its grain is one cached bitmap, and it is redrawn only when the glass itself changes. No animation runs at rest.

### Named Rules
**The One Layer Rule.** Glass is a one-layer material: two tints stacked never reach cover. A popup over glass (the ⋮ menu) takes `GlassOpaque`; dense lists live in opaque sheets.

**The Solid to the Finger Rule.** Every surface over the model takes `Modifier.solidToFinger()` first: it takes part in hit testing over its whole area without consuming anything, so a touch on glass never orbits the camera or picks a wall behind a label. The morphing glass is solid over exactly its current rectangle, and nothing outside it is; the 3D left uncovered stays live.

## Shapes

Soft and rounded, from one scale: `tick` 2 dp (axis segments and marks), `control` 12 dp (buttons, layer cards), `tile` 18 dp (dock tiles, status and selection pills), `panel` 22 dp (open panels), `sheet` 26 dp (modal sheets, rounded on the edge they rise from), `pill` (the house pill, header buttons, view chips, badges). The morph interpolates the corner from `tile` to `panel`, never past half the shorter side. Icons (`ShellIcons`) are 24 dp outlines at one 1.75 stroke with round caps, including the layer marks (house, roof off, ground floor, attic), the grid and ⋮.

## Motion

One policy (`MotionPolicy`, read through `LocalMotionPolicy`).

- **The morph (round D).** A dock tile and its panel are one `MorphSurface` on a staged path: LIFT — the tile rises straight up in its own column, its size unchanged, until its foot stands above the dock; GROW — with the foot fixed there, it widens to the column and grows upward into the panel. The two overlap a little, so it is one gesture, and the glass never crosses the other tile (a unit test sweeps every window). Position, size, corner, tint and depth follow; integer edges, so the rim never shimmers. The tile's words are gone by 20 % of the way; the panel's arrive only once the glass has grown 93 % — pinned where they will stand, so they are never seen cut by a moving edge — and take touches and TalkBack only from 95 %. Critically damped springs (stiffness 650 open, 900 close, no overshoot) carry their speed through a reversal. Switching panels sends the open one home and starts the other once it is within 6 % of home. The progress is read only in layout and draw: a frame of the morph recomposes nothing. The selection pill and the hint step aside in 90 ms before a glass grows.
- **The idle turntable (opt-in, "Obracaj dom, gdy go nie dotykam").** Off unless chosen; remembered. After 5 s untouched the camera settles (700 ms) where the whole house stays in view at every angle — about the centre of the smallest circle round the house in plan, never nearer than the owner stood — and turns at 6°/s with a 1.6 s ease in; after 5 minutes it eases out and holds. It starts only from a whole-house view (not a close-up, a pan, an isolated or a selected element; the menu then says "Ruszy z widoku całego domu"). It never runs with a panel, a sheet, details or the menu open, under a finger, during a glide, with animations off, under TalkBack, in battery saver, on a warm phone or with nothing standing; the menu row says which. It draws at most 30 frames a second and asks the display for 30 Hz. The touch that stops it only stops it (no selection, not half of a double tap). After 6 s of turning the chrome fades to 20 % (showroom); the first touch anywhere only wakes it.
- **The glide.** A one-finger turn released while still moving glides on and comes to rest (τ 220 ms; starts above 30°/s, capped at 360°/s, vertical at 35 %); exact per frame, so the frame rate does not change where it stops. Never with animations off; any touch, preset or framing stops it.
- **The camera.** A pinch zooms toward the fingers (the point under them stays under them); a double tap beside the house is "Dopasuj"; the pitch stops 10° below level. The arrival shot plays once per house per process.
- **Elsewhere:** enter 220 ms, exit 150 ms, quick exit 90 ms, settle 180 ms, recede 160 ms (the header and resting tiles fade to 18 % while a finger turns the model); `enterDelayed` when one dense line replaces another. Cards and chips dip to 96 % while pressed (a layer scale: nothing beside them moves).
- **Animations off.** With `ANIMATOR_DURATION_SCALE = 0` every morph snaps and every transition is a cut (Compose ignores the setting by itself, so `rememberSystemMotionPolicy` reads it live).
- **The 3D at rest draws nothing new.** Since APK 1356 the Filament canvas submits a frame only when the camera, the viewer state, the surface or a pick changed (plus two settle frames for pacing); a step of the idle turn asks for one frame only. An idle house keeps its last frame on the surface, now at full resolution (dynamic resolution off since round D: the last frame of a burst no longer keeps a soft, reduced scale). The sun's shadow map is not warped by the view (LiSPSM off, 2048), so shadows do not crawl as the house turns.

## Components

### House pill
48 dp glass pill; the short name in titleSmall with an ellipsis; the badge is labelMedium mint on a mint wash ("Demo" for the showcase, "Galeria" for a developer-gallery scene, none for a house from a link). The kind ("Model demonstracyjny", …) is its `stateDescription`; the full name stands in the house menu.

### Header buttons
One glass capsule with two 48 dp targets and a faint divider. "Dopasuj" is two-stage like a map's location button: the first tap fits what is shown at the current angle (only the shown part when a layer or a stage hides some), the next goes home — every layer, the whole-house perspective; its glyph says which. ⋮ is a `DropdownMenu` on `GlassOpaque`: "Wygląd modelu" (the looks, chosen in place, the menu stays open), "Obracaj dom, gdy go nie dotykam" and "Siatka pod domem" (switches: a mint check when on, the word "wyłączone" when off; a second line says why a chosen turntable is held), "Wszystkie narzędzia" (the full tools sheet), "Źródło modelu i analiza".

### Dock tiles
56 dp glass tiles with `tile` corners, two equal shares of the dock; the whole tile is the button (role Button, `onClickLabel`, the state in `stateDescription`). A caption over a state; a 14 dp chevron beside the caption says it opens upward; the Etapy tile's percentage is mint Barlow, first, only when saved. The state cross-fades in place; the size never changes. In preview the tile's × is its own 48 dp target.

### Widok panel
Head outside the scroll (mark, titleMedium "Widok", ×). "Co widać": the four layers as cards in one row (a selectable group): mark and name; chosen = mint wash, 1.5 dp mint rim, mint mark, semibold label and a mint check. Under them one fixed 48 dp line: what the chosen layer leaves out, in words from the filter itself, with "Pokaż wszystko". "Skąd patrzysz" with the view on screen at the end, then one always-visible, sideways-scrolling row of view chips (Perspektywa, Z przodu, Z tyłu, Z lewej, Z prawej, Dach z góry, Rzut parteru, Rzut poddasza, Aksonometria) with a fade at the cut end. A layer choice keeps the panel open (compare layers in place); a view choice closes it, because the answer is the house. A level parallel view (an elevation) gets a faint ground line, fading in over the last 5° to level. The rest stays in the full tools sheet.

### Etapy panel
Opens LOW, axis first, so the house it rewinds stays in view: head ("Etapy budowy", "Postęp wg etapów 2% · Zapisano …" or "Postęp nieustawiony"), the construction axis (52 dp, mint; a drag at the screen's edge is the axis's, not Back), one fixed 52 dp line that says what the 3D shows, and one row: "Odtwórz budowę" (plays the stages that change the house, 750 ms each, then back; any scrub, the list or closing the panel ends it where it was) and "Ustaw etap budowy" / "Lista etapów (17)". In a short window that body scrolls. The list (`StagesScreen(compact = true)`) opens on request and folds when a stage is previewed. A stage in progress offers "Zakończ i zacznij: <next>" (one deliberate action) and "Oznacz jako zakończony"; completion by quick chips 0/25/50/75/100 and −5 / +5 against a draft (kept across scroll and rotation), saved only by "Zapisz NN%" and put back by "Anuluj"; a kept save ticks once under the finger.

### The construction axis (folding rule)
Done: solid mint. In progress: mint outline filled to its completion. Not started: RuleEmpty outline. The solid tag marks NOW; a hollow tag with a hairline marks the PREVIEW. Scrubbing snaps stop by stop, moves only the preview and never changes saved progress; TalkBack reads it as an adjustable control.

### Buttons
`InkButton` (filled Ink, Ground text, 12 dp corners, 48 dp), `LineButton` (1 dp outline, Ink text), `QuietAction` (text only). Actions are ink, never mint.

### Sheets over the house
Opaque `Sheet` with 26 dp top corners on a scrim, no drag pill: the house menu (houses, "Dodaj dom z linku", Etapy budowy — which opens the Etapy panel —, the source, the named cost boundary, the developer gallery), the full tools sheet, the source sheet, the developer gallery.

## Do's and Don'ts

### Do:
- **Do** take every colour, space, corner, size, depth and motion value from `Theme.kt` / `Motion.kt`.
- **Do** keep the house the screen: frame it by the chrome at rest, centred, and never move the camera when a panel opens.
- **Do** grow a panel out of the tile that opened it, as one surface, and close it back into the same slot.
- **Do** say every state as a mark and a word (`stateDescription` on merged nodes), with mint only for chosen or measured things.
- **Do** keep panel heads and the one way out outside the scroll, and fade a cut list or row.
- **Do** check at font scale 1.3, with animations off, upright and on the side, and with the 3D uncovered still turning under a finger.
- **Do** derive the dock, the panel frames and the chrome's footprint from the window alone (`DockLayout.of`, arithmetic insets), never from a label, a measured child or the keyboard.
- **Do** end every way out of the idle turn the same way (the turn stops, the chrome comes back).
- **Do** keep every touch target at least 48 dp, and every `maxLines` with an ellipsis.

### Don't:
- **Don't** bring back the side rail, the permanent timeline panel, a navigation bar or a vertical axis.
- **Don't** stack translucent glass, or let a panel cover almost the whole screen on its side.
- **Don't** claim a backdrop blur, sample the 3D surface or read it back from the GPU.
- **Don't** run an animation loop at rest, or redraw the 3D when nothing changed — and don't fake it with a static picture. The opt-in turntable is the one exception, and it holds for every reason listed under Motion.
- **Don't** let a tile's state, a pill or the keyboard change the size or place of anything else.
- **Don't** show an invented percentage, stage or date when nothing is saved; a preview never saves.
- **Don't** expose a dead or unfinished feature as a main action; keep the full tools one tap away in the menu.
- **Don't** let the UI own semantic truth: layers come from the filter, views from the presets, stages from the session.
