#!/usr/bin/env python3
"""score.py - BUILDPLAN-ANALYZER-005O offline scorer (RESEARCH ONLY).

  python3 -I research/analyzer-005o/score.py --work /home/user/work005o --variants M0X,M1,M2,M3,M1P \
      --out stage-reports/artifacts/analyzer-005o/metric-bakeoff.json

The ONLY place truth meets the challengers. Inputs: labels/truth.json (blind double transcription), the challenger
view records (views/<variant>/<case>.json), the replays (runs/<label>/<case>), the sealed metric evidence (for the
reader-level measures). Definitions are preregistration.md section 4-6, unchanged.
"""
import argparse, json, os, random, re, shutil, subprocess, sys, tempfile
from collections import Counter, defaultdict  # noqa: F401

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import as_printed_views as V  # noqa: E402  (the generator's own statement / join definitions, so both see the same statements)

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
INT = re.compile(r'^[1-9]\d{1,4}$')
TOL = 0.03


def wilson(k, n, z=1.96):
    if n == 0:
        return [None, None]
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    h = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5)
    return [round((c - h) / d, 4), round((c + h) / d, 4)]


def cluster_boot(rows, fam_key, stat, n=10000, seed=5050):
    fams = sorted({fam_key(r) for r in rows})
    by = defaultdict(list)
    for r in rows:
        by[fam_key(r)].append(r)
    rng = random.Random(seed)
    vals = []
    for _ in range(n):
        sample = [x for f in (rng.choice(fams) for _ in fams) for x in by[f]]
        s = stat(sample)
        if s is not None:
            vals.append(s)
    vals.sort()
    if not vals:
        return [None, None]
    return [round(vals[int(0.025 * len(vals))], 4), round(vals[min(len(vals) - 1, int(0.975 * len(vals)))], 4)]


def truth_by_statement(work):
    t = json.load(open(os.path.join(work, 'labels', 'truth.json')))['truth']
    out = {}
    for k, v in t.items():
        out[(v['case'], v['evidenceId'])] = v
    return out


