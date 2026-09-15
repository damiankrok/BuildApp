# STAGE BUILDAPP-02 — SOURCEPACKAGE + VISUAL SOURCE OBSERVATION GRAPH

## 1. Baseline and result

| | |
| --- | --- |
| branch | `claude/buildapp-buildworld-v1-7y6yqh` |
| starting HEAD | `dc6407e95f308fedfef064f09582ffa4df230810` (verified equal to the remote tip before work began) |
| implementation commit | `2b92d1f` — the six analyzer packages, the BuildWorld Sources panel, the CLI, the tests and the benchmark artifacts |
| docs commit | the commit that carries this report (`docs/`, `README.md`, `PROJECT_STATUS.md`); its SHA is the final HEAD recorded in `git log` |
| model schema | `buildapp.canonical-building-model` **1.3.0** — unchanged, and untouched |
| mobile bundle | `buildapp.mobile-scene-bundle` **1.0.0** — unchanged |
| new schemas | `buildapp.source-package` **1.0.0**, `buildapp.source-observation-graph` **1.0.0** |
| result | **PASS** — every gate green; the live provider path exists and is honestly reported as not run |

This stage builds the first two layers of the real source analyzer:
acquisition, and observation. It does **not** reconstruct anything. Nothing in
the six new packages produces a Building DSL command, a mesh or a metre, and
`tests/architecture/analyzer.test.ts` fails by name if that changes.

```text
URL → SourcePackage → SourceObservationGraph → hypotheses → solver → DSL → model
      └── this stage ──────────────────────┘   └──── BUILDAPP-03 ────┘
```

## 2. What was built

Six packages, layered so the pure parts stay pure:

| package | what it is | depends on |
| --- | --- | --- |
| `source-common` | canonical JSON, pure SHA-256, deterministic ids, normalized 2D geometry | zod |
| `source-cv` | deterministic computer vision over decoded rasters | source-common |
| `source-package` | acquisition: safe fetching, adapters, decoding, variants, roles, sealing | source-common, decoders |
| `source-observations` | the SourceObservationGraph: schema, ids, hash, validation, builder | source-common, zod |
| `source-vision` | provider-neutral `VisionReasoner`, schema-constrained tasks, three providers | source-observations |
| `source-analyzer` | extractors, depth reasoning, stair reading, cross-view relations, overlays | all of the above |

`source-common`, `source-cv` and `source-observations` use no Node API, no DOM,
no Three.js and no building-model dependency, so a browser can read a sealed
graph without pulling in an acquisition stack. Enforced by test.

Documentation: `docs/SOURCE_PACKAGE.md`, `docs/SOURCE_OBSERVATION_GRAPH.md`,
`docs/VISION_REASONER.md`.

## 3. One authoritative acquisition path

`acquireSourcePackage` is the only function in the repository that produces a
SourcePackage. BuildWorld imports neither it nor the analyzer, no file under
`apps/web/src` calls `fetch` or decodes an image, and the browser reads the
sealed artefact the CLI wrote. All four are asserted.

The pipeline is **discover generously → fetch → DECODE → group → select on
measured pixels → classify → seal**. Selection happens after measurement
because selecting before it is selecting on a filename.

**Decoded dimensions come from the bytes.** On the live page the section is
served with `width="400" height="300"` and the front elevation with
`height="213"` over bytes that are 256 tall. `declared` is kept, `decoded` is
used, `declaredMismatch` records the disagreement.

Two acquisition defects the package's own test suite found, both fixed here:

- **`isBlockedIPv6` only understood the dotted IPv4-mapped form.** `dns.lookup`
  returns the compressed hex one (`::ffff:7f00:1`), so an AAAA record pointing
  at loopback passed the SSRF guard. Addresses are now fully expanded and every
  IPv4-carrying form — mapped, compatible, NAT64 — is classified by the IPv4
  address inside it; a bracketed literal is no longer handed to the resolver as
  if it were a hostname. `packages/source-package/test/hardening.test.ts`.
- **A JPEG padded with legal `0xFF` fill octets was reported "not an image".**
  The marker walk read a pad byte as a marker and jumped past the buffer.

