# v3.54.11 — LOCAL on image layers: protocol (written before any result)

**Question.** Does a deterministically simplified source raster (background, sky and vegetation suppressed, building
kept pixel for pixel) let the pinned LOCAL analyzer read more of the house, with nothing false added? If not, does a
correct (hand-made) mask help — i.e. is the limit in the picture or further in LOCAL?

**Houses (DEV, known; no transfer claimed).** Marcówki GE (ARCHON: portal, frames, glass), Pallas (dobredomy: covered
terrace on a real brick column, an open arch), Frizeach G2E (ARCHON: entrance canopy continuous with the garage
fascia), Oslo (lipinscy: a simpler house of another publisher). Three publishers.

**Variants (same code revision, same package apart from the replaced bytes, separate caches).**
- A — LOCAL on the original bytes of every picture.
- B-auto — the same, with each photographic picture (ELEVATION, PERSPECTIVE_RENDER) replaced by a derivative made by a
  fixed local filter: pixels classified sky (blue-dominant, bright) or vegetation (green-dominant) and outside the
  building's convex region are set to flat white; nothing inside it is changed. Plans, sections and site plans are NOT
  changed (lines, dimensions and text kept). No API, no model geometry, no reference number goes into the filter.
- B-mask (MANUAL_MASK_DIAGNOSTIC, Marcówki only) — the same, with the building region a hand-traced polygon per
  elevation (the upper bound of what a correct mask could give). Not an API reading.
- C — the original plus semantic channels as a separate input: only if B loses information LOCAL needs; it needs an
  adapter change behind a flag.
Each derivative has its own byte hash, URL and cache entry; its transformation, mask and method are recorded.

**Measures (fixed now).** On the compiled model, against the original sources' references: Marcówki — the 27 rows,
16 features v1/v1.1, scorer v3 (glazing, terrace, interior), zone references; the others — `score-detail.py`
(v3.54.5 DEV references, per opening and side). Also: run status, refusals, compile errors, rooms/walls/openings,
false walls or floors in open zones, time, memory, input bytes. On the derivative itself: building edges kept (edge
pixels inside the building region identical), new edges added outside it (mask boundary), text/dimension pixels on
plans untouched (plans are not changed at all).

**Cost cap.** 0 USD for A, B-auto and B-mask. An API region reading is run only if B-mask improves a measure, inside
the remaining pool (0.301978 USD), with its maximum reserved first.
