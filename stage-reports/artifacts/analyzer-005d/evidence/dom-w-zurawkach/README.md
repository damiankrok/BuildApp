# Evidence pack — dom-w-zurawkach

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-zurawkach-3-p-md4e2138a2d1a5; package 7d7ec810cf94edd4015f6db110bc787662f7fecd08c81168e31c8119ee78e37d.
Result: COMPLETED, model 31ba5eea2aa67b69579ebd912a35c596010bdb39a3dd70cf2a64e3db16f9463f.
Selected plan frame: frame-asset-rzut-0dfaf7d6ba-6fe6f9c445 — metric CONFIRMED / STRONG, 2.218163 cm/px.

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
