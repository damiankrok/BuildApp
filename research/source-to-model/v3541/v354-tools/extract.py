#!/usr/bin/env python3
"""extract.py <run-dir> -> JSON facts of one production run (model or refusal), no reference used."""
import json,os,sys,math
def area(poly):
    s=0
    for i in range(len(poly)):
        a,b=poly[i],poly[(i+1)%len(poly)]; s+=a['x']*b['z']-b['x']*a['z']
    return abs(s)/2
def facts(d):
    out={'dir':os.path.basename(d.rstrip('/'))}
    if os.path.exists(d+'/failure.json'):
        f=json.load(open(d+'/failure.json')); e=f.get('error',f)
        out.update(model=False, code=e.get('code'), reason=e.get('reasonCode'), stage=e.get('stage'), substage=e.get('substage'),
                   diagnostics=e.get('diagnostics'))
        return out
    if os.path.exists(d+'/build-failure.json') or (os.path.exists(d+'/description-check.json') and not os.path.exists(d+'/model.json')):
        out.update(model=False, code='DESCRIPTION_REFUSED'); return out
    if not os.path.exists(d+'/model.json'):
        out.update(model=False, code='NO_RESULT'); return out
    r=json.load(open(d+'/result-summary.json')) if os.path.exists(d+'/result-summary.json') else {}
    m=json.load(open(d+'/model.json'))
    out['model']=True
    me=r.get('measurement') or {}
    out['coverage']=me.get('coverage'); out['scale']=me.get('scale'); out['quantities']=me.get('quantities'); out['completeness']=me.get('completeness')
    out['vision']=r.get('vision'); out['sourceBasis']=r.get('sourceBasis')
    out['warnings']=[w.get('code') for w in r.get('warningDetails',[]) if w.get('severity')=='LIMITING']
    lv=sorted(m['levels'],key=lambda l:l['index']); out['levels']=[{'id':l['id'],'elev':l['elevation'],'h':l.get('height')} for l in lv]
    g=lv[0]['id'] if lv else None
    ext=[w for w in m['walls'] if w.get('kind')=='EXTERIOR' and w.get('levelId')==g]
    xs=[p[k] for w in ext for p in (w['start'],w['end']) for k in ['x']]; zs=[p['z'] for w in ext for p in (w['start'],w['end'])]
    if ext: out['groundBox']={'w':round(max(xs)-min(xs),3),'d':round(max(zs)-min(zs),3)}
    out['groundExteriorWalls']=len(ext)
    sl=[s for s in m['slabs'] if s.get('levelId')==g]
    out['groundSlabM2']=round(sum(area(s['polygon']) for s in sl),2)
    # main roof from planes (described path, compound roofs) grouped by their roof id
    groups={}
    for p in m.get('roofPlanes',[]):
        rid=p['id'].split('-plane')[0]; groups.setdefault(rid,[]).append(p)
    def parea(b): return area(b) if b else 0
    pr=[]
    for rid,ps in groups.items():
        ds=[(round(p['downslope']['x']),round(p['downslope']['z'])) for p in ps]
        k='MONO_PITCH' if len(ps)==1 else ('GABLE' if len(set(ds))==2 and len(ps)==2 else ('HIP' if len(set(ds))>=3 else 'OTHER'))
        axis='X' if all(d[0]==0 for d in ds) else ('Z' if all(d[1]==0 for d in ds) else 'MIXED')
        pr.append({'id':rid,'kind':k,'axis':axis,'pitch':max(p.get('pitchDeg',0) for p in ps),'m2':round(sum(parea(p['boundary']) for p in ps),2)})
    out['roofPlaneGroups']=pr
    def fparea(f): return (f['maxX']-f['minX'])*(f['maxZ']-f['minZ']) if f else 0
    cands=[(fparea(x.get('footprint')),x['kind'],x.get('ridgeAxis')) for x in m['roofs']]+[(g['m2']*0.8,g['kind'],g['axis']) for g in pr]
    if cands:
        a,k,ax=max(cands); out['mainRoof']={'kind':k,'ridge':'ALONG_FRONT' if ax=='X' else ('ACROSS_FRONT' if ax=='Z' else 'NA')}
    out['wallLevels']=len(set(w.get('levelId') for w in m['walls'] if w.get('kind')=='EXTERIOR'))
    out['roofs']=[{'kind':x['kind'],'pitch':x.get('pitchDeg'),'axis':x.get('ridgeAxis'),'fp':x.get('footprint'),'level':x.get('levelId')} for x in m['roofs']]
    out['rooms']=[{'level':x['levelId'],'m2':round(area(x['polygon']),2) if x.get('polygon') else None} for x in m['rooms']]
    out['openings']={k:sum(1 for o in m['openings'] if o.get('kind')==k) for k in set(o.get('kind') for o in m['openings'])}
    out['extOpenings']=sum(1 for o in m['openings'] if any(w['id']==o.get('wallId') and w.get('kind')=='EXTERIOR' for w in m['walls']))
    out['terraces']=len(m['terraces']); out['balconies']=len(m['balconies'])
    out['masses']=(r.get('counts') or {}).get('masses')
    out['modelHash']=r.get('modelHash')
    return out
if __name__=='__main__':
    print(json.dumps(facts(sys.argv[1]),ensure_ascii=False))
