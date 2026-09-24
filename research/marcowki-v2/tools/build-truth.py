#!/usr/bin/env python3
"""Build marcowki-source-truth-v2.json and the tables of MARCOWKI_SOURCE_TRUTH_V2.md.

Evaluation tooling (research/), never imported by production. Every value below was measured on the
sealed source bytes with tools/measure.py (pixel scans through the printed chains) or read off the
page; each item names the assets, the pixel locators and the method, and carries an uncertainty and a
status from the v2 vocabulary. Nothing here was copied from packages/reference-marcowki.

Frame (APP frame, per APP_SPEC): x east of the west outer face; y up from the ground finished floor
(+-0,00); z north of the FRONT OUTER PLANE (the outer face of the front returns, z = 0). The front
wall's outer face is therefore z = 1.00 and the rear wall's outer face z = 13.60; the rear mouth is 14.60.
"""
import json, sys, os
from collections import OrderedDict

OUT_JSON = sys.argv[1] if len(sys.argv) > 1 else 'research/marcowki-v2/marcowki-source-truth-v2.json'
OUT_MD_TABLES = sys.argv[2] if len(sys.argv) > 2 else 'research/marcowki-v2/_truth-tables.md'

A = {
    'page': 'page:https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca',
    'gp': 'asset-rzut-19a11bc745',            # ground plan, dimensioned, 853x853, bytes abfdb262...
    'ap': 'asset-rzut-117027f690',            # attic plan, dimensioned, 853x853, bytes 06af9e91...
    'ga': 'asset-rzut-aa1526220f',            # ground plan, area labels
    'aa': 'asset-rzut-f028d28aba',            # attic plan, area labels
    'sec': 'asset-gotowy-projekt-dom-w-marcowkach-ge-przekroj-budy-d2e1bb6894',
    'front': 'asset-gotowy-projekt-dom-w-marcowkach-ge-elewacja-fron-ee81d52db6',
    'rear': 'asset-gotowy-projekt-dom-w-marcowkach-ge-elewacja-ogro-77ee09534e',
    'east': 'asset-gotowy-projekt-dom-w-marcowkach-ge-elewacja-bocz-10833ce28d',   # __11265
    'west': 'asset-gotowy-projekt-dom-w-marcowkach-ge-elewacja-bocz-2d2de51c62',   # __11266
    'hero': 'asset-projekt-dom-w-marcowkach-ge-8533a257062bd0260f2a-82b56a7ac5',
    'w1': 'asset-widok-1-projekt-dom-w-marcowkach-ge-89e35336fb',
    'w2': 'asset-widok-2-projekt-dom-w-marcowkach-ge-67e4040ea7',
    'site': 'asset-gotowy-projekt-dom-w-marcowkach-ge-sytuacja-12541df47f',
}

REG = {
    'gp':   {'x': '(px-58)/37.842', 'z': '(735-py)/37.778+1.00', 'anchors': 'chain 1205 at row 40 spans px 58..514; chain 1260 in the right column spans rows 259..735; front wall outer face row 735, rear wall outer face row 259'},
    'ap':   {'x': '(px-47)/37.72', 'z': '(671-py)/37.778+1.00', 'anchors': 'west outer face px 47, east outer face px 345 (790 chain); front wall outer face row 671, rear outer face row 195'},
    'sec':  {'x': '(px-128)/72.58', 'y': '(642-py)/72.58', 'anchors': 'datum rows 65 (+7,95), 303 (+4,67), 420 (+3,06), 642 (+-0,00), 665 (-0,32): every pair gives 72.5..72.7 px/m; west outer face px 128, house/garage wall px 669..697, garage east face px 1001'},
    'front': {'x': '(px-376)/58.8', 'y': '(572-py)/58.8', 'anchors': 'silhouette px 376..1084 = 12.05 m (58.75 px/m); ridge apex row 104 and plinth top row 572 = 7.95 m (58.87 px/m); both scales agree to 0.2%'},
    'rear': {'x': '(970-px)/59.0', 'y': '(574-py)/59.0', 'anchors': 'returns W 506..542 and 933..970 (7.90 m between outer faces = 59.0 px/m); garage 259..503; apex row 104, plinth top 574'},
    'east': {'z': '(px-210)/59.2', 'y': '(574-py)/59.2', 'anchors': 'ridge apex row 100 to plinth top 574 = 7.95 m (59.6 px/m); garage rear wall px 713 = z 8.50 and window jamb px 790 = z 9.80 fix 59.2 px/m'},
    'west': {'z': '(1080-px)/59.3', 'y': '(574-py)/59.3', 'anchors': 'ridge apex row 100 to plinth top 574; silhouette 214..1080'},
    'site': {'x': '(px-242)/27.8', 'z': '14.60-(py-134)/28.7', 'anchors': 'roof outline 242..462 x 134..546; coarse: +-0.4 m'},
}

items = []
def item(id, kind, name, assets, locators, value, unc, status, method, notes='', conflict=None, review=False):
    it = OrderedDict()
    it['id'] = id; it['kind'] = kind; it['name'] = name
    it['sourceAssetIds'] = [A[a] for a in assets]
    it['locators'] = locators
    it['value'] = value
    it['uncertainty'] = unc
    it['status'] = status
    it['method'] = method
    it['notes'] = notes
    if conflict: it['conflict'] = conflict
    it['ownerReviewNeeded'] = review
    items.append(it)
    return id

L = lambda asset, what, **kw: dict(asset=A[asset], what=what, **kw)

# ------------------------------------------------------------------ 1. frame and registrations
item('T2-FRAME-001', 'FRAME', 'coordinate frame of this truth set', ['gp', 'sec'], [L('gp', 'plan orientation: the 105/210 entrance and the 275/225 garage door callouts sit along the bottom edge (rows 745..760), so the FRONT is at the bottom of the sheet')],
     {'x': 'metres east of the west outer face (0..12.05)', 'y': 'metres above the ground finished floor (+-0,00); terrain -0.32', 'z': 'metres north of the front outer plane: the outer face of the front returns is z=0, the front wall outer face z=1.00, the rear wall outer face z=13.60, the rear outer plane z=14.60'},
     {}, 'SOURCE_DERIVED', 'convention stated once; every other item is in this frame', 'the current Marcówki Auto (03R1) runs z the OTHER WAY: its plan frame puts z=0 at the REAR wall outer face (row 259 of the ground plan) and z grows towards the front, so its front wall face is at z 12.61, its zone-max_z (12.61..13.60) is the portal zone and its zone-min_z (-1..0) the loggia zone; the solver labels the max-z ring wall FRONT. That contradicts MODEL_FRAME (front facade outer face at z = 0). Conversion: z_v2 = 13.60 - z_auto. This set puts the outermost front plane at z=0 as the reference model does')
for k, r in REG.items():
    item(f'T2-REG-{k.upper()}', 'REGISTRATION', f'metric registration of {k}', [k], [L(k, r['anchors'])], r, {'mPerPx': round(1 / (37.8 if k in ('gp', 'ap') else 72.58 if k == 'sec' else 28 if k == 'site' else 59), 4)},
         'SOURCE_DERIVED' if k in ('gp', 'ap', 'sec') else 'IMAGE_METRIC_REGISTERED', 'two anchors per axis from printed chains/datums (plans, section) or from the silhouette against the plan width and the section ridge (renders)',
         'the plan scales agree to 0.2% on both axes; the four render scales span 58.8..59.6 px/m')

# ------------------------------------------------------------------ 2. page facts
facts = [('house_net_area', 129.04, 'm2'), ('usable_area_without_stairs', 153.31, 'm2'), ('garage_area', 24.10, 'm2'), ('boiler_room_area', 5.80, 'm2'), ('footprint_area', 131.16, 'm2'),
         ('floor_area', 170.62, 'm2'), ('total_area', 231.11, 'm2'), ('roof_area', 150.57, 'm2'), ('volume', 779.94, 'm3'), ('building_height', 8.27, 'm')]
for key, val, unit in facts:
    item(f'T2-PAGE-{key.upper()}', 'PAGE_FACT', f'published {key}', ['page'], [L('page', f'product-data item data-resource {key}', pageHash='e2c98181d6119d59...')], {'value': val, 'unit': unit}, {}, 'SOURCE_EXACT',
         'read from the page markup by the ARCHON adapter (identical to the 2026-09-15 acquisition)', 'an aggregate: no geometry may be derived from it; used to CHECK the layout only')
