# STAGE BUILDPLAN-ANALYZER-005N — compound facade mouths, recessed entrance / garage body relation, blind round 10

**Verdict: PARTIAL — `PARTIAL_BUILDPLAN_ANALYZER_005N_BLIND10_METRIC_EXTENT_FAIL`.**

Every §45 condition holds except the last: blind round 10 has two fresh ALGORITHMIC_FAILs.

- Their first bad decisions are METRIC and EXTENT, not the compound-facade class.
- Neither house exercises the target topology (`TARGET_CLASS_EXERCISED = NO`).

## Summary

| item | result |
| --- | --- |
| branch | `analyzer/compound-facade-atomic-intervals-v1`, from `analyzer/visual-referee-v2-distillation-audit-v1` @ `5957e3a`; every push mirrored to `claude/new-session-3kzcgh` |
| production change | `packages/reconstruction`: new `compound-facade.ts` (`COMPOUND_FACADE_VERSION` 1.0.0); the wiring in `plan-decomposition.ts` (`PLAN_EXTENT_VERSION` 1.1.0); digests; Evidence Pack **1.4.0** (`12c-compound-facades.json`). No new dependency, native library or model (`geometry-kernel-decision.md`: `NO_NEW_KERNEL`) |
| root (Part A) | gozdzikowcach: `COMPOUND_GAP_NOT_SEGMENTED` — the recess mouth, its return and the garage door read as one 7.76 m gap. murajach: **not this root** — `EXTENT_EXCLUDES_ATTACHED_BODY`; the "6.45 m mouth" is an interior line (`root-classification.md`) |
| compound spans | a wide gap on an envelope side is read from the boundary's own wall-solid layer. Separators are WALL_RETURN (a wall ≥ max(0.9 m, 3 walls) inward) or FACADE_PIER; posts, short marks and thin lines are never separators. Atomic intervals are decided on their own infill, callout, signature and pocket |
| recess semantics | a recess is a mouth between two returns with a set-back wall at most 4.5 m deep. Its mouth stays open; the back wall becomes a grid line and closes the building; cells inside are labelled RECESS |
| garage relation | a garage mouth is closed by its own drawn door (infill stopping at two ink jambs, never a dashed line or a pattern), or by its own callout when walled deeper than a recess with nothing drawn across. A blank garage is never fabricated |
| open-side safety | carport, loggia, porch on posts, covered terrace, passage, corner recess and missing return stay open, in all five orientations |
| extent | `cornerJoined`: in the weak (wall) frame, a long band beyond the 35 % margin is kept when a wall-thick band anchored in the chains' rect meets it in a corner or T. One hop only; a detached garage is never joined |
| murajach | the extent fix puts the garage back in the plan. The row still fails, now on **METRIC**: ground copy registered at 2.451 cm/px, 5 labels read on 79 dimension lines. The refusal code is the same as at the start; the first bad decision is downstream and independent |
| gozdzikowcach | the old merged 7.76 m OPEN_SIDE is **gone**: a WALL_RETURN separator, a recess (back wall 1.22 m, line added) and the garage built. First bad decision moves PLAN_RESOLUTION → **MODEL_EMISSION** (chimney emitted 0 m: no main roof inferred — no elevation registered, no ridge datum). Independent of 005N |
| jarzabem | a different topology (one mouth, step-line infill), unchanged, not tuned |
| cyklamenach | negative control, unchanged |
| development matrix (42 rows) | PASS→PASS 18, FAIL→FAIL 24, **no verdict change**; one model changes (gozdzikowcach). A05: an intermediate PASS came from the order-dependent pocket re-count the council found, given up |
| 005L storey controls | unchanged (every storey row's model identical); a two-storey end-to-end fixture with a compound ground front added |
| drawn-gap rule | OFF (product default; gate `gap-evidence.test.ts`; M8 killed) |
| non-circularity | architecture gates (imports, forbidden vocabulary, house names, frozen numbers); executed decoy (published footprint absent / exact / 1.25×: identical compound records); M4, M10 killed |
| mutations | **14/14 killed** at `4e12ce5` (M1–M10 + M11–M14 for the council fixes) |
| order invariance | bands, chains and callouts shuffled 8× each and together; five orientations on every major family; the 10 rows with compound spans replayed twice: identical model and byte-identical plan digest |
| performance | interleaved old/new on 42 rows: median read **0.97×**, layout **1.01×** (old-vs-old noise 1.00); the compound reader takes ≤ 6.9 ms per row. An earlier +18 % was the reader building the full-sheet solid layer on unscaled plans — fixed |
| council | 5 reviewers + adversarial verification (56 findings; 9 confirmed P0/P1, all fixed). Round 2 on the fixes (2 reviewers; 1 P0 + 3 P1 confirmed, all fixed) |
| PRE_HOLDOUT_10_SHA | `d7873977aac89d6283e41f94ec1942b570adceaf` (CI 38297543325 green, 39 pass, 2 skipped by design) |
| blind round 10 | #1 `dom-w-glogownikach` (garage stratum): **ALGORITHMIC_FAIL**, first bad **METRIC**. #2 `dom-w-akebiach` (unstratified): **ALGORITHMIC_FAIL**, first bad **EXTENT** |
| TARGET_CLASS_EXERCISED | **NO** |
| OWNER APK | **published and verified**: versionCode 1212, run 212 on `f091d15`, SHA-256 `1d009f91…afa51`, preview signer `6e48fac4…a0da`, arm64-v8a only, the same five native libraries, OCR model / dictionary / WASM byte-identical; only the analyzer bundle changed (+30 KB). Polish checklist in §T |
| inherited 005H ARM64 device parity | **PENDING** (not inferred from the emulator) |
| NEXT | **`OTHER_MEASURED_RESIDUAL`** — the plan's scale from its printed dimensions (METRIC) (`recommendation.md`) |

## A. Baseline forensics (before any production edit)

Records: `baseline-compound-facades.json` and `root-classification.md`. These come from decomposition traces of the development rows, replayed solver-alone on their sealed evidence (`research/analyzer-005n/trace-decompositions.mjs`).

**Gozdzikowcach.** `collinearWideGaps` read along-pieces from bands only. The wall-thick pier and its return (ink, not a band) were invisible, so the recess mouth, the pier and the 325 cm garage door became one 7.76 m gap. Its infill was measured over the merged span (0.39). Its pocket (71.1 m²) was under the merged limit (150.4 m²), so it was read OPEN_SIDE. No grid line stood at the set-back wall.

**Murajach.** The legacy extent dropped the garage's long wall beyond the chains' 35 % margin, although the house's top wall runs continuously into its corner. The facade itself was already atomic in the boundary reader. The measured next decision was METRIC; it was recorded, not repaired.

## B/C. Implementation and Evidence

Design: `architecture.md`.

**Path.** `decomposeCore` → `collinearWideGaps` → for a wide gap on an envelope side, `compoundSpanOf`:

1. Read the facade line, and snap the jambs to their ink.
2. Classify each ink piece inside the gap as a separator candidate.
3. Cut the gap into intervals and decide each interval's role.

The decomposition then:

- replaces the parent gap with its intervals;
- weighs each interval's pocket at its own width, and weighs sibling mouths jointly where they share a space;
- adds back-wall grid lines;
- enters separators and back walls as shut evidence;
- relabels the recess cells.

A gap left whole is decided exactly as the incumbent decides it, and is still recorded.

**Guards added through the council:**

- no reading on unscaled plans;
- a back wall only where both returns end (between bare cross-sections);
- a callout closes a mouth only when the walls run deeper than a recess and nothing is drawn across;
- dashed and pattern infill never closes;
- the pocket test is order-invariant;
- sibling mouths are weighed jointly;
- sharers are counted in cells.

**Evidence:**

- Plan digest `compoundFacades`, recording every span read, cut or left whole, tagged BOX or OUTLINE. The box reading is kept when the outline is adopted.
- `wideOpenings[].compound`.
- Evidence Pack 1.4.0: `12c-compound-facades.json` and the COMPOUND_FACADES timeline events.
- Run-record versions `compound-facade` 1.0.0 and `plan-extent` 1.1.0. The CanonicalBuildingModel schema is unchanged.

**Evidence gap, pre-existing.** A run that fails at model emission carries no plan digest into its failure record or its Evidence Pack (12c then lists no copy). For development rows, `research/analyzer-005n/compound-record.ts` reads the digest before emission; this is how `compound-facade-evidence.json` covers gozdzikowcach.

## D. Synthetic / adversarial corpus

`synthetic-compound-facades.json`: 45/45 at `4e12ce5`.

- **§21 families 1–22, five orientations each.** This includes the target, blank and double garages, a window, a pier, a mullion, a carport, a porch on posts, a loggia, a covered terrace, a passage, a corner recess, a missing return, callout safety, a garage callout, line work, furniture, a narrow return, and the extent.
- **§16 per-interval pocket.**
- **The council fixtures:** steps, a drain and treads; callouts at shallow and glazed-back bays; paving; two mouths; a shared space; an open-plan house behind a pier.
- **The adopted-outline record and the unscaled plan.**
- **§23 end-to-end through `reconstructV2`:** recess with the garage door drawn, a blank garage, a carport, the executed non-circularity decoy, and a two-storey house with a compound ground front.

## E. Development cases

`development-matrix.json` (final replay at `4e12ce5`), plus `compound-facade-evidence.json`: 20 rows have facade gaps read, 8 spans cut and 25 left whole.

**Unchanged rows.** The storey controls, Kosaćce (its earlier false closure stays fixed), Marcówki, the open-side controls and every PASS row.

**Changed models.** Gozdzikowcach only.

**A05 (FAIL at both ends).** An intermediate build passed A05, but through council finding A2: a 3.74 m gap on another line was shut first, and its 52.6 m² pocket was then counted again behind A05's two mouths. Weighed on their own, the mouths lead into 10.9 m² and into nothing. The stage gives that pass up.

**The compound reader's own effect.** On the 42 rows it changes the first bad decision of one row (gozdzikowcach) and no verdict.

## F. Mutations

`mutation-results.md`: 14/14 killed.

| mutation | what it breaks |
| --- | --- |
| M1 | no split |
| M2 | close every interval |
| M3 | callout across a separator |
| M4 | published area chooses |
| M5 | whole-span pocket |
| M6 | any block a separator |
| M7 | missing return still a recess |
| M8 | drawn-gap rule ON |
| M9 | callout order |
| M10 | house special case |
| M11 | pocket order (A2) |
| M12 | any line between returns a back wall |
| M13 | callout without the depth rule |
| M14 | no joint weighing |

## G. Order, determinism, performance

`order-invariance.json` and `performance.json` (summary table above).

**The slowdown episode.**

- The first sequential measurement showed median read +18 %, with D00–D05 at about 1.9×.
- Interleaving old and new showed this was real.
- A CPU profile of D03 traced it to the reader building the full-sheet solid layer (morphology, 5 s of CPU) on unscaled plans, where the boundary reader, and so the old code, never builds it.
- The fix (no compound reading on a unit-placeholder registration) is also a correctness fix (council E1).

**Wall time.** The development replay's wall time was unchanged at `0e996b6` (median 0.998).

## H. Council

`post-review/council-findings.json`, `council-round2-findings.json` and `resolution.md`.

**Round 1** (reviewers A–E, 56 findings). These were confirmed at P0/P1 and fixed:

- **B1, B2 (P0):** callout closure without depth; a thin line between returns taken as the back wall.
- **A1, A2, C1, D1, D2 (P1):** the shallowest phantom back wall; the pocket re-count; a callout closing a loggia; sibling mouths blind to a shared space; glazing past a pier.

Downgraded to P2 or P3 and fixed anyway: D3, B4, A6, C2. Refuted: A4, B3, B5, E1 (already fixed), E2. The remaining P2/P3 findings are left open, with their reasons, in `resolution.md`.

**Round 2** (two reviewers on the fixes):

- **S1 (P0):** the floor-clearance test still took a drain or three treads for glazing. It is replaced by topology: between bare cross-sections, glazing is the back wall only where both returns end.
- **R1 (P1):** the same test let a dashed overhead line veto a real back. The trade-off is recorded: a glazed back between returns that run on past it as interior walls falls back to the pocket test, the starting code's outcome.
- **R2 (P1):** a callout blocked by a drawn back.
- **R3 (P1):** sharers counted in cells.
- **S6:** OUTLINE tag. **R9:** debug output removed.
- **Refuted:** S2, S3.

## I. Freeze

`PRE_HOLDOUT_10_SHA = d7873977aac89d6283e41f94ec1942b570adceaf`, CI 38297543325 green on attempt 1. Every §34 item held. No production code has changed since.

## J. Blind round 10

`blind-round/README.md` has the full record; `holdout/README.md` § Round 10 has the protocol.

**Draw.**

- Seed `c2e1de89…c8cd`, recomputed independently.
- Pool `800c2a1e…`; 1580 drawable.
- Exclusions `83d2aa04…c446` (134 families).
- Garage stratum, read from the page's own published garage area, calibrated 27/27 on development pages before the draw.

| # | house | stratum | verdict (sealed 20:05:53Z) | first bad decision |
| --- | --- | --- | --- | --- |
| 1 | `dom-w-glogownikach` | garage (28.58 m²), k = 0 | ALGORITHMIC_FAIL | **METRIC**: the recogniser misreads 541 → 501 and 870 → 810. The two misreads state a second scale (2.432 cm/px) against the corroborated 2.629, and plan resolution refuses (SOURCE_CONFLICT). The compound reader correctly refused a mullion block between two terrace doors, and the gap was correctly an opening |
| 2 | `dom-w-akebiach` | unstratified, i1 = 137 | ALGORITHMIC_FAIL | **EXTENT**: the walled envelope stops short of the living room's 0.96 m rear projection (its back wall is a 4 m door) and of the 4.30 m garage projection. Both extent-conflict completions are refused. The core then floods through the 6.86 m mouth into the projection, which the reader correctly left whole and the incumbent read as OPEN_SIDE |

**TARGET_CLASS_EXERCISED = NO.** Neither house has a recessed entrance beside another mouth on one facade line:

- #1's front is flush.
- #2's entrance sits in the inside corner beside a projecting garage.

The round is valid whole-house evidence: two fresh failures, both upstream of any compound decision. It is not proof that the target topology generalizes.

## Residuals (recorded, not repaired)

- **Emitter recesses.** The v2 emitter carves recesses only from dimensioned zones. A topology recess is carried by the structural layout (a RECESS region and a recess hypothesis with its returns), but is emitted inside the rectangular mass with an opening at its mouth. This is unchanged from the start.
- **Per-edge line closure.** The incumbent per-edge rule takes a line inside the wall's band (such as paving) as drawn across a cell edge, and builds a blank bay. The starting code does the same (council B3, refuted as a regression).
- **Inner facades.** Compound spans on the inner facades of L/T/U plans are not read; only envelope sides are.
- **T-junction glazed backs.** A glazed back between returns that run on past it is not read as a recess back wall (round 2, R1 trade-off).
- **Emission-failure evidence.** The Evidence Pack has no plan digest for an emission failure (§B/C).
- **Development failures outside this class:** gozdzikowcach MODEL_EMISSION (chimney), murajach METRIC, A05 PLAN_RESOLUTION.

## K. Gates

| gate | result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm test` | 176 files: 2324 tests pass, 11 skipped by design (at `4e12ce5`) |
| architecture | 22 files, 263 tests |
| CI | freeze run 38297543325 green (39 pass, 2 skipped); final run 212 (`38302648949`) on `f091d15` green on attempt 1 (40 pass, 1 skipped by design, OWNER APK published) |
| no publisher pixel committed | Evidence Packs: JSON layers, README and manifest only; overlays and plans stayed in `/home/user/work005n` |

## T. Final CI and OWNER APK

**Final CI:** `workflow_dispatch` run 212 (`38302648949`), attempt 1, on `f091d15`. It is green: 40 jobs pass, and 1 is
skipped by design (`preview-latest`). The OWNER release job published. The analyzer code is the frozen code
(`PRE_HOLDOUT_10_SHA` `d787397`); only the ledger, sealed evidence and documents differ.

**OWNER APK:**
`https://github.com/damiankrok/BuildApp/releases/download/owner-preview-latest/BuildPlan-owner-preview.apk`.
Verified from the downloaded file, not from the notes:

| check | result |
| --- | --- |
| direct link | serves the APK: 39 457 127 bytes; asset updated 20:55:17Z, downloaded after run 212 completed |
| SHA-256 | `1d009f91c38d79a7a0fe48ecff550f47e0258891a1d751f0cbdf11b1ba0afa51`, equal to the release notes and to GitHub's asset digest |
| version | `com.buildplan.preview`, **versionCode 1212**, versionName `0.212.0-preview`, minSdk 26, targetSdk 35 |
| commit / run | the notes give run 212 (attempt 1) from `claude/new-session-3kzcgh` @ `f091d1505d27266704daf394fcc356145a36f6a0` |
| signer | `apksigner verify --print-certs`: "CN=BuildPlan Model Preview, OU=Preview builds (not a production key)", certificate SHA-256 `6e48fac4…a0da`, the same preview key as 1193. It installs over build 1193 |
| zipalign | `zipalign -c -P 16 -v 4`: verification successful |
| ABI / native libraries | `native-code: 'arm64-v8a'` only. The same five libraries at the same sizes as 1193: `libnode`, `libbuildapp_node_bridge`, `libfilament-jni`, `libc++_shared`, `libandroidx.graphics.path`. **No new `.so`** |
| permissions | `INTERNET` and AndroidX's own `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, unchanged |
| OCR model / dictionary / WASM | **unchanged, byte for byte**: `PP-OCRv6_tiny_rec.onnx` `9ef676d6…`, `PP-OCRv6_tiny_rec.dict.json` `9a8199f8…`, `ort-wasm-simd-threaded.wasm` `3398c10d…`, `ocr-worker.mjs` `9a85e0c5…`, `ocr-self-test.mjs` `d12a6f18…` |
| what changed against 1193 | the same file set; exactly four entries differ by SHA-256. `AndroidManifest.xml` (version) and `classes5.dex` (build config) carry the new build number; `assets/local-analyzer/manifest.json` carries the bundle's hash. `analyzer.mjs` grew 2 260 511 → 2 290 926 B (+30 415 B), the compound reader and its wiring (`compoundSpanOf`, `COMPOUND_FACADE_VERSION`). Every other file is identical |
| no research asset / no weights | no file names DeepLSD, ELSED, MobileSAM / Segment Anything, `research/analyzer`, a VLM (Qwen, SmolVLM, InternVL, llama) or a weight format (`.gguf`, `.safetensors`, `.pt`, `.pth`, `.ckpt`); the Evidence Pack is developer tooling, not in the app |
| size | 39 457 127 B against 39 447 295 B: **+9 832 B** |

No APK binary is committed.

**INHERITED_005H_ARM64_DEVICE_PARITY: PENDING.** It is not inferred from the emulator.

### OWNER phone checklist (po polsku)

Zainstaluj `BuildPlan-owner-preview.apk` (versionCode 1212) na poprzednią wersję (1193). Każdy dom dodaj przez
„Dodaj dom z linku”. Telefon pobiera stronę i liczy na nowo, więc wynik może się trochę różnić od komputera. Jeśli
się różni, odeślij zrzut ekranu i kod wyniku.

1. **Znany dom z cofniętym wejściem i garażem: dom w goździkowcach 3**
   (`https://www.archon.pl/projekty-domow/projekt-dom-w-gozdzikowcach-3-m79923e950094d`).
   - Na komputerze rzut parteru jest teraz czytany poprawnie: wnęka wejścia zostaje wnęką, za nią hol, a obok garaż
     z bramą należy do domu.
   - **Uwaga:** model 3D nadal się nie zbuduje. Analiza kończy się później, na kominie (brak dachu głównego), a nie
     na rzucie. To osobny błąd, którego ten etap nie naprawia.
   - **Odeślij** kod wyniku. Oczekiwany: błąd budowy modelu (`MODEL_EMISSION_FAILED`), a nie „niejednoznaczny rzut”.
   - Jeśli kiedyś zobaczysz ten dom w 3D, sprawdź:
     - wejście jest wnęką;
     - garaż jest częścią domu i ma bramę;
     - we wnęce wejścia nie ma sztucznego pokoju.
2. **Prawdziwa strona otwarta: Kosaćce** (link jak w poprzednich testach).
   - Dom ma się zbudować jak w wersji 1193.
   - Zadaszony taras obok okna zostaje **otwarty**, nie staje się pokojem.
3. **Znany dom dwukondygnacyjny z 005L: Marcówki**
   (`https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca`).
   - Jak w 1193: 2 kondygnacje, około 131 m²; nad garażem nie ma piętra.
4. **Test zgodności odczytu wymiarów** (z 005H, wciąż otwarty). „Dodaj dom z linku” → „Test zgodności odczytu
   wymiarów” → „Uruchom test”, potem „Kopiuj wynik”.
   - **Zaliczony:** „Zgodny z komputerem”, model `9ef676d6…`. Model OCR się nie zmienił.
   - **Odeślij też:** czas na etykietę, model telefonu i ilość RAM.
