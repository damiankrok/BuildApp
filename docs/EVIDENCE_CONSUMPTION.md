# The Evidence Consumption Ledger

> `buildapp.evidence-consumption-ledger` **1.0.0** · `packages/reconstruction/src/v2/ledger.ts`
> Written by `reconstructV2` as `stage-reports/artifacts/analyzer-v2/evidence-consumption.json`. Introduced in STAGE BUILDAPP-03X.

The ledger answers one question for every piece of evidence the analyzer was
given: what became of it. The previous analyzer's worst failure was silent — a
zone was detected, its return stubs were drawn on the plan, and the model had
no recess, with nothing recording where the evidence stopped
(`docs/ANALYZER_FORENSIC_AUDIT.md`, §11). The ledger makes that impossible to
do quietly. Every observation in the graph, every metric reading, every
published page fact and every published room receives exactly one
disposition, with a reason a reader can check and the stage it was taken at;
`ledgerViolations` refuses a ledger in which an id is missing, dispositioned
twice, used in the model without naming the feature, or dropped at high
authority with no real reason. On the reference run the ledger holds 1058
records and no violation.

## 1. The record

`EvidenceConsumptionRecordSchema` is strict; a record has exactly these fields.

| field | type | meaning |
| --- | --- | --- |
| `evidenceId` | string | the id of the observation (`obs-…`), metric reading (`metric-…`), page fact (`page:<key>`) or published room (`page:room:<storey>:<index>`) |
| `evidenceKind` | `OBSERVATION` \| `METRIC` \| `PAGE_FACT` \| `PAGE_ROOM` \| `SIGHTING` \| `MEASUREMENT` | what kind of evidence it is |
| `what` | string | a reader's description: `LINEAR_DIMENSION 282 on fed2722c38`, `callout 275/275`, `MASS_REGION on the left render` |
| `authority` | `HIGH` \| `MEDIUM` \| `LOW` | how much the evidence is worth on its own: a printed figure is HIGH, an extractor's rectangle is MEDIUM or LOW |
| `featureId` | string, optional | the solved feature (`feat-…`) the evidence went into; required by the invariants when the disposition is `USED_IN_MODEL` |
| `disposition` | one of six | what became of it (section 2) |
| `reason` | string | why, in words |
| `stage` | one of fourteen | the pass the disposition was taken at (section 3) |

The sealed ledger (`EvidenceConsumptionLedgerSchema`) wraps the records with
`schema`, `schemaVersion`, an `id` (`ledger-<slug>`), the `featureGraphHash`
of the feature graph it was written beside, a `summary` of counts per
disposition and a `contentHash`.

## 2. The six dispositions

| disposition | it is legitimate when |
| --- | --- |
| `USED_IN_MODEL` | a number or a shape from this evidence is in the model, and the record names the feature that carries it. A callout's width and height; a chain segment that fixes a body's span; the roof pitch statement; a level datum. |
| `USED_AS_CORROBORATION` | the evidence agrees with something the model got elsewhere and was checked against it, but contributed no figure of its own. A wall band on a plan the v2 pass re-read from the same pixels; a silhouette a render was registered by; a ridge line the registration was checked against; a published footprint area the gate compared with the bodies. |
| `CONFLICTED` | the evidence contradicts something else and the contradiction is recorded rather than averaged. Defined; not produced on the reference run. |
| `UNRESOLVED` | the evidence is real and was not used because nothing decided what it belongs to. A printed callout that matched no wall gap of its width within reach; a published room whose number no polygon carries. |
| `REJECTED_WITH_REASON` | the evidence was examined and judged not to be what its kind claims, and the reason is stated. A ring read at no coherent confidence is "a circle on the sheet, not a callout"; a tone band with no depth behind it is "a stripe, not a volume". |
| `IGNORED_WITH_REASON` | the evidence was not examined by this analyzer, and the reason is a property of the analyzer, not of the evidence. A dimension on a drawing the v2 frame does not register; a colour region ("colour, not geometry"); an aggregate page fact from which no geometry may be derived; an observation on a perspective with no solved camera. |