item('T2-PAGE-ROOF', 'PAGE_SPEC', 'published roof specification', ['page'], [L('page', 'technical-data item "dach"')], {'text': 'dwuspadowy, nachylenie 40 st., więźba drewniana, dachówka ceramiczna swissporTON, okno dachowe FAKRO', 'kind': 'GABLE', 'pitchDeg': 40, 'rooflights': 'FAKRO'}, {'deg': 0.5}, 'SOURCE_EXACT', 'publisher text')
item('T2-PAGE-KNEEWALL', 'PAGE_SPEC', 'published knee wall', ['page'], [L('page', 'technical-data item "ścianka kolankowa"')], {'text': '130 cm', 'm': 1.30}, {'m': 0.005}, 'SOURCE_EXACT', 'publisher text; the section prints the same 130')
item('T2-PAGE-EAVES', 'PAGE_SPEC', 'published "no eaves"', ['page'], [L('page', 'bottom description: "Charakterystyczny dwuspadowy dach bez okapów"')], {'eavesOverhang': 'NONE (side eaves)'}, {}, 'SOURCE_EXACT', 'publisher prose', 'about the SIDE eaves; the gable ends carry the roof over the recesses (see T2-ROOF-EXTENT)')
item('T2-PAGE-ROOMS', 'PAGE_ROOM_TABLE', 'published room table', ['page'], [L('page', 'two tables headed Parter / Poddasze')],
     {'GROUND': [['1', 'Wiatrołap', 3.70], ['2', 'Hol', 9.18], ['3', 'Kuchnia', 9.63], ['4', 'Salon + Jadalnia', 29.52], ['5', 'Spiżarnia', 1.44], ['6', 'Łazienka', 3.95], ['7', 'Pokój', 9.18], ['8', 'Kotłownia', 5.80], ['9', 'Garaż', 24.10]],
      'ATTIC': [['1', 'Korytarz', 6.17], ['2', 'Pokój', 10.25], ['3', 'Garderoba', 5.19], ['4', 'Łazienka', 6.40], ['5', 'Pralnia', 5.59], ['6', 'Pokój', 12.57], ['7', 'Pokój', 9.02], ['8', 'Garderoba', 1.62], ['9', 'Schody', 5.63]]},
     {}, 'SOURCE_EXACT', 'page tables', 'attic figures are NET (headroom rule); the area-labelled plans print gross figures in brackets: 6 Pokój 15.13, 7 Pokój 10.88, 8 Garderoba 2.38, 5 Pralnia 6.73, 4 Łazienka 7.81, 3 Garderoba 6.53, 2 Pokój 11.88; ground Spiżarnia 2.42 gross')

# ------------------------------------------------------------------ 3. levels (section)
for id, name, val, row in (('GROUND_FFL', 'ground finished floor +-0,00', 0.0, 642), ('UPPER_FFL', 'attic finished floor +3,06', 3.06, 420), ('EAVE_DATUM', 'eave datum +4,67', 4.67, 303), ('RIDGE', 'ridge +7,95', 7.95, 65), ('TERRAIN', 'terrain -0,32', -0.32, 665)):
    item(f'T2-LEVEL-{id}', 'LEVEL', name, ['sec'], [L('sec', f'printed datum marker at row {row}')], {'y': val}, {'m': 0.005}, 'SOURCE_EXACT', 'printed level datum; the five markers fit one scale to 0.15%')
item('T2-LEVEL-KNEEWALL_TOP', 'LEVEL', 'attic masonry top (knee wall 130 above +3,06)', ['sec', 'page', 'east', 'west'], [L('sec', 'vertical dimension 130, ticks rows 325..420'), L('east', 'tiles end and white wall begins at row 316..317 on every column = 4.36 m'), L('west', 'same, rows 316..317')], {'y': 4.36}, {'m': 0.02}, 'SOURCE_CORROBORATED', 'printed 130 + page spec + the visible roof/wall line on both side renders', 'the +4,67 datum is the roof surface at the outer wall face; the tiles meet the wall 0.31 m below it')
item('T2-LEVEL-GROUND_CLEAR', 'LEVEL', 'ground storey clear height 272', ['sec'], [L('sec', 'vertical dimension 272; slab soffit row 444 to floor row 642 = 2.73 m')], {'m': 2.72}, {'m': 0.01}, 'SOURCE_EXACT', 'printed; upper slab 0.33 thick (rows 420..444)')
item('T2-LEVEL-ATTIC_CLEAR', 'LEVEL', 'attic clear height 266 under a flat ceiling', ['sec'], [L('sec', 'vertical dimension 266; ceiling band rows 200..226 spanning px 306..522 = x 2.45..5.43')], {'m': 2.66, 'ceilingUndersideY': 5.72, 'ceilingTopY': 6.10, 'ceilingSpanX': [2.45, 5.43]}, {'m': 0.02}, 'SOURCE_EXACT', 'printed; the horizontal ceiling (collar) spans the middle 3.0 m of the attic')
item('T2-LEVEL-GARAGE_CLEAR', 'LEVEL', 'garage clear height 252', ['sec'], [L('sec', 'vertical dimension 252 in the garage; roof slab rows 433..458')], {'m': 2.52, 'roofSlabTopY': 2.88, 'roofSlabSoffitY': 2.53}, {'m': 0.02}, 'SOURCE_EXACT', 'printed 252; slab rows measured')

# ------------------------------------------------------------------ 4. main structure
item('T2-MASS-MAIN', 'MASS', 'main body walled envelope', ['gp', 'ap', 'sec'], [L('gp', 'chain 790 (row 40, px 58..357) and chain 1260 = 510 + 750 (right column rows 259..735); outer wall bands 17 px = 0.45 m'), L('ap', 'outer faces px 47..345 (7.90) and rows 195..671 (12.60)'), L('sec', 'west face px 128 to shared wall px 697 = 7.84 m')],
     {'x': [0.0, 7.90], 'z': [1.00, 13.60], 'widthM': 7.90, 'depthM': 12.60, 'storeys': [0, 1], 'wallThicknessM': 0.45}, {'m': 0.01}, 'SOURCE_EXACT', 'printed chains 790 and 1260 both close (790+415=1205, 510+750=1260); wall thickness measured 17 px on both plans and 33 px on the section (0.45)')
item('T2-MASS-GARAGE', 'MASS', 'garage walled envelope', ['gp', 'sec', 'ap'], [L('gp', 'chain 415 (row 40, px 357..514) and 750 (right column rows 452..735); garage east wall band px 497..513; garage rear wall band rows 452..468'), L('sec', 'garage px 697..1001 = 4.19 m'), L('ap', 'garage roof outline drawn px 345..505 x rows 387..707')],
     {'x': [7.90, 12.05], 'z': [1.00, 8.50], 'widthM': 4.15, 'depthM': 7.50, 'storeys': [0], 'sharedWallX': 7.90, 'sharedWallThicknessM': 0.39}, {'m': 0.01}, 'SOURCE_EXACT', 'printed 415 and 750; the house/garage wall measures 28 px = 0.39 m on the section (one wall, not two)')
item('T2-MASS-ENVELOPE', 'MASS', 'characteristic outer envelope', ['gp', 'east', 'west', 'site'], [L('gp', 'chain 100|510|750|100 in the right column: rows 221..259, 259..452, 452..735, 735..773'), L('east', 'silhouette px 210..1075 = 865 px at 59.2..59.6 px/m = 14.5..14.6 m'), L('west', 'silhouette px 214..1080 = 866 px'), L('site', 'roof outline rows 134..546 = 412 px at 28.7 px/m = 14.35 m, 26 px past the 1260 chain at each end')],
     {'x': [0.0, 12.05], 'z': [0.0, 14.60], 'widthM': 12.05, 'depthM': 14.60}, {'m': 0.05}, 'SOURCE_CORROBORATED', 'the printed 100 zones at both ends of the 1260 chain, the return stubs drawn in them on both plans, and both side silhouettes measuring 14.5..14.6 m at the scale that puts the ridge at 7.95 and the garage rear wall at z 8.50', 'the 14.60 depth of the old finding is RE-PROVED, independently, from the current bytes')
item('T2-MASS-STOREY_COVERAGE', 'MASS', 'storey coverage', ['gp', 'ap'], [L('ap', 'the attic plan draws the garage only as a roof outline (double-line rectangle with mitred corners), no walls, no rooms')], {'storey0': ['main', 'garage'], 'storey1': ['main']}, {}, 'SOURCE_EXACT', 'the attic plan shows no garage storey')
item('T2-MASS-FOOTPRINT_AREA', 'MASS', 'walled footprint area', ['gp', 'page'], [L('page', 'powierzchnia zabudowy 131,16')], {'walledM2': round(7.9 * 12.6 + 4.15 * 7.5, 3), 'publishedM2': 131.16}, {'m2': 0.5}, 'SOURCE_CORROBORATED', '7.90 x 12.60 + 4.15 x 7.50 = 130.665 against the published 131.16 (0.38%)')

# ------------------------------------------------------------------ 5. recesses / returns
item('T2-RECESS-FRONT-GROUND', 'RECESS', 'front recess (portal) at ground level', ['gp', 'front', 'hero'], [L('gp', 'row scans at rows 743, 752, 761, 771 (z -0.2..-0.95 below the front wall): black only at px 58..82 (x 0.00..0.63) and 490..513 (x 11.42..12.02); NOTHING at px 333..357 (x 7.27..7.87)'), L('front', 'west return W 376..412 (x 0.00..0.61) rows 301..573; garage return G 1047..1084 (x 11.41..12.04); the recess x 3.23..11.38 reads dark at every row 445..560')],
     {'mouthZ': 0.0, 'backZ': 1.00, 'depthM': 1.00, 'x': [0.61, 11.42], 'returns': {'west': [0.0, 0.61], 'east': None, 'garageEast': [11.42, 12.05]}, 'storey': 0}, {'m': 0.04}, 'SOURCE_CORROBORATED', 'plan row scans in the zone + the front render', 'at ground level the recess runs unbroken from the west return to the garage return: the house/garage line x 7.29..7.90 has NO return below the balcony slab')
