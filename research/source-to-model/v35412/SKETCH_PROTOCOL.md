# v3.54.12 — OWNER colour sketches as LOCAL input: protocol (written before any result)

**Scope correction of v3.54.11 (kept, not erased).** v3.54.11 tested background replacement (sky/vegetation → a flat
fill) and a hand mask of the building's outline. It did not test a colour REDRAWING of the whole elevation, which also
removes reflections, shadows and board texture inside the building. "The hand mask equals the originals" says nothing
about such a redrawing nor about separate semantic channels. Its results stand as what they measured.

**Question.** Does the pinned LOCAL analyzer, given the OWNER's two colour redrawings instead of the two matching
published elevations (all else identical), build a miniature that keeps or improves the house's identity
(`identity-marcowki.json`), and which module decides first if it does worse?

**Inputs (OWNER, v3.54.12 §2).** Originals `1000090696.jpg`, `1000090699.jpg`; sketches `Uproszczona elewacja domu
z garażem.png` (front with garage), `Kolorowa tylna elewacja domu z balkonem.png` (rear with balcony). Pairs are
confirmed by content (`match-picture.py`) and by registration on building points (`register-sketch.py`), never by
order or name; "front/rear" are the package's FRONT/REAR sides (ARCHON's "frontowa"/"ogrodowa"), not compass
directions. Size, SHA-256, trim box and any caption strip are recorded. A sketch is an OWNER input of unmeasured
fidelity, not an API result; it is not regenerated and no other picture is fetched in its place. **If an input is
missing, the run does not happen and the missing file is named.**

**Variants (same LOCAL revision as A, separate caches, 0 USD).**
- A — LOCAL on the original package (`v3546/sources/marcowki-ge.source-package.json`), pinned: v3.54.11 run
  `marcowki-ge-A`, model `0476d353…`, scene content `4911e70c…` (LOCAL code unchanged since `84de494`).
- B — the front and rear elevation assets replaced by the two sketches (MIXED: 2 of 4 elevations); every variant of a
  replaced asset gets the sketch's bytes, as supplied.
- B1 — front only; B2 — rear only (to name the cause of a change, not only the joint effect).
- B-reg (only if B differs from A by more than the registration's own residual) — the same with each sketch resampled
  into its original's frame by the fitted similarity (no local deformation), to separate "a different frame/crop"
  from "a different picture".
No variant receives a house document, a reference, a parameter of the house or an earlier scene.

**Before building: what the sketch changed.** Registration on building points (ground-line ends, outer corners, ridge
apex, frame break points, portal edges, big openings); similarity and affine fits with residuals per point; CHECK
points (garage door's left edge, portal end, frame band, rear raked glazings) measured as what the sketch changed.
Verdict per sketch: CROP_AND_SCALE / PROPORTIONS_CHANGED / MIRRORED. Parts the sketch closed that the original hides
are RECONSTRUCTED/APPROXIMATE, never observed.

**Measures (fixed now).** Two separate results:
1. VISUAL_MINIATURE — `visual-miniature.py` on the fixed card (14 features, 6 critical; "5" in the first version of this protocol was a counting error, the card is unchanged); the denominator never
   shrinks; tolerances are the executor's proposal.
2. METRIC_EVIDENCE — kept apart and diagnostic: 16 features v1 (+ portal v1.1), 27 detail rows, 14 zone points.
   A visual result never sets EXACT/MEASURED or quantities-usable, and no sketch-derived value enters cost/quantity
   as measured.
Also: run status, refusals, rooms/walls/openings, interior kept (room count and ids against A), time, peak memory,
input bytes. Boards: source | sketch | model A | model B | chosen, same cameras and scale; four sides, oblique,
close-ups, interior without roof.

**If B is worse or refuses.** Trace LOCAL's first wrong decision (which reader, on which picture, which row/column).
Then ONE bounded diagnostic: the correct contour/class given at that module's boundary (MANUAL_DIAGNOSTIC), to see
whether the rest uses it. Only a confirmed barrier justifies a minimal flagged adapter (contours/regions into the
existing LOCAL), never a house-specific rule. Counter-trials: a changed palette and a sketch without the frame (colour
must not create architecture); window bars must survive the contour handling.

**Decision.** B replaces nothing by default. A candidate with a worse identity never replaces a good miniature; a
difference within the accepted simplification (OWNER §0: e.g. the garage door's left edge nearer the wall) neither
justifies nor blocks a scene by itself. A new scene is added to the APK only if it is useful and different.
