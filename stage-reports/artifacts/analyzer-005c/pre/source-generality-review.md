# BUILDPLAN-ANALYZER-005C: Reviewer D, source generality (pre-implementation, read-only)

**Question.** Does generic source acquisition understand the DobreDomy "Aster VIII" page without any publisher-specific code? Which of the improvements it needs would hold for other Polish and European house-project publishers, and which would be overfit to this one page?

**Answer.** Partly. Routing, URL safety, drawing discovery and document roles work without any publisher code. Two things fail:

- **Published figures.** None are read (`publishedFacts = []`).
- **Technical documents.** No technical document can be kept as evidence.

Every root cause is a *structural* gap that other publishers share. I checked this in three ways:

1. A prototype of the fixes lives in a git-ignored copy (`.cache/review-D/sp/`). It reads all 11 Aster figures correctly.
2. The same rule reads ARCHON's differently-classed markup (8/8 building heights correct, 0 contradictions). Re-sealing alt-marcowki offline gives a byte-identical package (`01f9a880…`).
3. All 160 existing source-package tests pass, plus the end-to-end generic tests and the phone-parity test.

Two drafts of my own were refuted by the evidence and are recorded below as rules not to adopt: a zero-weight "heading needs a picture" rule, and an unanchored block reader.

Everything below was run offline, from the saved Aster page, the byte caches in `ev/cache` and `ev/devcache`, and the sealed packages. No web page was fetched. I did not open the round-3 holdout files.

---

## 1. Baseline verified (frozen code; the tree has only docs commits after d3235bf, no code change)

The probe (`ev/aster-source-baseline.json`) and an offline re-seal from `ev/cache` reproduce the baseline package hash `96496c83…` exactly.

| Item | Brief says | Verified |
|---|---|---|
| Safety / route | passes; GENERIC `generic.project-page@1.0.0` | ✔. Logical URL `…/projekt/asterVIII` from the declared canonical. |
| Classification | PROJECT_PAGE 0.69 from plan-imagery (heading), elevation-imagery, section-imagery, title, og:type | ✔. Score 2+1+1+1+0.5 = 5.5, and 5.5/8 = 0.69. Plan-imagery comes **only from the `<h4>Rzuty`** heading: the `<img>` alt is "Aster VIII", the filename `asterVIII_r1` has no drawing word, and the classifier does not read figcaptions. JSON-LD is a site-level `ItemList` (nested `Product` = the publisher), so no `structured` signal, which is correct. |
| "Przekroje" | heading with no section image | ✔. `<h4>Przekroje</h4>` is followed directly by `</div>` and `<h3>Opis`. |
| Figures | none; `publishedFacts=[]`, `publishedRooms=[]` | ✔. The frozen reader saw **1 pair**, and it is spurious: `li` "Obrys budynku w skali 1:500 …" was split at the colon of **1:500** into label "Obrys budynku w skali 1" and value "500 PDF podstawa". It is not keyed, so it does no harm, but it shows the `label: value` rule mis-splitting ratios. There is one `<table>` (Kosztorys, cost estimates in zł). |
| Assets | r1 962×1202 FLOOR_PLAN/GROUND (context "Rzuty · Rzut parter"); s SITE_PLAN; e1–e4 ELEVATION; w1 PERSPECTIVE_RENDER via og:image; w2–w12 UNKNOWN/GROUND ("domu parterowego"); popups UNKNOWN | ✔. **Add:** e1 "Elewacja przód" and e4 "Elewacja tył" have view **UNKNOWN** (vocabulary gap), e2/e3 SIDE_UNSPECIFIED. `w1.jpg?w=286)` also became UNKNOWN/GROUND by byte-identical grouping with the prslide copy. The full-size originals of w2–w12 sit only in `data-lightboxsource` on wrapper `<div>`s and are never discovered (renders, not geometry). |
| Specifications | (not in the brief) | **Defect:** `description` = the RODO/GDPR consent clause of the "Pobierz prezentację" form ("1) Administratorem Pani/Pana danych osobowych…"), not the "Opis" paragraph. This is hashed and reaches the metric layer. `summary` = the site-generic meta description plus the og:description (house text). |
| Identity | (not in the brief) | `name` = "Projekt domu Aster VIII - Dobre Domy Flak & Abramowicz". The " - " suffix is not stripped, so the display title is "Aster VIII - Dobre Domy Flak & Abramowicz". `name` is hashed. |
| PDFs dropped | ch/pk/pkl dropped as "a document link with no drawing word on it"; DWG not discovered | ✔ (`assets.ts:176`, `discovery.ts:115` `DOC_EXT = pdf` only). The print PDF `projekt,asterVIII.pdf` ("Drukuj") is dropped too. |
| "If a PDF were discovered … DECODE UNSUPPORTED_FORMAT" | | **Correction:** `net.ts:56` `allowedMediaTypes` has no `application/pdf`. A kept PDF would fail **ASSET_FETCH `MEDIA_TYPE_NOT_ALLOWED`** before any byte is kept. `DECODE UNSUPPORTED_FORMAT` only happens if a server labels it `image/*` (a DWG served as `image/vnd.dwg` would take that path). No test covers documents at all. |
| Facts markup | div "fake table" with tooltip modal between label and value | ✔. Each tooltip carries an `<h4>` repeating the label, long prose with numbers ("2,20m", "1,4m", "1,2cm"), a "Naciśnij klawisz Esc…" line and close buttons. The same figure is also printed inline at line 446: `<p>Powierzchnia użytkowa <b>172,90 m<sup>2</sup></b></p>`. |
| Stop | METRIC_RESOLUTION_INCONCLUSIVE; plan has no chains; site plan has 1832×1748 roof outline and 2632×2348 plot | ✔. **Add:** the "2.087379 cm/px (1 independent, plausible)" hypothesis rests on plan OCR tokens `215` and `057.10` that belong to no chain (`dimensionChains: 0`). On the site plan, OCR read **1817** for the printed **1832** (residual −2.9 cm). See §6. |