item('T2-RECESS-FRONT-ATTIC', 'RECESS', 'front recess (balcony) at attic level', ['ap', 'front', 'hero'], [L('ap', 'row scans at rows 679, 688, 697, 707: black at px 47..70 (x 0.00..0.61) and 321..345 (x 7.26..7.90)'), L('front', 'W 802..839 at row 330 (x 7.24..7.87, 4.11 m): the east return above the balcony')],
     {'mouthZ': 0.0, 'backZ': 1.00, 'depthM': 1.00, 'x': [0.61, 7.26], 'returns': {'west': [0.0, 0.61], 'east': [7.26, 7.90]}, 'storey': 1, 'eastReturnBaseY': 3.06}, {'m': 0.04}, 'SOURCE_CORROBORATED', 'plan row scans + the front render', 'the east return exists only above the balcony slab; the ground plan draws nothing there')
item('T2-RECESS-REAR', 'RECESS', 'rear recess (loggia) both storeys', ['gp', 'ap', 'rear', 'w2'], [L('gp', 'row scans at rows 251, 242, 233, 223 (z 12.8..13.55 above the rear wall): black at px 58..82 (0.00..0.63) and 333..356 (7.27..7.87)'), L('ap', 'rows 187, 178, 169, 159: black at px 47..70 and 321..345'), L('rear', 'returns W 506..542 and 933..970 at rows 300..574; timber T 542..933 at row 575')],
     {'mouthZ': 14.60, 'backZ': 13.60, 'depthM': 1.00, 'x': [0.61, 7.29], 'returns': {'west': [0.0, 0.61], 'east': [7.29, 7.90]}, 'storeys': [0, 1]}, {'m': 0.04}, 'SOURCE_CORROBORATED', 'both plans + the rear render + the garden perspective')
item('T2-RETURN-THICKNESS', 'RETURN', 'return wall thickness', ['gp', 'ap', 'front', 'rear'], [L('gp', '24 px of black at each return = 0.63 m'), L('ap', '23..24 px = 0.61..0.64'), L('front', 'W 376..412 = 36 px = 0.61 m'), L('rear', 'W 506..542 = 36 px = 0.61')], {'m': 0.61}, {'m': 0.03}, 'SOURCE_CORROBORATED', 'plan ink + render face width agree', 'thicker than the 0.45 external wall: the return is the external wall plus its 0.16 m outer leaf/cladding return')
item('T2-RETURN-HEIGHT', 'RETURN', 'return walls die into the roof soffit', ['front', 'rear', 'hero'], [L('front', 'x=390: white to row 292 (4.76 m), roof edge 280..292; x=380: W 301..573 (4.61)'), L('rear', 'x=520: W 348..574 under the verge band W 296..343')], {'topY': 'the roof underside at the outer plane (4.61..4.76 measured; 4.64 derived)'}, {'m': 0.1}, 'IMAGE_METRIC_REGISTERED', 'the returns and the verge band are one continuous white face on every render', 'the exact junction is a roof-edge detail')

# ------------------------------------------------------------------ 6. roofs
item('T2-ROOF-MAIN', 'ROOF', 'main gable roof', ['page', 'sec', 'front', 'rear'], [L('sec', '40° printed against the west slope; slope rows 161..80 over px 300..420'), L('page', 'dach: dwuspadowy, nachylenie 40 st.')],
     {'kind': 'GABLE', 'pitchDeg': 40, 'ridgeAxis': 'Z', 'ridgeX': 3.95, 'eaveY': 4.67, 'ridgeY': 7.95, 'supportX': [0.0, 7.90], 'sideEavesOverhangM': 0.0}, {'deg': 0.5, 'm': 0.02}, 'SOURCE_EXACT', 'printed angle + page spec + section datums; 7.95 - 3.95*tan40 = 4.636 against the printed 4.67 (0.034 m)', conflict='the printed eave datum +4,67 and the derived plane 4.636 differ by 0.034 m; both kept')
item('T2-ROOF-EXTENT', 'ROOF', 'main roof spans the full 14.60 m (over both recesses)', ['east', 'west', 'site', 'hero', 'w2'], [L('east', 'tiles G rows 101..316 from px 210 to 1075 on every scanned row'), L('west', 'tiles from px 215 to 1079'), L('site', 'roof outline rows 134..546 reaches 26 px (0.9 m) past the 1260 chain at both ends')],
     {'z': [0.0, 14.60], 'gableOverhangBeyondWallM': 1.00}, {'m': 0.1}, 'SOURCE_CORROBORATED', 'both side renders + the site plan', 'the gable ends therefore stand in the outer planes z=0 and z=14.60, on the returns')
item('T2-ROOF-VERGE-MEMBER', 'ROOF_MEMBER', 'white verge band along both rakes (gable-edge member)', ['front', 'rear', 'hero', 'w2'], [L('front', 'x=470: G 216..224 (roof edge line) then W 225..272 (48 px vertical = 0.82 m); x=600: W 115..164 (49 px)'), L('rear', 'x=560: W 262..303; x=520: W 296..343'), L('hero', 'the white rake band shows a visible underside and reads as a thick frame continuous with the returns')],
     {'verticalExtentM': 0.83, 'perpendicularWidthM': 0.64, 'plane': 'outer planes z=0 and z=14.60', 'continuousWithReturns': True}, {'m': 0.06}, 'IMAGE_METRIC_REGISTERED', 'measured on the registered front and rear renders; corroborated by the perspectives', 'a facade assembly member (GABLE_FRAME): the roof edge over the recess, not a flush band; its depth (along z) is not measured', review=True)
item('T2-ROOF-SHADOW-BAND', 'SHADOW', 'shadow band under the verge on the recessed timber wall', ['front'], [L('front', 'x=470: dark 273..316 (0.73 m) between the verge band and the timber; x=600: 164..207')], {'verticalExtentM': 0.73}, {'m': 0.1}, 'VISUAL_SEMANTIC', 'shading only: the recessed wall is 1.0 m behind the verge', 'NOT geometry; recorded so it is not mistaken for a second member')
item('T2-ROOF-GARAGE', 'ROOF', 'garage flat roof with parapet', ['sec', 'ap', 'front', 'east', 'rear'], [L('sec', 'slab rows 433..458 from px 669 to 1001; east wall px 970..1001 rises to row 417 (3.10 m) as a parapet; slab top 2.88 at px 700 rising to 2.95 near the parapet'), L('ap', 'roof outline px 345..505 x rows 387..707 = x 7.90..12.14, z 0.05..8.52, with an edge line 3..4 px inside it'), L('east', 'garage top edge rows 390..392 = 3.07..3.11 m'), L('front', 'band top rows 390..394 = 3.03..3.10')],
     {'kind': 'FLAT', 'x': [7.90, 12.05], 'z': [0.0, 8.50], 'slabTopY': 2.88, 'parapetTopY': 3.09, 'coversPortalRecess': True}, {'m': 0.04}, 'SOURCE_CORROBORATED', 'section (slab + upstand) + attic plan outline (extends to z=0) + three renders (top edge 3.07..3.11)', 'the garage roof projects 1.00 m over the portal recess in front of the garage door; its edge is the dark fascia that continues into the balcony fascia')
item('T2-ROOF-BUILDUP', 'ROOF', 'roof build-up between the knee wall top and the eave plane', ['sec'], [L('sec', 'derived eave plane 4.636 (printed 4.67) vs the 130 knee wall top 4.36')], {'verticalM': 0.276, 'perpendicularM': 0.211, 'fromPrintedDatumVerticalM': 0.31}, {'m': 0.03}, 'SOURCE_DERIVED', '4.636 - 4.36 on the section; perpendicular = vertical * cos 40; 0.31 if the printed +4,67 is used instead')

# ------------------------------------------------------------------ 7. chimneys and rooflights
item('T2-CHIMNEY-1', 'CHIMNEY', 'chimney 1 (fireplace flue, east slope, rear half)', ['ap', 'gp', 'site', 'east', 'front', 'rear'], [L('ap', 'solid black block px 253..276 x rows 368..384 = x 5.46..6.07, z 8.62..9.05'), L('gp', 'black block x 5.60..6.03 at z 8.8..9.1 (rows 440..452)'), L('east', 'dark column x=740 rows 110..206 = top 7.84, meets the roof at 6.22; x-extent px 705..750 = z 8.36..9.12'), L('site', 'grey square px 395..412 x rows 285..296')],
     {'x': [5.46, 6.07], 'z': [8.62, 9.05], 'topY': 7.86, 'slope': 'EAST'}, {'m': 0.06}, 'SOURCE_CORROBORATED', 'both plans + site plan + three renders', 'the fireplace icon sits at x 6.07..6.79, z 8.73..9.30 on the ground plan, beside the flue')
item('T2-CHIMNEY-2', 'CHIMNEY', 'chimney 2 (boiler flue, east slope, front half)', ['ap', 'gp', 'site', 'east', 'front'], [L('ap', 'black block px 253..273 x rows 531..551 = x 5.46..5.99, z 4.15..4.70'), L('gp', 'black block x 5.39..5.87 at z 4.2..4.6'), L('east', 'dark column x=470 rows 110..202: top 7.84, meets roof at 6.28; px 445..490 = z 3.97..4.73'), L('site', 'dark square px 395..412 x rows 430..441')],
     {'x': [5.42, 5.99], 'z': [4.15, 4.70], 'topY': 7.86, 'slope': 'EAST'}, {'m': 0.06}, 'SOURCE_CORROBORATED', 'both plans + site plan + two renders', 'the front and rear renders each show one chimney because the two align along z; the side renders show both')
