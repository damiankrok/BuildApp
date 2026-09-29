---
name: BuildPlan
description: The owner's own record of one house under construction, read on a carpenter's folding rule under the house's 3D model.
colors:
  Ground: "#101419"
  Raised: "#161B21"
  Sheet: "#1B2128"
  Well: "#0A0D11"
  Hairline: "#2A313A"
  Ink: "#E8EBEF"
  InkMuted: "#A7B0BC"
  InkFaint: "#8A94A0"
  RuleEmpty: "#6B7581"
  Rule: "#F2C230"
  OnRule: "#15120A"
  Error: "#EF8A7E"
  Glass: "#101419E6"
  GlassOpaque: "#14181E"
  GlassRimHigh: "#FFFFFF24"
  GlassRimLow: "#FFFFFF08"
  Scrim: "#05060A"
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
  control: "6dp"
  panel: "8dp"
  sheet: "12dp"
spacing:
  xxs: "2dp"
  xs: "4dp"
  s: "8dp"
  m: "12dp"
  l: "16dp"
  xl: "24dp"
  xxl: "32dp"
  xxxl: "48dp"
components:
  ink-button:
    backgroundColor: "{colors.Ink}"
    textColor: "{colors.Ground}"
    typography: "{typography.labelLarge}"
    rounded: "{rounded.control}"
    padding: "8dp 16dp"
    height: "48dp"
  line-button:
    backgroundColor: "transparent"
    textColor: "{colors.Ink}"
    typography: "{typography.labelLarge}"
    rounded: "{rounded.control}"
    padding: "8dp 16dp"
    height: "48dp"
  quiet-action:
    backgroundColor: "transparent"
    textColor: "{colors.InkMuted}"
    typography: "{typography.labelLarge}"
    padding: "4dp 0dp"
    height: "48dp"
  glass-surface:
    backgroundColor: "{colors.Glass}"
    textColor: "{colors.Ink}"
    rounded: "{rounded.panel}"
  glass-surface-over-chrome:
    backgroundColor: "{colors.GlassOpaque}"
    textColor: "{colors.Ink}"
    rounded: "{rounded.panel}"
  panel-header:
    textColor: "{colors.Ink}"
    typography: "{typography.titleSmall}"
    padding: "4dp 4dp 0dp 16dp"
    height: "48dp"
  panel-option:
    textColor: "{colors.Ink}"
    typography: "{typography.bodyMedium}"
    padding: "4dp 16dp"
    height: "48dp"
  panel-group-label:
    textColor: "{colors.InkMuted}"
    typography: "{typography.labelMedium}"
    padding: "12dp 16dp 2dp 16dp"
  section-heading:
    textColor: "{colors.Ink}"
    typography: "{typography.titleMedium}"
    padding: "24dp 0dp 8dp 0dp"
  folding-rule:
    backgroundColor: "{colors.Rule}"
    textColor: "{colors.InkFaint}"
    typography: "{typography.measureNumeral}"
    rounded: "{rounded.tick}"
    height: "52dp"
  folding-rule-static:
    height: "40dp"
  stage-mark:
    backgroundColor: "{colors.Rule}"
    width: "18dp"
    height: "8dp"
  timeline-rail:
    backgroundColor: "{colors.Glass}"
    textColor: "{colors.Ink}"
    rounded: "{rounded.sheet}"
  stage-strip-item:
    backgroundColor: "transparent"
    textColor: "{colors.Ink}"
    typography: "{typography.labelLarge}"
    rounded: "{rounded.control}"
    padding: "8dp 12dp"
    height: "56dp"
  stage-strip-item-selected:
    backgroundColor: "{colors.Well}"
  tool-rail-button:
    backgroundColor: "transparent"
    textColor: "{colors.InkMuted}"
    typography: "{typography.labelSmall}"
    rounded: "{rounded.control}"
    width: "64dp"
    height: "60dp"
  tool-rail-button-pressed:
    backgroundColor: "{colors.Well}"
    textColor: "{colors.Ink}"
  tool-pane:
    backgroundColor: "{colors.GlassOpaque}"
    rounded: "{rounded.panel}"
    width: "236dp"
  inspector-sheet:
    backgroundColor: "{colors.Sheet}"
    textColor: "{colors.Ink}"
    rounded: "{rounded.sheet}"
  house-menu-row:
    backgroundColor: "transparent"
    textColor: "{colors.Ink}"
    typography: "{typography.bodyLarge}"
    padding: "8dp 16dp"
    height: "56dp"
  house-menu-row-current:
    backgroundColor: "{colors.Well}"
  status-row:
    backgroundColor: "transparent"
    textColor: "{colors.Ink}"
    typography: "{typography.bodySmall}"
    padding: "0dp 8dp 0dp 12dp"
    height: "48dp"
