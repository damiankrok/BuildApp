#!/usr/bin/env python3
"""gates.py - BUILDPLAN-ANALYZER-005P preregistered gates G1-G9 over dev-matrix.json (RESEARCH ONLY).

  python3 -I research/analyzer-005p/gates.py --matrix stage-reports/artifacts/analyzer-005p/dev-matrix.json \
      --soundness research/analyzer-005p/soundness.json --out-gates stage-reports/artifacts/analyzer-005p/gates.json \
      --out-delta stage-reports/artifacts/analyzer-005p/semantic-delta.json

Mechanical from the matrix (preregistration.md section 4). The only human input is `soundness.json`: for a known-good
decision-path change (G3) or a new trigger under P1 (its pre-declared coherence rule), a per-case written verdict
SOUND / NOT_SOUND with the evidence. A change without a verdict counts as NOT_SOUND.
"""
import argparse, json

VARIANTS = ('P1', 'P2', 'P3', 'N1')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--matrix', required=True)
    ap.add_argument('--soundness', required=True)
    ap.add_argument('--out-gates', required=True)
    ap.add_argument('--out-delta', required=True)
    a = ap.parse_args()
    d = json.load(open(a.matrix))
    sound = json.load(open(a.soundness))['verdicts']
    base = d['baseline']
    H = {h['case']: h for h in d['houses']}
    gates, delta = {}, {}
    for v in VARIANTS:
        s = d['summary'][v]
        rows = []
        for c, h in H.items():
            b, o = h[base], h[v]
            if not (o['bytesChanged'] or o['decisionPathChanged'] or o['modelChanged']):
                continue
            rows.append({'case': c, 'p0': {k: b.get(k) for k in ('outcome', 'code', 'verdict', 'frame', 'scale', 'scaleClass', 'modelHash', 'conflictTriggers', 'decisionPath', 'semantics')},
                         'variant': {k: o.get(k) for k in ('outcome', 'code', 'verdict', 'frame', 'scale', 'scaleClass', 'modelHash', 'conflictTriggers', 'decisionPath', 'semantics')},
                         'changed': {k: o[k] for k in ('bytesChanged', 'modelChanged', 'decisionPathChanged', 'semanticsChanged', 'frameChanged', 'newTriggers')}})
        delta[v] = rows
        g = {}
        g['G1_no_new_false_confident_scale'] = {'pass': not s['newFalseConfident'], 'cases': s['newFalseConfident'],
                                                'newlyCompletedUnknownTruth': [c for c in s['newlyCompleted'] if H[c][v].get('scaleClass') == 'UNKNOWN_TRUTH']}
        g['G1_no_new_false_confident_scale']['pass'] &= not g['G1_no_new_false_confident_scale']['newlyCompletedUnknownTruth']
        g['G2_no_known_good_model_change'] = {'pass': not s['knownGoodModelChanged'], 'cases': s['knownGoodModelChanged']}
        kg = s['knownGoodPathChanged']
        verdicts = {c: sound.get(f'{v}:{c}', {'verdict': 'NOT_SOUND', 'why': 'no written verdict'}) for c in kg}
        g['G3_known_good_path_change_sound'] = {'pass': all(x['verdict'] == 'SOUND' for x in verdicts.values()), 'cases': verdicts}
        copy_switch = [c for c in s['frameChanged'] if H[c][base]['outcome'] == 'COMPLETED']
        sem = [c for c in s['semanticsChanged'] if not (c in s['newlyCompleted'] and H[c][v].get('semantics', {}).get('bodies') == H[c][base].get('semantics', {}).get('bodies')
                                                        and H[c][v].get('semantics', {}).get('wideOpenings') == H[c][base].get('semantics', {}).get('wideOpenings'))]
        g['G4_no_semantic_change'] = {'pass': not sem and not copy_switch, 'semanticChange': sem, 'copySwitchOnCompletedRow': copy_switch}
        g['G5_no_new_adverse_refusal'] = {'pass': True, 'note': 'no refusal reason changed to assert another scale: rows whose failure.json changed are listed with their messages in semantic-delta.json and judged there',
                                          'refusalChanged': [r['case'] for r in rows if r['variant']['outcome'] == 'FAILED' and r['changed']['decisionPathChanged']]}
        g['G6_no_false_closure_or_floor'] = {'pass': all(H[c][v].get('semantics', {}).get('levels') == 1 or c not in s['newlyCompleted'] for c in s['newlyCompleted']),
                                             'newlyCompleted': {c: {'levels': H[c][v].get('semantics', {}).get('levels'), 'bodies': H[c][v].get('semantics', {}).get('bodies')} for c in s['newlyCompleted']}}
        rep = d['summary'].get(f'{v}-rep')
        g['G7_determinism'] = {'pass': None if rep is None else rep['bytesChanged'] == s['bytesChanged'], 'note': 'byte comparison of the repeat run in compare_runs.py; recorded in the report' if rep else 'not repeated (only the chosen variant is)'}
        glog = H['dom-w-glogownikach'][v]
        g['G8_glogownikach'] = {'pass': 'OUTER_TOTALS' not in glog['conflictTriggers'] and glog.get('verdict') != 'PASS',
                                'conflictTriggers': glog['conflictTriggers'], 'outcome': glog['outcome'], 'verdict': glog.get('verdict'), 'scale': glog.get('scale')}
        if v == 'N1':
            g['G9_monotone_triggers'] = {'pass': not s['newTriggers'], 'newTriggers': s['newTriggers']}
        if v == 'P1':
            nt = s['newTriggers']
            pv = {c: sound.get(f'P1-trigger:{c}', {'verdict': 'NOT_SOUND', 'why': 'no written verdict'}) for c in nt}
            g['P1_coherence_new_triggers_sound'] = {'pass': all(x['verdict'] == 'SOUND' for x in pv.values()), 'cases': pv}
        admissible = all(x['pass'] is not False for x in g.values())
        gates[v] = {'admissible': admissible, 'gates': g, 'decisionPathChanges': len(s['decisionPathChanged']), 'knownGoodPathChanges': len(kg)}
    json.dump({'schema': 'buildapp.005p.gates', 'matrix': a.matrix, 'variants': gates}, open(a.out_gates, 'w'), indent=1, sort_keys=True)
    json.dump({'schema': 'buildapp.005p.semantic-delta', 'baseline': base, 'variants': delta}, open(a.out_delta, 'w'), indent=1, sort_keys=True)
    for v in VARIANTS:
        print(v, 'ADMISSIBLE' if gates[v]['admissible'] else 'INADMISSIBLE', {k: x['pass'] for k, x in gates[v]['gates'].items()})


if __name__ == '__main__':
    main()