Live acquisition of the benchmark URL, replayed offline from its byte cache:

| | |
| --- | --- |
| package | `src-m2fa281446a8ca-c0499d9df3` |
| content hash | `189a0c53fdd06c7bfcd349aec91c607ee7b136dfdfbdc7f10ffc327f238ece86` |
| assets | 20 — 4 elevations (FRONT, REAR, 2 × SIDE_UNSPECIFIED), 8 floor plans, 1 section, 4 renders, 1 site plan, 2 UNKNOWN |
| best rasters | section 1138×854 (8× the page copy), elevations 1280×597/598, plans 853×853 |
| published | 10 figures, 18 rooms |
| failures recorded | 14 — 404s on convention probes (positive evidence no larger copy exists) and byte-identical collapses |

The publisher's `__<n>` → `__<n+11000>` convention is an adapter hypothesis that
costs one request and records its misses. It is what turns the 400×300 section
into 1138×854. Byte-hash grouping collapsed five duplicate addresses, taking
eight "elevations" down to the four that exist.

## 4. The observation graph

Source-native, versioned, deterministic, content-addressed. Full description in
`docs/SOURCE_OBSERVATION_GRAPH.md`; the parts that matter to this stage:

- **Frames.** Every observation names one asset variant's decoded pixel grid.
  The same drawing at two resolutions is two frames.
- **Two geometries.** Pixel for provenance, normalized for comparison — and the
  normalized copy is always derived by the builder, never supplied.
- **Confidence and uncertainty are different questions.** Is it THERE, and is it
  HERE. A vision model may not claim zero positional uncertainty.
- **Alternatives, conflicts, gaps.** Ambiguity is represented; disagreement is
  recorded and never averaged; what was looked for and not found is named.
- **`LINEAR_VOLUME_CANDIDATE`**, for a thick member that reads as a solid whose
  primitive is not yet known — the vocabulary the owner's facade finding needed.
- **Order-independent hash** over the package identity, every extractor's
  version, and the observations, relations, conflicts and gaps as sets. It
  excludes prose and everything wall-clock.

## 5. Depth, not colour

`packages/source-analyzer/src/depth.ts` is the file the owner's facade finding
comes down to. A long band between two parallel lines is drawn the same way
whether it is a 300 mm concrete frame standing proud of the wall or a stripe of
paint; the previous pipeline had never been asked to tell them apart, which is
why the reconstruction came out flat.

A band is promoted to `LINEAR_VOLUME_CANDIDATE` only on a cue that implies depth
— `SHADOW`, `END_FACE` (a visible end face, not merely a line where the band
stops), `OCCLUSION_BREAK`, `RETURN_FACE`. `TONE_STEP` corroborates and never
decides, because it is equally true of paint. A band with no depth cue is
recorded as a `SURFACE_REGION`: nothing is discarded, the two are distinguished.

Two cues were tried and removed because they do not survive contact with a real
drawing, and both removals are documented in the source:

- "the band is closed by a stroke at its end" — a painted band's colour also
  stops, and stopping draws the same line;
- no interior-texture test at all — on a published elevation *photograph* the
  treeline behind the house generates long straight tone boundaries in quantity
  that pass every geometric test a member passes. The mean gradient inside the
  band is the one test that asks what the band is MADE of, and it took the
  front elevation from 22 members (most of them foliage) to 4 (all of them on
  the building).

## 6. The stair

§11's rule is that a staircase is never inferred from the size of a shaft, and
the reader obeys it literally: it reads a RUN OF TREAD LINES, chained by
STEPPING rather than by nearness, so one path runs straight through a winder and
a quarter-turn stair comes back as one run with a turn in it. It reports the
treads counted, the walking line through their midpoints, each straight flight,
each fanning winder with its total turn, and the direction of ascent when the
drawing marks it — with both directions as alternatives when it does not.

It is proven on clean input: 14 tests covering a straight flight, a winder, the
arrow, the stringers, determinism, and four things that are NOT a staircase.

