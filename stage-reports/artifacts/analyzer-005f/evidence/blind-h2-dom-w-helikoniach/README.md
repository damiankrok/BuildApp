# Evidence pack — h2-dom-w-helikoniach

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-helikoniach-3-e-oze-md6026d579e43f; package 99f7daf541223b104344e9691b73f2cf28bae87913f8079525550a60324fea88.
Result: COMPLETED, model 7a59ba63f58b7cdbc13ad4c2355f91b75fd04c62403d464d53614203681e2aa6.
Selected plan frame: frame-asset-rzut-d5842da623-4c943a2b00 — metric CONFIRMED / INCONCLUSIVE, 2.305055 cm/px.

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
