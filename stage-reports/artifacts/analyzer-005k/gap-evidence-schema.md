# 005K per-gap evidence — schema and versions

## Versions

| owner | before | after | what changed |
| --- | --- | --- | --- |
| `BOUNDARY_EVIDENCE_VERSION` (`packages/reconstruction/src/boundary-evidence.ts`) | 1.1.0 | **1.2.0** | every gap carries `trace` (`GapTrace`); the boundary record carries `decompositionId`, `mpp`, `drawnGapRule`, `gapEvidence[]`, `gapEvidenceOmitted` |
| `EVIDENCE_PACK_VERSION` (`packages/evidence-pack/src/pack.ts`) | 1.1.0 | **1.2.0** | new file `12b-gap-evidence.json`; new timeline stage `BOUNDARY_GAPS` (between `EXTENT` and `ENVELOPE`); `requiredFiles('1.1.0')` stays complete without the new file (`PACK_FILES_SINCE`) |
| plan digest (`PlanDiagnostics`) | — | additive | `boundary.{decompositionId, mpp, drawnGapRule, gapEvidence, gapEvidenceOmitted}`; `wideOpenings[].id` |
| `CanonicalBuildingModel`, candidate, metric evidence, scene | unchanged | unchanged | nothing a hash covers changed: with the rule OFF the development replay reproduces every sealed model hash and failure code (`development-matrix.json`) |

**Serialisation.**
- Records are plain JSON, serialised by `stableJson` (sorted keys) wherever the digest and the pack write them.
- They are in canonical order (axis, line, start, end, id), at most 400 per reading; the rest is counted in
  `gapEvidenceOmitted`.
- No float is left unrounded: coordinates and shares are `round6`.

## Which gaps are recorded

Every gap of the reading's final wall lines that:
- its classification left WEAK, or
- a later decision made WEAK (a callout that states a width only), or
- the drawn-gap rule upgraded.

Gaps decided STRONG or NONE by the drawing itself are counted in `gaps` (by class), as before, and not recorded.
Corner legs are always STRONG glazing and carry no trace.

## A gap's identity

The bare id `gap-<axis>-<line>-<from>-<to>` is unique **within one reading only**. It recurs:
- on another copy of the plan;
- at another scale;
- under another resolver reading.

For example, 005J found cyklamenach's `gap-Y-196-469-516` at four widths.

A record is therefore always addressed as `<frameId>/<decompositionId>/<gapId>`:

| part | where it comes from |
| --- | --- |
| `frameId` | the plan copy (digest plan, `12b-gap-evidence.json` copy); with `variantByteHash`, the SHA-256 of the raster's bytes |
| `decompositionId` | `dec-` + 16 hex of SHA-256 over the reading's extent, mpp x / y, sheet wall, grid lines and whether pocket mouths were shut (`decompositionIdOf`). The drawn-gap rule's mode is **not** part of it: OFF and ON readings of one sheet share their ids, so their records can be compared one to one |
| `gapId` | the line, the axis it runs along and the gap's two ends, in the frame's pixels |

The Evidence Pack adds, per copy:
- `scaleHypothesisId`: the metric solution's selected hypothesis for the frame;
- the copy's `scale` (mpp x / y, anchors, residual).

Wide openings (`decomposition.wideOpenings`) keep their decision record and get a geometric id
`wide-<axis>-<line>-<from>-<to>` in the digest.

## `GapEvidenceRecord`

