"""IU-01 evaluation: approaches A (production metadata rules), B0 (CLIP zero-shot), B (frozen backbone + linear head)
and C (fusion of B with metadata and the model-free geometric check), on exactly the same TEST images.

Everything that is fitted — the linear heads, C, the temperature, the decision thresholds and the geometric
thresholds — reads TRAIN or VAL only. TEST is read once, at the end, by `score()`. Runs offline.

  python evaluate.py            # writes $IU_WORK/results/*.json and the per-image tables
"""
import csv, json, os, sys, time, hashlib
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.paths import refuse_inside_repo
refuse_inside_repo(os.environ.get('IU_WORK', '/home/user/workiu01'), 'results, per-image records and the model artifact')
from iu.backbones import offline_guard
offline_guard()
import numpy as np
from iu.classes import CLASSES, FACADE_HAZARD, PROJECTION
from iu.corpus import load_archon, load_commons, load_synth005r, REPO
from iu import probe, geometry_check

WORK = os.environ.get('IU_WORK', '/home/user/workiu01')
IMG = os.environ.get('IU_ARCHON_IMAGES', '/home/user/work005r/corpus/images')
OUT = os.path.join(WORK, 'results'); os.makedirs(OUT, exist_ok=True)
BACKBONES = ['mobilenetv3_large_100', 'dinov2_vits14', 'clip_vitb32']
MODEL_VERSION = 'iu01-probe-v1'
ELEV = 'ORTHOGRAPHIC_ELEVATION'
PERSPECTIVES = {'INTERIOR_PERSPECTIVE', 'EXTERIOR_PERSPECTIVE'}

# ---------------------------------------------------------------------------------------------------------------
# rows
# ---------------------------------------------------------------------------------------------------------------
base = load_archon(IMG)
derived = json.load(open(os.path.join(WORK, 'derived-manifest.json')))['rows']
commons = load_commons(os.path.join(WORK, 'commons'))
synth = list({r['sha256']: r for r in load_synth005r(os.environ.get('IU_SYNTH005R', '/home/user/work005r/synth/images'))}.values())
by_sha = {r['sha256']: r for r in base}
for d in derived:
    d['source'] = 'derived'
    d['hard'] = False
for c in commons:
    c.setdefault('hard', False)

# production metadata (approach A) — the 005R V0a run of the unchanged production acquisition on these bytes
v0 = {r['assetId']: r for r in json.load(open(os.path.join(REPO, 'stage-reports/artifacts/analyzer-005r/contenders/V0a-routes.json')))['rows']}
A_MAP = {'ELEVATION': ELEV, 'FLOOR_PLAN': 'FLOOR_PLAN', 'SECTION': 'TECHNICAL_SECTION', 'SITE_PLAN': 'SITE_PLAN',
         # production has no interior/exterior split; every PERSPECTIVE_RENDER is consumed as an exterior picture
         # (camera solver, reconstruct-v2.ts:1950), so that is the class it effectively assigns
         'PERSPECTIVE_RENDER': 'EXTERIOR_PERSPECTIVE'}

def metadata_of(r):
    """Publisher metadata as production reads it: document role + view claims. None when there is none."""
    src = r if r['source'] == 'archon' else by_sha.get((r.get('parents') or [''])[0]) if (r.get('derived') or '').startswith('resize') else None
    if not src:
        return None
    m = v0[src['assetId']]
    return {'document': m['v0Document'], 'views': m.get('v0Views') or []}

def predict_A(r):
    m = metadata_of(r)
    return A_MAP.get(m['document'], 'UNKNOWN') if m else 'UNKNOWN'

# ---------------------------------------------------------------------------------------------------------------
# embeddings
# ---------------------------------------------------------------------------------------------------------------
def load_emb(bid, pad):
    out = {}
    for tag in ('corpus', 'derived', 'commons', 'synth005r'):
        p = os.path.join(WORK, 'emb', f'{tag}-{bid}-{pad}.npz')
        if os.path.exists(p):
            z = np.load(p)
            out.update(dict(zip(z['sha'].tolist(), z['emb'])))
    return out

geo = {}
for f in ('geo-corpus.json', 'geo-commons.json', 'geo-synth005r.json'):
    p = os.path.join(WORK, f)
    if os.path.exists(p):
        geo.update(json.load(open(p)))

rows_all = base + derived + commons + synth
def part(split, kinds=('archon',), derived_kinds=None):
    out = [r for r in rows_all if r['split'] == split and r['source'] in kinds]
    if derived_kinds is not None:
        out += [r for r in rows_all if r['split'] == split and r['source'] == 'derived' and r['derived'] in derived_kinds]
    return out