item('T2-ROOFLIGHT-W1', 'ROOFLIGHT', 'rooflight, west slope, over the laundry', ['ap', 'west', 'site', 'page'], [L('ap', 'callout 78/118 at px 62,410 with a dashed rectangle at the west wall between rows 395..430'), L('west', 'glass px 600..655 rows 237..275 = z 7.17..8.09, y 5.04..5.68'), L('site', 'blue square px 250..272 x rows 323..338')],
     {'widthAlongRidgeM': 0.78, 'lengthAlongSlopeM': 1.18, 'zCentre': 7.63, 'slopeXFromEave': [0.44, 1.20], 'yBottom': 5.04, 'slope': 'WEST'}, {'m': 0.08}, 'SOURCE_CORROBORATED', 'printed 78/118 + the west render + the site plan')
item('T2-ROOFLIGHT-W2', 'ROOFLIGHT', 'rooflight, west slope, over the bathroom', ['ap', 'west', 'site'], [L('ap', 'callout 78/118 at px 62,500'), L('west', 'glass px 738..778 rows 237..275 = z 5.09..5.77'), L('site', 'blue square rows 386..393')],
     {'widthAlongRidgeM': 0.78, 'lengthAlongSlopeM': 1.18, 'zCentre': 5.43, 'slopeXFromEave': [0.44, 1.20], 'yBottom': 5.04, 'slope': 'WEST'}, {'m': 0.1}, 'SOURCE_CORROBORATED', 'printed callout + west render + site plan')
item('T2-ROOFLIGHT-E1', 'ROOFLIGHT', 'rooflight, east slope, over the stair/corridor', ['ap', 'east', 'site'], [L('ap', 'callout 78/118 at px 325,500 with a dashed rectangle at the east wall rows 475..515'), L('east', 'glass px 515..549 rows 237..275 = z 5.15..5.73'), L('site', 'blue square px 438..458 rows 385..400')],
     {'widthAlongRidgeM': 0.78, 'lengthAlongSlopeM': 1.18, 'zCentre': 5.44, 'slopeXFromEave': [6.70, 7.46], 'yBottom': 5.04, 'slope': 'EAST'}, {'m': 0.1}, 'SOURCE_CORROBORATED', 'printed callout + east render + site plan')

# ------------------------------------------------------------------ 8. exterior openings
def opening(id, name, facade, storey, host, x0, x1, sill, head, profile, family, callout, assets, locs, status, unc=0.04, notes='', headFar=None, review=False):
    val = {'facade': facade, 'storey': storey, 'host': host, 'interval': [x0, x1], 'widthM': round(x1 - x0, 2), 'sillY': sill, 'headY': head, 'profile': profile, 'family': family, 'printedCallout': callout}
    if headFar is not None: val['headFarY'] = headFar
    item(id, 'OPENING', name, assets, locs, val, {'m': unc}, status, 'plan gap between wall band pieces (position + width) + printed callout (width/height) + render for sill/head/profile', notes, review=review)
opening('T2-OPEN-FRONT-ROOM', 'front room window 110/230', 'FRONT', 0, 'main front wall z 1.00..1.45', 1.40, 2.50, 0.0, 2.30, 'RECTANGULAR', 'WINDOW', '110/230', ['gp', 'front'],
        [L('gp', 'gap in the front wall band at row 727: px 111..152 = x 1.40..2.48; callout 110/230 at px 130,750'), L('front', 'glass/frame edges x 1.43..2.45 at rows 455..470; head edge row 438 (2.28 m); sill at the floor')], 'SOURCE_CORROBORATED', notes='full-height window (sill 0) per the render')
opening('T2-OPEN-FRONT-ENTRANCE', 'entrance door 105/210', 'FRONT', 0, 'main front wall', 4.18, 5.23, 0.0, 2.10, 'RECTANGULAR', 'DOOR', '105/210', ['gp', 'front', 'hero'],
        [L('gp', 'gap px 216..255 = x 4.18..5.21; callout 105/210 at px 240,750'), L('front', 'leaf + narrow sidelight at px 625..682 (x 4.23..5.20)')], 'SOURCE_CORROBORATED', notes='leaf/sidelight split VISUAL only (leaf ~0.7 west + glass strip ~0.3 east is the hero reading; the old gold read the opposite order): UNRESOLVED', review=True)
opening('T2-OPEN-GARAGE-DOOR', 'garage door 275/225', 'FRONT', 0, 'garage front wall z 1.00..1.45', 8.55, 11.30, 0.0, 2.25, 'RECTANGULAR', 'GARAGE_DOOR', '275/225', ['gp', 'front', 'hero'],
        [L('gp', 'gap px 382..484 = x 8.56..11.26; callout 275/225 at px 430,750'), L('front', 'sectional door px 880..1045 (x 8.57..11.38), head row 442 (2.21 m)')], 'SOURCE_CORROBORATED', notes='the portal fascia soffit (2.28) sits right on the door head')
opening('T2-OPEN-FRONT-GABLE', 'front gable glazing 270/320', 'FRONT', 1, 'main front wall (attic)', 3.95, 6.65, 3.06, 6.26, 'RAKED_SINGLE', 'GLAZED_DOOR', '270/320', ['ap', 'front', 'hero'],
        [L('ap', 'gap in the front wall band at row 663: px 196..297 = x 3.95..6.63; callout 270/320 at px 245,690'), L('front', 'west jamb x 3.96 on every row 3.95..6.16 m; head edge descends 2.45 m in x over 2.04 m in y (tan 39.8°): 6.24 at x 3.96, 4.02 at x 6.63; glass continues below the balustrade top 3.93')],
        'SOURCE_CORROBORATED', headFar=4.02, notes='tall edge at the ridge side (x 3.95), head raked at the roof pitch; sill at the attic floor; contains the balcony door; mullions VISUAL at x~4.65 and ~5.10', review=True)
opening('T2-OPEN-REAR-GLAZING', 'rear living glazing 470/230', 'REAR', 0, 'main rear wall z 13.15..13.60', 2.25, 6.95, 0.0, 2.30, 'RECTANGULAR', 'MULTI_PANEL_GLAZING', '470/230', ['gp', 'rear', 'w2'],
        [L('gp', 'gaps px 144..229 and 235..320 with a 6 px mullion stub between = x 2.27..6.92; callout 470/230 at px 232,235'), L('rear', 'glass/frame x 2.22..6.92 at row 440 (2.27 m)')], 'SOURCE_CORROBORATED', notes='one structural opening drawn with a central division; sliding door + fixed lights')
opening('T2-OPEN-REAR-GABLE-W', 'rear gable window west 234/303', 'REAR', 1, 'main rear wall (attic)', 0.95, 3.29, 3.06, 6.09, 'RAKED_SINGLE', 'WINDOW', '234/303', ['ap', 'rear', 'w2'],
        [L('ap', 'gap in the rear wall band at row 203: px 83..170 = x 0.95..3.26; callout 234/303 at px 130,178'), L('rear', 'trapezoid glass with its tall edge towards the ridge (x 3.29) and its head falling towards x 0.95')],
        'SOURCE_CORROBORATED', headFar=4.13, notes='303 = the tall edge above the attic floor at the ridge side (x 3.29); the far head 6.09-2.34*tan40 = 4.13')
opening('T2-OPEN-REAR-GABLE-E', 'rear gable window east 234/303', 'REAR', 1, 'main rear wall (attic)', 4.61, 6.95, 3.06, 6.09, 'RAKED_SINGLE', 'WINDOW', '234/303', ['ap', 'rear', 'w2'],
        [L('ap', 'gap px 221..308 = x 4.61..6.92; callout 234/303 at px 265,178'), L('rear', 'mirror of the west window about the ridge x 3.95; old reading of the render corroborates the rake at three heights')],
        'SOURCE_CORROBORATED', headFar=4.13, notes='tall edge at x 4.61 (ridge side)')
opening('T2-OPEN-WEST-LIVING', 'west living window 90/230', 'WEST', 0, 'main west wall x 0..0.45', 9.07, 9.97, 0.0, 2.30, 'RECTANGULAR', 'WINDOW', '90/230', ['gp', 'west'],
        [L('gp', 'gaps in the west wall band at column px 66: rows 432..447 and 449..463 = z 9.07..9.92 with a 1 px mullion stub; callout 90/230 at px 40,410'), L('west', 'glass column x=520 rows 441..570 = y 0.07..2.24; window px 492..545 = z 9.02..9.92')], 'SOURCE_CORROBORATED', notes='interval is along z; full height (sill 0)')
opening('T2-OPEN-WEST-KITCHEN', 'west kitchen window 140/140', 'WEST', 0, 'main west wall', 6.80, 8.20, 0.90, 2.30, 'RECTANGULAR', 'WINDOW', '140/140', ['gp', 'west'],
        [L('gp', 'gaps rows 469..492 and 493..518 = z 5.82..7.17 (+1.00) = 6.82..8.17; callout 140/140 at px 40,480'), L('west', 'glass column x=640 rows 453..510 = y 1.08..2.04 inside frames')], 'SOURCE_CORROBORATED', notes='sill 0.90 = 2.30 - 1.40 (the head aligns with the other ground-floor heads)')
