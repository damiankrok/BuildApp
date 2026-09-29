# Cycle 2 — analyzer genericity / security audit (INTEGRATION-004A §41)

Method: an independent read-only reviewer over commits `48034bc..b62a096` with the tests run in the sandbox. Verdict before fixes: PARTIAL (no P0, two P1). What was fixed after this audit is listed at the end.


Scope: commits `48034bc..b62a096` (base `d199a0e`), reviewed read-only against the code, not the reports.
Tests executed during the audit: `packages/source-package` 146/146 (generic.test.ts 31/31), `packages/reconstruction/test/wall-topology.test.ts` 17/17, `packages/analysis-service` 38/38, `apps/analyzer-api/test/api.test.ts` 41/41. `apps/analyzer-api/test/worker.test.ts` (not touched by this stage) failed under a combined run with ECONNRESET and 120 s timeouts — load-related in this container, not attributable to the diff, but rerun it in CI before signing off. `git diff d199a0e HEAD -- packages/model` is empty: the validator was not touched.

Severity key: P0 security/correctness, P1 material, P2 minor, P3 nit.

---

## 1. Safety / recognition split

**Verdict: SSRF protection is at least as strong as before, and stronger on two axes.** Before the stage `validateAnalysisUrl` (identity.ts) did https / credentials / port / `^[0-9.]+$`-or-contains-`:` / localhost-.local-.internal and then `adapters.some(matches)`. Now `validatePublicSourceUrlSecurity` (security.ts:66-91) does the same set plus `isIP()` (so every IPv6 spelling and every WHATWG-normalised IPv4 form — `0x7f000001`, `2130706433`, `127.1` — is `HOST_IS_ADDRESS`) plus `isBlockedHostLiteral` (adds `.home.arpa`, `metadata`, `metadata.google.internal`, `ip6-localhost`, and the literal block lists). Recognition moved to the router, post-fetch. No path lets an unknown host skip a check an ARCHON host got: the fence has no publisher branch, and the page, every redirect hop, every asset and every crawl page go through the same `fetchBytes → safeFetch → assertFetchable` (acquire.ts:70-80, 341-361; net.ts:220-261). New: `allowedPorts` is now enforced on hops and assets (net.ts:235-237) — before the stage a redirect to `:8443` was followed.

Findings:

- **P2 — Fence-level tests do not cover IPv6 private/link-local or the alternative IPv4 spellings.** `packages/analysis-service/test/service.test.ts:150-168` and `apps/analyzer-api/test/api.test.ts:64-90` exercise `[::1]`, `127.0.0.1`, `10.x`, `169.254.169.254`, localhost, credentials, port. `fd00::1`, `fe80::1`, `[::ffff:10.0.0.1]`, `0x7f000001`, `2130706433`, `.internal`, `.home.arpa`, `metadata.google.internal` are covered only at the `isBlockedIPv6`/`isBlockedHostLiteral` unit level (hardening.test.ts, net.test.ts), not through `validateAnalysisUrl`/`POST /v1/analyses`. Fix: extend the `it.each` in service.test.ts:150 with those eight URLs → `SOURCE_UNSAFE`.
- **P2 — Media-type policy is not role-aware.** `DEFAULT_FETCH_POLICY.allowedMediaTypes` (net.ts:52) includes `image/` for the *page* fetch and `text/html` for *asset* fetches. A page served as `image/png` is TextDecoded and routed (ends as a typed `SOURCE_NOT_PROJECT`, so not unsafe), and an asset served as `text/html` is refused only by the image probe (`UNSUPPORTED_FORMAT`), not by policy. The generic test "a wrong media type is refused" (generic.test.ts:450) actually exercises `application/octet-stream` and the decoder. Fix: pass a narrowed `allowedMediaTypes` per role from `fetchBytes` (`PAGE`/`DISCOVERY` → html/xhtml/plain; `ASSET_FETCH` → `image/`), and assert `MEDIA_TYPE_NOT_ALLOWED` in the test.
- **P3 — `validateAnalysisUrl` cannot see a custom policy.** security.ts:66 accepts `policy` but identity.ts:63 always uses the default; a deployment that narrows/widens `allowedPorts` in `runAnalysis` options gets a fence that disagrees with the fetch. Thread `options.policy` through, or document that the fence is fixed.
- **P3 — Refusal messages carry page text.** acquire.ts:86-92 builds the `SOURCE_NOT_PROJECT` message from evidence `detail`s, which quote up to 60-80 chars of title/labels (classify.ts:112,124). `errors.ts` replaces the message before it reaches a client (only counts cross, errors.ts:171-176), but the raw `SourceAcquisitionError.message` is what a server log prints. Keep the quotes out of the message (they are already in `classification.evidence`).
- **P3 — Stale comment.** net.test.ts:64-66 says `https://[::ffff:127.0.0.1]/` is not caught; hardening.test.ts:51-52 proves it is. Pre-existing; delete the note.
- DNS-rebind between check and connect remains an acknowledged gap (net.ts:21-23), unchanged by the stage.