---

## 2. Defects that are generic, not Aster-specific

Priority key:

- **P0:** silently loses or corrupts the one published figure the solver consumes.
- **P1:** wrong or missing role, evidence or fact that other publishers will hit.
- **P2:** hygiene.

| # | Defect | Where (frozen) | Why | Who else has this structure | P |
|---|---|---|---|---|---|
| D1 | Label/value facts built from blocks (div rows, flex rows, `<p>Label <b>value</b></p>`, a tooltip between label and value) are not read. | `markup.ts:114-140` (readPairs: `<table>` 2-cell rows, `<dl>`, `li` with a colon) | No reader for block-level runs | **ARCHON itself** (`product-data__item` + JSON tooltip + value: the prototype reads `building_height` on 8/8 cached ARCHON pages), Bootstrap/Foundation grids, Tailwind flex specs, WordPress/Elementor icon-list widgets, WooCommerce "additional information" rendered as divs, ARIA `role=row` grids | **P0**. `footprint_area` is the only figure the solver consumes (`plan-resolution.ts:529,854`, `layout-gate.ts:145`). Without it the footprint gate is off. |
| D2 | `m<sup>2</sup>` is flattened to "m 2", so `unitOf` returns **`m`** for an area. | `published.ts:57-64` + `stripTags` | Superscript unit lost by tag stripping | Any CMS that types m² as `m<sup>2</sup>`, which is the majority of Polish CMS output | **P0 (latent, also in `<table>`s).** Proven: a frozen `<table>` row "164,50 m<sup>2</sup>" gives `footprint_area … unit m`, and the solver requires `unit === 'm2'`, so the figure is **silently ignored**. |
| D3 | A document link is judged only by its anchor text plus filename. The label of a nested list item ("Obrys budynku w skali 1:500" over "PDF podstawa / PDF lustro / DWG") is ignored. DWG/DXF are never discovered. A PDF cannot be retained (media-type refusal). | `assets.ts:176`, `discovery.ts:115`, `net.ts:56`, `acquire.ts:145-150` | Documents are forced through the image pipeline | Download dropdowns ("Pliki do pobrania", "Do pobrania", "Downloads"), WP download managers, per-format sub-lists (PDF/DWG/DXF, base/mirror) | P1 |
| D4 | A figure caption **leaks across figures**: `contextAt` takes the first `<figcaption>` within 1500 chars *after* any image. An image's own figcaption only gets context weight 0.7. | `markup.ts:182-188`, `assets.ts:118` | Positional, not structural | WP Gutenberg `figure.wp-block-image`, galleries | P1. Proven: a frozen-reader `<img>` before `<figure>…<figcaption>Rzut poddasza` becomes **FLOOR_PLAN/ATTIC**. A large render mislabelled like this can win `selectAsset` (largest decoded area). |
| D5 | View vocabulary lacks the nouns "przód" and "tył" (and "od przodu" / "od tyłu") | `vocabulary.ts:33-34` | Only adjectives are present | Polish captions such as "Elewacja przód/tył" | P1 |
| D6 | The adjective "parterowy" (single-storey *house type*) claims storey GROUND | `vocabulary.ts:26` (`\bparter\w*`) | Adjective read as the noun | Every Polish catalogue ("dom parterowy" is a category); image alt/SEO text | P1. It only reaches non-plan pictures. A plan with UNKNOWN storey is already treated as ground when no plan says GROUND (`layout.ts:78`). |
| D7 | The `description` spec picks legal/consent prose: an unbounded substring (`dom` in "Domy"), no form exclusion | `published.ts:155-160` | Substring vocabulary | RODO/GDPR clauses in forms on every Polish site; cookie banners | P1. `publishedSpecifications` is hashed and read by `source-metrics`. |
| D8 | A value that is a sentence containing a number becomes a figure, and so does a label that contains a digit | `published.ts:70-98` (`parseLocaleNumber` takes the first number anywhere) | No value-shape gate | Proven on ARCHON markup read generically: `garage_area = 46 m²` from "z garażem 2-stanowiskowym: Projekt domu … 46 (G2)", `garage_area = 2 m²` likewise. Also affects `1:500` splits. | P1 |
| D9 | Title suffix after " - " / " – " / " — " is not stripped | `index.ts:45` (splits on `\|` only) | One separator hard-wired | Most CMS title templates | P2 (hashed identity, display title) |
| D10 | A drawing heading with no picture under it contributes plan/elevation/section evidence | `classify.ts:92-100` | Heading treated as imagery | Template headings left empty ("Przekroje" with no section) | P2, **wording only** (see F10) |
| D11 | Full-size originals given in `data-*` on a wrapper element (lightbox div) are not discovered | `discovery.ts:131`, anchors only | | Swiper/Fancybox/Photoswipe galleries | P2 (renders here; could be plan originals elsewhere) |
| D12 | Qualified roof areas collapse: "dachu skośnego" becomes `roof_area`, and "dachu płaskiego" is dropped (first key wins). Plot dimensions printed one per line are dropped. Counts are not read. | `published.ts:25,74-90` | Key vocabulary too coarse | Common on Polish pages | P2 (no solver consumer) |

