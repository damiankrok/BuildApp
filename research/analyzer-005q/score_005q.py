#!/usr/bin/env python3
"""score_005q.py - BUILDPLAN-ANALYZER-005Q offline scorer (RESEARCH ONLY; the only place the published footprint meets
the variants, through the frozen holdout/verdict.mjs).

  python3 -I research/analyzer-005q/score_005q.py --work /home/user/work005q --label B0 [--baseline B0] --out <json>

Per development row (research/analyzer-005q/cases.json) of one replay label: outcome and refusal reason (005O's
`outcome`, unchanged), the frozen verdict and its footprint residual, model/program hashes, storey count, the slabs'
footprint, and the 005Q semantics this stage is about:
  - wall-surface authority: every wall ring's evidence status and interpretation (the ring is the building's facade);
  - terraces / open sides: every terrace (surface, interpretation, area) and every wide-opening decision;
  - the boundary record of the selected plan: extent conflicts, completions, bodies.
With --baseline, each row also says what changed against it (model bytes, decision path, semantics).
"""
import argparse, hashlib, json, os, re, subprocess, shutil, sys, tempfile
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'analyzer-005o'))
import score as S  # noqa: E402  005O outcome(); verdict re-implemented below to keep the full verdict record

REPO = os.path.abspath(os.path.join(HERE, '..', '..'))


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else None


def ring_area(poly):
    return abs(sum(p['x'] * poly[(i + 1) % len(poly)]['z'] - poly[(i + 1) % len(poly)]['x'] * p['z'] for i, p in enumerate(poly))) / 2


def log_stats(path):
    if not os.path.exists(path):
        return {}
    m = re.search(r'exit (\S+) wall ([\d.]+) peakRssKb (\d+)', open(path).read())
    return {'exit': m.group(1), 'wallS': float(m.group(2)), 'peakRssKb': int(m.group(3))} if m else {}


def verdict(case, run_dir):
    tmp = tempfile.mkdtemp(prefix='v005q-')
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
        return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else {'verdict': 'VERDICT_ERROR'}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def semantics(run_dir):
    out = {}
    md = os.path.join(run_dir, 'model.json')
    if os.path.exists(md):
        m = json.load(open(md))
        lowest = sorted(m.get('levels', []), key=lambda l: l.get('index', 0))
        low = lowest[0]['id'] if lowest else None
        out['levels'] = len(m.get('levels', []))
        out['footprintM2'] = round(sum(ring_area(s['polygon']) for s in m.get('slabs', []) if s.get('levelId') == low), 2)
        out['wallRings'] = [{'id': r['id'], 'status': (r.get('evidence') or {}).get('status'), 'why': (r.get('evidence') or {}).get('interpretation', '')[:120]} for r in m.get('wallRings', [])]
        out['terraces'] = [{'surface': t.get('surface'), 'why': (t.get('evidence') or {}).get('interpretation', '')[:80], 'areaM2': round(ring_area(t['polygon']), 2)} for t in m.get('terraces', [])]
        out['counts'] = {k: len(v) for k, v in m.items() if isinstance(v, list) and v}
    dg = os.path.join(run_dir, 'plan-diagnostics', 'digest.json')
    if os.path.exists(dg):
        d = json.load(open(dg))
        sel = d.get('selectedPlanFrameId')
        for p in d.get('plans', []):
            if p['frameId'] != sel:
                continue
            out['wideOpenings'] = sorted(f"{w.get('decision')}:{round(w.get('widthM', 0), 2)}" for w in p.get('wideOpenings', []))
            b = p.get('boundary') or {}
            out['bodies'] = sorted(f"{x.get('relation')}:{'B' if x.get('built') else '-'}:{round(x.get('areaM2', 0), 1)}" for x in b.get('bodies', []))
            out['extentConflicts'] = sorted(f"{c.get('side')}:{c.get('strength')}:{c.get('decision')}:{round(c.get('gapM', 0), 2)}" for c in b.get('extentConflicts', []))
            out['completions'] = sorted(f"{c.get('kind')}:{c.get('decision')}:{round(c.get('areaM2', 0), 1)}" for c in b.get('completions', []))
    un = os.path.join(run_dir, 'unresolved.json')
    if os.path.exists(un):
        out['unresolved'] = sorted(f"{u['status']}:{u['what'][:90]}" for u in json.load(open(un)))
    pv = os.path.join(run_dir, 'provenance.json')
    if os.path.exists(pv):
        out['massProvenance'] = sorted(f"{m['id']}:{m['provenance']}" for m in json.load(open(pv))['masses'])
    return out


