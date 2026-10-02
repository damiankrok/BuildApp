# 005F Evidence Packs

What each run saw, weighed, accepted and rejected (`docs/EVIDENCE_PACK.md`), with the 005F layers:

- the `GLYPH_COUNT_HYPOTHESES` stage of the decision timeline, and in `07-ocr-labels.json` each label's count
  hypotheses, the plan's style, its segmentation record and its ambiguity tail (`AMBIGUITY_TAIL`, never a value);
- the `ENVELOPE_EXTENT_CONFLICT` stage, and in `11-envelope-candidates` / `13-body-candidates` each conflict's strip,
  each completion before and after its clip, and the decisions.

Numbers and boxes only: no glyph pixels and no publisher pixels in any SVG; `16-final-model-preview.png` is the model's
own render. `npm run -s evidence:verify -- <this directory> --max-packs 16` checks each pack against its own manifest.

| pack | run | why it is here |
| --- | --- | --- |
| `dom-w-modrzewnicy` | the final development matrix (`41e26be`), offline from the sealed package | round-5 blind #1: the condensed overall is now cut at four glyphs and still misread; the refusal is typed `DIMENSION_EVIDENCE_INCONCLUSIVE` |
| `dom-w-morelach` | the same | round-5 blind #2: the extent conflict, the attached bay and the garage end; PASS at −3.12 % |

The runs were made from a snapshot of `41e26be` outside the worktree (`git archive`), so the manifests carry no git SHA;
`../development-matrix.json` names the snapshot (`snapshotSha`). The "before" packs are the committed round-5 blind runs
at the frozen 005E code: `../../analyzer-005e/evidence/blind-h1-dom-w-modrzewnicy` and `blind-h2-dom-w-morelach`.

## First divergence

`first-divergence-<house>-005e-to-005f.json` — `npm run -s evidence:diverge -- <005E pack> <005F pack> --json`.

| house | first divergence | stages that differ |
| --- | --- | --- |
| dom-w-modrzewnicy | `GLYPH_COUNT_HYPOTHESES`: the overall's ink (rotated, x 105, y 426) is cut at four, decided by the plan's style (`COUNTS:4\|\|DECIDED`) | the OCR stages, the binding and the scale hypotheses; still no scale |
| dom-w-morelach | `GLYPH_COUNT_HYPOTHESES`: a label whose width fits a glyph more or fewer as well (`WIDTH_AMBIGUOUS`) | the OCR stages and the scale hypotheses (the scale itself unchanged), then `METRIC_RELATION`, `ENVELOPE`, `ENVELOPE_EXTENT_CONFLICT` and `BODIES` — where the stage's change is |
| dom-w-jablonkach | `GLYPH_COUNT_HYPOTHESES` (`COUNTS:3\|\|DECIDED`) | the OCR stages, the scale hypotheses and `REGISTRATION`: the model moved by a registration difference under a millimetre |
| dom-w-modrzykach | `GLYPH_COUNT_HYPOTHESES` (`WIDTH_AMBIGUOUS`) | the same: two anchors a scale chose became registration anchors and the slab moved 0.17 m (+0.16 %) |

For Morelach the timeline's order puts the OCR stages first; they change classes and hypotheses, not the scale. The
envelope stages carry the change the stage made. The jablonkach and modrzykach "before" packs are the 005E development
matrix runs, kept outside the repository (their rows are in `../../analyzer-005e/development-matrix.json`); only the
divergence records are committed for them.
