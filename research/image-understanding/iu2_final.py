"""IU-02 final evaluation (OFFLINE): the FROZEN IU-02 head and thresholds, and IU-01's frozen C2, on the same images.

    $PY iu2_final.py --sets FINAL_LOC,FINAL_SYNTH,FINAL_ARCHON,IU01_TEST [--out results/final.json]

Nothing here fits anything: the head, temperature and thresholds are read from $IU_WORK2/model (written by
iu2_train.py on DEV) and its SHA-256 must equal the value committed in the preregistration; IU-01's model is read
from $IU_WORK/model. Both see pixels only (no publisher metadata), so the comparison is like for like.

Reported per set: coverage (ACCEPT share), wrong accepted (Wilson 95 % and project-clustered bootstrap), every
non-elevation sent to the facade route by what it really was, single elevations routed / REVIEW / UNKNOWN, and the
confusion matrix of accepted decisions.
"""
import csv, hashlib, json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.paths import refuse_inside_repo, arg_value
from iu.backbones import offline_guard
from iu2 import data
import iu2_train as T

WORK2 = data.WORK2
IU01_CLASSES_MAP = {'EXTERIOR_PERSPECTIVE', 'FLOOR_PLAN', 'INTERIOR_PERSPECTIVE', 'ORTHOGRAPHIC_ELEVATION', 'OTHER', 'SITE_PLAN', 'TECHNICAL_SECTION'}


def wilson(k, n, z=1.96):
    if n == 0:
        return [None, None]
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(max(0.0, c - h), 4), round(min(1.0, c + h), 4)]


def cluster_boot(rows, stat, B=2000, seed=0):
    rng = np.random.default_rng(seed)
    projects = sorted({r['project'] for r in rows})
    by = {p: [r for r in rows if r['project'] == p] for p in projects}
    vals = []
    for _ in range(B):
        pick = [x for p in rng.choice(projects, len(projects), replace=True) for x in by[p]]
        v = stat(pick)
        if v is not None:
            vals.append(v)
    return [round(float(np.percentile(vals, 2.5)), 4), round(float(np.percentile(vals, 97.5)), 4)] if vals else [None, None]


def final_rows(sets):
    rows = []
    if 'FINAL_LOC' in sets:
        rows += [{**r, 'set': 'FINAL_LOC'} for r in data.loc() if r['split'] == 'FINAL']
    if 'FINAL_SYNTH' in sets:
        rows += [{**r, 'set': 'FINAL_SYNTH'} for r in data.synth(os.path.join(WORK2, 'synth-final'), 'FINAL', 'synthfinal')]
    if 'FINAL_ARCHON' in sets:
        lab = json.load(open(os.path.join(data.ROOT, 'data', 'labels-archon-final.json')))['rows']
        rows += [data._row(key=r['sha256'], tag='archonfinal', source='ARCHON', split='FINAL', project=r['project'], label=r['label'],
                           multiView=r.get('multiView', False), hard=r.get('hard', False), path=os.path.join(WORK2, 'archon-final', 'img', r['file']), set='FINAL_ARCHON')
                 for r in lab]
    if 'IU01_TEST' in sets:
        rows += [{**r, 'set': 'IU01_TEST'} for r in data.archon() if r['split'] == 'IU01_TEST']
    return rows


def iu01_decide(rows, embs):
    """IU-01 C2 exactly as frozen (iu_classify.py), pixels only: head, temperature, τ, novelty gate, tilt check."""
    from iu import probe, geometry_check
    from PIL import Image
    meta = json.load(open(os.path.join(data.WORK1, 'model', 'iu01-model.json')))
    W = np.load(os.path.join(data.WORK1, 'model', 'iu01-head.npz'))
    TR = np.load(os.path.join(data.WORK1, 'model', 'iu01-train-emb.npy'))
    E = np.array([embs[(r['tag'], 'mobilenetv3_large_100')][r['key']] for r in rows])
    cls_order = meta['classes']
    Z = E @ W['coef'].T + W['intercept']
    P = probe.softmax(Z, meta['temperature'])
    typ = np.sort(E @ TR.T, 1)[:, -5:].mean(1)
    out = []
    for i, r in enumerate(rows):
        j = int(P[i].argmax()); cls = cls_order[j]; conf = float(P[i, j])
        tau = meta['tauElevation'] if cls == data.ELEV else meta['tau']
        if conf < tau or cls == 'OTHER':
            out.append(('UNKNOWN', cls, 'LOW_CONFIDENCE_OR_OTHER')); continue
        f = geometry_check.features(Image.open(r['path']).convert('RGB'))
        gv = geometry_check.verdict(f, meta['geometry']['tOrtho'], meta['geometry']['tPersp'])
        if cls in (data.ELEV, 'FLOOR_PLAN', 'TECHNICAL_SECTION', 'SITE_PLAN') and gv == 'PERSPECTIVE_EVIDENT':
            out.append(('REVIEW', cls, 'GEOMETRY_PERSPECTIVE_CONFLICT')); continue
        if typ[i] < meta['typicalityThreshold']:
            out.append(('UNKNOWN', cls, 'OUT_OF_DISTRIBUTION')); continue
        out.append(('ACCEPT', cls, 'CONFIDENT'))
    return out, meta


