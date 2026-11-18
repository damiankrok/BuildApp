# v3.54.11 — LOCAL on originals (A) vs simplified rasters (B) — results (protocol: `../LAYERS_PROTOCOL.md`)

Same LOCAL revision (`84de494` tree; `second-house.ts --recogniser`), same packages apart from the replaced bytes,
separate caches, 0 USD. Every model measured against the ORIGINAL sources' references.

**Deviation from the protocol, stated:** the protocol wrote "outside the building's convex region"; the tool
implements "sky/vegetation pixels connected to the picture's border through such pixels" (no building region is known
without a reading). The effect is the same class (background only) but trees in front of the house that touch the
border are also suppressed; dark tree shadows that are not sky/vegetation-coloured stay as speckle (visible on the
board). Memory was measured afterwards on Pallas only (no `/usr/bin/time` in the environment).

## Derivatives (on the pictures themselves)

| package | derived / passed through | suppressed per picture | edges added by suppression | derived PNG bytes |
|---|---|---|---|---|
| Marcówki auto (white) | 12 / 14 | 26–62 % | 131 206 | 4.74 MB |
| Marcówki mask (white, MANUAL_MASK_DIAGNOSTIC) | 8 / 18 | 44–69 % | 14 861 | 2.17 MB |
| Marcówki auto, sky fill (causal trial) | 12 / 14 | 26–62 % | 126 883 | 4.82 MB |
| Marcówki mask, sky fill (causal trial) | 8 / 18 | 44–69 % | 6 218 | 2.17 MB |
| Frizeach auto | 21 / 10 | 0–67 % | 237 110 | 16.2 MB |
| Pallas auto | 5 / 15 | 0 % on the 4 drawn elevations, 38 % on the render | 79 942 | 4.0 MB |
| Oslo auto | 12 / 28 | 0 % (drawn elevations) | 572 | 1.2 MB |

Plans, sections and site plans were passed through byte for byte (lines, dimensions, text untouched). Inside the
kept region the derivative is the original decoded pixel (lossless PNG); original edges still edges inside the kept region:
82.6–100 % per picture (Marcówki 91.8–100 %, Frizeach 82.6–100 %, Pallas/Oslo ≥ 99.2 %; per picture in `record.json`);
the rest lie next to the suppressed region, where a pixel's neighbour changed — the pixels themselves are unchanged. A picture whose background was not changed (drawn elevations) gives an
identical model (Pallas, Oslo) — the re-encoding itself changes nothing.

## Models

Marcówki (16 features v1 / 27 detail rows / 14 zone points / portal soffit v1.1; truth 2.28):

| run | 16 | 27 | zones | soffit | lost vs A | added vs A |
|---|---|---|---|---|---|---|
| A (originals) | 16/16 | 27/27 | 12/14 | 2.321 OK | — | — |
| B-auto (white) | 7/13 | 9/15 | 7/14 | 2.128 NO | both gable frames (the roof does not cover the 1.0 m front/rear zones), rear loggia in the recess (read as projecting), rear railing, 3 rooflights, front/rear wood zones, the chimneys' render confirmation | storey-1 returns standing free to the wall top (pillars beside the gable), front slab 2.58–7.90 (truth 3.25), garage door head 2.75 (truth 2.25) |
| B-mask (white) | 16/16 | 27/27 | 12/14 | 2.291 OK | none | none (cm shifts: band 2.32→2.29, rear balcony −0.12 m, chimneys 7.86→7.76) |
| B-auto (sky fill) | 12/15 | 23/27 | 12/14 | 2.523 NO | front loggia slab + its railing | band top 2.88 (truth 3.07) |
| B-mask (sky fill) | 13/16 | 26/27 | 12/14 | 2.523 NO | none by id | band top 3.22 / soffit 2.52; garage door head 2.75 |

Other houses (`score-detail.py`, v3.54.5 DEV references; identical rows A vs B-auto):

| house (publisher) | A | B-auto | model |
|---|---|---|---|
| Pallas (dobredomy) | ext NO, h NO, sides 3/4, openings ok 1, matched 14/15, false 12 | the same | **byte-identical** (modelHash `aa956709…`) |
| Frizeach G2E (ARCHON) | ext ok, h ok, sides 4/4, ok 8, matched 14/15, false 0 | the same | front sills −0.13…−0.15 m, heights ±0.11 m (within tolerance); one dark finish zone (0–1.51 m) lost |
| Oslo (lipinscy) | ext ok, h NO, sides 4/4, ok 7, matched 9/9, false 0 | the same | **byte-identical** (`498f278e…`) |

Posts: 0 in every run (A and B) — Pallas' brick column is not read in either; LOCAL finds posts only on plans.

Time per run: Marcówki A 290 s, B-auto 289 s, B-mask 274 s, sky 280/266 s; Frizeach 235/234 s; Pallas 114/115 s;
Oslo 183/181 s (4 cores, runs partly concurrent with other work). Peak RSS (Pallas, measured alone): A 1042 MB,
B-auto 1037 MB.

## Causal reading

1. White fill erases the outer edge of a white member against the background: the gable frame of Marcówki is white,
   so B-auto loses it, the roof is not extended over the frame zone, and the returns stand free. The same suppression
   with a flat sky-blue fill keeps both frames (16-feature rows 7→12, zone points 7→12) — the loss is the fill, not the
   removal of trees.
2. Any fill moves LOCAL's band/slab reading of the portal (soffit 2.13 white, 2.52 sky; A 2.32): the band reader uses
   the contrast at the band's lower edge with what is behind/below, which the background replacement changes. Even the
   hand mask with sky fill reads the band wrong; the hand mask with white fill reads it right only because the band
   is dark.
3. The hand mask (the upper bound of a correct mask) improves nothing: A and B-mask agree on every row and every zone
   point. What A misses (gable wood, rear gable panel, soffit finish, posts) is missing in B-mask too — the limit is in
   LOCAL's readers and representation, not in the picture's background.

## Decision (by the protocol)

- B does not help; B-auto harms; no preprocessor goes behind a flag into production.
- C (semantic channels) is not needed: B lost nothing LOCAL needs from the picture that a channel would restore —
  the losses come from the fill, and the residual misses are reader limits.
- API region reading: **not run** — its precondition (B-mask improves a measure) is not met. No reservation made.
