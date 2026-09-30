# 005C post-implementation review D — cross-publisher source overfit (red team)

Independent, read-only; synthetic pages plus the cached Aster VIII bytes replayed offline; no house page opened.
Every probe ran on the 005C reader and on a frozen copy of the `d3235bf` reader ("new" = the 1.0.0 reader did not
produce it). Findings as reported; the dispositions are in the stage report, §W.

## P0 — a wrong figure produced with confidence (all new in 005C; each ends in a wrong `footprint_area`)

- **P0-1 Value before its label.** A counter/icon-box layout `[value | label]` shifts every block pair by one
  (a usable area read as the footprint, a pitch read as the usable area). First bad decision: the block scan takes
  the first value-shaped block after a label without asking whether it belongs to that label's row.
- **P0-2 Form controls.** A search/filter slider (`Powierzchnia zabudowy / 50 m² / 300 m²`) or a `<select>` option is
  read as this house's figure; `formRanges` was used only for the description.
- **P0-3 Related-project tiles** linked only on their title or image, or a "recently viewed" footer widget, give
  another house's footprint; the card rule knew only facts wrapped in `<a href>`.
- **P0-4 A value left blank borrows the next row's.** `label / — / long label / value`: a glyph-only block and any
  label longer than six words were passable.
- **P0-5 A limit in prose becomes an exact figure.** "nie może przekroczyć 150 m²", "do 150 m²", "około 600 m³",
  "ok. 160 m²": inline labels of up to six words swallowed the qualifier; `ok.`/`ca.`/`~` were accepted prefixes.

## P1

1. The production hard-code guard fails at `0575fb5`: a comment in `published.ts` carries a development house's
   plot depth and label; two other comments carry its footprint and usable area, which the guard missed because it
   never registers figures ending in 0 at two decimals.
2. Structured readers (table, `dl`, list items) win outright over the page's own block facts and have no card rule.
3. The scan enters a tooltip and takes its example value.
4. A catalogue listing page is now classified PROJECT_PAGE (block pairs scored before any card/form filter).
5. Document labels work only for a nested-list layout (a table row, a `dl`, a heading, an inline label: UNKNOWN).
6. Wrong document kinds/variants: site-header "przykładowa dokumentacja", a guide on reading plans, another house's
   outline in a tile, a brochure under "Dokumentacja", an energy certificate named `…obrys…`, "podstawowa i
   lustrzana" on the parent, "(nie lustrzana)" — one bag of words, first rule wins, mirror before base.
7. The document media allowlist is skipped on a cache hit (a `.dwg` link crawled as a page and cached as HTML is
   later recorded FETCHED `text/html`); `.dwg`/`.dxf` were not excluded from the crawl.
8. Document bytes are never checked against their format's signature (HTML served as `application/pdf` hashed).
9. Site-chrome PDFs (a footer "Regulamin") enter the hashed package and move it to 1.3.0.
10. The crawl rule loses real subpages (`.html` pages, query-id pages, short slugs, the project named only in the
    link text) and still follows others (a sibling whose slug extends this one, `/rysunki/47110` for 4711, a guide
    whose slug contains this one as a substring).
11. `decodeURIComponent` on a malformed page or link address throws and aborts the acquisition.
12. The "no digit in a label" rule drops ordinary labels that carry a unit or a standard ("(m2)", "PN-ISO 9836").
13. Units are checked only for block readings; `%` and `cm` were admitted (a 30 % plot ratio as a 30 m² footprint,
    745 cm as 745 m, a terrain slope as the roof pitch, a garage-space count as a garage area; key/unit mismatches
    kept).
14. The new vocabulary covers the probe's wording and misses common alternatives ("od frontu", "z przodu",
    "wejściowa", "od ogrodu", "z tyłu"; "minimalna szerokość działki", "plot width"; "21,15 x 24,60 m" in a block).

## P2

A logo in the h1 with "Logo: Project" as og:title names the site; a gallery caption is ignored for its images; ARIA
`role=table` fact tables are read by no reader; the description is the longest paragraph anywhere (existed before);
failed document fetches spend the budget; no cap on document records; `listLabelsAt` is quadratic; a
`download.php?file=x.pdf` link is dropped from images but never recorded; `http:` PDFs dropped silently; documents
on crawled subpages never read.

## Held up

All 24 committed source packages hash identically under the old and new hash function; all 13 at 1.2.0 match their
stored hash (the pinned ARCHON packages, alt-marcowki, the Aster baseline); an empty `documents` list hashes as none;
a page without documents seals as 1.2.0 with no field. The Aster replay equals the committed package and its 11
figures are right; its outline is recorded base, mirrored and DWG at 1:500. A document redirecting to a private host
is refused; to HTML, refused without a cache; bytes never decoded. `<sup>2</sup>` now m²; an ARIA grid is not read as
blocks; a card wrapped in `<a>` excluded; a price rejected; two different block readings leave the key out; the
count rule rejects "4 szt."; "parterowy" no longer claims the ground storey; a caption no longer leaks into the next
figure; the root, listings above and unrelated guides are not followed. No publisher-specific rule in production
other than the comment values in P1-1. 140 ms to read the facts of a 0.5 MB page.
