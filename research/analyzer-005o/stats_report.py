#!/usr/bin/env python3
"""stats_report.py - BUILDPLAN-ANALYZER-005O: metric-statistics.md and counterfactuals.json from the scored bake-off.

  python3 -I research/analyzer-005o/stats_report.py --work /home/user/work005o --art stage-reports/artifacts/analyzer-005o

Paired per-statement deltas (frozen as-printed view vs each variant) clustered by house family, 10 000 family-cluster
bootstrap resamples (seed 5050); denominators printed; publisher group (ARCHON vs DobreDomy) reported apart.
"""
import argparse, json, os, random
from collections import Counter, defaultdict

VARIANTS = ['M1', 'M2', 'M3', 'M1P', 'M1b', 'M3b']


def boot(rows, stat, seed=5050, n=10000):
    by = defaultdict(list)
    for r in rows:
        by[r['family']].append(r)
    fams = sorted(by)
    rng = random.Random(seed)
    vals = sorted(stat([x for f in (rng.choice(fams) for _ in fams) for x in by[f]]) for _ in range(n))
    return [round(vals[int(0.025 * n)], 4), round(vals[int(0.975 * n) - 1], 4)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--art', required=True)
    a = ap.parse_args()
    bake = json.load(open(os.path.join(a.art, 'metric-bakeoff.json')))
    ledger = json.load(open(os.path.join(a.art, 'numeric-candidate-ledger.json')))['ledger']
    inv = {c['case']: c for c in json.load(open(os.path.join(a.art, 'source-inventory.json')))['cases']}
    pub = lambda case: 'DobreDomy' if case.startswith('D0') else 'ARCHON (incl. projektydomownowoczesnych alt-marcowki)'

    def outcome(lst, T):
        return 'ABSTAIN' if not lst else ('CORRECT' if lst == [T] else 'WRONG')

    rows = []
    for r in ledger:
        T = r['truthForScorerOnly']
        base = outcome(r['frozenAsRead'] or [], T)
        rows.append({'family': r['family'], 'case': r['case'], 'pub': pub(r['case']), 'frozen': base, **{v: outcome(r['variants'][v]['asRead'] or [], T) for v in VARIANTS}})
    lines = ['# 005O — metric statistics (label level, then house level)', '',
             f"Statements with a blind double-transcription truth: **{len(rows)}** in **{len({r['family'] for r in rows})}** families "
             f"(excluded: {bake['labels']['excluded']}). Intervals: 95 %, family-cluster bootstrap (10 000, seed 5050) unless marked Wilson.", '',
             '## Readers on the same statements (what each would state as printed)', '',
             '| reader | stated | correct | wrong | exact (of all) | wrong when stated (Wilson 95 %) | exact, family-cluster 95 % |', '| --- | --- | --- | --- | --- | --- | --- |']
    names = {'frozenAsPrinted': '**frozen as-printed value** (what plan resolution reads: CHAIN_CORRECTED → token text, READ → the statement value)', 'tokenText': 'classic token text (`ocrTokens[].text`, literal)', 'token': 'TOKEN candidate (token text for CHAIN_CORRECTED, statement value for READ)', 'latticeAsRead': 'numeric lattice asRead', 'latticeConfident': 'lattice, CLEAR/SUPPORTED only', 'externalTop': 'PP-OCRv6 top value', 'externalCorroborating': 'PP-OCRv6 corroborating (ensemble rule)', 'ensembleReading': 'ensemble reading (readingOf)', 'value': 'statement value (after chain correction)'}
    for k, x in bake['labels']['readers'].items():
        lines.append(f"| {names.get(k, k)} | {x['stated']} | {x['correct']} | {x['wrong']} | {x['exact']} | {x['wrongWhenStated']} {x['wrongWhenStatedCI']} | {x['familyClusterCI_exact']} |")
    dd = bake['labels']['readersDeduplicated']
    lines += ['', f"Sensitivity, de-duplicated (same drawing repeated on another frame at the same span, and the two second-pipeline legacy rows, removed): n = {dd['n']}.", '',
              '| reader | stated | wrong | wrong when stated (Wilson 95 %) |', '| --- | --- | --- | --- |']
    for k in ('frozenAsPrinted', 'tokenText', 'externalCorroborating', 'externalTop', 'latticeConfident'):
        x = dd['readers'][k]
        lines.append(f"| {names.get(k, k)} | {x['stated']} | {x['wrong']} | {x['wrongWhenStated']} {x['wrongWhenStatedCI']} |")
    rc = bake['labels']['topKRecallAtFirstLattice']
    lines += ['', f"TOP-K candidate recall at the first lattice/ensemble (truth among token, its alternatives, lattice paths, lattice asRead, PP-OCR top 5): **{rc['topKRecall']}/{rc['n']} = {rc['rate']}**.",
              f"Binding (truth / span within 3 % of the frame's transcription scale): {bake['labels']['binding']} (frames with a true scale {bake['labels']['framesWithTrueScale']} of {bake['labels']['framesWithStatements']}).", '',
              '## As-printed outcome per variant (paired with the frozen view)', '',
              '| variant | CORRECT | ABSTAIN | WRONG (stated wrong) | WRONG − frozen WRONG, per statement | family-cluster 95 % of that delta | CORRECT lost | WRONG→CORRECT |', '| --- | --- | --- | --- | --- | --- | --- | --- |']
    n = len(rows)
    fw = sum(1 for r in rows if r['frozen'] == 'WRONG')
    fc = sum(1 for r in rows if r['frozen'] == 'CORRECT')
    lines.append(f"| frozen (M0) | {fc} | {sum(1 for r in rows if r['frozen'] == 'ABSTAIN')} | {fw} | — | — | — | — |")
    for v in VARIANTS:
        c = Counter(r[v] for r in rows)
        d = (c['WRONG'] - fw) / n
        ci = boot(rows, lambda s, v=v: (sum(1 for r in s if r[v] == 'WRONG') - sum(1 for r in s if r['frozen'] == 'WRONG')) / len(s))
        lost = sum(1 for r in rows if r['frozen'] == 'CORRECT' and r[v] != 'CORRECT')
        gain = sum(1 for r in rows if r['frozen'] == 'WRONG' and r[v] == 'CORRECT')
        lines.append(f"| {v} | {c['CORRECT']} | {c['ABSTAIN']} | {c['WRONG']} | {round(d, 4)} | {ci} | {lost} | {gain} |")
    lines += ['', '`zero` list (what `latticeScales` and the isotropy gates read) per variant, WRONG stated: ' + ', '.join(f"{v} {bake['asPrinted'][v].get('zero_WRONG', 0)}" for v in VARIANTS) + '.']
    lines += ['', '### By publisher group (WRONG stated, frozen → M1 → M3)', '', '| group | n | frozen | M1 | M3 | M1P |', '| --- | --- | --- | --- | --- | --- |']
    for g in sorted({r['pub'] for r in rows}):
        rs = [r for r in rows if r['pub'] == g]
        lines.append(f"| {g} | {len(rs)} | {sum(1 for r in rs if r['frozen'] == 'WRONG')} | {sum(1 for r in rs if r['M1'] == 'WRONG')} | {sum(1 for r in rs if r['M3'] == 'WRONG')} | {sum(1 for r in rs if r['M1P'] == 'WRONG')} |")
    lines += ['', '## House level (44 cases, solver-only replays; scale tolerance 3 %, fixed in advance)', '',
              '| variant | completed | refused | verdict PASS | completed at a CORRECT scale | completed, truth scale unknown | FALSE_CONFIDENT_SCALE | outcome/model changed vs M0 | plan semantics changed | decision path changed (ranking, conflict trigger, refusal reason) | known-good (M0 PASS) changed |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    for v, s in bake['houseSummary'].items():
        lines.append(f"| {v} | {s['completed']} | {s['refused']} | {s['pass']} | {s['scaleClass'].get('CORRECT_SCALE', 0)} | {s['scaleClass'].get('UNKNOWN_TRUTH', 0)} | {s['scaleClass'].get('FALSE_CONFIDENT_SCALE', 0)} | {s['changedVsM0']} | {s.get('semanticsChangedVsM0', 0)} | {s.get('decisionPathChangedVsM0', 0)} | {s['knownGoodChanged']} |")
    lines += ['', 'Rows whose decision path or semantics changed (variant: case):', '']
    for h in bake['houses']:
        ch = [v for v in VARIANTS if h[v].get('decisionPathChangedVsM0') or h[v].get('semanticsChangedVsM0') or h[v].get('changedVsM0')]
        if ch:
            lines.append(f"- `{h['case']}` (M0 {h['M0']['outcome']} {h['M0'].get('verdict')}): " + '; '.join(f"{v} {'outcome/model' if h[v].get('changedVsM0') else ''}{' semantics' if h[v].get('semanticsChangedVsM0') else ''}{' path' if h[v].get('decisionPathChangedVsM0') else ''}" for v in ch))
    lines += ['', 'Families: ' + ', '.join(f'{k} {v}' for k, v in sorted(Counter(r['family'] for r in rows).items(), key=lambda kv: -kv[1])[:12]) + ' … (rows of one design are one cluster).',
              '', 'No fresh blind draw was made: every case is development material (blind rounds 9 and 10 are revealed). These are development statistics, not a generalization claim.']
    open(os.path.join(a.art, 'metric-statistics.md'), 'w').write('\n'.join(lines) + '\n')
    cf = {'schema': 'buildapp.005o.counterfactuals', 'houses': [{'case': h['case'], 'family': h['family'], 'trueScale': h['trueScale'], **{v: {k: h[v].get(k) for k in ('outcome', 'code', 'modelHash', 'scale', 'frame', 'scaleClass', 'verdict')} for v in ['M0'] + VARIANTS}}
                                                                for h in bake['houses'] if any(h[v].get('changedVsM0') for v in VARIANTS)],
          'controls': {'M0-frozen vs M0H (harness without a view)': '44/44 outcome files byte-identical', 'M0-frozen vs M0X (explicit frozen view)': '44/44 identical outcome, code and model hash',
                       'missing-candidate (glogownikach, every external reading stripped from the evidence the solver uses)': {},
                       'empty-view replay (vacuous; post-review L1: the generator stripped its own copy only, the solver read the full evidence, so this is the M0 run)': {},
                       'view generator determinism': 'M1 and M3 views byte-identical on regeneration'}}
    m0f = os.path.join(a.work, 'runs', 'M0-frozen', 'dom-w-glogownikach', 'failure.json')
    for key, runs in (('missing-candidate (glogownikach, every external reading stripped from the evidence the solver uses)', ('stripped-frozen', 'stripped-M1noext')),
                      ('empty-view replay (vacuous; post-review L1: the generator stripped its own copy only, the solver read the full evidence, so this is the M0 run)', ('M1-noext', 'M3-noext'))):
        for v in runs:
            p = os.path.join(a.work, 'runs', f'ctl-{v}', 'dom-w-glogownikach', 'failure.json')
            cf['controls'][key][v] = ({'reasonCode': json.load(open(p))['reasonCode'], 'failureByteIdenticalToM0': open(p, 'rb').read() == open(m0f, 'rb').read()}
                                      if os.path.exists(p) else 'COMPLETED (control FAILED)')
    m4 = os.path.join(a.art, 'm4-orientation-diag.json')
    if os.path.exists(m4):
        d = json.load(open(m4))
        cf['m4OrientationDiag'] = {k: d[k] for k in ('decisions', 'm4Decides', 'changed', 'changedVsTruth', 'incumbentVsTruth', 'm4VsTruthWhereDecides', 'changedByDecidedBy')}
    json.dump(cf, open(os.path.join(a.art, 'counterfactuals.json'), 'w'), indent=1, sort_keys=True)
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