opening('T2-OPEN-EAST-LIVING', 'east living window 300/230', 'EAST', 0, 'main east wall x 7.45..7.90 (z 8.50..13.60 exterior)', 9.70, 12.70, 0.0, 2.30, 'RECTANGULAR', 'MULTI_PANEL_GLAZING', '300/230', ['gp', 'east'],
        [L('gp', 'gap in the east wall band at column px 349: rows 293..406 = z 9.71..12.70; callout 300/230 at px 385,350'), L('east', 'window px 790..960 = z 9.80..12.67 (frames inside); head row 438 (2.30)')], 'SOURCE_CORROBORATED')
opening('T2-OPEN-GARAGE-SIDE', 'garage side door 100/210 (rear wall of the garage)', 'REAR', 0, 'garage rear wall z 8.05..8.50', 9.90, 10.90, 0.0, 2.10, 'RECTANGULAR', 'GLAZED_DOOR', '100/210', ['gp', 'rear'],
        [L('gp', 'gap in the garage rear wall band at row 460: px 436..466 = x 9.99..10.78 (the swing arc shortens it); callout 100/210 at px 452,432'), L('rear', 'fully glazed leaf; head edge row 450 at x=350 = 2.10')], 'SOURCE_CORROBORATED', unc=0.06, notes='faces the garden at z 8.50; visible on the rear render left of the loggia')
opening('T2-OPEN-BOILER-GARAGE', 'boiler room to garage door (shared wall)', 'INTERIOR', 0, 'house/garage wall x 7.45..7.90', 2.24, 3.06, 0.0, 2.10, 'RECTANGULAR', 'DOOR', None, ['gp'],
        [L('gp', 'gap in the shared wall band at column px 349: rows 657..688 = z 2.24..3.06')], 'SOURCE_DERIVED', unc=0.06, notes='no callout; head 2.10 ASSUMED like the other single doors; one leaf through one 0.39 m wall')

# ------------------------------------------------------------------ 9. interior walls and doors (ground)
def wall(id, storey, name, axis, at, span, thick, doors, assets, loc, status='SOURCE_DERIVED', notes=''):
    item(id, 'INTERIOR_WALL', name, assets, [loc], {'storey': storey, 'axis': axis, 'centre': at, 'span': span, 'thicknessM': thick, 'doors': doors}, {'m': 0.04}, status, 'black band centre and extent measured on the plan through the chain frame; doors are the gaps between pieces of the band', notes)
G = [('T2-IWALL-G-ROOM_EAST', 'wall east of the front room (pokój 7) / hall', 'Z', 3.41, [1.45, 4.70], 0.12, [{'id': 'T2-IDOOR-G-ROOM', 'interval': [3.67, 4.60], 'connects': ['7 Pokój', '2 Hol']}], 'column px 187: pieces z 1.45..3.67 and 4.60..4.86; printed 290 room width closes on its west face'),
     ('T2-IWALL-G-BATH_EAST', 'wall east of the bathroom (6) / hall', 'Z', 3.41, [4.82, 6.30], 0.12, [{'id': 'T2-IDOOR-G-BATH', 'interval': [4.86, 5.79], 'connects': ['6 Łazienka', '2 Hol']}], 'column px 187: piece z 5.79..6.35'),
     ('T2-IWALL-G-BATH_SOUTH', 'bathroom south wall (bathroom / front room)', 'X', 4.76, [0.45, 3.46], 0.12, [], 'row z 4.72: black x 0.45..3.46 (row px 594)'),
     ('T2-IWALL-G-KITCHEN_SOUTH', 'kitchen south wall (kitchen / bathroom)', 'X', 6.30, [0.45, 3.49], 0.12, [], 'row z 6.30 (px 535): black x 0.45..3.49, meeting the x 3.41 wall; east of 3.49 the hall opens into the kitchen (no wall). The printed 265 (kitchen) + 414 (salon) = 679 run from this wall face (6.36) to the rear wall face (13.15): the kitchen/salon virtual boundary is at z 9.01; the printed 446 on the east runs from 13.15 down to the pantry north wall face 8.69'),
     ('T2-IWALL-G-ENTRY_NORTH', 'vestibule north wall (wiatrołap / hall)', 'X', 3.53, [3.36, 5.47], 0.12, [{'id': 'T2-IDOOR-G-ENTRY', 'interval': [4.20, 5.13], 'connects': ['1 Wiatrołap', '2 Hol']}], 'row z 3.53 (px 639): pieces x 3.36..4.20 and 5.13..5.47'),
     ('T2-IWALL-G-BOILER_WEST', 'boiler room west wall (kotłownia / vestibule+hall)', 'Z', 5.42, [1.45, 4.79], 0.12, [{'id': 'T2-IDOOR-G-BOILER', 'interval': [2.22, 3.14], 'connects': ['8 Kotłownia', '1 Wiatrołap']}], 'column px 263: pieces z 1.45..2.22 and 3.14..4.79'),
     ('T2-IWALL-G-BOILER_NORTH', 'boiler room north wall (kotłownia / stair)', 'X', 4.70, [5.39, 7.45], 0.26, [], 'row z 4.70 (px 595): black x 5.39..7.45; band rows 589..598 = 0.24..0.26 m; printed 312 boiler depth closes on its south face'),
     ('T2-IWALL-G-PANTRY_WEST', 'pantry west wall (spiżarnia / hall)', 'Z', 5.42, [7.33, 8.68], 0.12, [{'id': 'T2-IDOOR-G-PANTRY', 'interval': [7.54, 8.36], 'connects': ['5 Spiżarnia', '2 Hol']}], 'column px 263: pieces z 7.33..7.54 and 8.36..8.68'),
     ('T2-IWALL-G-PANTRY_SOUTH', 'pantry south wall (over the stair well)', 'X', 7.40, [5.39, 6.42], 0.12, [], 'row z 7.40 (px 493): black x 5.39..6.42 only; east of 6.42 the pantry runs on to z 6.82 over the upper flight (the 160 dimension)'),
     ('T2-IWALL-G-PANTRY_NORTH', 'pantry north wall (spiżarnia / salon)', 'X', 8.57, [5.36, 7.45], 0.22, [], 'row z 8.63 (px 447): black x 5.36..7.45; band rows 441..454'),
     ('T2-IWALL-G-WELL_WEST', 'stair well west wall (well / hall)', 'Z', 6.39, [6.35, 7.43], 0.12, [], 'column px 300: piece z 6.35..7.43; the wall/balustrade line on the hall side of the well (x 5.36..6.45, z 5.84..7.46)', ),
     ('T2-IWALL-G-CHIMNEY1', 'fireplace flue block (ground)', 'X', 8.9, [5.60, 6.03], 0.40, [], 'black block x 5.60..6.03, z 8.7..9.1 (rows 440..452)')]
for id, name, axis, at, span, thick, doors, loc in G:
    wall(id, 0, name, axis, at, span, thick, doors, ['gp'], L('gp', loc))
U = [('T2-IWALL-U-CORRIDOR_WEST', 'corridor west wall (rooms 6,5,4 / corridor 1)', 'Z', 3.95, [4.71, 13.15], 0.12, [{'id': 'T2-IDOOR-U-BATH', 'interval': [4.94, 5.87], 'connects': ['4 Łazienka', '1 Korytarz']}, {'id': 'T2-IDOOR-U-PRALNIA', 'interval': [7.17, 8.09], 'connects': ['5 Pralnia', '1 Korytarz']}, {'id': 'T2-IDOOR-U-POKOJ_NW', 'interval': [8.76, 9.68], 'connects': ['6 Pokój', '1 Korytarz']}], 'column px 196: pieces z 4.71..4.94, 5.87..7.17, 8.09..8.76, 9.68..13.15; printed 344 | 344 closes on it'),
     ('T2-IWALL-U-ROOM2_WEST', 'south room west wall (garderoba 3 / pokój 2)', 'Z', 3.40, [1.45, 4.84], 0.12, [{'id': 'T2-IDOOR-U-GARDEROBA_SW', 'interval': [2.09, 2.91], 'connects': ['3 Garderoba', '2 Pokój']}], 'column px 175: pieces z 1.45..2.09 and 2.91..4.84; printed 290 | 398 closes on it'),
     ('T2-IWALL-U-BATH_SOUTH', 'bathroom south wall (łazienka 4 / garderoba 3)', 'X', 3.86, [0.45, 3.45], 0.12, [], 'row z 3.86 (px 563): black x 0.45..3.45; printed 235 closes on it'),
     ('T2-IWALL-U-PRALNIA_SOUTH', 'laundry south wall (pralnia 5 / łazienka 4)', 'X', 6.47, [0.45, 3.95], 0.12, [], 'row z 6.47 (px 464): black x 0.45..3.95; printed 248 | 202 close on it'),
     ('T2-IWALL-U-POKOJ_NW_SOUTH', 'north-west room south wall (pokój 6 / pralnia 5)', 'X', 8.60, [0.45, 3.95], 0.12, [], 'row z 8.60 (px 384): black x 0.45..3.95; printed 449 closes on it'),
     ('T2-IWALL-U-CORRIDOR_SOUTH', 'corridor south wall (corridor 1 + stair 9 / pokój 2)', 'X', 4.70, [3.34, 7.45], 0.12, [{'id': 'T2-IDOOR-U-POKOJ_S', 'interval': [4.08, 5.01], 'connects': ['1 Korytarz', '2 Pokój']}], 'row z 4.68 (px 532): pieces x 3.34..4.08, 5.01..6.02, 6.31..7.45; the 6.02..6.31 gap is beside chimney 2 (ambiguous: a duct or a drawing break, not a door); printed 325 closes on it'),
     ('T2-IWALL-U-POKOJ_NE_SOUTH', 'north-east room south wall (pokój 7 / garderoba 8 + corridor)', 'X', 9.84, [3.98, 5.28], 0.12, [{'id': 'T2-IDOOR-U-POKOJ_NE', 'interval': [4.14, 5.01], 'connects': ['7 Pokój', '1 Korytarz']}], 'row z 9.80 (px 339): pieces x 3.98..4.14 and 5.01..5.28; printed 325 closes on it'),
     ('T2-IWALL-U-GARDEROBA_NE_WEST', 'north-east wardrobe west wall (garderoba 8 / corridor)', 'Z', 5.23, [8.46, 9.89], 0.12, [], 'column px 244: piece z 8.46..9.89; printed 134 | 217 (garderoba 8 is 1.34 wide, 2.17 deep) close on it; no door: room 8 opens off room 7'),
     ('T2-IWALL-U-STAIR_NORTH', 'stair compartment north wall (stair 9 / garderoba 8)', 'X', 8.50, [5.17, 7.45], 0.12, [], 'row z 8.50 (px 388): black x 5.17..7.45'),
     ('T2-IWALL-U-CHIMNEY1', 'chimney 1 block (attic)', 'X', 8.83, [5.46, 6.07], 0.43, [], 'solid black px 253..276 x rows 368..384'),
     ('T2-IWALL-U-CHIMNEY2', 'chimney 2 block (attic)', 'X', 4.43, [5.46, 5.99], 0.55, [], 'solid black rows 531..551')]
