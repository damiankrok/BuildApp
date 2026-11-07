# v3.46 view-role scorer: three layers reported separately (audit 1321 §2, test v3.46 §9 "Role, relacje i rejestracja").
#
#   graph   - the observation graph's frame roles (caption + content routing of the whole path); NOT_ROUTED is a result.
#   pixels  - the content classifier's own top class per image (result-summary.sources.sheets[].content), on the images
#             it decided. Its coverage is reported with the reason for every image it did not decide: NO_SUMMARY (the run
#             failed before the summary that stores the verdicts was written), NOT_CLASSIFIED (in a summary, no verdict).
#             An image without a verdict is not counted as a wrong pixel decision, and it is never counted as a right one.
#   side    - coarse (FRONT/REAR/SIDE) and exact (LEFT/RIGHT kept apart). A predicted LEFT or RIGHT for a reference that
#             says only SIDE passes the coarse layer and is NOT_MEASURED in the exact one; a reference with LEFT/RIGHT is
#             passed by the exact layer only with the same side. Production's LEFT/RIGHT comes from the summary sheet
#             (`side`), decided at registration; the graph role is SIDE_UNSPECIFIED for side views.
#
# Every annotated image is in the denominator of the graph layer, missing runs included (MISSING_RUN).
# usage: score_views_v2.py <views.json>[,more] <runs-dir> [out.json]
import collections, glob, json, os, sys

ALIAS = {'przed-1316': 'bakopy', 'przed-1318': 'zefiranty'}
DOC = {'PERSPECTIVE_RENDER': 'EXTERIOR_PERSPECTIVE', 'FLOOR_PLAN': 'FLOOR_PLAN', 'ELEVATION': 'ORTHOGRAPHIC_ELEVATION',
       'SECTION': 'TECHNICAL_SECTION', 'SITE_PLAN': 'SITE_PLAN', 'ROOF_PLAN': 'ROOF_PLAN', 'INTERIOR': 'INTERIOR_PERSPECTIVE'}
PIX = {'EXTERIOR_PERSPECTIVE': 'EXTERIOR_PERSPECTIVE', 'INTERIOR': 'INTERIOR_PERSPECTIVE', 'FLOOR_PLAN': 'FLOOR_PLAN',
       'ELEVATION': 'ORTHOGRAPHIC_ELEVATION', 'SECTION': 'TECHNICAL_SECTION', 'SITE_PLAN': 'SITE_PLAN'}
COARSE = {'FRONT': 'FRONT', 'REAR': 'REAR', 'SIDE': 'SIDE', 'LEFT': 'SIDE', 'RIGHT': 'SIDE', 'SIDE_UNSPECIFIED': 'SIDE'}


def prf(conf, c):
    tp = conf[c][c]
    fp = sum(conf[t][c] for t in conf if t != c)
    fn = sum(v for k, v in conf[c].items() if k != c)
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return {'n': tp + fn, 'tp': tp, 'fp': fp, 'fn': fn, 'precision': p, 'recall': r, 'f1': 2 * p * r / (p + r) if p and r else 0.0}


