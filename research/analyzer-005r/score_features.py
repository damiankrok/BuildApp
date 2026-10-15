#!/usr/bin/env python3
"""
score_features.py — 005R Task-B scorer on the SYNTHETIC known-truth corpus (RESEARCH ONLY). Preregistration §5.3.

    python3 -I score_features.py <synth-truth.json> <out.json> --v2 <v2-synth.jsonl> --v1cues <v1-cues-synth.jsonl>
                                 [--routes-v1 <V1-synth.json>] [--routes-v2 <V2-synth.json>]

Matching: a detection matches the unmatched truth feature of the same kind with the highest IoU ≥ 0.5 (greedy by
descending score). Truth features with visibleFraction < 0.5 are "don't care": matching one is neither TP nor FP, and
missing one is not FN. Only images whose truth has `featuresAnnotated` count.

Reported per source (V2 at the preregistered operating score 0.20 and a sweep; V1 cues at any score):
  per kind TP / FP / FN, precision, recall; look-alike confusions (an FP of kind K with IoU ≥ 0.5 to a look-alike whose
  isNot contains K); crop hallucinations (a detection of a kind the crop removed while no instance of that kind remains);
  interior control (detections on interior images); mirror control (kind sets on an elevation vs its mirror);
  edition-pair control (does the swapped kind appear where truth has it and not where truth lacks it); downscale
  consistency. Gating: ORACLE (truth role ∈ exterior evidence) and, when given, each contender's own routing.
Synthetic correctness is not real-source generalisation.
"""
import json
import sys

EXT = {'EXTERIOR_RENDER', 'EXTERIOR_PHOTO', 'TECHNICAL_ELEVATION'}
V2_OP = 0.20
SWEEP = [0.05, 0.10, 0.20, 0.30, 0.50]


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / u if u else 0.0


def load(p):
    out = {}
    for line in open(p):
        d = json.loads(line)
        if not d.get('meta'):
            out[d['assetId']] = d
    return out


def dets_v2(d, thr):
    return [{'kind': k, 'box': x['box'], 'score': x['score']} for k, lst in (d.get('detections') or {}).items() for x in lst if x['score'] >= thr]


def dets_v1(d):
    return [{'kind': c['kind'], 'box': c['box'], 'score': c['score']} for c in d.get('cues', [])]


def match(img, dets):
    feats = img['features']
    used = set()
    res = []
    for d in sorted(dets, key=lambda d: (-d['score'], d['kind'], d['box'])):
        best, bi = 0.0, None
        for i, f in enumerate(feats):
            if i in used or f['kind'] != d['kind']:
                continue
            v = iou(d['box'], f['box'])
            if v >= 0.5 and v > best:
                best, bi = v, i
        if bi is not None:
            used.add(bi)
            res.append(('TP' if feats[bi].get('visibleFraction', 1) >= 0.5 else 'DONTCARE', d, feats[bi]))
        else:
            res.append(('FP', d, None))
    fn = [f for i, f in enumerate(feats) if i not in used and f.get('visibleFraction', 1) >= 0.5]
    return res, fn


def evaluate(truth, getdets, gate):
    per, look, crop_h, interior = {}, {}, 0, 0
    for img in truth['images']:
        if not img.get('featuresAnnotated'):
            continue
        dets = getdets(img)
        if dets is None:
            continue
        if img['roleTruth'] == 'INTERIOR_RENDER':
            interior += len(dets) if gate(img) else 0
            continue
        if not gate(img):
            continue
        res, fn = match(img, dets)
        for kind_res, d, _ in res:
            p = per.setdefault(d['kind'], {'TP': 0, 'FP': 0, 'FN': 0})
            if kind_res == 'TP':
                p['TP'] += 1
            elif kind_res == 'FP':
                p['FP'] += 1
                for la in img.get('lookalikes', []):
                    if d['kind'] in la['isNot'] and iou(d['box'], la['box']) >= 0.5:
                        k = f"{la['kind']}→{d['kind']}"
                        look[k] = look.get(k, 0) + 1
                        break
                if d['kind'] in (img.get('excludedKindsByCrop') or []) and not any(f['kind'] == d['kind'] for f in img['features']):
                    crop_h += 1
        for f in fn:
            per.setdefault(f['kind'], {'TP': 0, 'FP': 0, 'FN': 0})['FN'] += 1
    for p in per.values():
        p['precision'] = round(p['TP'] / (p['TP'] + p['FP']), 4) if p['TP'] + p['FP'] else None
        p['recall'] = round(p['TP'] / (p['TP'] + p['FN']), 4) if p['TP'] + p['FN'] else None
    tot = {k: sum(p[k] for p in per.values()) for k in ('TP', 'FP', 'FN')}
    tot['precision'] = round(tot['TP'] / (tot['TP'] + tot['FP']), 4) if tot['TP'] + tot['FP'] else None
    tot['recall'] = round(tot['TP'] / (tot['TP'] + tot['FN']), 4) if tot['TP'] + tot['FN'] else None
    return {'perKind': dict(sorted(per.items())), 'pooled': tot, 'lookalikeConfusions': dict(sorted(look.items())),
            'cropHallucinations': crop_h, 'interiorDetections': interior}


