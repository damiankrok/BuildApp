"""IU-02 training on DEV only (OFFLINE): choose the head by how it predicts a *style it has not seen*, calibrate,
choose thresholds, fit the final head, and write the frozen artifact (outside the repository).

Leave-one-source-out (LOSO) over the DEV styles {ARCHON, SYNTH, LOC, COMMONS}: the head is fitted on three and
predicts the fourth. Candidates: backbone ∈ {MobileNetV3, DINOv2-S, CLIP B/32} × features ∈ {EMB, GEO, EMB+GEO}
× C. The winner minimises the mean (over held-out sources, unweighted) log-loss. Temperature and thresholds come from
the pooled LOSO out-of-source predictions, so they describe behaviour on an unseen style, not on the training style.

Decision (per image), pixels only:
  head → class c, calibrated p.
  c = ELEVATION and p ≥ τE → segmentation → projection inside the building:
        ORTHOGRAPHIC_SUPPORTED → ACCEPT (facade route); PERSPECTIVE_EVIDENT → REVIEW (conflict); else REVIEW.
  c ≠ ELEVATION and p ≥ τ → ACCEPT c (never the facade route); a plan/section/site plan whose unmasked projection is
        PERSPECTIVE_EVIDENT → REVIEW.
  otherwise UNKNOWN.
τE is the smallest grid value at which no out-of-source non-elevation (or multi-view sheet) is routed; τ the
smallest at which the out-of-source selective risk of the other classes is ≤ 2 %.

    $PY iu2_train.py            # writes $IU_WORK2/model/iu02-head.npz, iu02-model.json, results/dev-loso.json
"""
import hashlib, json, os, sys, time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.paths import refuse_inside_repo
from iu.backbones import offline_guard
from iu2 import data, features

WORK2 = data.WORK2
BACKBONES = ['mobilenetv3_large_100', 'dinov2_vits14', 'clip_vitb32']
SOURCES = ['ARCHON', 'SYNTH', 'LOC', 'COMMONS']
CS = [0.03, 0.1, 0.3, 1.0]
TAU_GRID = [round(x, 2) for x in np.arange(0.30, 0.995, 0.01)]
RISK = 0.02


def load_emb(tag, bid):
    z = np.load(os.path.join(data.WORK1, 'emb', f'{tag}-{bid}-white.npz'))
    return {str(s): e for s, e in zip(z['sha'], z['emb'])}


def load_geo(tag):
    return json.load(open(os.path.join(WORK2, 'geo', f'{tag}.json')))


def matrix(rows, kind, bid, embs, geos):
    X = []
    for r in rows:
        parts = []
        if kind in ('EMB', 'EMB+GEO'):
            parts.append(embs[(r['tag'], bid)][r['key']])
        if kind in ('GEO', 'EMB+GEO'):
            parts.append(np.array(geos[r['tag']][r['key']]['f'], np.float32))
        X.append(np.concatenate(parts))
    return np.array(X, np.float32)


def fit(X, y, C):
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    sc = StandardScaler().fit(X)
    m = LogisticRegression(C=C, class_weight='balanced', max_iter=3000).fit(sc.transform(X), y)
    return sc, m


def logits(sc, m, X):
    z = m.decision_function(sc.transform(X))
    out = np.full((len(X), len(data.CLASSES)), -1e9)
    for j, c in enumerate(m.classes_):
        out[:, int(c)] = z[:, j]
    return out


