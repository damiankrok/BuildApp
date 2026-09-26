# STAGE BUILDAPP-03Y2 — Embedded Local Analyzer Runtime Proof

Branch `claude/buildapp-buildworld-v1-7y6yqh`. Every number below was measured
from a file, a test or a CI run named next to it; nothing is estimated.
Evidence: `stage-reports/artifacts/local-analyzer/`.

## Verdict

**LOCAL_ANALYZER_PROOF_PARTIAL**

The full production analyzer runs **inside the APK on Android** — not a copy,
not a mobile variant: the same `runAnalysis` pipeline, bundled from the same
TypeScript the analyzer API runs, executed by the embedded nodejs-mobile
18.20.4 runtime in a process of the app. On an Android 14 emulator in CI it
analysed the real Marcówki URL end to end, twice, in two CI runs
(`LIVE_ANDROID_ANALYSIS_PASS`: 215.5 s / peak 1 788 MiB, and 142.1 s / peak
1 791 MiB) and both times produced the desktop's building — model
`4a8e8ddc…`, scene `44cc19be…`, scene file `348273e1…` — and on the synthetic
fixture it produced every desktop hash, which the test requires.

It is PARTIAL, not PASS, for one reason stated plainly: the proof ran on the
**x86_64** emulator; the **arm64-v8a** runtime — the phone ABI and the brief's
main proof — has been built, packaged and measured but **never executed**
(`PHYSICAL_DEVICE_NOT_RUN`: no arm64 device or emulator is available to this
environment or to CI). Whether the phone does the job in practical time and
memory is the owner's phone gate below. If that run completes with the model
and scene hashes above, the verdict is PASS.

## START / FINAL HEAD

- start `743bb26dfec85658f643ac71797153832ebd20da` (the 03Y1 report)
- `ec25e4f` — embedded runtime, local mode, parity and size gates
- `1b3e17e` — Android's Node has no ICU: the verified text adapter
- `55c50cc` — CI evidence, table header, device-report parsing (CI run
  36257918876, all 8 jobs green; the last commit that changes the APK)
- final: the commit that carries this report, the PROJECT_STATUS row, the
  second run's evidence and one 03Y1 test-race fix (see Tests and gates)

## Runtime

| | |
| --- | --- |
| runtime | **nodejs-mobile 18.20.4** (Node 18.20.4, V8 10.2.154.26-node.37), the official prebuilt `libnode.so`, taken from `nodejs-mobile-react-native@18.20.4` on the npm registry (tarball sha512 and per-file sha256 pinned in `apps/android/tools/fetch-nodejs-mobile.mjs`; only `libnode.so` and LICENSE are used) |
| ABI | **arm64-v8a** (phone) and **x86_64** (emulator); armeabi-v7a gets no runtime (the screen then offers only the service) |
| embedding | `libbuildapp_node_bridge.so` (`app/src/main/cpp/node_bridge.cpp`, 1 JNI function → `node::Start(argc, argv)`), `libc++_shared.so` from NDK 27.3; the analyzer as APK assets `local-analyzer/analyzer.mjs` + `main.mjs` + `manifest.json`, copied to private storage and sha256-checked before each run |
| process | `LocalAnalyzerService`, `android:process=":analyzer"`, not exported; one job per process (Node starts once per process); Node on a 16 MiB-stack thread |
| app ↔ analyzer | two pipes created by the app and handed over by descriptor number: events (NDJSON: `hello`, `progress`, `done`/`failed`/`cancelled`) and control (`cancel`); **no HTTP, no socket, no port** |
| threading | the UI process only receives event lines; all computation is in `:analyzer`; the UI thread never waits on it |

### Compatibility changes (minimal, none touching what the analyzer computes)

1. **`AbortSignal.any`** (Node ≥ 20.3) — used to combine a fetch's timeout with
   the job's cancel. `packages/analysis-service/src/signals.ts`: the native one
   where present, an identical combination otherwise. Found by the Node 18
   spike before anything ran on a phone.
