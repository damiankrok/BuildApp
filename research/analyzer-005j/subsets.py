import json,random
items=[json.loads(l) for l in open('bench/items-all.jsonl')]
core=set(tuple(l.split()) for l in open('bench/core-keys.txt'))
sub=[i for i in items if (i['qid'],i['mode']) in core or i['set']=='REAL_BLIND8']
flo=sub+[i for i in items if i['mode']=='RAW' and i['cls'] in ('OPENING_VS_PATTERN','COLUMN_VS_WALL') and (i['qid'],i['mode']) not in core and i['set']!='REAL_BLIND8']
rng=random.Random(5006)
pool=[i for i in sub if i['set']!='REAL_BLIND8']; rng.shuffle(pool)
gen=[(i['qid'],i['mode']) for i in pool[:180]]+[(i['qid'],i['mode']) for i in sub if i['set']=='REAL_BLIND8']
open('bench/items-core.jsonl','w').write(''.join(json.dumps(i)+'\n' for i in sub))
open('bench/items-florence.jsonl','w').write(''.join(json.dumps(i)+'\n' for i in flo))
open('bench/gen-sample-keys.txt','w').write(''.join(f'{q} {m}\n' for q,m in gen))
print(len(sub), len(flo), len(gen))
