#!/usr/bin/env python3
"""
contenders.py — normalise every 005R Task-A contender to one row per asset (RESEARCH ONLY).

    python3 -I contenders.py v0   <corpus-private.json> <v0-dir> <out.json>
    python3 -I contenders.py v1   <v1-pred.jsonl> <out.json> [--contender V1|V0b-stump]
    python3 -I contenders.py v0b  <v0.json> <v0b-stump-pred.jsonl> <out.json>
    python3 -I contenders.py v2   <v2.jsonl> <truth.json> <out.json>            (fits τ on DEV only, §3)
    python3 -I contenders.py n1   <v0.json> <v1.json> <out.json>

Row: {assetId, role, resolved, score, alternatives, detail}. `role` is a research role or UNKNOWN; `resolved` is false
whenever the contender abstained. Nothing here reads truth except `v2`, which reads ONLY DEV rows to fix τ.
"""
import json
import os
import sys

V0_MAP = {'FLOOR_PLAN': 'FLOOR_PLAN', 'SECTION': 'SECTION', 'SITE_PLAN': 'SITE_PLAN', 'ELEVATION': 'TECHNICAL_ELEVATION', 'DETAIL': 'DETAIL',
          'CHROME': 'OTHER', 'UNKNOWN': 'UNKNOWN', 'PERSPECTIVE_RENDER': 'UNKNOWN'}
PICTORIAL = {'EXTERIOR_RENDER', 'INTERIOR_RENDER', 'EXTERIOR_PHOTO', 'INTERIOR_PHOTO'}
TAUS = [round(0.30 + 0.05 * i, 2) for i in range(14)]


def dump(rows, out, meta):
    rows.sort(key=lambda r: r['assetId'])
    json.dump({'meta': meta, 'rows': rows}, open(out, 'w'), indent=1, sort_keys=True)
    print(meta.get('contender'), len(rows), 'resolved', sum(r['resolved'] for r in rows))


def v0(private_p, v0dir, out):
    corpus = json.load(open(private_p))
    by_sha = {}
    for name in sorted(os.listdir(v0dir)):
        if not name.endswith('.json'):
            continue
        pkg = json.load(open(os.path.join(v0dir, name)))
        for a in pkg.get('assets', []):
            for v in a.get('variants', []):
                h = v.get('byteHash')
                if h:
                    by_sha.setdefault(h, []).append({'package': name, 'document': a['roles']['document'], 'view': a['roles']['view'], 'assetId': a['id']})
    rows = []
    for a in corpus['assets']:
        hits = by_sha.get(a['variantSha256'], [])
        docs = sorted({h['document'] for h in hits})
        if not hits:
            doc, why = 'NOT_ACQUIRED', 'the production acquirer did not publish these bytes in any package'
        elif len(docs) > 1:
            doc, why = 'V0_CONFLICT', 'packages disagree: ' + '/'.join(docs)
        else:
            doc, why = docs[0], 'production roles.document'
        role = V0_MAP.get(doc, 'UNKNOWN')
        rows.append({'assetId': a['assetId'], 'role': role, 'resolved': role != 'UNKNOWN', 'score': None, 'alternatives': [],
                     'v0Document': doc, 'v0Views': sorted({h['view'] for h in hits}), 'detail': why})
    dump(rows, out, {'contender': 'V0a', 'source': 'production source:acquire, unmodified'})


def v1(pred_p, out, contender='V1'):
    rows = []
    for line in open(pred_p):
        p = json.loads(line)
        if 'error' in p:
            rows.append({'assetId': p['assetId'], 'role': 'UNKNOWN', 'resolved': False, 'score': None, 'alternatives': [], 'detail': 'DECODE_ERROR ' + p['error']})
            continue
        rows.append({'assetId': p['assetId'], 'role': p['label'], 'resolved': p['resolved'], 'score': p['purity'], 'alternatives': p['alternatives'],
                     'detail': ' AND '.join(p['path']) + f" → leaf {p['leafLabel']} (DEV n={p['leafN']}, purity {p['purity']})"})
    dump(rows, out, {'contender': contender})