2. **No ICU on Android.** Found by the first emulator run (CI 36253988607):
   nodejs-mobile builds Android Node with `--with-intl=none`
   (`android_configure.py`: *"nodejs-mobile patch: added --with-intl=none"*;
   the `config.gypi` shipped in the npm package describes a host build and says
   the opposite). So there is no `Intl`, V8's `localeCompare` compares UTF-16
   code units, and `normalize()` is a no-op — while the analyzer sorts with
   `localeCompare` (81 call sites: ids, URLs, OCR tokens, published labels) and
   deaccents with `normalize('NFD')` (4). Measured on the real Marcówki inputs:
   **5 357 of 50 412 comparisons** get the other sign without ICU, and the run
   seals **different metric evidence (`47df7120…` vs `494ae734…`) and a
   different candidate (`da914928…` vs `089abf00…`)** (the model happens to
   survive). Fixed by a **platform text adapter**
   (`apps/local-analyzer/src/text.ts`), installed only where the runtime's ICU
   is missing (probed by behaviour): NFD exact for every code point, CLDR root
   collation for a repertoire verified character by character against ICU
   (ASCII, all Polish letters — `ł` collates exactly as `l` + U+0335 — Latin,
   punctuation, symbols, marks). Tables generated from the desktop's ICU
   (`scripts/generate-text-tables.mjs`, 2 081 decompositions, 964 non-starters,
   303 base characters, 94 marks, 5 equivalents; 219 characters the model
   cannot reproduce are excluded and **refused by name**,
   `TEXT_NOT_SUPPORTED_ON_DEVICE`, never approximated). With it, the same
   Marcówki run under V8-without-ICU seals **every desktop hash**.
3. `runtimeFacts()` probes can no longer throw (the first emulator failure was
   `new Intl.Collator()` in the `hello` event).

Nothing else was changed for the phone: the same `safeFetch`, the same
pipeline, the same compiler.

## Size

Measured from **clean** CI builds (run 36257918876, `55c50cc`; AGP's incremental
packager keeps the space of removed entries, so only clean builds are
measured). `artifacts/local-analyzer/ci-run-36257918876/size-*.json`. Run
36256959222 (`1b3e17e`) measured every entry the same and each APK 4 B larger
(signing block).

| arm64-v8a | bytes | MiB |
| --- | ---: | ---: |
| APK before this stage (`743bb26`, clean build in the sandbox) | 13 609 795 | 12.98 |
| APK **without** the local analyzer (`-PlocalAnalyzer=false`, same commit) | 11 911 438 | 11.36 |
| APK **with** the local analyzer | **29 911 875** | **28.53** |
| **delta** (with − without) | **18 000 437** (18.00 MB) | **17.17** |
| delta vs the pre-stage APK | 16 302 080 | 15.55 |
| runtime `libnode.so` in the APK (compressed) | 17 077 722 | 16.29 |
| runtime `libnode.so` installed (stripped by AGP) | 49 522 248 | 47.23 |
| runtime `libnode.so` as published (unstripped) | 62 475 584 | 59.58 |
| analyzer JS (`analyzer.mjs` 1 455 782 + `main.mjs` 372) | 1 456 154 | 1.39 |
| analyzer JS in the APK (compressed) | 440 860 | 0.42 |
| other new: bridge 73 704 / `libc++_shared.so` 1 292 904 / manifest 466 — compressed | 481 016 | 0.46 |