## 2. Source router

- Specialist always preferred: yes. `specialistFor` runs first (router.ts:59-60) regardless of registration order; the generic adapter is consulted only when no specialist `matches` the **post-redirect** URL (acquire.ts:82). An ARCHON URL never reaches the generic path while `archonAdapter` is registered (generic.test.ts:497, generic-source.test.ts:165). If archon.pl redirected off-host the generic reader would read the target — correct and honest.
- `NO_ADAPTER` / `SOURCE_NOT_PROJECT` / `SOURCE_REQUIRES_RENDERING` are deterministic (pure functions of `PageFacts`) and honest (evidence listed; no fetch beyond the page — asserted at generic.test.ts:296, 361; generic-source.test.ts:147, 154).

Findings:

- **P2 — A GENERIC adapter without `classify` reads every page.** router.ts:63-65 defaults a classifier-less generic adapter to `PROJECT_PAGE` with confidence 0. Only the shipped adapter exists today, but the type allows a second registrant to turn the reader into "read anything". Fix: make `classify` required when `strategy === 'GENERIC'` (a discriminated `SourceAdapter` union), or return `NO_ADAPTER` when it is absent.
- **P3 — `hasGenericStrategy` ignores `matches`.** `routableBeforeFetch` (router.ts:46) says "yes" for any safe URL once any generic adapter is registered, even one whose `matches` would refuse it; the fetch then ends `NO_ADAPTER`. Harmless (one wasted page fetch), but `routableBeforeFetch` should check `adapters.some(a => isGeneric(a) && a.matches(url))`.

## 3. Generic adapter (`packages/source-package/src/adapters/generic/`)

Checked: no hostname, no `archon`, `fancybox`, `projektydomownowoczesnych`, no house name, no `Date`, `Math.random`, `eval`, `Function`, no script execution (JSON-LD via `JSON.parse` only, markup.ts:62-87; `stripScripts` before any reading), crawl bounded to `MAX_CRAWL_PAGES = 4` (assets.ts:28,158), same registrable domain (assets.ts:51-59,150), one level (sub-pages go through `discoverOnDocument` only, index.ts:131-141), https-only links (assets.ts:145). Classification needs `MIN_SCORE 4` from `MIN_FAMILIES 2` (classify.ts:97-98, 176) — one keyword cannot pass. Map/Set iteration is over insertion order of deterministic scans and every output is sorted.

Findings:

