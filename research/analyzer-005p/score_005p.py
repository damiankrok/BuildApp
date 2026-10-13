#!/usr/bin/env python3
"""score_005p.py - BUILDPLAN-ANALYZER-005P offline scorer (RESEARCH ONLY; the only place truth meets the variants).

  python3 -I research/analyzer-005p/score_005p.py --work /home/user/work005p --truth-work /home/user/work005o \
      --variants P0H,P1,P2,P3,N1 --baseline P0-frozen --policies P0H --out stage-reports/artifacts/analyzer-005p/dev-matrix.json

House level: 005O's own `outcome` / `verdict` / transcription-scale definitions (imported from research/analyzer-005o/
score.py, unchanged), per variant, against the baseline label; plus the model/program hashes, wall time and peak RSS
from the replay log, and the contested statements in the conflict evidence. Label level (descriptive, preregistration
section 6): for every truth-labelled statement, whether a WRONG as-printed value can (a) accuse another scale, (b) refute
a reading at the true scale, under each consumer mode.
"""
import argparse, hashlib, json, os, re, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'analyzer-005o'))
import as_printed_views as V  # noqa: E402
import score as S  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
TOL = S.TOL


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else None


def log_stats(path):
    if not os.path.exists(path):
        return {}
    m = re.search(r'exit (\S+) wall ([\d.]+) peakRssKb (\d+)', open(path).read())
    return {'exit': m.group(1), 'wallS': float(m.group(2)), 'peakRssKb': int(m.group(3))} if m else {}


def true_scales(cases, truth):
    frame_stmts = {}
    for c in cases:
        m = json.load(open(c['metrics']))
        seen = set()
        for st in V.statements(m):
            e = st['e']
            if e['id'] in seen:
                continue
            seen.add(e['id'])
            tv = truth.get((c['case'], e['id']))
            if not tv or tv['status'] != 'AGREED' or not S.INT.match(tv['value'] or ''):
                continue
            frame_stmts.setdefault((c['case'], st['frame']), []).append((int(tv['value']), st['px'], st['chain'], st['axis']))
    ts = {k: S.frame_true_scale(v) for k, v in frame_stmts.items()}
    # 005O post-review L10: byte-identical evidence twins share frames and truth
    digest = {c['case']: sha(c['metrics']) for c in cases}
    for c in cases:
        twin = next((o['case'] for o in cases if o['case'] != c['case'] and digest[o['case']] == digest[c['case']] and any(k[0] == o['case'] for k in ts)), None)
        if twin and not any(k[0] == c['case'] for k in ts):
            for (case, frame), v in list(ts.items()):
                if case == twin:
                    ts[(c['case'], frame)] = v
    return ts


