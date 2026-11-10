# S53-0: an index of the ANY-LINK runs kept in the session work directory (text only: outcomes, hashes, timings).
import json, os, hashlib, sys, re
ROOT='/home/user/rd/anylink'
RUNS={'base':'DEV (ANYLINK-SET), baseline','al4':'DEV','fin4':'DEV','w2':'DEV','control':'CONTROL (ANYLINK-CONTROL), first blind run','control-al4':'CONTROL, re-run (no longer blind for two pages)','control-w2':'CONTROL, re-run','control2-al4':'CONTROL-2 (12 pages), blind','control2-al5':'CONTROL-2 (12 pages), blind'}  # the tree each set ran on is its runsHeader
def sha(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1<<20),b''): h.update(b)
    return h.hexdigest()
def J(p):
    try: return json.load(open(p))
    except Exception: return None
out={'schema':'buildapp.source-to-model.evidence-index/1','root':'session work directory (outside Git): rd/anylink','note':'Outcomes, hashes and timings only. Publisher images and page bodies are not in Git; the private ZIP holds the run directories and the byte cache.','sets':{}}
for d,label in RUNS.items():
    base=os.path.join(ROOT,d)
    if not os.path.isdir(base): out['sets'][d]={'label':label,'missing':True}; continue
    runs_txt=open(os.path.join(base,'runs.txt')).read().strip().split('\n') if os.path.exists(os.path.join(base,'runs.txt')) else []
    dur={m.group(1):int(m.group(3)) for l in runs_txt for m in [re.match(r'RUN (\S+) exit=(\d+) (\d+)s',l)] if m}
    items=[]
    for slug in sorted(os.listdir(base)):
        p=os.path.join(base,slug)
        if not os.path.isdir(p): continue
        pkg=J(os.path.join(p,'source-package.json')) or {}
        rs=J(os.path.join(p,'result-summary.json')); fl=J(os.path.join(p,'failure.json')); hs=J(os.path.join(p,'source-hashes.json')) or {}
        it={'slug':slug,'url':pkg.get('canonicalUrl'),'packageContentHash':pkg.get('contentHash'),'assets':len(pkg.get('assets',[])),'seconds':dur.get(slug)}
        if rs:
            it['outcome']='MODEL'
            it['hashes']=rs.get('hashes') or {k:rs.get(k) for k in ('candidateHash','modelHash','sceneHash') if rs.get(k)}
            it['analyzer']=rs.get('analyzer')
            it['warnings']=[w.get('code') if isinstance(w,dict) else w for w in (rs.get('warnings') or [])][:40]
            it['modelSha256']=sha(os.path.join(p,'model.json')) if os.path.exists(os.path.join(p,'model.json')) else None
        elif fl:
            it['outcome']='NO_MODEL'; it['code']=fl.get('code'); it['reasonCode']=fl.get('reasonCode') or (fl.get('diagnostics') or {}).get('firstFailure'); it['firstFailure']=(fl.get('diagnostics') or {}).get('firstFailure')
        else: it['outcome']='NO_RECORD'
        items.append(it)
    out['sets'][d]={'label':label,'runsHeader':runs_txt[0] if runs_txt else None,'items':items,'models':sum(1 for i in items if i['outcome']=='MODEL'),'total':len(items)}
json.dump(out,open(sys.argv[1],'w'),ensure_ascii=False,indent=1)
for d,s in out['sets'].items(): print(d, s.get('models'),'/',s.get('total'), s.get('runsHeader'))
