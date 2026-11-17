# v3545 confirmation set (c5) — selection record

Chosen from the publishers' SOURCES only. The analyzer / solver / API was never run on a candidate and no model
output was looked at. No paid calls, no keys. Web-page text was treated as data.

## Rules (fixed before any candidate page was opened)

1. Exactly 8 detached single-family houses, >= 4 publishers, >= 5 not from archon.pl.
   Slot plan: archon.pl 2; then one each from dobredomy.pl, lipinscy.pl, studioatrium.pl, domywstylu.pl,
   extradom.pl, and one imperial-unit page (architecturaldesigns.com, fallback houseplans.com).
   If a publisher yields nothing usable (listing unavailable, or its first 5 eligible candidates fail), its slot goes to
   the next publisher in that order that still has < 2 houses (never archon).
2. Hard exclusions: family name (design name without variant suffix) in `tools/excluded-families.txt`, or a variant of
   one; exact page URL already in `tools/seen-urls.txt`.
3. Each house must publish a ground-floor plan picture (>= 600 px long side, present in the byte cache).
4. Feature quotas over the 8: >= 1 incomplete sources (fewer than four elevations, or no section); >= 1 clearly
   asymmetric; >= 1 wing / step / set-back or forward attached garage (L- or T-outline); >= 2 with openings on two
   levels (attic or full upper storey); 1 imperial units if such a page publishes plan + elevations.
5. Order: each publisher's listing (or sitemap) is walked in the order the publisher gives; the first candidate that is
   not rejected takes the slot. Legitimate rejections only: excluded family, URL already seen, no ground-plan picture,
   acquisition fails, duplicate of an accepted house, publisher/type quota full, not a detached single-family house,
   and "cannot fill a still-open feature quota" (used only when the number of slots left equals the number of houses
   still needed to close the open quotas). Nothing is rejected for looking hard and nothing is preferred for looking easy.
6. Adapter role labels are not corrected; only the existence of the pictures is checked.

## Listings used (saved in `confirm/lists/`, fetched 2026-11-17)

| publisher | listing | file | order used |
|---|---|---|---|
| archon.pl | https://www.archon.pl/projekty-domow | archon-list.html | project links, page order |
| dobredomy.pl | https://www.dobredomy.pl/projekty/wszystkie-projekty | dobredomy-list.html | project links, page order |
| lipinscy.pl | https://lipinscy.pl/sitemap/projects-sitemap.xml | lipinscy-projects-sitemap.xml | `<loc>` order |
| studioatrium.pl | https://www.studioatrium.pl/projekty-domow/ | studioatrium-list.html | project links, page order |
| domywstylu.pl | https://www.domywstylu.pl/projekty-domow/ (sitemap has no project pages) | domywstylu-list.html | project links, page order |
| extradom.pl | https://www.extradom.pl/projekty-domow | extradom-list.html | project links, page order |
| architecturaldesigns.com | https://www.architecturaldesigns.com/house-plans (redirects to /search) | ad-list.html | plan links, page order |
| houseplans.com (fallback only) | https://www.houseplans.com/collection/cottage-house-plans | hp-list.html | not walked unless AD fails |

## Candidate log (in the order considered)

Status column: ACCEPT / REJECT(reason). "seen" = exact URL in seen-urls.txt, "excl" = family in excluded-families.txt.

### archon.pl (2 slots) — archon-list.html order
1. projekt-dom-w-bakopach-g2e — REJECT excl (dom-w-bakopach)
2. projekt-dom-w-malinowkach-45-ge-oze — REJECT excl
3. projekt-dom-w-lipiennikach-6 — REJECT seen URL
4. projekt-dom-w-malinowkach-45-g — REJECT excl
5. projekt-dom-w-malaxisach-2-e — **ACCEPT** (c5-archon-malaxisach-2-e)
6. projekt-dom-w-zielistkach-34-a — REJECT excl
7. projekt-dom-w-renklodach-15-g2 — REJECT excl
8. projekt-dom-w-malinowkach-11-ver-2 — REJECT excl
9. projekt-dom-w-rarytasach-5-g2ae — REJECT excl
10. projekt-dom-w-kruszczykach-22 — REJECT excl
11. projekt-dom-w-kostrzewach-4 — REJECT excl
12. projekt-dom-w-malinowkach-56-g — REJECT excl
13. projekt-dom-w-anodach-3-g2e — **ACCEPT** (c5-archon-anodach-3-g2e)
(archon quota full; rest of the page not considered)

