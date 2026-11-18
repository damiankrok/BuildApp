# v3.54.11 — LOCAL / H architectural capability matrix (D55)

Three separate facts per family: **builds** (the model/kernel/emitter produce a correct, identifiable element from correct
parameters), **finds** (a reader recovers it from a source picture), **confirmed** (seen on the normal path of a DEV run
and measured against a source reference). Code references are to `caecb9a`. A family "built" is not "found".

| family | representation / kernel | LOCAL: who finds it (from what) | H: who finds it | consumer → element / mesh | material | confirmed on the normal path |
|---|---|---|---|---|---|---|
| eaves soffit (podbitka okapu) | the roof plate's own underside (`RoofPlane.thickness`; overhang in `createRoof`) — no separate soffit board or finish | the eaves overhang from the elevation silhouette; no soffit finish read | FACADES roof eaves; no soffit field | roof plate mesh (one material) | the roof's | NO separate soffit anywhere; only the plate's underside exists |
| recess / portal ceiling (podsufitka podcienia) | the slab / roof plate over the recess (its underside); recess pockets `v2/reconstruct-v2.ts` (`headProvenance: ASSUMED_FOR_RENDERING`) | the recess from the PLAN (pockets, corner notch); its head height ASSUMED | portal `soffitY` from the elevation row | slab or band soffit (no finish of its own) | of the slab / band (v3.54.11: band = its zone's finish, whole member) | recess: YES (Marcówki 4 recesses, 27 rows); soffit finish: NO (the source's timber soffit is not representable — one material per member) |
| flat-roof fascia / band (czoło/pas) | `LinearSolid` role FASCIA (`createLinearSolid`), `v2/facade.ts` kinds FASCIA / PORTAL_FRAME; LOCAL also a thick roof edge (`ROOF_TRIM`) | the band's tone rows across the mouth on the elevation (`facade.ts`) | `PORTAL_BAND` feature on the elevation | `portal-*` FASCIA members / `roof-attached-*` ROOF_TRIM | H: v3.54.11 zone finish on the member; LOCAL: `mat-render-dark` | YES: Marcówki portal head top/soffit (16 features v1.1: LOCAL, H both OK) |
| post / column (słup, podpora) | `createColumn` (`LinearSolid` role POST / PERGOLA_POST), RECTANGULAR section only | the PLAN only: pergola posts as solid squares (`v2/pergola.ts`), the post at a corner recess (`v2/corner-recess.ts`), posts of an open eaves wing; never from an elevation | balcony / canopy posts read on the elevation (`program.ts` createColumn) | `*-post-*` linear solids (identifiable by id) | wall / member / timber | NOT on any DEV run: 0 posts in the 13 LOCAL DEV models (v3.54.5 dirs) — Pallas' brick corner column is the test case (rozdz. layers) |
| beam (belka) | `createBeam` (pergola beams, `PERGOLA_BEAM_ASSUMED` section — DISPLAY_ASSUMPTION) | with a pergola only (from its posts) | none | `*-beam-*` | timber | NO |
| gable frame (rama szczytu) | wall panel plate + return walls (`frame-*-plate`, `return-*`) | the elevation (frame band and legs) + the plan's returns | `GABLE_FRAME` feature, legs/band | `frame-main-*-plate` (WALL_PANEL) | member (light) | YES: Marcówki 14 frame rows (27 rows); asymmetric legs: leg ends measured per side |
| loggia / recess (loggia, wnęka) | recess pockets, balcony in the recess (`LOGGIA`) | plan pockets + elevation tone | `LOGGIA` kind | pocket walls, slab | wall | YES: Marcówki loggia front/rear (16 features) |
| pergola | posts + beams (above) | plan solid squares on a frame's corners (`pergolaFromPosts`) | none | posts + beams | timber | NO DEV case |
| diagonal member (ukośny element) | `LinearSolid` start/end anywhere + `rollDeg`, end cuts (`MemberCutSchema`) | none | none (verge boards only, as roof edges) | — | — | NO reader emits a free diagonal member |
| column of another section (kolumna okrągła / profilowana) | NOT REPRESENTABLE: `LinearSolid` is a rectangular box swept along a line | — | — | — | — | — |
| unusual step / return (nietypowy uskok) | outline steps as returns (`house/steps.ts`, LOCAL returns) | the plan outline (returns 8 on Marcówki) | the outline from PLAN | `return-*` walls | wall | YES: Marcówki returns (frame leg rows) |

Causal trials on correct adapter inputs (existing tests, named; nothing added by convention):
- a real post under a canopy: `house-v3548` (balcony posts → createColumn), `program.ts` canopy posts; LOCAL: `roof-extent-v3534` "a post is a solid block in the corner", `attached-bodies` "a covered terrace on posts: COVERED_TERRACE, never built" (no fake room — posts are the separate path);
- an open recess without walls: `doorway-jambs-v3538` "the mouth of a porch between two free posts is no door";
- a band with soffit and return: `house-v3548` portal band tests + v3.54.11 `house-v35411` (finish on the member; soffit measured on the band's own members);
- a frame with asymmetric legs: `house-v3548` leg-end tests (each leg's end built as agreed, checked in `facade-values-built`).

Where each limit lies: the soffit FINISH and round columns are representation limits; posts and beams are found only on
plans (a reader limit for photographs); free diagonal members have no reader at all.
