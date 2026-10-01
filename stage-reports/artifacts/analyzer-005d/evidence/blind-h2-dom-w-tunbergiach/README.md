# Evidence pack — h2-dom-w-tunbergiach

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-tunbergiach-7-r2-md842941974a5c; package 553253462b8d36d2d1c77fb6e37cd1135a295e446b88f7f1482904849c160970.
Result: COMPLETED, model 9d92a2eafc847cd498b61ee120a9166266eea84ffd596c7a1d2a0824f06d7958.
Selected plan frame: frame-asset-rzut-83377e8ffc-c1a88b7f25 — metric LEGACY_UNCONFIRMED / INCONCLUSIVE, 1.994682 cm/px.

Everything here is analyzer-owned: SVG primitives drawn in the frame’s own pixel coordinates (wall bands, dimension
lines, crossing marks, OCR boxes with the text the reader read, spans, extents, envelopes, bodies) and JSON. No
publisher drawing, crop, render or page is in this directory; assets are listed by address, SHA-256, size and pixels.

Read in this order: `evidence-summary.svg`, then `18-decision-timeline.json` (every decision, stage by stage, on a
stable object id), then the stage files `03`–`14`, each SVG with its JSON sidecar (ids, decisions, reasons,
alternatives, support and conflict ids). `17-evidence-trace.json` links marks to labels to spans to the scale to the
extent, envelope and masses. `manifest.json` names every version, hash and file.

Colours: tick green, questionable orange, rejected red; primary binding blue, alternative grey (dashed), ambiguous
purple; extent magenta; envelope cyan; built body green, unbuilt body orange.

To find where two runs part: `npm run -s evidence:diverge -- <pack A> <pack B>`.
