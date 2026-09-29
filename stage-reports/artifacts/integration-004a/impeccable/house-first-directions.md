# Three house-first compositions (INTEGRATION-004A §31) and the choice

All three keep DESIGN.md's visual world (graphite ground, one-layer glass,
ink actions, rule yellow for measured progress only, Barlow Condensed for
figures). They differ in structure only: what is permanent around the house,
and how the rest is reached. Each was critiqued against the seven criteria
of §31 with the run-73 measurements from `house-first-critique.md`
(house ≈ 13 % of the screen at rest, ≈ 70 % of the screen accepting orbit
and pan, 4-button rail at 17 % of width, 5 taps to record a stage).

## A — Spatial instrument

Full-screen house. Top left: one compact glass context (house menu button,
house name, the actual state "43% · Dach", and a status row only when there
is something to say: "Gotowy z ograniczeniami", "Analiza linku · 37 %",
"Nowy dom gotowy"). Right edge: the existing labelled tool rail (Wygląd,
Warstwy, Widok, Dopasuj), receding while a finger turns the model. Bottom:
the folding rule with its header, which is now also the way into the stage
sheet. Contextual sheets, one at a time: the element inspector (in-window,
below the house), the stage sheet, the source sheet, the house menu (modal
bottom sheets over a scrim). The analyzer is a task surface entered from the
menu, the source sheet or the no-house state, returning to the same house
and pose.

- House dominance: the same canvas as run-73's 3D; nothing new is permanent.
- Homeowner clarity: every control keeps its word; the rail's labels name
  the non-default state ("Bez dachu", "Makieta"); the rule header reads
  "43% Dach / Teraz: Montaż więźby" and opens the editor.
- Touch ergonomics: everything that changes the record is at the foot; the
  menu is the only top-left target and is used rarely.
- Clutter: three glass pieces at rest, all measured into the camera frame.
- Extensibility: a new matter (Koszty, documents) is a menu row that opens a
  sheet or a deep workspace, never a new permanent surface.
- Accessibility: unchanged semantics (`stateDescription`, adjustable rule,
  48 dp targets), plus one merged clickable header row.
- Compose/Filament feasibility: `ModelWorkspace` becomes the root with its
  inset measurement intact; the sheets are Material 3 `ModalBottomSheet`s
  over the same Filament surface; no second engine, no re-upload.

## B — Construction cockpit

Full-screen house. A full-width status lane across the top: name, a thin
progress track, stage and task in one line, the menu at its end. Compact
icon-only handles on both edges (appearance and layers left; view, fit and
list right). The same progress rail at the foot.

- House dominance: the lane costs the full width at the top (run-73's
  context is 43 % of the width); the two handle columns take orbit area on
  both sides, so the gesture area drops below A's 70 % at rest.
- Clarity: icon-only handles are mystery glyphs for a first-timer and lose
  the rail's "label names the current state"; the state has to be recalled.
- Ergonomics: handles on both edges are reachable one-handed only on one
  side; the lane is out of reach and holds nothing to tap except the menu.
- Clutter: more permanent chrome than A, not less.
- Extensibility: a lane invites more indicators; the brief's "minimal
  overflow" is hard to hold.
- Accessibility: icon handles need `contentDescription`s that the label
  already gave for free in A.
- Feasibility: fine, but the double edge needs a second inset side and a
  new framing rule for the camera.

Rejected: it trades A's words for glyphs and pays for it in gesture area.

## C — Quiet canvas

Almost no permanent chrome: a one-line project and progress strip at the
top, the timeline at the foot, and a single "Narzędzia" handle that unfolds
the tool rail on demand. Sheets as in A.

- House dominance: the best of the three at rest (no rail).
- Clarity: Warstwy and Widok move one tap deeper; "Bez dachu" and "Makieta"
  are no longer visible as labels, so the owner cannot see at a glance why
  the roof is missing (is it the history, or a layer?). That is the one
  state the 003C evidence showed owners confusing.
- Ergonomics: the unfold handle must sit low on the right; every layer
  change is two taps instead of one.
- Clutter: minimal, but the "quiet" rail hides state, which the craft floor
  counts as recall.
- Extensibility: good.
- Accessibility: a hidden rail is a hidden landmark for TalkBack.
- Feasibility: fine.

Rejected as the default, kept as a behaviour: A's rail already recedes to
18 % while the model is turned, which is C's quiet without hiding the
state words.

## Choice: A, with C's restraint while turning

A is chosen because it is the only direction that keeps state readable
without recall (labelled rail), keeps the gesture area at ≈ 70 % at rest,
puts the one edit path at the thumb, and reuses the 003C workspace whose
scrub, frame and engine behaviour is already proven on device. C's virtue is
kept as the existing recede. B is the worst of both.

What changes from run-73 in code, in one list:

- `ShellState` becomes root + one sheet + one task, with the same pure
  `back()`; `AppPlace`, `PlacesBar`, `PlacesRail`, `EmptyPlace` and the Dom
  page are deleted.
- `HouseWorkspace` (the former `ModelWorkspace`) is the product root
  whenever a house exists; its top context gains the house menu and a
  status row; its rule header opens the stage sheet.
- Sheets: house menu (houses on this phone, add from link, source, stages,
  the named Koszty boundary), source (identity, limitations, the analysis
  result and technical rows), stages (the 003C editor).
- `NoHouseScreen` for a phone with no house: one paragraph and "Dodaj dom
  z linku".
- The analyzer is a task surface; a finished analysis no longer evicts the
  open house: with no house it opens, otherwise the workspace offers it.

Not asked of the OWNER: the brief's §22–§28 already decide the root, the
task flow and the Koszty boundary; the remaining choices are structural and
are recorded here with their evidence.
