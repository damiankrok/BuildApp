#!/usr/bin/env python3
"""gates.py - BUILDPLAN-ANALYZER-005P preregistered gates G1-G9 over dev-matrix.json and the replays (RESEARCH ONLY).

  python3 -I research/analyzer-005p/gates.py --matrix stage-reports/artifacts/analyzer-005p/dev-matrix.json \
      --work /home/user/work005p --soundness research/analyzer-005p/soundness.json \
      --out-gates stage-reports/artifacts/analyzer-005p/gates.json --out-delta stage-reports/artifacts/analyzer-005p/semantic-delta.json

Mechanical from the matrix and the replays (preregistration.md section 4). Revised after review round 1 (finding E3):
G5 reads every changed refusal message and checks each scale it asserts against the frame's transcription scale; G6
checks a newly completed row's levels against its plan storey frames and LISTS its terraces with their provenance (the
preregistered "terraces are reported"); G7 compares the repeat run byte for byte; a gate that could not be evaluated is
NOT a pass. The only human input is `soundness.json` (G3 and P1's coherence rule), written from the code and the evidence;
a change without a written verdict counts as NOT_SOUND.
"""
import argparse, hashlib, json, os, re

VARIANTS = ('P1', 'P2', 'P3', 'N1', 'PROD3')  # PROD3 = N1a, the production implementation after review round 2 (addendum A)
FILES = ('model.json', 'program.json', 'result-summary.json', 'failure.json', 'analysis-trace.json', 'plan-diagnostics/digest.json')
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SCALE = re.compile(r'(\d+\.\d+) cm/px')


