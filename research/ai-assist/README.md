# AI second look and review loop (EXTERIOR-COMPLETE E12–E13, research)

The analyzer's contract for asking a model about something it cannot settle has existed since 005Y-N4
(`packages/source-vision/src/second-look.ts`). E12 ran it live for the first time; E13 corrects how E12 was scored and
adds the review loop of contract v3.42 (`packages/source-vision/src/review-loop.ts`): problem → typed observation →
deterministic validation → domain proposal on a stated revision → variant of the canonical model → compile → compare
with the sources and the model it would replace → accept or roll back, with the decision recorded.

In a Claude Code session the Anthropic host is authenticated by the session itself, so a key cannot be stored for it.
The research transport is Claude Code's headless mode (`claude -p`): the image as a base64 block, the answer as
structured output against a JSON Schema generated from the contract's Zod vocabularies, tools and MCP off, no session
persistence, an empty working directory — no project file, no reference answer is reachable from the call.
The CLI reports `apiKeySource: none` for these calls: the session's own sign-in, not an API key. No credential was
read or printed to establish that. The production adapter (`anthropicVisionReasoner`, SDK + `ANTHROPIC_API_KEY`) is
unchanged and has not been run live; nothing under `packages/` imports this directory; the Android app makes no AI call.

## E13 correction of the E12 scores

E12 reported 15 "independently validated" answers per model. That was wrong: two validators (PRINTED_CHAIN,
WALL_BAND) returned `hypothesisId === q.truth`, i.e. they compared the model's choice with the reference answer.
`run-questions.ts` now keeps runtime validation and grading apart by type: validation sees a `RuntimeQuestion` with no
`truth`, and a fact entails a hypothesis only through the hypothesis's own predicate on the quantity the fact measures
(the printed 200 cm chain: the garage front lies 2.0 m beyond the house front; the wall band: 0.8 m behind). Each
verdict also says what it checked. Re-scored on the same 42 recorded answers (7 questions × 3 runs × 2 models, no new
call), `results-e12-rescored.json`:

| model | correct | validated whole | partial (width only / values only) | no check | validated but wrong | E12 claimed |
| --- | --- | --- | --- | --- | --- | --- |
| claude-haiku-5-5 | 20 / 21 | 6 | 9 | 6 | 0 | 15 |
| claude-opus-5-5 | 21 / 21 | 6 | 9 | 6 | 0 | 15 |

- "105/210": the plan gap checks the width half only; the height stays a suggestion.
- The +8,55 / −0,47 pair: their difference is the published 9.02 m, but where the labels stand was not checked.
- The entailment predicates were written after the cases were known (by the developer), and so were the reference
  answers: the measure is whether the contract works on real failures, not how often a model is right on unseen houses.

## E13 review loop, one whole case (`section-levels-case.ts`)

The analyzer generates the problem from its own record: a section whose registration is MISSING while number-like
tokens stand on it. The question names no value and none of the checks. Haiku is asked first, Opus only when the first
answer fails. A reading is admitted only by the same drawing (`checkLevelReadings`):

1. a level symbol under its box in the frame's bytes;
2. one ladder through the admitted marks (leave one out, with the leverage of a far mark);
3. the published building height as a second, independent check, over the ground mark it is measured from.

The numeric reader's own marks on the section that the admitted ladder overrules — the same printed label read twice
(Goździkowce: +2,96 read +2,46), or a mark off the ladder at its own row — are taken out of the variant and listed
(`supersededLevels`, `superseded.json`). The variant (`levelEvidenceFromReadings`: LEVEL_DATUM evidence and a section
registration, provenance `VISION_VALIDATED`) is solved, compiled and compared with the CV_ONLY model of the same code
on the same inputs by the regression detector:

- any LOST element, any unsourced addition, more compile errors, a door off the floor, a changed printed height or a
  failed source check rolls it back (REJECTED);
- the source checks are the ridge against the printed ridge mark and the ridge over the printed ground against the
  published height;
- anything else the variant changes in an opening (kind, width, sill, height) is a side effect nothing checked — an
  elevation the levels registered now placing it: the variant is not applied, the changes are named, and the person
  decides (DEFERRED).

Every replay of a recorded answer exposed a solver cause, fixed in the solver for every house rather than in the loop
(report E13): the eaves' lip read as the walls' head, a sunk floor taken for the terrain, a misread label kept beside
the right one, a ceiling slab promoted to a storey, an elevation extent the print refutes placing a sill, a passage
read lower than the door behind it. Outcomes per house are in the report; decision records, CV/AI renders and the
CV_ONLY-vs-AI change lists are in the private work directory and the delivery ZIP.

## Cost and trace

Every call is reserved in `spend-ledger.json` at its own cap before it starts and settled after it returns. The limit is
5 USD, counted since E12 and never reset. Per call the trace records:

- the model requested and the models the CLI says answered;
- the session id and the credential category;
- prompt, schema and image hashes;
- tokens in and out, cache reads and writes;
- latency and status;
- `estimatedCostUsd` (the CLI's token estimate, `costBasis: CLI_TOKEN_ESTIMATE`).

`billing` stays `UNCONFIRMED`: whether and from which balance an estimate was charged cannot be known from here. E12's
own calls are in the ledger from their records, without the fields E12 did not yet trace.

The earlier statement that `temperature` returns HTTP 400 on the current model is from the API documentation the
claude-api skill carries, not from an observed call: the adapter simply no longer sends it.