---

## 3. Proposed generic fixes (all in `adapters/generic/*`, plus an optional schema/hash addition)

Each fix is stated as a structural or vocabulary rule. None names a host, a class, a project or a value. A prototype of every rule is in `.cache/review-D/sp/src` (diff: `ev/review-D/prototype.diff`, 580 lines).

### F1 (D1, D2, D8): a block label/value reader with precision gates

- **Units.** `withUnitGlyphs`: `<sup>2</sup>` becomes `²` and `<sup>3</sup>` becomes `³`, padded to the same length so every offset holds. Apply it once in `readPageFacts`; this fixes D2 for tables too.
- **Blocks.** `readBlocks`: text runs between block-level tags, with inline tags stripped. It is one linear scan: no DOM, no ICU.
- **Label.** A block of 3–60 chars, at most 6 words, no digit (a leading list index "5. " is allowed), not ending in `?` or `!` (a sentence full stop fails too; abbreviations "min./dł./szer." are allowed), and matching the **fact vocabulary** (`FACT_KEYS`).
- **Value.** The **first following block that is nothing but a number and an optional unit** (`VALUE_BLOCK`), within 12 blocks.
- **Passable blocks.** Between label and value only these may stand: the same label again (a tooltip heading), prose (≥ 6 words or ≥ 40 chars), a control's text (`button/option/select/textarea`), or a glyph-only block.
- **Stop.** Any other short block ends the scan. This is what rejects a column header followed by "PARTER", which the first draft mis-paired on alt-marcowki (`usable_area = 96.50`, a per-storey subtotal).
- **Inline form.** "Label[:] number unit" inside one block (`<p><b>…</b></p>`, flex spans).
- **Exclusions.**
  - Blocks inside `<table>` (the table reader owns tables) and inside `role=table|grid|treegrid`.
  - Blocks inside an `<a href>` to another page (a related-project card).