**On the published Marcówki plans it reports no staircase, and that is the
finding.** Those plans are 853 px for a 12 m house, so a 0.27 m going is about
9 px while the terrain hatch, paving and planting symbols sit at a flat 4 px.
Every other test a flight passes, they pass too — even spacing, equal lengths,
ends held by a boundary, and on one occasion a passable arrowhead. Reporting one
of them as the staircase would put a flight where a shrub is, and a confident
wrong answer cannot be undone downstream while a named gap can be filled by a
larger source or a vision pass. So five candidate runs are recorded as evidence
with the reason each was rejected, four `AMBIGUOUS` gaps name the stair, and the
section's own stepped chain (4 tread/riser pairs) is reported separately.

The benchmark sets that beside what the model asserts — a 4-riser flight, 4
winders, a 9-riser flight — and the distance between them is exactly the owner's
first finding.

## 7. Vision

`VisionReasoner` is provider-neutral and three implementations ship: a live
Anthropic adapter (forced tool use against the task's generated JSON Schema,
temperature 0, no prose-parsing fallback), a recorded-fixture replayer keyed by
the bytes it describes, and a null provider that admits there is none.

Tasks are narrow and the vocabulary is restricted per task, generated from the
observation enums so the question cannot drift from the answers the graph will
accept. There is no "build this house" task.

Twelve named rejection codes, each corresponding to a way a real multimodal
model fails, and a refused answer is discarded whole. 34 tests in
`packages/source-vision`, 5 more exercising the full path end to end.

**LIVE_PROVIDER_NOT_RUN.** `ANTHROPIC_API_KEY` is not set in this environment.
`--live` refuses with *"refusing to pretend a live call was made"* and exits 3.
The fixtures in the repository are hand-authored answers about synthetic test
images and are labelled as such; there are deliberately none about the real
drawings, because a hand-written answer about the Marcówki facade would be a
person doing the vision work and the pipeline taking the credit.

## 8. Deterministic CV complements the model

The CV extractors run first and unconditionally; a vision pass adds observations
beside them. `vision-path.test.ts` asserts that the deterministic observation
count is identical with and without a provider.

`packages/source-cv` (57 tests) covers grayscale and ink separation, adaptive
and gradient masks, connected components, runs, axis-aligned and Hough segments
with total-least-squares angle refinement, parallel families, rectangles,
profiles, silhouettes and slope histograms — all on synthetic pictures with
exact expected answers. Three masks are used for three different questions:
ink for regions, **gradient for lines** (a mid-tone band is one blob of ink but
two distinct edges), and strict thin strokes for treads.

## 9. Marcówki observation benchmark

`npm run observations:marcowki` — artifacts in
`stage-reports/artifacts/source-observations/`.

| | |
| --- | --- |
| graph | `obsgraph-src-m2fa281446a8ca-c0499d9df3-0dff45f229` |
| content hash | `8415a4e00349441433c055b219bbb5ef645dcda951519dc57d6ec6b4dc6c9043` |
| frames | 18 |
| observations | 888 |
| relations | 461 |
| conflicts | 0 |
| named gaps | 81 — 41 missing, 4 ambiguous, 36 not attempted |
| vision provider | none (LIVE_PROVIDER_NOT_RUN) |

Observations by kind: WALL_BAND 401, OPENING 145, **LINEAR_VOLUME_CANDIDATE
138**, SURFACE_REGION 67, ROOF_EDGE 36, OPENING_INTERVAL 33, LOGGIA 18,
PARALLEL_LINE_FAMILY 17, MASS_REGION 9, RIDGE 9, SILHOUETTE 8, LEVEL_DATUM 6,
STAIR 1.

### The owner's findings, against the sources