def run_bytes(d):
    out = {}
    for f in FILES:
        p = os.path.join(d, f)
        out[f] = hashlib.sha256(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else None
    return out


def storey_frames(case):
    g = json.load(open(case['graph']))
    drop = set(case.get('dropFrames') or [])
    return sorted({f['roles'].get('storey') for f in g['coordinateFrames'] if f['roles'].get('document') == 'FLOOR_PLAN' and f['roles'].get('storey') not in (None, 'UNKNOWN') and f['id'] not in drop})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--matrix', required=True)
    ap.add_argument('--work', required=True)
    ap.add_argument('--soundness', required=True)
    ap.add_argument('--out-gates', required=True)
    ap.add_argument('--out-delta', required=True)
    a = ap.parse_args()
    d = json.load(open(a.matrix))
    sound = json.load(open(a.soundness))['verdicts']
    cases = {c['case']: c for c in json.load(open(os.path.join(REPO, 'research/analyzer-005o/cases.json')))['cases']}
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
            rows.append({'case': c, 'p0': {k: b.get(k) for k in ('outcome', 'code', 'verdict', 'frame', 'scale', 'scaleClass', 'modelHash', 'conflictTriggers', 'decisionPath', 'semantics', 'failureMessage')},
                         'variant': {k: o.get(k) for k in ('outcome', 'code', 'verdict', 'frame', 'scale', 'scaleClass', 'modelHash', 'conflictTriggers', 'decisionPath', 'semantics', 'failureMessage')},
                         'changed': {k: o[k] for k in ('bytesChanged', 'modelChanged', 'decisionPathChanged', 'semanticsChanged', 'frameChanged', 'newTriggers')}})
        delta[v] = rows
        g = {}
        # G1
        unknown_new = [c for c in s['newlyCompleted'] if H[c][v].get('scaleClass') != 'CORRECT_SCALE']
        g['G1_no_new_false_confident_scale'] = {'pass': not s['newFalseConfident'] and not unknown_new, 'newFalseConfident': s['newFalseConfident'], 'newlyCompletedNotKnownCorrect': unknown_new}
        # G2
        g['G2_no_known_good_model_change'] = {'pass': not s['knownGoodModelChanged'], 'cases': s['knownGoodModelChanged']}
        # G3
        kg = s['knownGoodPathChanged']
        verdicts = {c: sound.get(f'{v}:{c}', {'verdict': 'NOT_SOUND', 'why': 'no written verdict'}) for c in kg}
        g['G3_known_good_path_change_sound'] = {'pass': all(x['verdict'] == 'SOUND' for x in verdicts.values()), 'cases': verdicts}
        # G4
        copy_switch = [c for c in s['frameChanged'] if H[c][base]['outcome'] == 'COMPLETED']
        def same_plan_semantics(c):
            pv, pb = H[c][v].get('semantics', {}), H[c][base].get('semantics', {})
            return pv.get('bodies') == pb.get('bodies') and pv.get('wideOpenings') == pb.get('wideOpenings')
        sem = [c for c in s['semanticsChanged'] if not (c in s['newlyCompleted'] and same_plan_semantics(c))]
        g['G4_no_semantic_change'] = {'pass': not sem and not copy_switch, 'semanticChange': sem, 'copySwitchOnCompletedRow': copy_switch}
        # G5: a changed refusal may not newly assert a scale more than 3 % off the frame's transcription scale
        adverse, judged = [], []
        for r in rows:
            if r['variant']['outcome'] != 'FAILED':
                continue
            msg, old = r['variant'].get('failureMessage') or '', r['p0'].get('failureMessage') or ''
            if msg == old:
                continue
            ts = H[r['case']][v].get('trueScale') or H[r['case']][base].get('trueScale')
            new_scales = sorted({float(x) for x in SCALE.findall(msg)} - {float(x) for x in SCALE.findall(old)})
            off = [x for x in new_scales if ts and abs(x / ts - 1) > 0.03]
            judged.append({'case': r['case'], 'newScalesAsserted': new_scales, 'trueScale': ts, 'off': off})
            if off or (new_scales and not ts):
                adverse.append(r['case'])
        g['G5_no_new_adverse_refusal'] = {'pass': not adverse, 'adverse': adverse, 'changedRefusalsJudged': judged}
        # G6: a refused -> completed row: levels equal its plan storey frames; its terraces listed with provenance
        listing, wrong_levels = {}, []
        for c in s['newlyCompleted']:
            model = os.path.join(a.work, 'runs', v, c, 'model.json')
            m = json.load(open(model)) if os.path.exists(model) else {}
            storeys = storey_frames(cases[c])
            levels = len(m.get('levels', []))
            if levels != len(storeys):
                wrong_levels.append(c)
            listing[c] = {'levels': levels, 'planStoreys': storeys,
                          'terraces': [{'id': t.get('id'), 'surface': t.get('surface'), 'status': (t.get('evidence') or {}).get('status'), 'interpretation': (t.get('evidence') or {}).get('interpretation')} for t in m.get('terraces', [])],
                          'wallRings': [{'id': w.get('id'), 'status': (w.get('evidence') or {}).get('status'), 'interpretation': (w.get('evidence') or {}).get('interpretation')} for w in m.get('wallRings', [])]}
        g['G6_no_false_closure_or_floor'] = {'pass': not wrong_levels, 'wrongLevels': wrong_levels, 'newlyCompletedReported': listing,
                                             'note': 'terraces and rings are REPORTED, as preregistered; whether a reported terrace is real is judged in the report (first-bad ledger), not here'}
        # G7: the repeat, byte for byte
        rep_dir = os.path.join(a.work, 'runs', f'{v}-rep')
        if os.path.isdir(rep_dir):
            diff = [c for c in H if run_bytes(os.path.join(a.work, 'runs', v, c)) != run_bytes(os.path.join(rep_dir, c))]
            g['G7_determinism'] = {'pass': not diff, 'differs': diff, 'compared': len(H)}
        else:
            g['G7_determinism'] = {'pass': None, 'note': 'not repeated (preregistration: only the chosen variant is)'}
        # G8
        glog = H['dom-w-glogownikach'][v]
        g['G8_glogownikach'] = {'pass': 'OUTER_TOTALS' not in glog['conflictTriggers'] and glog.get('verdict') != 'PASS', 'conflictTriggers': glog['conflictTriggers'], 'outcome': glog['outcome'], 'verdict': glog.get('verdict'), 'scale': glog.get('scale')}
        if v in ('N1', 'PROD3'):
            g['G9_monotone_triggers'] = {'pass': not s['newTriggers'], 'newTriggers': s['newTriggers']}
        if v == 'P1':
            nt = s['newTriggers']
            pv = {c: sound.get(f'P1-trigger:{c}', {'verdict': 'NOT_SOUND', 'why': 'no written verdict'}) for c in nt}
            g['P1_coherence_new_triggers_sound'] = {'pass': all(x['verdict'] == 'SOUND' for x in pv.values()), 'cases': pv}
        failed = [k for k, x in g.items() if x['pass'] is False]
        unevaluated = [k for k, x in g.items() if x['pass'] is None]
        gates[v] = {'admissible': not failed and not unevaluated, 'failed': failed, 'unevaluated': unevaluated, 'gates': g,
                    'decisionPathChanges': len(s['decisionPathChanged']), 'knownGoodPathChanges': len(kg)}
    json.dump({'schema': 'buildapp.005p.gates', 'revision': 'review round 1 (E3): G5 judged, G6 as preregistered, G7 bytes, unevaluated is not a pass', 'matrix': a.matrix, 'variants': gates}, open(a.out_gates, 'w'), indent=1, sort_keys=True)
    json.dump({'schema': 'buildapp.005p.semantic-delta', 'baseline': base, 'variants': delta}, open(a.out_delta, 'w'), indent=1, sort_keys=True)
    for v in VARIANTS:
        print(v, 'ADMISSIBLE' if gates[v]['admissible'] else 'INADMISSIBLE', 'failed', gates[v]['failed'], 'unevaluated', gates[v]['unevaluated'])


if __name__ == '__main__':
    main()