def frame_true_scale(stmts):
    """stmts: [(truth_cm, px, chain, axis)] -> (scale, members) or (None, reason)."""
    pts = [(cm / px, cm, px, ch, ax) for cm, px, ch, ax in stmts if px > 0]
    best = []
    for r, *_ in pts:
        mem = [p for p in pts if abs(p[0] / r - 1) <= 0.02]
        if len(mem) > len(best):
            best = mem
    if len(best) >= 3 and len({p[3] for p in best}) >= 2 and len({p[4] for p in best}) == 2:
        s = sorted(p[0] for p in best)
        return s[len(s) // 2], len(best)
    return None, len(best)


def outcome(run_dir):
    rs = os.path.join(run_dir, 'result-summary.json')
    fs = os.path.join(run_dir, 'failure.json')
    dg = os.path.join(run_dir, 'plan-diagnostics', 'digest.json')
    o = {'outcome': 'NO_RUN', 'code': None, 'modelHash': None, 'frame': None, 'scale': None}
    tr = os.path.join(run_dir, 'analysis-trace.json')
    trace = json.load(open(tr)) if os.path.exists(tr) else {}
    # post-review C/S3: a failure record (or a FAILED trace) wins over a result summary written earlier in the same run
    if os.path.exists(fs) or trace.get('outcome') == 'FAILED':
        f = json.load(open(fs)) if os.path.exists(fs) else {}
        o.update(outcome='FAILED', code=f"{f.get('reasonCode')}/{f.get('substage')}", message=f.get('message', '')[:400])
    elif os.path.exists(rs):
        s = json.load(open(rs))
        o.update(outcome='COMPLETED', modelHash=s.get('modelHash'))
    # post-review S2/S4: the decision path (what plan resolution chose or refused, and why) and the plan's semantics
    path = {}
    for e in trace.get('entries', []):
        if e.get('substage') in ('PLAN_RESOLUTION', 'METRIC_CHALLENGE'):
            c = e.get('counts', {})
            path[e['substage']] = {k: c.get(k) for k in ('outcome', 'chosen', 'reading1', 'sourceConflict', 'registrationRefuted', 'chosenRefuted', 'preferred', 'why') if k in c}
    o['decisionPath'] = path
    o['failureMessage'] = o.get('message')
    if os.path.exists(dg):
        d = json.load(open(dg))
        o['frame'] = d.get('selectedPlanFrameId')
        for p in d.get('plans', []):
            if p['frameId'] == o['frame'] and p.get('scale'):
                o['scale'] = round(100 * (p['scale']['mppX'] + p['scale']['mppY']) / 2, 6)
            if p['frameId'] == o['frame']:
                o['semantics'] = {'wideOpenings': sorted(f"{w.get('decision')}:{round(w.get('widthM', 0), 1)}" for w in p.get('wideOpenings', [])),
                                  'bodies': sorted(f"{b.get('relation')}:{round(b.get('areaM2', 0))}" for b in (p.get('boundary') or {}).get('bodies', []))}
    md = os.path.join(run_dir, 'model.json')
    if os.path.exists(md):
        m = json.load(open(md))
        o.setdefault('semantics', {})['walls'] = dict(Counter(w.get('kind') for w in m.get('walls', [])))
        o['semantics']['openings'] = len(m.get('openings', []))
        o['semantics']['levels'] = len(m.get('levels', []))
    return o


def verdict(case, run_dir):
    if not os.path.isdir(run_dir):
        return None
    tmp = tempfile.mkdtemp(prefix='v005o-')
    try:
        for f in os.listdir(run_dir):
            if f.endswith('.json'):
                shutil.copy(os.path.join(run_dir, f), tmp)
        dg = os.path.join(run_dir, 'plan-diagnostics', 'digest.json')
        if os.path.exists(dg):
            os.makedirs(os.path.join(tmp, 'plan-diagnostics'))
            shutil.copy(dg, os.path.join(tmp, 'plan-diagnostics'))
        shutil.copy(case['package'], os.path.join(tmp, 'source-package.json'))
        shutil.copy(case['graph'], os.path.join(tmp, 'observation-graph.json'))
        shutil.copy(case['metrics'], os.path.join(tmp, 'metric-evidence.json'))
        r = subprocess.run(['node', os.path.join(REPO, 'holdout/verdict.mjs'), tmp], capture_output=True, text=True)
        return json.loads(r.stdout).get('verdict') if r.returncode == 0 and r.stdout.strip() else 'VERDICT_ERROR'
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--variants', required=True)
    ap.add_argument('--runs', default='', help='variant=runlabel overrides, comma separated (default: run label = variant)')
    ap.add_argument('--baseline', default='M0-frozen')
    ap.add_argument('--out', required=True)
    ap.add_argument('--no-verdict', action='store_true')
    a = ap.parse_args()
    cases = json.load(open(os.path.join(REPO, 'research/analyzer-005o/cases.json')))['cases']
    truth = truth_by_statement(a.work)
    variants = a.variants.split(',')
    runlabel = {v: v for v in variants}
    for kv in filter(None, a.runs.split(',')):
        k, v = kv.split('=')
        runlabel[k] = v

    # ---- reader level (sealed evidence; the same statements the generator sees) ------------------------------------
    reader = Counter()
    label_rows = []
    frame_stmts = defaultdict(list)
    for c in cases:
        m = json.load(open(c['metrics']))
        seen = set()
        for st in V.statements(m):
            e = st['e']
            if e['id'] in seen:
                continue
            seen.add(e['id'])
            tv = truth.get((c['case'], e['id']))
            if not tv:
                continue
            status = tv['status']
            if status != 'AGREED' or not INT.match(tv['value'] or ''):
                reader[f'truth_{status if status != "AGREED" else "AGREED_NOT_INTEGER"}'] += 1
                continue
            T = int(tv['value'])
            cand = V.candidates(st, None)
            lat = st['lattice'] or {}
            ext = lat.get('external') or {}
            ext_top = V.val((ext.get('topK') or [{}])[0].get('text')) if ext else None
            ens = lat.get('ensemble') or {}
            topk = {cand['TOKEN']} | set(cand['ALT']) | set(cand['LATTICE_PATHS']) | {lat.get('asReadValueCm')} | {V.val(x.get('text')) for x in (ext.get('topK') or [])}
            t = st['token']
            literal = V.val(t['text']) if t else None
            frozen_ar = V.frozen_lists(e, t['text'] if t else '')[1]
            row = {'tokenText': literal, 'frozenAsPrinted': (frozen_ar[0] if len(frozen_ar) == 1 else None), 'case': c['case'], 'family': c['family'], 'evidenceId': e['id'], 'frame': st['frame'], 'axis': st['axis'], 'chain': st['chain'], 'px': st['px'], 'truth': T,
                   'token': cand['TOKEN'], 'latticeAsRead': lat.get('asReadValueCm'), 'latticeConfident': cand['LATTICE'], 'externalTop': ext_top, 'externalCorroborating': cand['EXTERNAL'],
                   'ensembleReading': ens.get('asReadValueCm') if ens else lat.get('asReadValueCm'), 'ensembleDecision': ens.get('decision'), 'hasLattice': bool(lat), 'topKRecall': T in topk, 'origin': e['origin'], 'value': e['value']}
            label_rows.append(row)
            frame_stmts[(c['case'], st['frame'])].append((T, st['px'], st['chain'], st['axis']))
    true_scale = {}
    for k, s in frame_stmts.items():
        true_scale[k] = frame_true_scale(s)
    # post-review L10: a case whose sealed evidence is byte-identical to another's (kosacce-tracked = kosacce-clean) has
    # the same frames and the same truth; its crops were cut once, under the first case
    import hashlib
    digest = {c['case']: hashlib.sha256(open(c['metrics'], 'rb').read()).hexdigest() for c in cases}
    for c in cases:
        twin = next((o['case'] for o in cases if o['case'] != c['case'] and digest[o['case']] == digest[c['case']] and any(k[0] == o['case'] for k in true_scale)), None)
        if twin and not any(k[0] == c['case'] for k in true_scale):
            for (case, frame), v in list(true_scale.items()):
                if case == twin:
                    true_scale[(c['case'], frame)] = v
    for r in label_rows:
        ts = true_scale.get((r['case'], r['frame']), (None, 0))[0]
        r['trueScale'] = ts
        r['boundConsistent'] = None if ts is None else abs(r['truth'] / r['px'] / ts - 1) <= TOL

    def acc(field, rows=None):
        rows = label_rows if rows is None else rows
        n = len(rows)
        have = [r for r in rows if r[field] is not None]
        k = sum(1 for r in have if r[field] == r['truth'])
        w = sum(1 for r in have if r[field] != r['truth'])
        return {'n': n, 'stated': len(have), 'correct': k, 'wrong': w, 'abstain': n - len(have), 'exact': round(k / n, 4) if n else None, 'exactCI': wilson(k, n),
                'wrongWhenStated': round(w / len(have), 4) if have else None, 'wrongWhenStatedCI': wilson(w, len(have)),
                'familyClusterCI_exact': cluster_boot(rows, lambda r: r['family'], lambda s: (sum(1 for r in s if r[field] == r['truth']) / len(s)) if s else None)}

    READERS = ('frozenAsPrinted', 'tokenText', 'token', 'latticeAsRead', 'latticeConfident', 'externalTop', 'externalCorroborating', 'ensembleReading', 'value')
    readers = {f: acc(f) for f in READERS}
    # post-review L3: sensitivity without same-drawing repeats (same case, axis, truth and span within 1 px on another
    # frame) and without the two second-pipeline legacy rows whose drawings are counted through another row
    seen_ink, dedup = set(), []
    for r in sorted(label_rows, key=lambda r: (r['case'], r['frame'], r['evidenceId'])):
        k = (r['case'], r['axis'], r['truth'], round(r['px']))
        if k in seen_ink or r['case'] in ('kosacce-area-alone', 'eoze-legacy-every', 'eoze-legacy-area'):
            continue
        seen_ink.add(k)
        dedup.append(r)
    readers_dedup = {f: acc(f, dedup) for f in READERS}
    with_lat = [r for r in label_rows if r['hasLattice']]
    readers_on_lattice_subset = {f: acc(f, with_lat) for f in READERS}
    recall = {'n': len(label_rows), 'topKRecall': sum(r['topKRecall'] for r in label_rows), 'rate': round(sum(r['topKRecall'] for r in label_rows) / max(1, len(label_rows)), 4)}
    bound = Counter('UNKNOWN_SCALE' if r['boundConsistent'] is None else 'CONSISTENT' if r['boundConsistent'] else 'INCONSISTENT' for r in label_rows)

    # ---- as-printed outcome per variant -----------------------------------------------------------------------------
    printed = {}
    lr = {(r['case'], r['evidenceId']): r for r in label_rows}
    for v in variants:
        cnt = Counter()
        rows = []
        for c in cases:
            p = os.path.join(a.work, 'views', v, c['case'] + '.json')
            if not os.path.exists(p):
                continue
            seen = set()
            for rec in json.load(open(p))['records']:
                if 'evidenceId' not in rec or rec['evidenceId'] in seen:
                    continue
                seen.add(rec['evidenceId'])
                r = lr.get((c['case'], rec['evidenceId']))
                if not r:
                    continue
                ar = rec['asRead']
                o = 'ABSTAIN' if not ar else 'CORRECT' if r['truth'] in ar and len(ar) == 1 else 'WRONG'
                fo = 'ABSTAIN' if not rec['frozen']['asRead'] else 'CORRECT' if r['truth'] in rec['frozen']['asRead'] else 'WRONG'
                zl = rec.get('zero') or []
                cnt[o] += 1
                cnt[f'{fo}->{o}'] += 1
                cnt['zero_' + ('ABSTAIN' if not zl else 'CORRECT' if zl == [r['truth']] else 'WRONG')] += 1
                rows.append({'family': r['family'], 'o': o, 'fo': fo, 'rule': rec['rule'], 'bound': r['boundConsistent']})
        n = len(rows)
        printed[v] = {'n': n, **dict(cnt), 'wrongRate': round(cnt['WRONG'] / n, 4) if n else None, 'wrongCI': wilson(cnt['WRONG'], n),
                      'wrongFamilyCI': cluster_boot(rows, lambda r: r['family'], lambda s: (sum(1 for r in s if r['o'] == 'WRONG') / len(s)) if s else None),
                      'correctRate': round(cnt['CORRECT'] / n, 4) if n else None,
                      'byRule': dict(Counter(f"{r['rule']}:{r['o']}" for r in rows)),
                      'wrongAndBoundConsistent': sum(1 for r in rows if r['o'] == 'WRONG' and r['bound']), 'wrongAndBoundInconsistent': sum(1 for r in rows if r['o'] == 'WRONG' and r['bound'] is False)}

    # ---- house level (end-to-end replays) -------------------------------------------------------------------------
    houses = []
    base = {c['case']: outcome(os.path.join(a.work, 'runs', a.baseline, c['case'])) for c in cases}
    base_v = {c['case']: (None if a.no_verdict else verdict(c, os.path.join(a.work, 'runs', a.baseline, c['case']))) for c in cases}
    for c in cases:
        b = base[c['case']]
        ts, support = true_scale.get((c['case'], b['frame']), (None, 0)) if b['frame'] else (None, 0)
        h = {'case': c['case'], 'family': c['family'], 'set': c.get('set'), 'selectedFrame': b['frame'], 'trueScale': ts, 'trueScaleSupport': support,
             'M0': {**b, 'verdict': base_v[c['case']]}}
        for v in variants:
            o = outcome(os.path.join(a.work, 'runs', runlabel[v], c['case']))
            tsv = true_scale.get((c['case'], o['frame']), (None, 0))[0] if o['frame'] else None
            o['scaleClass'] = None if o['outcome'] != 'COMPLETED' else ('UNKNOWN_TRUTH' if tsv is None or o['scale'] is None else 'CORRECT_SCALE' if abs(o['scale'] / tsv - 1) <= TOL else 'FALSE_CONFIDENT_SCALE')
            o['changedVsM0'] = (o['outcome'], o['code'], o['modelHash']) != (b['outcome'], b['code'], b['modelHash'])
            o['decisionPathChangedVsM0'] = o.get('decisionPath') != b.get('decisionPath') or o.get('failureMessage') != b.get('failureMessage')
            o['semanticsChangedVsM0'] = o.get('semantics') != b.get('semantics')
            if not a.no_verdict and o['changedVsM0']:
                o['verdict'] = verdict(c, os.path.join(a.work, 'runs', runlabel[v], c['case']))
            else:
                o['verdict'] = base_v[c['case']]
            h[v] = o
        bo = h['M0']
        bo['scaleClass'] = None if bo['outcome'] != 'COMPLETED' else ('UNKNOWN_TRUTH' if ts is None or bo['scale'] is None else 'CORRECT_SCALE' if abs(bo['scale'] / ts - 1) <= TOL else 'FALSE_CONFIDENT_SCALE')
        houses.append(h)
    summary = {}
    for v in ['M0'] + variants:
        hs = [h[v] for h in houses]
        summary[v] = {'completed': sum(1 for o in hs if o['outcome'] == 'COMPLETED'), 'refused': sum(1 for o in hs if o['outcome'] == 'FAILED'),
                      'pass': sum(1 for o in hs if o.get('verdict') == 'PASS'), 'scaleClass': dict(Counter(o.get('scaleClass') for o in hs if o['outcome'] == 'COMPLETED')),
                      'changedVsM0': sum(1 for o in hs if o.get('changedVsM0')), 'decisionPathChangedVsM0': sum(1 for o in hs if o.get('decisionPathChangedVsM0')),
                      'semanticsChangedVsM0': sum(1 for o in hs if o.get('semanticsChangedVsM0')), 'refusalReasonChanged': sum(1 for o in hs if o['outcome'] == 'FAILED' and o.get('failureMessage') and v != 'M0' and o.get('decisionPathChangedVsM0') and not o.get('changedVsM0')), 'knownGoodChanged': sum(1 for h in houses if h['M0'].get('verdict') == 'PASS' and h[v].get('changedVsM0')) if v != 'M0' else 0,
                      'newFalseConfident': sum(1 for h in houses if h[v].get('scaleClass') == 'FALSE_CONFIDENT_SCALE' and h['M0'].get('scaleClass') != 'FALSE_CONFIDENT_SCALE') if v != 'M0' else 0,
                      'falseConfidentByFamily': dict(Counter(h['family'] for h in houses if h[v].get('scaleClass') == 'FALSE_CONFIDENT_SCALE'))}
    doc = {'schema': 'buildapp.005o.metric-bakeoff', 'preregistration': 'research/analyzer-005o/preregistration.md', 'tolerance': TOL,
           'labels': {'statementsWithIntegerTruth': len(label_rows), 'families': len({r['family'] for r in label_rows}), 'excluded': {k: v for k, v in reader.items()},
                      'readers': readers, 'readersOnStatementsWithLattice': readers_on_lattice_subset, 'readersDeduplicated': {'n': len(dedup), 'readers': readers_dedup}, 'topKRecallAtFirstLattice': recall, 'binding': dict(bound),
                      'framesWithTrueScale': sum(1 for v in true_scale.values() if v[0] is not None), 'framesWithStatements': len(true_scale)},
           'asPrinted': printed, 'houses': houses, 'houseSummary': summary}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(doc, open(a.out, 'w'), indent=1, sort_keys=True)
    json.dump(label_rows, open(os.path.join(a.work, 'label-rows.json'), 'w'), indent=0)
    print(json.dumps({'labels': {k: doc['labels'][k] for k in ('statementsWithIntegerTruth', 'families', 'excluded', 'binding', 'framesWithTrueScale', 'framesWithStatements')}, 'readersExact': {k: (v['exact'], v['wrongWhenStated']) for k, v in readers.items()}, 'recall': recall, 'asPrinted': {k: {x: v.get(x) for x in ('n', 'CORRECT', 'ABSTAIN', 'WRONG')} for k, v in printed.items()}, 'houseSummary': summary}, indent=1))


if __name__ == '__main__':
    main()
