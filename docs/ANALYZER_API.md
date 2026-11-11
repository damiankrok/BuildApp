# Analyzer HTTP API — `buildapp.analyzer-api` v1

> Stage BUILDAPP-03Y1. Service: `apps/analyzer-api`. Pipeline: `@buildapp/analysis-service` (`runAnalysis`) — the SAME function the CLI `npm run reconstruct:v2` calls. Clients: Android (`apps/android`, Analyzer screen) and web (`apps/web`, Analyze panel). Both speak exactly this contract.

```
Android / Web client ─► Analyzer HTTP API ─► job runner (worker thread per job)
    ─► runAnalysis: SourcePackage ─► analyzer v2 ─► CanonicalBuildingModel
    ─► geometry compiler ─► MobileSceneBundle + hashes ─► client
```

There is one analyzer. The API holds no project knowledge, no reference model, no benchmark and no sealed candidate: it analyses whatever page it is given, with the publishers it registers (today: `archon.pl`), and says how sure it is.

## Conventions

- JSON everywhere, UTF-8. Every error is `{"error": {"code": "<CODE>", "message": "<sentence for a person>"}}`. A message never contains a filesystem path, a stack or a host name of the service.
- Job ids are opaque: 32 lowercase hex characters (128 random bits). Anything else in the id position is `404 NOT_FOUND`.
- No authentication, no API key, no cookie. Abuse control is server-side (rate limits, queue bound, publisher allowlist, time limit, byte limits). A client never holds a secret.
- CORS: `Access-Control-Allow-Origin` is `*` unless `ANALYZER_CORS_ORIGINS` narrows it. No credentials are ever accepted, so `*` exposes nothing.
- HTTPS: the service runs behind the platform's TLS terminator. With `ANALYZER_REQUIRE_HTTPS=1` a request whose `X-Forwarded-Proto` is not `https` is refused with `403 HTTPS_REQUIRED` (only `/health` is exempt, for the platform's own probe), and every response carries `Strict-Transport-Security`.

## Endpoints

### `GET /health`

`200`

```json
{
  "status": "ok",
  "service": "buildapp-analyzer-api",
  "version": "1.0.0",
  "analyzer": { "service": "1.0.0", "solver": "2.2.0" },
  "publishers": ["archon.pl"],
  "vision": "DETERMINISTIC_ONLY",
  "queue": { "running": 0, "queued": 0, "concurrency": 1, "capacity": 8 }
}
```

`vision` is `LIVE_PROVIDER_CONFIGURED` only when the SERVER has a vision provider configured; the credential never leaves the server.

### `POST /v1/analyses`

Request: `Content-Type: application/json`, body ≤ 4 KiB:

```json
{ "url": "https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca" }
```

`202 Accepted`, `Location: /v1/analyses/<jobId>`:

```json
{ "jobId": "3f9c…", "status": "QUEUED", "links": { "self": "/v1/analyses/3f9c…" } }
```

Refusals, before anything is fetched or queued:

| status | code | when |
|---|---|---|
| 400 | `BAD_REQUEST` | body is not a JSON object |
| 400 | `INVALID_URL` | not a URL, not `https`, > 2048 chars |
| 400 | `SOURCE_UNSAFE` | not safe to fetch on a user's behalf: credentials, non-443 port, IP literal, `localhost`/`.local`/`.internal` (INTEGRATION-004A: the security fence, separate from publisher recognition) |
| 413 | `BODY_TOO_LARGE` | body > 4 KiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | not `application/json` |
| 422 | `UNSUPPORTED_PUBLISHER` | no specialist adapter understands the host AND no generic reader is registered. Production registers the generic project-page reader (004A), so an unknown host is fetched and inspected instead: see `SOURCE_NOT_PROJECT` / `SOURCE_REQUIRES_RENDERING` below |
| 429 | `RATE_LIMITED` | this client submitted too many analyses recently; `Retry-After` seconds |
| 503 | `QUEUE_FULL` | the bounded queue is full; `Retry-After` seconds |

### `GET /v1/analyses/:jobId`

`200` — poll this every 1–3 s while `status` is not terminal:

