# Evidence pack — new

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-daliach-5-ge-me3c2885945467; package a017b603b141836d46808392793e397433605c1749bdc5ee4baf145cbdd3831c.
Result: COMPLETED, model bd67c81396e3944beb6c72a1e8a3a138a0ced9bcab12e41d451b0bec99d93b69.
Selected plan frame: frame-asset-rzut-efbfc7f809-0bd7f8c4bd — metric REPLACED / STRONG, 2.188034 cm/px.

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
