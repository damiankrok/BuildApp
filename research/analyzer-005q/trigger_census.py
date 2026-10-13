#!/usr/bin/env python3
"""trigger_census.py - BUILDPLAN-ANALYZER-005Q (RESEARCH ONLY): where the C1 and N1 triggers hold on the FROZEN evidence.

  python3 -I research/analyzer-005q/trigger_census.py --probe <runs/PROBE> --probe-zones <runs/PROBE2> --score <S0 score json> --out <json>

Reads the instrumented probe's decision log (CORE records: raw grid lines, bands, extent; ZONES records: the layout's
envelope, extent and zone strips) of the frozen production code, before any candidate ran, and evaluates each
preregistered trigger exactly as the candidates define it (preregistration.md section 2):
  C1  on each axis side of each reading: the outermost raw line carries a chain; one long (>= 2.5 wallPx) wall-thick
      (>= 0.7 wallPx) band has its outer face within max(5, 0.35 thickness) of it and its inner face within the same of
      another raw line inward; wall-thick bands with their outer face on that line cover >= 0.75 of the extent's span;
      and thinning would not already keep the outer line (it would drop it, or keep both).
  N1  on each zone strip of the selected plan's layout: a long wall-thick band with its two faces on the strip's two
      edges over >= 0.25 of the strip's length.
Records every candidate pair or strip with its cover, so the margins are visible, not just the verdict.
"""
import argparse, json, os


def union(runs):
    runs = sorted(runs)
    tot, reach = 0.0, -1e18
    for a, b in runs:
        st = max(a, reach)
        if b > st:
            tot += b - st
        reach = max(reach, b)
    return tot


