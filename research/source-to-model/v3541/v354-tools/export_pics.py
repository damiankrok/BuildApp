#!/usr/bin/env python3
"""export_pics.py <source-package.json> <cache dir> <out dir>: the package's drawings and exterior pictures (selected
variant, largest kept), as PNG <=1600 px, numbered, with an index — for reference reading. No analyzer output used."""
import json,sys,os,hashlib,io
from PIL import Image
pkg,cache,out=sys.argv[1:4]; os.makedirs(out,exist_ok=True)
p=json.load(open(pkg)); idx=[]
KEEP={'FLOOR_PLAN','ELEVATION','SECTION','PERSPECTIVE_RENDER','SITE_PLAN','UNKNOWN'}
n=0
for a in p['assets']:
    doc=(a.get('roles') or {}).get('document','UNKNOWN')
    if doc not in KEEP: continue
    vs=a['variants']; sel=[v for v in vs if v['id']==a.get('selectedVariantId')] or vs
    v=max(sel+vs, key=lambda v:(v.get('decoded') or {}).get('width',0)*(v.get('decoded') or {}).get('height',0)) if doc!='UNKNOWN' else sel[0]
    key=hashlib.sha256(v['url'].encode()).hexdigest()[:32]
    f=os.path.join(cache,key+'.bin')
    if not os.path.exists(f): idx.append({'asset':a['id'],'doc':doc,'missing':True}); continue
    try: im=Image.open(f); im.load()
    except Exception as e: idx.append({'asset':a['id'],'doc':doc,'error':str(e)[:80]}); continue
    w,h=im.size
    if doc=='UNKNOWN' and (w<300 or h<200): continue
    n+=1; k=min(1,1600/max(w,h)); im=im.convert('RGB')
    if k<1: im=im.resize((round(w*k),round(h*k)))
    name='%02d-%s.jpg'%(n,doc.lower()); im.save(os.path.join(out,name),quality=85)
    idx.append({'n':n,'file':name,'asset':a['id'],'doc':doc,'roles':a.get('roles'),'caption':a.get('caption'),'origPx':[w,h]})
facts={'url':p.get('canonicalUrl'),'publishedFacts':[{k:f.get(k) for k in ('label','raw','value')} for f in p.get('publishedFacts') or []],
       'publishedRooms':p.get('publishedRooms')}
json.dump({'facts':facts,'pictures':idx},open(os.path.join(out,'index.json'),'w'),indent=1,ensure_ascii=False)
print(out,n,'pictures')
