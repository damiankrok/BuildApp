#!/usr/bin/env python3
"""score_houses.py - BUILDPLAN-ANALYZER-005Q-CHAIN full-house scorer and safety gates (RESEARCH ONLY).

  python3 -I research/analyzer-005q-chain/score_houses.py --runs /home/user/work005q-chain/runs --label C1 \
      [--baseline C0] --out stage-reports/artifacts/analyzer-005q-chain/house-semantic-delta/C1.json

Per development row of research/analyzer-005q-chain/cases.json and one replay label (runs/<label>/<case>/{extract,solve}):
  outcome / refusal code / decision path (005O `outcome`), the frozen holdout/verdict.mjs verdict and footprint residual
  (the ONLY place a published figure meets a variant, offline, after the run), model/program/failure sha256, the 005Q
  semantics (wall rings with their evidence status, terraces, wide openings, boundary bodies, unresolved gaps, MASS
  provenance), and the 005Q-CHAIN metric semantics of the run's OWN extracted evidence: per plan frame the registration
  (scale, confidence, anchors by origin: READ / READ_DEPENDS_ON_SCALE / CHAIN_CORRECTED / LEVEL...), the metric solution
  (relation, class, independent witnesses), SOURCE_EXACT counts, and a semantic model summary (storeys, walls by kind,
  openings by kind with widths, rooms, terraces, roofs, footprint) for the semantic diff.
With --baseline, each row says what changed (model bytes, failure, decision path, semantics, metric) and the gates G1-G5
are evaluated (gates are definitions in preregistration.md §6; this file computes them, it does not choose them).
"""
import argparse, gzip, hashlib, json, os, shutil, subprocess, sys, tempfile
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(HERE, '..', 'analyzer-005q'))
sys.path.insert(0, os.path.join(HERE, '..', 'analyzer-005o'))
import score_005q as Q  # noqa: E402  (semantics(), sha(), ring_area())
import score as S  # noqa: E402  (005O outcome())


def load_metrics(base, case):
    p = os.path.join(base, 'extract', 'metric-evidence.json.gz')
    if os.path.exists(p):
        return json.loads(gzip.open(p).read()), p
    return json.load(open(case['metrics'])), case['metrics']


def verdict(case, solve_dir, metrics_path):
    tmp = tempfile.mkdtemp(prefix='v005qc-')
    try:
        for f in os.listdir(solve_dir):
            if f.endswith('.json'):
                shutil.copy(os.path.join(solve_dir, f), tmp)
        dg = os.path.join(solve_dir, 'plan-diagnostics', 'digest.json')
        if os.path.exists(dg):
            os.makedirs(os.path.join(tmp, 'plan-diagnostics'))
            shutil.copy(dg, os.path.join(tmp, 'plan-diagnostics'))
        shutil.copy(case['package'], os.path.join(tmp, 'source-package.json'))
        shutil.copy(case['graph'], os.path.join(tmp, 'observation-graph.json'))
        dst = os.path.join(tmp, 'metric-evidence.json')
        if metrics_path.endswith('.gz'):
            open(dst, 'wb').write(gzip.open(metrics_path).read())
        else:
            shutil.copy(metrics_path, dst)
        r = subprocess.run(['node', os.path.join(REPO, 'holdout/verdict.mjs'), tmp], capture_output=True, text=True)
        return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else {'verdict': 'VERDICT_ERROR'}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def metric_semantics(m):
    """Per plan frame: registration and metric solution, from the run's own evidence."""
    ev = {e['id']: e for e in m['evidence']}
    out = {}
    sols = {s['frameId']: s for s in m.get('metricSolutions', [])}
    for r in m.get('coordinateRegistrations', []):
        if r.get('plane') != 'PLAN_XZ':
            continue
        by = Counter()
        for a in r.get('anchors', []):
            for eid in a.get('evidenceIds', []):
                e = ev.get(eid, {})
                o = e.get('origin', '?')
                if o == 'READ' and (e.get('derivation') or {}).get('dependsOnScale'):
                    o = 'READ_DEPENDS_ON_SCALE'
                by[o] += 1
        s = sols.get(r['frameId'])
        out[r['frameId']] = {'mppX': r['metresPerPixelX'], 'mppY': r['metresPerPixelY'], 'confidence': r['confidence'], 'anchors': dict(by),
                             'solution': {k: s.get(k) for k in ('relation', 'confidence', 'independentWitnesses', 'cmPerPixelX', 'cmPerPixelY')} if s else None}
    for fid, s in sols.items():
        if fid not in out:
            out[fid] = {'registration': None, 'solution': {k: s.get(k) for k in ('relation', 'confidence', 'independentWitnesses', 'cmPerPixelX', 'cmPerPixelY')}}
    return out