def score(rows, runs):
    """rows: annotations; runs: {project: {'graph': graph | None, 'sheets': {byteHash: sheet} | None}} (absent = no run)."""
    gconf, pconf = collections.defaultdict(collections.Counter), collections.defaultdict(collections.Counter)
    side = collections.Counter()
    out_rows = []
    for r in rows:
        t = r['view']['class']
        run = runs.get(r['project'])
        if run is None or run.get('graph') is None:
            gp, pv = 'MISSING_RUN', None
        else:
            fr = [f for f in run['graph']['coordinateFrames'] if f.get('variantByteHash') == r['sha256']]
            gp = DOC.get(fr[0]['roles'].get('document'), fr[0]['roles'].get('document')) if fr else 'NOT_ROUTED'
            pv = fr[0]['roles'].get('view') if fr else None
            if t == 'INTERIOR_PERSPECTIVE' and gp == 'NOT_ROUTED':
                gp = 'INTERIOR_PERSPECTIVE'
        gconf[t][gp] += 1
        sheets = run.get('sheets') if run else None
        s = sheets.get(r['sha256']) if sheets is not None else None
        if sheets is None:
            pp = 'NO_SUMMARY'
        elif not s or not s.get('content') or 'top' not in s['content']:
            pp = 'NOT_CLASSIFIED'
        else:
            pp = PIX[s['content']['top']]
        pconf[t][pp] += 1
        if t == 'ORTHOGRAPHIC_ELEVATION' and r['view']['side'] not in (None, 'UNDECIDED'):
            ts = r['view']['side']
            ps = (s or {}).get('side') if (s or {}).get('side') in ('LEFT', 'RIGHT') else pv
            coarse_ok = ps is not None and COARSE.get(ts) == COARSE.get(ps)
            side['coarseN'] += 1
            side['coarseOk'] += coarse_ok
            if ts in ('LEFT', 'RIGHT'):
                side['exactN'] += 1
                side['exactOk'] += ps == ts
            else:
                side['exactNotMeasured'] += 1
        out_rows.append({'project': r['project'], 'sha256': r['sha256'], 'truth': t, 'graph': gp, 'pixels': pp})
    truth = sorted(gconf)
    g = {c: prf(gconf, c) for c in truth}
    decided = {t: collections.Counter({k: v for k, v in pconf[t].items() if k not in ('NO_SUMMARY', 'NOT_CLASSIFIED')}) for t in truth}
    p = {c: prf(decided, c) for c in truth if sum(decided[c].values())}
    cov = collections.Counter()
    for t in truth:
        for k, v in pconf[t].items():
            cov['decided' if k not in ('NO_SUMMARY', 'NOT_CLASSIFIED') else k] += v
    return {
        'n': len(rows),
        'graph': {'macroF1': sum(x['f1'] for x in g.values()) / len(g) if g else 0.0, 'perClass': g, 'confusion': {t: dict(gconf[t]) for t in truth}},
        'pixels': {'macroF1OnDecided': sum(x['f1'] for x in p.values()) / len(p) if p else 0.0, 'perClassOnDecided': p,
                   'coverage': dict(cov), 'confusion': {t: dict(pconf[t]) for t in truth}},
        'side': dict(side),
        'rows': out_rows,
    }


def load(root):
    runs = {}
    for gp in glob.glob(os.path.join(root, '**', 'observation-graph.json'), recursive=True):
        d = os.path.dirname(gp)
        h = ALIAS.get(os.path.basename(d), os.path.basename(d))
        rs = os.path.join(d, 'result-summary.json')
        sheets = None
        if os.path.exists(rs):
            src = json.load(open(rs)).get('sources')
            sheets = {s['byteHash']: s for s in src.get('sheets', [])} if src else None
        runs[h] = {'graph': json.load(open(gp)), 'sheets': sheets}
    return runs


def main(argv):
    rows = [r for f in argv[1].split(',') for r in json.load(open(f))['rows']]
    o = score(rows, load(argv[2]))
    print(f"N {o['n']}  graph macroF1 {o['graph']['macroF1']:.4f}  pixels macroF1 on decided {o['pixels']['macroF1OnDecided']:.4f}  pixel coverage {o['pixels']['coverage']}")
    for c, x in o['graph']['perClass'].items():
        px = o['pixels']['perClassOnDecided'].get(c)
        print(f"  {c:24s} n={x['n']:3d} graph P={x['precision']:.3f} R={x['recall']:.3f} F1={x['f1']:.3f}" + (f"  | pixels n={px['n']:3d} P={px['precision']:.3f} R={px['recall']:.3f} F1={px['f1']:.3f}" if px else ''))
    print('  side', o['side'])
    if len(argv) > 3:
        json.dump(o, open(argv[3], 'w'), indent=1)
    return o


if __name__ == '__main__':
    main(sys.argv)
