#!/usr/bin/env python3
"""printed.py <run dir>: per plan frame, the longest READ linear dimension on horizontal / vertical chains (cm)."""
import json,sys,os
def longest(d):
    m=json.load(open(os.path.join(d,'metric-evidence.json')))
    ax={c['id']:c.get('axis') for c in m.get('chains',[])}
    out={}
    for e in m['evidence']:
        if e.get('kind')!='LINEAR_DIMENSION' or e.get('origin')!='READ' or e.get('unit')!='cm': continue
        a=ax.get(e.get('chainId'))
        if a not in ('HORIZONTAL','VERTICAL'): continue
        k='X' if a=='HORIZONTAL' else 'Y'; f=e['frameId'][-10:]
        cur=out.setdefault(f,{})
        if e['value']>cur.get(k,0): cur[k]=e['value']
    return out
if __name__=='__main__': print(json.dumps(longest(sys.argv[1])))
