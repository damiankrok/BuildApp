#!/usr/bin/env python3
"""source-truth-diff-v1.json: truth v2 against the transcribed reference (packages/reference-marcowki, "v1").

Run AFTER sealing v2. Reads the v1 facts table by regex (evaluation tooling only; nothing here feeds production),
converts the v1 reference frame to the APP frame (z_app = 13.60 - z_ref) and classifies every comparable item.
"""
import json, re, sys, math
V2 = sys.argv[1] if len(sys.argv) > 1 else 'research/marcowki-v2/marcowki-source-truth-v2.json'
FACTS = sys.argv[2] if len(sys.argv) > 2 else 'packages/reference-marcowki/src/facts.ts'
OUT = sys.argv[3] if len(sys.argv) > 3 else 'research/marcowki-v2/source-truth-diff-v1.json'
v2 = {i['id']: i for i in json.load(open(V2))['items']}
src = open(FACTS, encoding='utf8').read()
v1 = {}
for m in re.finditer(r"'([\w.]+)':\s*(?:m\(|\{\s*value:\s*)(-?[\d.]+),\s*(?:'(\w+)'|unit:\s*'\w+',\s*status:\s*'(\w+)')", src):
    v1[m.group(1)] = {'value': float(m.group(2)), 'status': m.group(3) or m.group(4)}
Z = lambda zref: round(13.60 - zref, 3)
rows = []
def cmp(v1key, v2id, v2value, note='', tolerance=0.05, transform=None, verdict=None):
    a = v1.get(v1key)
    b = v2value
    v1val = None if a is None else (transform(a['value']) if transform else a['value'])
    if verdict is None:
        if a is None: verdict = 'V1_MISSING'
        elif b is None: verdict = 'V2_UNRESOLVED'
        elif isinstance(b, (int, float)) and isinstance(v1val, (int, float)):
            verdict = 'SAME' if abs(b - v1val) <= tolerance else 'CHANGED'
        else: verdict = 'SEE_NOTE'
    rows.append({'v1Key': v1key, 'v1Value': v1val, 'v1Status': None if a is None else a['status'], 'v2Id': v2id, 'v2Value': b, 'v2Status': v2[v2id]['status'] if v2id in v2 else None, 'verdict': verdict, 'note': note})
V = lambda id, *path: (lambda d: [d := d[k] for k in path][-1] if path else d)(v2[id]['value'])
# --- plan and walls
cmp('plan.overallWidth', 'T2-MASS-ENVELOPE', V('T2-MASS-ENVELOPE', 'widthM'))
cmp('plan.mainBodyWidth', 'T2-MASS-MAIN', V('T2-MASS-MAIN', 'widthM'))
cmp('plan.garageWidth', 'T2-MASS-GARAGE', V('T2-MASS-GARAGE', 'widthM'))
cmp('plan.overallDepth', 'T2-MASS-MAIN', V('T2-MASS-MAIN', 'depthM'))
cmp('plan.garageDepth', 'T2-MASS-GARAGE', V('T2-MASS-GARAGE', 'depthM'))
cmp('plan.rearZoneToGarage', 'T2-MASS-GARAGE', round(13.60 - V('T2-MASS-GARAGE', 'z')[1], 2), 'rear wall face 13.60 to the garage rear wall 8.50')
cmp('wall.externalThickness', 'T2-MASS-MAIN', V('T2-MASS-MAIN', 'wallThicknessM'))
cmp('wall.partitionThickness', 'T2-IWALL-G-ROOM_EAST', V('T2-IWALL-G-ROOM_EAST', 'thicknessM'))
cmp('wall.boilerNorthThickness', 'T2-IWALL-G-BOILER_NORTH', V('T2-IWALL-G-BOILER_NORTH', 'thicknessM'))
cmp('wall.returnThickness', 'T2-RETURN-THICKNESS', V('T2-RETURN-THICKNESS', 'm'))
# --- levels
for k, id in (('level.terrain', 'T2-LEVEL-TERRAIN'), ('level.groundFfl', 'T2-LEVEL-GROUND_FFL'), ('level.upperFfl', 'T2-LEVEL-UPPER_FFL'), ('level.printedEave', 'T2-LEVEL-EAVE_DATUM'), ('level.ridge', 'T2-LEVEL-RIDGE')):
    cmp(k, id, V(id, 'y'))