for id, name, axis, at, span, thick, doors, loc in U:
    wall(id, 1, name, axis, at, span, thick, doors, ['ap'], L('ap', loc))
item('T2-IWALL-ATTIC-TOP', 'INTERIOR_WALL', 'attic partition heights', ['sec'], [L('sec', 'ceiling band rows 200..226 over px 306..522: underside 5.72')], {'capY': 5.72, 'belowCap': 'follow the roof underside'}, {'m': 0.03}, 'SOURCE_DERIVED', 'the flat ceiling at +5.72 (266 above +3.06) caps every partition; below it they die into the roof', 'the old reference capped them at 2.60 above the floor (5.66): 0.06 m lower')

# ------------------------------------------------------------------ 10. rooms
rooms = [
 ('T2-ROOM-G-1', 0, '1', 'Wiatrołap', [[3.47, 1.45], [5.36, 1.45], [5.36, 3.47], [3.47, 3.47]], 3.70),
 ('T2-ROOM-G-2', 0, '2', 'Hol', [[3.47, 3.59], [5.36, 3.59], [5.36, 9.01], [4.08, 9.01], [4.08, 6.36], [3.47, 6.36]], 9.18),
 ('T2-ROOM-G-3', 0, '3', 'Kuchnia', [[0.45, 6.36], [4.08, 6.36], [4.08, 9.01], [0.45, 9.01]], 9.63),
 ('T2-ROOM-G-4', 0, '4', 'Salon + Jadalnia', [[0.45, 9.01], [5.48, 9.01], [5.48, 8.69], [7.45, 8.69], [7.45, 13.15], [0.45, 13.15]], 29.52),
 ('T2-ROOM-G-5', 0, '5', 'Spiżarnia', [[5.48, 7.46], [7.45, 7.46], [7.45, 8.46], [5.48, 8.46]], 1.44),
 ('T2-ROOM-G-6', 0, '6', 'Łazienka', [[0.45, 4.82], [3.35, 4.82], [3.35, 6.24], [0.45, 6.24]], 3.95),
 ('T2-ROOM-G-7', 0, '7', 'Pokój', [[0.45, 1.45], [3.35, 1.45], [3.35, 4.70], [0.45, 4.70]], 9.18),
 ('T2-ROOM-G-8', 0, '8', 'Kotłownia', [[5.48, 1.45], [7.45, 1.45], [7.45, 4.57], [5.48, 4.57]], 5.80),
 ('T2-ROOM-G-9', 0, '9', 'Garaż', [[7.90, 1.45], [11.60, 1.45], [11.60, 8.05], [7.90, 8.05]], 24.10),
 ('T2-ROOM-G-STAIR', 0, 'stair', 'Schody (shaft, no number on the ground table)', [[5.36, 4.83], [7.45, 4.83], [7.45, 7.40], [5.36, 7.40]], None),
 ('T2-ROOM-U-1', 1, '1', 'Korytarz', [[4.01, 4.76], [5.36, 4.76], [5.36, 8.44], [5.29, 8.44], [5.29, 9.78], [4.01, 9.78]], 6.17),
 ('T2-ROOM-U-2', 1, '2', 'Pokój (south)', [[3.46, 1.45], [7.45, 1.45], [7.45, 4.64], [3.46, 4.64]], 10.25),
 ('T2-ROOM-U-3', 1, '3', 'Garderoba (south-west)', [[0.45, 1.45], [3.34, 1.45], [3.34, 3.80], [0.45, 3.80]], 5.19),
 ('T2-ROOM-U-4', 1, '4', 'Łazienka', [[0.45, 3.92], [3.89, 3.92], [3.89, 6.41], [0.45, 6.41]], 6.40),
 ('T2-ROOM-U-5', 1, '5', 'Pralnia', [[0.45, 6.53], [3.89, 6.53], [3.89, 8.54], [0.45, 8.54]], 5.59),
 ('T2-ROOM-U-6', 1, '6', 'Pokój (north-west)', [[0.45, 8.66], [3.89, 8.66], [3.89, 13.15], [0.45, 13.15]], 12.57),
 ('T2-ROOM-U-7', 1, '7', 'Pokój (north-east)', [[4.01, 9.90], [7.45, 9.90], [7.45, 13.15], [4.01, 13.15]], 9.02),
 ('T2-ROOM-U-8', 1, '8', 'Garderoba (north-east)', [[5.29, 8.56], [7.45, 8.56], [7.45, 9.78], [5.29, 9.78]], 1.62),
 ('T2-ROOM-U-9', 1, '9', 'Schody', [[5.36, 4.76], [7.45, 4.76], [7.45, 8.44], [5.36, 8.44], [5.36, 7.46], [6.45, 7.46], [6.45, 5.84], [5.36, 5.84]], 5.63),
]
def shoelace(p):
    s = 0
    for i in range(len(p)):
        a, b = p[i], p[(i + 1) % len(p)]
        s += a[0] * b[1] - b[0] * a[1]
    return abs(s) / 2
for id, storey, num, label, poly, pub in rooms:
    area = round(shoelace(poly), 2)
    item(id, 'ROOM', f'room {num} {label}', ['gp' if storey == 0 else 'ap', 'ga' if storey == 0 else 'aa', 'page'], [L('gp' if storey == 0 else 'ap', f'polygon bounded by the wall faces above; room number {num} printed inside; area-labelled copy prints {label} {pub}')],
         {'storey': storey, 'number': num, 'label': label, 'polygon': poly, 'polygonAreaM2': area, 'publishedAreaM2': pub}, {'m': 0.05}, 'SOURCE_DERIVED', 'polygon from the wall graph (wall faces); the published area is a corroboration constraint only',
         (f'polygon {area} m2 vs published {pub}' + ('; the kitchen, hall and living room are one open space: their mutual boundaries are the printed 265/414/446 lines, not walls' if num in ('2','3','4') and storey==0 else '') + ('; attic figures are NET under a headroom rule, the polygon is gross' if storey==1 else '')) if pub else 'the ground-floor stair shaft is not a numbered room; the U-stair and its well occupy it', conflict=(f'polygon {area} vs published {pub} differs by more than 10%' if pub and abs(area - pub) / pub > 0.1 else None))

