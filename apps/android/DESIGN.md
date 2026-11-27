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
  Glass: "#1A2027D0"
  GlassDense: "#1A2027EB"
  GlassSheen: "#FFFFFF14"
  GlassOpaque: "#161B21F2"
  GlassRimHigh: "#FFFFFF38"
  GlassRimLow: "#FFFFFF0A"
  GlassShadow: "#000000CC"
  Scrim: "#05060A"
  ModelBackground: "#1E2329"
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
  tile: "10dp"
  panel: "18dp"
motion:
  morphOpen: "280ms emphasized-decelerate, scaled by the distance left"
  morphClose: "220ms standard, scaled by the distance left"
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
    border: "1dp Accent 70%"
    shape: "pill"
    typography: "labelMedium"
  dock-tile:
    background: "Glass"
    shape: "tile"
    height: "56dp"
    content: "icon, state label (titleSmall), chevron / percentage / preview mark + return"
  dock-panel:
    background: "Glass → GlassDense (follows the morph)"
    shape: "panel"
    maxShare: "62% of the workspace height upright; beside the dock on a phone on its side"
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

**Creative North Star: "Minimalny dok" (OWNER's choice, variant C, APK 1356)**

The house is the screen. The model stands large and centred on a calm graphite ground, edge to edge, and the only chrome over it is a handful of small floating pieces of smoky matte glass: the house pill at the top start, "Dopasuj" and the menu at the top end, and a dock of two tiles at the foot — a wider "Cały dom" that names the layer shown now, and "Etapy". Each tile grows, as the very same piece of glass, into its own panel (Warstwy, Etapy) and shrinks back into its slot. Nothing else is permanent. Words are achromatic ink; one accent, mint, marks what is chosen or measured, always beside a mark or a word.

This direction replaces the former "Folding Rule" system and its bans (no pills, no shadows, a side rail, a bottom timeline panel). The folding rule survives as the construction axis inside the Etapy panel, now in mint; it is no longer the frame of the screen.

Confirmed rejections, from the owner's briefs: a permanent side rail, a permanent large progress panel, a full navigation bar (variant A), a vertical axis (variant B), a permanent CAD grid, card-heavy dashboards, stacked translucent panels, and dead features shown as main actions.

**Key Characteristics:**
- The house fills most of the width upright and stays centred; the camera frames it in what the chrome leaves free AT REST.
- Two dock tiles; each morphs into its panel. One panel at a time; the other tile stays where it is.
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
- **Model background** (`PresentationLook.MODEL_BACKGROUND`, #1E2329): the 3D ground, a calm mid graphite a step lighter than the app's own ground, with a soft Compose vignette at the corners. Until APK 1355 it was #12151A.
- **Graphite Ground** (`Ground`): the places without the model (the analyzer task, the no-house state).
- **Raised / Sheet** (`Raised`, `Sheet`): opaque sheets that carry dense text — the house menu, the full tools sheet, the source sheet, the element details, dialogs.
- **Well** (`Well`): a translucent dark step under an open stage row inside a panel.
- **Hairline** (`Hairline`): 1 dp dividers.
- **Ink / Muted Ink / Faint Ink** (`Ink` 15:1, `InkMuted` 8:1, `InkFaint` 6:1 on the ground): text in three levels; Faint is metadata only.
- **Rule Grey** (`RuleEmpty`): the outline of a stage not started, graduation ticks, an idle LineButton border.
- **Error** (`Error`): with the caution mark, never alone.

### Named Rules
**The Mint Means Chosen or Measured Rule.** The mint never marks an action, a focus or a link. A chosen thing is also a check, a filled mark or a heavier label.

**The Never Invented Rule.** With nothing saved, the Etapy tile says "Etapy" and nothing else: no percentage, no stage, no date.

## Typography

Roboto (Material's scale, calmer tracking on the small roles) for everything read; Barlow Condensed SemiBold with tabular figures (`Measure`) for measured figures only (the percentage on the Etapy tile and in the stage editor). Labels on glass are titleSmall (tiles, pill), titleMedium (panel titles), bodyMedium (cards), labelLarge (chips).

### Named Rules
**The Every maxLines Has An Ellipsis Rule.** Checked at font scale 1.3: the pill's name, the tile labels and the chips end in an ellipsis rather than wrap into the house.

## Layout

The workspace (`HouseWorkspace.kt`) is the root whenever a house exists.

- **Header (top, inside the safe area, 8 dp gutter):** the house pill at the start (house icon, the short name — "Marcówki" for the showcase, from the scene registry's `showcase.short`, else the title — a discreet badge "Demo" or "Galeria", a chevron; it opens the house menu), and at the end two 48 dp glass buttons, "Dopasuj" and the menu (⋮). Under the pill, only when there is something to say, one status pill (a new house ready, an analysis running or failed, a limited or partial model, a gallery scene with the way back to the showcase).
- **Dock (foot):** the layers tile (at least 156 dp, at most 55 % of the row; it names the layer shown now: "Cały dom", "Bez dachu", "Parter", "Poddasze", "Tylko: …") and the Etapy tile ("Etapy", plus the saved percentage only when saved; while a stage is previewed, the hollow preview mark, "Podgląd" over the stage's name, and a 48 dp × that returns to the design or the saved state).
- **Panels:** upright, a panel opens above the dock across the dock's width (at most 440 dp) and at most 62 % of the workspace's height, so the top of the house stays in view; the tile it came from leaves its slot, the other tile stays. On a phone on its side (under 480 dp tall) a panel opens beside the dock, bottom-aligned, at most 400 dp wide and as tall as the space under the header — never across the short screen.
- **Context pieces:** the chosen element's pill above the dock (name, storey, the way to its details, ×); the gesture hint once at the first start; the details in a sheet from the foot (a side panel on a phone on its side). While the details sheet stands upright, the dock steps aside under it.
- **Framing:** the camera frames the house in what the resting chrome leaves free (under the header, above the dock); opening or closing a panel never moves it. The whole house is fitted by the corners of each object's own box, CENTRED by moving the focus until the projected extent is symmetric — an L-shaped house's empty box corner (a rear terrace, a garage wing) no longer pushes it small and aside. The parallel views keep their box fit (identical for axis-aligned views).
- **Grid:** the one-metre reference grid is a view setting in the menu ("Siatka pod domem"), off at the start, remembered on the phone.

## Elevation & Depth

**Matte glass, honestly.** Every piece of chrome over the 3D is `GlassSurface` / `Modifier.matteGlass`: a soft depth drawn OUTSIDE the shape only (eight rings of falling alpha, offset a little downwards, so the shadow never darkens the glass itself), a translucent graphite tint (`Glass`; a panel thickens to `GlassDense` as it grows, read at draw time from the morph's progress), a sheen across the top half (`GlassSheen`), a fixed seeded grain tile (96 px, 5 % alpha) that makes the tint read as frosted, and a 1 dp rim brighter at the top (`GlassRimHigh` → `GlassRimLow`).

**What it is not: a backdrop blur.** The model is drawn by Filament into its own `SurfaceView`, a separate layer composited by the system below the window. Compose's `Modifier.blur` blurs only the window's own content, and the window cannot sample the surface beneath it; a true blur would need the scene drawn twice or read back from the GPU every frame, and neither is done. The glass is static: its grain is one cached bitmap, and it is redrawn only when the glass itself changes. No animation runs at rest.

### Named Rules
**The One Layer Rule.** Glass is a one-layer material: two tints stacked never reach cover. A popup over glass (the ⋮ menu) takes `GlassOpaque`; dense lists live in opaque sheets.

**The Solid to the Finger Rule.** Every surface over the model takes `Modifier.solidToFinger()` first: it takes part in hit testing over its whole area without consuming anything, so a touch on glass never orbits the camera or picks a wall behind a label. The morphing glass is solid over exactly its current rectangle, and nothing outside it is; the 3D left uncovered stays live.

## Shapes

Soft and rounded, from one scale: `tick` 2 dp (axis segments and marks), `control` 12 dp (buttons, layer cards), `tile` 18 dp (dock tiles, status and selection pills), `panel` 22 dp (open panels), `sheet` 26 dp (modal sheets, rounded on the edge they rise from), `pill` (the house pill, header buttons, view chips, badges). The morph interpolates the corner from `tile` to `panel`, never past half the shorter side. Icons (`ShellIcons`) are 24 dp outlines at one 1.75 stroke with round caps, including the layer marks (house, roof off, ground floor, attic), the grid and ⋮.

## Motion

One policy (`MotionPolicy`, read through `LocalMotionPolicy`).

- **The morph.** A dock tile and its panel are one `MorphSurface`: position, size, corner radius and tint interpolate together from the tile's measured slot to the panel's frame, the tile's words fade out by 30 % of the way and the panel's fade in (rising 8 dp) from 30 %, so two texts never share the glass. Open 280 ms, emphasized decelerate; close 220 ms, standard; no overshoot. Each step starts from wherever the glass is and takes only the share of time left, so a second tap mid-way turns it round at once. Switching panels closes the open one into its slot first, then grows the other. The rectangles are re-read on every layout, so a window that turns or changes width mid-morph moves the glass with it. The progress is read only in layout and draw: a frame of the morph re-lays out one node and recomposes nothing.
- **Elsewhere:** enter 220 ms, exit 150 ms, settle 180 ms, recede 160 ms (the header and resting tiles fade to 18 % while a finger turns the model); `enterDelayed` when one dense line replaces another.
- **Animations off.** With `ANIMATOR_DURATION_SCALE = 0` every morph snaps and every transition is a cut (Compose ignores the setting by itself, so `rememberSystemMotionPolicy` reads it live).
- **The 3D at rest draws nothing new.** Since APK 1356 the Filament canvas submits a frame only when the camera, the viewer state, the surface or a pick changed (plus two settle frames for pacing); an idle house keeps its last frame on the surface. The per-vsync callback stays (it is what notices a change), and nothing is faked: any change redraws at once.

## Components

### House pill
48 dp glass pill; the short name in titleSmall with an ellipsis; the badge is labelMedium mint in a 1 dp mint outline ("Demo" for the showcase, "Galeria" for a developer-gallery scene, none for a house from a link). The kind ("Model demonstracyjny", …) is its `stateDescription`; the full name stands in the house menu.

### Header buttons
48 dp round glass buttons: "Dopasuj" (the fit preset; it keeps the angle) and ⋮, a `DropdownMenu` on `GlassOpaque` with 18 dp corners: "Siatka pod domem" (a check when on, the word "wyłączona" when off), "Wszystkie widoki, warstwy i wygląd" (the full tools sheet), "Źródło modelu i analiza".

### Dock tiles
56 dp glass tiles with `tile` corners; the whole tile is the button (role Button, `onClickLabel`, the state in `stateDescription`). A chevron on the layers tile says it opens; the Etapy tile's percentage is mint Barlow, only when saved. In preview the tile's × is its own 48 dp target.

### Warstwy panel
Head outside the scroll (layers mark, titleMedium "Warstwy", ×). The four layers as cards in a 2 × 2 grid (one row of four only when the panel itself is at least 520 dp wide): mark and name; chosen = mint wash, 1.5 dp mint rim, mint mark, semibold label and a mint check. Under them, what the chosen layer leaves out, in words taken from the filter itself (true for any building), and "Pokaż wszystko" when anything is left out. Then the Widok row — "Widok · Perspektywa ⌄" — which names the view on screen (or "Własny kąt" once the camera was turned by hand) and unfolds one sideways-scrolling row of view chips (Perspektywa, Z przodu, Z tyłu, Z lewej, Z prawej, Dach z góry, Aksonometria) with a fade at the cut end. A layer choice keeps the panel open (its line is the answer); a view choice closes it, because the answer is the house, which the panel would cover. "Przekrój", isolation, the element list, the plans, the places, zoom, reset and the looks stay in the full tools sheet.

### Etapy panel
Head outside the scroll (the axis mark, "Etapy budowy", and the saved line: "2% · Zapisano 27 listopada 2026", or "Postęp nieustawiony"), the construction axis (the folding rule, 52 dp, mint), one line that says what the 3D shows (the design with nothing saved; "Teraz: Ściany · Etap w toku · 40%"; or, while previewing, the preview mark, "Podgląd: Fundamenty", "Tylko podgląd — nic się nie zapisuje." and "Wróć do projektu" / "Wróć do teraz"), then the stages list (`StagesScreen(compact = true)`), each stage opening in place. The axis drags sideways and the list scrolls up and down, so scrolling never moves the axis. Completion is edited by −5 / +5 steps against a draft that shows the saved value beside it, saved only by "Zapisz NN%" and put back by "Cofnij" — no slider in a scrolling list. A gallery scene's panel says that no progress is recorded there.

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
- **Do** keep every touch target at least 48 dp, and every `maxLines` with an ellipsis.

### Don't:
- **Don't** bring back the side rail, the permanent timeline panel, a navigation bar or a vertical axis.
- **Don't** stack translucent glass, or let a panel cover almost the whole screen on its side.
- **Don't** claim a backdrop blur, sample the 3D surface or read it back from the GPU.
- **Don't** run an animation loop at rest, or redraw the 3D when nothing changed — and don't fake it with a static picture.
- **Don't** show an invented percentage, stage or date when nothing is saved; a preview never saves.
- **Don't** expose a dead or unfinished feature as a main action; keep the full tools one tap away in the menu.
- **Don't** let the UI own semantic truth: layers come from the filter, views from the presets, stages from the session.
