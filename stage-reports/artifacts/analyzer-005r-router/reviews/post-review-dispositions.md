# Post-stage reviews — dispositions

Three independent read-only reviewers (subagents) after the comparison. No P0 from any. Every P1 is fixed in the
artefacts or recorded below; nothing was weakened to obtain a pass, and the verdict did not move.

| reviewer | # | sev | finding | disposition |
| --- | --- | --- | --- | --- |
| A source/semantics | 1 | P1 | P8 covered 7 of the 18 rows with a solved camera | ledger replayed on all 18 (`p8_ledger.py`): PASS 18/18, 67 cameras, 2 286 records |
| A | 2 | P1 | P3 on typed refusals was a presence check | `compare.py`: NOT_MEASURED on the 14 refusals; content compared on 23 rows |
| A | 3 | P1 | gate evidence missing | `gates.json`, `freeze/production-freeze-end.json` |
| A | 4 | P2 | P8 script not in the repository | `research/analyzer-005r-router/p8_ledger.py` |
| A | 5 | P2 | 34- and 37-row figures mixed | report uses 403 frames / 15 893 observations for 37 rows; summary counts 23 |
| A | 6 | P2 | PROJECT_STATUS said touched but unchanged | appended at stage end |
| A | 7 | P2 | vision "off in every product path" too strong | "off by default; `ANALYZER_VISION=live` in `apps/analyzer-api`" |
| A | 8 | P2 | `analyze.ts:178` is a comment | cited as `:179` |
| A | 9 | P2 | R1's zero two-class witnesses is a definition | said so |
| B truth/safety | 1 | P1 | "37/37 models", "interiors do not break the model" over-claimed | 23 models + 14 refusals; DEV-only, deterministic channel, frames not scenes |
| B | 2 | P1 | P7 failed as written and the incumbent fails it too | counted as failed; R0 self-failure stated; veto row no longer uses the post-hoc standard |
| B | 3 | P2 | post-hoc section could read as a pass | relabelled "NOT a result", dated after N1 (`52b4884`) |
| B | 4 | P2 | addendum A loosened P3/P5/P6 while calling itself stricter | report and matrix call it a re-specification |
| B | 5 | P2 | spot-review copy leaked the label/stratum | reviewer copy without label/stratum, seeded shuffle; DEV/EVAL wording fixed |
| B | 6 | P2 | DobreDomy exclusion only in replay.mjs | host check added in `run-case.ts` too |
| B | 7 | P2 | §I contradicted the history review | aligned; `audit-raw.json` per-line check stated as open |
| B | 8 | P1 | report read as final while gates/status were missing | gates and PROJECT_STATUS done before closing |
| B | 9 | P2 | `TECHNICALLY_INDEPENDENT` in the header could be lifted | header now `REAL_TRUTH: NOT_RUN` |
| C runtime/privacy | 1 | P1 | Python harnesses had no in-repo output guard | `refuse_inside_repo` in `spot_review.py`, `r1_meta.py`; tested in the isolation block |
| C | 2 | P2 | replay label reuse silently wipes rows; unsanitised label | refuse a finished label without `--overwrite`; label charset checked |
| C | 3 | P2 | isolation block lacked the 256-char base64 check | added |
| C | 4 | P2 | stale freeze-manifest comment | fixed |
| C | 5 | P2 | mutations restore not signal-safe; variant `sh -c` interpolation; worker bundle race under `--par 3` | recorded; freeze check would catch a left mutant; operator-only inputs |