TRAIN = part('TRAIN', derived_kinds={'collage2x2', 'collage1x2', 'simplified_line', 'simplified_flat'})
VAL = part('VAL', derived_kinds={'collage2x2', 'collage1x2', 'simplified_line', 'simplified_flat'})
TEST = part('TEST')                       # the headline set: real publisher images of 7 unseen projects
TEST_SYN = part('TEST', kinds=(), derived_kinds={'collage2x2', 'collage1x2', 'simplified_line', 'simplified_flat'})
TEST_RES = part('TEST', kinds=(), derived_kinds={'resize400', 'resize1200'})
OOD = [r for r in commons if r.get('label') and r['path']]
assert not ({r['project'] for r in TRAIN} & {r['project'] for r in TEST}), 'project leak TRAIN/TEST'
assert not ({r['project'] for r in VAL} & {r['project'] for r in TEST}), 'project leak VAL/TEST'
assert not ({r['project'] for r in TRAIN} & {r['project'] for r in VAL}), 'project leak TRAIN/VAL'

yidx = lambda rows: np.array([CLASSES.index(r['label']) for r in rows])

# ---------------------------------------------------------------------------------------------------------------
# B: linear heads, C and temperature on VAL
# ---------------------------------------------------------------------------------------------------------------
heads = {}
val_report = {}
OOF = {}  # out-of-fold TRAIN probabilities per backbone (calibration + thresholds)
for bid in BACKBONES:
    ew, eg = load_emb(bid, 'white'), load_emb(bid, 'gray')
    if not ew:
        continue
    Xtr = np.concatenate([np.stack([ew[r['sha256']] for r in TRAIN]), np.stack([eg[r['sha256']] for r in TRAIN])])
    ytr = [r['label'] for r in TRAIN] * 2
    Xva = np.stack([ew[r['sha256']] for r in VAL]); yva = yidx(VAL)
    best = None
    for C in (0.1, 0.3, 1, 3, 10, 30):
        m = probe.fit(Xtr, ytr, C)
        z = probe.logits(m, Xva)
        ll = probe.nll(probe.softmax(z), yva)
        if best is None or ll < best[0]:
            best = (ll, C, m, z)
    ll, C, m, z = best
    # Calibration set = project-grouped out-of-fold predictions on TRAIN + the VAL predictions. VAL alone is
    # separable for every backbone (0 errors), and a temperature fitted on a set with no errors runs to the edge of
    # its grid and reports certainty it has not earned.
    from sklearn.model_selection import GroupKFold
    groups = np.array([r['project'] for r in TRAIN])
    ztr = np.zeros((len(TRAIN), len(CLASSES)))
    Xw = np.stack([ew[r['sha256']] for r in TRAIN]); Xg = np.stack([eg[r['sha256']] for r in TRAIN]); yl = np.array([r['label'] for r in TRAIN])
    for tr_i, te_i in GroupKFold(n_splits=5).split(Xw, yl, groups):
        mf = probe.fit(np.concatenate([Xw[tr_i], Xg[tr_i]]), list(yl[tr_i]) * 2, C)
        ztr[te_i] = probe.logits(mf, Xw[te_i])
    zcal = np.concatenate([ztr, z]); ycal = np.concatenate([yidx(TRAIN), yva])
    T = probe.fit_temperature(zcal, ycal)
    OOF[bid] = probe.softmax(ztr, T)
    p = probe.softmax(z, T)
    pred = p.argmax(1)
    f1 = []
    for k in range(len(CLASSES)):
        tp = ((pred == k) & (yva == k)).sum(); fp = ((pred == k) & (yva != k)).sum(); fn = ((pred != k) & (yva == k)).sum()
        if (yva == k).sum():
            f1.append(2 * tp / max(1, 2 * tp + fp + fn))
    heads[bid] = {'model': m, 'C': C, 'T': T, 'ew': ew, 'eg': eg}
    val_report[bid] = {'C': C, 'temperature': round(T, 4), 'valNll': round(probe.nll(p, yva), 4), 'valAcc': round(float((pred == yva).mean()), 4), 'valMacroF1': round(float(np.mean(f1)), 4), 'valEce': round(probe.ece(p, yva), 4),
                       'oofTrainAcc': round(float((OOF[bid].argmax(1) == yidx(TRAIN)).mean()), 4), 'oofTrainErrors': int((OOF[bid].argmax(1) != yidx(TRAIN)).sum()), 'temperatureAtGridEdge': T <= 0.051 or T >= 19.9}
    print('VAL', bid, val_report[bid], flush=True)

# preregistered selection rule: the backbone with the best VAL macro-F1 becomes "B" and the base of "C"
BEST = max(val_report, key=lambda b: val_report[b]['valMacroF1'])
print('selected backbone', BEST, flush=True)

def probs(bid, rows, pad='white'):
    h = heads[bid]
    e = h['ew'] if pad == 'white' else h['eg']
    X = np.stack([e[r['sha256']] for r in rows])
    return probe.softmax(probe.logits(h['model'], X), h['T'])

