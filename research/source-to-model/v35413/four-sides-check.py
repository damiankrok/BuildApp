#!/usr/bin/env python3
"""v3.54.13 — do four appearance observations agree with each other? Each side's outlines are mapped to facade metres
through the solver's registration of that source elevation; then the sides are compared on what they share: the
building's width (front vs rear), its depth (east vs west), the ridge (front/rear apex vs the side roofs' tops), the
eave line (the sides' roof edge), the ground, and the garage's side (front right ↔ east). Local and deterministic: no
request. Tolerances are the registration's own error plus the observations' stated uncertainty.

    /usr/bin/python3 -I research/source-to-model/v35413/four-sides-check.py <observations.json> <facade-alignment.json> <out.json>
"""
import json, sys
obs = json.load(open(sys.argv[1])); al = json.load(open(sys.argv[2]))
proj = {v['facade']: v['projection'] for v in al['views']}
err = {v['facade']: (v['alongErrorM'], v['heightErrorM']) for v in al['views']}
side = {}
for o in obs:
    p = proj[o['facade']]; m = o['toSource']
    def to_m(x, y):
        sx = m[0][0] * x + m[0][1] * y + m[0][2]; sy = m[1][0] * x + m[1][1] * y + m[1][2]
        return p['alongAtPx0'] + p['alongSign'] * p['mpp'] * sx, (p['zeroRow'] - sy) * p['mpp']
    pts = {c: [] for c in ['ALL', 'ROOF', 'WALLISH', 'DARK_RENDER']}
    unc = 0
    for r in o['regions']:
        if r['class'] == 'BACKGROUND':
            continue
        q = [to_m(x, y) for x, y in r['outline']]
        unc = max(unc, r['uncertaintyPx'] * p['mpp'])
        pts['ALL'] += q
        if r['class'] == 'ROOF': pts['ROOF'] += q
        if r['class'] in ('LIGHT_RENDER', 'DARK_RENDER', 'TIMBER'): pts['WALLISH'] += q
        if r['class'] == 'DARK_RENDER': pts['DARK_RENDER'] += q
    a = [x for x, _ in pts['ALL']]; h = [y for _, y in pts['ALL']]
    side[o['facade']] = {
        'alongM': [round(min(a), 3), round(max(a), 3)], 'widthM': round(max(a) - min(a), 3),
        'groundM': round(min(h), 3), 'topM': round(max(h), 3),
        'roofTopM': round(max(y for _, y in pts['ROOF']), 3) if pts['ROOF'] else None,
        'roofEdgeM': round(min(y for _, y in pts['ROOF']), 3) if pts['ROOF'] else None,
        'wallTopM': round(max(y for _, y in pts['WALLISH']), 3) if pts['WALLISH'] else None,
        'uncM': round(unc + err[o['facade']][1], 3),
    }
checks = []
def chk(name, a, b, tol, why):
    ok = a is not None and b is not None and abs(a - b) <= tol
    checks.append({'check': name, 'a': a, 'b': b, 'diffM': None if a is None or b is None else round(abs(a - b), 3), 'tolM': round(tol, 3), 'ok': ok, 'why': why})
S = side
if 'FRONT' in S and 'REAR' in S:
    chk('width front = rear', S['FRONT']['widthM'], S['REAR']['widthM'], S['FRONT']['uncM'] + S['REAR']['uncM'], 'the same building seen from both ends')
    chk('ground front = rear', S['FRONT']['groundM'], S['REAR']['groundM'], S['FRONT']['uncM'] + S['REAR']['uncM'], 'one terrain datum')
    chk('apex front = rear', S['FRONT']['topM'], S['REAR']['topM'], S['FRONT']['uncM'] + S['REAR']['uncM'], 'one ridge')
if 'EAST' in S and 'WEST' in S:
    chk('depth east = west', S['EAST']['widthM'], S['WEST']['widthM'], S['EAST']['uncM'] + S['WEST']['uncM'], 'the same building seen from both sides')
    chk('eave east = west', S['EAST']['roofEdgeM'], S['WEST']['roofEdgeM'], S['EAST']['uncM'] + S['WEST']['uncM'], 'a symmetric roof edge')
for s2 in ('EAST', 'WEST'):
    if 'FRONT' in S and s2 in S:
        chk(f'ridge front apex = {s2.lower()} roof top', S['FRONT']['topM'], S[s2]['roofTopM'], S['FRONT']['uncM'] + S[s2]['uncM'], 'the ridge seen end-on and along')
json.dump({'sides': S, 'checks': checks}, open(sys.argv[3], 'w'), indent=1)
for k, v in S.items(): print(k, v)
for c in checks: print(('OK  ' if c['ok'] else 'NO  ') + f"{c['check']}: {c['a']} vs {c['b']} (diff {c['diffM']}, tol {c['tolM']})")