def evidence_gates(m):
    """G2 at the evidence level: anchors that cite a scale-dependent value; INK_FIRST statements that disagree with
    their lattice record's ensemble reading (a silently changed printed number); level datums that anchor while
    CHAIN_CORRECTED."""
    ev = {e['id']: e for e in m['evidence']}
    lat_by_key = {}
    for l in m.get('numericLattices', []):
        lat_by_key[(l['frameId'], l['box']['x0'], l['box']['y0'], l['box']['x1'], l['box']['y1'], l['orientation'])] = l
    tok = {t['id']: t for t in m['ocrTokens']}
    scale_dep_anchor, ink_mismatch, ink_first = 0, 0, 0
    for r in m.get('coordinateRegistrations', []):
        for a in r.get('anchors', []):
            for eid in a.get('evidenceIds', []):
                e = ev.get(eid)
                if e and (e['origin'] == 'CHAIN_CORRECTED' or (e.get('derivation') or {}).get('dependsOnScale')):
                    scale_dep_anchor += 1
    for e in m['evidence']:
        d = e.get('derivation') or {}
        if not str(d.get('why', '')).startswith('INK_FIRST'):
            continue
        ink_first += 1
        t = tok.get((e.get('ocrTokenIds') or [None])[0])
        l = t and lat_by_key.get((t['frameId'], t['box']['x0'], t['box']['y0'], t['box']['x1'], t['box']['y1'], t['orientation']))
        ens = (l or {}).get('ensemble') or {}
        if not l or ens.get('asReadValueCm') != e['value'] or ens.get('decision') not in ('AGREES', 'LEADS') or e['origin'] != 'READ':
            ink_mismatch += 1
    orient = Counter(d.get('decidedBy') for s in m.get('metricSolutions', []) for d in s.get('orientationDecisions', []))
    return {'scaleDependentAnchors': scale_dep_anchor, 'inkFirstStatements': ink_first, 'inkFirstMismatch': ink_mismatch, 'orientationDecidedBy': {str(k): v for k, v in orient.items()},
            'chainCorrected': sum(1 for e in m['evidence'] if e['origin'] == 'CHAIN_CORRECTED'), 'read': sum(1 for e in m['evidence'] if e['origin'] == 'READ' and e['kind'] == 'LINEAR_DIMENSION')}


def model_summary(solve_dir):
    p = os.path.join(solve_dir, 'model.json')
    if not os.path.exists(p):
        return None
    m = json.load(open(p))
    levels = sorted(m.get('levels', []), key=lambda l: l.get('index', 0))
    low = levels[0]['id'] if levels else None
    exact = Counter()
    for k, v in m.items():
        if isinstance(v, list):
            for x in v:
                st = (x.get('evidence') or {}).get('status') if isinstance(x, dict) else None
                if st:
                    exact[f'{k}:{st}'] += 1
    return {
        'storeys': len(levels), 'levelHeights': [round(l.get('height', 0), 2) for l in levels],
        'walls': dict(Counter(w.get('kind') for w in m.get('walls', []))),
        'openings': sorted(f"{o.get('kind')}:{round(o.get('width', 0), 2)}:{o.get('wallId')}" for o in m.get('openings', [])),
        'openingKinds': dict(Counter(o.get('kind') for o in m.get('openings', []))),
        'rooms': len(m.get('rooms', [])), 'terraces': sorted(f"{t.get('surface')}:{round(Q.ring_area(t['polygon']), 2)}" for t in m.get('terraces', [])),
        'roofs': sorted(f"{r.get('kind')}:{round(r.get('pitchDeg') or 0, 1)}" for r in m.get('roofs', [])),
        'balconies': len(m.get('balconies', [])), 'stairs': len(m.get('stairs', [])),
        'footprintM2': round(sum(Q.ring_area(s['polygon']) for s in m.get('slabs', []) if s.get('levelId') == low), 2),
        'evidenceStatus': dict(exact),
    }


def row(case, base):
    solve = os.path.join(base, 'solve')
    o = S.outcome(solve)
    m, mpath = load_metrics(base, case)
    r = {'case': case['case'], 'set': case['set'], 'family': case['family'], 'mode': case['mode'], 'outcome': o['outcome'], 'code': o.get('code'),
         'refusal': (o.get('failureMessage') or '')[:300] or None, 'modelSha256': Q.sha(os.path.join(solve, 'model.json')), 'programSha256': Q.sha(os.path.join(solve, 'program.json')),
         'failureSha256': Q.sha(os.path.join(solve, 'failure.json')), 'unresolvedSha256': Q.sha(os.path.join(solve, 'unresolved.json')),
         'extractModelSha256': Q.sha(os.path.join(base, 'extract', 'model.json')), 'metricContentHash': m.get('contentHash'),
         'frame': o.get('frame'), 'scaleCmPerPx': o.get('scale'), 'decisionPath': o.get('decisionPath'), 'semantics': Q.semantics(solve),
         'metric': metric_semantics(m), 'evidenceGates': evidence_gates(m), 'model': model_summary(solve)}
    v = verdict(case, solve, mpath)
    r['verdict'] = v.get('verdict')
    fp = (v.get('conditions') or {}).get('footprint') or {}
    r['footprintResidualPct'] = fp.get('residualPct')
    r['failedConditions'] = sorted(k for k, c in (v.get('conditions') or {}).items() if not c.get('holds'))
    return r


