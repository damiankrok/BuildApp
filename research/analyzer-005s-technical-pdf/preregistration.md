# 005S-N2 public technical PDF gate — preregistration (sealed before any PDF/case outcome is examined)

Base `3fe0ba22287a462bd02a65b1576d5aba0ef0d340`; branch `analyzer/005s-technical-pdf-openings-n2`. Route (a) only.
Written before any project PDF URL is requested, before any PDF byte is read, before any case-specific PDF outcome.

## 1. Deterministic candidate selection (from the 23 built N1 control rows only)

Input: the sealed N1v `model.json` of each of the 23 rows in `research/analyzer-005s-openings/controls-base.json`
(numbers only, already on disk). For each row, exterior openings = openings whose id does not contain `idoor`.
`noSourceVertical(row)` = share of exterior openings whose `evidence.properties.sill` AND `.height` are both outside
{`SOURCE_EXACT`, `SOURCE_DERIVED`, `SOURCE_CORROBORATED`}.

- POOR (2 rows): highest `noSourceVertical`, ties broken by case id ascending. Value 1.0 is reached by
  `dom-w-arkadiach` (8/8), `dom-w-cieszyniankach` (15/15), `dom-w-tunbergiach` (21/21) → first two by id:
  **`dom-w-arkadiach`** (`m168264238cc55`), **`dom-w-cieszyniankach`** (`m43d25c0636969`).
- KNOWN-GOOD (1 row): highest share of exterior openings with a `SOURCE_*` sill → **`rarytasy-g2e`**
  (`m84f2903cb8e14`, 12/13; next is `marcowki` 10/12). It also carries the only N1 emission refusal
  (`opening-0-east-5-1`, `OPENINGS_OVERLAP`).
- OWNER example (separate, edition-isolation / format only): `archon:m3ea28300f9b3e`, PDF
  `https://www.archon.pl/gotowe-projekty-domow-wydruk/pdf/71110?file_name=archon-dom-w-rarytasach-g2e`.
  Never attached to `m84f2903cb8e14` or any modelled row.

Cap: 3 DEV PDFs + 1 OWNER example. No substitution if a candidate has no PDF (it is recorded as such).

## 2. Source-rights rule

- Only URLs reachable without login, paywall, captcha or bypass of any restriction. A publisher-served "print/PDF"
  link of a public project page counts as public. Any 401/403/robots-disallowed/blocked response → metadata only,
  `NOT_READABLE_FOR_METRIC_USE`.
- Bytes kept only in a temporary directory outside Git (`/tmp/claude-0/...scratchpad/n2-pdf/`), never committed,
  never sent to any cloud OCR/VLM/model agent, never attached, never quoted as text or pixels in a report.
- Commit only: URLs, HTTP status/media type, byte size, SHA-256, page count, per-page structure counts
  (vector path ops / images and their pixel size / text operator presence), presence/absence of a
  technical mark (scale bar, printed elevation datum ±0.00, dimension chain) as a boolean, and refusal reasons.
- Local tools only (python stdlib / existing system tools such as `pdfinfo`/`pdfimages -list` if present).
  No new dependency.

## 3. Minimum positive (all required, per edition)

1. Exact edition: the PDF's file name/landing page identifies the same project id/edition as the modelled row.
2. A plan AND a separate orthographic line-drawn elevation or section (vector linework or a raster of legible
   linework — not a photographic/perspective render).
3. Readable technical scale or printed dimensions/heights, and a printed elevation zero (±0.00) for heights.
4. Unambiguous wall/storey orientation (side label or plan↔elevation correspondence not relying on mirror guess).
5. Actual 2D opening position and/or sill/head datum linkable to ONE existing canonical opening of the model.
6. Independently checkable against plan topology, plus a negative control (other edition / mirror / low-res).

## 4. Required refusals

Marketing render; four tiny thumbnail elevations; illegible or resampled raster; unscaled SVG/vector strokes;
missing printed elevation zero; contradictory callout; duplicated pixels; plan frame from another edition;
perspective image; publisher prose without a technical mark; mirror ambiguity.

## 5. Authorities

`SOURCE_EXACT` only for genuinely printed technical numbers; `SOURCE_DERIVED` for computed geometry with explicit
anchors; `NOT_MEASURED` otherwise. The same publisher's PDF is not independent publisher confirmation and is never
independent human image truth.

## 6. Stop rule

If no capped candidate satisfies §3 → verdict `NO_USABLE_PUBLIC_TECHNICAL_PDF`, no production change, stop.
If a PDF satisfies §3 but no safe binding/gain → `NO_SAFE_PUBLIC_PDF_OPENING_ADOPTION`. Synthetic-only
results are never adoption.