- The "without" APK is smaller than the pre-stage one because this stage stores
  native libraries **compressed** (`useLegacyPackaging = true`, both variants,
  so the delta is the runtime alone): Filament's library shrinks too. With
  libraries stored uncompressed (AGP's default) the local APK weighs
  **65 038 423 B** (sandbox, `ec25e4f`).
- Installed footprint of the runtime: +50.9 MB of extracted native libraries
  and 1.46 MB for the copied bundle.
- x86_64 (emulator): 12 032 464 → 31 822 048 B (+19 789 584). Universal
  (sandbox, `ec25e4f`): 14 635 024 → 51 963 388 B. armeabi-v7a carries no
  runtime.
- The analyzer JS by package: reconstruction 446 KB, source-metrics 138 KB,
  zod 121 KB, geometry 110 KB, model 80 KB, source-analyzer 78 KB, pngjs 68 KB,
  jpeg-js 65 KB, … the local analyzer's own code 8 KB plus the 45 KB text tables.
  The provider SDK contributes 0 bytes.

## Parity

### Fixture (synthetic publisher, URL → scene) — PASS

Desktop = `runAnalysis` from the TypeScript sources under Node 22.

| run | candidate | model | scene contentHash | scene sha256 |
| --- | --- | --- | --- | --- |
| desktop, Node 22 | `186f40f1…` | `c44c8e48…` | `ce1a5fc6…` | `6fa5a2b3…` |
| bundle, Node 22 / Node 18.20.4 (host) | same | same | same | same |
| bundle, Node 22 / Node 18.20.4, **V8 without ICU + adapter** (host) | same | same | same | same |
| **Android emulator, embedded runtime** (CI 36256959222 and 36257918876; the test requires all four) | same | same | same | same |
| the scene the analyzer API served for this link (03Y1 contract fixture) | | | | same, byte for byte |

Source package `66ef2930…`, graph `969c810e…` and metric evidence `4b6bb703…`
are equal too wherever they are reported. A second building (Holloway) is held
to the same parity on the host under Node 22, Node 18 and Node 18 without ICU
(`apps/local-analyzer/test/program.test.ts`).

### Marcówki — PASS on the emulator (live), and from the same bytes

| run | where | package | evidence | candidate | model | scene |
| --- | --- | --- | --- | --- | --- | --- |
| desktop, Node 22, ICU | sandbox, cached bytes | `4b8b0fb7…` | `494ae734…` | `089abf00…` | `4a8e8ddc…` | `44cc19be…` |
| Node 18.20.4, ICU | sandbox, cached bytes | same | same | same | same | same |
| Node 22, **no ICU + adapter** | sandbox, cached bytes | same | same | same | same | same |
| Node 22, no ICU, **no adapter** | sandbox, cached bytes | same | `47df7120…` ✗ | `da914928…` ✗ | same | same |
| graph replay under the sealed label, Node 18 = Node 22 | sandbox | `4b8b0fb7…` | `5f12247b…` | `6203439c…` | **`894e50ba…`** (sealed Auto v3) | **`ad689af6…`** (the APK's Auto v3 asset) |
| **live URL, Android emulator** | CI 36256959222 | `df240528…` | `af8417e9…` | `f407b5b7…` | **`4a8e8ddc…`** | **`44cc19be…`** / `348273e1…` |
| live URL, desktop (bundle taken out of the APK), same job | CI 36256959222 | `07374b32…` | `41ba3d5f…` | `77ddca77…` | `4a8e8ddc…` | `44cc19be…` / `348273e1…` |
| **live URL, Android emulator** | CI 36257918876 | `8303f3f4…` | `19389e8c…` | `19f632c8…` | **`4a8e8ddc…`** | **`44cc19be…`** / `348273e1…` |
| live URL, desktop (bundle taken out of the APK), same job | CI 36257918876 | `3de640a5…` | `5ce5df0e…` | `607f7141…` | `4a8e8ddc…` | `44cc19be…` / `348273e1…` |
| live URL, Node 18.20.4 host | CI 36253988607 | `29a9644a…` | `bdf82965…` | `9c20cd79…` | `4a8e8ddc…` | `44cc19be…` / `348273e1…` |

In each of the two CI jobs the emulator and the desktop live runs read **the
same 20 drawings, byte for byte** (their asset hashes are compared,
`live-device-vs-desktop.md`); the publisher served a different page HTML
(page hash `c54f7258…` vs `0da3d8c7…`; `1cbb9a30…` vs `06c57c1b…`), which moves the provenance hashes
exactly as 03Y1 documented; the building — model, scene content and scene
file — is identical. From identical bytes every hash is identical (the
sandbox rows). No reference model was read or used anywhere.

## Performance

### CI / emulator measured

Android 14 emulator, x86_64, KVM, 4 cores, 6 GB RAM (GitHub `ubuntu-latest`).
Times on the analyzer process's monotonic clock; peak = the kernel's `VmHWM`
of the `:analyzer` process.

| run | total | fetch | drawings | printed numbers | solve | compile | verify | peak RSS | scene |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Marcówki live, emulator** (CI 36256959222) | **215.5 s** | 16.0 | 18.3 | 175.1 | 4.9 | 0.1 | 1.1 | **1 788 MiB** (1 875 193 856 B) | 578 344 B |
| Marcówki live, desktop Node 22, same job | 128.0 s | 16.4 | 18.9 | 87.6 | 4.1 | 0.1 | 1.0 | 1 641 MiB | 578 344 B |
| **Marcówki live, emulator** (CI 36257918876) | **142.1 s** | 16.1 | 11.2 | 110.3 | 3.5 | 0.1 | 0.8 | **1 791 MiB** (1 878 302 720 B) | 578 344 B |
| Marcówki live, desktop Node 22, same job | 88.2 s | 16.2 | 11.1 | 57.5 | 2.6 | 0.1 | 0.7 | 1 678 MiB | 578 344 B |
| Marcówki live, Node 18.20.4 host | 201.8 s | 15.9 | 17.5 | 162.6 | 4.6 | 0.1 | 1.0 | 1 583 MiB | 578 344 B |
| fixture, emulator (36256959222 / 36257918876) | 4.7 s / 3.3 s | 0.8 / 0.5 | 1.8 / 1.3 | 1.0 / 0.6 | 1.1 / 0.7 | 0.0 / 0.0 | 0.1 / 0.1 | 271 / 276 MiB | 101 457 B |
| cancel while downloading, emulator | 0.5 s / 0.4 s | | | | | | | 215 / 230 MiB | |
| cancel while computing, emulator | 1.8 s / 1.0 s | | | | | | | 230 / 233 MiB | |

The two emulator runs differ by 1.5× in time on the same code and the same
drawings — shared CI runners vary that much (the desktop runs of the same jobs
differ alike, 128.0 s vs 88.2 s); the memory peak is stable (1 788 / 1 791
MiB). The emulator/desktop ratio is 1.7 and 1.6.

- **81 % of the time and the whole memory peak are one stage**: reading the
  printed dimensions and opening callouts (`extractMetricEvidence`). The peak is
  the callout reader's per-page prototype render cache
  (`packages/source-metrics/src/callouts.ts`, `RenderCache`): up to
  **101 088 Float64Array renders = 1 077 MiB** on one page (instrumented, not
  changed; `node18-runtime-spike.json`). A V8 heap cap does not lower the peak
  (384 MB cap: 1 567 MiB, same result) — it is typed-array memory. It is the
  obvious place to make the analyzer phone-sized; this stage did not change the
  analyzer.
- Node 18's V8 is ~1.6–2× slower than Node 22's on that stage (sandbox 249.7 s
  vs 166.0 s; CI 201.8 s vs 128.0 s).

### Physical device

**PHYSICAL_DEVICE_NOT_RUN.** No time, memory or temperature on a phone exists
yet. The app shows and keeps (Analyzer screen → "Local runs on this phone") the
status, total time and phases, peak memory, scene size and runtime of every
local run, and logs one JSON line (`adb logcat -s BuildAppLocalAnalyzer`).

## Security

- **Network / SSRF: unchanged and exercised.** The phone fetches through the
  same `safeFetch` as the service — https only, no credentials, every hop's
  resolved addresses checked (loopback, private, link-local, CGNAT,
  documentation, metadata refused), manual redirects (≤ 5) re-validated,
  24 MB/body, 120 assets, 20 s/fetch, media types allow-listed. On Android
  `dns.lookup` goes through the platform resolver; the emulator fetched the
  real publisher through it. Nothing was relaxed. Remaining: the DNS-rebind
  window BUILDAPP-02 documented.
- **Secrets: none.** No vision provider is wired locally; the bundle contains
  no `ANTHROPIC_API_KEY` read and 0 bytes of the provider SDK (architecture
  test); results say `DETERMINISTIC_ONLY` with the "no vision provider ran"
  warning. Permissions unchanged: `INTERNET` + AndroidX's self-permission (CI
  `aapt` check); the service is not exported.
- **Scratch: removed on every outcome.** The program removes `work/bytes` in a
  `finally` (success, failure, cancel — vitest); the app removes the job folder
  after the process is gone and only then shows the terminal state (JVM
  tests); on the emulator the device tests assert 0 scratch bytes, no journal
  and no `:analyzer` process after a completed run and after both cancels.
  Source images are never kept; only the verified scene is.

## Lifecycle

- Cancel: `cancel` on the control pipe (stops a download at once — emulator
  0.5 s, the program's own `cancelled`); if the program has not answered in
  1.5 s the process is ended (emulator, computing: 1.8 s).
- One job at a time; rotation keeps the job with the ViewModel (no second
  analyzer); the ViewModel's end ends the process and removes the folder (no
  zombie job); the app's own death unbinds the service, which ends its process.
- Restart: a journal left behind is reported **INTERRUPTED** and the folder
  removed — a scene is stored only after `done`, verified files and the scene
  store's sha256/schema/contentHash checks; a process that dies without a
  terminal event is `RUNTIME_STOPPED`, never a result.
- On success the scene joins the model list and **opens in the viewer by
  itself**; it survives restart (JVM test).

## Tests and gates

| gate | result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` (vitest, all workspaces) | **102 files, 1 328 passed, 5 skipped** (the Node-18-only tests, which the Node 18 job runs) at the final commit; the local analyzer's files: text 11, local 13, program 15 (10 + 5 Node-18-only), architecture 19 |
| Node 18 parity job | vitest under Node 22 **and** 18.20.4 (with and without ICU), fixture record, table check |
| Android JVM | 259 passed (234 before; LocalAnalysisTest 19, LocalRuntimeFilesTest 6) |
| on-device (emulator) | `LocalAnalyzerDeviceTest`: runtime installed, fixture = desktop hashes, cancel ×2 (OK, 4 tests), live URL (OK, 1 test) — in both CI runs |
| 03Y1 API tests | a race found while running the full suite here (intermittent `SocketError: other side closed` in `api.test.ts`, the test after the 413 one; reproduced on `apps/analyzer-api` alone, in code this stage had not touched): the server destroyed the connection right after answering 413, and the client's keep-alive pool could send the next request onto it. Fixed in `apps/analyzer-api/src/http.ts`: a 413 answers `connection: close` and the connection is ended once the answer is out. `apps/analyzer-api` 45/45 in 8 consecutive runs. |
| architecture | `tests/architecture/local-analyzer.test.ts` (19): production pipeline only; no reference/benchmark/research/fixture/stage module; no project name; no secret or SDK; no second geometry kernel; DSL → model → compiler; no ICU use the adapter does not reproduce; adapter before the analyzer; no post-Node-18 API; Gradle ships this bundle and the fixture only in the test APK; runtime pinned; separate non-exported process. Existing suites unchanged and green; the 03Y1 API still builds, smokes and runs the real URL in its container. |

The brief's ten architecture gates: 1 production pipeline — test 1.x; 2
reference — 2–4; 3 benchmark/gold — 2–4; 4 no Marcówki strings — 2–4 (it
caught one in a comment); 5 no geometry kernel — 5–6; 6 DSL → model →
compiler — 5–6; 7 local = desktop — `program.test.ts`, `text.test.ts`, device
test; 8 cancel cleans scratch — local/program tests, JVM, device; 9 existing
architecture tests — green; 10 03Y1 backend — `Analyzer API / container`
green.

## CI

Run **36257918876** on `55c50cc` (run #38, versionCode 1038): **all 8 jobs
green** — Core / Analyzer / Reconstruction, Browser / Playwright, Android /
APK, Analyzer API / container, Analyzer API / deploy (skipped steps: no
deployment configured), Dependency security, **Local analyzer / Node 18
parity**, **Local analyzer / APK size + emulator**. The run for the final
commit is named in the final message. Jobs: Core; Browser; **Android / APK** (the owner's APKs
now embed the analyzer; NDK + CMake added); Analyzer API container + deploy
(03Y1, unchanged); **Local analyzer / Node 18 parity**; **Local analyzer /
APK size + emulator** (clean builds with and without, size report, desktop
hashes, desktop live run on the bundle extracted from the APK, emulator:
device tests + live URL, device-vs-desktop comparison).

## Limitations

- **PHYSICAL_DEVICE_NOT_RUN** — the arm64 runtime never ran; no phone time,
  memory or temperature exists.
- **Memory:** 1.6–1.8 GB peak for Marcówki. A phone with little free RAM may
  end the analyzer; the app then reports `RUNTIME_STOPPED` (never a result).
  The cause is one cache in one stage (above).
- **Time:** 2.4–3.6 min on the emulator (KVM, 4 cores); a phone is likely
  slower — NOT_RUN.
- **No foreground service** (it would need another permission): if the app is
  left for long, Android may end the analysis; the next start says INTERRUPTED.
- **Text repertoire:** a compared string with a character outside the verified
  repertoire (curly quotes, `…`, `ß`, Greek, CJK, …) makes the phone refuse the
  job (`TEXT_NOT_SUPPORTED_ON_DEVICE`); the service analyses such a project. A
  nodejs-mobile build with ICU would lift this at an unmeasured size cost.
- **armeabi-v7a** has no local runtime (service only).
- **Size:** +18.0 MB download, +50.9 MB installed native code.
- The publisher's page is not byte-stable, so live runs minutes apart differ in
  provenance hashes (same building).
- The Analyzer screen's local mode was not seen on a screen (no UI test or
  screenshot; the device tests drive the controller headless).
- `os.cpus()` is empty on Android (reported as 0 cores).
- The pre-stage baseline APK and the stored-libraries variant were measured in
  the sandbox, not in CI.

## Owner phone gate

**APK:** `BuildPlan-Model-Preview-arm64-v8a-debug.apk` from the GitHub Actions
artifact **`buildplan-model-preview-apks`** of the CI run for this report's
commit (branch `claude/buildapp-buildworld-v1-7y6yqh`; versionCode = 1000 +
run number, written in the artifact's `VERSION.txt`; run 36257918876 on
`55c50cc` is versionCode 1038, artifact 10911775257). Same preview signing
key, so it installs over the 03Y1 build.

1. Install the APK over the previous one. Open the app.
2. Tap **Analyze link** (top strip). The screen must say **"Analyzer: Local"**.
3. Paste into **Project page link**:
   `https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca`
4. Tap **Analyze project**. Keep the app open and the screen on. Watch the
   stages; the line under the bar shows elapsed time and memory.
5. When it finishes, the model **"Dom w marcówkach (GE) (analysis)" opens by
   itself** in the viewer. Orbit it.
6. Go back to **Analyze link**.

Send back:

- a screenshot of the **"Analysed on this phone"** box (status, total time,
  peak memory, scene size, runtime) and of **Local runs on this phone**;
- **Diagnostics → Local run** (the six phase times) and **Diagnostics →
  Hashes** — expected: Model `4a8e8ddca8be…`, Scene content `44cc19be80ab…`,
  Scene file `348273e19157…`;
- the phone model and its RAM;
- if it fails: the code in the red card (e.g. `RUNTIME_STOPPED`) and the time
  it ran;
- optional: run it again and tap **Cancel** after a few seconds ("cancelled"
  within ~2 s); and close the app mid-run, reopen: it must say
  **Interrupted**, not show a model.

## Next step

1. **Owner:** the phone gate above (and 03Y1's camera checklist). A completed
   run with the expected hashes makes this stage PASS.
2. If memory or time on the phone is the problem: bound the callout reader's
   render cache (`source-metrics/src/callouts.ts`) — a change that must keep
   every hash, so it belongs to its own analyzer stage with the parity gates of
   this one.
3. Then **BUILDAPP-03Z**, as recorded in `PROJECT_STATUS.md`.