| finding | verdict | what the sources carry | what the model asserts |
| --- | --- | --- | --- |
| thick 3D frame/beam solids on the characteristic facade | **SOURCE_SUPPORTS_MORE** | 138 members with a depth cue (front 4, rear 4, side 72, renders 58); 67 further bands carry none and are recorded as surfaces | the same zones as flat `surfaceRegions`; no solid linear member anywhere |
| the frame continues from the garage toward/under the balcony | **SOURCE_SUPPORTS_MORE** | the front elevation's longest member spans most of the facade width; `CONTINUES_ACROSS` relations link horizontal members to the verticals they meet | nothing runs across the garage/house junction |
| balcony/loggia side returns incomplete | **SOURCE_SILENT** | 18 recess mouths found, **0 side returns**; every side with none is a named gap | the loggia is a recess with no return walls |
| staircase topology/orientation | **SOURCE_SILENT** | no run on any published plan can be held to be a staircase (§6); 5 candidates recorded with reasons; the section gives one 4-step chain | a 4/4/9 flight-winder-flight stair at 0.2725 / 0.265 m going |
| roof pitch (checked, not raised) | **AGREED** | image-space roof edges at 39.94° and 140.08°, within 0.06° of the model | 40° from the section's printed annotation |

The two SOURCE_SILENT rows are the honest result, not a failure of the
benchmark: the analyzer states what the published rasters support and names what
they do not, and the gap between that and the model is what BUILDAPP-03 and a
live vision pass are for.

### Debug overlays

`stage-reports/artifacts/source-observations/overlays/` — one self-contained SVG
per job with the drawing embedded and every observation drawn on it, colour-coded
by kind, dashed where a vision model produced it, with the evidence in a tooltip.
Opening one in a browser is the fastest way to disbelieve this pipeline, which is
the point. `--overlays all` writes one per analysed drawing.

## 10. BuildWorld: Sources / Observations

A new right-hand panel, toggled from the toolbar. It shows the sealed graph:
frames, observations by kind with their evidence, tolerance and alternatives, the
conflicts, and the named gaps. A graph arrives either as the sample built into
the bundle or from a file the viewer opens — the same artefact the CLI writes,
validated by the same schema and rules.

It is read-only **structurally**: the component is handed no store and imports no
command, so there is no path from anything a viewer clicks to the building. The
e2e test walks every frame, opens observations, switches panels, and asserts the
model id, wall count, roof count, mesh count and triangle count are unchanged and
that undo has nothing to undo.

`screenshots: buildworld-sources-panel.png`, `buildworld-sources-linear-volume.png`.

## 11. CLI

```bash
npm run source:acquire        -- <url> [--out f] [--cache d] [--offline] [--no-probe]
npm run observations:extract  -- <package.json> --cache d [--out f] [--overlays d] [--fixtures d | --live] [--record d]
npm run observations:audit    -- <graph.json>
npm run observations:marcowki -- [--cache d] [--out d] [--overlays all]
```

`observations:audit` exits non-zero on any validation error and is usable as a
gate. On the benchmark graph it reports **0 errors, 0 warnings**.

## 12. Tests

**676 tests across 60 files, all passing** (`npx vitest run`). New in this stage:

| suite | tests |
| --- | --- |
| `source-common` | 14 |
| `source-cv` (raster, mask, lines, shapes, determinism) | 57 |
| `source-package` (image, net, variants, roles, archon, acquire, hardening) | 93 |
| `source-observations` | 37 |
| `source-vision` | 34 |
| `source-analyzer` (depth, stair, vision path, **mutations-02**) | 43 |
| `tests/architecture/analyzer.test.ts` | 19 |
| `apps/web/e2e/sources.spec.ts` | 4 |

### Mutation tests (§25)

All fourteen, in `packages/source-analyzer/test/mutations-02.test.ts`, each
asserted against the unmutated run as well:

1. **section at quarter resolution** — tolerance as a fraction of the drawing
   grows; the hash moves.
2. **front perspective dropped** — the frame, its observations and its relations
   go with it.
3. **one major opening erased** — that opening, at that position, is gone; the
   other two survive.
4. **thick facade member erased** — no member survives at that position.
5. **volumetric cue made flat** — the same band is demoted from
   `LINEAR_VOLUME_CANDIDATE` to `SURFACE_REGION`, with *"a change of surface,
   not a solid"* in its evidence.
6. **one balcony side return removed** — the remaining return is the correct
   one; the missing side becomes a named gap.
