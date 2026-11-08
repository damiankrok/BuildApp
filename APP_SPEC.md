# BuildPlan — product and core specification

Post-audit operational summary, prepared08.11.2026. This replaces the historical
BUILDAPP-00 foundation summary when adopted. The full OWNER Master Plan retains
future scenarios and priorities; this file does not cancel them or copy history.

## 1. Product

BuildPlan starts on native Android. A recognizable, editable semantic house is
the spatial index of a construction project: storeys, rooms, elements, real
costs, stages, documents, photos and work history. Costs/documents remain useful
with a partial model. Full personal statistics, manual costs and the local core
remain FREE; do not change business scope during analyzer work.

LINK reconstructs the source-grounded exterior from public project materials:
masses/garage/wings, connected roofs, openings, balconies/loggias/guards,
canopies/carports/pergolas/supports, dormers/chimneys/rooflights and characteristic
facade zones with a coherent approximate low-poly/stylized palette. It does not
promise unseen construction or full BIM. PROJECT uses supplied stronger drawings,
vectors and schedules where available; AS-BUILT evolves the same project identity.
A later single-photo fallback has hypothetical unseen sides and no false metric
authority. Preserve these modes rather than making the active LINK task their deletion.

Real expenses use exact Money in minor units with explicit currency, overflow
checks and calendar dates. Allocation/refund semantics must be settled before
their implementation. Geometry authority does not come from appearance alone.

## 2. Core boundaries

Accepted semantic Building → typed commands → validated model → geometry compiler
→ native/web viewers. Geometry is derived; viewers never invent architectural
meshes or become a second saved model. Temporary inference candidates are allowed.

`packages/model`, `packages/commands`, `packages/geometry` do not depend on React,
Three.js or Android UI. Keep source/readers/solver usable through explicit
adapters. Android is the product path; the web editor is also an active consumer,
not proof that native behavior was tested. Current capabilities belong to status,
not to a claim that every envisioned mode is implemented.

Semantic IDs survive save/load and regeneration. Window/Door → Opening → host
wall; roof openings → host roof/plane; Room → storey; architectural assemblies
retain their members and relationships. A shared wall is one element with
separate room links. One element may compile into multiple primitives.

A structural opening removes wall/roof material. Painted fills on intact host
material are a defect. Window/door frames, glazing/leaves remain separate
semantic objects, capable of later operation without inventing new identity.
Doors retain a frame, leaf, handle, hinge side and open angle. Windows retain
frame/glazing and the ability to add sash or pivot behavior later.

Parameter editing updates the semantic model, recompiles, then renders. Stable
canonical serialization and deterministic replay remain requirements. Invalid
references/geometry get explicit errors; controlled corrections record their cause.

## 3. Coordinates and data

Canonical lengths are metres, persisted angles degrees. x points right looking
at the front facade, z away into the building, y upward; plan usesXZ and finished
ground floor is y=0 in that model frame. Record the frame explicitly. This
specified triple is left-handed; preserve the documented viewer conversion
(web mirrorsz), rather than silently changing model axes. Terrain, steps and
split levels can differ from0; do not force all door thresholds to global zero.

Source image coordinates have their own frame/crop/transform. They are not
building metres. Store original bytes/hash, raw reading, meaning, provenance,
uncertainty and target. A derived value is not a printed value. The accepted
decision and applied geometry remain distinguishable after fitting or refusal.
Only an actual user action can confer USER_CONFIRMED.

## 4. Analysis and presentation

Distinguish document, projection, source region, edition/mirror, storey and side.
Interior pictures do not verify the exterior. A section is not a side elevation;
perspective pixels do not directly set metres. Technical drawings constrain
geometry; renders help appearance/topology under their camera and visibility.

One semantic exterior hypothesis can combine plan and exterior observations
before every room is solved. Missing scale blocks exact quantities; it need not
erase observed shape. Do not turn failure to build a balcony into evidence that
the source has none, or inability to join a roof into a different roof assertion.
See `docs/ANALYZER_CONTRACT.md` for the shared rules and acceptance boundaries.

During analysis show the actual current sheet/crop and marks using the same
bytes/frame as the run. A final inspection screen is not this live preview.
Separate counts of images, OCR candidates, measures, hypotheses and distinct
physical elements. Source↔model selection exposes raw/accepted/applied values.

Orbit/pan/zoom, camera views, semantic selection, hide roof/storey, isolate room
or element, and contextual inspection operate on the same house. Preserve the
OWNER's mobile canvas direction. The historical dark desktop foundation layout
is not a restriction against the current palette or native interaction design.

## 5. Technology choices and scope

Keep the existing semantic core and compiler as the baseline. OCR/DET/REC,
ensembles, registration and inference order can be replaced on measured benefit;
neither own code nor a library has priority by origin. No benchmark answers,
house-identity exceptions or runtime reference-model fallback.

Paid AI is optional source help/review with a controlled domain consumer, not
arbitrary model commands. The key stays on the host/broker; no-network behavior
remains useful. Native/library compatibility and licensing are verified for the
actual delivery. ForgeShape is read-only under the current instruction.

Scraping, numeric OCR, camera solving and source reconstruction are active work,
not excluded by the old foundation stage. Invoice OCR, collaboration/sync,
marketplace, broad import/export and future ports retain their roadmap status;
they are not silently launched by this specification update. Photorealism and
an unsolicited full application rewrite are not current requirements.
