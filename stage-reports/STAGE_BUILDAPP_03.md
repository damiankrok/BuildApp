# STAGE BUILDAPP-03 — PRIMITIVE RECONSTRUCTION + METRIC SOLVER

## 1. Baseline and result

| | |
| --- | --- |
| branch | `claude/buildapp-buildworld-v1-7y6yqh` |
| starting HEAD | `ced70f0dba7d32caa32ef726a5118643796a80fe` (the BUILDAPP-02 docs commit, verified equal to the remote tip before work began) |
| implementation commits | `361e466` — schema 1.4.0 and the metric reader · `5ab618b` — the solver and its candidate · `8524a89` — the viewers and the tests |
| docs commit | the commit that carries this report (`docs/`, `PROJECT_STATUS.md`, `stage-reports/`); its SHA is the final HEAD in `git log` |
| model schema | `buildapp.canonical-building-model` **1.4.0** — `linearSolids` added, migrated from 1.3.0 |
| new schemas | `buildapp.metric-evidence-set` **1.0.0**, `buildapp.primitive-hypothesis-set` **1.0.0**, `buildapp.reconstruction-candidate` **1.0.0** |
| mobile bundle | `buildapp.mobile-scene-bundle` **1.0.0** — unchanged |
| result | **PASS** — the first automatic 3D candidate exists, is sealed, replays byte-identically, is shown in BuildWorld and on the phone, and is honest about what it does not know |

This is the stage where the pipeline stops describing sources and starts
building. The chain that BUILDAPP-02 left open now runs end to end:

```text
URL → SourcePackage → SourceObservationGraph → MetricEvidenceSet
    → PrimitiveHypothesisSet → solver → Building DSL → CanonicalBuildingModel
    → compiler → BuildWorld / Android
```

**The candidate is not final and is not claimed to be.** It gets the footprint
width exactly right and the ridge height exactly right; it gets three of the
reference's twenty-three openings; it refuses the stair outright; and it
carries 83 named holes. Section 9 says which is which.

## 2. What was built

| package | what it is |
| --- | --- |
| `source-metrics` | numeric OCR, dimension chains, the level ladder, frame registration, the sealed `MetricEvidenceSet` |
| `reconstruction` | hypotheses, fusion, constraint classes, the solver, the sealed `ReconstructionCandidate`, the projection audit, evaluation |
| `synthetic-drawings` | complete synthetic sheets — plan, elevations, section — rendered to real PNG bytes in their own typeface |
| `candidates` | sealed candidates as data, replayed by every viewer |

Schema **1.4.0** adds a generic `LinearSolid`: a rectangular bar between two 3D
points with its own cross-section basis, hosted on a wall, roof or slab. It is
what a facade band, a beam, a portal reveal or a parapet compiles to. It is
deliberately generic and the model has no idea which project it came from.

Documentation: `docs/METRIC_EVIDENCE.md`, `docs/PRIMITIVE_RECONSTRUCTION.md`,
`docs/RECONSTRUCTION_SOLVER.md`.

## 3. Reading what a drawing states

The reader is a numeric OCR for the alphabet drawings print. Five things in it
are worth naming because each fixed a failure that looked like something else:

- **Glyphs are matched as SKELETONS.** Zhang–Suen thinning first, on both the
  prototypes and the cell. Without it the matcher spends its discrimination on
  stroke weight — a thirteen-pixel glyph has two-pixel strokes, a fifth of its
  width — and two fat shapes overlap heavily whatever they are. That is how a
  `1` matched a `2`.
- **Resampling preserves proportions.** Stretched to fill the grid, a `1`
  becomes a solid slab whose distance to every other digit is tiny.
- **De-skew maximises the GAPS between glyphs**, not the variance of the column
  profile. Shearing widens the bitmap and the new columns are empty, so a
  mean-based measure rewards the widest shear on offer and every token comes
  back leaning twenty degrees.
- **Two numbers per glyph**: how well it matched, and how much better it was
  than the runner-up. Only the second is a statement about being right.
- **Three passes, one answer.** The page is read upright and a quarter turn
  each way, and a page-wide vote decides which turn the sheet uses — so a page
  never comes back with most of its vertical dimensions right and one reversed.

Above the reader sit two layers that make it self-correcting.

**Dimension chains.** A chain's ticks are candidate cut points, not a fixed
partition, and the best partition is found exactly by dynamic programming over
the ticks. One scale is voted for the whole sheet, in PIXELS rather than per
cent, because tick marks are located to about a pixel whether they are forty
pixels apart or five hundred. On the Marcówki ground plan this recovers, with
no project knowledge anywhere:

```
HORIZONTAL  1205  =  790 + 415          two chains, agreeing
VERTICAL    100 + 510 + 750 + 100 = 1460 cm,  with the 1260 walled portion
            held separately as its own chain
```

`1205` and `790` were both first read wrongly by the classifier and corrected
by the arithmetic; the rejected readings are recorded with the scale each would
have implied.

**The ladder of level datums.** Heights on a section must fall on one straight
line. A `+3,06` misread as `+5,06` survives every check a single reading can be
given — clean characters, plausible value, good association — and does not
survive being asked to agree with the other three heights on the sheet.

