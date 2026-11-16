"""v3.54.3 tables: per house A0 / A1 / C, from the run directories (no publisher picture is read).

  /usr/bin/python3 -I tables.py --dev <list> <C dir> [<C dir> ...] --a0 <dir> [<dir> ...] --refs <dir> [...]   -> JSON
  /usr/bin/python3 -I tables.py --confirm <list> <C dir> --refs <refs-confirm dir>                               -> JSON

A0 is the pinned base's run directory of the same house (v3.54.2). A1 is the `local` state inside the same house's C
run: `consultAnalysis` builds it first, with no consultant, and the C run records its model hash. C is `final`.
Sizes: v3542/score.py on DEV (v3.54.1 references, with outline IoU), confirm_score.py on CONFIRM8 (printed dimensions).
Roof features: roof_features.py. Axes: the run's own `sourceCheck.axes` — what the product itself says of its result.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'v3542'))
import roof_features as rf  # noqa: E402
from score import find_ref, score_run  # noqa: E402
from confirm_score import score_house  # noqa: E402


def args_after(flag):
    if flag not in sys.argv:
        return []
    i = sys.argv.index(flag) + 1
    out = []
    while i < len(sys.argv) and not sys.argv[i].startswith('--'):
        out.append(sys.argv[i])
        i += 1
    return out


def houses(lst):
    return [l.split()[0] for l in open(lst) if len(l.split()) >= 3]


def run_dir(h, dirs):
    for d in reversed(dirs):  # the last directory given wins: a later run of the same house supersedes an earlier one
        if os.path.exists(os.path.join(d, h, 'consult.json')) or os.path.exists(os.path.join(d, h, 'model.json')) or os.path.exists(os.path.join(d, h, 'failure.json')):
            return os.path.join(d, h)
    return None


def state(s):
    if not s:
        return None
    return {'outcome': s.get('outcome'), 'reason': s.get('reasonCode') or s.get('firstFailure') or s.get('code'), 'modelHash': (s.get('modelHash') or '')[:12] or None, 'confidence': (s.get('metric') or {}).get('confidence'), 'relation': (s.get('metric') or {}).get('relation'),
            'outline': None if not s.get('outline') else {a: s['outline'][a]['status'] for a in ('x', 'y')}}


def a0_of(h, dirs):
    d = run_dir(h, dirs)
    if d is None:
        return None
    if os.path.exists(os.path.join(d, 'result-summary.json')):
        return {'outcome': 'COMPLETED', 'modelHash': json.load(open(os.path.join(d, 'result-summary.json'))).get('modelHash', '')[:12], 'dir': d}
    if os.path.exists(os.path.join(d, 'failure.json')):
        f = json.load(open(os.path.join(d, 'failure.json')))
        return {'outcome': 'FAILED', 'reason': f"{f.get('code')}/{(f.get('diagnostics') or {}).get('firstFailure')}", 'dir': d}
    return {'outcome': 'UNKNOWN', 'dir': d}


def loop_of(c):
    sc = c.get('sourceCheck') or {}
    return {
        'metricRounds': [r.get('decision') for r in (c.get('consultation') or {}).get('metricRounds', [])],
        'boundary': (c.get('consultation') or {}).get('boundary'),
        'looks': [f"{g.get('decision')}[{g.get('status')}]" for g in c.get('geometry') or []],
        'corrections': [{k: x.get(k) for k in ('operation', 'targetId', 'featureId', 'state', 'code', 'review')} for x in sc.get('corrections') or []],
        'features': [f.get('id') for f in c.get('roofFeatures') or []],
        'axes': sc.get('axes'),
        'knownDefects': [d.get('code') for d in sc.get('knownDefects') or []],
        'sourceCheck': sc.get('status'),
        'usd': c.get('usd'), 'liveCalls': c.get('liveCalls'), 'replayed': c.get('replayedAnswers'), 'seconds': round((c.get('ms') or 0) / 1000),
    }


rows = []
if '--dev' in sys.argv:
    lst, *cdirs = args_after('--dev')
    a0dirs, refs = args_after('--a0'), args_after('--refs')
    devroof = json.load(open(os.path.join(HERE, 'refs-dev', 'roof-features-dev.json')))['houses']
    for h in houses(lst):
        d = run_dir(h, cdirs)
        c = json.load(open(os.path.join(d, 'consult.json'))) if d and os.path.exists(os.path.join(d, 'consult.json')) else None
        ref = find_ref(h, refs)
        a0 = a0_of(h, a0dirs)
        row = {'house': h, 'A0': a0, 'A1': state(c.get('local')) if c else None, 'C': state(c.get('final')) if c else None}
        if a0 and ref:
            row['A0score'] = score_run(a0['dir'], ref)
        if d and ref:
            row['Cscore'] = score_run(d, ref)
        if c:
            row['A1equalsA0'] = (row['A1']['modelHash'] == a0.get('modelHash') if a0 and a0['outcome'] == 'COMPLETED' else (row['A1']['outcome'] != 'COMPLETED' if a0 else None))
            row['loop'] = loop_of(c)
        mp = os.path.join(d, 'model.json') if d else None
        if mp and os.path.exists(mp) and h in devroof:
            row['roof'] = rf.score(json.load(open(mp)), devroof[h])
        rows.append(row)
else:
    lst, cdir = args_after('--confirm')
    refs = args_after('--refs')
    for h in houses(lst):
        d = os.path.join(cdir, h)
        ref = find_ref(h, refs)
        c = json.load(open(os.path.join(d, 'consult.json'))) if os.path.exists(os.path.join(d, 'consult.json')) else None
        row = {'house': h, 'publisher': ref.get('publisher'), 'category': ref.get('category'), 'A1': state(c.get('local')) if c else None, 'C': state(c.get('final')) if c else None, 'score': score_house(d, ref)}
        if c:
            row['loop'] = loop_of(c)
        rows.append(row)
print(json.dumps(rows, indent=1))