cmp('level.groundClearHeight', 'T2-LEVEL-GROUND_CLEAR', V('T2-LEVEL-GROUND_CLEAR', 'm'))
cmp('level.atticClearHeight', 'T2-LEVEL-ATTIC_CLEAR', V('T2-LEVEL-ATTIC_CLEAR', 'm'), 'v2 adds the ceiling span x 2.45..5.43 and its underside 5.72, which v1 recorded but did not use')
cmp('level.eave', 'T2-ROOF-MAIN', 4.636, 'both take the derived plane; the printed 4.67 stays a recorded conflict')
cmp('slab.upperThickness', 'T2-LEVEL-GROUND_CLEAR', 0.33)
cmp('wall.kneeWall', 'T2-PAGE-KNEEWALL', V('T2-PAGE-KNEEWALL', 'm'))
cmp('building.height', 'T2-PAGE-BUILDING_HEIGHT', V('T2-PAGE-BUILDING_HEIGHT', 'value'))
cmp('footprint.area', 'T2-PAGE-FOOTPRINT_AREA', V('T2-PAGE-FOOTPRINT_AREA', 'value'))
# --- roof
cmp('roof.pitch', 'T2-ROOF-MAIN', V('T2-ROOF-MAIN', 'pitchDeg'), tolerance=0.5)
cmp('roof.buildUp', 'T2-ROOF-BUILDUP', V('T2-ROOF-BUILDUP', 'perpendicularM'))
cmp('roof.overhang', 'T2-ROOF-MAIN', V('T2-ROOF-MAIN', 'sideEavesOverhangM'))
cmp('roof.extentFront', 'T2-ROOF-EXTENT', V('T2-ROOF-EXTENT', 'z')[0], 'v1 ref z 13.60 = app z 0', transform=Z)
cmp('roof.extentRear', 'T2-ROOF-EXTENT', V('T2-ROOF-EXTENT', 'z')[1], 'v1 ref z -1.00 = app z 14.60', transform=Z)
cmp('garage.clearHeight', 'T2-LEVEL-GARAGE_CLEAR', V('T2-LEVEL-GARAGE_CLEAR', 'm'))
cmp('garage.roofTop', 'T2-ROOF-GARAGE', V('T2-ROOF-GARAGE', 'slabTopY'))
cmp('garage.roofThickness', 'T2-LEVEL-GARAGE_CLEAR', round(V('T2-LEVEL-GARAGE_CLEAR', 'roofSlabTopY') - V('T2-LEVEL-GARAGE_CLEAR', 'roofSlabSoffitY'), 2))
cmp('garage.bandTop', 'T2-ROOF-GARAGE', V('T2-ROOF-GARAGE', 'parapetTopY'), 'v1 left the parapet "unresolved ~0.2 m"; v2 finds the upstand on the section itself (px 970..1001 rising to row 417 = 3.10) and corroborates it on three renders: RESOLVED as a parapet 3.09', verdict='V1_UNCERTAIN_V2_RESOLVED')
# --- recesses
cmp('recess.frontOuterPlane', 'T2-RECESS-FRONT-GROUND', V('T2-RECESS-FRONT-GROUND', 'mouthZ'), transform=Z)
cmp('recess.frontBackPlane', 'T2-RECESS-FRONT-GROUND', V('T2-RECESS-FRONT-GROUND', 'backZ'), transform=Z)
cmp('recess.frontFromX', 'T2-RECESS-FRONT-GROUND', V('T2-RECESS-FRONT-GROUND', 'x')[0])
cmp('recess.frontToX', 'T2-RECESS-FRONT-GROUND', V('T2-RECESS-FRONT-GROUND', 'x')[1])
cmp('recess.rearOuterPlane', 'T2-RECESS-REAR', V('T2-RECESS-REAR', 'mouthZ'), transform=Z)
cmp('recess.rearBackPlane', 'T2-RECESS-REAR', V('T2-RECESS-REAR', 'backZ'), transform=Z)
cmp('recess.rearFromX', 'T2-RECESS-REAR', V('T2-RECESS-REAR', 'x')[0])
cmp('recess.rearToX', 'T2-RECESS-REAR', V('T2-RECESS-REAR', 'x')[1])
cmp('return.eastFrontBase', 'T2-RECESS-FRONT-ATTIC', V('T2-RECESS-FRONT-ATTIC', 'eastReturnBaseY'), 'v1 put the return base at the render-read slab top 2.96; v2 takes the attic floor 3.06 with the fascia measured 2.28..3.07 on the front render (its top IS the slab top within 0.04)', tolerance=0.11)
cmp('return.garageTop', 'T2-ROOF-GARAGE', V('T2-ROOF-GARAGE', 'parapetTopY'))
# --- balconies, portal, railings
cmp('balcony.frontFromX', 'T2-BALCONY-FRONT', V('T2-BALCONY-FRONT', 'x')[0], 'v1 plan edge line 3.338; v2 front-render fascia end 3.25 with the plan line at 3.25..3.34: within the 0.1 the two sources disagree by', tolerance=0.1)
cmp('balcony.frontToX', 'T2-BALCONY-FRONT', V('T2-BALCONY-FRONT', 'x')[1])
cmp('balcony.top', 'T2-BALCONY-FRONT', V('T2-BALCONY-FRONT', 'topY'), 'v1 2.96 (rear render read); v2 3.06 = the attic floor, the fascia top measured 3.02..3.10 on both renders', tolerance=0.11)
cmp('balcony.thickness', 'T2-BALCONY-REAR', V('T2-BALCONY-REAR', 'fasciaThicknessM'), 'rear fascia: v1 0.55, v2 0.56')
cmp('balcony.thickness', 'T2-BALCONY-FRONT', V('T2-BALCONY-FRONT', 'fasciaThicknessM'), 'FRONT fascia: v1 applied the rear 0.55 to both balconies; v2 measures the front band 2.28..3.07 = 0.79 (it is continuous with the garage roof edge)', verdict='V1_WRONG')
cmp('portal.headTop', 'T2-PORTAL-HEAD', V('T2-PORTAL-HEAD', 'fasciaTopY'))
cmp('portal.headThickness', 'T2-PORTAL-HEAD', round(V('T2-PORTAL-HEAD', 'fasciaTopY') - V('T2-PORTAL-HEAD', 'fasciaSoffitY'), 2), 'v1 assumed the portal soffit at the rear balcony soffit 2.41 (0.67 thick); v2 measures the soffit at 2.28 right on the garage door head (0.79 thick)', verdict='CHANGED')
cmp('railing.height', 'T2-RAILING-FRONT', V('T2-RAILING-FRONT', 'heightM'))
cmp('railing.frontFromX', 'T2-RAILING-FRONT', V('T2-RAILING-FRONT', 'x')[0], 'v1 first post mark 3.444; v2 glass edge 3.30 on the render', tolerance=0.15)
cmp('railing.frontToX', 'T2-RAILING-FRONT', V('T2-RAILING-FRONT', 'x')[1], tolerance=0.15)
cmp('railing.rearFromX', 'T2-RAILING-REAR', V('T2-RAILING-REAR', 'x')[0], tolerance=0.15)
cmp('railing.rearToX', 'T2-RAILING-REAR', V('T2-RAILING-REAR', 'x')[1], tolerance=0.15)
cmp('railing.frontLine', 'T2-RAILING-FRONT', V('T2-RAILING-FRONT', 'z'), transform=Z, tolerance=0.1)
cmp('railing.rearLine', 'T2-RAILING-REAR', V('T2-RAILING-REAR', 'z'), transform=Z, tolerance=0.1)
# --- roof features
cmp('chimney.top', 'T2-CHIMNEY-1', V('T2-CHIMNEY-1', 'topY'))
cmp('rooflight.width', 'T2-ROOFLIGHT-W1', V('T2-ROOFLIGHT-W1', 'widthAlongRidgeM'))
cmp('rooflight.slopeLength', 'T2-ROOFLIGHT-W1', V('T2-ROOFLIGHT-W1', 'lengthAlongSlopeM'))
cmp('rooflight.lowerEdgeFromEave', 'T2-ROOFLIGHT-W1', V('T2-ROOFLIGHT-W1', 'slopeXFromEave')[0])
cmp(None, 'T2-CHIMNEY-1', V('T2-CHIMNEY-1'), 'chimney plan positions are not in the v1 facts table (they lived in the old gold JSON only); v2 states both from the attic plan blocks', verdict='V1_MISSING')
# --- stair
st = v2['T2-STAIR-TOPOLOGY']['value']
cmp('stair.width', 'T2-STAIR-TOPOLOGY', st['widthM'])
cmp('stair.firstRiserX', 'T2-STAIR-TOPOLOGY', st['start']['x'])
cmp('stair.southBandFromZ', 'T2-STAIR-TOPOLOGY', st['start']['z'][1], 'ref 7.78 = app 5.82', transform=Z)
cmp('stair.southBandToZ', 'T2-STAIR-TOPOLOGY', st['start']['z'][0], 'ref 8.77 = app 4.83', transform=Z)
cmp('stair.cornerX', 'T2-STAIR-TOPOLOGY', st['flights'][1]['x'][0])
cmp('stair.lowerRisers', 'T2-STAIR-TOPOLOGY', st['flights'][0]['risers'], 'v1 counted 4 nosing lines before the corner (5.376, 5.641, 5.919, 6.197) and treated the corner square as winders; v2 counts the corner line 6.45 as the fifth riser onto a LEVEL landing (the section draws the platform at 0.90 = 5 x 0.18)', verdict='V1_WRONG')
cmp('stair.upperRisers', 'T2-STAIR-TOPOLOGY', st['flights'][2]['risers'], 'v1: 9 risers up the east band to an arrival at app z 7.94; v2: 7 risers up the east band (5.82..7.43) onto a second level landing (z 7.46..8.44), then a THIRD flight of 5 risers WEST along the north band to the arrival at x 5.36 (the attic plan draws its four tread lines and the walking-line arrow pointing west at z 7.94)', verdict='V1_WRONG')
cmp('stair.winderRisers', 'T2-STAIR-TOPOLOGY', st['winders'], 'v1 inferred 4 winders to make 17; v2 finds 5 + 7 + 5 = 17 straight risers with no winders: both corner squares are drawn as level landings (no fan lines; the section shows the first platform flat)', verdict='V1_WRONG')
cmp('stair.risers', 'T2-STAIR-TOPOLOGY', st['risersTotal'])
cmp('stair.riserHeight', 'T2-STAIR-TOPOLOGY', st['riserM'])
cmp('stair.lowerGoing', 'T2-STAIR-TOPOLOGY', st['flights'][0]['goingM'], tolerance=0.01)
cmp('stair.upperGoing', 'T2-STAIR-TOPOLOGY', st['flights'][2]['goingM'], tolerance=0.01)
cmp('stair.topRiserZ', 'T2-STAIR-TOPOLOGY', None, 'v1 arrival at app z 7.94 at the end of the east band; v2: the east band ends on landing 2 (z 7.46..8.44) and the arrival is at x 5.36 in the north band', verdict='V1_WRONG')
cmp('stair.waist', 'T2-STAIR-TOPOLOGY', None, 'no drawing shows the soffit in either audit', verdict='SAME_UNRESOLVED')
# --- entrance and finish bands
cmp('door.entranceLeafFraction', 'T2-OPEN-FRONT-ENTRANCE', None, 'v2 leaves the leaf/sidelight split UNRESOLVED (render-only, the hero and the elevation disagree on the side)', verdict='V2_UNRESOLVED')
cmp('band.frontTimberFromX', 'T2-MAT-TIMBER-FRONT', 0.61, 'v2 measures the timber from the return face', tolerance=0.06)
cmp('band.frontTimberToX', 'T2-MAT-TIMBER-FRONT', 3.25, tolerance=0.1)
cmp('band.frontGableTimberToX', 'T2-OPEN-FRONT-GABLE', V('T2-OPEN-FRONT-GABLE', 'interval')[0])
cmp('band.rearTimberWestToX', 'T2-OPEN-REAR-GLAZING', V('T2-OPEN-REAR-GLAZING', 'interval')[0])
cmp('band.rearTimberEastFromX', 'T2-OPEN-REAR-GLAZING', V('T2-OPEN-REAR-GLAZING', 'interval')[1])
cmp('band.rearTimberTop', 'T2-BALCONY-REAR', V('T2-BALCONY-REAR', 'fasciaSoffitY'), 'v1 2.41 vs v2 2.49: a 0.08 registration offset between the two rear-render readings (v2 anchors the plinth top row 574 and the apex row 104)', tolerance=0.1)
cmp('band.westDarkFromZ', 'T2-MAT-DARK-SIDE-BANDS', 3.74, 'v1 ref 4.568 = app 9.03?? no: v1 band.westDarkFromZ is the window far edge in REF z (4.568 -> app 9.03) and band.westDarkToZ 9.909 -> app 3.69; v2 z 3.74..9.92: SAME span, opposite naming', transform=lambda z: Z(9.909), tolerance=0.1)
cmp('band.westDarkTop', 'T2-MAT-DARK-SIDE-BANDS', 2.29, tolerance=0.1)
cmp('band.eastDarkTop', 'T2-MAT-DARK-SIDE-BANDS', 2.30, tolerance=0.1)
cmp('terrace.plinth', 'T2-LEVEL-TERRAIN', 0.32, 'v2 records the plinth as a material band; the recess floors at ±0,00 over the -0,32 terrain are the same reading')
# --- openings (v1 EXPECTED_OPENINGS, transcribed here in app coordinates as expected.ts computes them)
V1_OPEN = {
 'og-front-room-window': ('T2-OPEN-FRONT-ROOM', [1.397, 2.497], 0, 2.3, 2.3),
 'og-front-entrance': ('T2-OPEN-FRONT-ENTRANCE', [4.176, 5.226], 0, 2.1, 2.1),
 'og-east-living-window': ('T2-OPEN-EAST-LIVING', [9.704, 12.704], 0, 2.3, 2.3),
 'og-east-garage-door': ('T2-OPEN-BOILER-GARAGE', [Z(11.384), Z(10.454)], 0, 2.1, 2.1),
 'og-rear-living-glazing': ('T2-OPEN-REAR-GLAZING', [2.258, 6.958], 0, 2.3, 2.3),
 'og-west-living-window': ('T2-OPEN-WEST-LIVING', [Z(4.553), Z(3.653)], 0, 2.3, 2.3),
 'og-west-kitchen-window': ('T2-OPEN-WEST-KITCHEN', [Z(6.802), Z(5.402)], 0.9, 2.3, 2.3),
 'og-garage-door': ('T2-OPEN-GARAGE-DOOR', [8.556, 11.306], 0, 2.25, 2.25),
 'og-garage-side-door': ('T2-OPEN-GARAGE-SIDE', [9.922, 10.922], 0, 2.1, 2.1),
 'og-front-gable-glazing': ('T2-OPEN-FRONT-GABLE', [3.94, 6.64], 3.06, 6.26, round(3.06 + 3.2 - 2.7 * math.tan(math.radians(40)), 3)),
 'og-rear-gable-east': ('T2-OPEN-REAR-GABLE-E', [4.59, 6.93], 3.06, round(3.06 + 3.03 - 2.34 * math.tan(math.radians(40)), 3), 6.09),
 'og-rear-gable-west': ('T2-OPEN-REAR-GABLE-W', [0.94, 3.28], 3.06, 6.09, round(3.06 + 3.03 - 2.34 * math.tan(math.radians(40)), 3)),
}
for k, (id, span, sill, headNear, headFar) in V1_OPEN.items():
    b = v2[id]['value']
    d = max(abs(span[0] - b['interval'][0]), abs(span[1] - b['interval'][1]), abs(sill - b['sillY']))
    note = ''
    verdict = 'SAME' if d <= 0.06 else 'CHANGED'
    if id in ('T2-OPEN-REAR-GABLE-E', 'T2-OPEN-REAR-GABLE-W'):
        note = "v1's headNear/headFar run along the host wall's direction (the rear wall runs -x), so both readings put the tall 6.09 edge towards the ridge (x 3.29 and 4.61); a tall edge at the outer jamb would stand above the roof soffit there (5.1 m at x 0.95), which is why v2 re-proved the orientation on the rear render"
    if id in ('T2-OPEN-BOILER-GARAGE', 'T2-OPEN-GARAGE-SIDE') and d <= 0.1:
        verdict = 'SAME'
        note = f'within the plan-gap uncertainty (max difference {d:.3f} m; the swing arc shortens the drawn gap)'
    if id == 'T2-OPEN-FRONT-GABLE':
        note = 'same span and rake; v2 classifies it GLAZED_DOOR (it holds the balcony door) and marks the mullions VISUAL'
    rows.append({'v1Key': k, 'v1Value': {'span': span, 'sill': sill, 'headNear': headNear, 'headFar': headFar}, 'v1Status': 'EXPECTED_OPENING', 'v2Id': id, 'v2Value': {'interval': b['interval'], 'sill': b['sillY'], 'head': b['headY'], 'headFar': b.get('headFarY'), 'profile': b['profile'], 'family': b['family']}, 'v2Status': v2[id]['status'], 'verdict': verdict, 'note': note or f'max coordinate difference {d:.3f} m'})
