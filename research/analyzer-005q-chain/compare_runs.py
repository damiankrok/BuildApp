#!/usr/bin/env python3
"""compare_runs.py - BUILDPLAN-ANALYZER-005Q-CHAIN determinism check between two replays (stop rules S1/S2).

  python3 -I research/analyzer-005q-chain/compare_runs.py --runs /home/user/work005q-chain/runs --a C0 --b C0warm --out <json>

Every file under runs/<a>/<case>/ is compared with runs/<b>/<case>/: byte for byte first; when the bytes differ and the
file is JSON (optionally gzip'd), it is compared again with wall-clock fields removed (keys named durationMs,
startedAtMs, startedAt, completedAt, ms, *Ms under 'timings', wall, peakRss*). A file that still differs, or exists on one
side only, breaks the rule. Logs, replay.json and performance.json (wall time, RSS, tick gaps only) are listed apart.
"""
import argparse, gzip, json, os

CLOCK = {'durationMs', 'startedAtMs', 'startedAt', 'completedAt', 'ms', 'wallS', 'peakRssKb', 'peakRssMB'}


def strip(x, path=''):
    if isinstance(x, dict):
        return {k: strip(v, f'{path}.{k}') for k, v in x.items() if k not in CLOCK and not (path.endswith('timings') and k.endswith('Ms'))}
    if isinstance(x, list):
        return [strip(v, path) for v in x]
    return x


def load(p):
    raw = open(p, 'rb').read()
    return gzip.decompress(raw) if p.endswith('.gz') else raw


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--runs', required=True)
    ap.add_argument('--a', required=True)
    ap.add_argument('--b', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    A, B = f'{a.runs}/{a.a}', f'{a.runs}/{a.b}'
    cases = sorted(set(os.listdir(A)) | set(os.listdir(B)))
    res = {'identical': 0, 'clockOnly': {}, 'differs': [], 'oneSided': [], 'logsApart': 0}
    for c in cases:
        fa, fb = set(), set()
        for root, base in ((f'{A}/{c}', fa), (f'{B}/{c}', fb)):
            for d, _, fs in os.walk(root):
                for f in fs:
                    base.add(os.path.relpath(os.path.join(d, f), root))
        for f in sorted(fa ^ fb):
            res['oneSided'].append(f'{c}/{f}')
        for f in sorted(fa & fb):
            if f.endswith('.log') or f in ('replay.json', 'extract/performance.json', 'solve/performance.json'):
                res['logsApart'] += 1
                continue
            ba, bb = load(f'{A}/{c}/{f}'), load(f'{B}/{c}/{f}')
            if ba == bb:
                res['identical'] += 1
                continue
            try:
                ja, jb = json.loads(ba), json.loads(bb)
            except ValueError:
                res['differs'].append(f'{c}/{f}')
                continue
            if strip(ja) == strip(jb):
                key = f.split('/')[-1]
                res['clockOnly'][key] = res['clockOnly'].get(key, 0) + 1
            else:
                res['differs'].append(f'{c}/{f}')
    res['cases'] = len(cases)
    res['verdict'] = 'HOLDS' if not res['differs'] and not res['oneSided'] else 'BROKEN'
    json.dump({'schema': 'buildapp.005q-chain.determinism-compare', 'version': 1, 'a': a.a, 'b': a.b, **res}, open(a.out, 'w'), indent=1, sort_keys=True)
    print(json.dumps({k: (v if not isinstance(v, list) else v[:10]) for k, v in res.items()}))


if __name__ == '__main__':
    main()
