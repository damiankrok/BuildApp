# VisionReasoner — provider-neutral visual reasoning

> `packages/source-vision` · vision contract **1.0.0**
> Introduced in STAGE BUILDAPP-02.

A coding agent with a good model does not give the PRODUCT visual intelligence.
For BuildApp to read a drawing at runtime it needs its own multimodal path, and
that path has to be swappable: whichever model is best at reading an elevation
this year will not be the best one next year.

```ts
interface VisionReasoner {
  readonly provider: VisionProviderInfo          // id, model, adapter version
  available(request?: VisionObservationRequest): boolean
  analyze(request: VisionObservationRequest): Promise<VisionObservationResponse>
}
```

Three implementations ship: a live Anthropic adapter, a recorded-fixture
replayer for CI, and a null provider that admits there is no provider.

## The contract

A provider is asked a NARROW question about ONE picture and may answer only in
the observation vocabulary. It cannot return a wall, a roof, a mesh, a triangle
or a DSL command because there is nothing in the response schema that could
carry one.

Three decisions are load-bearing:

**Normalized coordinates, not pixels.** A provider answers in [0, 1] of the
image it was handed and is never told a pixel size it could scale by. So it
cannot silently answer about a different copy of the drawing, and a reading
taken off a 1280-wide elevation is directly comparable with the same reading off
a 400-wide one.

**Relations by index.** A provider refers to its own observations by position in
its own list. It never sees, and therefore never invents, a BuildApp id.

**Prose is evidence, not truth.** `evidence` and `notes` are a sentence a human
can check against the image. They land in `provenance.detail`, which is
explicitly outside the graph's content hash: a provider that rewords its
explanation has not changed what it saw.

## The tasks

Narrow, with the vocabulary restricted per task and the JSON Schema GENERATED
from the Zod enums, so the question a provider is asked cannot drift from the
answers the graph will accept.

| task | for | asks for |
| --- | --- | --- |
| `FACADE_DECOMPOSITION` | ELEVATION, PERSPECTIVE_RENDER | silhouette, roof edges and ridge, openings, balcony/loggia **including each side wall or return**, wall planes, **thick linear members with the DEPTH cue that promoted each**, depth and occlusion relations |
| `PLAN_INTERPRETATION` | FLOOR_PLAN | wall bands, opening intervals, room labels and areas, dimension chains, and the **stair as a structure**: the tread lines counted, the direction arrow, the walking line, each winder region — never "a rectangle of the shaft" |
| `SECTION_INTERPRETATION` | SECTION | level datums, ridge and eaves, roof pitch lines, slab lines, the stair where the section cuts it |

There is deliberately no "interpret this building" task. A question that broad
has no checkable answer, and a provider asked it returns a story.

## Validation

Everything a provider returns is treated as a claim from an untrusted source
until it has passed `validateVisionResponse`. The checks correspond to ways a
real multimodal model actually fails:

| code | what it caught |
| --- | --- |
| `SCHEMA_INVALID` | the answer does not fit the observation schema |
| `MALFORMED_JSON` | the answer is not JSON, or is an array |
| `WRONG_ASSET` | it answered about a different picture (the byte hash is echoed and checked) |
| `WRONG_TASK` | it answered a different question |
| `KIND_NOT_ALLOWED` | facade vocabulary on a plan, or the reverse |
| `RELATION_NOT_ALLOWED` | an identity relation asserted from a single image |
| `GEOMETRY_ARITY` | a POLYGON with two points, a RECT with five |
| `DEGENERATE_GEOMETRY` | a zero-length segment, a zero-area polygon |
| `OUT_OF_BOUNDS` | a coordinate outside the image it was shown |
| `RELATION_INDEX` | index 7 in a list of four, or a self-relation |
| `TOO_MANY_OBSERVATIONS` | more than were asked for |
| `NO_ANSWER` | the model answered in prose instead of calling the tool |

A rejected answer is discarded WHOLE. There is no partial acceptance: a response
that is wrong about the picture it looked at is not more trustworthy in its
other half. Rejections are recorded as named gaps in the graph, so a run with a
refused vision pass is distinguishable from one with no vision pass at all.

## From an answer to observations

`applyVisionResponse` writes a validated response onto a builder. The caller
supplies the frame, so a provider can never choose which drawing its answer
lands on, and the call refuses outright if the response's byte hash does not
match the frame's. Two adjustments are made and both are recorded:

- normalized coordinates become pixels on the frame's DECODED size;
- positional uncertainty is floored at one pixel, and where the floor bites the
  provenance says so.

## The live adapter

`anthropicVisionReasoner` uses the official SDK, sends the image as a base64
block, attaches the task's JSON Schema as a tool and REQUIRES the model to call
it, at temperature 0. There is no prose-parsing fallback: an answer that did not
call the tool is `NO_ANSWER`, because "extract the JSON from the markdown" is a
way to accept an answer the model did not commit to.

The key comes from `ANTHROPIC_API_KEY` in the environment. **No secret is in the
repository.** A missing key is `VisionUnavailable('NO_CREDENTIALS')` and never a
silent fallback to something that fabricates an answer.

```bash
ANTHROPIC_API_KEY=… npm run observations:extract -- package.json --cache dir --live --record fixtures/
```

`--record` writes each accepted answer as a fixture, so a live run becomes a
replayable one.

## Fixtures, and what they are not

A fixture is an answer keyed by the BYTES it describes, replayed against the
same bytes. Change the picture and the fixture stops matching, loudly, instead
of quietly describing the old one. A replay goes through exactly the same
validation a live answer gets, which is what makes rejection itself testable.

A fixture provider says it is one: its `provider.id` is `vision.fixture` and the
provider it replays is carried in `recordedFrom`, so nothing downstream can
mistake a replay for a live call. The fixture set's own digest is the provider
version, so editing a fixture re-hashes every graph built from it.

The fixtures in this repository are **hand-authored answers about synthetic test
images**, built in the tests that use them and labelled as such. There are
deliberately none about the benchmark's real drawings: a hand-written answer
about the Marcówki facade would be a person doing the vision work and the
pipeline taking the credit, and the benchmark would then measure nothing. The
benchmark therefore runs deterministic-CV-only and reports
`LIVE_PROVIDER_NOT_RUN` until a key is supplied.

## When there is no provider

`nullVisionReasoner` throws `VisionUnavailable`. It does not return an empty
answer, because an empty answer is indistinguishable from a model that looked
and saw nothing — and the difference matters: one means the facade has no
visible frame members, the other means nobody looked. The analyzer records the
absence as a `NOT_ATTEMPTED` gap per asset and once for the whole package.

## Deterministic CV is not a fallback

`packages/source-cv` and the extractors in `packages/source-analyzer` run
FIRST and UNCONDITIONALLY; a vision pass adds observations alongside them, never
in place of them. The two are good at different things — arithmetic over pixels
is exact about where a line is and blind to what it means; a model is the
reverse — and an observation that appears in both is worth more than either.
That is what "do not rely only on a VLM" means in code.