The line between `USED_IN_MODEL` and `USED_AS_CORROBORATION` is whether a
figure travelled. The ground plan's 64 `WALL_BAND` observations are
corroboration: the v2 interior and opening passes read the same raster
directly, so the bands agree with what was built but no band's coordinates
became a wall. The eleven ring callouts that matched a gap are in the model:
their centimetres are the openings' widths and heights, and each record names
its opening. The line between `REJECTED_WITH_REASON` and
`IGNORED_WITH_REASON` is whether the analyzer looked: a rejected ring was
read and failed; an ignored `SURFACE_REGION` was never going to be read,
because finish regions are read from the registered renders directly.

## 3. The stages

`PipelineStageSchema` names the brief's passes: `ACQUISITION`, `ATLAS`,
`REGISTRATION`, `OBSERVATION`, `METRIC`, `IDENTITY`, `TOPOLOGY`,
`METRIC_SOLVE`, `ASSEMBLY`, `DSL`, `GEOMETRY`, `VERIFICATION`, `REPAIR`,
`QUALITY`. A disposition is taken at the earliest pass that settles it: the
chain segments of a body at `TOPOLOGY`, the callouts at `METRIC_SOLVE`, the
silhouettes at `REGISTRATION`, the stripes at `ASSEMBLY`, the page facts and
rooms at `QUALITY`, and everything the passes did not name at `OBSERVATION`
or `METRIC` in the closing sweep. Eight stages appear on the reference run;
`ACQUISITION`, `ATLAS`, `DSL`, `GEOMETRY`, `VERIFICATION` and `REPAIR` are
defined and unused, because the evidence those passes consume is already
dispositioned by the time they run.

## 4. The invariants

`ledgerViolations(records, expectedEvidenceIds)` returns a list of violations;
empty means the ledger is honest. It checks:

1. **One disposition per id** — `evidence <id> has <n> dispositions`.
2. **Every expected id covered** — `evidence <id> has no disposition`. The
   expected ids are every observation of the graph and every reading of the
   metric evidence set; page facts and rooms are dispositioned in addition,
   not expected.
3. **`USED_IN_MODEL` names a feature** — `<id> is USED_IN_MODEL but names no
   feature`. The audit and the architecture test go further and require that
   feature to be one the graph solved.
4. **A HIGH-authority drop needs a real reason** — a `REJECTED_WITH_REASON` or
   `IGNORED_WITH_REASON` record at `HIGH` authority whose trimmed reason is
   shorter than twelve characters is `dropped with no real reason`.

`tests/architecture/analyzer-v2.test.ts` runs these over the committed ledger
against the committed observation graph and metric set, and
`npm run audit:analyzer-v2` runs them again off disk.

## 5. How the orchestrator completes the ledger

