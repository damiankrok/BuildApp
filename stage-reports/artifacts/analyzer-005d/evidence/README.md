# 005D Evidence Packs

What each run saw, weighed, accepted and rejected (`docs/EVIDENCE_PACK.md`). Every pack is analyzer-owned: SVG
primitives with JSON sidecars, the decision timeline, the analyzer's own model render and a manifest of every
version, hash and file — never a publisher's pixels. `npm run -s evidence:verify -- <this directory> --max-packs 16`
checks each pack against its own manifest (CI job `analyzer-evidence-pack`).

| pack | run | why it is here |
| --- | --- | --- |
| `dom-w-azaliach` | 005D code, development row | the round-3 blind house whose overall chain a spurious mark split (§C, §P, §Q) |
| `dom-w-azaliach-005c` | the committed round-3 blind run, frozen 005C code, packed after the fact | the "before" of the first divergence |
| `rarytasy-eoze` | 005D code | current e-OZE, MUST_COMPLETE |
| `eoze-legacy-every-copy`, `eoze-legacy-area-copy-alone` | the sealed 005A evidence through the 005D solver | legacy e-OZE, LEGACY_EVIDENCE_COMPATIBILITY |
| `marcowki` | 005D code | a clean known project |
| `dom-w-modrzykach` | 005D code | the opening-heavy 005C regression house |
| `alt-marcowki`, `aster-viii`, `galaktyka`, `rarytasy-g2e`, `willa-miranda`, `dom-w-zurawkach`, `kosacce-area-copy-alone` | 005D code (the last, sealed 005A evidence) | every development fixture still failing a verdict or refused |

The passing regressions whose model hashes are unchanged (Kosaćce clean and tracked, dom-w-jablonkach) are summary
rows of `../development-matrix.json`, not packs. The two round-4 blind packs are added by the blind run, once.

`first-divergence-dom-w-azaliach-005c-to-005d.json` — `npm run -s evidence:diverge -- dom-w-azaliach-005c
dom-w-azaliach --json`: the first decision the two runs make differently.
