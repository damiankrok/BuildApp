#!/usr/bin/env python3
"""compare.py - BUILDPLAN-ANALYZER-005Q candidate comparison and mechanical gates (RESEARCH ONLY).

  python3 -I research/analyzer-005q/compare.py --baseline stage-reports/artifacts/analyzer-005q/baseline-44.json \
      --scored C1=<C1 score json> --scored C2=<...> ... [--repeat C1=<C1-rep score json>] --out <json>

Each scored file is score_005q.py's output for one candidate label. Per candidate: every row that changed against the
baseline (model, program, failure, decision path, semantics), what changed in it (verdict, footprint, terraces, wall
ring statuses, typed gaps, wide openings, bodies, completions), and the gates that can be decided mechanically
(preregistration section 4): G1 known-good, G2 scale, G4 (no new terrace; no new SOURCE_EXACT ring), G5 glogownikach,
G8 storeys, G9 determinism (when a repeat is given). G3, G6 and G7 need the changed rows read against the drawing;
they are listed here, and decided in negative-controls.json.
"""
import argparse, json


def by_case(d):
    return {r['case']: r for r in d['rows']}


def delta(b, n):
    sb, sn = b.get('semantics') or {}, n.get('semantics') or {}
    out = {}
    for k in sorted(set(sb) | set(sn)):
        if sb.get(k) != sn.get(k):
            out[k] = {'old': sb.get(k), 'new': sn.get(k)}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--baseline', required=True)
    ap.add_argument('--scored', action='append', default=[])
    ap.add_argument('--repeat', action='append', default=[])
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    base = by_case(json.load(open(a.baseline)))
    known_good = sorted(c for c, r in base.items() if r.get('verdict') == 'PASS')
    repeats = {k: by_case(json.load(open(v))) for k, v in (x.split('=', 1) for x in a.repeat)}
    result = {'baseline': a.baseline, 'knownGood': known_good, 'candidates': {}}
    for spec in a.scored:
        label, path = spec.split('=', 1)
        cand = by_case(json.load(open(path)))
        changed = {}
        for case, b in base.items():
            n = cand[case]
            flags = {k: n.get(f'{k}Sha256') != b.get(f'{k}Sha256') for k in ('model', 'program', 'failure')}
            flags['decisionPath'] = n.get('decisionPath') != b.get('decisionPath')
            sem = delta(b, n)
            flags['semantics'] = bool(sem)
            if any(flags.values()):
                changed[case] = {
                    'flags': flags,
                    'outcome': [b['outcome'], n['outcome']],
                    'verdict': [b.get('verdict'), n.get('verdict')],
                    'footprintResidualPct': [b.get('footprintResidualPct'), n.get('footprintResidualPct')],
                    'refusal': [b.get('refusal'), n.get('refusal')] if b.get('refusal') != n.get('refusal') else None,
                    'semantics': sem,
                }
        g = {}
        g['G1_knownGood'] = {'holds': all(cand[c]['modelSha256'] == base[c]['modelSha256'] and cand[c].get('verdict') == 'PASS' for c in known_good),
                             'changed': [c for c in known_good if cand[c]['modelSha256'] != base[c]['modelSha256'] or cand[c].get('verdict') != 'PASS']}
        g['G2_scale'] = {'holds': all(cand[c].get('frame') == base[c].get('frame') and cand[c].get('scaleCmPerPx') == base[c].get('scaleCmPerPx') for c in base),
                         'changed': [c for c in base if cand[c].get('frame') != base[c].get('frame') or cand[c].get('scaleCmPerPx') != base[c].get('scaleCmPerPx')]}
        new_terraces = {}
        new_exact = {}
        for c in base:
            # a new terrace: more terraces than before, or one whose (surface, interpretation) the row did not have
            # (a terrace whose area moved with a changed body face is the same terrace, not a new one)
            tb = (base[c].get('semantics') or {}).get('terraces', []) or []
            tn = (cand[c].get('semantics') or {}).get('terraces', []) or []
            kinds = {(t.get('surface'), t.get('why')) for t in tb}
            added = [t for t in tn if (t.get('surface'), t.get('why')) not in kinds]
            if len(tn) > len(tb) or added:
                new_terraces[c] = {'old': tb, 'new': tn}
            rb = [w['status'] for w in (base[c].get('semantics') or {}).get('wallRings', []) or []]
            rn = [w['status'] for w in (cand[c].get('semantics') or {}).get('wallRings', []) or []]
            if rn.count('SOURCE_EXACT') > rb.count('SOURCE_EXACT'):
                new_exact[c] = [rb, rn]
        g['G4_noNewTerrace'] = {'holds': not new_terraces, 'rows': new_terraces}
        g['G4_noNewExactRing'] = {'holds': not new_exact, 'rows': new_exact}
        gl = cand.get('dom-w-glogownikach')
        if gl:
            sem = gl.get('semantics') or {}
            terr = [t for t in sem.get('terraces', []) or []]
            rings = [w['status'] for w in sem.get('wallRings', []) or []]
            gaps = [u for u in sem.get('unresolved', []) or [] if 'outer face' in u]
            g['G5_glogownikach'] = {'outcome': gl['outcome'], 'verdict': gl.get('verdict'), 'footprintResidualPct': gl.get('footprintResidualPct'), 'terraces': terr, 'rings': rings, 'outerFaceGaps': gaps,
                                    # preregistration G5, no exemption for a PASS verdict (a footprint inside 6 % with a wall short is
                                    # the threshold artefact the gate exists for): a completed model carries no recess-floor terrace
                                    # on the strips and no SOURCE_EXACT ring while an outer face is unresolved, and names the faces
                                    'holds': gl['outcome'] != 'COMPLETED' or (not any('recess' in t.get('why', '') for t in terr) and 'SOURCE_EXACT' not in rings and len(gaps) > 0)}
        g['G8_storeys'] = {'holds': all((cand[c].get('semantics') or {}).get('levels') == (base[c].get('semantics') or {}).get('levels') for c in base if c not in changed),
                           'changedLevels': [c for c in changed if (cand[c].get('semantics') or {}).get('levels') != (base[c].get('semantics') or {}).get('levels')]}
        if label in repeats:
            rep = repeats[label]
            diffs = [c for c in cand if any(cand[c].get(f'{k}Sha256') != rep[c].get(f'{k}Sha256') for k in ('model', 'program', 'failure')) or cand[c].get('decisionPath') != rep[c].get('decisionPath') or cand[c].get('semantics') != rep[c].get('semantics')]
            g['G9_determinism'] = {'holds': not diffs, 'rows': diffs}
        result['candidates'][label] = {
            'changedRows': sorted(changed),
            'verdictTransitions': {c: v['verdict'] for c, v in changed.items() if v['verdict'][0] != v['verdict'][1]},
            'pass': sum(1 for c in cand.values() if c.get('verdict') == 'PASS'),
            'completed': sum(1 for c in cand.values() if c['outcome'] == 'COMPLETED'),
            'gates': g,
            'changes': changed,
        }
        print(label, 'changed', sorted(changed), 'G1', g['G1_knownGood']['holds'], 'G2', g['G2_scale']['holds'], 'G4t', g['G4_noNewTerrace']['holds'], 'G4r', g['G4_noNewExactRing']['holds'], 'G5', g.get('G5_glogownikach', {}).get('holds'))
    json.dump(result, open(a.out, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main()