- **P1 — On-device determinism: page text is sorted with `localeCompare`.** published.ts:161 sorts specification lines by `label` and `text` (free-form page prose: meta description, `og:description`, the longest `<p>`), and index.ts:142 / assets.ts:158,205 / published.ts:96,132 / classify.ts:173 sort with `localeCompare` too. On desktop Node that is ICU root collation; on the phone `apps/local-analyzer/src/text.ts` replaces `localeCompare` with a table-driven ICU replica that **throws `TextNotSupportedError` for any code point outside its repertoire** ("curly quotes, `…`, `ß`, Greek, CJK"). An unknown site whose description contains `…` or `“ ”` will make `parsePublished` throw on the phone; `safely()` (acquire.ts:97) turns that into an `ADAPTER_ERROR` failure with empty facts/specs/rooms, so the sealed package — and its `contentHash` — differs between the phone and the server for the same bytes, silently. The specialist path was exposed to the same mechanism but only on one publisher's known markup; the generic reader points it at arbitrary text. Fix: sort page-text fields by document `offset` (already carried by `LabelValue`) or by a code-unit comparator (`a < b ? -1 : a > b ? 1 : 0`), reserve `localeCompare` for ASCII keys/ids/URLs, and add a generic fixture whose description contains `…` and `„”` run under `apps/local-analyzer/test`'s no-ICU harness.
- **P2 — `FACT_KEYS` mis-keys common labels (published.ts:17-32).** Rules are `find`-first and unanchored: "Wysokość całkowita: 8,27 m" hits `/calkowita/` before `/wysokosc/` → recorded as `total_area` (unit `m` from `unitOf`); "Wysokość ścianki kolankowej: 0,9 m" / "Wysokość pomieszczeń: 2,7 m" → `building_height`; "Garaż: jednostanowiskowy 24,10 m²"-style lines are fine but "Powierzchnia garażu / kotłowni" rely on order. Published facts feed the layout gate (`FOOTPRINT_AREA_WRONG` etc.), so a mis-keyed height or area is a wrong reason to reject a house. Fix: anchor the label rules (`^wysokosc( budynku| domu| calkowita)?$`, `^powierzchnia calkowita`), put `total_area` after `building_height`, and add a fixture with a knee-wall height and a storey height line asserting neither becomes `building_height`.
- **P2 — `DOCUMENT_WORDS` order makes every site plan a floor plan (vocabulary.ts:18-21).** The FLOOR_PLAN rule contains `\bplan\b|\bplany\b` and precedes SITE_PLAN; `firstMatch` returns the first hit, so "site plan", "plan zagospodarowania", "plan sytuacyjny" classify as `FLOOR_PLAN` at 0.92 and can be handed to the plan reader as a storey. Fix: move SITE_PLAN ahead of FLOOR_PLAN, or drop the bare `\bplan\b` from FLOOR_PLAN. Similarly `VIEW_WORDS` `\bpraw\w*` matches "prawie" ("almost", frequent in marketing captions) and `\blew\w*` matches surnames; restrict to inflections (`\bpraw(a|y|ej|ym|o)\b`).
- **P2 — Publisher-shaped title rules in a reader that "knows no publisher".** index.ts:152 `displayTitle` and cross-source.ts:85 `normalizeTitle` both strip `^(nowoczesny\s+)?projekt(u)?\s+(domu\s+)?` and `\s+dane\s+projektu$` — the title template of the one alternate site exercised in this stage (projektydomownowoczesnych.pl, "Nowoczesny projekt domu …"). Not a hostname, but it is a rule fitted to one publisher and duplicated in two packages. `externalId`'s split on `[/,;]` (index.ts:62) is likewise shaped by that site's `p,<id>,<slug>` path. Fix: keep the generic `projekt(u)? (domu)?` prefix, drop `nowoczesny`, put the helper once in `text.ts` with a stated rationale, and add the `adapters/generic` tree to the purity check below.
- **P2 — No architecture rule guards the new directory.** `tests/architecture/analyzer.test.ts:241-244` deliberately excludes `src/adapters` from the "no archon / fancybox" scan, so nothing would catch a hostname or a house name added to `adapters/generic/**` later. Fix: scan `adapters/generic/**` for `archon`, `fancybox`, `projektydomow`, `marcow`, `kosac`, `rarytas`, `\.pl\b` literals.
- **P3 — `registrableDomain` treats multi-tenant hosts as one site** (assets.ts:51-57): `alice.github.io` and `bob.github.io` are "the same site", so a crawl can follow a drawing-worded link to another tenant. Safety is unaffected (still https, still fenced); scope is slightly wider than "this project". Note it, or add the common multi-tenant suffixes.
- **P3 — Crawl pages are not budgeted with assets.** `fetchText` (acquire.ts:76-79) bypasses `maxAssets` (bounded by `MAX_CRAWL_PAGES`) and does not restrict media type (see §1 P2). Fine as is; document it.
- **P3 — Parse cost is unbounded by the run signal.** `readPageFacts`/`imageWords` do O(anchors × images) work over up to 24 MB synchronously; the service time limit can only fire between awaits. Consider a `maxBytes` for the page lower than for assets.

## 4. Fixtures and security tests

Present (with location): localhost (service.test.ts:157, api.test.ts:78), private IPv4 (service 155, api 79, generic-source 161), link-local/metadata (service 158, api 80), IPv6 loopback `[::1]` (service 156), credentials (service 153, api 81, generic 423), non-HTTPS (service 151, api 75), unsafe redirect refused on the hop (generic fixture 10:324, service 189, net.test 115), redirected asset revalidated (generic fixture 9:307 CDN, fixture 10 private, :338 port), oversized HTML and asset (generic 433), wrong media type (generic 450 — see §1 P2 for what it really tests), bounded crawl (generic 401), no jump to an unrelated site incl. a lookalike suffix (generic 412, 484), scripts not executed / not fetched (generic 463, generic-source 150).