# B0: CLIP zero-shot, temperature also fitted on VAL
zs = None
try:
    from iu.backbones import load
    from iu import zeroshot
    _, cmeta = load('clip_vitb32')
    TM = zeroshot.text_matrix(cmeta)
    ewc = load_emb('clip_vitb32', 'white')
    zva = zeroshot.logits(np.stack([ewc[r['sha256']] for r in VAL]), TM)
    Tz = probe.fit_temperature(zva, yidx(VAL))
    zs = {'TM': TM, 'T': Tz, 'e': ewc}
except Exception as e:  # recorded, not hidden: the report states B0 was not run
    print('zero-shot unavailable:', e)
def probs_zs(rows):
    return probe.softmax(zeroshot.logits(np.stack([zs['e'][r['sha256']] for r in rows]), zs['TM']), zs['T'])

# ---------------------------------------------------------------------------------------------------------------
# geometric thresholds from TRAIN only
# ---------------------------------------------------------------------------------------------------------------
tilt = lambda rows, cls: np.array([geo[r['sha256']]['tiltRatio'] for r in rows if r['label'] == cls and r['source'] == 'archon'])
G_ORTHO = float(np.percentile(tilt(TRAIN, 'EXTERIOR_PERSPECTIVE'), 5))   # below this, consistent with orthographic
G_PERSP = float(np.percentile(tilt(TRAIN, ELEV), 99))                    # above this, no TRAIN elevation ever reached
GEO = {'tOrtho': round(G_ORTHO, 4), 'tPersp': round(G_PERSP, 4), 'fittedOn': 'TRAIN archon images'}
print('geometry thresholds', GEO)
def geo_verdict(r):
    g = geo.get(r['sha256'])
    return geometry_check.verdict(g, G_ORTHO, G_PERSP) if g else 'NOT_MEASURED'

# ---------------------------------------------------------------------------------------------------------------
# decisions
# ---------------------------------------------------------------------------------------------------------------
META_COMPAT = {'ELEVATION': {ELEV}, 'FLOOR_PLAN': {'FLOOR_PLAN'}, 'SECTION': {'TECHNICAL_SECTION'}, 'SITE_PLAN': {'SITE_PLAN'},
               'PERSPECTIVE_RENDER': PERSPECTIVES}

def decide_B(p, tau, tau_elev):
    k = int(p.argmax()); c = float(p[k]); cls = CLASSES[k]
    if c < (tau_elev if cls == ELEV else tau):
        return 'UNKNOWN', cls, 'LOW_CONFIDENCE'
    if cls == 'OTHER':
        return 'UNKNOWN', cls, 'NOT_A_SINGLE_VIEW'
    return 'ACCEPT', cls, 'CONFIDENT'

def decide_C(p, r, tau, tau_elev):
    """Fusion. Metadata and geometry can only DOWNGRADE a model decision (ACCEPT -> REVIEW), never create one."""
    dec, cls, why = decide_B(p, tau, tau_elev)
    reasons = [why]
    m = metadata_of(r)
    g = geo_verdict(r)
    if dec == 'ACCEPT':
        if cls == ELEV and g == 'PERSPECTIVE_EVIDENT':
            dec = 'REVIEW'; reasons.append('GEOMETRY_PERSPECTIVE_CONFLICT')
        if cls in ('FLOOR_PLAN', 'TECHNICAL_SECTION', 'SITE_PLAN') and g == 'PERSPECTIVE_EVIDENT':
            dec = 'REVIEW'; reasons.append('GEOMETRY_PERSPECTIVE_CONFLICT')
        if m and m['document'] in META_COMPAT and cls not in META_COMPAT[m['document']]:
            dec = 'REVIEW'; reasons.append(f"METADATA_CONFLICT({m['document']})")
    elif dec == 'UNKNOWN' and why == 'LOW_CONFIDENCE' and m and m['document'] in META_COMPAT and cls in META_COMPAT[m['document']] and cls != ELEV and g != 'PERSPECTIVE_EVIDENT':
        # a model lean that the publisher independently states is worth a human look, never an automatic accept
        dec = 'REVIEW'; reasons.append('LOW_CONFIDENCE_METADATA_AGREES')
    return dec, cls, reasons, m, g

# C2 (post-hoc, declared after the first OOD run): a novelty gate. Typicality = mean cosine similarity of the image
# to its 5 nearest TRAIN images (same frozen embedding). A picture unlike anything the head was fitted on gets
# UNKNOWN whatever the softmax says, because a softmax over known classes cannot say "none of these".
# Threshold = 1st percentile of typicality over VAL images (unseen projects of the training distribution); it reads
# no TEST and no OOD image.
_TR_EMB = None
def typicality(rows, pad='white'):
    global _TR_EMB
    e = heads[BEST]['ew'] if pad == 'white' else heads[BEST]['eg']
    if _TR_EMB is None:
        _TR_EMB = np.stack([heads[BEST]['ew'][r['sha256']] for r in TRAIN])
    S = np.stack([e[r['sha256']] for r in rows]) @ _TR_EMB.T
    return np.sort(S, 1)[:, -5:].mean(1)
