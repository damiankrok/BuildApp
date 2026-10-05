# Red team C — memory, lifecycle, cancellation (005H, c6fe174..d04ebc4)

Read-only; two Node 22 probes of worker semantics.

Holds: every batch-ending path (error before ready, silent exit, uncaught worker error, throwing onProgress, abort before spawn / between batches, generator exception after a yield) reaches `finish → terminate → settle`; abort listener removed; batches serial; `afterExitBytes` meaningful (probe: 200 MiB WebAssembly.Memory worker, RSS 302 → 55 MiB by the time terminate() resolves); one Node instance per `:analyzer` process.

| # | sev | finding | where |
|---|-----|---------|-------|
| 1 | P1 | Any recogniser failure (WASM grow RangeError, ERR_WORKER_OUT_OF_MEMORY, pin mismatch, worker exit) ends the analysis as ANALYSIS_FAILED/INTERNAL_ERROR; brief wants OOM/unsafe as PARTIAL/BLOCKED, not a crash. | run.ts:334-353; client.ts:92-95; errors.ts:164 |
| 2 | P2 | Queued worker messages are delivered after `terminate()` (30 of 50 in the probe): `onProgress` keeps ticking after cancel; a late `ready` posts the batch to a dying worker. | client.ts:79-93 |
| 3 | P2 | No watchdog: a worker hung in load or `session.run` waits forever; heartbeats say IO_WAIT. | client.ts:60-96; run.ts:190 |
| 4 | P2 | Longest silence = worker load (hash, compile, session) with no message. | worker.ts:32-49 |
| 5 | P2 | Android: `retry()` not guarded against a running self-test; Analizuj enabled and inert during it. | AnalyzerViewModel.kt:311,332-338 |
| 6 | P2 | Self-test scratch folder can be left behind; never swept. | OcrSelfTest.kt:89,134 |
| 7 | P2 | Failed/cancelled batches leave no RSS stats. | client.ts:70-71 |
| 8 | P2 | `release()` can mask the original error (inline engine caches a rejected load; run.ts `finally` rethrows). | inline.ts:22,41; run.ts:352 |
| 9 | P2 | Client tracks one live worker; release during a batch rejects with a plain Error. | client.ts:52,59,103-105 |
| 10 | P2 note | Worker never calls `engine.release()`; memory returns only by termination. | worker.ts:33-48 |

Verdict: worker lifecycle sound; fix 1–3 and 5 before PASS.