# ------------------------------------------------------------------ 11. stair
item('T2-STAIR-TOPOLOGY', 'STAIR', 'stair topology: U-stair of three flights and two quarter landings', ['gp', 'ap', 'sec'],
     [L('gp', 'five tread lines running along z at px 261, 271, 281, 292, 302 (x 5.36, 5.63, 5.90, 6.18, 6.45) between rows 553..591 (z 4.81..5.84): the LOWER flight climbs EAST; the walking line at row 572 (z 5.32) runs x 5.31..6.92 and turns north at px 321 (x 6.95); tread lines at rows 553, 543, 533, 492 (z 5.82, 6.08, 6.35, 7.43) across px 302..340 (x 6.45..7.43): the MIDDLE flight climbs NORTH in the east band; the plant symbol at px 261..299 x rows 496..551 (x 5.36..6.37, z 5.87..7.33) stands in the WELL between the flights'),
      L('ap', 'seven tread lines at rows 489, 479, 468, 458, 448, 438, 428 (z 5.82, 6.08, 6.37, 6.64, 6.90, 7.17, 7.43) across px 290..327 (x 6.45..7.42); four tread lines along z at px 259, 270, 280, 290 (x 5.62, 5.91, 6.18, 6.44) between rows 390..427 (z 7.46..8.44): the UPPER flight climbs WEST in the north band; walking line at px 309 (x 6.95) rows 409..505 (z 5.34..7.94) turning west at row 409 to an arrowhead at px 250..259 (x 5.38..5.62)'),
      L('sec', 'the cut shows five risers at x 5.37, 5.63, 5.91, 6.17, 6.44 rising 0.17, 0.36, 0.52, 0.72, 0.88 m, then a level platform from x 6.44 to the shared wall (7.45) at 0.88..0.90; beyond the cut, seven nosings in the east band x 6.45..7.44 at 1.05, 1.23, 1.41, 1.58, 1.76, 1.94, 2.12..2.16 m')],
     {'shaft': {'x': [5.36, 7.45], 'z': [4.81, 8.44]}, 'well': {'x': [5.36, 6.45], 'z': [5.84, 7.46]}, 'widthM': 1.0, 'start': {'x': 5.36, 'z': [4.81, 5.84], 'level': 'ground floor, from the hall (2)'}, 'flights': [
         {'index': 1, 'direction': 'PLUS_X', 'band': {'z': [4.81, 5.84]}, 'riserLinesX': [5.36, 5.63, 5.90, 6.18, 6.45], 'risers': 5, 'goingM': 0.27, 'from': 0.0, 'to': 0.90},
         {'index': 'landing-1', 'kind': 'QUARTER_LANDING', 'x': [6.45, 7.45], 'z': [4.81, 5.84], 'levelY': 0.90, 'turn': 'LEFT (to +z)'},
         {'index': 2, 'direction': 'PLUS_Z', 'band': {'x': [6.45, 7.45]}, 'riserLinesZ': [5.84, 6.10, 6.37, 6.64, 6.90, 7.17, 7.43], 'risers': 7, 'goingM': 0.265, 'from': 0.90, 'to': 2.16},
         {'index': 'landing-2', 'kind': 'QUARTER_LANDING', 'x': [6.45, 7.45], 'z': [7.46, 8.44], 'levelY': 2.16, 'turn': 'LEFT (to -x)'},
         {'index': 3, 'direction': 'MINUS_X', 'band': {'z': [7.46, 8.44]}, 'riserLinesX': [6.44, 6.18, 5.91, 5.62, 5.36], 'risers': 5, 'goingM': 0.265, 'from': 2.16, 'to': 3.06, 'arrival': 'attic corridor (1) at x 5.36, z 7.46..8.44'}],
      'risersTotal': 17, 'riserM': 0.18, 'totalRiseM': 3.06, 'turnKind': 'U (two left quarter turns)', 'winders': 0},
     {'m': 0.04, 'risers': 0}, 'SOURCE_CORROBORATED', 'tread ladders read on both plans through the chain frames; riser count and going corroborated by the section (5 risers at 0.267 m going, landing at 0.90, seven nosings 0.18 m apart in the east band); 17 x 0.18 = 3.06 closes on the printed +3,06 exactly',
     'this CONTRADICTS the old reference (a dog-leg of 4 + 4 winders + 9) and the current Auto (no stair). Nothing in either plan fans: both corner squares are level landings, and the third flight along the north band is what both earlier readings missed', review=True)

# ------------------------------------------------------------------ 12. balconies, fascias, portal, railings
item('T2-BALCONY-FRONT', 'BALCONY', 'front balcony slab over the portal recess', ['ap', 'front', 'hero'], [L('ap', 'the attic front zone px 70..321 is floored between rows 671..707; the balustrade line at row 705 (z 0.08)'), L('front', 'dark fascia band: top edge rows 390..394 (3.03..3.10), bottom edge row 438 (2.28) on every column x 700..1065; its west end at px 567 (x 3.25)')],
     {'x': [3.25, 7.90], 'z': [0.0, 1.00], 'topY': 3.06, 'fasciaTopY': 3.07, 'fasciaSoffitY': 2.28, 'fasciaThicknessM': 0.79}, {'m': 0.05}, 'IMAGE_METRIC_REGISTERED', 'plan extent (west edge 3.25..3.34) + registered front render for the fascia', 'the fascia is measured 0.79 m tall on the front render (the old gold read 0.55); the slab top is taken as the attic floor 3.06', conflict='front fascia 0.79 m vs rear fascia 0.56 m: the two balconies are not the same section; the front one is continuous with the garage roof edge', review=True)
item('T2-BALCONY-REAR', 'BALCONY', 'rear balcony slab over the loggia', ['ap', 'rear', 'w2'], [L('ap', 'attic rear zone px 70..321 rows 159..195; balustrade line at row 161'), L('rear', 'fascia top rows 393..396 (3.02..3.07), bottom rows 426..428 (2.47..2.51) at x 700..900; darker shadow on the timber down to rows 471..478 (1.63..1.75)')],
     {'x': [0.61, 7.29], 'z': [13.60, 14.60], 'topY': 3.06, 'fasciaTopY': 3.05, 'fasciaSoffitY': 2.49, 'fasciaThicknessM': 0.56}, {'m': 0.05}, 'IMAGE_METRIC_REGISTERED', 'plan extent + registered rear render', 'the 0.7 m darker zone under the fascia is the shadow on the timber, not a member')
item('T2-PORTAL-HEAD', 'PORTAL', 'portal head over the garage door: the garage roof edge over the recess', ['front', 'hero', 'ap', 'sec'], [L('front', 'the same dark band 2.28..3.07 continues from the balcony (x 3.25) to the garage return (x 12.05) with no break at x 7.90'), L('hero', 'the band turns the corner as one member; a lit timber soffit runs under it over the garage door'), L('ap', 'garage roof outline reaches row 707 (z 0.05)')],
     {'x': [7.90, 12.05], 'z': [0.0, 1.00], 'fasciaTopY': 3.07, 'fasciaSoffitY': 2.28, 'soffitFinish': 'timber (VISUAL)'}, {'m': 0.05}, 'SOURCE_CORROBORATED', 'attic plan outline + section parapet + front render + hero', 'the recess mouth at ground level is x 0.61..11.42 wide and 2.28 m tall under this head')
item('T2-FACADE-FRONT-BAND', 'FACADE_MEMBER', 'continuous dark front band (balcony fascia + portal head)', ['front', 'hero', 'w1'], [L('front', 'rows 394..438 dark/grey from px 567 to 1084 (x 3.25..12.04) at every sampled column; no break')], {'x': [3.25, 12.05], 'y': [2.28, 3.07], 'plane': 'z = 0 (the outer plane)', 'kind': 'BALCONY_FRAME + PORTAL fascia'}, {'m': 0.05}, 'IMAGE_METRIC_REGISTERED', 'registered front render; continuity confirmed on the hero perspective', 'the member the owner described as continuous around the garage/balcony region', review=True)
item('T2-RAILING-FRONT', 'RAILING', 'front glass balustrade', ['ap', 'front', 'hero'], [L('ap', 'balustrade line at row 705 (z 0.08) from px 172 to 321 with post marks'), L('front', 'bluish glass rows 342..390 from px 570 to 800 (x 3.30..7.23); top edge rows 340..342 (3.93..3.95)')],
     {'x': [3.30, 7.26], 'z': 0.05, 'baseY': 3.06, 'topY': 3.93, 'heightM': 0.87, 'infill': 'GLASS'}, {'m': 0.05}, 'IMAGE_METRIC_REGISTERED', 'plan line + registered front render', 'below a normal 1.0..1.1 balustrade; either the slab top is lower than 3.06 or the render omits a top rail: UNRESOLVED', review=True)
item('T2-RAILING-REAR', 'RAILING', 'rear glass balustrade', ['ap', 'rear', 'w2'], [L('ap', 'balustrade line at row 161 (z 14.50) from px 70 to 321'), L('rear', 'glass rows 343..390 from px 545 to 932 (x 0.64..7.22); top row 341..343 (3.92..3.95)')],
     {'x': [0.64, 7.26], 'z': 14.55, 'baseY': 3.06, 'topY': 3.93, 'heightM': 0.87, 'infill': 'GLASS'}, {'m': 0.05}, 'IMAGE_METRIC_REGISTERED', 'plan line + registered rear render')

# ------------------------------------------------------------------ 13. facade assemblies
item('T2-ASSEMBLY-FRONT-GABLE-FRAME', 'FACADE_ASSEMBLY', 'front gable frame: west return + verge members + east return above the balcony', ['front', 'hero', 'gp', 'ap'], [L('hero', 'the white shell reads as one thick frame around the recessed timber panel: left upright (the return), two raking members (the verge) meeting at the ridge, and a short right upright standing on the balcony slab')],
     {'kind': 'GABLE_FRAME', 'plane': 'z = 0', 'members': ['T2-RECESS-FRONT-GROUND.returns.west', 'T2-ROOF-VERGE-MEMBER (west rake)', 'T2-ROOF-VERGE-MEMBER (east rake)', 'T2-RECESS-FRONT-ATTIC.returns.east'], 'continuity': ['west return CONTINUES_AS the west verge member', 'east verge member CONTINUES_AS the east return above the balcony', 'east verge member TERMINATES_AT the garage roof edge']}, {}, 'SOURCE_CORROBORATED', 'plans give the returns as ink; the front render and the hero give the verge as a member of measured width; continuity is visible on the hero', 'the owner-reported characteristic frame', review=True)