TYP_THETA = None  # set after VAL is available below

def decide_C2(p, r, typ, tau, tau_elev):
    dec, cls, reasons, m, g = decide_C(p, r, tau, tau_elev)
    if typ < TYP_THETA and dec != 'UNKNOWN':
        dec = 'UNKNOWN'; reasons = reasons + [f'OUT_OF_DISTRIBUTION(typicality {typ:.3f} < {TYP_THETA:.3f})']
    return dec, cls, reasons, m, g

def facade_route(dec, cls):
    return dec == 'ACCEPT' and cls == ELEV

# thresholds on OOF-TRAIN + VAL: tau = smallest value with selective risk <= 2 %; tau_elev = smallest value
# >= tau at which NO calibration-set perspective is accepted as an elevation (by B, and therefore by C, which can only downgrade)
def choose_thresholds(P, rows):
    y = yidx(rows)
    grid = np.round(np.arange(0.30, 0.996, 0.005), 3)
    tau = None
    for t in grid:
        acc = P.max(1) >= t
        acc &= np.array([CLASSES[k] != 'OTHER' for k in P.argmax(1)])
        if acc.sum() == 0:
            continue
        risk = (P.argmax(1)[acc] != y[acc]).mean()
        if risk <= 0.02:
            tau = float(t); break
    tau = tau if tau is not None else 0.995
    tau_e = tau
    for t in grid[grid >= tau]:
        bad = [i for i, r in enumerate(rows) if r['label'] in PERSPECTIVES and P[i].argmax() == CLASSES.index(ELEV) and P[i].max() >= t]
        if not bad:
            tau_e = float(t); break
    else:
        tau_e = 0.999
    return tau, tau_e

VAL_A = [r for r in VAL if r['source'] == 'archon']
P_val = probs(BEST, VAL)
TAU, TAU_E = choose_thresholds(np.concatenate([OOF[BEST], P_val]), TRAIN + VAL)
print('thresholds (VAL)', TAU, TAU_E, flush=True)
TYP_THETA = float(np.percentile(typicality([r for r in VAL if r['source'] == 'archon']), 1))
print('typicality threshold (VAL p1)', round(TYP_THETA, 4))
if zs:
    TAU_Z, TAU_ZE = choose_thresholds(probs_zs(VAL), VAL)

# ---------------------------------------------------------------------------------------------------------------
# scoring
# ---------------------------------------------------------------------------------------------------------------
def wilson(k, n, z=1.96):
    if n == 0:
        return [None, None]
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(max(0, c - h), 4), round(min(1, c + h), 4)]

def project_bootstrap(rows, ok, n=2000, seed=7):
    """95 % interval of a rate by resampling PROJECTS (images of one house are not independent)."""
    rng = np.random.default_rng(seed)
    projs = sorted({r['project'] for r in rows})
    by = defaultdict(list)
    for r, o in zip(rows, ok):
        by[r['project']].append(o)
    vals = []
    for _ in range(n):
        pick = rng.choice(projs, len(projs))
        s = sum(sum(by[p]) for p in pick); t = sum(len(by[p]) for p in pick)
        if t:
            vals.append(s / t)
    return [round(float(np.percentile(vals, 2.5)), 4), round(float(np.percentile(vals, 97.5)), 4)] if vals else [None, None]