---

# Design System: BuildPlan

## Overview

**Creative North Star: "The Folding Rule"**

Construction progress is a measure, and the app reads it the way a builder does: on a carpenter's folding rule (miarka składana). The build's stages are its hinged segments, unfolded as far as the build has got, lying under the house. A graphite night ground carries the house; the chrome over the model is a translucent graphite tint rather than an opaque slab; every word is achromatic ink; and a single accent, rule yellow, means measured construction progress and nothing else. A look back in time wears the same yellow as an outline, never a fill, so a preview can never pass for the state of the build.

The system is dark-first, model-first and technical but calm. Since INTEGRATION-004A the house is the root: the model edge to edge with four compact layers of chrome and one contextual sheet at a time; the stages are a ruled list in a sheet over it; the inked line drawing of the house and the monumental figure live on the source sheet and the stage sheet. Hierarchy is carried by type size, weight and ink level rather than by enclosing cards. Density is modest and every control is a 48 dp target, because the owner checks the build one-handed on the plot as often as at home in the evening. Motion explains continuity (a pane growing from the rail button that opened it, the rule's cursor settling on a stop) and disappears entirely when the system animator scale is zero.

Confirmed rejections, from the owner's brief: card-heavy dashboards, a giant rounded model card, stacked rectangular panels around the 3D, a debug-tool feel, and large dead cards for unfinished places.

**Key Characteristics:**
- One accent (rule yellow) with one meaning: measured progress.
- Actions are ink; a filled button is near-white on graphite, never yellow.
- State is always a shape and a word as well as a colour.
- Glass is a one-layer material; chrome over chrome is opaque.
- Rectilinear corners from a four-step scale (2 / 6 / 8 / 12 dp); no pills.
- A condensed tabular face for measured figures only; Roboto for everything read.
- Every colour, space, corner and type role comes from `Theme.kt`.

## Colors

Graphite neutrals in tight tonal steps, achromatic ink in three levels, and one saturated yellow reserved for the measure.

### Primary
- **Rule Yellow** (`Rule`): measured progress and nothing else. The done segments of the folding rule, the filled part of the stage in progress, the solid "now" tag, the hollow preview tag and its hairline, the done/in-progress `StageMark`, the part of the house line drawing the current stage adds, and the completion slider in the stage sheet (which edits that measure). Material's `tertiary` is mapped to it, so no stock component may be left on a tertiary default.
- **Ink on Rule** (`OnRule`): text or ticks placed on the yellow (11:1).

### Neutral
- **Graphite Ground** (`Ground`): the app's ground on the sheets, the analyzer task and the no-house state. The 3D backdrop is the renderer's own, deliberately darker, so the model's ground is the darkest thing on screen.
- **Raised Graphite** (`Raised`): one step up; text fields, the open stage row in the stage sheet.
- **Sheet Graphite** (`Sheet`): opaque sheets that carry dense text: the element inspector, the house switcher, dialogs, the snackbar.
- **Well** (`Well`): the darkest step, a control pressed into its rail (active tool, selected place, selected strip stop, current house in the switcher).
- **Hairline** (`Hairline`): 1 dp dividers, the rail and bar edges, the completion and progress tracks.
- **Ink** (`Ink`): text, icons in the active state, filled action buttons, and the lines of the built part of the house (15.6:1).
- **Muted Ink** (`InkMuted`): secondary text, idle icons and labels, the design's end cap on the rule (8.4:1).
- **Faint Ink** (`InkFaint`): metadata only (dates, stage numerals, disabled labels; 6:1). Never a label a person must read to act.
- **Rule Grey** (`RuleEmpty`): the outline of a stage not started, graduation ticks, unchosen option rings, the idle LineButton border (3.9:1, a graphic that must be seen).
- **Error Coral** (`Error`): the caution mark of a problem line and failed analysis states; always beside words, never alone.
- **Glass** (`Glass`, 90 % Ground): the tint of chrome floating over the model. **Glass Opaque** (`GlassOpaque`) is the tint of a pane over another pane. **Glass Rim** (`GlassRimHigh` to `GlassRimLow`): the 1 dp vertical gradient rim that catches light on a pane's top edge.
- **Scrim** (`Scrim`): the shade settling the model's top edge under the status bar (at 55 %) and behind the navigation bar (60 %).

`Theme.kt` also fills Material's container slots (`primaryContainer` / `secondaryContainer` #262D36, `tertiaryContainer` #3A3218, `surfaceBright` #232A33, `surfaceContainerHighest` #222932, `errorContainer` #3A1D19, `onError` #1C0B08) so stock components never fall back to Material lavender. They are scheme plumbing, not tokens to draw with.

### Named Rules
**The One Meaning Rule.** Rule yellow means measured construction progress. It is never an action, a selection, a focus ring, a link or a decoration. "Wróć do teraz" and "Ustaw postęp" are ink outlines because they are actions.

**The Outline Is a Look Back Rule.** The actual state is solid; a preview is the same yellow hollow. A preview may never be drawn filled, and the actual state is repeated at the top of the screen while previewing, never replaced.

**The Achromatic Text Rule.** Text is Ink, InkMuted or InkFaint. Colour never carries a sentence.

## Typography

**Display Font:** Barlow Condensed SemiBold (bundled, `res/font/barlow_condensed_semibold.ttf`), tabular numerals
**Body Font:** Roboto (the platform face through Material's type scale)

**Character:** The rule's own face, narrow and engineered, speaks only in measured figures; Roboto carries every word the owner reads, set at Material's scale with semibold titles and calmer tracking on the small roles.

### Hierarchy
- **Measure / monumental** (600, 64sp, line 64sp, -0.01em, tnum): the one monumental figure in the app, "Postęp wg etapów" (the stage sheet's header, scaled).
- **Measure / inline** (600, 20sp, line 22sp, tnum): a measured value inside a line of chrome ("43%" in the timeline, stage completion in the stage sheet; the sheet's header scales it by 1.4).
- **Measure / numeral** (600, 13sp, line 14sp, tnum): stage numbers and the rule's graduation numerals.
- **Headline** (headlineSmall, 600, 24sp): a screen's title ("Etapy budowy" on the stage sheet, the no-house state).
- **Title** (titleLarge / titleMedium / titleSmall, 600, 22 / 16 / 14sp, 0 tracking): section headings, the current stage, pane titles and the 3D context title.
- **Body** (bodyLarge / bodyMedium / bodySmall, 400, 16 / 14 / 12sp): stage names, rows and values; bodySmall is the workhorse for second lines. Content columns stop at 720 dp (`Sizes.contentMax`, 560 dp on empty places).
- **Label** (labelLarge / labelMedium / labelSmall, 500, 14 / 12 / 11sp, +0.01 to +0.02em, sentence case): button text, group labels, navigation and rail labels.

### Named Rules
**The Measured Face Rule.** Barlow Condensed is for measured figures only (percentages, stage numbers, graduations). A word set in it is a mistake.

**The One Monument Rule.** There is one 64sp figure in the app, and it is progress by stages. No other number competes with it.

**The Sentence Case Rule.** Labels are sentence case and in Polish from `strings.xml`. Group names are muted headings for the rows below them, not uppercase eyebrows above a title.

## Layout

A single column on the phone, centred at a readable measure (max 720 dp) on wide windows, never stretched. Spacing comes from one scale (2 / 4 / 8 / 12 / 16 / 24 / 32 / 48 dp) with more space above a heading than below it (`SectionHeading`: 24 dp above, 8 dp below). Screen gutters and pane insets are 16 dp.

The shell is the house workspace (INTEGRATION-004A, the OWNER's house-first override): no navigation bar, no page beside the house. Its chrome has four layers, each only as large as its job: a compact context top-left (the house menu button, the house name, the actual state, and a status row only when there is something to say), the labelled tool rail on the right edge with its 236 dp pane growing to its left, the timeline at the foot whose header opens the stage sheet, and, one at a time, a contextual surface: with a selection, the element's name above the timeline and its details in a sheet that replaces the timeline (max 460 dp and 55 % of the screen; a 360 dp side panel in landscape); or a modal sheet on a scrim (the house menu, the stages, the source). The camera frames the house inside what the resting chrome leaves free; sheets and the analyzer task never move it. In landscape the bottom stack ends before the rail — and, while a pane is open, before the pane — instead of running under either; the side rail never runs off the safe area (it scrolls past it), and while the details are open the rail leaves with the timeline. The house last open is the one that opens on a cold start. Panels share a budget, not a layer: none may overlap another. Content respects the safe drawing area (status bar, navigation bar, cutout, keyboard).

Adding a house from a link is a task surface that takes the screen and returns to the same house; with no house on the phone the root is `NoHouseScreen`, one paragraph and one filled action.

## Elevation & Depth

Flat. There are no shadows anywhere in the build. Depth is tonal: Well (pressed in) below Ground, then Raised, then Sheet, and over the model a translucent Glass tint with a 1 dp rim gradient that is brighter at the top edge. Glass does not blur: the model is drawn by Filament on its own surface, which the window cannot sample. A dimmed scrim settles the model's top edge under the status bar and fades in behind the navigation bar.

### Named Rules
**The One Layer Rule.** Glass is a one-layer material. Two tints stacked never reach cover and let the text beneath show through, so a pane over another pane (the tool pane over the rail) takes `GlassOpaque`. The stops of the expanded timeline are not panes: they sit on the timeline's own glass, and only the chosen one is marked out, as a Well.

**The Solid to the Finger Rule.** Every surface over the model — glass or the opaque inspector sheet — takes `Modifier.solidToFinger()` first: it takes part in hit testing over its whole area without consuming anything, so a touch on chrome never orbits the camera, picks a wall behind a label or presses a rail button under a sheet.

**The Pressed Not Coloured Rule.** An active control sinks into its rail (a Well behind it), plus a line and full-ink label. It does not light up.

## Shapes

Rectilinear: a rule has corners, not pills. Four radii only: `tick` (2 dp) for rule segments, marks and the preview tag box; `control` (6 dp) for buttons, wells, rail buttons and the chosen timeline stop; `panel` (8 dp) for glass panes and the snackbar; `sheet` (12 dp) for the timeline and the inspector sheet (rounded on the edge it rises from only). Borders are 1 dp hairlines; mark outlines are 1.2 to 1.4 dp. The only circles are the 10 dp choice rings of `PanelOption`. The signature silhouettes are drawn, not borrowed: the rule's segments with 2 dp hinge gaps, the downward five-point tag of a marking gauge, and the small house end cap. Icons (`ShellIcons`) are 24 dp outlines at one 1.75 stroke with round caps and joins, tinted by the caller.

## Components

### Buttons
Ink, not colour; rectangular, 48 dp tall at least.
- **Shape:** gently squared corners (`control`, 6 dp).
- **InkButton (primary):** filled Ink with Ground text, labelLarge, 16 dp by 8 dp padding, optional 18 dp icon; one per screen ("Otwórz w 3D"). Single line with ellipsis.
- **LineButton (secondary):** transparent with a 1 dp outline, Ink text; the border is RuleEmpty by default and Ink when the action is the one that matters on that panel ("Wróć do teraz", "Ustaw postęp"). Up to two lines with ellipsis.
- **Disabled:** InkButton sinks to Raised with an InkFaint label; LineButton keeps an InkFaint label on a Hairline outline — readable (above 4.5:1), never Material's faded default.
- **QuietAction (tertiary):** no outline, no indent, InkMuted labelLarge at the text margin with an optional icon; the whole row is a 48 dp target ("Co to znaczy?", "Dodaj dom z linku").
- **Pressed / disabled:** Material's state layer; disabled labels drop to InkFaint. No yellow state anywhere.

### Chips
Not used. Choices are `PanelOption` rows.

### Cards / Containers
- **GlassSurface:** Glass tint, `panel` or `sheet` corners, 1 dp rim gradient, no shadow, no blur; `GlassOpaque` when it lies on other chrome.
- **Opaque sheets:** Sheet colour for the inspector, switcher and dialogs; dense text never sits on translucent glass.
- **Internal padding:** 16 dp start, 4 to 8 dp vertical per row.

### Inputs / Fields
- **Style:** Material outlined field, RuleEmpty outline at rest, label in Polish ("Teraz robimy").
- **Focus:** outline, label and cursor turn Ink.
- **Completion slider (stage sheet):** the one editable measure, so the only interactive control in yellow, drawn in the rule's grammar rather than as a stock pill: an 8 dp Hairline bar with `tick` corners, filled in Rule to the stage's share, graduated every 5 % (OnRule ticks on the fill, RuleEmpty beyond it), and a 6 × 28 dp Rule marker with `tick` corners for a thumb; the range carries a 1.2 dp RuleEmpty outline, the rule's "not started".

### Navigation
- **House menu (`HouseMenuSheet`):** a modal Sheet from the top context's menu button: the houses on this phone as 64 dp radio rows (the open one on a Well with a check), "Dodaj dom z linku" as a LineButton, then the matters of this house as 56 dp rows with an icon and a chevron (Etapy budowy, Źródło modelu i analiza) and the named cost boundary (Koszty, disabled, InkFaint, with the sentence that it is not built yet). Selection is announced through `stateDescription`, never a `contentDescription` that would erase the label.
- **Status row:** one 48 dp row under the top context, only when the house has something to say: a new house ready ("Nowy dom gotowy: … · Otwórz"), a link analysis running or failed, or a model kept with limitations; a mark and a sentence, the way to its matter.
- **PanelHeader:** titleSmall title (and an optional bodySmall line) with a 48 dp close button; it sits outside the pane's scroll.

### The Folding Rule (signature)
The build's stages as hinged segments with the design's house outline as an end cap. Done: solid Rule. In progress: Rule outline filled to its completion. Not started: RuleEmpty outline. The solid tag above marks NOW; a hollow tag with a hairline through the rule marks the PREVIEW cursor. Graduation ticks under every hinge, a longer tick and a numeral at 1, 5, 10 and 15. Interactive height 52 dp (the whole height is the touch band), static 40 dp, grown to fit numerals at large font scales. Scrubbing snaps stop by stop with a haptic tick, moves only the preview and never changes saved progress; TalkBack reads it as an adjustable control with previous, next and "Wróć do teraz" actions.

### StageMark and PreviewMark
The rule's grammar in 18 by 8 dp (`StageMark`: filled, part-filled, grey outline, InkMuted outline for the finished design) and an 11 dp hollow Rule box (`PreviewMark`) beside "Podgląd: …". The same marks are used in the timeline, the stage strip, the stage sheet and the inspector.

### TimelineRail
A `sheet`-cornered GlassSurface at the foot of the 3D. The header (at least 56 dp) states now ("43% · Dach", "Teraz: …") or, while previewing, "Podgląd: …" with "Wróć do teraz" on the line under the title, never beside it. Expanded, a horizontal strip of stops (96 to 132 dp wide, 56 dp tall, directly on the timeline's glass with no box of their own; the chosen stop is a Well with a 1 dp Ink border and `control` corners). names each stop with its mark, numeral, name and state word. A chosen element is named in a row at the top of the same glass (name, storey, "Szczegóły", ×), above a hairline: the foot of the 3D is always one panel.

### ToolRail
Four labelled buttons (Wygląd, Warstwy, Widok, Dopasuj), 64 by 60 dp in a glass rail; a button's label names the current choice once it is not the default, in the one or two words that fit at font scale 1.3 ("Makieta", "Bez dachu", "Parter"); the full name is read in the pane and spoken in the state. Pressed, it sinks into a Well. Its pane (236 dp, GlassOpaque) grows out of it and swaps contents when the tool changes; lists fade below the fold with a 32 dp gradient.

### Panel rows
`PanelOption`: a 10 dp ring that fills Ink when chosen, the label semibold when chosen, every label full ink. `PanelAction`: a plain action row. `PanelGroupLabel`: labelMedium InkMuted heading. `PanelRule`: a 1 dp Hairline inset 16 dp.

### Inspector
The chosen element's details in a Sheet rising from the bottom edge in place of the timeline (a side panel in landscape): Polish name and storey first, then its construction stage with a StageMark and whether it stands by the owner's account, then label/value rows (bodySmall InkMuted / bodyMedium Ink), with the export's own English under "Dane techniczne".

### Status and problem lines
`StatusText` (labelMedium, InkMuted), `ProblemLine` (an 18 dp Error caution icon plus Ink text), and `LoadProblem` (the reason in Polish, the English technical account folded under a QuietAction).

### HouseDrawing
The source sheet's picture of the house: a derived axonometric line drawing (200 dp tall). Built by the owner's account in Ink (1.1 stroke), the current stage's additions in Rule (1.3), the remaining design as InkMuted at 32 % (0.8). With progress unset the whole design is Ink. Tapping it closes the sheet onto the house.

### Sheets over the house
`StageSheet` (the 003C stage editor in a modal Sheet capped at the window's height, the house's ridge in view above it), `SourceSheet` (the house's name, the inked `HouseDrawing`, where the model came from with its limitations named and counted, a link analysis running or failed, what the latest analysis of this house left open, the technical rows folded at the end) and `NoHouseScreen` (top-left headline, one paragraph, one InkButton "Dodaj dom z linku"). No sample rows, zero totals or pretend actions anywhere.

## Do's and Don'ts

### Do:
- **Do** take every colour, space, corner, size and type role from `Theme.kt` (`Palette`, `Space`, `Radius`, `Sizes`, `Measure`, `MaterialTheme.typography`).
- **Do** reserve `Rule` for measured progress: segments, the now tag, the preview outline, StageMarks, the current stage's lines in the drawing, the completion slider.
- **Do** make actions ink: one `InkButton` per screen, `LineButton` for secondary actions, `QuietAction` for the ways on.
- **Do** say every state as a shape and a word: a mark or well plus text, announced through `stateDescription` so a merged node keeps its label.
- **Do** give every touch target at least 48 dp (`Sizes.touch`).
- **Do** pair every `maxLines` limit with `overflow = TextOverflow.Ellipsis`, and check at font scale 1.3 and with `ANIMATOR_DURATION_SCALE = 0`.
- **Do** take `GlassOpaque` for any pane over another pane, and keep headers and the one way out outside the scroll, with `fadeBelowFold` over a cut list.
- **Do** read motion from `LocalMotionPolicy` (enter 220 ms, exit 150 ms, settle 180 ms, recede 160 ms) and use `enterDelayed` when one dense panel replaces another.
- **Do** put every UI label in Polish, in the owner's words, in `strings.xml`; keep code names and routes in English.
- **Do** keep the house as the root: every matter is a sheet over it or a task that returns to it, and a new permanent surface needs the OWNER's decision.
- **Do** keep the model's semantic truth where it lives: what is visible comes from the domain's selection rules and one `primitivesOf(elements)` bridge; the UI and renderer only ask.

### Don't:
- **Don't** write a hex colour, `Color(0x…)` or a new radius outside `Theme.kt`.
- **Don't** put yellow on a button, border, selection, focus or link; don't fill the preview tag.
- **Don't** tell a state by colour alone, and don't set `contentDescription` on a merged node that would erase its text.
- **Don't** stack two translucent panes, or let one pane overlap another's touch area.
- **Don't** add shadows, blur, pills or enclosing cards; hierarchy is type, weight and ink.
- **Don't** set a word in Barlow Condensed, or add a second monumental figure.
- **Don't** use uppercase eyebrows or kickers above titles.
- **Don't** let the renderer or the UI own semantic truth: no second decision path for roof, storey or room, no `if` about a frame in the renderer.
- **Don't** use `!!` where types can express it, and don't hide problems with `@Suppress`, empty `catch` or a lint baseline.
- **Don't** show invented progress, costs, dates or sample rows; an unset state says "Postęp nieustawiony" and offers to set it.
- **Don't** add a navigation bar, a tab, or a page that says only that it is not built; the cost boundary is a named row, and nothing else.