- **Precedence.** Structured readers first, whole. Block pairs only fill keys those did not state. **Two different block readings of one key leave the key out.** Ambiguity is named, not resolved.
- **Precision gate (for every reader).**
  - The value must be number-shaped: a sentence is not a figure.
  - The label must have no digit after a list index.
  - For block and inline pairs, a dimensional key needs a unit in the value or in the label, and a count key needs a whole number (≤ 3 digits).
  - Tables keep accepting unitless room-table cells, which is their existing behaviour. Without this, ARCHON-structured room rows lose true `boiler_room_area`/`garage_area`, as the prototype showed.

**New keys** (order matters; the qualified keys come before `roof_area`):

| key | label vocabulary | unit | Aster |
|---|---|---|---|
| `sloped_roof_area` | `powierzchnia dachu (skośn\|spadzist\|strom)…`, "pitched/sloped roof area" | `m2` | 269.00 |
| `flat_roof_area` | `powierzchnia dachu płask…`, `powierzchnia stropodachu`, "flat roof area" | `m2` | 30.80 |
| `room_count` | `^(liczba\|ilość) pokoi`, `^pokoje$`, "number of (bed)rooms" | `count` | 4 |
| `bathroom_count` | `^(liczba\|ilość) łazienek`, `^łazienki$`, "number of bathrooms" | `count` | 2 |
| plot, one per line | "wymiary działki" + `szer…/width` → `plot_min_width`; `dł/dług…/głęb…/length/depth` → `plot_min_depth` | `m` | 26.32 / 23.48 |

- Unqualified "powierzchnia dachu" stays `roof_area`. The two qualified figures are never summed, because a sum is a derivation.
- `PublishedFactSchema.unit` already allows `count`; no schema change is needed for facts.
- "Garaż 0" stays unread (value ≤ 0). An optional `garage_count` with 0 allowed for counts only is P2 and not needed.
- Fact `label` and `raw` are not hashed, so relabelling moves nothing.

**Prototype result on Aster (all read from the page, none hard-coded):**

| key | value |
|---|---|
| `usable_area` | 172.9 m2 |
| `footprint_area` | 278.3 m2 |
| `sloped_roof_area` | 269 m2 |
| `flat_roof_area` | 30.8 m2 |
| `roof_pitch` | 30 deg |
| `building_height` | 5.9 m |
| `volume` | 640.2 |
| `plot_min_width` | 26.32 m |
| `plot_min_depth` | 23.48 m |
| `room_count` | 4 |
| `bathroom_count` | 2 |

Classification gains the `figures` family (0.69 → 1.0).

### F2 (D3): technical documents as their own evidence, never as pictures

