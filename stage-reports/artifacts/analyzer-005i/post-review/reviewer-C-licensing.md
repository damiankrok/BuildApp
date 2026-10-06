## Council reviewer C (licensing): BUILDPLAN-ANALYZER-005I Track B, c90ffd9

**Verdict: CONDITIONAL PASS.** I found no P0. Nothing tracked under `research/analyzer-005i-boundary-bakeoff` is a binary (`git ls-files` returns 37 text files). No checkpoint, ONNX file or publisher pixel is tracked anywhere: I compared the SHA-256 of every tracked image and .bin file against the 7 real frames' `sourceByteSha256`, with no match. The OWNER is never asked to test any provider. No production package or app depends on research code. Most licence claims check out against the pinned clones in `/home/user/work005i/upstream`. Two claims are wrong: the refine row's licence and the ONNX tooling line (C1, C2). Fix both before sign-off.

Checked against the pinned clones and correct:
- DeepLSD `LICENSE` is MIT. Its README says "Both models are released under an MIT license".
- pytlsd `LICENSE` is MIT, but `src/lsd.cpp` and `src/lsd.h` carry the AGPL-3.0-or-later header. Upstream master still has it.
- `deeplsd_inference.py:14` imports `pytlsd.lsd`. `line_refiner.py` does not.
- ELSED is Apache-2.0, with no other headers.
- MobileSAM is Apache-2.0; its files are Meta code plus `tiny_vit_sam.py` "© 2022 Microsoft". `microsoft/Cream` is MIT.
- The SAM README says "The model is licensed under the Apache 2.0 license". The Meta SA-1B page says "Research purposes only" and "Limited".
- MegaDepth: data is CC BY 4.0; "original images come with their own licenses".
- Wireframe README @d76e7406: "following MIT License".
- OpenCV 4.6 is Apache-2.0; Ceres 2.2 is BSD; pybind11 v2.13.6 is BSD.
- The official DeepLSD URL returns 403 from `server: Apache`. The HF mirror was created 2026-09-03 and its `x-linked-etag` equals the pinned SHA-256.

Not verifiable from here:
- The mirror's byte identity with the official files. Wayback returned 429 / connection reset, and a web search for the hash finds nothing.
- The full SA-1B licence text.
- That the MobileSAM training images are SA-1B. The README says only "1% of the original images"; secondary sources say SA-1B.

## Findings

**C1 (P2; it would be P1 if the verdict were not REJECT): the DeepLSD refine path is not "BSD/MIT/MPL/Apache".**
- **Where:** `licensing-matrix.md:29`, `:77`; `recommendation.md:138`; `dependency-matrix.md:12`.
- **Evidence:**
  - GC-RANSAC's LICENSE says it covers only GC-RANSAC, "independent of their dependencies… may affect the resulting license".
  - It bundles gco-v3.0 (`graph-cut-ransac/src/pygcransac/include/GCoptimization.h` and `energy.h`): "This software can be used only for research purposes", plus a notice of US patent 6,744,923.
  - Progressive-X's root `CMakeLists.txt:129` globs those `.cpp` files into `libGraphCutRANSAC.so`. `nm` shows 150 GCoptimization/maxflow symbols, and `PEARL.h:12` uses it.
  - The apt `libceres.so.4` links `libspqr` and `libcholmod`. Debian's copyright file lists `SPQR/*` and `CHOLMOD/Supernodal/*` as GPL-2+.
  - Research use is allowed, so this is not a violation.
- **Fix:** In all four places, say "+ gco-v3.0 (research-only, patent notice) inside GC-RANSAC; distro Ceres links GPL-2+ SuiteSparse". Change "worst open item" to the research-only clause.

**C2 (P2): the ONNX tooling is misdescribed and missing from the licence list.**
- **Where:** `licensing-matrix.md:56`.
- **Evidence:**
  - The matrix says "onnx (not used)", but `providers/onnx_export.py:38` runs `import onnx` and `:71/94/109` call `torch.onnx.export`. The venv has onnx 1.17.0.
  - onnx is neither installed by `build.sh:22` nor pinned in `manifest.json:45`, so the export step cannot be reproduced from the pins.
  - The licence of onnxruntime-web 1.30.0 (MIT, from `research/analyzer-005g/node_modules/onnxruntime-web/package.json`), used by `wasm-probe.cjs`, is recorded nowhere.
  - The exported `.onnx` graphs are derived from the weights and inherit their terms. `deployment-estimate.md:19` sizes shipping them without saying so.