# --- things v1 has no fact for
for id, why in (('T2-IWALL-U-CORRIDOR_WEST', 'v1 kept the interior in the old gold JSON, not in FACTS; v2 states every partition with its band and door gaps'), ('T2-ROOM-G-3', 'v2 room polygons with the open-plan boundaries from the printed 265/414/446'), ('T2-ROOF-VERGE-MEMBER', 'v1 has no verge member: the gable-edge band the owner reported missing'), ('T2-ASSEMBLY-FRONT-GABLE-FRAME', 'v1 has no facade assembly; v2 groups the returns and the verge members into the characteristic frame'), ('T2-FACADE-FRONT-BAND', 'the continuous balcony fascia + garage roof edge band; v1 modelled two separate solids of different thickness'), ('T2-ROOF-GARAGE', 'v1: flat slab 2.88 with an unresolved band; v2: slab 2.88 + parapet 3.09 from the section upstand'), ('T2-UNRES-140-220', 'v1 does not mention the 140|220 chain')):
    rows.append({'v1Key': None, 'v1Value': None, 'v1Status': None, 'v2Id': id, 'v2Value': v2[id]['value'], 'v2Status': v2[id]['status'], 'verdict': 'V1_MISSING', 'note': why})
from collections import Counter
out = {'schema': 'buildapp.research.source-truth-diff', 'schemaVersion': '1.0.0', 'v1': 'packages/reference-marcowki (facts.ts + expected.ts), reference frame converted with z_app = 13.60 - z_ref', 'v2': 'research/marcowki-v2/marcowki-source-truth-v2.json', 'v1FactCount': len(v1), 'verdicts': dict(Counter(r['verdict'] for r in rows)), 'rows': rows}
json.dump(out, open(OUT, 'w'), indent=1, ensure_ascii=False)
print(len(rows), 'rows', out['verdicts'])