## 4. Fusion: 151 sightings, 103 members, every one accounted for

| stage | count |
| --- | --- |
| raw sightings | 151 |
| after duplicate suppression | 124 (−27, a second detection on the same drawing) |
| after clustering | 123 (−1, the same feature on a second rendering) |
| after continuity merging | 118 (−5, a collinear piece of an interrupted member) |
| accepted | 103 (−15, corroborated from a second drawing) |

Duplicate suppression tests overlap **or containment**: a band detector finds
one beam as a stack of sub-bands whose intersection over union is low precisely
because one is inside another.

## 5. Three constraint classes, never mixed

`HARD` is what the drawing states and is satisfied exactly. `SOFT` is what the
sources suggest and is fitted by weighted least squares. `UNRESOLVED` asserts
nothing and is carried to the candidate as a named hole. Two hard constraints
that disagree are a **contradiction**: reported, never averaged. A drawing that
states 12.05 in one place and 12.60 in another has a problem the reconstruction
cannot solve, and building 12.325 metres of wall is not a solution.

## 6. The sealed candidate

`stage-reports/artifacts/reconstruction/`:

| artefact | |
| --- | --- |
| `marcowki-metrics.json` | 764 OCR tokens, 83 readings, 275 chains, 9 registrations, 19 named gaps, 0 conflicts · `de932f82192aed04` |
| `marcowki-hypotheses.json` | 57 hypotheses from 151 sightings · `7713696c8ca6069c` |
| `marcowki-candidate.json` | 75 DSL commands, 7 quantities, 83 holes, 56 traces, 8 solver steps · `5f452153b8e6c036` |
| `marcowki-dsl.json` | the program alone |
| `marcowki-model.json` | the model the program builds · `290a173abec8cbe4` |
| `marcowki-projection-audit.json` | 8/8 openings land on an observation |
| `marcowki-trace.txt` | the §22 audit trail: primitive → hypothesis → evidence → token → glyph → bytes |
| `marcowki-evaluation.json`, `.txt` | the comparison with the reference |

Sealed against its inputs: source package `189a0c53fdd06c7b`, observation graph
`8415a4e003494414`, metric evidence `de932f82192aed04`, hypothesis set
`7713696c8ca6069c`. `verifyReplay` runs the program and checks the model comes
back **byte for byte**; the architecture tests run it on every committed
candidate, and BuildWorld and the mobile exporter both load by replaying it.

No publisher images are committed. Every artefact is JSON.

`npm run reconstruct:trace` joins them into one readable audit trail. For every
hard dimension it prints the characters that were read, the box they were read
from, each glyph's score, decidedness and runners-up, the readings the chain
rejected and the scale each would have implied, the registration's residual,
and the hash of the bytes. For every facade solid it prints the sightings, the
depth cue, the cross-view support and the basis of every parameter. An extract:

```
  hyp-mass.width = 12.05 m
    two horizontal chains agree on 12.05 m, on asset-rzut-19a11bc745
    ← 1205 cm (READ) on asset-rzut-19a11bc745
        read as "1205" at [271,9 → 296,22], WITNESS_LINE_PAIR: printed between
        the tick marks 456 px apart on the horizontal chain at 26, missing the
        chain's own scale by 0.009467 px
        glyphs 1(0.52/0.76) 2(0.50/0.52 alt 137) 0(0.63/0.70 alt 845) 5(0.55/0.62 alt 130)
        token box [271,9 → 296,22] at 14 px, slant -6.842773°, bytes abfdb2625576ef47
        rejected "1105" = 1105 cm: implies 2.423246 cm/px against the chain's 2.642489
```

The classifier's own first reading of that token was `1105`. The chain's
arithmetic rejected it, and the rejection is in the artefact with the scale it
would have implied.

## 7. Verification, after the fact

**Projection audit** (non-iterative, never RGB): 8 of 8 openings land on an
observation, mean overlap `0.887`, centres `0.174 m` rms, worst `0.357 m`. 63
observed openings are unexplained by the model — reveal lines, loggia mouths and
shadows that the solver declined to turn into holes.

**Evaluation** against the hand-built reference, run afterwards on the artefact:

| | candidate | reference | |
| --- | --- | --- | --- |
| footprint width | 12.050 m | 12.050 m | **exact**, `HARD` |
| footprint depth | 14.905 m | 14.600 m | +2.1 %, `SOFT` |
| ridge height | 7.950 m | 7.950 m | **exact** |
| storeys | 2 | 2 | |
| openings | 8 built | 23 | 3 matched |
| walls | 8 | 35 | |

- **geometric accuracy 56.3 %** — of what it built, how close it is.
- **evidence-supported completeness 54.3 %** — of the building, how much it
  built at all.

They are reported separately and are never combined. Collapsing them hides two
opposite failures: a little built very precisely, and everything built
confidently and wrongly.

## 8. The second fixture, where the answer is known

