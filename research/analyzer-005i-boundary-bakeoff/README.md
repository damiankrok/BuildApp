# research/analyzer-005i-boundary-bakeoff — boundary observation bake-off (BUILDPLAN-ANALYZER-005I Track B)

**Research only.** Not a workspace (outside the root `workspaces`), not typechecked, not collected by vitest, never
imported by `packages/` or `apps/`. It imports production packages read-only — and only from a frozen `git archive`
snapshot, never from the live worktree. Nothing here changes production behaviour.

Compares BuildPlan's own `source-cv` boundary observations with DeepLSD, ELSED and MobileSAM on the same decoded
pixels. Results and the methodology are in `stage-reports/artifacts/analyzer-005i/boundary-bakeoff/`.

**Publisher pixels never enter the repository.** Decoded frames, ink masks, MobileSAM masks, crops and overlays live
in `$WORK` (default `/home/user/work005i`). The repository holds code, pins, truth coordinates and numbers only.

## Files

| file | what |
| --- | --- |
| `observation.ts` | the research-only `BoundaryObservationCandidate` schema (Python runners write the same JSON) |
| `houses.json` | the real development set: sealed packages, offline byte caches, the frozen 005H run of each house |
| `snapshot.sh` | `git archive` of the production packages at a commit into `$WORK/snapshot` (+ this harness) |
| `extract-real.ts` / `extract-synthetic.ts` / `baseline.ts` | decode each frame with the production decoder, write the frame PNGs + ink mask, run source-cv + the boundary layer, write normalized observations and the MobileSAM prompt inputs |
| `synthetic/generate.py` | the synthetic corpus with exact truth (23 cases, fixed seeds) |
| `truth/real/*.json` | manual real-plan truth (coordinates + semantics; agent review — see methodology §6.2) |
| `manifest.json`, `fetch.sh`, `build.sh` | pins (commits, checkpoint URLs, SHA-256, sizes) and the reproducible fetch / CPU build |
| `providers/*.py`, `providers/elsed_cli.cpp` | provider runners (ELSED, DeepLSD detect + refine, MobileSAM with the fixed prompt protocols), ONNX export |
| `run-providers.sh` | every provider configuration on every frame of a set, one process per frame |
| `fusion-replay.ts` | the mask-union replay through the production boundary layer (+ a no-external-information control) |
| `score.py`, `aggregate.py`, `determinism.py`, `wasm-probe.cjs` | scorer (asserts the same-input hashes; ±u truth-buffer pass), artifact writer, reproducibility re-run / whole-set re-run comparison, Node 18 WASM probe |
| `repro-sidesof.ts` | reproduces the production boundary layer's `sidesOf` TypeError on a sheet with no wall-thick ink (side finding; production imported read-only) |
| `tools/look.py` | annotation aid: crops with a labelled pixel grid (outputs stay outside the repository) |
| `truth/annotation-log.json` | provenance of the manual truth: every `look.py` invocation, truth write times and SHA-256 (text facts only) |

## Reproduce (from the BuildApp root)

```bash
export WORK=/home/user/work005i
research/analyzer-005i-boundary-bakeoff/fetch.sh            # pinned clones + checkpoints, SHA-256 verified
research/analyzer-005i-boundary-bakeoff/build.sh            # venv (CPU torch), ELSED, pytlsd, DeepLSD refinement
research/analyzer-005i-boundary-bakeoff/snapshot.sh 29ab643 # frozen production packages
cd $WORK/snapshot
for h in dom-w-helikoniach dom-w-morelach willa-miranda dom-w-zurawkach dom-w-azaliach dom-pod-jarzabem dom-w-arkadiach; do
  npx vite-node research/analyzer-005i-boundary-bakeoff/extract-real.ts -- --house $h
done
$WORK/venv/bin/python -I -B research/analyzer-005i-boundary-bakeoff/synthetic/generate.py --out $WORK/synth
npx vite-node research/analyzer-005i-boundary-bakeoff/extract-synthetic.ts -- --corpus $WORK/synth
THREADS=2 research/analyzer-005i-boundary-bakeoff/run-providers.sh real
THREADS=2 research/analyzer-005i-boundary-bakeoff/run-providers.sh synthetic
npx vite-node research/analyzer-005i-boundary-bakeoff/fusion-replay.ts -- --set real
npx vite-node research/analyzer-005i-boundary-bakeoff/fusion-replay.ts -- --set synthetic
P="$WORK/venv/bin/python -I -B research/analyzer-005i-boundary-bakeoff"
$P/score.py --set real --truth research/analyzer-005i-boundary-bakeoff/truth/real --out $WORK/scores/real.json
$P/score.py --set synthetic --truth $WORK/synth --out $WORK/scores/synthetic.json
$P/providers/onnx_export.py --deeplsd-repo $WORK/upstream/DeepLSD --deeplsd-ckpt $WORK/ckpt/deeplsd_md.tar \
  --msam-repo $WORK/upstream/MobileSAM --msam-ckpt $WORK/ckpt/mobile_sam.pt \
  --gray $WORK/frames/real/dom-w-helikoniach.gray.png --rgb $WORK/frames/real/dom-w-helikoniach.rgb.png --out $WORK/onnx
for m in deeplsd_md_fields mobile_sam_encoder mobile_sam_decoder; do   # one process per model: isolated RSS
  <node-v18.20.4>/bin/node research/analyzer-005i-boundary-bakeoff/wasm-probe.cjs --only $m \
    --ort <BuildApp>/research/analyzer-005g/node_modules/onnxruntime-web --onnx-dir $WORK/onnx --out $WORK/onnx/wasm-probe-$m.json
done   # then merge the three into $WORK/onnx/wasm-probe-node18.json ({models, peakRssMiBPerModel}) for aggregate.py
# NB the per-model RSS is sampled on the event loop that single-thread WASM blocks: it is the RSS AFTER inference,
# a lower bound on the peak; aggregate.py publishes it under that name (post-review D8)
$P/determinism.py --frames real/dom-w-helikoniach,synthetic/l-shape --out $WORK/determinism.json
$P/determinism.py --compare-prev <copy of $WORK/obs from an earlier full run> --out $WORK/rerun-b5-compare.json   # optional
npx vite-node research/analyzer-005i-boundary-bakeoff/repro-sidesof.ts -- --work $WORK   # side finding, from $WORK/snapshot
$P/aggregate.py --out <BuildApp>/stage-reports/artifacts/analyzer-005i/boundary-bakeoff
```

The real frames are read **offline** from the sealed packages and byte caches named in `houses.json`; the frozen 005H
runs (`/home/user/work005h/m-on`, `/home/user/work005h/blind7`) supply the observation graph, metric evidence and plan
digest of each house. The baseline is re-derived on the snapshot and checked equal to the frozen digest's gap tallies.

## Environment notes

- DeepLSD's official checkpoint server returned HTTP 403 on 2026-10-06; `manifest.json` pins an unofficial mirror by
  SHA-256 and says so. `fetch.sh` refuses any other bytes.
- ELSED's and pytlsd's vendored pybind11 copies do not build on CPython 3.11: ELSED is driven through
  `providers/elsed_cli.cpp` (mirrors upstream `PYAPI.cpp`); pytlsd is built with pybind11 v2.13.6 glue.
- System packages (`libopencv-dev`, `libceres-dev`, `libeigen3-dev`) are for the research box only; they say nothing
  about Android or production (see `deployment-estimate.md`).
