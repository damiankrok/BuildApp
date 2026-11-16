"""v3.54.2 tables: per house A / R / C and the trace rows, from the run directories (no publisher picture is read).

  /usr/bin/python3 -I tables.py <list> <A dir> <consult dir> <replay dir> <ref dir> [<ref dir> ...]  -> JSON on stdout

R is the consultation of the C run recorded and never consumed: its model is A's by construction; what it adds is what
the consultant saw and proposed. C is the result the transaction kept (ACCEPT) or LOCAL's (ROLLBACK/PARTIAL/NO_CHANGE).
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score import score_run, find_ref  # noqa: E402

lst, a_dir, c_dir, r_dir, *refs = sys.argv[1:]
rows = []
for line in open(lst):
    parts = line.split()
    if len(parts) < 3:
        continue
    h = parts[0]
    ref = find_ref(h, refs)
    a = score_run(os.path.join(a_dir, h), ref) if ref else {'outcome': 'NO_REFERENCE'}
    cpath = os.path.join(c_dir, h, 'consult.json')
    c = json.load(open(cpath)) if os.path.exists(cpath) else None
    kind = open(os.path.join(c_dir, h, 'replay-kind.txt')).read() if os.path.exists(os.path.join(c_dir, h, 'replay-kind.txt')) else None
    accepted = c and c['final'].get('modelHash') != c['local'].get('modelHash') or (c and c['final']['outcome'] != c['local']['outcome'])
    cand = score_run(os.path.join(r_dir, h), ref) if ref and os.path.isdir(os.path.join(r_dir, h)) else None
    cscore = cand if accepted else a
    proposals = []
    if c:
        for rd in c['rounds']:
            for v in rd['verdicts']:
                proposals.append({'round': rd['round'], **v})
        mc = c.get('modelCheck') or {}
        for v in mc.get('verdicts', []):
            proposals.append({'round': 'model-check', **v})
    rows.append({
        'house': h,
        'A': a,
        'R': {'model': 'A (unchanged by construction)', 'status': [((rd.get('consultation') or {}).get('final') or (rd.get('consultation') or {}).get('literal') or {}).get('review', {}).get('status') for rd in (c or {}).get('rounds', [])], 'modelCheck': ((c or {}).get('modelCheck') or {}).get('review', {}).get('status') if c else None},
        'C': cscore,
        'candidate': cand,
        'candidateKind': kind,
        'decisions': [rd['decision'] for rd in (c or {}).get('rounds', [])],
        'whys': [rd['why'] for rd in (c or {}).get('rounds', [])],
        'local': (c or {}).get('local'),
        'final': (c or {}).get('final'),
        'usd': (c or {}).get('usd'),
        'ms': (c or {}).get('ms'),
        'proposals': proposals,
    })
print(json.dumps(rows, indent=1))
