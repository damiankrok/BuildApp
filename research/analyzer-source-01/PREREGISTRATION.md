# SOURCE-01 — preregistration (frozen before any classifier, feature or threshold existed)

- **Split by house family** (`split.json`): families sorted by `sha256("source-01-split|" + family)`; the first ten
  that are not among the eight regression houses are TEST. Everything else (24 families of the 005R corpus and the
  eight regression houses) is DEV. A byte-identical image on both sides is dropped from DEV.
- **TEST set** = the ten TEST houses acquired live through the production `acquireSourcePackage` (270 assets);
  their production roles are the BEFORE (`stage-reports/artifacts/analyzer-source-01/routing-before-test.json`).
- **Labels**: inherited IU-01/02/03 agent labels by SHA-256 where they exist; the rest labelled now from anonymised
  contact sheets (`labels-test-new.json`, `labels-dev-new.json`). A blind relabel of 40 inherited TEST labels agreed
  40/40 (`label-audit.json`). Labels are agent labels, not OWNER-verified.
- **Model selection** happens only on DEV (grouped by family). TEST is evaluated once, with the frozen choice.
- **Measure**: routing of each asset to the reader its content deserves — PLAN, FACADE, SECTION, SITE,
  EXTERIOR_CAMERA, NONE — wrongly admitted, wrongly refused, UNKNOWN, coverage; plus the same with every caption
  replaced by a wrong one (adversarial captions). Refusing everything is not an improvement: coverage is reported.
