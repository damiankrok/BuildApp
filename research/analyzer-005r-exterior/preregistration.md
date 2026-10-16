# 005R-EXTERIOR — preregistration (sealed before any contender run on real cases)

Sealed 2026-10-16T09:51Z, base `bfaf286e95105c2cdb32df2d298d3cd93bd43449`, branch
`analyzer/exterior-scene-feature-evidence-v1`. The brief allows one commit per stage, so the seal is mechanical, not a
git commit: `gates.py` refuses to run unless every sealed script below hashes to the value written here, and
`gates.json` records the hash of this file. Any later change is an addendum below, with its reason.

**What was seen before sealing (disclosed):** while building the ledger I printed, per edition, the publisher claim kind
sets, the plan-schedule kinds and the counts of production technical features by class and provenance (they are in the
committed manifest). No contender (B0/B1) had run on a real case; their outputs, the gates and all tables had not been
computed. The synthetic contract tests (`schema/test_schema.py`) had run.

## 1. Question

What can be established about exterior architecture of real ARCHON editions from already-local, eligible inputs — the
005R corpus (bytes hashed, never shown), the cached product pages (text only) and the sealed N1v production runs —
expressed as a source-linked JSON proposal set that rejects explicitly rather than invents?

## 2. Corpus (rule, not choice) — `ledger.py`

- Families: 005R families with an N1v canonical model whose modelled edition has ≥ 1 structural EXTERIOR_RENDER and
  ≥ 1 TECHNICAL_ELEVATION lineage group; `dom-w-marcowkach` and `dom-w-rarytasach` forced; the rest in
  `sha256(SEED:family)` order up to 12. `SEED = BUILDPLAN-005R-EXTERIOR-V1`.
- Editions (14): every modelled edition of each family (two in `dom-w-rarytasach`: `m84f…`, `m738…`), plus OWNER's anchor `m3ea28300f9b3e` (no
  production run — isolation control). `m84f2903cb8e14` is "Rarytasy 5 (G2E)", **not** OWNER's house.
- Groups: 36 unique lineage groups (14 exterior render, 14 technical elevation, 7 interior negative, 2 structure
  conflict controls; one group serves two purposes; one interior group is byte-shared by three Rarytasy editions).
  76 byte assets. Extended interior negative set: 159 assets (every interiors-carousel lineage group of the 14
  editions, complete in byte variants), scored for scene role only.
- Manifest `results/corpus-manifest.json` sha256 `417444b3ad9ded23788be65bb5cf0de961b250c89dbab1635a644983a02f6927` after Addendum D; at seal
  `04d71a40699454bcd996348ec09893c0861a6b6c63ead5aea3f80996befc0d40`, which is this file with the one key renamed back,
  byte for byte.
- No still-sealed blind family, no draw, no BLIND_14, no network. No contender fits anything: there is no train/test
  split to leak across; the 005R DEV/EVAL label is carried per edition for reference only. V1 pixel readings (fitted on
  005R DEV) are in-sample for DEV editions and non-authoritative everywhere.

## 3. Channels (never interchangeable)

`publisherStructureClaim` (page gallery/tab/carousel + caption class; product categories; description keywords),
`pixelInterpretation` (005R V1 reading, NON_AUTHORITATIVE, never decisive), `orthographicTechnicalConfirmation`
(production technical features read from plans/sections/elevations; plan room schedule and technical parameters),
`reviewerAdjudication` (NOT_RUN: no human, and no publisher image is shown to any model).

## 4. Contenders and decision rules

- **B0**: production frame roles (document/projection/view) and production technical features only.
- **B1**: `contenders.py` rules — scene: elevations tab ⇒ TECHNICAL_ELEVATION (unless the adapter projection
  disagrees); hero gallery ⇒ EXTERIOR_PERSPECTIVE; interiors carousel ⇒ INTERIOR_PERSPECTIVE; any two structural
  channels in one lineage group, or an exterior-named caption in the interiors carousel ⇒ abstain
  (STRUCTURE_CONFLICT). Edition features: CONFLICT on any publisher/technical disagreement; TECHNICALLY_CORROBORATED =
  positive publisher claim + strong technical anchor of the same class (provenance SOURCE_EXACT / CORROBORATED /
  DERIVED, or a printed schedule entry/parameter) not citing render bytes; TECHNICAL_ONLY; VISUAL_ONLY (tone-band
  production reads); TECHNICAL_NEGATIVE_CORROBORATED; PUBLISHER_NEGATIVE; PUBLISHER_CLAIM_ONLY. Production features it
  could not name (RECESS, ATTACHED_ROOF) ⇒ UNKNOWN_ASSEMBLY with alternatives; ASSUMED_FOR_RENDERING and "a zone, not a
  recess" are refused as evidence. Perspective frames: feature visibility always abstains.
