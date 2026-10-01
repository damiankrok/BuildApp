# Evidence pack — marcowki

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca; package 753709900c02b84211ee5c6088ef84f9ff2c93a2b4560318ca0fd0e222eef8d0.
Result: COMPLETED, model 6152770f43f4970a704f5c2be75a9a8f04fe9cb60c71a99533323b2b5fafd64f.
Selected plan frame: frame-asset-rzut-19a11bc745-33a5ff46cd — metric CONFIRMED / STRONG, 2.642489 cm/px.

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