def controls(truth, getdets):
    by_id = {i['syntheticId']: i for i in truth['images']}
    mirror, down = [], []
    for img in truth['images']:
        lin = img.get('lineage') or {}
        if lin.get('op') in ('mirror', 'downscale'):
            a, b = getdets(by_id[lin['parentId']]), getdets(img)
            if a is None or b is None:
                continue
            ka, kb = {d['kind'] for d in a}, {d['kind'] for d in b}
            j = len(ka & kb) / len(ka | kb) if ka | kb else 1.0
            (mirror if lin['op'] == 'mirror' else down).append(round(j, 4))
    pairs = []
    for p in truth['editionPairs']:
        frm, to = p['swap'].get('fromKind'), p['swap'].get('toKind')
        row = {'pair': p['e1'] + '↔' + p['e2'], 'fromKind': frm, 'toKind': to, 'images': []}
        for img in truth['images']:
            if img['editionKey'] != p['e2'] or (img.get('lineage') or {}).get('op') or not img.get('featuresAnnotated'):
                continue
            twin = next((i for i in truth['images'] if i['editionKey'] == p['e1'] and i['roleTruth'] == img['roleTruth'] and i.get('viewSideTruth') == img.get('viewSideTruth') and not (i.get('lineage') or {}).get('op')), None)
            if not twin:
                continue
            d1, d2 = getdets(twin), getdets(img)
            if d1 is None or d2 is None:
                continue
            row['images'].append({'view': img.get('viewSideTruth'), 'role': img['roleTruth'],
                                  'e1': {k: (any(d['kind'] == k for d in d1), any(f['kind'] == k for f in twin['features'])) for k in (frm, to) if k},
                                  'e2': {k: (any(d['kind'] == k for d in d2), any(f['kind'] == k for f in img['features'])) for k in (frm, to) if k}})
        pairs.append(row)
    return {'mirrorKindJaccard': mirror, 'downscaleKindJaccard': down, 'editionPairs': pairs,
            'editionPairsNote': 'per image: kind → [detected, truth-present]'}


def main(argv):
    truth = json.load(open(argv[0]))
    out = argv[1]
    v2 = load(argv[argv.index('--v2') + 1]) if '--v2' in argv else {}
    cues = load(argv[argv.index('--v1cues') + 1]) if '--v1cues' in argv else {}
    routes = {}
    for flag, name in (('--routes-v1', 'V1'), ('--routes-v2', 'V2')):
        if flag in argv:
            routes[name] = {r['assetId']: r for r in json.load(open(argv[argv.index(flag) + 1]))['rows']}
    oracle = lambda img: img['roleTruth'] in EXT
    rep = {'schema': 'research.005r.feature-scores-synthetic.0.1', 'truthSha256': truth.get('generatorSha256'), 'seed': truth.get('seed'),
           'note': 'synthetic known truth; not real-source generalisation', 'V2': {}, 'V1cues': {}}
    for thr in SWEEP:
        g = lambda img, thr=thr: dets_v2(v2[img['syntheticId']], thr) if img['syntheticId'] in v2 else None
        rep['V2'][f'oracle@{thr}'] = evaluate(truth, g, oracle)
    g2 = lambda img: dets_v2(v2[img['syntheticId']], V2_OP) if img['syntheticId'] in v2 else None
    rep['V2']['controls@0.2'] = controls(truth, g2)
    if 'V2' in routes:
        rr = routes['V2']
        rep['V2']['ownRouting@0.2'] = evaluate(truth, g2, lambda img: rr.get(img['syntheticId'], {}).get('resolved') and rr[img['syntheticId']]['role'] in EXT)
    elev = lambda img: img['roleTruth'] == 'TECHNICAL_ELEVATION'
    g1 = lambda img: dets_v1(cues[img['syntheticId']]) if img['syntheticId'] in cues else None
    rep['V1cues']['oracleElevations'] = evaluate(truth, g1, elev)
    rep['V1cues']['controls'] = controls(truth, g1)
    if 'V1' in routes:
        rr = routes['V1']
        rep['V1cues']['ownRouting'] = evaluate(truth, g1, lambda img: rr.get(img['syntheticId'], {}).get('resolved') and rr[img['syntheticId']]['role'] == 'TECHNICAL_ELEVATION')
    json.dump(rep, open(out, 'w'), indent=1, sort_keys=True)
    for k, v in rep['V2'].items():
        if 'pooled' in v:
            print('V2', k, v['pooled'], 'look', sum(v['lookalikeConfusions'].values()), 'crop', v['cropHallucinations'], 'interior', v['interiorDetections'])
    for k, v in rep['V1cues'].items():
        if 'pooled' in v:
            print('V1', k, v['pooled'], 'look', sum(v['lookalikeConfusions'].values()))


if __name__ == '__main__':
    main(sys.argv[1:])