`reconstructV2` keeps a `consumed` map from evidence id to record and writes
through one helper, `record(r)`. A stronger disposition replaces a weaker one
and nothing is recorded twice: the ranks are `USED_IN_MODEL` 5,
`USED_AS_CORROBORATION` 4, `CONFLICTED` 3, `UNRESOLVED` 2,
`REJECTED_WITH_REASON` 1, `IGNORED_WITH_REASON` 0, and at equal rank the
first record stands. This is why a chain segment that is both a body's span
and a zone's printed depth appears once, as `the body's span`: the mass pass
records it first, and the recess pass's `the recess depth` record has the same
rank.

Records are taken inside the passes as the evidence is consumed:

- the chain segments of each mass (`METRIC`, `HIGH`, `USED_IN_MODEL`, stage
  `TOPOLOGY`, feature `feat-main` / `feat-attached-0`);
- the section's level datums (`USED_IN_MODEL`, `METRIC_SOLVE`, feature
  `feat-level-0`, reason `the storey levels and the ridge`);
- each registered render's `SILHOUETTE` and `MASS_REGION` observations
  (`USED_AS_CORROBORATION`, `REGISTRATION`: "the silhouette the render was
  registered by; every feature read on the render rests on it");
- the roof pitch statement (`USED_IN_MODEL`, `METRIC_SOLVE`, `feat-roof-main`);
- the section's `STAIR` observations (`USED_AS_CORROBORATION`, `IDENTITY`:
  "corroborates the riser count of the lowest flight");
- each callout that matched a gap (`USED_IN_MODEL`, `METRIC_SOLVE`, the
  opening's feature, "the opening's printed width and height");
- every `LINEAR_VOLUME_CANDIDATE` (`ASSEMBLY`): on an unregistered view
  `IGNORED_WITH_REASON`; on a registered render `USED_AS_CORROBORATION` when
  it lies on a member the plan or a recess gives depth to, else
  `REJECTED_WITH_REASON`;
- every observation on a perspective render (`REGISTRATION`, `LOW`):
  `USED_AS_CORROBORATION` when its camera solved, else `IGNORED_WITH_REASON`.

Then, after sealing the candidate, a closing sweep gives every remaining id a
disposition. Observations, by kind, at stage `OBSERVATION` with authority
`MEDIUM` at confidence ≥ 0.75 and `LOW` below: `WALL_BAND`,
`OPENING_INTERVAL`, `ROOF_EDGE`, `RIDGE`, `STAIR`, `STAIR_SYMBOL`, `POLYLINE`
and `LEVEL_DATUM` are corroboration; `OPENING` and `LOGGIA` are corroboration
on a registered elevation and ignored elsewhere; `SURFACE_REGION`,
`WALL_REGION` and `PARALLEL_LINE_FAMILY` are ignored with their reasons; any
other kind is "read for the record; the v2 passes read this drawing's pixels
directly". Metric readings, at stage `METRIC` with authority `HIGH` at
confidence ≥ 0.6 and `MEDIUM` below: an `OPENING_CALLOUT` is `UNRESOLVED`
when the ring reader gave it a coherent confidence (≥ 0.2) and
`REJECTED_WITH_REASON` otherwise; a `LINEAR_DIMENSION` on a frame the v2
plans do not register is ignored; an `ANGLE` and everything else is
corroboration. Page facts (`PAGE_FACT`, `HIGH`, `QUALITY`): a footprint key is
corroboration, any other aggregate is ignored. Published rooms (`PAGE_ROOM`,
`MEDIUM`, `QUALITY`): corroboration when a room polygon carries the number
and the label, `UNRESOLVED` otherwise.

The `SIGHTING` and `MEASUREMENT` kinds are in the schema and the module's
header says every v2 sighting gets a disposition, but the orchestrator never
records either: sightings live in the feature graph, not the ledger.

## 6. Reading `evidence-consumption.json`

The file is the sealed ledger: `schema`, `schemaVersion`, `id`
(`ledger-marcowki`), `featureGraphHash` (equal to the `contentHash` of
`feature-lineage.json` beside it), `records` sorted by `evidenceId` then
`stage`, `summary`, `contentHash`. To find what happened to a piece of
evidence, search its id; to find what a feature rests on, search its
`feat-…` id in `featureId`; to find what was thrown away at high authority,
filter `authority: "HIGH"` against the two dropping dispositions and read the
reasons. The `what` field carries the kind, the raw text and the last ten
characters of the frame id, which is enough to find the frame in
`registrations.json` or the overlays.

## 7. The reference run in numbers

1058 records; `ledgerViolations` empty.

| disposition | records |
| --- | ---: |
| `USED_AS_CORROBORATION` | 732 |
| `IGNORED_WITH_REASON` | 163 |
| `REJECTED_WITH_REASON` | 99 |
| `UNRESOLVED` | 40 |
| `USED_IN_MODEL` | 24 |
| `CONFLICTED` | 0 |

By kind and disposition:

| kind | total | in model | corroboration | unresolved | rejected | ignored |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `OBSERVATION` | 888 | 0 | 697 | 0 | 78 | 113 |
| `METRIC` | 142 | 24 | 32 | 24 | 21 | 41 |
| `PAGE_FACT` | 10 | 0 | 1 | 0 | 0 | 9 |
| `PAGE_ROOM` | 18 | 0 | 2 | 16 | 0 | 0 |

By stage: `OBSERVATION` 594, `REGISTRATION` 202, `METRIC` 118, `ASSEMBLY` 91,
`QUALITY` 28, `METRIC_SOLVE` 16, `TOPOLOGY` 8, `IDENTITY` 1. By authority:
`HIGH` 41 (24 in model, 1 corroboration, 4 unresolved, 12 ignored), `MEDIUM`
357 (184 corroboration, 99 rejected, 36 unresolved, 38 ignored), `LOW` 660
(547 corroboration, 113 ignored).

The 24 `USED_IN_MODEL` records are the eleven matched callouts (one per
facade opening with a printed size), eight chain segments of the main body,
four level datums and the published 40° pitch. The four HIGH-authority
`UNRESOLVED` records are callouts read at full confidence — `110/290`,
`100/210`, `105/210`, `140/140` on the 03R plan variant `863ec969ff` — that
matched no gap within reach, because that variant is not one of the two
plans v2 registers; their twins on the registered ground plan `33a5ff46cd`
are the ones in the model. The twelve HIGH `IGNORED_WITH_REASON` records are
three dimensions on unregistered sheets and nine aggregate page facts.

## 8. Real records, side by side

`USED_IN_MODEL` — the figure is in the model and the feature is named:

> `metric-callout-ring-6d3a713075` · METRIC · HIGH · `callout 275/275` · feature `feat-opening-0-front-8-0` · stage `METRIC_SOLVE` · reason "the opening's printed width and height"

> `metric-spec-roof-angle-a196295353` · METRIC · HIGH · `the roof pitch statement` · feature `feat-roof-main` · stage `METRIC_SOLVE` · reason "the main roof pitch"

`USED_AS_CORROBORATION` — checked against, nothing taken:

> `obs-wall-band-wall-band-0150c4d10c` · OBSERVATION · LOW · `WALL_BAND on plan 6eb2541c24` · stage `OBSERVATION` · "the plan's wall bands corroborate the bodies and partitions the v2 pass read from the same raster"

> `obs-mass-region-unknown-22f0b0f49e` · OBSERVATION · MEDIUM · `MASS_REGION on the left render` · stage `REGISTRATION` · "the silhouette the render was registered by; every feature read on the render rests on it"

> `page:footprint…` · PAGE_FACT · HIGH · `Powierzchnia zabudowy 131.16 m2` · stage `QUALITY` · "checked against the bodies' area by the layout gate"

`REJECTED_WITH_REASON` — examined and found not to be what its kind says:

> `metric-callout-ring-69f0fe8c44` · METRIC · MEDIUM · `OPENING_CALLOUT 226/400 on d7b403e37e` · stage `METRIC` · "a ring read as "226/400" at no coherent confidence (0.078901): a circle on the sheet, not a callout"

> `obs-linear-volume-candidate-…` · OBSERVATION · MEDIUM · `a linear volume candidate` · stage `ASSEMBLY` · "no plan return, recess or slab level gives it depth: a stripe, not a volume"

`IGNORED_WITH_REASON` — not examined, for a reason that is the analyzer's:

> `obs-surface-region-cladding-029535aa7c` · OBSERVATION · LOW · `SURFACE_REGION on elevation 9a66c9827c` · stage `OBSERVATION` · "colour, not geometry: finish regions are read from the registered renders directly"

> `page:boiler_room_area` · PAGE_FACT · HIGH · `Powierzchnia kotłowni 5.8 m2` · stage `QUALITY` · "an aggregate: no geometry may be derived from it"

> `obs-loggia-recess-mouth-19e2c84f7a` · OBSERVATION · LOW · `LOGGIA on a perspective render` · stage `REGISTRATION` · "no camera could be solved for this render, so nothing on it can be placed"

`UNRESOLVED` — real, and nothing decided what it belongs to:

> `metric-callout-ring-06c77cf6b8` · METRIC · MEDIUM · `OPENING_CALLOUT 48/400 on 33a5ff46cd` · stage `METRIC` · "a printed opening callout that matched no wall gap of its width within reach"

> `page:room:ATTIC:1` · PAGE_ROOM · MEDIUM · `ATTIC 1 Korytarz 6.17` · stage `QUALITY` · "no room polygon carries this number"

The difference the reader should take from these: a `USED_IN_MODEL` record
can be followed into `feature-lineage.json` by its `featureId` and from there
into the model by the feature's binding; a `USED_AS_CORROBORATION` record
cannot, because nothing in the model came from it; and the two dropping
dispositions each say whose fault the drop is — the evidence's (rejected) or
the analyzer's (ignored).

## 9. What the ledger does not yet do

- `CONFLICTED` is never produced; contradictions between a callout and an
  elevation extent are recorded on the opening's `unresolved` list and in the
  feature's `unresolvedProperties`, not as a ledger disposition.
- Sightings and measurements are not ledgered (`SIGHTING`, `MEASUREMENT`
  unused), and six of the fourteen stages never appear.
- The attached roof pass records the level datums a second time as
  `USED_IN_MODEL` without a `featureId`; the record is discarded because the
  first, complete record has the same rank, but the order of the passes is
  what keeps invariant 3 satisfied there.
- The authority of an observation is a threshold on the extractor's
  confidence (0.75) and of a metric reading on the reader's (0.6); it is not
  yet a statement about the kind of evidence.