item('T2-ASSEMBLY-REAR-GABLE-FRAME', 'FACADE_ASSEMBLY', 'rear gable frame: two full-height returns + verge members', ['rear', 'w2', 'gp', 'ap'], [L('w2', 'the garden perspective shows the white frame (two uprights + rake) around the dark gable and the loggia')],
     {'kind': 'GABLE_FRAME', 'plane': 'z = 14.60', 'members': ['T2-RECESS-REAR.returns.west', 'T2-RECESS-REAR.returns.east', 'T2-ROOF-VERGE-MEMBER (both rakes)']}, {}, 'SOURCE_CORROBORATED', 'plans + rear render + garden perspective')
item('T2-ASSEMBLY-FRONT-PORTAL', 'FACADE_ASSEMBLY', 'front portal: balcony fascia + garage roof edge + garage return + west return jamb', ['front', 'hero'], [L('front', 'band 2.28..3.07 from x 3.25 to 12.05; jambs at x 0.61 (west return) and 11.42 (garage return)')],
     {'kind': 'PORTAL_FRAME', 'mouth': {'x': [0.61, 11.42], 'y': [0.0, 2.28]}, 'head': 'T2-FACADE-FRONT-BAND', 'jambs': ['west return', 'garage east return'], 'depthM': 1.00}, {}, 'SOURCE_CORROBORATED', 'plan returns + registered front render + hero')
item('T2-ASSEMBLY-GARAGE-BOX', 'FACADE_ASSEMBLY', 'garage: dark box with a flat roof and a parapet band', ['east', 'rear', 'front', 'sec'], [L('east', 'dark block px 212..713 (z 0.03..8.50) to rows 390..392 (3.07..3.11)'), L('rear', 'dark block px 259..503 (x 7.92..12.05) to row 396 (3.02)')],
     {'kind': 'FASCIA', 'parapetTopY': 3.09, 'slabTopY': 2.88, 'finish': 'dark render on all faces'}, {'m': 0.05}, 'SOURCE_CORROBORATED', 'section upstand + three renders')

# ------------------------------------------------------------------ 14. materials (regions only)
mats = [('T2-MAT-WHITE-SHELL', 'white render: returns, verge band, side walls above the dark band, front gable outside the timber panel', ['front', 'rear', 'east', 'west']),
        ('T2-MAT-TIMBER-FRONT', 'timber cladding: the recessed front wall from the west return to the balcony edge (x 0.61..3.25) full height and the gable panel up to the glazing (x 3.25..3.95 above 3.06; the gable above the balustrade x 3.95..7.26)', ['front', 'hero']),
        ('T2-MAT-TIMBER-REAR', 'timber cladding: the recessed rear wall either side of the 470/230 glazing under the balcony (x 0.61..2.25 and 6.95..7.29, y 0..2.28)', ['rear', 'w2']),
        ('T2-MAT-DARK-FRONT', 'anthracite render: the portal walls (x 3.25..11.42, y 0..2.28 at z=1.00), the front band, the garage box', ['front', 'hero']),
        ('T2-MAT-DARK-REAR-GABLE', 'anthracite render: the rear gable wall above the balcony between the returns', ['rear', 'w2']),
        ('T2-MAT-DARK-SIDE-BANDS', 'anthracite render bands on the ground floor: west z 3.74..9.92 to y 2.29; east from the garage (z 8.50) to the 300/230 jamb (z 9.70) to y 2.30', ['west', 'east']),
        ('T2-MAT-ROOF', 'grey clay tiles on both slopes; grey plinth 0.32 m at the base', ['east', 'west', 'front'])]
for id, what, assets in mats:
    item(id, 'MATERIAL_REGION', what, assets, [L(assets[0], 'colour-class row/column scans')], {'geometry': 'NONE: a flush finish region'}, {}, 'VISUAL_SEMANTIC', 'material classes from the renders', 'colour never creates geometry')

# ------------------------------------------------------------------ 15. unresolved / conflicts
unres = [('T2-UNRES-140-220', 'the printed 140 | 220 pair at the head of the attic plan and its mirror', ['ap'], 'extension lines at px 100 and 140 (x 1.40, 2.47) on both ends of the rear outer plane; 140+220 = 360 from each corner leaves 70 in the middle; matches no wall, window (0.95..3.29) or balustrade post found', 'candidates: balustrade panel divisions, a terrace step, a roof-window layout line'),
         ('T2-UNRES-ENTRANCE-SPLIT', 'the leaf / sidelight split of the 105 entrance', ['front', 'hero'], 'a narrow glass strip and a grey leaf; which side the strip is on differs between the old gold and the hero reading', 'render only'),
         ('T2-UNRES-FRONT-FASCIA-SECTION', 'what the 0.79 m front fascia is made of (slab + downstand? parapet?)', ['front', 'sec'], 'the section does not cut the balcony', 'modelled as a slab whose fascia is the measured band'),
         ('T2-UNRES-VERGE-DEPTH', 'the depth (along z) of the white verge member and whether it is solid or a fascia board', ['hero'], 'only the face width 0.64 is measured', ''),
         ('T2-UNRES-EAVE-DATUM', 'eave datum +4,67 vs the derived 4.636', ['sec'], '0.034 m', 'both kept; the model uses the derived plane so that 40°, 7.90 and 7.95 hold together'),
         ('T2-UNRES-GARAGE-ROOF-FALL', 'the garage roof slab top: 2.88 at the house rising to ~2.95 at the parapet on the section', ['sec'], 'a drainage fall or a drawing artefact', 'modelled level at 2.88 with a parapet to 3.09'),
         ('T2-UNRES-ROOFLIGHT-SILL', 'the exact position of each rooflight along its slope', ['west', 'east'], 'read to +-0.1 m off the renders; the plan symbols are dashed rectangles against the wall', ''),
         ('T2-UNRES-RAILING-HEIGHT', 'balustrade height 0.87 above the slab', ['front', 'rear'], 'below code; a top rail may be omitted from the render', ''),
         ('T2-UNRES-PANTRY-SHAPE', 'the pantry: its south wall stops at x 6.42 and the space runs under the upper flight to z 6.82 (the 160 dimension); published 1.44 net / 2.42 gross', ['gp', 'page'], 'an L-shaped room whose east leg is under the stair', ''),
         ('T2-UNRES-CORRIDOR-SOUTH-GAP', 'a 0.29 m break in the attic corridor south wall at x 6.02..6.31 beside chimney 2', ['ap'], 'a duct, a niche, or the chimney outline', 'not a door'),
         ('T2-UNRES-ATTIC-NET-AREAS', 'the attic table prints NET areas under an unstated headroom rule (e.g. 12.57 net vs 15.13 gross)', ['page', 'aa'], 'polygons are gross', ''),
         ('T2-UNRES-CHIMNEY-DEPTH', 'chimney plan dimensions to better than +-0.06', ['ap', 'site'], '', '')]
for id, what, assets, why, handling in unres:
    item(id, 'UNRESOLVED', what, assets, [L(assets[0], why)], {'handling': handling}, {}, 'UNRESOLVED', 'named, not hidden', why, review=True)

# ------------------------------------------------------------------ write
truth = OrderedDict()
truth['schema'] = 'buildapp.research.marcowki-source-truth'
truth['schemaVersion'] = '2.0.0'
truth['sealed'] = '2026-09-24'
truth['sourcePackageId'] = 'src-m2fa281446a8ca-c0499d9df3'
truth['sourcePackageContentHash'] = '331d98cc10cd1c208868a08cde0347dd024475c4ea29c48d5f5035e847d8a9d7'
truth['pageHash'] = 'e2c98181d6119d59'
truth['frame'] = items[0]['value']
truth['statusVocabulary'] = ['SOURCE_EXACT', 'SOURCE_CORROBORATED', 'SOURCE_DERIVED', 'IMAGE_METRIC_REGISTERED', 'VISUAL_SEMANTIC', 'OWNER_OBSERVED', 'ASSUMED_FOR_RENDERING', 'UNRESOLVED']
truth['itemCount'] = len(items)
truth['items'] = items
os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
json.dump(truth, open(OUT_JSON, 'w'), indent=1, ensure_ascii=False)

# ---- markdown tables
from collections import Counter
lines = []
lines.append(f'Items: {len(items)}. By status: ' + ', '.join(f'{k} {v}' for k, v in sorted(Counter(i["status"] for i in items).items())) + '.')
lines.append('')
lines.append('| id | kind | name | status | value (summary) | ± | owner review |')
lines.append('| --- | --- | --- | --- | --- | --- | --- |')
def summary(v):
    if isinstance(v, dict):
        keep = {k: v[k] for k in list(v)[:6] if not isinstance(v[k], (list, dict)) or k in ('x', 'z', 'interval', 'span', 'centre')}
        s = json.dumps(keep, ensure_ascii=False)
    else:
        s = json.dumps(v, ensure_ascii=False)
    return s.replace('|', '/')[:140]
for it in items:
    unc = ', '.join(f'{k} {v}' for k, v in it['uncertainty'].items()) if it['uncertainty'] else ''
    lines.append(f"| `{it['id']}` | {it['kind']} | {it['name'].replace('|', '/')} | {it['status']} | `{summary(it['value'])}` | {unc} | {'yes' if it['ownerReviewNeeded'] else ''} |")
open(OUT_MD_TABLES, 'w').write('\n'.join(lines) + '\n')
print(f'{len(items)} items -> {OUT_JSON}; tables -> {OUT_MD_TABLES}')
print(Counter(i['status'] for i in items))
print(Counter(i['kind'] for i in items))
