# 005R-EXTERIOR — source-rights note

- **Publisher:** ARCHON only, as screened in 005R (`stage-reports/artifacts/analyzer-005r/corpus/source-eligibility.json`:
  `USABLE_FOR_LOCAL_RESEARCH`). No new page or image was fetched in this stage (0 network requests); every input was
  already in the 005R / N1v local work directories. DobreDomy, Archipelag and Domy w Stylu stay `SOURCE_NOT_USABLE`
  and are not touched. No license is assumed or invented, and no historical source record is rewritten.
- **No redistribution.** The repository holds code, hashes, ids, channel names, caption CLASSES, claim KIND sets and
  counts. No publisher pixel, crop, page, HTML, caption, description text or cache content is committed.
  `ledger-private.json` (local paths, per-membership details) and the 228 resize/pad copies for the stability control
  stay in the stage's private work directory, outside Git. Every writer refuses an output path inside the repository
  (`common.refuse_private_inside_repo`).
- **No cloud upload.** No publisher image was shown to any remote model, including the agent that ran this stage and
  its auditor: no image of any kind was viewed. The resize/pad control writes and hashes bytes; nothing interprets
  their content.
- **No new model, weights or dependency.** B1 is ~60 kB of stdlib Python over a JSON manifest; Pillow (already on the
  machine, not a product dependency) is used only to write the transformed copies for G5/S3.
- **Committed URLs** are only those 005R already committed (the 005R corpus manifest is read for view-side tokens);
  this stage's own JSON carries none.