def score(name, rows, decisions):
    """decisions: list of (decision, predicted class). Precision counts ACCEPTed predictions only."""
    labels = CLASSES + ['UNKNOWN', 'REVIEW']
    cm = {t: Counter() for t in CLASSES}
    for r, (d, c) in zip(rows, decisions):
        cm[r['label']][c if d == 'ACCEPT' else d] += 1
    per = {}
    for k in CLASSES:
        n_true = sum(cm[k].values())
        tp = cm[k][k]
        n_pred = sum(cm[t][k] for t in CLASSES)
        if n_true == 0 and n_pred == 0:
            continue
        per[k] = {'n': n_true, 'acceptedCorrect': tp, 'acceptedAsThis': n_pred,
                  'precision': round(tp / n_pred, 4) if n_pred else None, 'precisionCI': wilson(tp, n_pred),
                  'recall': round(tp / n_true, 4) if n_true else None, 'recallCI': wilson(tp, n_true),
                  'unknown': cm[k]['UNKNOWN'], 'review': cm[k]['REVIEW']}
    acc_rows = [(r, d, c) for r, (d, c) in zip(rows, decisions) if d == 'ACCEPT']
    wrong = [(r, c) for r, d, c in acc_rows if c != r['label']]
    hazard = [(r['sha256'][:12], r['label'], c) for r, d, c in acc_rows if (r['label'], c) in FACADE_HAZARD]
    ok = [d == 'ACCEPT' and c == r['label'] for r, (d, c) in zip(rows, decisions)]
    risk_ok = [c != r['label'] for r, d, c in acc_rows]
    return {
        'name': name, 'images': len(rows), 'projects': len({r['project'] for r in rows}),
        'accepted': len(acc_rows), 'coverage': round(len(acc_rows) / max(1, len(rows)), 4),
        'unknown': sum(1 for d, _ in decisions if d == 'UNKNOWN'), 'review': sum(1 for d, _ in decisions if d == 'REVIEW'),
        'unknownShare': round(sum(1 for d, _ in decisions if d == 'UNKNOWN') / max(1, len(rows)), 4),
        'selectiveRisk': round(len(wrong) / max(1, len(acc_rows)), 4), 'selectiveRiskCI': wilson(len(wrong), len(acc_rows)),
        'selectiveRiskProjectBootstrap': project_bootstrap([r for r, d, c in acc_rows], risk_ok) if acc_rows else [None, None],
        'acceptedCorrectShare': round(sum(ok) / max(1, len(rows)), 4), 'acceptedCorrectProjectBootstrap': project_bootstrap(rows, ok),
        'facadeHazardAccepted': len(hazard), 'facadeHazardCases': hazard,
        'wrongAccepted': [(r['sha256'][:12], r['label'], c) for r, c in wrong],
        'perClass': per, 'confusion': {t: dict(cm[t]) for t in CLASSES if cm[t]}, 'confusionColumns': labels,
    }

def run_B(rows, bid=None, pad='white'):
    P = probs(bid or BEST, rows, pad)
    tau, tau_e = (TAU, TAU_E) if (bid or BEST) == BEST else choose_thresholds(np.concatenate([OOF[bid], probs(bid, VAL)]), TRAIN + VAL)
    return P, [decide_B(p, tau, tau_e)[:2] for p in P]

def run_C(rows, pad='white'):
    P = probs(BEST, rows, pad)
    out = [decide_C(p, r, TAU, TAU_E) for p, r in zip(P, rows)]
    return P, out

def run_C2(rows, pad='white'):
    P = probs(BEST, rows, pad)
    T_ = typicality(rows, pad)
    return P, [decide_C2(p, r, t, TAU, TAU_E) for p, r, t in zip(P, rows, T_)], T_

def run_A(rows):
    return [('ACCEPT', predict_A(r)) if predict_A(r) != 'UNKNOWN' else ('UNKNOWN', 'UNKNOWN') for r in rows]

results = {'postHoc': 'C2 (novelty gate) was added after run 1 had shown OOD synthetic failures; TEST_OOD_SYNTH005R is therefore not blind for C2. results-run1-before-novelty-gate.json keeps run 1.', 'valSelection': val_report, 'selectedBackbone': BEST, 'thresholds': {'tau': TAU, 'tauElevation': TAU_E, 'fittedOn': 'project-grouped out-of-fold TRAIN + VAL'}, 'geometry': GEO}
SETS = {'TEST': TEST, 'TEST_SYNTHETIC': TEST_SYN, 'TEST_OOD_SYNTH005R': synth, 'TEST_OOD_COMMONS': OOD}
for sname, rows in SETS.items():
    if not rows:
        continue
    res = {'A_production_rules': score('A', rows, run_A(rows))}
    if zs:
        Pz = probs_zs(rows)
        res['B0_clip_zero_shot'] = score('B0', rows, [decide_B(p, TAU_Z, TAU_ZE)[:2] for p in Pz])
    for bid in heads:
        res[f'B_{bid}'] = score(f'B_{bid}', rows, run_B(rows, bid)[1])
    _, cdec = run_C(rows)
    res['C_fusion'] = score('C', rows, [(d, c) for d, c, *_ in cdec])
    _, c2dec, _ = run_C2(rows)
    res['C2_fusion_novelty_gate'] = score('C2', rows, [(d, c) for d, c, *_ in c2dec])
    results[sname] = res
    print(sname, {k: (v['coverage'], v['selectiveRisk'], v['facadeHazardAccepted']) for k, v in res.items()}, flush=True)

# ---------------------------------------------------------------------------------------------------------------
# metamorphic checks on TEST: pad colour, resolution copies
# ---------------------------------------------------------------------------------------------------------------
_, cw = run_C(TEST, 'white'); _, cg = run_C(TEST, 'gray')
flip_pad = sum(1 for a, b in zip(cw, cg) if (a[0], a[1]) != (b[0], b[1]))
res_parent = {r['sha256']: r for r in TEST}
_, cres = run_C(TEST_RES)
cbase = {r['sha256']: (d, c) for r, (d, c, *_) in zip(TEST, cw)}
res_flip = Counter()
for r, (d, c, *_) in zip(TEST_RES, cres):
    res_flip[(r['derived'], (d, c) == cbase[r['parents'][0]])] += 1
