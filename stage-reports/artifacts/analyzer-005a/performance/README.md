# Performance record (005A)

**How it was measured.** The known development set ran through production `runAnalysis`, offline from one set
of acquisition caches.
- **Paired runs.** For each project, the baseline code (`7cd8e0c`, in a worktree) and the final code ran **at
  the same time**, on the same 4-core machine. Its speed drifted by 1.4–1.7× over the session: the same final
  code, measured one hour apart, differed that much even in phases this stage never touched, such as raster
  decoding. Running each pair together makes that drift hit both sides equally.
- **What is recorded.**
  - Wall time and peak RSS of the whole process tree, sampled every second (`scratchpad/measure.sh`).
  - The pipeline's own timings.
  - For the final code, the per-phase record (`performance.json`: ticks, and the longest silence between two
    loop boundaries).
- **Files.** `performance-record.md` is the table. `performance-record.json` holds every phase.

## Result

| | baseline → final |
| --- | --- |
| peak memory (process tree) | **1.8–2.2 GB → 0.75–0.92 GB** on every project |
| total wall time | faster on 4 of 5 completed or resolved runs (Kosaćce 265 → 248 s and 269 → 251 s, G2E 287 → 251 s, e-OZE 284 → 258 s); **slower on Marcówki, 225 → 264 s**; the alternate Marcówki page 90 → 94 s |
| observation (per-asset reading) | about halved: 98 → 47 s on Kosaćce, 115 → 54 s on G2E, 31 → 19 s on Marcówki |
| metric pass (OCR, chains, callouts) | **slower by 17–29 %**: 144 → 177 s on Kosaćce, 175 → 227 s on Marcówki |
| longest silence a phone sees | 144–175 s with no event → **2.1–3.7 s** |
| models and scenes | the same hashes; e-OZE now completes |

## The metric-pass regression, explained and measured

- **The cause.** This stage bounds the callout render cache at 192 MiB (`RENDER_CACHE_BYTES`, `callouts.ts`).
  The baseline's cache was an unbounded `Map` per frame. The bounded cache gives the same answers by
  construction, and pays in re-renders after evictions.
- **The A/B.** The final code on Marcówki, with the cache bounded and unbounded, the two runs side by side:

| cache | metric pass | peak memory | model |
| --- | --- | --- | --- |
| bounded, 192 MiB (the stage) | 210 s | 889 MB | `6152770f…` |
| unbounded (the baseline's policy) | 156 s | 1754 MB | `6152770f…` |

So the whole metric-pass slowdown is the memory bound: about 25 % of the metric pass buys half the peak memory.
- **Why that side of the trade.** On a phone, peak memory decides whether the analysis finishes at all. The
  baseline's 1.8–2.2 GB is what the Android runtime has to hold. The time is now visible as progress, where
  before it was one silent stretch of two to three minutes.
- **Not tuned here.** A different budget or eviction policy would need phone memory figures, not a desktop
  number. Council E asked for hit, miss and eviction counters first. That is recorded as debt.