7. **facade mirrored** — the reading mirrors exactly; the hash differs, so a
   flip is never mistaken for the same source.
8. **side elevation labels swapped** — both the package hash and the graph hash
   move, and the frames carry the swap.
9. **stair direction arrow removed** — no staircase is asserted; the ambiguity
   is recorded; the runs considered are kept as evidence.
10. **half the treads erased** — the count follows, with the alternative count
    and *"the count is a lower bound"*.
11. **conflicting printed dimension** — a conflict records both readings, both
    survive unchanged, and no average appears.
12. **malformed VLM coordinates** — refused whole; the same answer well-formed
    is accepted.
13. **feature outside image bounds** — refused as `OUT_OF_BOUNDS`, naming the
    coordinate that left the picture.
14. **wrong crop grouped as one variant** — caught the moment an extractor reads
    the bytes (*"sealed as 900x460 but its bytes decode to 600x300"*), and the
    package hash moves when a decoded size is edited.

### Architecture (§17)

19 tests: no reference-marcowki import, no project name in extractor code, no
branch on project identity, no known Marcówki dimension as a literal anywhere on
the production path; the benchmark and only the benchmark reads the reference; no
DSL command, no 3D vocabulary and no z coordinate in the observation layer; no
Node API, DOM or Three.js in the pure packages; exactly one acquisition function;
publisher knowledge confined to adapters; and the web neither fetches nor
extracts.

One pre-existing test was **removed**: `android.test.ts` asserted that
`apps/web` had no uncommitted change — a stage-local guard from the mobile stage
wearing an architecture test's clothes, which fails for any later stage asked to
change BuildWorld, as §22 asked this one to. What it was protecting (no second
geometry path in the viewer) is still asserted, as is the stronger new rule that
the browser cannot scrape or extract anything of its own.

## 13. Gates

| gate | result |
| --- | --- |
| `npx tsc -p tsconfig.json` + `apps/web/tsconfig.json` | clean |
| `npx vitest run` | **676 passed, 60 files** |
| `npm run build --workspace apps/web` | built |
| `npm run e2e` | **18 passed** (14 existing + 4 new) |
| `npm run android:test` | BUILD SUCCESSFUL |
| `npm run android:assembleDebug` | BUILD SUCCESSFUL |
| `npm run observations:audit` on the benchmark graph | 0 errors, 0 warnings |

The APK and web pipelines are unchanged in behaviour; the model schema, the
compiler, the reference model and the mobile bundle were not touched.

## 14. Known limitations

- **No live vision call was made.** No credentials in this environment.
- **The published plans cannot be read for a staircase** at the resolution the
  publisher serves (§6). Named, not hidden.
- **No side returns were found on the real loggia.** The rear elevation's recess
  is read, its returns are not; 18 named gaps say which sides.
- **No OCR.** Dimension chains and level datums are located, not valued; room
  labels are not read. Recorded as `NOT_ATTEMPTED` per plan.
- **Openings over-detect on rendered elevations.** Vertical timber cladding
  produces closed rectangles that are honestly reported as closed rectangles.
  Ranking by perimeter closure and refusing straddles narrows it; a scale anchor
  and a vision pass would settle it.
- **The site plan has no extractor.** Recorded as `NOT_ATTEMPTED`.
- **The byte cache is not committed** (6.8 MB of a publisher's images). The
  sealed package, the sealed graph, the evidence, the benchmark report and six
  overlays are. Re-running the benchmark needs one `source:acquire` first.
- **Renders are analysed as elevations.** A `PERSPECTIVE` projection is recorded
  and no extractor yet corrects for it, so a render's measurements corroborate
  and never measure.

## 15. Recommended next step

**BUILDAPP-03 — Primitive Reconstruction Solver v1.** The observations exist,
they carry tolerances, alternatives and conflicts, and they say what they do not
know. What is missing is the layer that turns them into primitive hypotheses and
solves them against each other across views, with a scale anchor, into the
Building DSL. This stage deliberately stopped short of that, and no part of it
claims automatic 3D reconstruction is complete.
