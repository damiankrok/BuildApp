# Server feasibility, query volume and privacy (BUILDPLAN-ANALYZER-005J)

The OWNER's preference is **local / offline**. This page measures what a server referee would cost and risk, so the
delivery decision is made on numbers, separately from model quality. Nothing here proposes a production server; the
in-session strong model used as `SERVER_ORACLE` in 005J is a measurement instrument, never a dependency.

## 1. Query volume (from the analyzer's own sealed records, not guessed)

> **Scope after post-review E5.** The question-per-house figures below apply only to the **rejected** option of a
> server-side referee asked about disputed parts. A refusal-triggered, area-ranked selection is circular for an
> observation (the refused figure would choose which gaps get a model answer). A future witness (the secondary route) would be asked
> **unconditionally**, for every eligible gap of every decomposed copy: **7–64 weak gaps per house, median 24**
> (recounted by reviewer E from the 005I packs, selected copy only), as a local pre-pass over the plan frames
> (≈ 1.2 s per 864² frame, 4–8 frames per house) — no server, no per-question cost.

A referee is asked only at a decision seam where a local answer changes the model (opportunity map, P0/P1). Counted from
the sealed Evidence Packs of the frozen 005H development runs, the round-7 runs and the round-8 runs (24 + 4 + 2 records):

| house class | example rows | decision-relevant seams in the record | questions a referee would get |
| --- | --- | --- | --- |
| completes, nothing disputed | jablonkach, tunbergiach, rarytasy-eoze, arkadiach | 0 non-accepted completions, 0 OPEN_SIDE wide gaps | **0** (asked only on a refusal path) or 0–3 if asked proactively about every QUESTION completion |
| moderately ambiguous | gozdzikowcach (1 QUESTION completion + 1 OPEN_SIDE gap + 1 weak gap), cyklamenach (1 REJECTED completion + 2 weak gaps), zurawkach, helikoniach, marcowki, willa-miranda | 1–7 non-accepted completions, 0–1 OPEN_SIDE gaps | **1–3** (the disputed part, its weak gaps, the wide gap) |
| difficult | dabecjach (14 non-accepted completions, 3 OPEN_SIDE gaps, policies disagree), kosacce (6–7 OPEN_SIDE gaps), jarzabem (4 + 3, policies disagree) | 7–17 | **3–8** with a per-house cap ordered by decision impact (area moved) |

Gap classes are far more numerous (UNKNOWN_GAP 10–64 per house), but only the weak gaps on the perimeter of a disputed
part decide anything; asking about every gap would be the "one request per analyzer step" model the brief rules out.

**Planning figure:** median ≈ 1 question per house, p90 ≈ 6, hard cap 8.

## 2. Server cost of one question (measured on this container's CPU; GPU estimated)

| model | per-question time, desktop x86-64 CPU (image path, measured) | cold load (measured) | process peak RSS (measured, Python) |
| --- | --- | --- | --- |
| SmolVLM2-500M (fp32 vision + int8 decoder ONNX, 512² single tile) | ENUM_SCORE ≈ 1.2–3.5 s, GEN_JSON ≈ 1.3–3.7 s (2–4 threads, contended). Post-review B4: in the bake-off a score-only question that runs the vision encoder takes a median **4.5 s** (783 rows); 1.6 s only when it reuses a generation pass's features (887 rows) | ≈ 7.7 s | ≈ 1.76 GB |
| Moondream 0.5B int8 (legacy client) | ENUM_SCORE ≈ 5–6 s, generation ≈ 5–9 s | ≈ 9.2 s | ≈ 2.34 GB |
| Florence-2-base fp32 (torch) | ENUM_SCORE (3–4 options batched) ≈ 6 s | ≈ 5.4 s | (not recorded under load) |
| UNet-lite wall / opening model (Route B, 1.56 M) | **1.19 s per 864² frame** in ORT-web WASM, one thread, Node 18 (measured); ≈ 0.1 s per 256² gap crop | 2.8 s | ≥ 340 MiB (WASM, lower bound) |
| micro-referee pilot CNN (Route C, 1.07 M) | **70 ms per question** in ORT-web WASM (measured, median of 20) | 0.9 s | ≥ 214 MiB (WASM, lower bound) |
| SmolVLM2-500M in the **shipped** runtime (ORT-web WASM, one thread) | **≈ 17–20 s per question, ≈ 7 min per median house** (vision 11.9 s + prefill 3.8–5.6 s + 8–19 scored tokens at 0.15 s, measured parts; post-review B4) | 4.7 s + 1.1 s | ≥ 1.9 GiB |