def row(case, run_dir, with_verdict=True):
    o = S.outcome(run_dir)
    r = {'case': case['case'], 'set': case['set'], 'outcome': o['outcome'], 'code': o.get('code'), 'refusal': (o.get('failureMessage') or '')[:300] or None,
         'modelHash': o.get('modelHash'), 'modelSha256': sha(os.path.join(run_dir, 'model.json')), 'programSha256': sha(os.path.join(run_dir, 'program.json')),
         'failureSha256': sha(os.path.join(run_dir, 'failure.json')), 'frame': o.get('frame'), 'scaleCmPerPx': o.get('scale'), 'decisionPath': o.get('decisionPath'),
         'semantics': semantics(run_dir), **log_stats(run_dir + '.log')}
    if with_verdict:
        v = verdict(case, run_dir)
        r['verdict'] = v.get('verdict')
        fp = (v.get('conditions') or {}).get('footprint') or {}
        r['footprintResidualPct'] = fp.get('residualPct')
        r['storeys'] = (v.get('conditions') or {}).get('storeys')
        r['failedConditions'] = sorted(k for k, c in (v.get('conditions') or {}).items() if not c.get('holds'))
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--label', required=True)
    ap.add_argument('--baseline')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    cases = json.load(open(os.path.join(REPO, 'research/analyzer-005q/cases.json')))['cases']
    rows = []
    base = json.load(open(a.baseline)) if a.baseline and a.baseline.endswith('.json') else None
    bmap = {r['case']: r for r in base['rows']} if base else {}
    for c in cases:
        d = os.path.join(a.work, 'runs', a.label, c['case'])
        r = row(c, d)
        b = bmap.get(c['case'])
        if b:
            r['vsBaseline'] = {'modelChanged': r['modelSha256'] != b['modelSha256'], 'programChanged': r['programSha256'] != b['programSha256'],
                               'failureChanged': r['failureSha256'] != b['failureSha256'], 'decisionPathChanged': r['decisionPath'] != b['decisionPath'],
                               'semanticsChanged': r['semantics'] != b['semantics'], 'verdict': [b.get('verdict'), r.get('verdict')]}
        rows.append(r)
        print(c['case'], r['outcome'], r.get('verdict'), r.get('footprintResidualPct'), file=sys.stderr)
    dev44 = [r for r in rows if r['set'] != 'BLIND_11_REVEALED']
    summary = {'rows': len(rows), 'completed': sum(r['outcome'] == 'COMPLETED' for r in rows), 'pass': sum(r.get('verdict') == 'PASS' for r in rows),
               'dev44': {'completed': sum(r['outcome'] == 'COMPLETED' for r in dev44), 'pass': sum(r.get('verdict') == 'PASS' for r in dev44), 'verdicts': dict(Counter(r.get('verdict') for r in dev44))},
               'passRows': sorted(r['case'] for r in rows if r.get('verdict') == 'PASS')}
    if base:
        summary['vsBaseline'] = {k: sorted(r['case'] for r in rows if r.get('vsBaseline', {}).get(k)) for k in ('modelChanged', 'programChanged', 'failureChanged', 'decisionPathChanged', 'semanticsChanged')}
        summary['vsBaseline']['verdictChanged'] = {r['case']: r['vsBaseline']['verdict'] for r in rows if r.get('vsBaseline') and r['vsBaseline']['verdict'][0] != r['vsBaseline']['verdict'][1]}
    json.dump({'label': a.label, 'baseline': a.baseline, 'summary': summary, 'rows': rows}, open(a.out, 'w'), indent=1, sort_keys=True)
    print(json.dumps(summary, indent=1))


if __name__ == '__main__':
    main()