def c1(core):
    W, ext = core['wallPx'], core['extent']
    out = []
    for axis in ('X', 'Y'):
        raw = sorted(core['raw' + axis], key=lambda l: l['px'])
        if len(raw) < 2:
            continue
        vert = axis == 'X'
        s0, s1 = (ext['y0'], ext['y1']) if vert else (ext['x0'], ext['x1'])
        walls = [b for b in core['bands'] if (b['axis'] == 'VERTICAL') == vert and b['thickness'] >= 0.7 * W]
        for low in (True, False):
            outer = raw[0] if low else raw[-1]
            if not outer['chains']:
                continue
            for b in walls:
                if b['length'] < 2.5 * W:
                    continue
                f0, f1 = (b['bounds']['x0'], b['bounds']['x1']) if vert else (b['bounds']['y0'], b['bounds']['y1'])
                o, i = (f0, f1) if low else (f1, f0)
                win = max(5, 0.35 * b['thickness'])
                if abs(o - outer['px']) > win:
                    continue
                inner = [l for l in raw if l is not outer and abs(l['px'] - i) <= win and ((l['px'] > outer['px']) if low else (l['px'] < outer['px']))]
                if not inner:
                    continue
                runs = []
                for c in walls:
                    g0, g1 = (c['bounds']['x0'], c['bounds']['x1']) if vert else (c['bounds']['y0'], c['bounds']['y1'])
                    if abs((g0 if low else g1) - outer['px']) <= max(5, 0.35 * c['thickness']):
                        a0, a1 = (c['bounds']['y0'], c['bounds']['y1']) if vert else (c['bounds']['x0'], c['bounds']['x1'])
                        if min(a1, s1) > max(a0, s0):
                            runs.append((max(a0, s0), min(a1, s1)))
                cover = union(runs) / max(1, s1 - s0)
                rank = lambda l: l['conf'] * 1e9 + min(9999, l['span']) * 1e3 + min(999, l['band'])
                pair = inner[0]
                outer_first = rank(outer) > rank(pair) or (rank(outer) == rank(pair) and outer['px'] < pair['px'])
                already = abs(pair['px'] - outer['px']) < core['minCellPx'] and outer_first
                out.append({'axis': axis, 'side': 'low' if low else 'high', 'outerPx': outer['px'], 'innerPx': pair['px'], 'cover': round(cover, 3), 'thinningKeepsOuter': already, 'fires': cover >= 0.75 and not already})
                break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--probe', required=True)
    ap.add_argument('--probe-zones', required=True)
    ap.add_argument('--score', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    score = json.load(open(a.score))
    passrows = set(score['summary']['passRows'])
    rows = []
    for case in sorted(d for d in os.listdir(a.probe) if os.path.isdir(os.path.join(a.probe, d))):
        dg = os.path.join(a.probe, case, 'plan-diagnostics', 'digest.json')
        sel = json.load(open(dg)).get('selectedPlanFrameId') if os.path.exists(dg) else None
        seen, c1rows = set(), []
        for line in open(os.path.join(a.probe, case, 'probe.ndjson')):
            r = json.loads(line)
            if r['kind'] != 'CORE':
                continue
            key = (r['frameId'], json.dumps(r['extent'], sort_keys=True), json.dumps(r['mpp']))
            if key in seen:
                continue
            seen.add(key)
            for p in c1(r):
                c1rows.append({'frame': r['frameId'], 'selected': r['frameId'] == sel, **p})
        n1rows = []
        zp = os.path.join(a.probe_zones, case, 'probe.ndjson')
        if os.path.exists(zp):
            recs = [json.loads(l) for l in open(zp)]
            zs = [r for r in recs if r['kind'] == 'ZONES' and r['frameId'] == sel]
            if zs:
                z = zs[-1]
                core = [r for r in recs if r['kind'] == 'CORE' and r['frameId'] == sel and r['extent'] == z['extent']]
                bands = core[-1]['bands'] if core else []
                Wd = core[-1]['wallPx'] if core else z['wallPx']
                for zone in z['zones']:
                    R = zone['rect']
                    vert = zone['id'].endswith('_x')
                    e0, e1 = (R['x0'], R['x1']) if vert else (R['y0'], R['y1'])
                    s0, s1 = (R['y0'], R['y1']) if vert else (R['x0'], R['x1'])
                    runs = []
                    for b in bands:
                        if (b['axis'] == 'VERTICAL') != vert or b['thickness'] < 0.7 * Wd or b['length'] < 2.5 * Wd:
                            continue
                        f0, f1 = (b['bounds']['x0'], b['bounds']['x1']) if vert else (b['bounds']['y0'], b['bounds']['y1'])
                        win = max(5, 0.35 * b['thickness'])
                        if abs(f0 - e0) <= win and abs(f1 - e1) <= win:
                            a0, a1 = (b['bounds']['y0'], b['bounds']['y1']) if vert else (b['bounds']['x0'], b['bounds']['x1'])
                            if min(a1, s1) > max(a0, s0):
                                runs.append((max(a0, s0), min(a1, s1)))
                    cover = union(runs) / max(1, s1 - s0)
                    n1rows.append({'zone': zone['id'], 'depthWalls': round((e1 - e0) / Wd, 3), 'cover': round(cover, 3), 'fires': cover >= 0.25})
        rows.append({'case': case, 'knownGood': case in passrows, 'c1': c1rows, 'n1': n1rows})
    summary = {
        'c1FiresSelected': sorted({r['case'] for r in rows for p in r['c1'] if p['fires'] and p['selected']}),
        'c1FiresAnyFrame': sorted({r['case'] for r in rows for p in r['c1'] if p['fires']}),
        'c1MaxCoverOnKnownGood': max([p['cover'] for r in rows if r['knownGood'] for p in r['c1']] or [0]),
        'c1MaxCoverOnKnownGoodWhereThinningLosesOuter': max([p['cover'] for r in rows if r['knownGood'] for p in r['c1'] if not p['thinningKeepsOuter']] or [0]),
        'n1Fires': sorted({r['case'] for r in rows for z in r['n1'] if z['fires']}),
        'n1MaxCoverOnKnownGood': max([z['cover'] for r in rows if r['knownGood'] for z in r['n1']] or [0]),
    }
    json.dump({'summary': summary, 'rows': rows}, open(a.out, 'w'), indent=1, sort_keys=True)
    print(json.dumps(summary, indent=1))


if __name__ == '__main__':
    main()