```json
{
  "jobId": "3f9c…",
  "status": "EXTRACTING_OBSERVATIONS",
  "progress": 0.31,
  "stage": { "id": "EXTRACTING_OBSERVATIONS", "label": "Reading the drawings", "index": 2, "count": 9, "fraction": 0.4, "detail": "drawing 9 of 20" },
  "stages": [
    { "id": "ACQUIRING_SOURCE", "label": "Fetching the project page and its drawings", "state": "DONE", "startedAt": "…", "completedAt": "…" },
    { "id": "CLASSIFYING_SOURCES", "label": "…", "state": "DONE", "startedAt": "…", "completedAt": "…" },
    { "id": "EXTRACTING_OBSERVATIONS", "label": "…", "state": "RUNNING", "startedAt": "…" },
    { "id": "REGISTERING_VIEWS", "label": "…", "state": "PENDING" }
  ],
  "sourceUrl": "https://www.archon.pl/…",
  "createdAt": "…", "updatedAt": "…", "startedAt": "…", "completedAt": null,
  "error": null,
  "result": null,
  "links": { "self": "/v1/analyses/3f9c…" }
}
```

- `status` ∈ `QUEUED`, `ACQUIRING_SOURCE`, `CLASSIFYING_SOURCES`, `EXTRACTING_OBSERVATIONS`, `REGISTERING_VIEWS`, `SOLVING_TOPOLOGY`, `SOLVING_METRICS`, `BUILDING_MODEL`, `COMPILING_SCENE`, `VERIFYING`, `COMPLETED`, `FAILED`, `CANCELLED`.
- `stages[].state` ∈ `PENDING`, `RUNNING`, `DONE`, `FAILED`, `CANCELLED`. The list always has all nine stages in pipeline order.
- `progress` (0..1) is the position in the pipeline: it moves when a stage starts or finishes and, while reading drawings, per drawing. It never moves on a timer and never decreases. `stage` is `null` while `QUEUED` and after a terminal status.
- On `FAILED` / `CANCELLED`: `error` is `{code, message}` with `code` ∈ `SOURCE_REFUSED`, `SOURCE_UNREACHABLE`, `UNSUPPORTED_PUBLISHER`, `SOURCE_NOT_PROJECT` (the page was fetched and inspected and no house project was recognised on it), `SOURCE_REQUIRES_RENDERING` (the page's content exists only after a browser runs its scripts), `NO_DRAWINGS` (a project with no technical drawing), `SOURCE_INCOMPLETE` (a project with drawings but no floor plan or elevation), `RECONSTRUCTION_FAILED`, `ANALYSIS_FAILED`, `TIMEOUT`, `CANCELLED`, `SERVICE_RESTARTED`, `INTERNAL`.
  Since BUILDAPP-03Y2G `error` may also carry, all optional:
  - `reasonCode`: the solver's own code, e.g. `PLAN_NO_ENCLOSED_CELLS`, `PLAN_LAYOUT_REJECTED`, `MODEL_EMISSION_FAILED`, `VERIFY_REPLAY_FAILED`, or `INTERNAL_ERROR`.
  - `stage`: the stage that was running.
  - `substage`: the step inside it, e.g. `PLAN_DECOMPOSITION`.
  - `title`: a heading for a person.
  - `diagnostics`: flat counts of how far the reading got, such as plan frames, dimension chains read, wall bands, grid lines, cells, enclosed cells, built regions and masses.
  - `RECONSTRUCTION_FAILED`: the analyzer read the drawings and knows why no building followed. `reasonCode` says why.
  - `ANALYSIS_FAILED`: only an unexpected error. It keeps the `stage` it happened in, with `reasonCode: INTERNAL_ERROR`.
  - No field carries a path, a stack trace or source bytes.

  The reason codes (`packages/reconstruction/src/failure.ts`, with a title for each):

  | Family | Codes |
  |---|---|
  | Plan | `PLAN_NOT_FOUND`, `PLAN_NOT_DECODABLE`, `PLAN_NO_DIMENSION_FRAME`, `PLAN_NO_WALL_BANDS`, `PLAN_NO_WALLED_ENVELOPE`, `PLAN_GRID_EMPTY`, `PLAN_NO_ENCLOSED_CELLS`, `PLAN_NO_BUILT_REGIONS`, `PLAN_NO_MASSES`, `PLAN_LAYOUT_REJECTED`, `PLAN_STOREY_ALIGNMENT_FAILED`, `PLAN_STOREY_ALIGNMENT_AMBIGUOUS` |
  | Views | `VIEW_REGISTRATION_NO_ANCHORS`, `VIEW_REGISTRATION_AMBIGUOUS`, `ELEVATION_REGISTRATION_FAILED`, `SECTION_REGISTRATION_FAILED` |
  | Solving and emission | `TOPOLOGY_NO_VALID_HYPOTHESIS`, `METRIC_SOLVE_FAILED`, `MODEL_EMISSION_FAILED` |
  | Scene and verification | `SCENE_COMPILE_FAILED`, `VERIFY_REPLAY_FAILED`, `VERIFY_CLOSURE_FAILED` |
  | Unexpected | `INTERNAL_ERROR` |
- `activity` (BUILDPLAN-ANALYZER-005A, optional; present only while a stage runs) says what the run is doing, by counts, and whether it is alive:

  ```json
  "activity": {
    "phaseId": "METRIC_FRAMES", "phaseLabel": "reading printed dimensions and callouts",
    "subphaseId": "CALLOUT_RINGS", "subphaseLabel": "searching callout rings",
    "activity": "COMPUTE", "workDone": 3, "workTotal": 10, "unit": "FRAME",
    "assetIndex": 4, "assetTotal": 10,
    "heartbeatSeq": 41, "elapsedMs": 90000, "phaseElapsedMs": 12000,
    "diagnosticCounters": { "rings": 37, "ringsTotal": 150, "readings": 5 },
    "heartbeatAgeMs": 800
  }
  ```

  - `phaseId` comes from a closed list (`ANALYSIS_PHASES`, `packages/analysis-service/src/checkpoint.ts`), so a client can key its own words by id.
  - `workTotal` is `null` while the total is unknown. A client then shows no fraction rather than a guess.
  - `activity` is `COMPUTE` when a loop just crossed a boundary, and `IO_WAIT` while the run waits on the publisher.
  - `heartbeatSeq` moves every time the analyzer's own loops cross a boundary (at most one record a second; the store is written at most every 2 s, phase changes always).
  - `heartbeatAgeMs` is computed by the server at read time: how long ago that heartbeat was.
  - A client tells a heavy step (heartbeats, frozen counts) from a stalled analyzer (no heartbeat) from these two alone. `progress` stays the secondary summary.
- On `COMPLETED`: `result` is a short summary (below) and `links` gains `result`, `scene`, `model`, `candidate`.

```json
"result": {
  "title": "Dom w marcówkach (GE)",
  "label": "Dom w marcówkach (GE) (analysis)",
  "candidateHash": "…64 hex…",
  "modelHash": "…",
  "sceneSha256": "…",
  "sceneContentHash": "…",
  "sceneBytes": 3456789,
  "quality": { "L0": 12, "L1": 30, "L2": 18 },
  "unresolved": 2,
  "warnings": 3,
  "vision": "DETERMINISTIC_ONLY"
}
```

### `GET /v1/analyses/:jobId/result`

`200` — the full summary (`LinkAnalysisSummary`, `packages/analysis-service/src/result.ts`): every hash (`sourcePackageHash`, `observationGraphHash`, `metricEvidenceHash`, `candidateHash`, `modelHash`, `modelSha256`, `sceneContentHash`, `sceneSha256`), `counts`, `quality.levels` `{L0, L1, L2}`, `quality.byFamily`, `unresolved[] {what, reason, status}`, `warnings[]`, `warningDetails[] {code, severity, message}` (005A: `severity` is `INFO` when the sentence is about how the run worked — no vision provider, a guessed larger copy that definitely does not exist (HTTP 404 or 410, or an offline replay that never had it), a duplicate counted once — and `LIMITING` when something about the house was not read or did not check out: an exposed drawing not read (`SOURCE_ADDRESS_*`), a guessed copy that could not be read and may exist (`GUESSED_ADDRESS_UNREAD_*`), every degrading reason of the layout gate on the sealed building (`LAYOUT_<code>`, e.g. `LAYOUT_PLAN_RESOLVED_BY_HYPOTHESIS`, `LAYOUT_FOOTPRINT_AREA_NEAR`), an opening the drawings print that was not built (`OPENINGS_NOT_BUILT`), residuals, joints and invariants; `packages/analysis-service/src/warnings.ts`; a client calls a result limited on `LIMITING` warnings and unresolved items only), `vision {mode, provider, attempted, accepted}`, `verification {replay, residuals, residualsOutsideTolerance, closure}`, `analyzer`, `startedAt`, `completedAt`, plus `links`. No candidate, model or scene inline.

`409 NOT_READY` while the job is not `COMPLETED`; `410 GONE` when the job failed or was cancelled (no result exists); `404 NOT_FOUND` for an unknown or expired job.

### `GET /v1/analyses/:jobId/scene`

`200`, `Content-Type: application/json`, the EXACT bytes of the `buildapp.mobile-scene-bundle` the phone renders. Headers: `ETag: "<sceneSha256>"`, `X-Content-SHA256: <sceneSha256>`, `Content-Length`. A client MUST check `sha256(body) == summary.sceneSha256` and `bundle.contentHash == summary.sceneContentHash` before keeping it.

### `GET /v1/analyses/:jobId/model`

`200`, the `CanonicalBuildingModel` JSON (exact `serializeModel` bytes), `X-Content-SHA256: <modelSha256>`. The web client loads this.

### `GET /v1/analyses/:jobId/candidate`

`200`, the sealed `ReconstructionCandidate` (its program replays to `modelHash`).

### `DELETE /v1/analyses/:jobId`

Cancel. `202 {"jobId", "status": "CANCELLED"}` for a queued or running job (a running job's worker is terminated at once); `409 ALREADY_FINISHED` for a terminal one.

## Limits (server configuration, `apps/analyzer-api/src/config.ts`)

| env | default | meaning |
|---|---|---|
| `PORT` | 8080 | listen port |
| `ANALYZER_DATA_DIR` | `./.data/analyzer` | job store root (records + results; per-job scratch under it) |
| `ANALYZER_CONCURRENCY` | 1 | jobs running at once (one worker thread each) |
| `ANALYZER_MAX_QUEUED` | 8 | queued jobs beyond the running ones |
| `ANALYZER_JOB_TIMEOUT_MS` | 900000 | a job is terminated after this long (`TIMEOUT`) |
| `ANALYZER_RESULT_TTL_HOURS` | 72 | completed/failed jobs are deleted after this |
| `ANALYZER_MAX_STORED_JOBS` | 200 | oldest finished jobs are evicted beyond this |
| `ANALYZER_RATE_LIMIT_MAX` / `_WINDOW_MS` | 6 / 600000 | analyses a client may submit per window |
| `ANALYZER_POLL_LIMIT_MAX` / `_WINDOW_MS` | 1200 / 600000 | reads a client may make per window |
| `ANALYZER_TRUST_PROXY` | 0 | take the client address from the last `X-Forwarded-For` entry (the one the proxy appended) |
| `ANALYZER_REQUIRE_HTTPS` | 0 | refuse non-https forwarded requests |
| `ANALYZER_CORS_ORIGINS` | `*` | comma-separated allowed origins |
| `ANALYZER_WORKER_MEMORY_MB` | 2048 | heap limit of a job's worker thread |

Source fetches keep the SourcePackage policy (`packages/source-package/src/net.ts`): https only, every redirect hop re-validated, private/loopback/link-local/documentation addresses refused after DNS resolution, 24 MB per body, 120 assets, 20 s per fetch.

## What is stored

Per job, under `ANALYZER_DATA_DIR/jobs/<jobId>/`: `job.json` (the status record), and on success `result.json` (summary), `scene.json`, `model.json`, `candidate.json`. The fetched source bytes live only in `…/<jobId>/work/` while the job runs and are deleted when it ends, whatever the outcome. No reference model, benchmark, sealed candidate or source image is ever written to the store.

## Clients

- **Android** — `BuildConfig.ANALYZER_API_BASE_URL` is set at build time from `ANALYZER_API_BASE_URL` (a CI repository variable, never a secret; empty in builds with no deployed service). The Analyzer screen polls the status, downloads `/scene`, verifies both hashes and the bundle schema, writes it atomically into the app's private storage and lists it beside the bundled scenes as "<title> (analysis)". Permission: `android.permission.INTERNET`, nothing else.
- **Web** — the Analyze panel takes the base URL from `VITE_ANALYZER_API_BASE_URL` (or the page's own origin at `/api` when served together), polls the same status and opens `/model` in BuildWorld.

## Progress weights

`progress` is `Σ weight(finished stages) + weight(current stage) × fraction`. The weights (`packages/analysis-service/src/stages.ts`) were read off a real run of a 20-asset project through this API (BUILDAPP-03Y1): fetching ≈ 11 % of the wall time, reading the drawings ≈ 85 % (about two thirds of that reading the drawings one by one, the rest reading printed dimensions and callouts), everything from registration to verification ≈ 4 %. Inside "reading the drawings" the bar advances per drawing; everywhere else it moves only when a stage starts or ends.

## Deployment

The service is one container (`apps/analyzer-api/Dockerfile`, built from the repository root). It needs no secret. It needs persistent disk only for results to outlive a restart (a volume at `/data`), and roughly 1.5–2 GB of memory per concurrent job.

**Fly.io** (`apps/analyzer-api/fly.toml`, region `waw`):

```sh
fly apps create buildapp-analyzer
fly volumes create analyzer_data --app buildapp-analyzer --region waw --size 3
fly deploy . --config apps/analyzer-api/fly.toml --dockerfile apps/analyzer-api/Dockerfile
```

The service is then at `https://buildapp-analyzer.fly.dev` (TLS by the platform; `ANALYZER_REQUIRE_HTTPS=1` and `ANALYZER_TRUST_PROXY=1` are set in `fly.toml`).

**From CI.** Add the repository secret `FLY_API_TOKEN` (`fly tokens create deploy --app buildapp-analyzer`) and the repository VARIABLE `ANALYZER_API_BASE_URL` (e.g. `https://buildapp-analyzer.fly.dev`). The `analyzer-deploy` job then deploys every push and smoke-tests the deployment, and the `android` job compiles the variable into `BuildConfig.ANALYZER_API_BASE_URL` of the APKs it builds. Without the secret the job only reports that nothing was deployed.

**Any other container host** (Cloud Run, Render, a VM): run the image with a volume at `/data`, put TLS in front, set `ANALYZER_TRUST_PROXY=1` and `ANALYZER_REQUIRE_HTTPS=1`, and give the phone the https address — in the build variable, or in the app's Analyzer screen under "Service address".

**Reading a house from its pictures (v3.53.1) — a private pilot, off by default.** The host may hold a paid house reader
(`analysis-service` `analyseLink`). It is asked only after the drawings' path has refused a page whose pictures are
still unread, or has built a model weak by its own account (no metric anchor, partial, a body missing, no roof); a
complete, anchored drawings model is the answer and costs nothing. The job then completes in the unchanged contract
with a model that says `MODEL_FROM_SOURCE_DESCRIPTION`, built on whatever the drawings did measure.

It is on only when ALL of these are set (the service logs which is missing at start, never a secret):

| variable | meaning |
| --- | --- |
| `ANALYZER_HOUSE_READER=live` | the switch |
| `ANTHROPIC_API_KEY` | the provider's key, as a SECRET of the host — never in the repository, an image, an APK, a log or a chat |
| `ANALYZER_HOUSE_READER_MAX_USD` | cumulative ceiling on everything the host has ever reserved; no ceiling, no reader |
| `ANALYZER_HOUSE_READER_SPENT_USD` | opening balance: what was already spent elsewhere when the books are first opened (default 0) |
| `ANALYZER_HOUSE_READER_TOKEN` | the pilot's access token (≥ 24 characters), as a SECRET; no token, no reader |
| `ANALYZER_HOUSE_READER_MAX_PER_DAY`, `ANALYZER_HOUSE_READER_MAX_REQUESTS_PER_DAY` | daily ceilings (default 20 descriptions, 60 requests) |
| `ANALYZER_HOUSE_READER_MODEL`, `ANALYZER_HOUSE_TRIAGE_MODEL` | default `claude-sonnet-5-5` and `claude-haiku-5-5`; a model with no list price in the service's table is never asked |

**Who may use it.** A submission that carries `Authorization: Bearer <pilot token>` may reach the reader; one with a
wrong token is `401 PILOT_TOKEN_INVALID`; one with none gets the drawings' path alone, exactly as before. The token is
compared in constant time and is never stored on a job, logged or returned. The paid path is therefore not open to
whoever finds the address.

**What it may cost.** Every request (the sorting of the page's pictures and the description) is reserved in the host's
spend books before it is sent — its conservative cost: every picture at 5 000 tokens, the whole question, the answer
at its token ceiling, at list price — inside an exclusive lock, against the cumulative ceiling and the day's. An answer
settles the reservation down to its stated usage. A timeout, a dropped connection, a server error or a cancellation
keeps the reservation in full; a request the provider refused before running a model (a bad key, a rate limit) gives
it back. The SDK does not retry on its own: one question is at most one billed request. The books live in the data
volume (`house-reader-spend.json`, its `.bak` and an append-only `.journal.jsonl` of amounts, token counts and model
names). A state that does not parse, or has gone missing beside its journal, keeps the reader OFF until a person has
looked — the books are never restarted at zero. What this cannot survive is the loss of the whole volume, so there is
a second stop outside the host: **the provider's spend limit, which is documented per WORKSPACE and per calendar
month** — put the pilot's key in a workspace of its own and set that workspace's monthly limit in the provider's
console. It is a monthly ceiling on a workspace, not a cumulative one on a key: whether the account offers anything
finer has to be checked in the account, and nothing here relies on it. The cumulative ceiling of the campaign is
enforced by these books alone. Measured through the session's CLI on the control's pages: 0.09–0.18 USD and 43–113 s a
house. A reservation — the upper bound held before a request — came to about 0.3–0.4 USD for those example inputs; it
is an estimate for them, not a price: a page with more or larger pictures reserves and may cost more, and no figure
here is a guaranteed cost of an arbitrary link.

**One reading by hand, before any host** (`research/source-to-model/s53/sdk-live.ts`, the command line of
`apps/analyzer-api/scripts/house-reader-trial.ts`). The owner runs it in their own terminal with their own key; the
key is typed into the terminal's environment and never into a chat, a file of the repository or an argument.
Windows PowerShell 7, from the repository root after `npm ci`:

```powershell
$env:ANTHROPIC_API_KEY = Read-Host -MaskInput "API key"
Remove-Item Env:ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue
npx vite-node research/source-to-model/s53/sdk-live.ts -- --url "<a DEV project page>" `
  --cache "$HOME\buildplan-private\cache" --out "$HOME\buildplan-private\trial-1"
"exit code: $LASTEXITCODE"
Remove-Item Env:ANTHROPIC_API_KEY
```

(Windows PowerShell 5.1: `$s = Read-Host -AsSecureString "API key"; $env:ANTHROPIC_API_KEY = [System.Net.NetworkCredential]::new('', $s).Password`.
bash: `read -rs ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY`, the same command with `\` line ends, `unset` after.)
Exit code 0: a model was built; 2: the reader was asked or refused and no model came of it (a paid reading without a
model is a failure, and still on the books); 3: nothing was asked (books, ledger or arguments). `--out` then holds
`trial.json` (outcome, the models that served, usage, what the books held before and after), and for a model
`description.json`, `model.json`, `program.json`, `scene.json`, `result.json` and `diagnostics.json`. There is ONE set
of books: `--books` defaults to `.buildplan/house-reader-books` in the home directory, opens at the total of the
campaign's ledger (`research/ai-assist/spend-ledger.json`) and is refused if it holds less; what a run booked is
appended to that ledger as one entry, to be committed. One description a day. Without a key the same command is a dry
run: the API answers 401, nothing is booked. A new reading is compared with the sources (the page's published figures,
the sides its pictures show); the build is checked byte for byte by rebuilding the same description.

**What a client sees.** While the house is being read the job record carries `describing`: the `phase`
(`SORTING_PICTURES`, `DESCRIBING_HOUSE`, `BUILDING_MODEL`), `after` (why: the refusal or the weaknesses), the provider
and model, and `pictures` — for each picture being interpreted the `original` the page published (address, SHA-256,
size) and what was `sent` (a smaller JPEG: its own SHA-256, size, byte count). There are no marks: the reader returns a
description of the house, not positions on a picture, and a client must not draw any. Progress and stage never move
back; with a reader at hand the drawings' path uses 0.7 of the scale and the reading the rest.

**What is not verified.** The SDK adapter has reached the live API from this repository only with a placeholder key
(refused with 401, nothing booked); no reading has been paid for through it. Nothing has been deployed. The phone's
embedded analyzer has no reader. The Android client sends the pilot token (typed in at run time, kept in the app's
settings, never in the APK), reads `describing` and shows the pictures whose bytes match the recorded hash — verified
on the JVM against responses captured from this server with a stand-in reader, not on a device and not against a live
service.

**A host for the pilot (a proposal; nothing is ordered).** The repository already carries `apps/analyzer-api/fly.toml`
(app `buildapp-analyzer`, region `waw`, 2 shared CPUs, 2 GB, a 3 GB volume at `/data`, machines stopped when idle and
started on a request) and a CI job that deploys when the repository has a `FLY_API_TOKEN` secret. No account or token
exists for it, and none is needed for the client or the contract tests. Fly.io's published prices
(docs.fly.io/about/pricing, read 2026-11-10): 13.39 USD a month is the VIRTUAL MACHINE ALONE — a `shared-cpu-2x` with
2 GB that never stops — in its cheapest regions; Warsaw (`waw`) is not necessarily one of them. Everything else is
billed beside it: a stopped machine still pays for its root file system (0.15 USD/GB/month), the volume 0.15
USD/GB/month (0.45 USD for 3 GB), and whatever outbound traffic or addresses the plan charges. A pilot that analyses a
few links a day runs minutes to an hour a day; 1–2 USD a month is an ORIENTATION for that use, not a ceiling — a
machine left running costs the whole month. The page also says small monthly bills of a personal organisation are
waived; that is the provider's practice, not a term to plan on, and this proposal does not depend on it. A card is
required. One job at a time
(`ANALYZER_CONCURRENCY=1`), 15 minutes a job. Secrets go in with `fly secrets set ANTHROPIC_API_KEY=… ANALYZER_HOUSE_READER_TOKEN=…`
typed by the owner in their own terminal, the rest as `[env]` or `fly secrets`. Any other container host works the
same way (the image needs Node 22, a volume and TLS in front).

**The older per-facade vision provider** (`ANALYZER_VISION=live`) is NOT a recommended configuration: it runs inside
the drawings' path on every job, for any client, with no spend books and no access token, and it has never been run
against the live API from this repository. The flag alone no longer switches it on; it also needs
`ANALYZER_VISION_UNBOUNDED_SPEND=accept`, which no recipe here sets.
drawings' path refuses (no readable plan, no drawings, incomplete sources), or answers only with a model that has neither
a verified scale nor a measured height, be read as a whole from its pictures: the job then completes with a model whose
warnings say `MODEL_FROM_SOURCE_DESCRIPTION` (LIMITING), whose scale and heights are named provisional, and whose label
ends in "(model z opisu źródeł)". The contract of the job and of its result is unchanged; progress never moves back when
the second path starts. Each such analysis is two paid requests on the host's key (about 0.1–0.2 USD and 40–115 s at the
default models, measured through the session's CLI — the SDK adapter itself has not been run against the live API from
this repository). `ANALYZER_HOUSE_READER_MODEL` / `ANALYZER_HOUSE_TRIAGE_MODEL` choose the models;
`ANALYZER_HOUSE_READER_MAX_PER_DAY` (default 20, `0` = off) is a host-wide ceiling on paid descriptions per UTC day,
counted in the data directory before each request. Without the variable, without a key, or past the ceiling, the service
answers exactly as before. The phone's embedded analyzer has no reader: the described path exists only behind this
service ("Service address" in the app, or the build variable).
