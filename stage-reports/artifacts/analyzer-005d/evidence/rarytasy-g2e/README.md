# Evidence pack — rarytasy-g2e

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-rarytasach-5-g2e-m84f2903cb8e14; package 02963768a63b99eb20005d533569950aafd52168ffa73e00070662e379553135.
Result: COMPLETED, model 8fa4a25bcd587248c91ca3510e1f440cfd7043f096d74a820f9104d8e4f91ce8.
Selected plan frame: frame-asset-rzut-e8520c3ad3-59a406b738 — metric LEGACY_UNCONFIRMED / INCONCLUSIVE, 2.749693 cm/px.

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
