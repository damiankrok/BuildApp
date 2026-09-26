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
  "analyzer": { "service": "1.0.0", "solver": "2.0.0" },
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
| 400 | `INVALID_URL` | not `https`, carries credentials, non-443 port, IP literal, `localhost`/`.local`/`.internal`, > 2048 chars |
| 413 | `BODY_TOO_LARGE` | body > 4 KiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | not `application/json` |
| 422 | `UNSUPPORTED_PUBLISHER` | no registered publisher adapter understands the host |
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
- On `FAILED` / `CANCELLED`: `error` is `{code, message}` with `code` ∈ `SOURCE_REFUSED`, `SOURCE_UNREACHABLE`, `UNSUPPORTED_PUBLISHER`, `NO_DRAWINGS`, `ANALYSIS_FAILED`, `TIMEOUT`, `CANCELLED`, `SERVICE_RESTARTED`, `INTERNAL`.
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

`200` — the full summary (`LinkAnalysisSummary`, `packages/analysis-service/src/result.ts`): every hash (`sourcePackageHash`, `observationGraphHash`, `metricEvidenceHash`, `candidateHash`, `modelHash`, `modelSha256`, `sceneContentHash`, `sceneSha256`), `counts`, `quality.levels` `{L0, L1, L2}`, `quality.byFamily`, `unresolved[] {what, reason, status}`, `warnings[]`, `vision {mode, provider, attempted, accepted}`, `verification {replay, residuals, residualsOutsideTolerance, closure}`, `analyzer`, `startedAt`, `completedAt`, plus `links`. No candidate, model or scene inline.

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
| `ANALYZER_TRUST_PROXY` | 0 | take the client address from the first `X-Forwarded-For` hop |
| `ANALYZER_REQUIRE_HTTPS` | 0 | refuse non-https forwarded requests |
| `ANALYZER_CORS_ORIGINS` | `*` | comma-separated allowed origins |
| `ANALYZER_WORKER_MEMORY_MB` | 2048 | heap limit of a job's worker thread |

Source fetches keep the SourcePackage policy (`packages/source-package/src/net.ts`): https only, every redirect hop re-validated, private/loopback/link-local/documentation addresses refused after DNS resolution, 24 MB per body, 120 assets, 20 s per fetch.

## What is stored

Per job, under `ANALYZER_DATA_DIR/jobs/<jobId>/`: `job.json` (the status record), and on success `result.json` (summary), `scene.json`, `model.json`, `candidate.json`. The fetched source bytes live only in `…/<jobId>/work/` while the job runs and are deleted when it ends, whatever the outcome. No reference model, benchmark, sealed candidate or source image is ever written to the store.

## Clients

- **Android** — `BuildConfig.ANALYZER_API_BASE_URL` is set at build time from `ANALYZER_API_BASE_URL` (a CI repository variable, never a secret; empty in builds with no deployed service). The Analyzer screen polls the status, downloads `/scene`, verifies both hashes and the bundle schema, writes it atomically into the app's private storage and lists it beside the bundled scenes as "<title> (analysis)". Permission: `android.permission.INTERNET`, nothing else.
- **Web** — the Analyze panel takes the base URL from `VITE_ANALYZER_API_BASE_URL` (or the page's own origin at `/api` when served together), polls the same status and opens `/model` in BuildWorld.
