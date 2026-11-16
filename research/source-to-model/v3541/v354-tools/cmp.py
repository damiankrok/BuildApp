#!/usr/bin/env python3
"""cmp.py <dirA> <dirB>: per house in both, same outcome? (model hash, or refusal code + reason)."""
import json,os,sys
a,b=sys.argv[1:3]
def key(d):
    if os.path.exists(d+'/result-summary.json'):
        r=json.load(open(d+'/result-summary.json')); return ('MODEL',r.get('modelHash'),(r.get('analyzer') or {}).get('solver') if isinstance(r.get('analyzer'),dict) else None)
    if os.path.exists(d+'/failure.json'):
        f=json.load(open(d+'/failure.json')); return ('REFUSAL',f.get('code'),f.get('reasonCode'),(f.get('diagnostics') or {}).get('firstFailure') or (f.get('diagnostics') or {}).get('firstReading'))
    return None
for h in sorted(os.listdir(b)):
    db=os.path.join(b,h); da=os.path.join(a,h)
    if not os.path.isdir(db): continue
    kb=key(db); ka=key(da)
    if kb is None: continue
    same = ka is not None and ka[0]==kb[0] and ka[1:2]==kb[1:2] and (ka[0]=='MODEL' or ka[2:]==kb[2:])
    print(('SAME   ' if same else 'CHANGED'), h[:44].ljust(44), ka, '->', kb)