- **Discovery (generic adapter only; do not touch shared `discovery.ts`, so ARCHON is unaffected).** Every `<a href>` to `.pdf|.dwg|.dxf` becomes a `DocumentLink`. Its words are the link text, the title/aria-label, the filename, and the **labels of the enclosing list items** (`listLabelsAt`: each parent `<li>`'s own text up to its nested list, found by a list-only tag stack).
- **The image pipeline stops receiving `DOCUMENT_LINK`.** They are dropped as `DOCUMENT` and routed to the documents list. No sealed package contains a document candidate today, so nothing moves.
- **Kind vocabulary** (first match wins): `OUTLINE` (obrys / outline / footprint / Umriss), `ENERGY_CERTIFICATE`, `COST_ESTIMATE`, `DRAWING_SET` (rzut / elewacja / przekrój / rysunki / dokumentacja / drawings), `BROCHURE` (prezentacja / drukuj / karta projektu / print).
- **Other claims.**
  - `variant`: `MIRRORED` (lustr… / mirror / odbicie lustrzane), `BASE` (podstaw… / oryginał / base), else `UNKNOWN`.
  - `statedScale`: "1:500" kept as **text**, never used as a transform.
- **Aster:** pk.pdf OUTLINE/BASE/1:500, pkl.pdf OUTLINE/**MIRRORED**/1:500, pkdwg.dwg OUTLINE/UNKNOWN/1:500, ch.pdf ENERGY_CERTIFICATE, "Drukuj" BROCHURE.
- The mirror flag matters. A mirrored outline used as the base would flip the building.
- **Acquisition.** An optional adapter hook, `documents?(ctx)`.
  - Keep OUTLINE / DRAWING_SET (fetched and hashed) and ENERGY_CERTIFICATE / COST_ESTIMATE (recorded).
  - Drop BROCHURE / UNKNOWN, as chrome is dropped.
  - Fetch under the **same** safety policy with a document-only media allowlist (`application/pdf`; `application/acad|dxf`, `image/vnd.dwg|dxf`, or `application/octet-stream` only when the magic bytes match `%PDF-` / `AC10` / `0\nSECTION`).
  - Use a separate small budget (≤ 6 documents), so documents never evict images.
  - **Never decode or parse the bytes.** SHA-256 and length only. The bytes live in the git-ignored byte cache and are never committed.
- **Record** (`SourcePackage.documents?`, optional):
  `{url, format, kind, variant, statedScale?, caption?, mediaType?, byteLength?, byteHash?, status: FETCHED|NOT_FETCHED, code?}`. A fetch failure is recorded **in the record**, so the image `failures` list keeps its meaning.
- **Future work, not 005C:** reading vector outlines out of a PDF at its stated scale (see §6), and any DWG parser.

### F3 (D4): a figure caption belongs to its own figure

- `figcaptionOf(offset)`: the `<figcaption>` inside the `<figure>` that encloses the image. It is appended to the candidate **caption** (weight 0.95), and joined with " · " to any alt text.
- `contextAt` becomes heading-only, so a caption is never borrowed from the next figure.
- Also include the own-figure figcaption in the classifier's image text.

### F4 (D5, D6): vocabulary

- FRONT: add `\bprzod\b` and `\bod przodu\b`.
- REAR: add `\btyl\b` and `\bod tylu\b`. Do **not** use `tylu` bare, because it also means "so many". "z tyłu/z przodu" can be added the same way.
- GROUND: `\bparter(u|ze|em)?\b` (noun forms only). `parterow\w*` claims **no** storey.

### F5 (D7): description prose

- Skip `<p>` inside `<form>…</form>`.
- Skip consent/legal vocabulary (`danych osobowych|dane osobowe|rodo|polityk* prywatności|cookies|wyrażam zgodę|personal data|privacy policy`).
- House words become word-bounded (`\bdom(u|y|ie|em)?\b`, `\bdach\w*`, …).
- Aster then yields the "Opis" paragraph.

### F9 (D9): the page's own h1 names the project

If the og:title/title equals `h1 + separator (| - – — : ·) + suffix`, the name is the h1. Aster: "Projekt domu Aster VIII" (display: "Aster VIII").

### F10 (D10): heading evidence says what it is (**wording only; keep the weight**)

- A drawing heading with no picture before the next heading of its rank adds `empty-drawing-heading` (weight 0) with the detail `"Przekroje" has no picture under it`.
- **Do not zero the heading's weight.** Measured: that flips `analysis-service/test/generic-source.test.ts` "a project page with only renders is NO_DRAWINGS" to SOURCE_NOT_PROJECT (score 5 → 2). A drawings heading is still evidence of a *project page*.
- No SECTION asset is ever created from a heading. That was already true, because roles come from candidates only.

### F11 (D11), optional, P2

A `data-*` attribute whose value is an image URL, on an element that **contains** an `<img>`, becomes a candidate grouped with that image. Give it trust like `ANCHOR_HREF`. Bytes still decide the size.

### Constraints that hold

- No `\p{}` escapes, no `u`-flag case folding, no `Intl`, no `localeCompare` on prose (use `compareCodeUnits`). `deaccent` stays the only NFD user, and it is shimmed on the phone.
- Measured: `apps/local-analyzer/test/source-parity.test.ts` passes with the prototype aliased in.
- All scans are linear or bounded. `listLabelsAt` is O(n) per document link; cap the links (e.g. 50).

---

## 4. Hash and regression analysis

**`contentHash` does not cover every field.** `hash.ts:373-382` covers:

- identity: project and adapter id+**version**
- per asset: caption, roles, selected byte hash, and per variant url, media type, length, byte hash, decoded w/h, `declaredMismatch`
- facts: key, value, unit (**not** label or raw)
- specifications: key, label, text
- rooms: storey, index, label, area
- failures: stage, target, code

It excludes the id, the page addresses, `pageHash`, `selectionReason`, `roleEvidence`, `discoveredVia`, and failure message/attempts/status/claim.

**An optional `documents` field moves no existing hash** if `hash.ts` appends a `documents` part **only when the list is non-empty**. `hashArtifact` hashes the list of parts, so an absent part leaves the canonical JSON unchanged. This was measured with the prototype schema and hash:

- All **24** sealed `source-package*.json` under `stage-reports/` give **identical** hashes under the frozen and the patched function.
- All 13 packages at 1.2.0 also equal their stored `contentHash`. That includes every pinned ARCHON package and alt-marcowki.
- The 11 packages at 1.1.0 already differ from their stored hash under the *frozen* function, because 1.2.0 changed the coverage. That is pre-existing and unrelated.
- `documents: []` hashes as absent. One document moves the hash.

**Versioning.** Add 1.3.0 to `SUPPORTED_SOURCE_PACKAGE_VERSIONS`. The schema is `.strict()`, so an older reader must refuse a package that has `documents`.

- For the brief's constraint, the cleanest option is to seal as **1.3.0 only when `documents` is present**, and as 1.2.0 otherwise. The alternative, always sealing 1.3.0, changes every fresh seal (ARCHON included) through the version string alone.
- Bumping `GENERIC_ADAPTER_VERSION` to 1.1.0 is **recommended**, because the reader changed. It changes every *re-sealed* generic package through its identity, by design, and needs the version assertion in `generic.test.ts` updated.

| Sealed package | Adapter | F1–F5, F9–F10 (reader) | F2 (documents) | Model effect |
|---|---|---|---|---|
| marcowki `75370990…` → model `6152770f…` | archon.pl | untouched (generic modules only; `archon.ts` imports only `discovery.ts` helpers, which stay unchanged, plus types) | none (no hook) | **none** |
| kosacce-clean/-tracked `bdef070a…` → `5b5ffcf1…` | archon.pl | untouched | none | **none** |
| rarytasy-g2e `02963768…` → `8fa4a25b…` | archon.pl | untouched | none | **none** |
| rarytasy-eoze, dom-w-jablonkach, willa-miranda, holdout h1/h2 (005A/005B) | archon.pl | untouched | none | none |
| **alt-marcowki** `01f9a880…` | generic | **offline re-seal with the full prototype is byte-identical** (`01f9a8800b8b…`): no figures, no div facts, no document links, no "przód/tył/parterow", no form prose, no title separator | none | none (it also stays `refuse:METRIC_RESOLUTION_INCONCLUSIVE`) |
| 005A/004A alt-marcowki copies (1.1.0) | generic | historical, not replayed | — | — |
| aster-viii baseline `96496c83…` (committed as 005C baseline) | generic | changes (prototype re-seal `388830c0…`): facts +11, name, description, e1/e4 view, w* storey, captions (+figcaption), dropped docs | +documents | first model; §6 |

- CI replays the **committed** packages (`buildapp-ci.yml:1019`). The live `source:acquire` step only fills the byte cache.
- `modelHash` is `sha256(serializeModel(model))` (`candidate.ts:205`) and does not include the package hash.
- Result: no pinned model moves under any fix here. Only a *re-seal* of a generic page can move its own model, through asset ids (captions feed `stableId`) and the facts the gate reads.

**Guard.** Once Aster is sealed into `stage-reports/` (it already is: `analyzer-005c/aster-viii/baseline-source-package.json`), `generalization.test.ts` derives these words from its URL segment and name: `asterviii`, `aster`, `viii`, `dobre`, `domy`, `flak`, `abramowicz`, plus figures 23.48 and 26.32 (the other Aster figures end in 0 and are exempt).

- Production has **no hit** today (grep).
- The fixes must not mention any of them: no "aster", no "dobre", no literal 278.30/172.90/30° (the guard would not catch the ones ending in 0), no `prslide`/`dd_files`.
- F9 would drop "dobre/domy/flak/abramowicz" from future registries, which is harmless.

---

## 5. Overfit red-team: fixture per rule (all run through the prototype)

Every fixture uses invented class-free markup on `domy.wydawca-przykladowy.test`, with no DobreDomy class, path or wording. The generic suite's existing promise ("the fixtures use no class name the live sites use") should be kept. Do not reuse `fake-table`, `table-row`, `table-cell`, `tooltip-modal`, `data-lightboxsource`, `Pliki do pobrania`, `dd_files`.

| Rule | Positive fixture, structure category (result) | Negative fixture it must not fire on (result) |
|---|---|---|
| F1 block pairs | **P1** div row + help `<aside>` (repeated label heading, 30-word definition containing "2,20 m", close button) then `164,50 m<sup>2</sup>`; second row "Kąt nachylenia dachu / 35°" → `footprint_area=164.5 m2`, `roof_pitch=35 deg` ✔ | **N1** div-grid room schedule: headers "Pow. użytkowa / Pow. podłogi", subtotal "PARTER / 96,50 m² / 97,48 m²" → **nothing** ✔ (the first draft failed exactly this, on alt-marcowki's real `<table>`) |
| F1 inline | **P2** `<div><span>Powierzchnia użytkowa</span> <span>128,40 m²</span></div>` → `usable_area` ✔; **P3** `<p><strong>Wysokość budynku:</strong> 6,49 m</p><p><b>Liczba łazienek:</b> 2</p>` → `building_height`, `bathroom_count` ✔ | **N7** "Maksymalna powierzchnia zabudowy działki 30%" → nothing ✔ (the `%` unit is not a stated area unit). Also recommended: at most 4 words for *inline* labels, so that "Powierzchnia zabudowy nie może przekroczyć 150 m²" stays unread |
| F1 card exclusion | page's own row after a card → only the page's value ✔ | **N2** `<a href="/katalog/inny"><p>Pow. użytkowa</p><p>120,50 m²</p></a>` before the facts → card ignored ✔ |
| F1 question / label shape | — | **N3** `<h3>Jaka jest powierzchnia zabudowy?</h3>…<p>5</p>` → nothing ✔; **N4** `<li>z garażem 2-stanowiskowym: … 46</li>` → nothing ✔ (the frozen reader emits `garage_area=46`) |
| F1 ambiguity / units | — | **N5** two runs "Powierzchnia użytkowa" 120,00 m² and 135,00 m² → key **left out** ✔; **N6** "Garaż / 1" → nothing ✔ |
| F1 cross-publisher | ARCHON cached pages read generically (stress only; production routes them to the specialist): +`building_height` **8/8 equal to the specialist's value**, +`room_count`; the frozen false positives `garage_area` 46/2 removed; 0 facts lost, 0 contradictions | alt-marcowki: package byte-identical |
| F2 documents | **D1** `<ul><li><em>Obrys domu w skali 1:500</em><ul><li><a …obrys.pdf>wersja podstawowa</a></li><li><a …obrys-l.pdf>odbicie lustrzane</a></li><li><a …obrys.dxf>DXF</a></li></ul></li><li><a …>Świadectwo charakterystyki energetycznej</a></li></ul>` → OUTLINE BASE/MIRRORED/UNKNOWN 1:500, ENERGY_CERTIFICATE ✔ | **D2** "Regulamin › PDF", "Polityka prywatności", "Cennik" → UNKNOWN (not retained) ✔. Also required: a PDF inside a related-project card, and an off-site PDF. Keep only the page's own and CDN documents, as for images |
| F3 figure caption | `<figure><img alt="Dom…"><figcaption>Rzut poddasza</figcaption></figure>` → FLOOR_PLAN/ATTIC ✔ | an `<img>` **before** that figure → frozen: FLOOR_PLAN/ATTIC ✘, prototype: UNKNOWN ✔ |
| F4 view/storey | "Elewacja przód" → FRONT, "Elewacja tył" → REAR, "Rzut parteru" → GROUND ✔ | "Wizualizacja domu parterowego" → no storey ✔; "tylu okien" (so many) → no REAR (bare `tylu` is not in the rule) |
| F5 description | a long "Opis" paragraph → description | RODO clause in `<form>`, cookie banner → never ✔ (Aster) |
| F9 name | "Dom pod Klonem — Wydawca" with `<h1>Dom pod Klonem</h1>` → "Dom pod Klonem" | a title without the h1 as prefix, and titles containing a hyphen in the name ("Dom Z-12") without surrounding spaces → unchanged |
| F10 heading | "Przekroje" heading with nothing under it → PROJECT_PAGE with `empty-drawing-heading(0)` ✔ | the render-only e2e page stays NO_DRAWINGS ✔ (zeroing the weight breaks it) |

**Regression suites run against the prototype** (tree untouched; aliased configs in `.cache/review-D/`):

| Suite | Result |
|---|---|
| source-package tests | 160/160 |
| `analysis-service/test/generic-source.test.ts` | 8/8 (the unknown site still reconstructs SOURCE_EQUIVALENT to the specialist) |
| `local-analyzer/test/source-parity.test.ts` | 2/2 |

**Evaluation caveat.** The round-3 holdout includes a DobreDomy page. Fixes developed on Aster will very likely help it, but that is **same-publisher** evidence. It must not be reported as evidence of cross-publisher generality. That evidence is the ARCHON-markup stress run, the alt-marcowki identity and the structure fixtures above.

---

## 6. Aster reconstruction expectation

**What the page publishes metrically:**

- **Floor plan r1.** No dimension chain at all. Only room areas are printed (15 labels, summing to 176.1 m² against the published 172.90 usable area).
- **Site plan s.** The outer chain 1832 × 1748 dimensions the **roof/eaves outline** (shaded roof planes). The walls appear only as an **undimensioned dashed outline** inside it. The plot chain is 2632 × 2348 with 400/300 setbacks.
- **Outline PDF.** "Obrys budynku 1:500" is an A4 vector drawing (PScript5 → Ghostscript, `cm 0.12`). Measured offline for checking only: its largest closed outline is **18.31 × 17.48 m at the stated 1:500**. That is the same extent as the site plan's chain, so it restates the eaves outline and still gives no wall dimension.
- **Overhang.** No source states the eaves overhang.

**Honest outcome for 005C.** A **typed, source-limited stop**, keeping METRIC_RESOLUTION_INCONCLUSIVE or PLAN_NO_DIMENSION_FRAME, with diagnostics that say *why*:

- `planDimensionChains: 0`
- the only printed lengths are the site plan's roof outline and plot
- no wall dimension or overhang is published

I verified this: the frozen analysis replayed on the prototype's patched package (11 facts, views fixed) stops at the **same** METRIC_RESOLUTION_INCONCLUSIVE.

The current message ("none of its dimension chains was read…") and the "2.087379 cm/px (1 independent, plausible)" hypothesis overstate what is there. That scale rests on plan OCR tokens `215` and `057.10` that belong to no chain (probably room labels). For the geometry reviewers: the report should say "the floor plan prints no dimensions", not "its chains could not be read".

**Cross-view scale from the site plan: not in 005C.**

1. Its chain measures the roof outline including eaves. Using 18.32 m as the wall width inflates the building by two unknown overhangs, roughly 1–1.6 m or 6–9%. That error lies *inside* the footprint gate's NEAR band (≤ 20%) and near its AGREES band (≤ 6%), so the gate cannot catch it.
2. The site-plan scale itself comes from an OCR reading **1817** of the printed **1832** (−0.8%).
3. The wall outline would have to be traced from dashes and registered to the plan. That is a two-hop TRACE derivation, and every hop is unstated by the source.

Published aggregates cannot anchor it either:

- 278.30 m² footprint and 172.90 m² usable area are sums: "no geometry may be derived from one" (`schema.ts:151`). They are checks, not anchors.
- Room-area calibration is the same prohibition.

If a later stage attempts it, it must be SOURCE_DERIVED/TRACE_UNCERTAIN, registered to the **dashed wall outline** (never to the roof outline), and checked in both directions against 278.30. That later stage could also use an OCR-free witness from the outline PDF's vectors at the stated scale, once a PDF path reader exists; that reader is future work.

**What the 005C report should say about Aster.**

- Source acquisition now reads every published figure and keeps the outline documents (base/mirror/DWG) as hashed evidence, through generic rules proven on another publisher's markup.
- Reconstruction stops honestly: the project publishes no wall dimension anywhere (plan, site plan or outline), only the eaves outline and aggregates.
- No building is produced, and none should be.

---

### Artifacts (scratch and git-ignored only)

- Prototype source: `/home/user/BuildApp/.cache/review-D/sp/src/`
- Prototype diff: `ev/review-D/prototype.diff`
- Probes: `.cache/review-D/{acquire-both,page-both,cross-publisher,hash-compat,redteam,sup}.ts`
- Re-sealed packages: `ev/review-D/{aster,alt}-{base,patched}.json`
- Aster analysis on the patched package: `ev/review-D/aster-run/`