def v0b(v0_p, stump_p, out):
    v0rows = {r['assetId']: r for r in json.load(open(v0_p))['rows']}
    stump = {json.loads(l)['assetId']: json.loads(l) for l in open(stump_p)}
    rows = []
    for aid, r in sorted(v0rows.items()):
        r = dict(r)
        if r['v0Document'] == 'PERSPECTIVE_RENDER':
            s = stump.get(aid, {})
            if s.get('resolved') and s.get('label') in ('EXTERIOR_RENDER', 'INTERIOR_RENDER'):
                r.update(role=s['label'], resolved=True, score=s['purity'], detail='V0 PERSPECTIVE_RENDER split by stump ' + ' AND '.join(s['path']))
            else:
                r.update(role='UNKNOWN', resolved=False, detail='V0 PERSPECTIVE_RENDER; stump leaf impure → UNKNOWN')
        rows.append(r)
    dump(rows, out, {'contender': 'V0b'})


def v2(v2_p, truth_p, out):
    truth = {r['assetId']: r for r in json.load(open(truth_p))['rows']}
    preds = {}
    meta = {}
    for line in open(v2_p):
        d = json.loads(line)
        if d.get('meta'):
            meta.update({k: v for k, v in d.items() if k != 'meta'})
            continue
        preds[d['assetId']] = d
    # τ from DEV only: one row per lineage group (smallest assetId), truth not UNKNOWN / TRUTH_CONFLICT, scored size
    dev = {}
    for aid, d in sorted(preds.items()):
        t = truth.get(aid)
        if not t or 'routing' not in d or t['split'] != 'DEV' or not t['scoredSize'] or t['roleTruth'] in ('UNKNOWN', 'TRUTH_CONFLICT'):
            continue
        dev.setdefault(t['lineageGroup'], (aid, d, t))
    tau, curve = 1.0, []
    for cand in TAUS:
        res = [(max(d['routing'], key=d['routing'].get), t['roleTruth']) for _, d, t in dev.values() if max(d['routing'].values()) >= cand]
        risk = (sum(1 for p, y in res if p != y) / len(res)) if res else None
        curve.append({'tau': cand, 'resolved': len(res), 'risk': risk})
        if res and risk <= 0.05 and tau == 1.0:
            tau = cand
    rows = []
    for aid, d in sorted(preds.items()):
        if 'routing' not in d:
            rows.append({'assetId': aid, 'role': 'UNKNOWN', 'resolved': False, 'score': None, 'alternatives': [], 'detail': 'ERROR ' + d.get('error', '')})
            continue
        ranked = sorted(d['routing'].items(), key=lambda kv: (-kv[1], kv[0]))
        top, p = ranked[0]
        ok = p >= tau
        rows.append({'assetId': aid, 'role': top if ok else 'UNKNOWN', 'resolved': ok, 'score': p, 'alternatives': [k for k, _ in ranked[1:4]],
                     'top': top, 'detail': f'softmax over fixed prompts; top {top} {p:.3f}; τ={tau}'})
    dump(rows, out, {'contender': 'V2', 'tau': tau, 'tauCurveDEV': curve, 'devGroups': len(dev), **meta})


def n1(v0_p, v1_p, out):
    a = {r['assetId']: r for r in json.load(open(v0_p))['rows']}
    b = {r['assetId']: r for r in json.load(open(v1_p))['rows']}
    rows = []
    for aid in sorted(a):
        m, p = a[aid], b.get(aid, {'role': 'UNKNOWN', 'resolved': False})
        if m['v0Document'] == 'PERSPECTIVE_RENDER':
            ok = p['resolved'] and p['role'] in PICTORIAL
            role, why = (p['role'], 'publisher says visualisation; pixels say ' + p['role']) if ok else ('UNKNOWN', 'publisher says visualisation; pixel router not pictorial or abstained')
        elif m['resolved'] and p['resolved'] and m['role'] == p['role']:
            role, ok, why = m['role'], True, 'publisher claim and pixel router agree'
        else:
            role, ok, why = 'UNKNOWN', False, f"disagreement or abstention: publisher {m['role']} / pixels {p['role'] if p['resolved'] else 'UNKNOWN'}"
        rows.append({'assetId': aid, 'role': role if ok else 'UNKNOWN', 'resolved': ok, 'score': p.get('score'), 'alternatives': [], 'detail': why})
    dump(rows, out, {'contender': 'N1'})


if __name__ == '__main__':
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == 'v0':
        v0(*args[:3])
    elif cmd == 'v1':
        v1(args[0], args[1], args[args.index('--contender') + 1] if '--contender' in args else 'V1')
    elif cmd == 'v0b':
        v0b(*args[:3])
    elif cmd == 'v2':
        v2(*args[:3])
    elif cmd == 'n1':
        n1(*args[:3])
    else:
        sys.exit(__doc__)