| field | meaning |
| --- | --- |
| `gapId`, `decompositionId` | identity (above) |
| `axis` | `X`: a vertical wall line (x fixed) running along y; `Y`: a horizontal one |
| `linePx` | the grid line the wall line was read on |
| `axisPx`, `axisFrom` | the wall's axis across the gap, from the jambs that run along the line (`BOTH`, `LEFT`, `RIGHT`) or the line itself (`LINE`, two walls crossing it) |
| `fromPx`, `toPx`, `start`, `end` | the gap's ends along the line, and both ends on the axis as frame pixels |
| `widthPx`, `widthM`, `mppAlong`, `wallPx` | its width in pixels and metres at this reading's scale; the sheet's wall thickness |
| `jambs`, `jambAlong` | what stands at each end (`WALL`, `POST`), and whether it is a stretch of this wall or a wall crossing the line |
| `jambInk` | per jamb, the share of a wall-square window at the gap's edge, on **that jamb's own axis**, that is wall-thick ink (the wall-solid layer: the ink mask opened by a third of a wall) |
| `bandInk` | the share of the gap's own wall band (its span × the wall's thickness on the axis) that is ink |
| `crop` | the frame rectangle around the gap: at least 1.5 m and four walls past it on every side, clipped to the frame |
| `inkCropSha256` | SHA-256 over `"<w>x<h>\n"` followed by the ink mask inside `crop`, one bit a pixel, rows padded to a byte. The pixels are never stored; a replay checks it decoded the same drawing |
| `strokes` | counts of the lines drawn across the gap (all, inside the wall, continuous, running past a jamb), their best coverage and offsets from the axis (first 12) |
| `signature` | the signature the decision used: `GLAZING`, `LEAF_AXIS`, `LEAF_FACE`, `DASHED`, `BLANK` |
| `signatureRaw` | the signature before the pattern override |
| `signatureLoose` | the signature with every runs-past flag dropped |
| `patternAcross` | glazing read as a pattern across both faces (tiles, treads) |
| `runsPast` | a line across the gap runs on past a jamb |
| `widthRule` | `LINTEL` (≤ 3.2 m), `WIDE` (≤ 8 m), `TOO_WIDE` |
| `classified` | `{cls, boundary}` as `classifyGap` decided, before any callout, garage mouth or rule |
| `final` | `{cls, boundary, occupancy}` in the reading's final wall lines |
| `callout` | the callout assigned to it: width (cm) and confidence, or null |
| `outline` | what the reading's outline did with it: `BRIDGED_STRONG`, `BRIDGED_WEAK` (bridged by what lies behind it), `POCKET_MOUTH` (left open), `NOT_REACHED` (never judged: interior, or past the 48-gap cap), `NOT_ON_OUTLINE` |
| `drawnGapRule` | `{mode, check, upgraded}`: the rule's mode in this run, its conditions on the gap (`DrawnGapCheck`, below; null when the classification was not WEAK) and whether it upgraded it |
| `reasons` | the reason codes, in order: the classification branch, then `CALLOUT_WITH_DRAWN_INFILL` / `CALLOUT_STATES_WIDTH_ONLY`, `SHUT_GARAGE_MOUTH`, `DRAWN_GAP_UPGRADE` |

Classification reason codes:
- WEAK: `INFILL_RUNS_PAST_JAMB`, `NOTHING_DRAWN_WITHIN_LINTEL`, `FACE_OR_DASHED_LINE_WITHIN_LINTEL`,
  `ONE_LINE_BESIDE_PIER`;
- STRONG: `GLAZING`, `LEAF_ON_AXIS`, `VEHICLE_DOOR`, `GLAZING_BETWEEN_PIERS`;
- NONE: `WIDER_THAN_ANY_OPENING`, `CROSS_SECTIONS_NOT_A_HOLE`, `WALL_STOPS_WIDER_THAN_LINTEL`, `FREE_STANDING_BLOCK`.

## `DrawnGapCheck` — the experimental rule's conditions

