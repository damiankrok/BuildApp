# Council E — Runtime / Performance / Progress Specialist (005A post-review)

After-run numbers: uncommitted `scratchpad/after-full/*/performance.json` and `telemetry.ndjson`.

## 1. Strongest improvement

The biggest change is the write-only `Checkpoint`, with the cancel poll inside `tick`. Before it, one synchronous metric pass said nothing for 76.7–193.1 s [M `before/performance-before.json`]. Now `tick` is one clock read unless a 200 ms check or a 1 s heartbeat is due (`checkpoint.ts:243-255`) [C]. Ticks sit at every frame, token group, ring, render, asset, preparation step, camera and resolver reading (`extract.ts:287`, `ocr.ts:971`, `callouts.ts:952,1022`, `analyze.ts:123`, `prepare.ts:90-108`, `reconstruct-v2.ts:947`) [C].

Results on all six runs [M]:
- Longest tick gap: 1.8–3.3 s. Longest gap between emitted lines: 2.3–3.5 s.
- The e-OZE resolver (55 readings) ran in 2.5 s with a 0.41 s gap.
- Peak RSS fell from 1.9–2.2 GB to 0.81–0.83 GB.

The three questions:
- **Does a heartbeat prove the thread is alive?** A COMPUTE heartbeat, yes. It comes only from inside `tick` (`checkpoint.ts:254`), so a loop boundary was crossed within about 1 s plus one tick gap [C]. The timer heartbeat (`run.ts:183`) is labelled IO_WAIT and proves only that the event loop is free. A hung await, such as the DNS lookup at `net.ts:286` before the idle deadline, shows "Czekam…" for good, never "Brak odpowiedzi" [C/I].
- **Can `readSync` block?** Not with the phone's wiring. `new Socket({fd})` at `program.ts:267` runs before the poller (`:350-351`), and libuv sets O_NONBLOCK on the `createPipe` fd (`LocalAnalyzerService.kt:92`). An empty pipe therefore returns EAGAIN, and an EOF cancels (`program.ts:251-258`) [C/I]. The weak point: non-blocking is a side effect of the socket, and only `program.test.ts` would notice its removal [I].
- **Can the write-only checkpoint change a result?** Nothing it records is read back [C]. The hashes are unchanged with telemetry on for the three accepted houses [M], and for Larchfield under a clock that makes every tick due (`telemetry.test.ts:37-45`) [C]. There is one hole. `emit` and `rss` are called unguarded (`checkpoint.ts:155-158`), and the preparation ticks run inside `analyze.ts:139-145`'s catch, which rethrows only `AbortError`. A sink error such as EPIPE therefore becomes "the bytes could not be decoded" and the asset is silently dropped [C]. Fix: swallow sink errors inside `checkpoint.emit`.

## 2. Largest remaining genericity risk

**The silent stretches grow with the plan's pixel count, and nothing bounds them.**
- The metric pass reads the full decoded raster (`run.ts:304,310`). Unlike `prepare.ts:29`'s 2200 px working edge, nothing caps it.
- Before the first ring, `readOpeningCallouts` does a lot of work with no tick [C]: masks, components, and `findRings` over each component's box × 52 radii (`callouts.ts:329,983-1011`). The mask work at `extract.ts:305` has no tick either.

**This is where every run's worst gap sits.** On Kosaćce the gap was 3.5 s on the 853² sheet and 1.8 s on the 550² sheet. That is about 4.5–6 s per megapixel on the desktop [M].

**What that means on a slow phone.** At 3–5× slower, `NO_RESPONSE_MS = 45 000` (`LivenessTracker.kt:75`) is crossed at about 2–3.3 MP, a sheet of roughly 1450–1800 px [I]. The same gaps also exceed `CANCEL_GRACE_MS = 1500` (`LocalAnalysis.kt:351`), so many phone cancels will still end in a kill with no trace [I].

**No gate catches this.** `telemetry.test.ts:76` only checks `maxTickGapMs ≤ durationMs`, and CI runs only Larchfield [C].

## 3. Possible hidden overfit

- **Ticks follow the development profiles.** The stretches that were costly on 400/550/853 px ARCHON sheets got ticks; the ones that were cheap there did not. The margin under 45 s comes from those sheet sizes, not from the mechanism [I]. To detect: render a synthetic plan at 1×, 2× and 3× scale and measure the gap against megapixels.
- **The render-cache budget and eviction rest on ARCHON sheets.** `RENDER_CACHE_BYTES = 192 MiB` and the least-used-size eviction (`callouts.ts:916,960-972`) assume "a sheet reads a handful of sizes".
  - Results stay the same by construction: `renderPrototype` is pure and its values are only read (`:479-535,584`) [C].
  - A sheet that thrashes the cache would show up only as time. `uses` never ages, and there are no counters for hits, misses or evictions [C].
  - To detect: add those counters, and test a sheet with callouts in three font sizes.
- **The resolver-cancel test never reaches the resolver.** Larchfield's first reading passes, so `telemetry.test.ts:106-124` only proves a cancel in REGISTERING_VIEWS [C/I].

## 4. One next research item

**Measure the metric-pass gap as a function of resolution, then close it.**
1. Run one synthetic plan at 1×, 2× and 3× linear scale.
2. Record `maxTickGapMs` and RSS for METRIC_FRAMES.
3. Gate on a desktop gap of at most 9 s (45 s / 5) at the largest raster acquisition admits.
4. To pass the gate, either add ticks per component in `findRings` and after each preamble mask, or cap the metric raster.

It comes first because it is the only liveness failure that a new *house*, rather than new code, can trigger. It also sets phone cancel latency and runs offline in CI. The 5× factor should be calibrated against the first real phone `performance.json`.

**Verdict on the implementation decision.** Delivered: Checkpoint, ticks, bounded cache, lazy thin segments, protocol 3 telemetry with poll and performance record, API activity, LivenessTracker and the 99 % cap.
Departures: there is no `PHASE_END` kind and no `message` field; cancel in the resolver is untested; the no-response card offers no diagnostics; and the "drop telemetry rather than wait" path is dead on Android, where the events pipe blocks (`LocalAnalyzerService.kt:91`) [C/I].
