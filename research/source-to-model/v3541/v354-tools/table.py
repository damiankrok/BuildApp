#!/usr/bin/env python3
"""table.py: strategy table per house/publisher/split from A and B dirs and the frozen references."""
import json,os,sys,collections
sys.path.insert(0,os.path.dirname(__file__))
from score import score
R='/home/user/rd/v354'
REFS=[R+'/refs','/home/user/rd/s53/reference','/home/user/rd/s53/reference-heldback']
def ref(h):
    for d in REFS:
        p=os.path.join(d,h+'.json')
        if os.path.exists(p): return json.load(open(p)),d
    return None,None
houses=[]
for l in open(R+'/set.txt'): sp,g,_,_,h=l.split(); houses.append((sp,g,h))
for l in open(R+'/fresh.txt'): sp,g,_,h=l.split(); houses.append((sp,g,h))
rows=[]
for sp,g,h in houses:
    rf,rd=ref(h); row={'split':sp,'publisher':g,'house':h,'ref':bool(rf)}
    for strat in sys.argv[1:] or ['A','B']:
        d=os.path.join(R,strat,h)
        if os.path.isdir(d) and any(os.path.exists(os.path.join(d,f)) for f in ('model.json','failure.json','description-check.json')):
            s,_=score(d,rf or {}); row[strat]=s
        else: row[strat]=None
    rows.append(row)
json.dump(rows,open(R+'/table-%s.json'%'-'.join(sys.argv[1:] or ['A','B']),'w'),indent=1,ensure_ascii=False)
def cell(s):
    if s is None: return '—'
    if not s['model']: return 'NO_MODEL '+str(s.get('code'))[:28]
    return '%s size=%s(%s) st=%s roof=%s/%s ridge=%s op=%s'%(s['verdict'],s.get('size'),s.get('sizeErr'),s.get('storeys'),s.get('modelRoof'),s.get('refRoof'),s.get('roofRidge'),s.get('openingsRatio'))
for r in [x for x in rows if x["split"] in (os.environ.get("SPLITS","DEV").split(","))]:
    print(r['split'],r['publisher'][:12].ljust(12),r['house'][:34].ljust(34),'ref' if r['ref'] else 'NOREF',' | '.join(cell(r.get(k)) for k in (sys.argv[1:] or ['A','B'])))