`@buildapp/synthetic-drawings` renders a house that exists nowhere else —
9.60 × 7.20 on a 0.30 wall, storeys of 2.80 and 2.60, a 35° roof with a 0.50
overhang — as plan, four elevations and a section, in **a different typeface
from the one the reader matches against**, encoded to real PNG bytes and read
back through the real acquisition contract. The whole pipeline runs on it
unchanged, and the result is checked against the spec the drawings were
rendered from:

| | recovered | truth |
| --- | --- | --- |
| footprint | 9.60 × 7.20 m (`HARD`) | 9.60 × 7.20 |
| storey heights | 2.80, 2.60 m | 2.80, 2.60 |
| roof pitch | 34.99° | 35° |
| eaves overhang | 0.503 m | 0.50 |
| openings | every one on the registered facades, within 6 cm of position, size and sill | |

A pipeline that only reconstructs the one project it was written against has
not been shown to reconstruct anything.

## 9. What the candidate does NOT know

83 named holes, of which the ones that matter:

- **The stair is REFUSED.** One stair symbol was observed and none of the
  drawings fixes a going, a rise, a width or a landing. A stair built from that
  would be a guess dressed as a measurement, so there is no stair in the model
  and the refusal is in the artefact with its reason. The hand-built reference
  stair was not consulted and not copied.
- **The external wall thickness is a convention.** No dimension on the plan
  measures a wall.
- **The roof is one gable over the whole footprint.** The sources show a more
  complex roof; the derived pitch (28.6°) is the pitch that puts the ridge at
  the height the section states, over the span the solver assumed.
- **How far each facade member stands proud is unmeasured.** A view that can see
  depth says they stand proud; nothing says how far. Each is built square in
  section and each is named as a hole.
- **63 observed openings are unexplained**, and 8 detections that did not fit
  the wall they were measured against were refused rather than forced.

## 10. The anti-cheating boundary

Nothing that runs before a candidate is sealed knows which project it is
reconstructing. `tests/architecture/reconstruction.test.ts` reads every source
file under the six production packages and fails on: an import of
`@buildapp/reference-*`; the strings `marcowki`, `marcówki` or `m2fa281446a8ca`
in any case; a read of a stage artefact or a frozen fixture; a model built
outside the replay path; a direct mutation of a model collection; a `fetch` or
a `node:fs` in the solver; an upstream package importing the solver; an
untraced primitive; and a hard constraint averaged with another.

`npm run reconstruct:no-reference` proves it from the other end: it moves
`packages/reference-marcowki` out of the tree, runs the whole candidate path,
and restores it. The run completes and the candidate replays.

## 11. Mutation tests

Fourteen, each changing ONE thing in what the pipeline saw. A pipeline that had
quietly learned its answer passes every accuracy test and fails all fourteen,
because its output does not move when its input does.

A printed dimension changed · a chain token omitted · an ambiguous reading ·
a changed angle annotation · a zone removed from the plan chains · a mass
region removed from a view · a major opening removed · a mirrored elevation ·
one confident false linear-volume candidate · fifty noisy ones · two
contradictory exact constraints · a shifted plan registration · no stair
observations · no reference package.

Two of them are worth reading as claims rather than tests. **A confident false
member with no depth cue does not become a solid** — it becomes a named hole.
**A shifted plan registration does not move a dimension the sheet printed** — a
printed dimension is a statement in centimetres and does not depend on the
sheet's scale at all.

## 12. Where it is visible

**BuildWorld** offers *Marcówki (auto)* beside the demo house and the
reference. It loads by replaying the sealed program — the web app has no solver
— and a card beside it says how each quantity was settled, counts the holes,
and shows all four input hashes. The reference model shows no such card,
because it was not reconstructed.

**Android** ships three scenes: `marcowki` (reference, 178 meshes),
`marcowki-auto` (candidate, 80 meshes, `0986fa57062901f5`) and `demo`. The
preview APK is at
`stage-reports/artifacts/android-preview/BuildPlan-Model-Preview-arm64-v8a-debug.apk`.

## 13. Live vision

Not run. `ANTHROPIC_API_KEY` is absent from this environment, so the stage used
the sealed deterministic observation graph from BUILDAPP-02 throughout:
**`LIVE_PROVIDER_NOT_RUN`**. No VLM response was hand-authored for this project
or any other.

## 14. Gates

| gate | result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | 790 tests, 68 files, all passing |
| `npm run build` | clean |
| `npm run e2e` | 21 Playwright tests passing, including three new reconstruction specs |
| `npm run android:test` | passing |
| `npm run android:assembleDebug` | successful; APK delivered |
| `npm run reconstruct:no-reference` | candidate produced with the reference package absent |

## 15. Recommended next stage

**BUILDAPP-04 — Camera-aware Source-View Verification + Semantic Repair Loop.**

The three things this stage leaves on the table all want the same tool. The
roof is one gable because nothing decomposed the massing into wings; 63
observed openings are unexplained because nothing looked back at the drawing to
ask what they were; the facade members have no depth because no view was ever
solved for a camera. A verification pass that can render the candidate into a
source view and reason about the DIFFERENCE — rather than measuring the
agreement once, as §18's audit does — is what turns each of those from a hole
into a repair.
