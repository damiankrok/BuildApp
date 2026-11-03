"""SOURCE-01 (research): fit the linear content head on DEV embeddings computed by the production path (embed.ts).
Grouped 5-fold CV by house family picks C and measures the veto rule; then the head is fitted on all DEV and written
as JSON for packages/source-analyzer/src/content-head.json. TEST is not read here.
  $PY fit_head.py <dataset.json> <emb.bin> <head-out.json> <cv-report.json>"""
import json, sys
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler
ds, emb_path, head_out, cv_out = sys.argv[1:5]
rows = json.load(open(ds))['rows']; meta = json.load(open(emb_path + '.json'))
E = np.fromfile(emb_path, dtype=np.float32).reshape(-1, 1280); assert meta['sha256'] == [r['sha256'] for r in rows]
MAP = {'FLOOR_PLAN': 'FLOOR_PLAN', 'ORTHOGRAPHIC_ELEVATION': 'ELEVATION', 'TECHNICAL_SECTION': 'SECTION', 'SITE_PLAN': 'SITE_PLAN', 'EXTERIOR_PERSPECTIVE': 'EXTERIOR_PERSPECTIVE', 'INTERIOR_PERSPECTIVE': 'INTERIOR'}
CLASSES = ['FLOOR_PLAN', 'ELEVATION', 'SECTION', 'SITE_PLAN', 'EXTERIOR_PERSPECTIVE', 'INTERIOR']
dev = [i for i, r in enumerate(rows) if r['split'] == 'DEV']
X = E[dev]; y = np.array([CLASSES.index(MAP[rows[i]['label']]) for i in dev]); g = np.array([rows[i]['family'] for i in dev])
def fit(Xa, ya, C):
    sc = StandardScaler().fit(Xa); m = LogisticRegression(C=C, max_iter=5000, class_weight='balanced').fit(sc.transform(Xa), ya); return sc, m
report = {}
for C in [0.01, 0.05, 0.2, 1.0]:
    P = np.zeros((len(y), len(CLASSES)))
    for tr, te in GroupKFold(5).split(X, y, g):
        sc, m = fit(X[tr], y[tr], C); P[te] = m.predict_proba(sc.transform(X[te]))
    pred = P.argmax(1); err = int((pred != y).sum())
    # veto rule on OOF: an image of true class t, claimed (adversarially) as any other reader's content c != t:
    # vetoed when P[c] <= 0.05 and max P >= 0.9; and claimed as its own class: wrongly vetoed when P[t] <= 0.05 and max>=0.9
    wrong_veto = int(sum((P[k, y[k]] <= 0.05) and (P[k].max() >= 0.9) for k in range(len(y))))
    adv_total = adv_vetoed = 0
    for k in range(len(y)):
        for c in range(len(CLASSES)):
            if c == y[k] or CLASSES[c] == 'INTERIOR': continue
            adv_total += 1; adv_vetoed += int(P[k, c] <= 0.05 and P[k].max() >= 0.9)
    low = int((P.max(1) < 0.9).sum())
    report[str(C)] = {'errors': err, 'n': len(y), 'wronglyVetoedWhenCaptionRight': wrong_veto, 'adversarialVetoed': f'{adv_vetoed}/{adv_total}', 'belowConfidence': low}
    print(C, report[str(C)], flush=True)
best = min(report, key=lambda c: (report[c]['wronglyVetoedWhenCaptionRight'], report[c]['errors'], -int(report[c]['adversarialVetoed'].split('/')[0])))
C = float(best); sc, m = fit(X, y, C)
head = {'schema': 'buildapp.image-content-head', 'version': '1', 'encoderSha256': 'b545c9b86c26a94d509f98c946d3b21ef69124f41c5dbfd1811faf61b82a7fdb', 'classes': CLASSES,
        'mean': [round(float(v), 6) for v in sc.mean_], 'scale': [round(float(v), 6) for v in sc.scale_],
        'weights': [[round(float(v), 6) for v in row] for row in m.coef_], 'bias': [round(float(v), 6) for v in m.intercept_],
        'provenance': {'fittedOn': f'{len(y)} DEV images of {len(set(g))} house families (ARCHON; the eight regression houses included, the ten TEST houses excluded by family)', 'labels': 'agent labels by SHA-256 (IU-01/02/03 and SOURCE-01), not OWNER-verified', 'model': f'standardise, then multinomial logistic regression, C={C}, class_weight=balanced', 'selection': 'C chosen by grouped 5-fold CV over house families on DEV only', 'cv': report[best]}}
json.dump(head, open(head_out, 'w')); json.dump({'chosenC': C, 'grid': report}, open(cv_out, 'w'), indent=1)
print('chosen C', C)
