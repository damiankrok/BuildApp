# v3.54.16 — the frozen trial: rule written before any trial run (2026-11-19)

**What is frozen first.** The trial runs only on the commit that freezes the code, the prompts (contract 0.3.0, prompt
0.4.0, registry 1.0.0, executor 1.0.0, source gate 1.0.0, sketch proposals 1.0.0, quality 1.0.0), the transport (the
host's: Sonnet 5.5 for the check and the sketches, Opus 5.5 for the metric read, prompt cache 5 m) and the measures
(quality states, defect settlements, the executor's records). Nothing is tuned after a trial result: a change made
after looking at one is labelled DEV and the first result stays the result.

**Two families, two publishers, two kinds of documentation.**

1. **ARCHON** (archon.pl, its own adapter): colour photoreal elevations and sections, mostly two storeys.
   Pool: `archon-pool.txt` — the 34 project pages linked from the public listing `https://www.archon.pl/projekty-domow`
   as fetched on 2026-11-19 (text URLs only).
2. **Studio Atrium** (studioatrium.pl, the generic page adapter): another drawing style and page structure, neither
   Lipińscy's simple set nor ARCHON. Pool: `studioatrium-pool.txt` — the project pages linked from the public
   alphabetical list `https://www.studioatrium.pl/alfabetyczna-lista-projektow/` as fetched on 2026-11-19.

**Order.** seed = sha256(`<freeze commit>:V35416-TRIAL:<publisher>`); start = seed mod pool size; walk the pool from start.

**Exclusions.** A family (the page's name with any trailing variant — roman numeral, digit, `-g2e`, `-oze`, `duo` …
stripped) that appears anywhere in this repository's research or in the private run records (`seen-before.txt`) is
skipped: it was developed or evaluated before. The private H2 / OWNER holdout is never opened.

**Acceptance of a candidate (on the acquired package only, before any analysis).** The page acquires (public, allowed
host); it has a ground-floor plan; at least three elevations labelled FRONT, REAR, SIDE_LEFT/SIDE_RIGHT (or side
unspecified); total size of the cached package within the disk budget. The first accepted candidate of each pool is the
trial family. Every opened candidate and its reason is written to `selection.json`; at most 12 are opened per pool.

**What is run and kept.** Each family once through the same service path as the host (`run.ts` live: metric read,
four sketches, the sketch channel, the post-build check with up to 2 correcting looks and a last look), first result
kept as is (models, scenes, answers, executor records, quality, sketches). Budget per family: worst case reserved by the
v3.54.16 ledger before each request; the trial is stopped, and named, if the remaining pool would not also cover the
final host job.

**References and tolerances, before results.** No hand reference is drawn for the trial families: the source pictures
are the reference and the measures are the executor's own (the built element drawn back into the source picture, z of
its support over the picture's own null boxes ≥ 2, overlap with the proposal ≥ 0.85) and the reviewer's look at the
delivered revision. Quality is reported per family as the quality state, its reasons, the defects with their
settlements, and separately what the miniature shows (form, openings, finishes, interior) — never a single grade, and a
result from one family is not TRANSFER_EVIDENCE for every source.

**A pool that yields no accepted candidate** gives no trial family for that publisher: it is named as missing, never
replaced by hand. (Noted before the walk: of the ARCHON listing's 34 pages, 33 are families seen before, so that pool
has a single candidate; the Studio Atrium list has 97 unseen of 106.)