- **Fix:** Add a tooling row: onnx 1.17.0 (Apache-2.0), onnxruntime-web 1.30.0 (MIT), torch (BSD-3). Pin onnx in `build.sh` and `manifest.json`. Add one line: "exported graphs carry the weights' licence and provenance". The exports stay in `$WORK`, which I verified.

**C3 (P2): the isolation gate has gaps, though it holds today.**
- **Where:** `tests/architecture/research-isolation.test.ts:45-55`, `:82`, `:93`.
- **Gaps:**
  - The checkpoint regex omits `.tar`, which is DeepLSD's own checkpoint extension. It also omits `.bin`, `.ort`, `.pkl`, `.h5`, `.pb` and `.gguf`.
  - The scan does not cover the scripts that decide what enters the APK: `apps/local-analyzer/build.mjs` and `packages/numeric-recogniser-ort/build.mjs`. Neither is under `src/` or `scripts/`, and neither matches `*.config.*`.
  - It does not read `apps/android/gradle/libs.versions.toml`, so a catalog alias could hide a dependency.
  - It does not check dependencies in `apps/*/package.json` or the root `package.json`.
- **Current state:** all of these are clean today (I grepped them). The bundle is built only from imports under `apps/local-analyzer/src`, which are scanned.
- **Fix:** Extend the regex. Add `**/build.mjs`, `libs.versions.toml` and the apps' and root dependencies to the scan. Optionally, assert that no `meta.json` input path contains `research/`.

**C4 (P2): the mirror licence is not conditioned on provenance.**
- **Where:** `licensing-matrix.md:30`, `:76`.
- **Evidence:** The weights cell says "MIT (stated)" without qualification. The authors' MIT grant reaches these bytes only if they really are the official files. The mirror's `license: mit` card tag is the mirror operator's claim. The mirror carries no copyright notice, and the HF API shows 0 downloads. Its README also adds claims that upstream does not make ("documents, floorplans, CAD exports").
- **Fix:** Change the cell to "MIT (authors) only if byte-identical to the official file — unverified; mirror's tag is not the authors' grant".

**C5 (P3):** `deployment-estimate.md:22` and `:37` say the LSD step "needs a non-AGPL reimplementation". OpenCV 4.10, which is in the venv, ships an Apache-2.0 `createLineSegmentDetector`; OpenCV restored it after the NFA code was re-published under MIT. pytlsd's variant reads DeepLSD's predicted fields, so OpenCV's version is not a drop-in replacement. Add that nuance. REJECT stands.

**C6 (P3):** `licensing-matrix.md:54` calls MobileSAM's weight licence "implied". The README at line 45 says MobileSAM uses "exactly the same prompt-guided mask decoder" as SAM, and Meta states SAM's model licence is Apache-2.0, so that part has a stated licence. The SA-1B quote at line 55 is attributed to the README, but the README says only "original images"; cite the MobileSAM paper instead.

**C7 (P3):** `licensing-matrix.md:3` says the audit happened "before any external code was executed". `LOG.md` has no entry for the audit. The `upstream/meta/{segment-anything,wireframe}` clones date from 05:30, after the pip installs of pytlsd (05:23) and line_refinement (05:29). Either add timestamps to the log or soften the claim to "before any provider was run".

**C8 (P3):** No attribution is missing from the research files. `elsed_cli.cpp:3-4` already names ELSED's commit and its Apache-2.0 licence, and reuses only one parameter expression. No harness file copies upstream code. Nothing is redistributed, so no AGPL, MIT or Apache notice obligation is triggered.

Nothing was modified in `/home/user/BuildApp` (`git status` is clean). Scratch files are in `/tmp/claude-0/reviewC/`.