Missing:

- **P2** IPv6 ULA / link-local / v4-mapped and alternative IPv4 spellings through the fence (§1).
- **P2** An Android unit test that `SOURCE_NOT_PROJECT` / `SOURCE_REQUIRES_RENDERING` / `NO_DRAWINGS` / `SOURCE_INCOMPLETE` produce `SourceContent` with `RetryAction.NONE` on **both** paths (see §7 P1; `GenericSourceDeviceTest.kt:111` only checks `if (failure is SourceContent)` — it records, it does not assert).
- **P3** A crawl page whose *redirect* lands on a private host (same `safeFetch` path as fixture 10; cheap to add for completeness).
- **P3** `generic.test.ts:60` `FACTS_TABLE` uses 128,40 / 164,50 / 6,49 — near-benchmark values in a parsing fixture. Harmless (nothing asserts against them as expected truth), but use obviously synthetic numbers to keep the "no benchmark values" rule legible.

## 5. Kosaćce topology (`packages/reconstruction/src/v2/wall-topology.ts`, `emit.ts`, `reconstruct-v2.ts`)

- Generic: no Kosaćce constant, no special case on a command index, `packages/model` untouched (verified by diff), and the model still refuses the raw runs (wall-topology.test.ts:208-213, 215-223). Tolerances are the ones the previous emitter already used (gap 15 mm, reach 60 mm, 50 mm cover slack, 0.2 m minimum; emit.ts pre-stage lines 240-275) plus one new, principled rule — "more than half a run's thickness inside a parallel exterior wall is that wall; less is noise" (wall-topology.ts:147-155) — each recorded with its metres.
- Fail to unknown: yes. Anything still sharing area after planning is dropped as `DROPPED_UNRESOLVED_OVERLAP`, listed in `plan.unresolved`, surfaced as an `AMBIGUOUS` gap and a `DEGRADED` `WALL_TOPOLOGY` trace step (reconstruct-v2.ts:1034-1041); nothing invalid is emitted.
- Tests cover L, T-exterior, T-interior, cross (and cross of equals), duplicate, partial collinear, near-collinear noise, inside-host, separate close walls, short, genuinely invalid, order-independence, and prefix replay through the real DSL.

Findings:

- **P2 — `SOLVER_V2_VERSION` not bumped (reconstruct-v2.ts:64, still `2.1.0`).** The emitter now fuses, snaps, splits (`<id>-a` / `<id>-b`), drops stubs and omits unresolved runs; for any plan with a crossing the emitted program and its hashes change. The docs say Marcówki and Rarytasy replay byte-identical — for those two the answer did not change, but the version names the *rule set*, not two houses. Bump to `2.2.0` and update `api.test.ts:59`.
- **P2 — Return hosts are untested (emit.ts:260-266).** The `inward` sign per `side` decides which face of a facade return a partition is trimmed to; a wrong sign trims the run on the wrong side or leaves it for the audit to drop. No unit case has a return as host. Add one per side.
- **P3 — Duplicate bindings for a split run (emit.ts:288-290).** `push(...)` binds `run.featureId → run.id`, then the loop binds every piece `!== run.id`, which now includes `featureId` itself when `run.id` is `x-a`. Filter `piece !== run.featureId` as well.
- **P3 — Prefix replay only for the matrix and the invalid case.** Cheap to run `replayPrefixes(program(plan.runs))` in every unit case; it is the property the whole module exists for.
- **P3 — Snap-then-fuse ordering.** Step 2 (snap off host) runs after step 1 (fuse duplicates); a run snapped clear of a ring wall can land in a parallel partition's band and is then dropped by the audit rather than fused. Fail-safe, but a real wall can be lost; re-run step 1 after step 2, or note it.
- **P3 — "Kosaćce" in a production comment (wall-topology.ts:8-9).** Not a constant, but the reconstruction package should not name a house; `docs/WALL_TOPOLOGY.md` already tells the story.

## 6. Project-specific leakage in production sources

Grep of `packages/*/src`, `apps/*/src` (tests excluded) for `kosac|kosać|marcow|rarytas|128.16|164.47|216.91|6.49|projektydomownowoczesnych`:

