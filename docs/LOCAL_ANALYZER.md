# The analyzer on the phone (BUILDAPP-03Y2)

The Android app runs the **production analyzer** on the phone itself:

```
URL ─► (phone) embedded Node 18 runtime ─► analyzer.mjs = runAnalysis
     ─► SourcePackage ─► observation graph ─► metric evidence ─► analyzer v2
     ─► Building DSL ─► CanonicalBuildingModel ─► compiler ─► MobileSceneBundle
     ─► verified and stored on the phone ─► opened in the viewer
```

There is no second analyzer. `analyzer.mjs` is esbuild's bundle of the same
TypeScript packages the analyzer HTTP API bundles; the phone's Kotlin passes a
link in and bytes out and checks the bytes against the hashes the analyzer
reported. The analyzer service (`apps/analyzer-api`, BUILDAPP-03Y1) stays as
the other mode of the Analyzer screen.

## Pieces

| piece | where | what it is |
| --- | --- | --- |
| `runLocalAnalysis` | `apps/local-analyzer/src/local.ts` | `runAnalysis` with a scratch byte cache in the job's `work/bytes`, removed when the run ends; returns the run, the four delivery files (`analysisFilesOf`, shared with the API), phase timings and memory |
| the program | `apps/local-analyzer/src/program.ts` | one job per process: arguments, events on a pipe, cancel on a pipe, result files written atomically |
| `main.mjs` | `apps/local-analyzer/runtime/main.mjs` | the launcher the app starts: the program with the production publishers (`localWiring` = the API's publishers, no vision provider) |
| the bundle | `apps/local-analyzer/build.mjs` | `analyzer.mjs` (target node18), `main.mjs`, `manifest.json` (sha256 of each); written into the APK's assets at build time, never committed |
| the runtime | `apps/android/tools/fetch-nodejs-mobile.mjs` | nodejs-mobile **18.20.4** `libnode.so` (arm64-v8a, x86_64), from the npm package that carries the official prebuilt binaries; tarball sha512 and per-file sha256 pinned; gitignored |
| the bridge | `apps/android/app/src/main/cpp/node_bridge.cpp` | JNI → `node::Start(argc, argv)`; sets the environment, keeps argv contiguous, forwards stdout/stderr to logcat |
| the process | `analyzer/local/LocalAnalyzerService.kt` | `android:process=":analyzer"`, not exported; starts Node on a 16 MiB-stack thread, relays events, ends the process when the app lets go |
| the controller | `analyzer/local/LocalAnalysis.kt` | one job from link to stored scene; states are the Analyzer screen's `AnalysisState`s |
| scratch and journal | `analyzer/local/LocalJobs.kt` | `files/local-analyzer/jobs/<jobId>/{work,out}`, `active-job.json`, `runs.json` |

## Process model and lifecycle

- **One job, one process.** Node can start once per process and cannot be
  stopped from outside, so every job gets a fresh `:analyzer` process and the
  process is ended when the job ends — completed, failed or cancelled. A new
  job waits until the previous process is really gone (its binder died).
- **The UI never blocks.** The analyzer computes in its own process; the app's
  main thread only receives event lines.
- **Cancel** writes `cancel` to the program's control pipe: the pipeline stops
  at its next checkpoint and at once inside a download. If the program has not
  answered after 1.5 s (a stage is computing), the process is ended. The job's
  folder is removed after the process is gone, and only then is "cancelled"
  shown.
- **No zombie job.** The job belongs to the Analyzer's ViewModel: it survives
  rotation with it (no second analyzer is started — one job at a time is
  enforced), and when the ViewModel is cleared the process is ended and the
  folder removed. When the app's own process dies, the service loses its
  client and ends its process.
- **Restart.** `active-job.json` is written before the analyzer starts and
  removed after its folder is. A journal found at start names a job that did
  not finish: it is reported as `INTERRUPTED` — never as a result — and every
  job folder is removed. A scene is added only after the analyzer reported
  `done`, its files exist, the summary file agrees with the event, and the
  scene store verified sha256, schema and `contentHash`.

## Protocol (version 1)

```
node main.mjs --job <32 hex> --url <https://…> --work <dir> --out <dir> --events-fd <n> --control-fd <n>
```

Events, one JSON object per line: `hello` (protocol, pid, runtime facts),
`progress` (the pipeline's `AnalysisProgress` + elapsed ms + RSS), then exactly
one of `done` (summary, metrics with timings and peak RSS, source byte hashes),
`failed` (code, message, metrics) or `cancelled` (metrics). Exit codes 0 done,
1 failed, 2 cancelled, 3 bad arguments. The app owns the events descriptor and
closes it when Node returns; the program owns the control descriptor.

## Storage

Everything is in the app's private storage. Source bytes live in
`jobs/<id>/work/bytes` and are removed by the program when the run ends and by
the app with the whole job folder; they are never kept. The completed scene is
kept in `files/analyses/` (the same verified store as downloaded analyses,
marked `origin: LOCAL`, subtitle "Analysed on this phone …"). The model and
candidate files are not kept; their hashes are in the index.

## Network and SSRF

The phone fetches the project page and drawings itself, through the SAME
`safeFetch` the service uses (`packages/source-package/src/net.ts`): https
only, no credentials, every hop's host resolved and refused if loopback,
private, link-local, CGNAT, documentation or metadata; redirects followed
manually (≤ 5) and re-validated; 24 MB per body, 120 assets, 20 s per fetch,
media types allow-listed. The Node APIs it relies on (`dns.lookup` via the
platform resolver, `net.isIP`, undici `fetch`) are present in nodejs-mobile
18.20.4 and were exercised on the emulator against the real publisher, so no
network adapter was needed and nothing was relaxed. The remaining gap is the
one BUILDAPP-02 documented: a DNS rebind between the check and the connect.

## Compatibility: what Node 18 on Android lacks, and what stands in for it

Two things, and only two, differ from the desktop runtime:

1. **`AbortSignal.any`** (Node ≥ 20.3), which combines a fetch's timeout with
   the job's cancel: `packages/analysis-service/src/signals.ts` uses the native
   one where it exists and an identical combination where it does not.
2. **ICU.** nodejs-mobile builds Node for Android with `--with-intl=none`
   (`android_configure.py`: *"nodejs-mobile patch: added --with-intl=none"*):
   there is no `Intl`, V8's `localeCompare` compares UTF-16 code units and
   `normalize()` returns its input. The analyzer sorts with `localeCompare`
   (ids, URLs, OCR tokens, published labels) and deaccents with
   `normalize('NFD')`; on the real Marcówki inputs a runtime without ICU gets
   5 357 of 50 412 comparisons wrong and seals different metric evidence and a
   different candidate. `apps/local-analyzer/src/text.ts` — installed only
   where the runtime's ICU is missing, probed by behaviour — reproduces
   `normalize('NFD')` exactly for every code point and `localeCompare` (CLDR
   root, the collation ICU uses for en-US) for a repertoire verified against
   ICU: ASCII, Latin letters through NFD (every Polish letter; `ł` collates as
   `l` + U+0335, exactly as ICU does), common punctuation and symbols,
   combining marks. The tables (`src/text-tables.ts`) are generated from the
   desktop's ICU by `scripts/generate-text-tables.mjs`, which drops every
   character the model cannot reproduce; CI checks they are current. Text
   outside the repertoire (curly quotes, `…`, `ß`, Greek, CJK) makes the phone
   refuse the job as `TEXT_NOT_SUPPORTED_ON_DEVICE` rather than order it
   differently from the service; a refused comparison anywhere in a run means
   no result is delivered. The general fix — a nodejs-mobile build with ICU —
   would remove the repertoire limit at a size cost not measured here.

## Secrets

None. The local wiring has no vision member; the bundle contains no provider
key, no `ANTHROPIC_API_KEY` read and none of the provider SDK's code
(architecture test). Every result says `DETERMINISTIC_ONLY` with the warning
that no vision provider ran.

## Build and test

```
node apps/android/tools/fetch-nodejs-mobile.mjs      # Gradle runs it too
cd apps/android && ./gradlew assembleDebug            # the APKs with the local analyzer
./gradlew assembleDebug -PlocalAnalyzer=false         # the same app without it (size baseline)
npx vitest run apps/local-analyzer tests/architecture/local-analyzer.test.ts
LOCAL_ANALYZER_NODE18=/path/to/node18 npx vitest run apps/local-analyzer   # + Node 18 parity
node apps/android/tools/apk-size-report.mjs --local <apk> --without <apk>
apps/android/tools/run-device-tests.sh                # on an emulator or a phone (adb)
```

Measure APK sizes only from clean builds: AGP's incremental packager keeps the
space of entries removed from an APK.