- **B2**: optional; run only if a measured B1 residual names a narrow pixel predicate with a trustworthy reference.

## 5. Hard gates (B1; B0 reported alongside)

G1 variant isolation (0 EDITION_MIX; OWNER anchor receives 0 production technical anchors; shared bytes keep one
correlation group). G2 interiors (0 interior assets — selected and extended, exterior-named captions excluded — routed
EXTERIOR or carrying a non-abstaining exterior proposal). G3 perspective authority (0 metric authority on perspective;
0 SOURCE_EXACT citing a perspective; N1 guard files byte-identical). G4 look-alikes LA1–LA8 (`gates.py`).
G5 stability (10 order shuffles identical; exact/near duplicates; real resize/pad copies: attached keep the role,
unattached abstain; edition proposals unchanged; pixel channel not decisive). G6 evidence validity (validator 0 errors;
every corroboration traced to a technical anchor not citing render bytes). G7 scope freeze (only allow-listed paths).

## 6. Verdict rule

- Any G1–G7 failure after at most one grounded fix ⇒ `NO_SAFE_EXTERIOR_CANDIDATE`.
- All gates pass AND ≥ 3 of the distinctive classes {PERGOLA, CARPORT, ENTRANCE_CANOPY, COLUMNS_SUPPORTS, BALCONY,
  LOGGIA, RAILING} each TECHNICALLY_CORROBORATED in ≥ 2 families ⇒ `PASS_RESEARCH_EXTERIOR_JSON_EVIDENCE`.
- All gates pass otherwise ⇒ `PARTIAL_RESEARCH_INSUFFICIENT_TRUTH`.
- Frame-level feature visibility has no reference (no reviewer, no qualified pixel reader): reported `NOT_MEASURED`,
  never as accuracy. Agreement with the 005R structural role is CONSISTENCY (B1 reads the same structure), not accuracy.

## 7. Targeted falsification (preregistered)

Hypothesis: B1's corroboration is caused by same-edition technical evidence. F1 remove every technical input ⇒ 0
TECHNICALLY_CORROBORATED and 0 TECHNICAL_ONLY. F2 remove publisher claims ⇒ 0 TECHNICALLY_CORROBORATED. F3 launder
Rarytasy 5 (G2E) technical proposals into OWNER's anchor — as is and with anchors relabelled — and count what the
contract catches; anything uncaught is reported as a residual risk, not hidden.

## 8. Sealed scripts (sha256)

`1f3b004a15815907c256bca8cb03119b65416599a9df7d901f32ba7bfe3a2fc1`  common.py
`12e122a30f08e5a9fa8416e2b040709160d2ceec18d1bfd20003076b74cbae01`  ledger.py
`4e58ec7096f2678209da766c169f81a8028bd398d8aefb8a7a9da6fecc554eaa`  contenders.py
`e805593d88ff4a4529e4c675ee4721bb7bf0256963cfa775ef03e01fd163505c`  gates.py
`fc5943751d39b417dbc8e8fe68b5e7e4b6161b700a955122a8e239abdbd24e79`  schema/validate.py
`8955259534ace18f201a283cce6562ffe1e1b65a15e24d6cfda9fbbe1a95f097`  schema/test_schema.py

## Addenda

- **Addendum A (2026-10-16T09:51Z, before any contender output existed).** The first `gates.py` call refused at its
  output check, before running anything: `refuse_inside_repo` accepted children of `results/` but not `results/`
  itself. One-line fix in `common.py` (accept the directory itself); `common.py` was `ad1eaa5de9cae45ad93267c48ca6a906011dedf0043867b500af7c35f0858028`, is now the value in §8.
  No rule, threshold or other script changed.
- **Addendum B (2026-10-16T09:53Z, after the first full gates run).** G5/S1 FAILED: 0 of 10 order shuffles were
  byte-identical. Diagnosis: in 6 of 152 B1 proposals the `sourceEvidence` list followed input order, which also moved
  their content-derived `proposalId`; modulo anchor order every proposal and every decision was identical. Fix:
  `proposal()` sorts anchors canonically (evidence is a set). `contenders.py` was `94146d9f42c072a0d3d795e23b003f31a17048b14885e3eefa6a06304aecc659`, is now the value in §8. The
  failed first run is reported in the stage report; no rule, threshold or other script changed.
