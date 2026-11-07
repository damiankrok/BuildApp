# v3.45: room numbers on the plan sheets the reconstruction reads, against the frozen annotation
# (annotations/room-numbers-eval.json). Token level: what the plan's interior reader is SHOWN as a room number.
#
# "Shown" replicates `readInterior` + `labelTokensOf`: tokens of the sheet's variant, those a recogniser token supersedes
# dropped; kept (not page-vote DISCARDED), upright, one or two digits, at least 1.15 x the median height of the kept
# tokens. A second, optimistic count adds upright one- or two-digit readings the page vote set aside (the route by which
# the interior may still number a room from them), so PRZED is not under-counted.
#
# Per annotated number: CORRECT (a shown token on its ink reads exactly it), WRONG (shown tokens on its ink read
# something else only), MISSING (nothing shown on its ink). Additions: shown tokens on no annotated ink that read a number
# printed on the sheet (they could number a room wrongly). On-ink = the annotated centre within the token box grown by
# 4 px, or the token centre within 12 px of it.
#
# usage: score_room_numbers.py <annotation.json> <runs-dir> <out.json>   (runs-dir/<project>/metric-evidence.json)
import json, os, re, sys

ann = json.load(open(sys.argv[1]))
runs = sys.argv[2]
DIG = re.compile(r'^\d{1,2}$')


def on_ink(b, x, y):
    if b['x0'] - 4 <= x <= b['x1'] + 4 and b['y0'] - 4 <= y <= b['y1'] + 4:
        return True
    cx, cy = (b['x0'] + b['x1']) / 2, (b['y0'] + b['y1']) / 2
    return (cx - x) ** 2 + (cy - y) ** 2 <= 144


out = {'sheets': [], 'totals': {}}
T = out['totals']
for s in ann['sheets']:
    f = os.path.join(runs, s['project'], 'metric-evidence.json')
    row = {'project': s['project'], 'assetId': s['assetId'], 'split': s['split'], 'n': len(s['numbers'])}
    if not os.path.exists(f):
        row['status'] = 'NO_RUN'
        for mode in ('kept', 'withSetAside'):
            T[f"{s['split']}|{mode}|n"] = T.get(f"{s['split']}|{mode}|n", 0) + len(s['numbers'])
            T[f"{s['split']}|{mode}|MISSING"] = T.get(f"{s['split']}|{mode}|MISSING", 0) + len(s['numbers'])
        out['sheets'].append(row)
        continue
    m = json.load(open(f))
    toks = [t for t in m['ocrTokens'] if t['variantByteHash'] == s['sha256']]
    sup = {i for t in toks for i in t.get('supersedes', [])}
    toks = [t for t in toks if t['id'] not in sup]
    kept = [t for t in toks if t.get('pageVote') != 'DISCARDED']
    med = sorted(t['heightPx'] for t in kept)[len(kept) // 2] if kept else 0
    big = lambda t: med == 0 or t['heightPx'] >= med * 1.15
    shown = {
        'kept': [t for t in kept if t.get('orientation', 'HORIZONTAL') == 'HORIZONTAL' and DIG.match(t['text']) and big(t)],
    }
    shown['withSetAside'] = shown['kept'] + [t for t in toks if t.get('pageVote') == 'DISCARDED' and t.get('orientation') == 'HORIZONTAL' and DIG.match(t['text']) and big(t)]
    printed = {n for n, _, _ in s['numbers']}
    row['status'] = 'RUN'
    row['recogniserTokens'] = sum(1 for t in toks if t.get('reader') == 'RECOGNISER')
    for mode, lst in shown.items():
        res = []
        used = set()
        for n, x, y in s['numbers']:
            here = [t for t in lst if on_ink(t['box'], x, y)]
            for t in here:
                used.add(t['id'])
            texts = sorted({t['text'] for t in here})
            r = 'CORRECT' if n in texts else ('WRONG' if texts else 'MISSING')
            res.append({'number': n, 'at': [x, y], 'read': texts, 'result': r})
        adds = [{'text': t['text'], 'box': t['box'], 'reader': t.get('reader', 'TEMPLATE')} for t in lst if t['id'] not in used and t['text'] in printed]
        row[mode] = {'rows': res, 'additions': adds}
        for k in ('n', 'CORRECT', 'WRONG', 'MISSING'):
            key = f"{s['split']}|{mode}|{k}"
            T[key] = T.get(key, 0) + (len(res) if k == 'n' else sum(1 for q in res if q['result'] == k))
        T[f"{s['split']}|{mode}|additions"] = T.get(f"{s['split']}|{mode}|additions", 0) + len(adds)
    out['sheets'].append(row)
for split in ('EVAL', 'DEV'):
    for mode in ('kept', 'withSetAside'):
        n = T.get(f'{split}|{mode}|n', 0)
        if not n:
            continue
        c, w = T.get(f'{split}|{mode}|CORRECT', 0), T.get(f'{split}|{mode}|WRONG', 0)
        T[f'{split}|{mode}|coverage'] = round((c + w) / n, 4)
        T[f'{split}|{mode}|exactAmongCovered'] = round(c / (c + w), 4) if c + w else None
json.dump(out, open(sys.argv[3], 'w'), indent=1)
print(json.dumps(T, indent=1))