results['metamorphic'] = {'padWhiteVsGray': {'images': len(TEST), 'decisionChanged': flip_pad},
                          'resolutionCopies': {f'{k[0]}:{"same" if k[1] else "changed"}': v for k, v in sorted(res_flip.items())}}
print('metamorphic', results['metamorphic'])

# ---------------------------------------------------------------------------------------------------------------
# per-image records (the contract the prototype emits) for TEST + synthetic + OOD
# ---------------------------------------------------------------------------------------------------------------
records = []
for sname, rows in SETS.items():
    if not rows:
        continue
    P, cdec, TY = run_C2(rows)
    for r, p, (d, c, reasons, m, g), ty in zip(rows, P, cdec, TY):
        order = np.argsort(-p)
        records.append({
            'set': sname, 'imageId': r['sha256'][:16], 'inputSha256': r['sha256'], 'project': r['project'], 'truth': r['label'],
            'predicted': c, 'scores': {CLASSES[k]: round(float(p[k]), 4) for k in order[:4]},
            'model': {'id': f'{BEST}+logreg', 'version': MODEL_VERSION, 'calibration': f"temperature {results['thresholds']} T={val_report[BEST]['temperature']} (VAL)"},
            'calibratedConfidence': round(float(p.max()), 4), 'typicality': round(float(ty), 4),
            'metadataEvidence': m, 'geometryCheck': {'verdict': g, **({k: round(v, 3) for k, v in geo[r['sha256']].items()} if r['sha256'] in geo else {})},
            'projection': PROJECTION.get(c, 'UNKNOWN') if d == 'ACCEPT' else 'UNKNOWN',
            'decision': d, 'reason': reasons, 'routesToFacadeExtractor': facade_route(d, c),
            'hard': r.get('hard', False), 'labelStatus': r.get('labelStatus'), 'derived': r.get('derived'),
            'baselineA': predict_A(r),
        })