| hit | verdict |
| --- | --- |
| `packages/reconstruction/src/v2/wall-topology.ts:8` — comment "The third house (Kosaćce) failed exactly there" | **not legitimate as a comment in a solver**, but no constant and no behaviour (P3, §5) |
| `packages/reference-marcowki/src/{index,model,revision,commands,ledger,sources}.ts` | legitimate: this package *is* the hand-transcribed Marcówki reference specimen |
| `packages/candidates/src/index.ts:19-82` — sealed `marcowki-auto*` candidate fixtures | legitimate: a catalogue of sealed candidates by name |
| `rarytas`, `128.16`, `164.47`, `216.91`, `6.49`, `projektydomownowoczesnych` | **no hits** in production sources |

`packages/source-package/src/adapters/archon.ts` is unchanged by the stage and is the only place naming a publisher (allowed). `apps/analyzer-api/src/wiring.ts` and `apps/local-analyzer/src/wiring.ts` name `archonAdapter` and `genericProjectPageAdapter` only.

- **P3 — Artifact hygiene:** `stage-reports/artifacts/integration-004a/cross-source/cross-source.md:3-4` embeds absolute scratchpad paths (`/tmp/claude-0/…`). Strip them from committed reports.

## 7. Error taxonomy and Android copy

Service side (`packages/analysis-service/src/errors.ts`, `run.ts`, `identity.ts`, `apps/analyzer-api/src/http.ts`): all ten codes exist and are produced — `INVALID_URL` / `SOURCE_UNSAFE` (identity.ts:66), `UNSUPPORTED_PUBLISHER` (identity.ts:71, errors.ts:148), `SOURCE_REFUSED` incl. `PORT_NOT_ALLOWED` (errors.ts:92,156), `SOURCE_UNREACHABLE` (157-160), `SOURCE_NOT_PROJECT` / `SOURCE_REQUIRES_RENDERING` (149-154, with count-only diagnostics), `NO_DRAWINGS` vs `SOURCE_INCOMPLETE` (run.ts:207-216), `RECONSTRUCTION_FAILED` with `reasonCode: MODEL_EMISSION_FAILED` plus command id, wall ids and measured overlap (reconstruct-v2.ts:1046-1062). `http.ts:43` maps `SOURCE_UNSAFE` → 400.

Android:

- **P1 — The service path never produces `SourceContent`.** `AnalysisTracker.kt:166-176` turns a `FAILED` job into `JobFailed(code, …)` with `RetryAction.RESUBMIT` unconditionally. The mapping to `SourceContent` (`LocalAnalysis.typed`, LocalAnalysis.kt:353-359) is applied only on the on-phone path (LocalAnalysis.kt:258). So through the remote service a `SOURCE_NOT_PROJECT`, `SOURCE_REQUIRES_RENDERING`, `NO_DRAWINGS` or `SOURCE_INCOMPLETE` job shows the title "Nie udało się zbudować modelu" and the sentence "Analiza zatrzymała się: z rysunków tego projektu nie udało się zbudować modelu…" and offers a retry that cannot succeed. This is also a regression: the pre-stage `JobFailed` branch for `NO_DRAWINGS` ("Na tej stronie nie ma rysunków…") was removed (AnalyzerFailure.kt diff) without a replacement on this path. Fix: move `typed()` and `SOURCE_CONTENT_CODES` to `AnalyzerFailure`'s companion, call it in `AnalysisTracker`'s `FAILED` branch, and derive the retry from the typed failure; add a `ProductShellTest`/`AnalyzerContractTest` case per code on both paths.
- No user-facing string still says only ARCHON is supported. `grep "Obsługiwane"` in `app/src/main` has no hits; `analyzer_intro` (strings.xml:355) says "na przykład z ARCHON" (an example, not a restriction); `AnalyzerScreen.kt:264` placeholder shows an archon URL as an example. Acceptable; a neutral placeholder ("https://…/strona-projektu") would be cleaner (P3).
- **P3 —** `SourceContent` copy for `SOURCE_REQUIRES_RENDERING` (AnalyzerFailure.kt:118) says "którego analiza **na telefonie** jeszcze nie obsługuje"; the same limitation applies to the service. Drop "na telefonie".

## 8. Cache / versioning

