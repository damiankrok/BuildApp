#!/usr/bin/env python3
"""v3.54.13 — regression of saved projects: each replayed model against the previous stage's, byte for byte and, when
the bytes differ, with only the schema version string and the migration notes set aside — any other difference
(geometry, materials, regions, ids) is named by collection and id.

    /usr/bin/python3 -I research/source-to-model/v35413/regress-compare.py <old REG dir> <new REG dir> SET…
"""
import json, os, sys
old, new, sets = sys.argv[1], sys.argv[2], sys.argv[3:]
for s in sets:
    d = os.path.join(new, s)
    if not os.path.isdir(d): continue
    for h in sorted(os.listdir(d)):
        a = os.path.join(old, s, h, 'model.json'); b = os.path.join(new, s, h, 'model.json')
        if not os.path.isdir(os.path.join(d, h)): continue
        if not os.path.exists(a) and not os.path.exists(b): print(s, h, 'no model in either (replay NOT_SENT, as before)'); continue
        if os.path.exists(a) != os.path.exists(b): print(s, h, 'MISMATCH presence'); continue
        if open(a, 'rb').read() == open(b, 'rb').read(): print(s, h, 'SAME (bytes)'); continue
        A = json.load(open(a)); B = json.load(open(b))
        for x in (A, B):
            x.pop('schemaVersion', None); x.get('meta', {}).pop('notes', None)
        diff = [k for k in set(A) | set(B) if A.get(k) != B.get(k)]
        if not diff: print(s, h, 'SAME apart from the schema version (1.8.0 -> 1.9.0)'); continue
        det = []
        for k in diff:
            if isinstance(A.get(k), list):
                ia = {o.get('id'): o for o in A[k] if isinstance(o, dict)}; ib = {o.get('id'): o for o in B[k] if isinstance(o, dict)}
                ch = [i for i in set(ia) | set(ib) if ia.get(i) != ib.get(i)]
                det.append(f"{k}[{len(ch)}: {', '.join(map(str, sorted(ch, key=str)[:4]))}]")
            else: det.append(k)
        print(s, h, 'DIFF', ' '.join(det))