| condition | holds when |
| --- | --- |
| `wallJambs` | both jambs are WALL, not free-standing blocks |
| `alongJambs` | both jambs are stretches of this wall, not walls crossing the line |
| `withinLintel` | `widthM ≤ 3.2` (the pipeline's lintel convention) |
| `drawn`, `drawnVia` | a door leaf, glazing or face line is drawn across: in `signature` (`SIGNATURE`), in `signatureRaw` (`BEFORE_PATTERN`) or in `signatureLoose` (`WITHOUT_RUNS_PAST`) |
| `inWallBand` | at least one continuous line drawn across lies inside the wall's thickness |
| `jambInk` | both `jambInk` shares ≥ 0.8 (the line reader's own SOLID criterion) |
| `eligible` | all six |

The conditions are recorded for every WEAK gap in every run, rule ON or OFF. With `drawnGapRule: 'ON'` an eligible gap
becomes `OPENING_SUPPORTED` / `STRONG` / `OPENING`, and its reasons end with `DRAWN_GAP_UPGRADE`.

## What a record never holds

- pixels;
- a published figure, an area, a refusal, an outcome, a verdict or a label;
- anything from the source package other than the frame's byte hash, which sits beside the record, not in it.

`tests/architecture/gap-evidence.test.ts` holds this by the code: the imports, the vocabulary, the frozen literals and
the call site.

## Known limits of boundary evidence 1.2.0 (council, stated, not fixed in 005K)

These are recorded as limits rather than fixed: a schema change after the sealed evaluation would itself be a protocol
change. A successor that needs them bumps boundary evidence to 1.3.0.

**`outline` does not separate the cases it lumps together (council A5).**
- `NOT_REACHED` covers two different cases:
  - gaps the flood never reached, which are interior;
  - weak gaps past the 48-gap judging budget. `solveOutline` never judges these and leaves them **bridged by
    default**: 12 of the 60 sealed records (10 OPENING, 2 NOT_A_WALL_LINE), all on A00.
- `BRIDGED_STRONG` is given to every STRONG gap, on the outline or not: an interior gap the rule upgraded reads
  BRIDGED_STRONG.
- A blank gap the outline never judged can still decide a reading's adoption (A05's X-758) and reads NOT_REACHED.
- Absent from the record:
  - the pocket rule's `exposedM2` / `limitM2`;
  - each jamb's own axis and piece extent, so the jamb-ink window and the 1.25-wall along test cannot be replayed;
  - per-stroke flags: `inWall` and `continuous` are counted separately, so `inWallBand` and `signatureLoose` cannot be
    recomputed;
  - the gap's fate under the STRICT policy.
- Only the digest's selected decomposition is recorded. A05 weighed 23.

**The Evidence Pack covers the selected storey's copies only (council C6).**
- `12b-gap-evidence.json` holds the copies of the selected storey.
- A04's attic sheet is in the digest but not in the pack: 8 of 313 weak records, 4 of them in the sealed set.
- `pack.ts`'s "every gap a reading left WEAK" is read as "every such gap on the selected storey's copies".

**Keys (council C7).**
- `frameId / decompositionId / gapId` is unique: 313 / 313 in the fresh runs, 60 / 60 in the manifest.
- `decompositionId` excludes the rule mode (on purpose: OFF and ON compare one to one), the callouts and recogniser, and
  the raster bytes. A join across packs needs `variantByteHash` and the run's metric-evidence hash beside it.
- Inserting the `BOUNDARY_GAPS` timeline stage changes what the timeline lists as downstream of `EXTENT`.

**"Observational" means read-only, not decision-free (council C8).**
- `final`, `outline` and `reasons` are the pipeline's own decisions, recorded.
- Which reading's records are published is chosen by the resolver, which can score readings against the published
  figure. On the fresh set all 9 read sheets are first readings, so its population is free of the figure.

**The decomposition cache key in `layout.ts` omits the rule mode (council C9).** It is safe only while every cache
lives for a single run, as it does today.

**Order (council C2).**
- The records are deterministic for the source as enumerated: shuffling copies, callouts, observations and
  registrations moves nothing.
- They are not invariant to the order of the dimension chains. `gridLines` snaps first-come (pre-existing, upstream of
  the boundary), so a shuffled chain order can move the grid and with it every key.
- The sealed keys are pinned to the chain order the fresh runs produced: metric evidence 1.8.0, chain solver 1.4.0.