- The generic adapter has its own identity, sealed into the package: `generic.project-page` / `1.0.0` (index.ts:26-27 → `pkg.adapter`, acquire.ts:172); the live alternate-Marcówki package records exactly that.
- `SOURCE_PACKAGE_SCHEMA_VERSION` `1.1.0` unchanged — correct, the sealed schema did not change (`DiscoveredCandidate.context` is discovery-time only).
- **P2 —** `SOLVER_V2_VERSION` unchanged although emission changed (§5).
- **P3 —** `ANALYSIS_SERVICE_VERSION` `1.0.0` (run.ts:43) unchanged although the failure contract gained `SOURCE_UNSAFE`, `SOURCE_NOT_PROJECT`, `SOURCE_REQUIRES_RENDERING`, `SOURCE_INCOMPLETE` and re-scoped `NO_DRAWINGS`. Clients keying on the service version cannot tell. Bump to `1.1.0`.
- The API has no cross-job cache (api.test.ts:190 asserts re-fetch), so the missing bumps cannot serve a stale answer there; the exposure is the phone's stored results and any consumer comparing hashes across versions.

## Live evidence, for context

`stage-reports/artifacts/integration-004a/alternate-marcowki`: the generic reader read the OWNER's alternate URL correctly (publisher `projektydomownowoczesnych.pl`, id `m2fa281446a8ca`, 18 rooms and 12 facts identical to the ARCHON page — `cross-source.md`), but discovered only 550 px plans and elevations (one variant each), so the run ends honestly at `PLAN_LAYOUT_REJECTED` (19.56 m² vs 131.16 m²) rather than as `UNSUPPORTED_PUBLISHER` before any byte. The OWNER's page therefore still does not reconstruct; that is a resolution-discovery limit of the generic reader, not a safety issue, and it is reported as what it is. `kosacce/live.txt`: completes (3 masses, 13 openings, 169 commands) after the topology plan.

---

## Verdict: **PARTIAL**

Safe to ship on security: the fence is at least as strong as before (stronger on IPv6/IPv4 spellings, blocked names, and ports on every hop), an unknown host gets every check an ARCHON host gets, the generic reader executes nothing and crawls within stated bounds, and the router prefers the specialist and returns typed, deterministic refusals. The Kosaćce fix is generic and fails to unknown, with the validator untouched. What keeps this from PASS is not a P0 but two P1s that contradict the stage's own claims: (1) on the service path the Android app still shows "could not build the model" plus a retry for the four new "the page is not enough" outcomes, because `typed()` runs only on the local path — the honest copy is dead code there and the old `NO_DRAWINGS` sentence regressed; (2) the generic reader sorts free-form page text with `localeCompare`, which on the phone's ICU replica throws for common characters (`…`, curly quotes) and silently seals a different package than the server. Fix those two, bump `SOLVER_V2_VERSION`, anchor the fact-label rules and the FLOOR_PLAN/SITE_PLAN order, and add the fence-level IPv6/IPv4-spelling tests and a purity guard over `adapters/generic/**`; then this is a PASS.

## Fixed after this audit (commits "fix(source): order page text by code units…" and "fix(android): type the page's refusals on the service path too")

- P1 (§3) page text is ordered by UTF-16 code units; a fixture with an ellipsis, curly and low-9 quotes is read with `localeCompare` refused on page prose, as the phone's ICU replica would refuse it.
- P1 (§7) the service path types `SOURCE_NOT_PROJECT`, `SOURCE_REQUIRES_RENDERING`, `NO_DRAWINGS` and `SOURCE_INCOMPLETE` as `SourceContent` with no retry, from one rule in `AnalyzerFailure`; the tracker test covers every code on both paths.
- P2 (§1) fence-level tests for IPv6 ULA / link-local / v4-mapped, the alternative IPv4 spellings and the blocked names.
- P2 (§2) a generic adapter without a classifier reads nothing.
- P2 (§3) fact labels anchored; SITE_PLAN before FLOOR_PLAN; `prawie` ≠ `prawa`; the alternate publisher's adjective dropped from the title rule; an architecture rule keeps publishers and houses out of `adapters/generic/**`.
- P3 (§5, §6, §8) no house in the solver's comment; the cross-source artifact carries no scratch paths; `ANALYSIS_SERVICE_VERSION` 1.1.0.

Not done, with the reason (residual debt):
- `SOLVER_V2_VERSION` stays 2.1.0: the version is part of the model's metadata, so a bump changes every model hash, including Marcówki's and Rarytasy's, whose byte-identity is this stage's regression gate; the planner is a no-op for those two houses and the candidate hash already changes where it acts. Bump it at the next stage that changes those outputs anyway.
- Role-aware media types per fetch (§1 P2), return-host unit cases (§5 P2), the duplicate binding of a split run (§5 P3; changing it changes the sealed Kosaćce candidate hash the CI gate replays to), the multi-tenant registrable domain (§3 P3), a page-size cap below the asset cap (§3 P3).