- **Addendum C (2026-10-16T09:55Z, after run 2; post-falsification).** Run 2 (all gates PASS, kept as
  `results/gates-run2-before-addendum-c.json`) showed the preregistered F3 residual: 1 Rarytasy 5 (G2E) technical
  proposal laundered into OWNER's anchor was caught as is but NOT after its anchors were relabelled, because the
  validator only knew the bytes of selected assets. Grounded fix: the validator context (`ctx_from`) also knows each
  edition's OWN production frames and solved feature ids, and refuses an anchor that cites unknown bytes or names a
  production feature that edition's run never solved (one new contract test, `test_m1b`). `gates.py` reuses
  `ctx_from` (was 81485e132096d573cd98c83735cf76d6453eb37d14f288bb185a5f469006c409); `schema/validate.py` was 63e9953e2d2d2a7b14fbacd7417b8b993853c24530212ed11de6f404a522d4cd; `schema/test_schema.py`
  was 81d271319e35f0f3dc652dfa173e8b3c29d91b0425e9cd7d104c125f5a3ec101. No B1 rule, threshold or contender changed.
- **Addendum D (2026-10-16T09:57Z, cosmetic).** The committed manifest key `publisherClaims.description` (a kind
  map, never text) is renamed `descriptionKinds`, so the repository's text-key guard can forbid `description` in
  every 005R-EXTERIOR JSON; the stale F3 note string is corrected. Anchor refs are unchanged, so the proposal sets
  must hash identically to run 3 (checked in the stage report). Previous hashes: ledger.py 74f1dbcc3f3b10b302308b7b5aae24bc1c1d1cf70d579f1093f72e2592eeb782, contenders.py 3296ef22a78e6b5cdb44c1d416a0729951520a53655abb58baa5eb31c41e659f, gates.py 2609ef68895a9cdabf3ed806b09c0eedb08df13469c644c757804a69d2a29b0f, schema/test_schema.py e10fd96a6aa341e2de6efe0b32dda6da362fbee5aa6f6ee0de0ce5ffd4f33b07.
- Seal log (outside Git, in the stage's private work directory): this file's sha256 at seal
  `48d7029f…` 09:51:34Z, after A `138a9665…` 09:51:44Z, after B `82f197f0…` 09:53:11Z, after C `09086b5b…` 09:55:13Z,
  after D `09fc2755…` 09:57:03Z. Addendum times are those of the log; this line and later wording edits change only the
  file hash recorded in `results/gates.json`.
- **Addendum E (2026-10-16, after the independent audit; post-hoc).** The audit found no invalid gate for B1's
  actual output (no P0) but: (1) the 9 GARAGE corroborations are publisher spec-sheet consistency — schedule, printed
  area and door spec are the same page as the claims; (2) 3 of 6 TERRACE corroborations are weak (derived where
  production denied the recess, or MODEL_ONLY without sightings), and the bare description token `taras` is positive
  in 14/14 editions; (3) the validator accepted 10 of 14 forged documents (unchecked schedule/param/publisher refs,
  provenance relabels, polarity flips, perspective judged by label only, SOURCE_EXACT on a frame, VISUAL_ONLY without an
  anchor); (4) LA3–LA8 hold by construction of B1 and LA2 is descriptive; (5) `garageDoorsInModel` is always 0 because
  production doors carry no usage field; (6) GARAGE carried SOURCE_EXACT with no value. Changes: `schema/validate.py`
  checks every anchor against its edition's manifest record (`anchor_is_genuine`), judges perspective and interior by
  bytes, forbids FEATURE on perspective frames and SOURCE_EXACT on frames, refuses presence statuses beside a
  negative/conflicting anchor, and refuses VISUAL_ONLY without a tone-band anchor; the audit's forgery suite is kept as
  `schema/test_bypasses.py` (14/14 refused); `contenders.py` sets GARAGE `metricAuthority` NONE; `gates.py` labels each
  look-alike control NAIVE_READER_CONTROL / CODE_PATH_ASSERTION / DESCRIPTIVE, calls F1/F2 sanity checks and drops
  the garage-door claim. A post-hoc strict recount (`addenda/e_strict.py`, B1 rules unchanged) is reported beside the
  preregistered counts. The verdict rule is unchanged and its outcome does not depend on E. Previous hashes:
  contenders.py 549497cf5d6e053a6b08b02504527e0d7b27d28ddb0581dcc7376ef6a896c050, gates.py ea9b0999b98b1f6646ead5ea77977c7abdddded8532f419c11fff08650bf7410, schema/validate.py 1d4e1ce5c647cc8a32ae44bcd2d2ca79a4abfa4b0bcc951ed4fc9153f420a038.
