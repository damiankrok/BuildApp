#!/usr/bin/env python3
"""v3.54.11 — the historical 16 features (v3.54.7/8 `marcowki-features.py`, imported unchanged) with ONE correction of
measurement, version 1.1: the portal head.

    /usr/bin/python3 -I research/source-to-model/v35411/features-v1_1.py <features.json> <truth json> <out json>

<features.json> from research/source-to-model/v35411/measure-features.ts (it adds `frontMembers`).

Version 1 measured the portal head as the first flat roof whose plate reaches the front plane: its plate top and its
plate bottom. In a model where the band over the open front is its own member (FASCIA linear solids, H since v3.54.8)
the plate bottom is NOT the soffit one sees — the band hangs below it — and v1 reported the plate (2.78 m) for a band
built at 2.261 m. v1.1 measures what stands in the front plane over the source's portal span: every object whose bounds
reach the front plane (z0 ≤ 0.5 m) and cover ≥ 30 % of the span along x (a roof plate, a band's members), and reports
the lowest bottom as the soffit and the highest top as the head's top, NAMING the objects. Tolerances unchanged (TOL_Y
0.15 m). The v1 rows are kept beside the corrected ones: this is a correction of the scorer, not of any model.
"""
import json
import sys

# v1's tolerance for the portal head (research/source-to-model/v3548/marcowki-features.py: TOL_Y), unchanged; v1 runs
# its own main() on import, so its 16 rows are produced by running it, beside this file
TOL_Y = 0.15

SCORER = 'buildapp.v35411-marcowki-features/1.1'


def portal_v11(m, ph):
    x0, x1 = ph['x']
    span = x1 - x0
    used = []
    for o in m.get('frontMembers', []):
        if o['z0'] > 0.5:
            continue
        cover = max(0.0, min(x1, o['x1']) - max(x0, o['x0'])) / span
        if cover < 0.3 or o['y1'] < 2.0:
            continue  # below 2 m is a wall or a door, not a head
        used.append({'id': o['id'], 'cover': round(cover, 2), 'y0': round(o['y0'], 3), 'y1': round(o['y1'], 3)})
    if not used:
        return None
    return {'soffit': min(u['y0'] for u in used), 'top': max(u['y1'] for u in used), 'objects': used}


def self_test():
    ph = {'x': [7.9, 12.05], 'fasciaTopY': 3.07, 'fasciaSoffitY': 2.28}
    plate = {'id': 'roof-garage-flat', 'x0': 7.9, 'x1': 12.05, 'y0': 2.78, 'y1': 3.03, 'z0': 0, 'z1': 8.4}
    band = {'id': 'portal-1', 'x0': 7.9, 'x1': 11.3, 'y0': 2.26, 'y1': 3.04, 'z0': 0, 'z1': 1.0}
    rear = {'id': 'rear-member', 'x0': 7.9, 'x1': 12.05, 'y0': 2.0, 'y1': 3.0, 'z0': 13.0, 'z1': 14.0}
    door = {'id': 'garage-door', 'x0': 8.0, 'x1': 11.0, 'y0': 0.0, 'y1': 1.9, 'z0': 0, 'z1': 0.4}
    p = portal_v11({'frontMembers': [plate, band, rear, door]}, ph)
    assert p['soffit'] == 2.26 and p['top'] == 3.04, p                      # the band hangs below the plate: the band's soffit
    assert {o['id'] for o in p['objects']} == {'roof-garage-flat', 'portal-1'}, p  # behind the front plane / a door: not the head
    assert portal_v11({'frontMembers': [plate]}, ph)['soffit'] == 2.78       # a plate alone is still measured (as v1)
    assert portal_v11({'frontMembers': [door]}, ph) is None
    print('self-test OK')


def main():
    if '--self-test' in sys.argv:
        self_test()
        return
    feats_path, truth_path, out_path = sys.argv[1:4]
    feats = json.load(open(feats_path))
    truth = json.load(open(truth_path))
    T = {it['id']: it['value'] for it in truth['items']}
    ph = T['T2-PORTAL-HEAD']
    res = {'schema': SCORER, 'models': {}}
    lines = []
    for label, m in feats.items():
        p = portal_v11(m, ph)
        rec = {'v1PortalFlat': [r for r in (m.get('flatRoofs') or []) if r['z0'] <= 0.5][:1]}
        if p:
            rec['portalV11'] = {**p, 'topOk': abs(p['top'] - ph['fasciaTopY']) <= TOL_Y, 'soffitOk': abs(p['soffit'] - ph['fasciaSoffitY']) <= TOL_Y}
        res['models'][label] = rec
        fl = rec['v1PortalFlat'][0] if rec['v1PortalFlat'] else None
        lines.append(f"{label:10} v1 (first flat roof plate {fl['id'] if fl else '-'}): top {fl['y1'] if fl else '-'} soffit {fl['y0'] if fl else '-'} | v1.1: top {p['top'] if p else '-'} soffit {p['soffit'] if p else '-'} "
                     f"[{', '.join(o['id'] + ' ' + str(o['y0']) + '..' + str(o['y1']) + ' cover ' + str(o['cover']) for o in (p['objects'] if p else []))}] "
                     f"{'OK' if p and rec['portalV11']['topOk'] and rec['portalV11']['soffitOk'] else 'NO'} (truth top {ph['fasciaTopY']}, soffit {ph['fasciaSoffitY']})")
    json.dump(res, open(out_path, 'w'), indent=1, ensure_ascii=False)
    open(out_path.replace('.json', '.txt'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
