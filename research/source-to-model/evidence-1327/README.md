# ANY-LINK evidence of APK 1327, secured at the start of v3.53 (2026-11-10)

What is here (text only, no publisher image and no page body):

- `EVIDENCE-1327-INDEX.json` — every saved ANY-LINK run of the v3.51 campaign: set (DEV, CONTROL first blind run,
  CONTROL re-runs, CONTROL-2 on both revisions), the tree each set ran on (`runsHeader`), page URL, source-package
  content hash, outcome (model with its hashes and warnings, or the refusal code and first failing gate), seconds.
- `EVIDENCE-1327-MANIFEST.sha256` — SHA-256 of all 3857 files of the session work directory `rd/anylink` (run
  directories, the byte cache of the fetched pages and images, probes, tools).
- `evidence_index.py` — how the index was made.

The bytes themselves are outside Git (publisher images): `BuildPlan-S53-Evidence-1327-Private.zip`, delivered to the
OWNER in the session; its SHA-256 is in `PROJECT_STATUS.md`.

Named gaps:

- The corpus runs of 1327 (33 ARCHON projects) are in `BuildPlan-SOURCE-TO-MODEL-Private-1326.zip` (revision `101f9d7`);
  for `0fe410a` only three corpus houses were re-run (hashes equal), as the report says.
- The DEV baseline directory `base` ran on tree `f239a2d`, not on a checkout of `572b875`; the report calls it "kod 1322".
  The index records the tree as the run recorded it.
- No device (phone/emulator) record exists for 1327.
