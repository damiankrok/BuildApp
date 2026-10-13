#!/usr/bin/env python3
"""census.py - BUILDPLAN-ANALYZER-005Q mechanism census (RESEARCH ONLY).

  python3 -I research/analyzer-005q/census.py --runs /home/user/work005q/runs/PROBE --out <json>

Reads the instrumented probe's decision log (probe.ndjson, one CORE record per decomposeCore call without an outline
override) on every development row and counts, per distinct (frame, extent, scale) reading, where two face mechanisms
fire:
  SNAP  walledEnvelope moves a side of the long-band box (axes taken to their outer faces, then sideWallReach) to a
        grid line; recorded with its signed displacement in walls (positive = inward), and CROSS_FACE when it moves more
        than half a wall inward (it can then only land on the other face of the wall, or beyond it);
  THIN  thinLines drops a raw line; OUTER_LOST when the dropped line is the outermost raw line on its side of the axis
        and the line it clashed with lies inward of it.
Whether the reading's frame is the row's selected frame (digest.selectedPlanFrameId) is recorded. Nothing here reads a
published figure or a house name.
"""
import argparse, json, os


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--runs', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    rows = []
    for case in sorted(os.listdir(a.runs)):
        p = os.path.join(a.runs, case, 'probe.ndjson')
        if not os.path.exists(p):
            continue
        dg = os.path.join(a.runs, case, 'plan-diagnostics', 'digest.json')
        sel = json.load(open(dg)).get('selectedPlanFrameId') if os.path.exists(dg) else None
        seen = set()
        for line in open(p):
            r = json.loads(line)
            if r['kind'] != 'CORE':
                continue
            key = (r['frameId'], json.dumps(r['extent'], sort_keys=True), json.dumps(r['mpp']))
            if key in seen:
                continue
            seen.add(key)
            W = r['wallPx']
            rec = {'case': case, 'frame': r['frameId'], 'selected': r['frameId'] == sel, 'extent': r['extent'], 'wallPx': W, 'minCellPx': round(r['minCellPx'], 3), 'snaps': [], 'thins': []}
            reach, env = r.get('reach'), r.get('envelope')
            if reach and env:
                for side, sign in (('x0', 1), ('y0', 1), ('x1', -1), ('y1', -1)):
                    d = (env[side] - reach[side]) * sign
                    if abs(d) > 1e-6:
                        rec['snaps'].append({'side': side, 'fromPx': reach[side], 'toPx': env[side], 'inwardPx': round(d, 3), 'inwardWalls': round(d / W, 3), 'crossFace': d > W / 2})
            for axis in ('X', 'Y'):
                raw, thin = r['raw' + axis], r['thin' + axis]
                kept = {round(l['px'], 6) for l in thin}
                pxs = sorted(l['px'] for l in raw)
                for l in raw:
                    if round(l['px'], 6) in kept:
                        continue
                    clash = min(thin, key=lambda k: abs(k['px'] - l['px'])) if thin else None
                    outer = clash is not None and ((l['px'] == pxs[0] and clash['px'] > l['px']) or (l['px'] == pxs[-1] and clash['px'] < l['px']))
                    rec['thins'].append({'axis': axis, 'px': l['px'], 'conf': l['conf'], 'printed': bool(l['printed']), 'band': l['band'], 'clashPx': clash['px'] if clash else None, 'clashConf': clash['conf'] if clash else None, 'gapPx': round(abs(clash['px'] - l['px']), 3) if clash else None, 'outerLost': outer})
            rows.append(rec)
    summary = {
        'readings': len(rows),
        'casesWithCrossFaceSnapSelected': sorted({r['case'] for r in rows if r['selected'] and any(s['crossFace'] for s in r['snaps'])}),
        'casesWithCrossFaceSnapAnyFrame': sorted({r['case'] for r in rows if any(s['crossFace'] for s in r['snaps'])}),
        'casesWithOuterLostSelected': sorted({r['case'] for r in rows if r['selected'] and any(t['outerLost'] for t in r['thins'])}),
        'casesWithOuterLostAnyFrame': sorted({r['case'] for r in rows if any(t['outerLost'] for t in r['thins'])}),
        'snapInwardWallsHistogram': {},
    }
    for r in rows:
        for s in r['snaps']:
            b = f"{round(s['inwardWalls'] * 4) / 4:+.2f}"
            summary['snapInwardWallsHistogram'][b] = summary['snapInwardWallsHistogram'].get(b, 0) + 1
    json.dump({'summary': summary, 'readings': rows}, open(a.out, 'w'), indent=1, sort_keys=True)
    print(json.dumps(summary, indent=1, sort_keys=True))


if __name__ == '__main__':
    main()