def summarise(rows, dec):
    R = [dict(r, decision=d[0], predicted=d[1], reason=d[2]) for r, d in zip(rows, dec)]
    acc = [r for r in R if r['decision'] == 'ACCEPT']
    wrong = [r for r in acc if r['predicted'] != r['label']]
    routed = [r for r in acc if r['predicted'] == data.ELEV]
    unsafe = [r for r in routed if not r['routeTruth']]
    elev = [r for r in R if r['routeTruth']]
    conf = {}
    for r in R:
        col = r['predicted'] if r['decision'] == 'ACCEPT' else r['decision']
        conf.setdefault(r['label'], {}).setdefault(col, 0)
        conf[r['label']][col] += 1
    per_class = {}
    for c in data.CLASSES:
        n = sum(1 for r in R if r['label'] == c)
        tp = sum(1 for r in acc if r['label'] == c and r['predicted'] == c)
        asx = sum(1 for r in acc if r['predicted'] == c)
        per_class[c] = {'n': n, 'acceptedCorrect': tp, 'acceptedAsThis': asx, 'precision': round(tp / asx, 4) if asx else None,
                        'recall': round(tp / n, 4) if n else None, 'unknown': sum(1 for r in R if r['label'] == c and r['decision'] == 'UNKNOWN'),
                        'review': sum(1 for r in R if r['label'] == c and r['decision'] == 'REVIEW')}
    def risk(xs):
        a = [x for x in xs if x['decision'] == 'ACCEPT']
        return (sum(1 for x in a if x['predicted'] != x['label']) / len(a)) if a else None
    def cov(xs):
        return sum(1 for x in xs if x['decision'] == 'ACCEPT') / len(xs) if xs else None
    def unsafe_rate(xs):
        nr = [x for x in xs if not x['routeTruth']]
        return sum(1 for x in nr if x['decision'] == 'ACCEPT' and x['predicted'] == data.ELEV) / len(nr) if nr else None
    nonroute = [r for r in R if not r['routeTruth']]
    return {
        'n': len(R), 'projects': len({r['project'] for r in R}), 'accepted': len(acc), 'coverage': round(len(acc) / max(1, len(R)), 4),
        'coverageWilson': wilson(len(acc), len(R)), 'coverageProjectBootstrap': cluster_boot(R, cov),
        'review': sum(1 for r in R if r['decision'] == 'REVIEW'), 'unknown': sum(1 for r in R if r['decision'] == 'UNKNOWN'),
        'wrongAccepted': len(wrong), 'risk': round(len(wrong) / len(acc), 4) if acc else None, 'riskWilson': wilson(len(wrong), len(acc)),
        'riskProjectBootstrap': cluster_boot(R, risk),
        'facadeRouted': len(routed), 'unsafeRouted': len(unsafe), 'unsafeByTruth': {k: sum(1 for r in unsafe if (r.get('originalLabel') or r['label']) == k or (k == 'MULTI_VIEW' and r.get('multiView'))) for k in data.CLASSES + ['MULTI_VIEW']},
        'unsafeRateOfNonElevations': round(len(unsafe) / max(1, len(nonroute)), 4), 'unsafeRateWilson': wilson(len(unsafe), len(nonroute)),
        'unsafeRateProjectBootstrap': cluster_boot(R, unsafe_rate),
        'singleElevations': len(elev), 'elevationsRouted': sum(1 for r in elev if r['decision'] == 'ACCEPT' and r['predicted'] == data.ELEV),
        'elevationsReview': sum(1 for r in elev if r['decision'] == 'REVIEW'), 'elevationsUnknown': sum(1 for r in elev if r['decision'] == 'UNKNOWN'),
        'perClass': per_class, 'confusion': conf,
        'unsafeCases': [{'key': r['key'][:16], 'truth': r.get('originalLabel') or r['label'], 'multiView': r.get('multiView'), 'set': r['set']} for r in unsafe],
        'wrongCases': [{'key': r['key'][:16], 'truth': r['label'], 'predicted': r['predicted'], 'set': r['set']} for r in wrong][:80],
    }, R