### dobredomy.pl (1 slot) — dobredomy-list.html order
1. kardamon — **ACCEPT** (c5-dobredomy-kardamon)

### lipinscy.pl (1 slot) — projects sitemap order
1. alaska — **ACCEPT** (c5-lipinscy-alaska)

### studioatrium.pl (1 slot) — studioatrium-list.html order
1. Pliszka-v-plus,1802 — **ACCEPT** (c5-studioatrium-pliszka-v-plus)

### extradom.pl (1 slot) — extradom-list.html order
1. projekt-domu-tracja-2-WOE1114 — **ACCEPT** (c5-extradom-tracja-2)

### domywstylu.pl (1 slot) — domywstylu-list.html order
1. projekt-domu-awokado_3.php — REJECT ground plan only 537x450 px (< 600 px), elevations one 310x233 sheet
2. projekt-domu-awokado_2.php — REJECT same (537x450 ground plan)
3. projekt-domu-malutki_dr-s.php — REJECT same (537x450 ground plan)
4. projekt-domu-ariel.php — REJECT same (537x450 ground plan)
5. projekt-domu-awokado.php — REJECT same (537x450 ground plan)
Five eligible candidates in a row fail rule 3 (the publisher's page template serves 537x450 plans) -> the slot moves to
the next publisher in the slot order with < 2 houses: extradom.pl.

### extradom.pl (second slot, inherited from domywstylu.pl)
2. projekt-domu-mirabelka-4-WOF1229 — **ACCEPT** (c5-extradom-mirabelka-4). Adapter leaves the four elevations and the
   section unlabelled (role UNKNOWN); the pictures are in the package and the cache.

### architecturaldesigns.com (1 slot, imperial) — ad-list.html order
1. 56478sm — REJECT seen URL
2. 61783ut (780 sq ft "garage plan" with apartment) — REJECT not a detached single-family house (not acquired)
3. 801180pm — REJECT acquisition yields floor plans only, no elevation picture (imperial slot needs plan + elevations)
4. 623691dj — REJECT page publishes renders only, no elevation drawings (the six "ELEVATION" assets are perspective renders)
5. 550029lan — **ACCEPT** (c5-architecturaldesigns-550029lan)
(Also acquired in the same batch before 550029lan was known to pass, never opened as pictures and not used:
61781ut, 623693dj, 405185fdc — quota full.)

## Accepted (8) — packages in /home/user/BuildApp/research/source-to-model/v3545/sources/, cache /home/user/rd/v3545/confirm/cache

Features were read from the published plans/elevations only (pictures in /home/user/rd/v3545/pictures/<id>/).
All eight exports have no `MISSING` line. Picture sizes are the largest variant in the cache.

| # | id | publisher | URL | package content hash |
|---|---|---|---|---|
| 1 | c5-archon-malaxisach-2-e | archon.pl | https://www.archon.pl/projekty-domow/projekt-dom-w-malaxisach-2-e-m31c29abad56b2 | a11b3f0db7865c566118b2b0917c719e446f12af6a5b4d7a4b4202d2d6234b51 |
| 2 | c5-archon-anodach-3-g2e | archon.pl | https://www.archon.pl/projekty-domow/projekt-dom-w-anodach-3-g2e-me7729b1dc2787 | ebbbce8a8a57c97d1d04e3a9183bf188a08b6e5a7f0b93c9d1ee70721ba4e9c4 |
| 3 | c5-dobredomy-kardamon | dobredomy.pl | https://www.dobredomy.pl/projekt/kardamon | 673abfae5e6dde34dde03df97f88c7a1d677a3b4fef0fe56eeea55354eafb874 |
| 4 | c5-lipinscy-alaska | lipinscy.pl | https://lipinscy.pl/projekt/alaska | 2e83281dcd9decfecf6e6721c2b44d315fbcad0c4905e8d7f3fbfcf51052e172 |
| 5 | c5-studioatrium-pliszka-v-plus | studioatrium.pl | https://www.studioatrium.pl/projekty-domow/Pliszka-v-plus,1802.html | 20ab7aaa8b6646a50ddfa55bc9c42c438d787a16057336157b575a97f1630587 |
| 6 | c5-extradom-tracja-2 | extradom.pl | https://www.extradom.pl/projekt-domu-tracja-2-WOE1114 | 53811d4340d450c60524090382ebd8b2c16fc1f931da7ffbf135d98feb68d610 |
| 7 | c5-extradom-mirabelka-4 | extradom.pl | https://www.extradom.pl/projekt-domu-mirabelka-4-WOF1229 | 12bf48381fe6a97cab1e1b07336ecedc975f440c16e7dc8aa5060e641a6f5e57 |
| 8 | c5-architecturaldesigns-550029lan | architecturaldesigns.com | https://www.architecturaldesigns.com/house-plans/coastal-beach-house-plan-with-four-bedrooms-and-watch-tower-550029lan | 5a28fc1476febee23a04fae29bac675e2ffad9581e2427dfb651979c9ec4b235 |

| id | ground plan | upper plans | section | elevations (px) | quota / features |
|---|---|---|---|---|---|
| c5-archon-malaxisach-2-e | 853x853 gif, dimensioned (+ area-table copy) | none (single storey) | 1138x854 | front, rear, 2 side — 1280x513 each | asymmetric (off-centre front cross-gable, stepped rear outline 780/880 with 235 step); complete sources |
| c5-archon-anodach-3-g2e | 853x853 gif, dimensioned | none (single storey) | 1138x854 | front, rear, 2 side — 1280x513 each | wing/garage: double garage block set forward of the living part (450/950, 1000+360), hip roof; asymmetric; complete sources |
| c5-dobredomy-kardamon | 962x1202 jpg (areas, no dimension chains) | attic 964x1204 | none | front, rear, 2 side — 1200x523 each | two levels (attic, mezzanine + void); L-outline with forward garage wing; asymmetric; incomplete sources (no section) |
| c5-lipinscy-alaska | 494x999 png (overall dims 764 x 1724) | none (single storey) | 769x673 | front 1571x450, left 1581x450, rear 726x450, right 741x450 | narrow gable-fronted rectangle; complete sources; fills no special quota |
| c5-studioatrium-pliszka-v-plus | 1030x1961 png, dimensioned | none (single storey) | none | front, rear, 2 side — 1024x683 each | stepped outline with forward double garage (5.20/6.25 vs 4.75/6.70); incomplete sources (no section) |
| c5-extradom-tracja-2 | 1728x1646 svg, vector, dimensioned (text as paths) | none (single storey) | none | front 950x399, left 944x399, right 932x399, rear 934x399 | plain rectangle 13.84 x 9.34; incomplete sources (no section) |
| c5-extradom-mirabelka-4 | 1597x1600 svg, vector, dimensioned (text as paths) | none (single storey) | 880x488 (role UNKNOWN) | four, 800x430..433 (role UNKNOWN, side not labelled) | plain rectangle 11.90 x 8.65; sources complete but section and elevations are unlabelled by the adapter |
| c5-architecturaldesigns-550029lan | "main level" 671x800 gif (ft-in room sizes) | 2nd level, 3rd level, tower level — 671x800 each (each present twice) | none | front, left, rear, right — 1201x800 each (each present twice) | imperial units; openings on several levels (3 storeys + watch tower); asymmetric; incomplete sources (no section) |

Quota check: incomplete sources — kardamon, pliszka-v-plus, tracja-2, 550029lan; asymmetric — malaxisach-2-e,
anodach-3-g2e, kardamon, 550029lan; wing / set-forward garage — anodach-3-g2e, kardamon, pliszka-v-plus; two levels —
kardamon, 550029lan (exactly the minimum of two); imperial — 550029lan.
Publishers: archon.pl 2, extradom.pl 2, dobredomy.pl 1, lipinscy.pl 1, studioatrium.pl 1, architecturaldesigns.com 1
(6 publishers, 6 houses not from archon.pl).

## Notes

- `seen-urls.txt` holds archon URLs without the `-m<id>` suffix; the comparison was made on that base slug.
- extradom.pl ground plans are SVG. `export.py` copies the `.svg`; a raster rendering made with the repo's resvg-wasm
  (`tools/svg2png.mjs`) sits next to it as `*.svg.png` for reading. Nothing else was derived from any picture.
- domywstylu.pl could not be used: the adapter only gets 537x450 px plans and one 310x233 px elevation sheet.
- Rejected candidates' packages and acquisition logs are kept in `confirm/rejected/` (not in the repo sources folder).
- Family names appended to `tools/excluded-families.txt`: dom-w-malaxisach, dom-w-anodach, kardamon, alaska, pliszka,
  tracja, mirabelka, 550029lan. The 8 URLs were appended to `tools/seen-urls.txt`.
- Nothing was committed to Git; no analyzer, solver or API was run.
