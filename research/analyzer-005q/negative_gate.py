#!/usr/bin/env python3
"""negative_gate.py - BUILDPLAN-ANALYZER-005Q gate G3, mechanical part (RESEARCH ONLY).

  python3 -I research/analyzer-005q/negative_gate.py --work /home/user/work005q --baseline S0 \
      --features stage-reports/artifacts/analyzer-005q/architecture/negative-features.json --labels C1,C2,... --out <json>

For every negative feature of the Phase A inventory (an open terrace, porch, carport, pergola, loggia, ground strip,
planting ... with its rectangle on the selected plan frame), and every candidate: the area of that rectangle covered by
BUILT regions and by the masses of the selected plan's digest, before (baseline) and after (candidate). A feature whose
built cover grows by more than one wall's strip (a quarter of the smaller of its sides, or 1 m2, whichever is less) is a
G3 violation. Rows whose selected frame changed are listed separately (the rectangle is in the old frame's pixels).
"""
import argparse, json, os


def area(r):
    return max(0, r['x1'] - r['x0']) * max(0, r['y1'] - r['y0'])


def inter(a, b):
    return {'x0': max(a['x0'], b['x0']), 'y0': max(a['y0'], b['y0']), 'x1': min(a['x1'], b['x1']), 'y1': min(a['y1'], b['y1'])}


def built_cover(run_dir, frame, rect):
    dg = os.path.join(run_dir, 'plan-diagnostics', 'digest.json')
    if not os.path.exists(dg):
        return None, None
    d = json.load(open(dg))
    plan = next((p for p in d.get('plans', []) if p['frameId'] == frame), None)
    if not plan:
        return None, d.get('selectedPlanFrameId')
    rects = [m['rect'] for m in plan.get('masses', [])] or [r['rect'] for r in plan.get('regions', []) if r.get('cls') == 'BUILT']
    # union area by sampling (rects are few; a 1-px raster of the feature rect is exact enough)
    x0, y0, x1, y1 = int(rect['x0']), int(rect['y0']), int(rect['x1']) + 1, int(rect['y1']) + 1
    covered = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            cx, cy = x + 0.5, y + 0.5
            if cx < rect['x0'] or cx > rect['x1'] or cy < rect['y0'] or cy > rect['y1']:
                continue
            if any(r['x0'] <= cx <= r['x1'] and r['y0'] <= cy <= r['y1'] for r in rects):
                covered += 1
    return covered, d.get('selectedPlanFrameId')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--baseline', default='S0')
    ap.add_argument('--features', required=True)
    ap.add_argument('--labels', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    feats = json.load(open(a.features))
    out = {'features': len(feats), 'candidates': {}}
    for label in a.labels.split(','):
        rows = []
        for f in feats:
            rect = f.get('rectPx')
            if not rect:
                continue
            b, bsel = built_cover(os.path.join(a.work, 'runs', a.baseline, f['case']), f['frame'], rect)
            n, nsel = built_cover(os.path.join(a.work, 'runs', label, f['case']), f['frame'], rect)
            mpp = f.get('mppXY') or [0, 0]
            px_m2 = (mpp[0] * mpp[1]) if mpp and mpp[0] else 0
            grow = None if b is None or n is None else (n - b) * px_m2
            side = min(rect['x1'] - rect['x0'], rect['y1'] - rect['y0'])
            limit = min(1.0, 0.25 * side * side * px_m2) if px_m2 else 0
            rows.append({'id': f['id'], 'case': f['case'], 'feature': f['feature'], 'knownGood': f.get('knownGoodPass'), 'builtBeforeM2': None if b is None else round(b * px_m2, 2), 'builtAfterM2': None if n is None else round(n * px_m2, 2), 'growthM2': None if grow is None else round(grow, 2), 'violation': grow is not None and grow > limit, 'selectedFrameChanged': bsel != nsel})
        out['candidates'][label] = {'violations': [r for r in rows if r['violation']], 'selectedFrameChanged': sorted({r['case'] for r in rows if r['selectedFrameChanged']}), 'rows': rows}
        print(label, 'G3 violations', [(r['id'], r['case'], r['feature'], r['growthM2']) for r in rows if r['violation']], 'frameChanged', out['candidates'][label]['selectedFrameChanged'])
    json.dump(out, open(a.out, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main()