def main():
    out = arg_value('--out', os.path.join(WORK2, 'results', 'final.json'))
    refuse_inside_repo(out, 'final results')
    offline_guard()
    sets = arg_value('--sets').split(',')
    meta = json.load(open(os.path.join(WORK2, 'model', 'iu02-model.json')))
    head_path = os.path.join(WORK2, 'model', 'iu02-head.npz')
    sha = hashlib.sha256(open(head_path, 'rb').read()).hexdigest()
    assert sha == meta['headSha256'], 'the head on disk is not the frozen one'
    expected = arg_value('--expect-head-sha256')
    if expected:
        assert sha == expected, f'head {sha} is not the preregistered {expected}'
    H = np.load(head_path)
    rows = final_rows(sets)
    tags = sorted({r['tag'] for r in rows})
    embs = {(t, b): T.load_emb(t, b) for t in tags for b in T.BACKBONES if os.path.exists(os.path.join(data.WORK1, 'emb', f'{t}-{b}-white.npz'))}
    geos = {t: T.load_geo(t) for t in tags}
    missing = [r for r in rows if r['key'] not in embs.get((r['tag'], 'mobilenetv3_large_100'), {}) or r['key'] not in geos[r['tag']] or 'f' not in geos[r['tag']][r['key']]]
    rows = [r for r in rows if r not in missing]
    X = T.matrix(rows, meta['features'], meta['backbone'], embs, geos)
    Z = (X - H['mean']) / H['scale'] @ H['coef'].T + H['intercept']
    P = T.softmax(Z, meta['temperature'])
    elev = data.CLASSES.index(data.ELEV)
    cand = {rows[i]['key'] for i in range(len(rows)) if P[i].argmax() == elev and P[i, elev] >= meta['tauElevation']}
    masked = T.masked_state(rows, cand)
    unm = lambda r: (geos[r['tag']][r['key']]['rec']['projection'] or {}).get('state')
    dec2 = T.decide(P, rows, meta['tau'], meta['tauElevation'], masked, unm)
    dec1, meta1 = iu01_decide(rows, embs)
    res = {'iu02Model': {k: meta[k] for k in ('modelId', 'headSha256', 'temperature', 'tau', 'tauElevation')}, 'iu01Model': {k: meta1[k] for k in ('modelId', 'sha256', 'tau', 'tauElevation', 'typicalityThreshold')},
           'missing': [{'key': r['key'][:16], 'set': r['set']} for r in missing], 'sets': {}}
    per_image = []
    for s in sets + ['ALL']:
        idx = [i for i, r in enumerate(rows) if s == 'ALL' or r['set'] == s]
        if not idx:
            continue
        sub = [rows[i] for i in idx]
        a1, R1 = summarise(sub, [dec1[i] for i in idx])
        a2, R2 = summarise(sub, [dec2[i] for i in idx])
        res['sets'][s] = {'IU01_C2': a1, 'IU02': a2}
        if s != 'ALL':
            for r1, r2 in zip(R1, R2):
                per_image.append({'set': s, 'key': r1['key'][:16], 'project': r1['project'], 'truth': r1['label'], 'multiView': r1.get('multiView'), 'routeTruth': r1['routeTruth'],
                                  'iu01': f"{r1['decision']}:{r1['predicted']}", 'iu02': f"{r2['decision']}:{r2['predicted']}", 'iu02Reason': r2['reason']})
        print(s, 'IU01', {k: a1[k] for k in ('n', 'coverage', 'risk', 'unsafeRouted', 'elevationsRouted', 'singleElevations')},
              '| IU02', {k: a2[k] for k in ('n', 'coverage', 'risk', 'unsafeRouted', 'elevationsRouted', 'singleElevations')}, flush=True)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(res, open(out, 'w'), indent=1)
    with open(out.replace('.json', '-per-image.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(per_image[0].keys())); w.writeheader(); w.writerows(per_image)


if __name__ == '__main__':
    main()
