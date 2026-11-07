# v3.45 drawing-reading evaluation (research, no production effect by itself)

Annotations are textual facts only: image SHA-256, the public URL, a view code, the printed numbers. No publisher image
is in this folder; the originals stay in the private evidence directory outside the repo.

- `annotations/split.json`: 23 DEV projects, 10 EVAL projects. The EVAL projects were picked by `eval-split.json`
  (seed 20261107: two projects per category listing, a family stem never used in an earlier stage, one project per family).
- `annotations/views-*.json`: view class, storey and side for every image of every project, from the image content.
  Annotator: the developer, **non-blind** for DEV (the DEV houses were known from earlier stages). EVAL annotated before any
  EVAL reader output was opened.
- `annotations/levels-*.txt`: every printed number on every section (levels with their kind, angles, vertical dimensions).
  `!` = below the 10 px legibility gate (kept for coverage, excluded from the legible set).
- `scoring/`: the scorers. Views against the observation graph's frame roles (and, separately, the pixel-only content
  classifier); section numbers against the metric evidence on the same section bytes. Exact match = same group, same printed value.
- `FROZEN.json`: SHA-256 of every annotation and scorer at the freeze.
- `level-probe.ts`: the DEV-only probe that measured what the shipped numeric recogniser reads on level-mark crops.

The image-content classifier was trained on the S01 DEV families; some EC DEV houses may be in its training set. The
EVAL projects are from family stems used nowhere before.