def softmax(z, T=1.0):
    z = z / T
    z = z - z.max(1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(1, keepdims=True)


def nll(P, y):
    return float(-np.mean(np.log(np.clip(P[np.arange(len(y)), y], 1e-12, 1))))


def masked_state(rows, keys_needed):
    """Projection inside the building mask, cached per image (segmentation is the slow part)."""
    from iu2 import pipeline, clean
    from iu2.projection import analyse
    path = os.path.join(WORK2, 'geo', 'masked.json')
    cache = json.load(open(path)) if os.path.exists(path) else {}
    w = os.path.join(data.WORK1, 'weights', 'iu02')
    todo = [r for r in rows if r['key'] in keys_needed and r['key'] not in cache]
    for k, r in enumerate(todo):
        rgb, meta = pipeline.load(r['path'])
        s = pipeline.segment(rgb, w)
        filled, _ = clean.building_support(s)
        p = analyse(rgb, mask=filled if filled.any() else None)
        cache[r['key']] = {'state': p['state'], 'why': p.get('why'), 'segmenter': s['method']}
        if k % 20 == 19:
            json.dump(cache, open(path, 'w')); print('masked', k + 1, 'of', len(todo), flush=True)
    json.dump(cache, open(path, 'w'))
    return cache


def decide(P, rows, tau, tau_e, masked, unmasked_state):
    out = []
    for p, r in zip(P, rows):
        c = int(p.argmax()); conf = float(p[c]); cls = data.CLASSES[c]
        if cls == data.ELEV:
            if conf < tau_e:
                out.append(('UNKNOWN', cls, 'LOW_CONFIDENCE')); continue
            st = (masked.get(r['key']) or {}).get('state', 'NOT_MEASURED')
            out.append(('ACCEPT', cls, 'ORTHOGRAPHIC_SUPPORTED') if st == 'ORTHOGRAPHIC_SUPPORTED' else ('REVIEW', cls, f'GEOMETRY_{st}'))
        else:
            if conf < tau:
                out.append(('UNKNOWN', cls, 'LOW_CONFIDENCE')); continue
            if cls in ('FLOOR_PLAN', 'TECHNICAL_SECTION', 'SITE_PLAN') and unmasked_state(r) == 'PERSPECTIVE_EVIDENT':
                out.append(('REVIEW', cls, 'GEOMETRY_PERSPECTIVE_CONFLICT')); continue
            out.append(('ACCEPT', cls, 'CONFIDENT'))
    return out


def main():
    refuse_inside_repo(WORK2, 'IU-02 model')
    offline_guard()
    t0 = time.time()
    rows = data.dev_rows()
    tags = sorted({r['tag'] for r in rows})
    embs = {(t, b): load_emb(t, b) for t in tags for b in BACKBONES}
    geos = {t: load_geo(t) for t in tags}
    rows = [r for r in rows if all(r['key'] in embs[(r['tag'], b)] for b in BACKBONES) and 'f' in geos[r['tag']].get(r['key'], {})]
    y = np.array([data.CLASSES.index(r['label']) for r in rows])
    src = np.array([r['source'] for r in rows])
    print('DEV rows', len(rows), {s: int((src == s).sum()) for s in SOURCES})
    results = []
    best = None
    for kind in ('GEO', 'EMB', 'EMB+GEO'):
        for bid in (BACKBONES if kind != 'GEO' else [None]):
            X = matrix(rows, kind, bid, embs, geos)
            for C in CS:
                Z = np.zeros((len(rows), len(data.CLASSES)))
                for s in SOURCES:
                    tr, te = src != s, src == s
                    sc, m = fit(X[tr], y[tr], C)
                    Z[te] = logits(sc, m, X[te])
                per = {s: nll(softmax(Z[src == s]), y[src == s]) for s in SOURCES}
                acc = {s: float((Z[src == s].argmax(1) == y[src == s]).mean()) for s in SOURCES}
                rec = {'features': kind, 'backbone': bid, 'C': C, 'losoNll': per, 'losoAcc': acc, 'meanNll': float(np.mean(list(per.values()))), 'meanAcc': float(np.mean(list(acc.values())))}
                results.append(rec)
                print(kind, bid, C, round(rec['meanNll'], 3), {k: round(v, 3) for k, v in acc.items()}, flush=True)
                if best is None or rec['meanNll'] < best[0]['meanNll']:
                    best = (rec, Z.copy())
    rec, Z = best
    print('selected', rec['features'], rec['backbone'], rec['C'])
    # temperature on pooled out-of-source logits
    Ts = np.exp(np.linspace(np.log(0.2), np.log(5), 60))
    T = float(min(Ts, key=lambda t: nll(softmax(Z, t), y)))
    P = softmax(Z, T)
    route_truth = np.array([r['routeTruth'] for r in rows])
    pred = P.argmax(1)
    elev = data.CLASSES.index(data.ELEV)
    cand = {rows[i]['key'] for i in range(len(rows)) if pred[i] == elev and P[i, elev] >= 0.3}
    masked = masked_state(rows, cand)
    unm = lambda r: (geos[r['tag']][r['key']]['rec']['projection'] or {}).get('state')
    # τE: no out-of-source non-route image routed
    tau_e = None
    for t in TAU_GRID:
        dec = decide(P, rows, 1.01, t, masked, unm)
        bad = sum(1 for d, r in zip(dec, rows) if d[0] == 'ACCEPT' and d[1] == data.ELEV and not r['routeTruth'])
        if bad == 0:
            tau_e = t; break
    # τ: other classes, selective risk ≤ RISK
    tau = None
    for t in TAU_GRID:
        dec = decide(P, rows, t, 1.01, masked, unm)
        acc = [(d[1] == r['label']) for d, r in zip(dec, rows) if d[0] == 'ACCEPT' and d[1] != data.ELEV]
        if acc and 1 - np.mean(acc) <= RISK:
            tau = t; break
    tau_e = tau_e if tau_e is not None else 1.01
    tau = tau if tau is not None else 1.01
    dec = decide(P, rows, tau, tau_e, masked, unm)
    summary = {}
    for s in SOURCES + ['ALL']:
        idx = [i for i in range(len(rows)) if s == 'ALL' or rows[i]['source'] == s]
        acc_idx = [i for i in idx if dec[i][0] == 'ACCEPT']
        summary[s] = {'n': len(idx), 'accepted': len(acc_idx), 'coverage': round(len(acc_idx) / max(1, len(idx)), 4),
                      'wrongAccepted': sum(1 for i in acc_idx if dec[i][1] != rows[i]['label']),
                      'routed': sum(1 for i in acc_idx if dec[i][1] == data.ELEV),
                      'unsafeRouted': sum(1 for i in acc_idx if dec[i][1] == data.ELEV and not rows[i]['routeTruth']),
                      'elevations': sum(1 for i in idx if rows[i]['routeTruth']),
                      'elevationsRouted': sum(1 for i in acc_idx if dec[i][1] == data.ELEV and rows[i]['routeTruth'])}
    print('LOSO decisions', json.dumps(summary))
    # final head on all DEV
    X = matrix(rows, rec['features'], rec['backbone'], embs, geos)
    sc, m = fit(X, y, rec['C'])
    mdir = os.path.join(WORK2, 'model'); os.makedirs(mdir, exist_ok=True)
    coef = np.zeros((len(data.CLASSES), X.shape[1])); icpt = np.full(len(data.CLASSES), -1e9)
    for j, c in enumerate(m.classes_):
        coef[int(c)] = m.coef_[j]; icpt[int(c)] = m.intercept_[j]
    np.savez(os.path.join(mdir, 'iu02-head.npz'), coef=coef, intercept=icpt, mean=sc.mean_, scale=sc.scale_)
    meta = {'modelId': f"iu02-{rec['features']}-{rec['backbone']}-logreg", 'features': rec['features'], 'backbone': rec['backbone'], 'C': rec['C'],
            'geoFeatureNames': features.NAMES, 'classes': data.CLASSES, 'temperature': T, 'tau': tau, 'tauElevation': tau_e,
            'segmenter': 'UPERNET (render/photo) / CLASSIC (drawing)', 'trainedOn': {s: int((src == s).sum()) for s in SOURCES},
            'selection': 'leave-one-source-out mean log-loss', 'riskTarget': RISK}
    meta['headSha256'] = hashlib.sha256(open(os.path.join(mdir, 'iu02-head.npz'), 'rb').read()).hexdigest()
    json.dump(meta, open(os.path.join(mdir, 'iu02-model.json'), 'w'), indent=1)
    os.makedirs(os.path.join(WORK2, 'results'), exist_ok=True)
    json.dump({'candidates': results, 'selected': rec, 'temperature': T, 'tau': tau, 'tauElevation': tau_e, 'losoDecisions': summary,
               'losoPerImage': [{'key': r['key'], 'source': r['source'], 'label': r['label'], 'routeTruth': r['routeTruth'], 'decision': d[0], 'class': d[1], 'reason': d[2],
                                 'p': round(float(P[i].max()), 4)} for i, (r, d) in enumerate(zip(rows, dec))],
               'seconds': round(time.time() - t0, 1)}, open(os.path.join(WORK2, 'results', 'dev-loso.json'), 'w'), indent=1)
    print('model', meta['modelId'], 'T', round(T, 3), 'tau', tau, 'tauE', tau_e, 'sha', meta['headSha256'][:16])


if __name__ == '__main__':
    main()
