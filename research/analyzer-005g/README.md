# research/analyzer-005g — open-source technology audit harness

This is a research-only harness for BUILDPLAN-ANALYZER-005G.
- **Not a workspace.** It is not in the root `workspaces`, not typechecked by `npm run typecheck`, and not collected by
  vitest.
- **Never imported by production code.** The architecture tests forbid `research/` in production.

The findings are in `stage-reports/artifacts/analyzer-005g/` and in
`stage-reports/STAGE_BUILDPLAN_ANALYZER_005G_OPEN_SOURCE_TECH_AUDIT.md`.

**Publisher bytes never enter the repository.** Crops, PDFs, models and engine outputs live outside the worktree
(`/home/user/work005g` by default). Only text facts are committed: ids, hashes, boxes, transcriptions, readings,
confidences and times.

## Install (research dependencies only)

```bash
ONNXRUNTIME_NODE_INSTALL=skip npm ci --prefix research/analyzer-005g
```

Models are pinned by SHA-256 in `run-external.mjs` (`MODELS_PINNED`). Fetch them from
`https://huggingface.co/PaddlePaddle/<repo>/resolve/main/{inference.onnx,inference.yml}` into
`<models>/<repo>/`, and write `<models>/<repo>/dict.json` from `inference.yml` (`PostProcess.character_dict`).

## Reproduce

All commands run from the BuildApp root.

1. **Dataset.** The production reader on every label plus local crops. It reads the sealed packages and byte caches
   listed in `SOURCES`, or in a JSON given by `BAKEOFF_SOURCES`.
   `npx vite-node research/analyzer-005g/build-dataset.ts -- --out /home/user/work005g/dataset`
2. **External engines** (repeat per engine). Pass `--backend wasm` to use onnxruntime-web, and run it under Node 18
   for phone parity.
   `node research/analyzer-005g/run-external.mjs --engine paddle:PP-OCRv6_tiny_rec_onnx --out /home/user/work005g/runs/paddle_PP-OCRv6_tiny_rec_onnx-node-x1.json`
   `node research/analyzer-005g/run-external.mjs --engine tesseract:best_int --scale 3 --out …`
   `node research/analyzer-005g/run-external.mjs --engine paddle:… --variant pad2|trim1|scale90 --out /home/user/work005g/runs-stab/<model>-<variant>.json`
3. **Score.**
   `node research/analyzer-005g/score.mjs --out stage-reports/artifacts/analyzer-005g/ocr-bakeoff.json`
4. **PDF.** `node research/analyzer-005g/pdf-probe.mjs --file <pdf> --sha256 <hex> --scale 500 --label …`;
   `pdf-outline.mjs`; `pdf-outlined-text.mjs`.
5. **CV.** `npx vite-node research/analyzer-005g/cv-probe.ts -- --out …`.
   **Geometry.** `node research/analyzer-005g/geometry-probe.mjs --out …`.
6. **Technology matrix.**
   `python3 research/analyzer-005g/technology-matrix.py stage-reports/artifacts/analyzer-005g/technology-matrix.json`

`blind-labels-005g.json` holds the 22 labels transcribed for 005G on the round-5/6 blind houses, as text facts. 005E's
`development-labels.json` holds the other 81.