Exact distributions: `vlm-bakeoff.json` → `latencyMs` (median, p95 per model and read-out).

**Consumer GPU (estimate, not measured here):** a 0.5 B VLM with 64 image tokens answers a closed question in tens of
milliseconds on an RTX 4090-class card; batching 16–64 concurrent questions fits in 24 GB. A strong VLM of the
`SERVER_ORACLE` class runs only as a hosted API (per-token pricing, seconds per answer).

**Capacity:** at the planning figure (≈ 1 question per house, p90 6), one CPU core running SmolVLM2-class inference
handles roughly **800 questions per hour** (a 2-thread process at the 4.5 s with-vision median; the earlier
"1,000–2,500" used the pooled median, post-review B4), i.e. hundreds to thousands of analyses per day; one consumer GPU handles one to two
orders of magnitude more. **Cost class:** a single small always-on CPU VM (tens of USD per month) covers early volume; a
GPU instance (USD 0.4–4 per hour) only matters at large scale. Free tiers are for experiments only — **no "free
production server" is claimed.**

## 3. Privacy and security of a server mode (§39)

| question | answer for BuildPlan |
| --- | --- |
| minimum crop | the referee needs only the crop the question is about: 005J crops are **square, centred on the target, ≈ 3 m of context**, 512 px — a few rooms, never the sheet |
| complete plans uploaded? | **no**: never the plan, the page, the source URL, the published area or any other published figure (the existing `VisionReasoner` sends published figures with every request — the opposite of what a referee may do, `visual-referee-opportunity-map.md`) |
| source URL leakage | none: the request carries an opaque question id, the crop bytes, the candidate masks and the closed enum |
| retention | zero retention by contract; no logging of pixels; answers and hashes only in the device's Evidence Pack |
| logging | request id, model version, answer, confidence, latency — no image, no coordinates in the sheet's frame beyond the crop |
| encryption | TLS in transit; nothing at rest |
| deletion | nothing to delete if nothing is retained; otherwise a TTL measured in minutes |
| abuse / rate limiting | per-install token, per-house cap (8 questions), per-day cap; the referee refuses anything that is not a known question class |
| residual risk | a crop is still a fragment of a publisher's drawing; sending it to a third party is a licensing question for counsel even when anonymous. **Local inference removes this question entirely.** |

## 4. Delivery architectures (§38), compared — independent of model quality

| design | pros | cons | fit |
| --- | --- | --- | --- |
| **EMBEDDED APK** | offline, deterministic, no network, no privacy question | APK size: fine for the Route-B model (≈ 6 MB fp32) and a Route-C model (≈ 1–20 MB), prohibitive for a 0.3–0.8 GB VLM | **best for Route B (005K) and Route C** |
| **OPTIONAL AI PACK** (downloaded once, SHA-256-verified, offline afterwards) | keeps the base APK small; same offline guarantees once installed | one download step, storage, version pinning | the route if a Route-A VLM is ever needed |
| SERVER | smallest app, strongest models | network, privacy and licensing of crops, cost, outage modes, non-determinism across model updates | development / teacher use only |
| HYBRID (local first, server only on UNRESOLVED) | coverage where the local model abstains | inherits every server risk for exactly the hardest crops | not recommended now; revisit only with counsel and an OWNER decision |

**Recommendation (delivery):** local.
- 005K adds no model (NO_AI_YET).
- If the wall / opening challenger is ever adopted, it is embedded in the APK (≈ 6 MB) and runs through the
  onnxruntime-web WASM runtime the app already ships, exactly as the 005H numeric recogniser does.
- A server is not needed, and a strong hosted model stays a development-time instrument.
