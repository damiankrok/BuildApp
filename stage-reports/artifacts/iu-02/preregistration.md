# IU-02 preregistration (written before any FINAL image exists or is seen)

This file is committed and pushed before the FINAL evaluation sets are generated, drawn or labelled. The commit that
adds it is `FREEZE_SHA`; its push time is the timestamp. Nothing below is changed after FINAL results are seen;
any later deviation is reported as a deviation, not edited in.

## Frozen artifact

| item | value |
| --- | --- |
| model | `iu02-EMB+GEO-clip_vitb32-logreg` (OpenCLIP ViT-B/32 image embedding ⊕ 24 geometry features, multinomial logistic regression, C = 0.03) |
| head file | `$IU_WORK2/model/iu02-head.npz` (outside Git) |
| head SHA-256 | `016556687dff3d791e37028ddeebcd996d1c8a44360ad837e674091f87a77137` |
| temperature | 1.146132284837996 (fitted on pooled out-of-source DEV logits) |
| τ (class ACCEPT) | 1.01 — no class reached ≤ 2 % out-of-source risk on DEV at any coverage; **class acceptance is therefore switched off** and every image is REVIEW or UNKNOWN unless it is routed |
| τE (facade route) | 0.60 — lowest value at which no out-of-source DEV non-elevation is routed |
| route rule | predicted ORTHOGRAPHIC_ELEVATION with p ≥ τE **and** projection test inside the building mask = ORTHOGRAPHIC_SUPPORTED |
| selection | leave-one-source-out (ARCHON / SYNTH / LOC / COMMONS) mean log-loss over backbone × features × C (`results` in `dev-loso.json`) |
| segmentation routing | drawing (light uniform border) → classical CV; render/photo → UperNet ConvNeXt-T ADE20K |
| clean-facade preprocessor | `iu2/clean.py` as committed in FREEZE_SHA, identity transform |

DEV out-of-source routing (all agent-labelled): 249 of 563 single elevations routed (44 %), 0 of 1570 non-elevations
routed. ARCHON 125/340, SYNTH 124/210, LOC 0/1, COMMONS 0/12.

## FINAL sets (none used for any choice above)

1. **FINAL_LOC** — the 292 LoC HABS/HAER rows with `split = FINAL` in `research/image-understanding/data/labels-loc.json`
   (split by `sha256("IU02-loc-split:" + survey) % 10 ≥ 5`, fixed before training). Their pixels were embedded
   alongside DEV for convenience, but no metric on them has been computed or looked at.
2. **FINAL_SYNTH** — `iu2/synth3d.py --out $IU_WORK2/synth-final --prefix sfin --houses 40 --seed S` with
   `S = int(sha256(FREEZE_SHA + "BUILDPLAN-IU02-FINAL-SYNTH")[:8], 16)`. Same generator as DEV, new houses.
3. **FINAL_ARCHON** — `iu2_draw_archon.py FREEZE_SHA 5 <out>`: five ARCHON families drawn from `holdout/pool.txt`
   minus every family used anywhere before (round-13 exclusion list, the holdout ledger, the 005R corpus, and every
   ARCHON address in local work directories). Images acquired with `research/analyzer-005r/acquire.py`, pixels
   kept outside the repository, labelled from anonymised sheets **before** the model is run on them; the labels go
   to `data/labels-archon-final.json` (hashes and labels only).
4. **IU01_TEST** — IU-01's test split, for the IU-01 vs IU-02 comparison on the same images.

## Metrics and pass criteria (from the brief)

Reported per set with Wilson and project-clustered bootstrap 95 % intervals (`iu2_final.py`):

- perspectives or interiors routed as elevations: **must be 0**;
- confirmed sections routed to the facade extractor: **must be 0**;
- coverage of single elevations by the route on the independent multi-style set (FINAL_LOC ∪ FINAL_SYNTH ∪
  FINAL_ARCHON): **must be ≥ 70 %**;
- class accuracy, unsafe routes by true class, elevations left REVIEW / UNKNOWN, IU-01 C2 on the same images;
- preprocessing must measurably improve the existing extractor (DEV result: it does not — see report).

Any failure → verdict **RESEARCH_PARTIAL**. Labels are agent labels from anonymised sheets; the brief's requirement
of human-checked evaluation labels is **not** met and is reported as such.
