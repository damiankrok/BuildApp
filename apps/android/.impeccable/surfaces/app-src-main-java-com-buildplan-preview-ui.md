---
version: 1
slug: "app-src-main-java-com-buildplan-preview-ui"
primary_target: "app/src/main/java/com/buildplan/preview/ui"
related_targets: []
---

# Surface brief — BuildPlan product workspace (Android)

Scope: the whole product shell of `apps/android` — since INTEGRATION-004A the
house workspace as the root (the 3D house with the construction timeline,
the stage sheet, the source sheet, the house menu), the no-house state and
the analyzer task. The OWNER's house-first override revokes the five places
of 003C. Visitor mode: **Operate** (the owner checks and records where the
build stands).

Audience and job: the homeowner-investor of PRODUCT.md, at home or on the
plot, answering "which stage, what now, what did it look like before X".
Constraints: the owner's brief pins dark-first, model-first, technical but
calm, one restrained accent, no card grids, no giant model card, no stacked
panels around 3D, Polish copy, 48 dp targets, font scale 1.3.

## Direction contract

THESIS: Construction progress is a measure, read on a carpenter's folding
rule: seventeen hinged segments across the bottom of the house, unfolded as
far as the build has got. Refuses the category default: a dashboard of
cards, KPI tiles and a donut gauge around a boxed 3D preview.

OWN-WORLD: Graphite night ground (#101419) under the model; chrome is tinted
graphite, never opaque slabs; ink #E8EBEF, muted #A3ACB8; one accent, rule
yellow #F2C230, used only for measured progress (unfolded segments, the
solid "now" tag) — a preview is a hollow yellow outline, never solid. Hairline
graduations, hinge notches between segments, tabular numerals, rectilinear
corners (2–8 dp). No enclosing cards: hierarchy by type size, weight and ink.

STORY: The owner opens the app and is on their house, reads "43% · Dach ·
Teraz: montaż więźby" in one glance, drags along the rule to watch the house
lose its windows, roof and walls, and taps "Wróć do teraz"; editing the real
state happens only in the stage sheet, opened from the rail's header,
deliberately, and closes onto the same house at the same camera.

FIRST VIEWPORT: the house full-bleed on graphite; top-left a compact
identity (the house menu, house name, "43% · Dach" or "Postęp nieustawiony",
and a status row only when there is something to say); right edge a
labelled tool rail in meaning groups (Wygląd, Warstwy, Widok, Dopasuj);
bottom, the folding-rule timeline: stage + task line (the way to the stage
sheet), the 17-segment rule plus the design end-cap, "Wróć do teraz" when
previewing. The derived axonometric line drawing of the house (built part in
ink, remainder as faint hairline) lives on the source sheet. Signature
interaction: scrubbing the rule snaps segment by segment while the house
assembles in place and the camera holds still. Composition: direction A
"Spatial instrument" of `stage-reports/artifacts/integration-004a/impeccable/house-first-directions.md`.

FORM: The Folding Rule (miarka składana), position 5 of the grounded list;
seed key 2d368ac2. Raises kept from declined challengers: no enclosing
cards (cracktro); achromatic text, colour only on the rail (iridescent edge);
one monumental figure (command centre); one dominant field per screen (rain
garden); the active control reads as pressed (CD-ROM console).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