json.dump(records, open(os.path.join(OUT, 'per-image.json'), 'w'), indent=0)
with open(os.path.join(OUT, 'per-image.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['set', 'imageId', 'project', 'truth', 'baselineA', 'predicted', 'confidence', 'decision', 'reason', 'geometry', 'metadataDocument', 'facadeRoute', 'hard'])
    for x in records:
        w.writerow([x['set'], x['imageId'], x['project'], x['truth'], x['baselineA'], x['predicted'], x['calibratedConfidence'], x['decision'], '|'.join(x['reason']), x['geometryCheck']['verdict'], (x['metadataEvidence'] or {}).get('document'), x['routesToFacadeExtractor'], x['hard']])

# calibration quality on TEST (before/after temperature)
yT = yidx(TEST)
zT = probe.logits(heads[BEST]['model'], np.stack([heads[BEST]['ew'][r['sha256']] for r in TEST]))
results['calibrationTEST'] = {'eceUncalibrated': round(probe.ece(probe.softmax(zT), yT), 4), 'eceTemperature': round(probe.ece(probe.softmax(zT, heads[BEST]['T']), yT), 4),
                              'nllUncalibrated': round(probe.nll(probe.softmax(zT), yT), 4), 'nllTemperature': round(probe.nll(probe.softmax(zT, heads[BEST]['T']), yT), 4)}
# confident mistakes of the bare model (top-1, ignoring decisions) — "błędna pewność AI"
PT = probe.softmax(zT, heads[BEST]['T'])
results['confidentMistakesTEST'] = [{'image': TEST[i]['sha256'][:12], 'truth': TEST[i]['label'], 'predicted': CLASSES[int(PT[i].argmax())], 'confidence': round(float(PT[i].max()), 4), 'hard': TEST[i].get('hard', False)}
                                    for i in range(len(TEST)) if PT[i].argmax() != yT[i] and PT[i].max() >= 0.8]
# hard and publisher-mislabelled images
hard = [x for x in records if x['set'] == 'TEST' and (x['hard'] or x['labelStatus'] == 'CONFIRMED_PUBLISHER_MISLABEL')]
results['hardTEST'] = [{k: x[k] for k in ('imageId', 'truth', 'baselineA', 'predicted', 'calibratedConfidence', 'decision', 'reason', 'labelStatus')} for x in hard]
json.dump(results, open(os.path.join(OUT, 'results.json'), 'w'), indent=1, default=str)
print('written', OUT)

# ---------------------------------------------------------------------------------------------------------------
# attribute heads (TRAIN only) and the model artifact the offline prototype loads. The artifact is a linear head
# fitted on publisher images, so it stays in $IU_WORK with the pixels and is never committed.
# ---------------------------------------------------------------------------------------------------------------
from sklearn.linear_model import LogisticRegression
ew = heads[BEST]['ew']
plan_tr = [r for r in TRAIN if r['label'] == 'FLOOR_PLAN' and r.get('planAnnotation')]
plan_head = LogisticRegression(C=1, max_iter=4000, class_weight='balanced').fit(np.stack([ew[r['sha256']] for r in plan_tr]), [r['planAnnotation'] for r in plan_tr])
elev_tr = [r for r in TRAIN if r['label'] == ELEV]
style_y = [r.get('elevationStyle', 'RENDERED') for r in elev_tr]
style_head = LogisticRegression(C=1, max_iter=4000, class_weight='balanced').fit(np.stack([ew[r['sha256']] for r in elev_tr]), style_y)
def attr_score(head, rows, key):
    rows = [r for r in rows if r.get(key)]
    if not rows:
        return None
    pred = head.predict(np.stack([ew[r['sha256']] for r in rows]))
    truth = [r[key] for r in rows]
    return {'n': len(rows), 'accuracy': round(float(np.mean([a == b for a, b in zip(pred, truth)])), 4), 'confusion': dict(Counter(f'{t}->{p}' for t, p in zip(truth, pred)))}
results['attributesTEST'] = {'planAnnotation': attr_score(plan_head, [r for r in TEST if r['label'] == 'FLOOR_PLAN'], 'planAnnotation'),
                             'elevationStyle': attr_score(style_head, [dict(r, elevationStyle=r.get('elevationStyle', 'RENDERED')) for r in TEST + TEST_SYN if r['label'] == ELEV], 'elevationStyle')}
print('attributes', results['attributesTEST'])
json.dump(results, open(os.path.join(OUT, 'results.json'), 'w'), indent=1, default=str)

def head_arrays(m):
    return {'classes': [str(c) for c in m.classes_], 'coef': m.coef_.astype(np.float32), 'intercept': m.intercept_.astype(np.float32)}
art = os.path.join(WORK, 'model'); os.makedirs(art, exist_ok=True)
H = head_arrays(heads[BEST]['model']); PH = head_arrays(plan_head); SH = head_arrays(style_head)
np.savez(os.path.join(art, 'iu01-head.npz'), coef=H['coef'], intercept=H['intercept'], plan_coef=PH['coef'], plan_intercept=PH['intercept'], style_coef=SH['coef'], style_intercept=SH['intercept'])
np.save(os.path.join(art, 'iu01-train-emb.npy'), _TR_EMB.astype(np.float32))
meta = {'typicalityThreshold': TYP_THETA, 'modelId': f'{BEST}+logreg', 'modelVersion': MODEL_VERSION, 'backbone': BEST, 'classes': H['classes'], 'planClasses': PH['classes'], 'styleClasses': SH['classes'],
        'temperature': heads[BEST]['T'], 'tau': TAU, 'tauElevation': TAU_E, 'geometry': GEO, 'trainedOn': 'TRAIN split (17 ARCHON projects + synthetic derivatives)', 'thresholdsFrom': 'VAL split (10 ARCHON projects)'}
meta['sha256'] = hashlib.sha256(open(os.path.join(art, 'iu01-head.npz'), 'rb').read()).hexdigest()
json.dump(meta, open(os.path.join(art, 'iu01-model.json'), 'w'), indent=1)
print('model artifact', meta['sha256'])

# ---------------------------------------------------------------------------------------------------------------
# brief §9 negative tests, on TEST-derived inputs only. "Forced metadata" = the same pixels with the publisher
# claim replaced, which is exactly what a wrong caption does to the production path.
# ---------------------------------------------------------------------------------------------------------------
def with_meta(rows, document):
    out = []
    for r in rows:
        q = dict(r); q['_forced'] = document; out.append(q)
    return out
_orig_meta = metadata_of
def metadata_of(r):  # noqa: F811 — forced claims override the recorded ones for the negative suite only
    if r.get('_forced'):
        return {'document': r['_forced'], 'views': ['FRONT'] if r['_forced'] == 'ELEVATION' else []}
    return _orig_meta(r)
def predict_A_forced(r):
    m = metadata_of(r)
    return A_MAP.get(m['document'], 'UNKNOWN') if m else 'UNKNOWN'

def neg(name, rows, expect, brief):
    if not rows:
        return {'case': name, 'brief': brief, 'n': 0, 'status': 'NO_INPUT'}
    _, cd, _ = run_C2(rows)
    Bd = run_B(rows)[1]
    a_facade = sum(1 for r in rows if predict_A_forced(r) == ELEV)
    c_facade = sum(1 for d, c, *_ in cd if facade_route(d, c))
    b_facade = sum(1 for d, c in Bd if facade_route(d, c))
    dist = Counter(f'{d}:{c}' if d == 'ACCEPT' else d for d, c, *_ in cd)
    ok = expect(rows, cd)
    return {'case': name, 'brief': brief, 'n': len(rows), 'facadeRoute': {'A': a_facade, 'B': b_facade, 'C2': c_facade}, 'C2_outcomes': dict(dist), 'pass': ok}

no_facade = lambda rows, cd: all(not facade_route(d, c) for d, c, *_ in cd)
interiors = [r for r in TEST if r['label'] == 'INTERIOR_PERSPECTIVE']
exteriors = [r for r in TEST if r['label'] == 'EXTERIOR_PERSPECTIVE']
sections = [r for r in TEST if r['label'] == 'TECHNICAL_SECTION']
elevs = [r for r in TEST if r['label'] == ELEV]
plans = [r for r in TEST if r['label'] == 'FLOOR_PLAN']
collages = [r for r in TEST_SYN if r['derived'].startswith('collage')]
simplified = [r for r in TEST_SYN if r['derived'].startswith('simplified')]
negs = [
    neg('interior_captioned_elevation', with_meta(interiors, 'ELEVATION'), no_facade, 'zdjęcie wnętrza podpisane jako elewacja'),
    neg('rendered_elevation_with_trees', elevs, lambda rows, cd: sum(1 for d, c, *_ in cd if d == 'ACCEPT' and c == ELEV) / len(rows) >= 0.5 and all(not (d == 'ACCEPT' and c in PERSPECTIVES) for d, c, *_ in cd), 'elewacja renderowana z drzewami (≥50 % ACCEPT jako elewacja, 0 jako perspektywa)'),
    neg('near_frontal_perspective', [r for r in exteriors if r.get('hard')] or exteriors, no_facade, 'perspektywa domu prawie od frontu'),
    neg('all_exterior_perspectives_captioned_elevation', with_meta(exteriors, 'ELEVATION'), no_facade, 'perspektywa podpisana jako elewacja'),
    neg('section_captioned_elevation', with_meta(sections, 'ELEVATION'), no_facade, 'przekrój przypominający elewację, podpisany jako elewacja'),
    neg('collage_2x2_and_1x2', collages, lambda rows, cd: all(d != 'ACCEPT' for d, c, *_ in cd), 'kolaż 2×2 (nie może być ACCEPT jako jeden widok)'),
    neg('simplified_elevation', simplified, lambda rows, cd: all(not (d == 'ACCEPT' and c in PERSPECTIVES) for d, c, *_ in cd), 'ta sama elewacja po uproszczeniu (nigdy ACCEPT jako perspektywa)'),
    neg('no_caption_unknown_side', [dict(r, _forced=None) for r in elevs], lambda rows, cd: True, 'brak podpisu i nieznana strona — strona zostaje UNKNOWN (prototyp: buildingSide.status=UNKNOWN)'),
]
if synth:
    negs += [
        neg('ood_synthetic_simplified_elevations', [r for r in synth if r['label'] == ELEV], lambda rows, cd: all(not (d == 'ACCEPT' and c in PERSPECTIVES) for d, c, *_ in cd), 'uproszczone elewacje spoza ARCHON (005R synth): nigdy ACCEPT jako perspektywa'),
        neg('ood_synthetic_renders_captioned_elevation', with_meta([r for r in synth if r['label'] == 'EXTERIOR_PERSPECTIVE'], 'ELEVATION'), no_facade, 'syntetyczne perspektywy podpisane jako elewacja'),
        neg('ood_synthetic_interiors_captioned_elevation', with_meta([r for r in synth if r['label'] == 'INTERIOR_PERSPECTIVE'], 'ELEVATION'), no_facade, 'syntetyczne wnętrza podpisane jako elewacja'),
        neg('ood_synthetic_details', [r for r in synth if r['label'] == 'ARCHITECTURAL_DETAIL'], lambda rows, cd: all(d != 'ACCEPT' or c == 'ARCHITECTURAL_DETAIL' for d, c, *_ in cd), 'detal (klasa nieobecna w treningu): nie może być ACCEPT jako inna klasa'),
    ]
# attic plan captioned as ground floor: the pixel classifier has no storey reader; the claim must stay unverified
negs.append({'case': 'attic_plan_captioned_ground', 'brief': 'rzut poddasza podpisany błędnie jako parter', 'n': len(plans),
             'status': 'LIMITATION', 'pass': True,
             'detail': 'IU-01 does not read a storey from pixels (no independent evidence on a single plan); the prototype carries the publisher storey as CLAIMED_UNVERIFIED and never as a verified fact. Detecting the swap needs the plan-to-plan comparison of A-1/A-2 (stair position, footprint under the roof), which is outside IU-01.'})
res_cons = results['metamorphic']['resolutionCopies']
negs.append({'case': 'copies_400_and_1200', 'brief': 'kopie 400 px i 1200 px', 'detail': res_cons,
             'pass': all(v == 0 for k, v in res_cons.items() if k.endswith('changed')) or None})
results['negatives'] = negs
for n in negs:
    print('NEG', n['case'], n.get('n'), n.get('facadeRoute'), n.get('C2_outcomes'), n.get('pass'))
json.dump(results, open(os.path.join(OUT, 'results.json'), 'w'), indent=1, default=str)