def changed(a, b):
    return {
        'modelChanged': a['modelSha256'] != b['modelSha256'], 'failureChanged': a['failureSha256'] != b['failureSha256'],
        'unresolvedChanged': a['unresolvedSha256'] != b['unresolvedSha256'], 'outcomeChanged': a['outcome'] != b['outcome'] or a['code'] != b['code'],
        'decisionPathChanged': a['decisionPath'] != b['decisionPath'], 'semanticsChanged': a['semantics'] != b['semantics'],
        'metricChanged': a['metric'] != b['metric'], 'metricContentChanged': a['metricContentHash'] != b['metricContentHash'],
        'verdict': [b.get('verdict'), a.get('verdict')], 'scale': [b.get('scaleCmPerPx'), a.get('scaleCmPerPx')],
        'modelSemantic': None if a['model'] == b['model'] else {k: [(b['model'] or {}).get(k), (a['model'] or {}).get(k)] for k in set((a['model'] or {}).keys()) | set((b['model'] or {}).keys()) if (a['model'] or {}).get(k) != (b['model'] or {}).get(k)},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--runs', required=True)
    ap.add_argument('--label', required=True)
    ap.add_argument('--baseline')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    cases = json.load(open(os.path.join(HERE, 'cases.json')))['cases']
    base = json.load(open(a.baseline)) if a.baseline else None
    bmap = {r['case']: r for r in base['rows']} if base else {}
    rows = []
    for c in cases:
        d = os.path.join(a.runs, a.label, c['case'])
        if not os.path.exists(os.path.join(d, 'solve')):
            rows.append({'case': c['case'], 'outcome': 'NO_RUN'})
            continue
        r = row(c, d)
        if c['case'] in bmap and bmap[c['case']].get('outcome') != 'NO_RUN':
            r['vsBaseline'] = changed(r, bmap[c['case']])
        rows.append(r)
        print(c['case'], r['outcome'], r.get('verdict'), r.get('footprintResidualPct'), file=sys.stderr)
    known_good = sorted(r['case'] for r in (base['rows'] if base else rows) if r.get('verdict') == 'PASS')
    summary = {'rows': len(rows), 'completed': sum(r.get('outcome') == 'COMPLETED' for r in rows), 'pass': sum(r.get('verdict') == 'PASS' for r in rows),
               'verdicts': dict(Counter(str(r.get('verdict')) for r in rows)), 'passRows': sorted(r['case'] for r in rows if r.get('verdict') == 'PASS'),
               'scaleDependentAnchors': sum((r.get('evidenceGates') or {}).get('scaleDependentAnchors', 0) for r in rows),
               'inkFirstMismatch': sum((r.get('evidenceGates') or {}).get('inkFirstMismatch', 0) for r in rows),
               'inkFirstStatements': sum((r.get('evidenceGates') or {}).get('inkFirstStatements', 0) for r in rows)}
    if base:
        vb = {k: sorted(r['case'] for r in rows if r.get('vsBaseline', {}).get(k)) for k in ('modelChanged', 'failureChanged', 'unresolvedChanged', 'outcomeChanged', 'decisionPathChanged', 'semanticsChanged', 'metricChanged', 'metricContentChanged')}
        vb['verdictChanged'] = {r['case']: r['vsBaseline']['verdict'] for r in rows if r.get('vsBaseline') and r['vsBaseline']['verdict'][0] != r['vsBaseline']['verdict'][1]}
        vb['knownGoodBaseline'] = known_good
        vb['knownGoodModelChanged'] = sorted(c for c in vb['modelChanged'] if c in known_good)
        vb['knownGoodSemanticChanged'] = sorted(r['case'] for r in rows if r['case'] in known_good and r.get('vsBaseline', {}).get('modelSemantic'))
        summary['vsBaseline'] = vb
    json.dump({'schema': 'buildapp.005q-chain.house-score', 'version': 1, 'label': a.label, 'baseline': a.baseline, 'summary': summary, 'rows': rows}, open(a.out, 'w'), indent=1, sort_keys=True)
    print(json.dumps({k: v for k, v in summary.items() if k != 'vsBaseline'}, sort_keys=True))
    if base:
        print(json.dumps({k: v for k, v in summary['vsBaseline'].items() if k != 'knownGoodBaseline'}, sort_keys=True))


if __name__ == '__main__':
    main()
