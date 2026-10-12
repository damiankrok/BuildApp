#!/usr/bin/env python3
"""truth.py - BUILDPLAN-ANALYZER-005O offline scorer truth (RESEARCH ONLY; never an input to a challenger).

  python3 -I research/analyzer-005o/truth.py --work /home/user/work005o

Joins the two blind transcriptions of every sheet (labels/transcriptions.json, written from the transcription
workflow's result) with the sheet key (labels/sheet-key.json) and the crop manifest (labels/manifest.json):

- a crop's truth is the reading both transcribers gave (digits and separators compared exactly, after reading it
  upright), or NOT_A_LABEL when both say so; anything else (one ILLEGIBLE, a disagreement) is UNCERTAIN and excluded;
- the synthetic controls measure the transcribers: each transcriber's reading of a control against its known value.

Output: labels/truth.json (outside the repository: it is keyed by crop keys that name cases) and a committed summary
`stage-reports/artifacts/analyzer-005o/label-truth-summary.json` with counts only.
"""
import argparse, json, os, re
from collections import Counter

NORM = re.compile(r'[^0-9,.]')


def norm(r):
    if r is None:
        return None
    r = r.strip().upper()
    if r in ('NOT_A_LABEL', 'ILLEGIBLE'):
        return r
    v = NORM.sub('', r.replace('·', '.'))
    return v or 'ILLEGIBLE'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--summary', default='stage-reports/artifacts/analyzer-005o/label-truth-summary.json')
    a = ap.parse_args()
    L = os.path.join(a.work, 'labels')
    tr = json.load(open(os.path.join(L, 'transcriptions.json')))
    key = json.load(open(os.path.join(L, 'sheet-key.json')))['key']
    man = {r['key']: r for r in json.load(open(os.path.join(L, 'manifest.json')))['crops'] if 'key' in r}
    reads = {}  # (sheet, n) -> {who: item}
    for t in tr:
        if not t.get('items'):
            continue
        for it in t['items']:
            reads.setdefault((t['sheet'], it['n']), {})[t['who']] = it
    truth, controls = {}, Counter()
    per_control = []
    for k in key:
        got = reads.get((k['sheet'], k['n']), {})
        A, B = norm(got.get('A', {}).get('reading')), norm(got.get('B', {}).get('reading'))
        if k['kind'] == 'control':
            for who, x in (('A', A), ('B', B)):
                ok = x == k['controlValue']
                controls[f'{who}_{"correct" if ok else "wrong" if x not in (None, "ILLEGIBLE") else "abstain"}'] += 1
                per_control.append({'sheet': k['sheet'], 'n': k['n'], 'who': who, 'value': k['controlValue'], 'read': x, 'ok': ok})
            continue
        if A is None or B is None:
            status, value = 'MISSING_TRANSCRIPTION', None
        elif A == B and A not in ('ILLEGIBLE',):
            status, value = ('NOT_A_LABEL', None) if A == 'NOT_A_LABEL' else ('AGREED', A)
        else:
            status, value = 'UNCERTAIN', None
        rec = man[k['key']]
        truth[k['key']] = {'case': rec['case'], 'family': rec['family'], 'evidenceId': rec['evidenceId'], 'status': status, 'value': value,
                           'A': A, 'B': B, 'upsideDown': [got.get('A', {}).get('upsideDown'), got.get('B', {}).get('upsideDown')],
                           'confidence': [got.get('A', {}).get('confidence'), got.get('B', {}).get('confidence')]}
    json.dump({'truth': truth, 'controls': per_control}, open(os.path.join(L, 'truth.json'), 'w'), indent=0, sort_keys=True)
    st = Counter(v['status'] for v in truth.values())
    numeric = sum(1 for v in truth.values() if v['status'] == 'AGREED' and re.fullmatch(r'[1-9]\d{1,4}', v['value'] or ''))
    summary = {'schema': 'buildapp.005o.label-truth-summary', 'method': 'blind double transcription of statement crops (two independent transcribers per sheet, no reader output shown, houses shuffled across sheets); truth = exact agreement',
               'crops': len(truth), 'status': dict(st), 'agreedIntegerCm': numeric, 'controls': dict(controls),
               'transcriberControlAccuracy': {w: round(controls[f'{w}_correct'] / max(1, controls[f'{w}_correct'] + controls[f'{w}_wrong'] + controls[f'{w}_abstain']), 4) for w in 'AB'},
               'controlBothWrongSameValue': sum(1 for i in range(0, len(per_control) - 1, 2) if per_control[i]['read'] == per_control[i + 1]['read'] and not per_control[i]['ok'] and per_control[i]['read'] not in (None, 'ILLEGIBLE'))}
    os.makedirs(os.path.dirname(a.summary), exist_ok=True)
    json.dump(summary, open(a.summary, 'w'), indent=1, sort_keys=True)
    print(json.dumps(summary, indent=1))


if __name__ == '__main__':
    main()