def house(run_dir, case, ts):
    o = S.outcome(run_dir)
    tsv = ts.get((case['case'], o['frame']), (None, 0))[0] if o['frame'] else None
    o['trueScale'] = tsv
    o['scaleClass'] = None if o['outcome'] != 'COMPLETED' else ('UNKNOWN_TRUTH' if tsv is None or o['scale'] is None else 'CORRECT_SCALE' if abs(o['scale'] / tsv - 1) <= TOL else 'FALSE_CONFIDENT_SCALE')
    o['programHash'] = sha(os.path.join(run_dir, 'program.json'))
    o['modelFileHash'] = sha(os.path.join(run_dir, 'model.json'))
    o['failureHash'] = sha(os.path.join(run_dir, 'failure.json'))
    o['digestHash'] = sha(os.path.join(run_dir, 'plan-diagnostics', 'digest.json'))
    o['traceHash'] = sha(os.path.join(run_dir, 'analysis-trace.json'))
    o.update(log_stats(run_dir + '.log'))
    triggers = set()
    evid = set()
    for sub in o.get('decisionPath', {}).values():
        for t in (sub.get('sourceConflict') or '').split(','):
            if t:
                triggers.add(t)
    tr = os.path.join(run_dir, 'analysis-trace.json')
    if os.path.exists(tr):
        for e in json.load(open(tr)).get('entries', []):
            c = e.get('counts', {})
            if c.get('conflictEvidence'):
                evid.update(c['conflictEvidence'].split(','))
    o['conflictTriggers'] = sorted(triggers)
    o['conflictEvidence'] = sorted(evid)
    return o


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--truth-work', required=True)
    ap.add_argument('--variants', required=True)
    ap.add_argument('--baseline', default='P0-frozen')
    ap.add_argument('--policies', default='P0H', help='policy label whose records give the contested sets (identical for every variant)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--no-verdict', action='store_true')
    a = ap.parse_args()
    cases = json.load(open(os.path.join(REPO, 'research/analyzer-005o/cases.json')))['cases']
    truth = S.truth_by_statement(a.truth_work)
    ts = true_scales(cases, truth)
    variants = a.variants.split(',')

    # ---- label level ------------------------------------------------------------------------------------------------
    # roles: accuse = T3 OUTER_TOTALS accuser; refute = T1 refutation of the registration; rank = ranking's refuted share
    MODES = {'P0': {}, 'P1': {'accuse': 'DROP', 'refute': 'DROP'}, 'P2': {'accuse': 'DROP', 'refute': 'DROP', 'rank': 'DROP'},
             'P3': {'accuse': 'DROP', 'refute': 'DROP', 'rank': 'DROP'}, 'N1': {'accuse': 'KSET_ALL', 'refute': 'KSET_ANY'}}
    lab = Counter()
    label_rows = []
    for c in cases:
        p = os.path.join(a.work, 'policies', a.policies, c['case'] + '.json')
        seen = set()
        for rec in json.load(open(p))['records']:
            if rec['evidenceId'] in seen:
                continue
            seen.add(rec['evidenceId'])
            tv = truth.get((c['case'], rec['evidenceId']))
            if not tv or tv['status'] != 'AGREED' or not S.INT.match(tv['value'] or ''):
                continue
            T = int(tv['value'])
            ar = rec['frozen']['asRead']
            wrong = bool(ar) and T not in ar
            row = {'case': c['case'], 'family': c['family'], 'evidenceId': rec['evidenceId'], 'truth': T, 'frozenAsRead': ar, 'K': rec['K'], 'contested': rec['contested'], 'wrongStated': wrong,
                   'truthInK': T in rec['K']}
            label_rows.append(row)
            lab['labels'] += 1
            lab['stated'] += bool(ar)
            lab['wrongStated'] += wrong
            for v, m in MODES.items():
                for role in ('accuse', 'refute', 'rank'):
                    mode = m.get(role, 'FROZEN')
                    if not wrong:
                        continue
                    if mode == 'FROZEN' or not rec['contested']:
                        can = True
                    elif mode == 'DROP':
                        can = False
                    else:  # KSET_ALL / KSET_ANY: a contested wrong value acts only when no confident reading is the truth
                        can = T not in rec['K']
                    lab[f'{v}:{role}'] += can
    # ---- house level ------------------------------------------------------------------------------------------------
    houses = []
    for c in cases:
        base_dir = os.path.join(a.work, 'runs', a.baseline, c['case'])
        b = house(base_dir, c, ts)
        b['verdict'] = None if a.no_verdict else S.verdict(c, base_dir)
        policy = json.load(open(os.path.join(a.work, 'policies', a.policies, c['case'] + '.json')))
        contested = {r['evidenceId']: r['K'] for r in policy['records'] if r['contested']}
        h = {'case': c['case'], 'family': c['family'], 'set': c.get('set'), 'contestedStatements': len(contested), a.baseline: b}
        b['contestedConflictEvidence'] = {i: contested[i] for i in b['conflictEvidence'] if i in contested}
        for v in variants:
            d = os.path.join(a.work, 'runs', v, c['case'])
            o = house(d, c, ts)
            o['contestedConflictEvidence'] = {i: contested[i] for i in o['conflictEvidence'] if i in contested}
            o['modelChanged'] = (o['outcome'], o['code'], o['modelHash']) != (b['outcome'], b['code'], b['modelHash'])
            o['bytesChanged'] = any(o[k] != b[k] for k in ('programHash', 'modelFileHash', 'failureHash', 'digestHash', 'traceHash'))
            o['decisionPathChanged'] = o.get('decisionPath') != b.get('decisionPath') or o.get('failureMessage') != b.get('failureMessage')
            o['semanticsChanged'] = o.get('semantics') != b.get('semantics')
            o['frameChanged'] = o.get('frame') != b.get('frame')
            o['newTriggers'] = sorted(set(o['conflictTriggers']) - set(b['conflictTriggers']))
            o['verdict'] = (S.verdict(c, d) if o['modelChanged'] or o['bytesChanged'] else b['verdict']) if not a.no_verdict else None
            h[v] = o
        houses.append(h)
    summary = {}
    for v in [a.baseline] + variants:
        hs = [(h, h[v]) for h in houses]
        bl = a.baseline
        summary[v] = {
            'completed': sum(1 for _, o in hs if o['outcome'] == 'COMPLETED'), 'refused': sum(1 for _, o in hs if o['outcome'] == 'FAILED'),
            'pass': sum(1 for _, o in hs if o.get('verdict') == 'PASS'),
            'scaleClass': dict(Counter(o.get('scaleClass') for _, o in hs if o['outcome'] == 'COMPLETED')),
            'withConflict': sum(1 for _, o in hs if o['conflictTriggers']),
            **({} if v == bl else {
                'bytesChanged': [h['case'] for h, o in hs if o['bytesChanged']],
                'modelChanged': [h['case'] for h, o in hs if o['modelChanged']],
                'decisionPathChanged': [h['case'] for h, o in hs if o['decisionPathChanged']],
                'semanticsChanged': [h['case'] for h, o in hs if o['semanticsChanged']],
                'frameChanged': [h['case'] for h, o in hs if o['frameChanged']],
                'newTriggers': {h['case']: o['newTriggers'] for h, o in hs if o['newTriggers']},
                'knownGoodModelChanged': [h['case'] for h, o in hs if h[bl].get('verdict') == 'PASS' and o['modelChanged']],
                'knownGoodPathChanged': [h['case'] for h, o in hs if h[bl].get('verdict') == 'PASS' and o['decisionPathChanged']],
                'newFalseConfident': [h['case'] for h, o in hs if o.get('scaleClass') == 'FALSE_CONFIDENT_SCALE' and h[bl].get('scaleClass') != 'FALSE_CONFIDENT_SCALE'],
                'newlyCompleted': [h['case'] for h, o in hs if o['outcome'] == 'COMPLETED' and h[bl]['outcome'] != 'COMPLETED'],
                'newlyRefused': [h['case'] for h, o in hs if o['outcome'] != 'COMPLETED' and h[bl]['outcome'] == 'COMPLETED'],
                'verdictChanged': {h['case']: [h[bl].get('verdict'), o.get('verdict')] for h, o in hs if o.get('verdict') != h[bl].get('verdict')},
            })}
    doc = {'schema': 'buildapp.005p.dev-matrix', 'preregistration': 'research/analyzer-005p/preregistration.md', 'baseline': a.baseline, 'variants': variants, 'tolerance': TOL,
           'labels': dict(lab), 'houses': houses, 'summary': summary}
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(doc, open(a.out, 'w'), indent=1, sort_keys=True)
    json.dump(label_rows, open(os.path.join(a.work, 'label-rows-005p.json'), 'w'), indent=0)
    print(json.dumps({'labels': dict(lab), 'summary': summary}, indent=1, sort_keys=True))


if __name__ == '__main__':
    main()
